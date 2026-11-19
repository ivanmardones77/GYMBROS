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

interface EgoLiftingGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_REPS = 5;

export const EgoLiftingGame: React.FC<EgoLiftingGameProps> = ({
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
  const [liftPct, setLiftPct] = useState(0);
  const [pokerVal, setPokerVal] = useState(50);
  const [isLifting, setIsLifting] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [feedback, setFeedback] = useState('Graba tu Reel con 180 kg: mantén Espacio y estabiliza la Póker Face (A / D)');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const liftingRef = useRef(false);
  const liftTRef = useRef(0);
  const pokerRef = useRef(0); // -1..1
  const driftVelRef = useRef(0);
  const keysRef = useRef({ left: false, right: false });
  const lockedRef = useRef(false);

  const repRef = useRef(1);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const unmountedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const finishGame = useCallback(() => {
    if (unmountedRef.current) return;
    unmountedRef.current = true;
    onComplete({
      gameId: 'ego_lifting',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((155 + scoreRef.current * 0.04) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const steerPoker = useCallback((dir: -1 | 1) => {
    if (lockedRef.current) return;
    pokerRef.current = THREE.MathUtils.clamp(pokerRef.current + dir * 0.25, -1.1, 1.1);
    driftVelRef.current *= 0.4;
    sound.playTap();
  }, []);

  const setLiftHold = useCallback((active: boolean) => {
    if (lockedRef.current) return;
    liftingRef.current = active;
    setIsLifting(active);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        setLiftHold(true);
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
        if (!e.repeat) steerPoker(-1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
        if (!e.repeat) steerPoker(1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setLiftHold(false);
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
  }, [setLiftHold, steerPoker]);

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
    camera.position.set(1.25, 1.48, computeResponsiveCameraZ(3.95, aspect, 1.0));
    camera.lookAt(0, 0.95, 0.15);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.68 })
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

    // Phone Tripod with Ring Light filming the lift
    const tripodPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 1.35, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8 })
    );
    tripodPole.position.set(-1.1, 0.675, 1.35);
    scene.add(tripodPole);
    const ringLight = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.024, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbeb, emissiveIntensity: 0.95 })
    );
    ringLight.position.set(-1.1, 1.42, 1.35);
    ringLight.rotation.y = 0.55;
    scene.add(ringLight);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0.08, -0.05);
    scene.add(athleteRig.root);

    let glbRig: GlbPoseRig | null = null;
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
        glbRig = rig;
        athleteRig.root.visible = false;
      },
    });

    // Huge 6-plate stack per side for comedic ego weight
    const { group: barbellGroup, platePairs } = buildOlympicBarbell({
      plateBaseX: 1.2,
      maxPlates: 6,
      plateStep: 0.065,
      plateBaseRadius: 0.37,
    });
    platePairs.forEach(([l, r]) => {
      l.visible = true;
      r.visible = true;
    });
    barbellGroup.position.set(0, 0.45, 0.24);
    scene.add(barbellGroup);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.95, nextAsp, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const completeRep = (won: boolean, cleanFace: boolean) => {
      lockedRef.current = true;
      liftingRef.current = false;
      setIsLifting(false);
      actionsRef.current += 1;

      if (won) {
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (cleanFace) perfectRef.current += 1;
        const pts = Math.round((cleanFace ? 320 : 200) * cfg.rewardMult + comboRef.current * 28);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFlashOn(true);
        window.setTimeout(() => !unmountedRef.current && setFlashOn(false), 180);
        setFeedback(
          cleanFace
            ? `😎 ¡PÓKER FACE DE ACERO! "Ni pesa..." +${pts} pts`
            : `😅 Subió con mueca épica +${pts} pts`
        );
        sound.playPerfect();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('🍅 ¡CARETO DE TOMATE Y GRUÑIDO! ¡Corten la toma!');
        sound.playMiss();
      }

      if (repRef.current >= TOTAL_REPS) {
        timerRef.current = window.setTimeout(finishGame, 580);
      } else {
        timerRef.current = window.setTimeout(() => {
          if (unmountedRef.current) return;
          repRef.current += 1;
          setRep(repRef.current);
          liftTRef.current = 0;
          pokerRef.current = 0;
          driftVelRef.current = 0;
          lockedRef.current = false;
          setLiftPct(0);
          setPokerVal(50);
          setFeedback('Siguiente repetición para el Reel — ¡pon cara de paseo!');
        }, 620);
      }
    };

    const tick = (now: number) => {
      if (unmountedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!lockedRef.current) {
        if (keysRef.current.left) pokerRef.current -= dt * 1.5;
        if (keysRef.current.right) pokerRef.current += dt * 1.5;

        if (liftingRef.current) {
          const strain = (0.78 + difficulty * 0.28 + repRef.current * 0.1) * cfg.speedMult;
          const wave = Math.sin(now * 0.0068 + repRef.current * 2.1) * strain;
          driftVelRef.current += (wave * 0.95 + (pokerRef.current >= 0 ? 0.35 : -0.35)) * dt;
          driftVelRef.current = THREE.MathUtils.clamp(driftVelRef.current, -1.65, 1.65);
          pokerRef.current = THREE.MathUtils.clamp(
            pokerRef.current + driftVelRef.current * dt,
            -1.1,
            1.1
          );

          liftTRef.current = Math.min(1, liftTRef.current + (0.52 - difficulty * 0.03) * dt);
          if (Math.abs(pokerRef.current) >= 1.0) {
            completeRep(false, false);
          } else if (liftTRef.current >= 1) {
            completeRep(true, Math.abs(pokerRef.current) < 0.36);
          }
        } else {
          liftTRef.current = Math.max(0, liftTRef.current - dt * 0.45);
          pokerRef.current = THREE.MathUtils.damp(pokerRef.current, 0, 5, dt);
          driftVelRef.current *= 0.9;
        }
        setLiftPct(Math.round(liftTRef.current * 100));
        setPokerVal(Math.round(50 + pokerRef.current * 42));
      }

      const trembleRad = pokerRef.current * 0.18;
      if (glbRig) {
        const synced = glbRig.poseDeadlift(liftTRef.current, trembleRad, 0.08);
        barbellGroup.position.set(0, synced.barY, synced.barZ);
        barbellGroup.rotation.z = trembleRad;
      } else {
        const t = liftTRef.current;
        athleteRig.upperBody.rotation.x = THREE.MathUtils.lerp(0.85, 0.05, t);
        barbellGroup.position.set(0, THREE.MathUtils.lerp(0.45, 0.88, t), 0.24);
        barbellGroup.rotation.z = trembleRad;
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

  const calm = Math.abs(pokerVal - 50) <= 18;

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Ego Lifting 180 kg · Póker Face</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tomas</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {rep}/{TOTAL_REPS}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Combo</div>
            <div className="font-mono-tabular font-black text-xl text-fuchsia-400">x{combo}</div>
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
        {flashOn && <div className="absolute inset-0 bg-white/70 pointer-events-none" />}

        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,340px)] bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
            <span>Póker Face</span>
            <span className={calm ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {calm ? '😎 Ni se inmuta' : '🍅 ¡Cara de esfuerzo!'}
            </span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[32%] right-[32%] bg-emerald-500/35 border-x border-emerald-400" />
            <div
              className={`absolute top-0 bottom-0 w-3.5 -ml-1.5 rounded-full ${
                calm ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
              style={{ left: `${Math.max(4, Math.min(96, pokerVal))}%` }}
            />
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-fuchsia-400 transition-all duration-75" style={{ width: `${liftPct}%` }} />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => steerPoker(-1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ← Calmar (A)
        </button>
        <button
          type="button"
          onPointerDown={() => setLiftHold(true)}
          onPointerUp={() => setLiftHold(false)}
          onPointerLeave={() => setLiftHold(false)}
          className={`col-span-2 py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer transition-all ${
            isLifting ? 'bg-fuchsia-400 text-black scale-[0.98]' : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
          }`}
        >
          Mantén para Subir 180kg (Espacio)
        </button>
        <button
          type="button"
          onPointerDown={() => steerPoker(1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Calmar (D) →
        </button>
      </div>
    </div>
  );
};
