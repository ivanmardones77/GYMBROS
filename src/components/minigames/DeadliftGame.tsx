import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import { DuelProgressBanner } from '../DuelProgressBanner';
import {
  addGymDecor,
  afterDraw,
  computeResponsiveCameraZ,
  createProceduralGymFloorTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeScene,
  dressGymScene,
} from '../../three/threeUtils';
import { AthleteBuildOptions, buildAthleteModel } from '../../three/buildAthleteModel';
import { GlbPoseRig, loadMinigameGlbAthlete } from '../../three/buildGlbAthlete';
import { buildOlympicBarbell, createOakPlatformTexture } from '../../three/gymProps';

interface DeadliftGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_REPS = 8;

export const DeadliftGame: React.FC<DeadliftGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [rep, setRep] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [pullPct, setPullPct] = useState(0);
  const [balanceVal, setBalanceVal] = useState(0); // -1..1 (safe inside +-0.42)
  const [isPulling, setIsPulling] = useState(false);
  const [feedback, setFeedback] = useState('Mantén Espacio para tirar y equilibra la barra con A / D');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const pullingRef = useRef(false);
  const pullProgressRef = useRef(0);
  const balanceRef = useRef(0);
  const driftVelRef = useRef(0);
  const repRef = useRef(1);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const lockedRef = useRef(false);
  const unmountedRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);
  const keysRef = useRef({ left: false, right: false });

  const finishGame = useCallback(() => {
    if (unmountedRef.current) return;
    unmountedRef.current = true;
    onComplete({
      gameId: 'deadlift',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((130 + scoreRef.current * 0.04) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const steerBalance = useCallback((dir: -1 | 1) => {
    if (lockedRef.current) return;
    balanceRef.current = THREE.MathUtils.clamp(balanceRef.current + dir * 0.24, -1.15, 1.15);
    driftVelRef.current *= 0.4;
    sound.playTap();
  }, []);

  const setPullActive = useCallback((active: boolean) => {
    if (lockedRef.current) return;
    pullingRef.current = active;
    setIsPulling(active);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) setPullActive(true);
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
        if (!e.repeat) steerBalance(-1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
        if (!e.repeat) steerBalance(1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setPullActive(false);
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        keysRef.current.left = false;
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        keysRef.current.right = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setPullActive, steerBalance]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    let envMap: THREE.Texture;
    try {
      const studio = createStudioRenderer(container, isSoftwareGl);
      renderer = studio.renderer;
      envMap = studio.envMap;
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 7.5, fogFar: 20 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 40);
    const baseCamZ = computeResponsiveCameraZ(4.1, aspect, 1.0);
    camera.position.set(1.25, 1.45, baseCamZ);
    camera.lookAt(0, 0.92, 0.15);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.08, 2.2),
      new THREE.MeshStandardMaterial({ map: createOakPlatformTexture(), roughness: 0.45 })
    );
    platform.position.set(0, 0.04, 0.1);
    platform.receiveShadow = true;
    scene.add(platform);

    const lifter = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    lifter.root.position.set(0, 0.08, -0.05);
    scene.add(lifter.root);

    let glbLifter: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0.08, -0.05);
        rig.poseDeadlift(0, 0, 0.08);
        scene.add(rig.root);
        glbLifter = rig;
        lifter.root.visible = false;
      },
    });

    const { group: barbellGroup, platePairs } = buildOlympicBarbell({
      plateBaseX: 1.24,
      maxPlates: 5,
      plateStep: 0.068,
      plateBaseRadius: 0.36,
    });
    barbellGroup.position.set(0, 0.45, 0.24);
    scene.add(barbellGroup);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(4.1, nextAsp, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const advanceRep = (success: boolean, cleanBonus: boolean) => {
      lockedRef.current = true;
      pullingRef.current = false;
      setIsPulling(false);
      actionsRef.current += 1;

      if (success) {
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (cleanBonus) perfectRef.current += 1;
        const pts = Math.round((cleanBonus ? 280 : 190) * cfg.rewardMult + comboRef.current * 24);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(
          cleanBonus
            ? `¡LOCKOUT PERFECTO! Barra estable +${pts} pts`
            : `¡Levantamiento completado! +${pts} pts`
        );
        sound.playPerfect();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('¡Barra desequilibrada! Corrige el balance con A / D');
        sound.playMiss();
      }

      if (repRef.current >= TOTAL_REPS) {
        resetTimerRef.current = window.setTimeout(finishGame, 550);
      } else {
        resetTimerRef.current = window.setTimeout(() => {
          if (unmountedRef.current) return;
          repRef.current += 1;
          setRep(repRef.current);
          pullProgressRef.current = 0;
          balanceRef.current = 0;
          driftVelRef.current = 0;
          lockedRef.current = false;
          setPullPct(0);
          setBalanceVal(0);
          setFeedback('¡Siguiente serie! Tira con Espacio y estabiliza la barra');
        }, 620);
      }
    };

    const tick = (now: number) => {
      if (unmountedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const visiblePlates = Math.min(5, Math.ceil(repRef.current / 2) + (difficulty - 1));
      platePairs.forEach(([l, r], idx) => {
        l.visible = idx < visiblePlates;
        r.visible = idx < visiblePlates;
      });

      if (!lockedRef.current) {
        if (keysRef.current.left) balanceRef.current -= dt * 1.45;
        if (keysRef.current.right) balanceRef.current += dt * 1.45;

        if (pullingRef.current) {
          const wobbleStrength = (0.7 + difficulty * 0.28 + repRef.current * 0.08) * cfg.speedMult;
          const wave = Math.sin(now * 0.0055 + repRef.current * 1.7) * wobbleStrength;
          driftVelRef.current += (wave * 0.9 + (balanceRef.current >= 0 ? 0.35 : -0.35)) * dt;
          driftVelRef.current = THREE.MathUtils.clamp(driftVelRef.current, -1.6, 1.6);
          balanceRef.current = THREE.MathUtils.clamp(
            balanceRef.current + driftVelRef.current * dt,
            -1.15,
            1.15
          );

          const pullSpeed = 0.56 - difficulty * 0.04;
          pullProgressRef.current = Math.min(1, pullProgressRef.current + pullSpeed * dt);

          if (Math.abs(balanceRef.current) >= 1.0) {
            advanceRep(false, false);
          } else if (pullProgressRef.current >= 1.0) {
            advanceRep(true, Math.abs(balanceRef.current) < 0.38);
          }
        } else {
          pullProgressRef.current = Math.max(0, pullProgressRef.current - dt * 0.45);
          balanceRef.current = THREE.MathUtils.damp(balanceRef.current, 0, 5, dt);
          driftVelRef.current *= 0.9;
        }

        setPullPct(Math.round(pullProgressRef.current * 100));
        setBalanceVal(Number(balanceRef.current.toFixed(2)));
      }

      const tiltRad = balanceRef.current * 0.22;
      if (glbLifter) {
        const synced = glbLifter.poseDeadlift(pullProgressRef.current, tiltRad, 0.08);
        barbellGroup.position.set(0, synced.barY, synced.barZ);
        barbellGroup.rotation.z = tiltRad;
      } else {
        const t = pullProgressRef.current;
        lifter.upperBody.rotation.x = THREE.MathUtils.lerp(0.85, 0.05, t);
        lifter.leftLegPivot.rotation.x = THREE.MathUtils.lerp(-0.55, 0, t);
        lifter.rightLegPivot.rotation.x = THREE.MathUtils.lerp(-0.55, 0, t);
        lifter.leftKneePivot.rotation.x = THREE.MathUtils.lerp(0.9, 0.05, t);
        lifter.rightKneePivot.rotation.x = THREE.MathUtils.lerp(0.9, 0.05, t);
        lifter.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.7, 0.05, t);
        lifter.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.7, 0.05, t);
        barbellGroup.position.set(0, THREE.MathUtils.lerp(0.45, 0.88, t), 0.24);
        barbellGroup.rotation.z = tiltRad;
      }

      renderer.render(scene, camera);
      frameId = isSoftwareGl
        ? afterDraw(renderer, () => tick(performance.now()), () => unmountedRef.current)
        : requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      disposeScene(scene, renderer);
    };
  }, [aiModel, athlete, cfg.rewardMult, cfg.speedMult, difficulty, finishGame]);

  const weightKg = 70 + Math.min(5, Math.ceil(rep / 2) + (difficulty - 1)) * 30;
  const balancePct = 50 + balanceVal * 42;
  const balanceSafe = Math.abs(balanceVal) < 0.42;

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Fuerza 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Peso Muerto Titánico ({weightKg} kg)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Serie</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {rep}/{TOTAL_REPS}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Combo</div>
            <div className="font-mono-tabular font-black text-xl text-orange-400">x{combo}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Puntos</div>
            <div className="font-mono-tabular font-black text-2xl text-white">
              {score.toLocaleString('es-ES')}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-xs font-semibold text-white/75 cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>

      {rivalTargetScore !== undefined && rivalName && (
        <DuelProgressBanner score={score} rivalTargetScore={rivalTargetScore} rivalName={rivalName} />
      )}

      <div className="relative h-[380px] sm:h-[430px] bg-black select-none">
        <div ref={mountRef} className="w-full h-full" />

        {/* Overhead Balance Gauge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,340px)] bg-black/75 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
            <span>Equilibrio Barra</span>
            <span className={balanceSafe ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {balanceSafe ? 'Estable' : '¡Inclinada!'}
            </span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[32%] right-[32%] bg-emerald-500/35 border-x border-emerald-400/60" />
            <div
              className={`absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full ${
                balanceSafe ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
              style={{ left: `${Math.max(4, Math.min(96, balancePct))}%` }}
            />
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-75"
              style={{ width: `${pullPct}%` }}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white text-center whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => steerBalance(-1)}
          className="py-3.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ← Equil. Izq (A)
        </button>
        <button
          type="button"
          onPointerDown={() => setPullActive(true)}
          onPointerUp={() => setPullActive(false)}
          onPointerLeave={() => setPullActive(false)}
          className={`col-span-2 py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer transition-all ${
            isPulling
              ? 'bg-orange-400 text-black scale-[0.98]'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          Mantén para Tirar (Espacio)
        </button>
        <button
          type="button"
          onPointerDown={() => steerBalance(1)}
          className="py-3.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Equil. Der (D) →
        </button>
      </div>
    </div>
  );
};
