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

interface PullUpsGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const DURATION_SEC = 26;

export const PullUpsGame: React.FC<PullUpsGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<'climb' | 'descent'>('climb');
  const [pullHeight, setPullHeight] = useState(0);
  const [descentTarget, setDescentTarget] = useState(0.5);
  const [isMuscleUp, setIsMuscleUp] = useState(false);
  const [feedback, setFeedback] = useState('Pulsa rápido Espacio / W para subir la barbilla');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(DURATION_SEC);
  const lastSecRef = useRef(DURATION_SEC);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const completedRef = useRef(false);

  const phaseRef = useRef<'climb' | 'descent'>('climb');
  const pullRef = useRef(0);
  const repsCountRef = useRef(0);
  const muscleUpActiveRef = useRef(false);
  const brakingRef = useRef(false);
  const descentPosRef = useRef(0);
  const descentSpeedRef = useRef(0);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'pullups',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((125 + scoreRef.current * 0.04) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  const pulseClimb = useCallback(() => {
    if (completedRef.current) return;
    if (phaseRef.current === 'climb') {
      const targetMax = muscleUpActiveRef.current ? 1.28 : 1.0;
      const gain = 0.24 - difficulty * 0.015;
      pullRef.current = Math.min(targetMax, pullRef.current + gain);
      setPullHeight(Math.round((pullRef.current / targetMax) * 100));
      sound.playTap();

      if (pullRef.current >= targetMax - 0.01) {
        phaseRef.current = 'descent';
        setPhase('descent');
        descentPosRef.current = 0;
        descentSpeedRef.current = 0.65 + difficulty * 0.14;
        setFeedback('¡ARRIBA! Mantén FRENO en la zona verde mientras bajas');
        sound.playPerfect();
      }
    } else {
      // Braking tap during eccentric descent also helps lock pace
      brakingRef.current = true;
    }
  }, [difficulty]);

  const setBrake = useCallback((active: boolean) => {
    brakingRef.current = active;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) pulseClimb();
        if (phaseRef.current === 'descent') setBrake(true);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        setBrake(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') {
        setBrake(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pulseClimb, setBrake]);

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
    dressGymScene(scene, { fogNear: 8, fogFar: 22 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 40);
    camera.position.set(1.15, 1.55, computeResponsiveCameraZ(4.2, aspect, 1.0));
    camera.lookAt(0, 1.45, 0.05);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => completedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Pull-up Power Rig Frame + High Steel Bar
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const barMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 });
    const barY = 2.25;
    const barZ = 0.14;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.55, 0.11), steelMat);
      post.position.set(side * 0.9, 1.275, barZ);
      post.castShadow = true;
      scene.add(post);
      const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.95), steelMat);
      baseFoot.position.set(side * 0.9, 0.025, barZ);
      scene.add(baseFoot);
    }
    const pullBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.85, 20), barMat);
    pullBar.rotation.z = Math.PI / 2;
    pullBar.position.set(0, barY, barZ);
    scene.add(pullBar);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0.35, 0.08);
    scene.add(athleteRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => completedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, 0);
        rig.posePullUp(0, barY, barZ);
        scene.add(rig.root);
        glbRig = rig;
        athleteRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(4.2, nextAsp, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (completedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      timeRef.current = Math.max(0, timeRef.current - dt);
      const sec = Math.ceil(timeRef.current);
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        setTimeLeft(sec);
      }
      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      if (phaseRef.current === 'climb') {
        pullRef.current = Math.max(0, pullRef.current - dt * (0.28 + difficulty * 0.06));
        const targetMax = muscleUpActiveRef.current ? 1.28 : 1.0;
        setPullHeight(Math.round((pullRef.current / targetMax) * 100));
      } else {
        // Eccentric descent: keep descent speed controlled (ideal speed 0.25..0.55)
        const targetSpeed = brakingRef.current ? 0.34 : 1.18 + difficulty * 0.18;
        descentSpeedRef.current = THREE.MathUtils.damp(descentSpeedRef.current, targetSpeed, 7, dt);
        descentPosRef.current += descentSpeedRef.current * dt;
        const targetMax = muscleUpActiveRef.current ? 1.28 : 1.0;
        pullRef.current = Math.max(0, targetMax * (1 - descentPosRef.current));
        setDescentTarget(Number(THREE.MathUtils.clamp(descentSpeedRef.current / 1.4, 0, 1).toFixed(2)));
        setPullHeight(Math.round((pullRef.current / targetMax) * 100));

        if (descentPosRef.current >= 1) {
          actionsRef.current += 1;
          const cleanControl = brakingRef.current || descentSpeedRef.current < 0.72;
          if (cleanControl) {
            comboRef.current += 1;
            perfectRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            const mult = muscleUpActiveRef.current ? 1.65 : 1.0;
            const pts = Math.round((240 + comboRef.current * 28) * cfg.rewardMult * mult);
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setFeedback(
              muscleUpActiveRef.current
                ? `¡MUSCLE-UP PERFECTO! +${pts} pts`
                : `¡Bajada controlada! +${pts} pts`
            );
            sound.playPerfect();
          } else {
            comboRef.current = 0;
            setCombo(0);
            const pts = Math.round(90 * cfg.rewardMult);
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setFeedback('¡Caíste muy rápido! Mantén freno en la bajada');
            sound.playMiss();
          }

          repsCountRef.current += 1;
          const nextMU = difficulty >= 3 && repsCountRef.current % 3 === 2;
          muscleUpActiveRef.current = nextMU;
          setIsMuscleUp(nextMU);
          phaseRef.current = 'climb';
          setPhase('climb');
          pullRef.current = 0;
          brakingRef.current = false;
        }
      }

      if (glbRig) {
        glbRig.posePullUp(pullRef.current, barY, barZ);
      } else {
        athleteRig.root.position.y = 0.22 + pullRef.current * 0.52;
        athleteRig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-2.8, -0.7, Math.min(1, pullRef.current));
        athleteRig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-2.8, -0.7, Math.min(1, pullRef.current));
      }

      renderer.render(scene, camera);
      frameId = isSoftwareGl
        ? afterDraw(renderer, () => tick(performance.now()), () => completedRef.current)
        : requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      disposeScene(scene, renderer);
    };
  }, [aiModel, athlete, cfg.rewardMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Fuerza Calistenia 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white flex items-center gap-2">
            Dominadas & Muscle-Up
            {isMuscleUp && (
              <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-xs font-black uppercase">
                Muscle-Up x1.65
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-2xl text-orange-400">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Combo</div>
            <div className="font-mono-tabular font-black text-xl text-white">x{combo}</div>
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

        <div className="absolute top-4 left-4 w-56 bg-black/75 backdrop-blur-md border border-white/15 rounded-xl p-3">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1">
            <span>{phase === 'climb' ? 'Altura de Dominada' : 'Velocidad de Bajada'}</span>
            <span className="text-white font-bold">
              {phase === 'climb' ? `${pullHeight}%` : descentTarget < 0.5 ? 'Controlada' : 'Rápida'}
            </span>
          </div>
          {phase === 'climb' ? (
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 transition-all duration-75" style={{ width: `${pullHeight}%` }} />
            </div>
          ) : (
            <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[45%] bg-emerald-500/40 border-r border-emerald-400" />
              <div
                className={`absolute top-0 bottom-0 w-2.5 -ml-1 rounded-full ${
                  descentTarget < 0.45 ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
                style={{ left: `${Math.min(95, descentTarget * 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] flex gap-3">
        <button
          type="button"
          onPointerDown={() => {
            if (phase === 'climb') pulseClimb();
            else setBrake(true);
          }}
          onPointerUp={() => setBrake(false)}
          onPointerLeave={() => setBrake(false)}
          className={`flex-1 py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer transition-all ${
            phase === 'climb'
              ? 'bg-orange-500 hover:bg-orange-400 active:scale-[0.98] text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black'
          }`}
        >
          {phase === 'climb'
            ? isMuscleUp
              ? '¡PULSA RÁPIDO PARA MUSCLE-UP! (Espacio)'
              : '¡TIRA ARRIBA! Pulsa rápido (Espacio / W)'
            : 'MANTÉN PULSADO PARA FRENAR LA BAJADA'}
        </button>
      </div>
    </div>
  );
};
