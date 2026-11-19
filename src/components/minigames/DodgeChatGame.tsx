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

interface DodgeChatGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type LaneIdx = 0 | 1 | 2;
const LANE_X = [-0.82, 0, 0.82] as const;
const GAME_DURATION = 26;
const EXCUSES = [
  { key: '1', label: '¡Se me enfría el batido!' },
  { key: '2', label: '¡Me llama mi entrenador!' },
  { key: '3', label: '¡Voy a por la toalla!' },
];

interface TalkerEntity {
  lane: LaneIdx;
  z: number;
  resolved: boolean;
  mesh: THREE.Group;
  rig: ReturnType<typeof buildAthleteModel>;
  phaseOffset: number;
}

export const DodgeChatGame: React.FC<DodgeChatGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lane, setLane] = useState<LaneIdx>(1);
  const [trappedPrompt, setTrappedPrompt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('Cambia de carril con A / S / D para esquivar al pesado de los suplementos');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const talkersRef = useRef<TalkerEntity[]>([]);
  const spawnTimerRef = useRef(0.6);
  const laneRef = useRef<LaneIdx>(1);
  const posXRef = useRef(0);
  const walkPhaseRef = useRef(0);
  const trappedIdxRef = useRef<number | null>(null);
  const trapTimerRef = useRef(0);

  const timeLeftRef = useRef(GAME_DURATION);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const unmountedRef = useRef(false);

  const finishGame = useCallback(() => {
    if (unmountedRef.current) return;
    unmountedRef.current = true;
    onComplete({
      gameId: 'dodge_chat',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((165 + scoreRef.current * 0.04) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const switchLane = useCallback((nextLane: LaneIdx) => {
    if (unmountedRef.current || trappedIdxRef.current !== null) return;
    laneRef.current = nextLane;
    setLane(nextLane);
    sound.playTap();
  }, []);

  const useExcuse = useCallback(
    (excuseIdx: number) => {
      if (unmountedRef.current || trappedIdxRef.current === null) return;
      actionsRef.current += 1;
      if (excuseIdx === trappedIdxRef.current) {
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const pts = Math.round((190 + comboRef.current * 22) * cfg.rewardMult);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(`🏃 ¡EXCUSA BRILLANTE! "${EXCUSES[excuseIdx].label}" +${pts} pts`);
        sound.playPerfect();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('😅 ¡Te lió 10 minutos con su rutina de antebrazos!');
        sound.playMiss();
      }
      trappedIdxRef.current = null;
      setTrappedPrompt(null);
    },
    [cfg.rewardMult]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (trappedIdxRef.current !== null) {
        if (e.code === 'Digit1') {
          e.preventDefault();
          useExcuse(0);
        } else if (e.code === 'Digit2') {
          e.preventDefault();
          useExcuse(1);
        } else if (e.code === 'Digit3') {
          e.preventDefault();
          useExcuse(2);
        }
        return;
      }

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        switchLane(0);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space') {
        e.preventDefault();
        switchLane(1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        switchLane(2);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchLane, useExcuse]);

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
    dressGymScene(scene, { fogNear: 9, fogFar: 25 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 45);
    camera.position.set(0, 2.25, -computeResponsiveCameraZ(3.15, aspect, 1.0));
    camera.lookAt(0, 0.72, 2.8);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 32),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Hallway 3-lane track markers
    const railMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.25 });
    for (const x of [-1.25, -0.41, 0.41, 1.25]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 18), railMat);
      strip.position.set(x, 0.015, 5);
      scene.add(strip);
    }

    const runnerRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    runnerRig.root.position.set(0, 0, -0.25);
    scene.add(runnerRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, -0.25);
        rig.poseSprint(0, false, 0, 9.0, 0);
        scene.add(rig.root);
        glbRig = rig;
        runnerRig.root.visible = false;
      },
    });

    const spawnTalker = () => {
      const targetLane = Math.floor(Math.random() * 3) as LaneIdx;
      const g = new THREE.Group();
      const chatNpc = buildAthleteModel({
        gender: 'male',
        fitnessScore: 48,
        skinTone: '#DFB08C',
        hairColor: '#4B5563',
        outfit: 'basic',
      });
      chatNpc.root.rotation.y = Math.PI;
      // Bright orange protein tub carried in left hand
      const tub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.08, 0.20, 14),
        new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35 })
      );
      tub.position.set(0, -0.295, 0.04);
      chatNpc.leftForearmPivot.add(tub);
      chatNpc.leftArmPivot.rotation.x = -0.35;
      chatNpc.leftForearmPivot.rotation.x = -0.85;
      g.add(chatNpc.root);

      // Floating yellow "Speech Trap" aura ring on floor
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.035, 10, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.05;
      g.add(halo);

      const startZ = 12.0;
      g.position.set(LANE_X[targetLane], 0, startZ);
      scene.add(g);
      talkersRef.current.push({
        lane: targetLane,
        z: startZ,
        resolved: false,
        mesh: g,
        rig: chatNpc,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = -computeResponsiveCameraZ(3.15, nextAsp, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (unmountedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
      setTimeLeft(Math.ceil(timeLeftRef.current));
      if (timeLeftRef.current <= 0) {
        finishGame();
        return;
      }

      if (trappedIdxRef.current !== null) {
        trapTimerRef.current -= dt;
        if (trapTimerRef.current <= 0) {
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          trappedIdxRef.current = null;
          setTrappedPrompt(null);
          setFeedback('🗣️ Te soltó un monólogo sobre proteína de cáñamo...');
          sound.playMiss();
        }
      } else {
        const speed = (4.6 + difficulty * 0.72) * cfg.speedMult;
        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          spawnTalker();
          spawnTimerRef.current = Math.max(0.42, (0.9 - difficulty * 0.08) / Math.sqrt(cfg.speedMult));
        }

        const remaining: TalkerEntity[] = [];
        for (const t of talkersRef.current) {
          t.z -= speed * dt;
          t.mesh.position.z = t.z;
          const step = now * 0.006 + t.phaseOffset;
          t.rig.leftLegPivot.rotation.x = Math.sin(step) * 0.42;
          t.rig.rightLegPivot.rotation.x = -Math.sin(step) * 0.42;
          t.rig.rightArmPivot.rotation.z = 2.25 + Math.sin(step * 1.4) * 0.35;
          t.rig.rightForearmPivot.rotation.z = 0.45 + Math.sin(step * 1.4) * 0.25;
          if (!t.resolved && t.z <= 0.12 && t.z >= -0.65) {
            if (t.lane === laneRef.current) {
              t.resolved = true;
              const req = Math.floor(Math.random() * 3);
              trappedIdxRef.current = req;
              setTrappedPrompt(req);
              trapTimerRef.current = Math.max(0.85, 1.55 * cfg.windowMult);
              setFeedback(`💬 ¡TE CORTÓ EL PASO! Pulsa [${req + 1}] "${EXCUSES[req].label}"`);
              sound.playTap();
            }
          } else if (!t.resolved && t.z < -0.65) {
            t.resolved = true;
            actionsRef.current += 1;
            comboRef.current += 1;
            perfectRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            const pts = Math.round((110 + comboRef.current * 12) * cfg.rewardMult);
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            sound.playHit();
          }
          if (t.z < -2.4) {
            scene.remove(t.mesh);
          } else {
            remaining.push(t);
          }
        }
        talkersRef.current = remaining;
      }

      const targetX = LANE_X[laneRef.current];
      posXRef.current = THREE.MathUtils.damp(posXRef.current, targetX, 16, dt);
      const isTrapped = trappedIdxRef.current !== null;
      walkPhaseRef.current += dt * (isTrapped ? 1.5 : 10.5);

      if (glbRig) {
        glbRig.root.position.x = posXRef.current;
        glbRig.poseSprint(walkPhaseRef.current, false, 0, isTrapped ? 4.8 : 9.0, 0);
      } else {
        runnerRig.root.position.x = posXRef.current;
        runnerRig.leftLegPivot.rotation.x = Math.sin(walkPhaseRef.current) * 0.55;
        runnerRig.rightLegPivot.rotation.x = -Math.sin(walkPhaseRef.current) * 0.55;
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
      talkersRef.current = [];
      disposeScene(scene, renderer);
    };
  }, [aiModel, athlete, cfg.rewardMult, cfg.speedMult, cfg.windowMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Escape del Pesado de Suplementos</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Evasiones</div>
            <div className="font-mono-tabular font-black text-xl text-amber-400">x{combo}</div>
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

        {trappedPrompt !== null && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,380px)] bg-amber-950/95 border-2 border-amber-400 rounded-xl px-4 py-3 text-center animate-pulse">
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-black">
              💬 "¡Oye tío, te cuento mi ciclo!" — Suelta la excusa [{trappedPrompt + 1}]
            </div>
            <div className="mt-1 text-base font-black text-white">
              {EXCUSES[trappedPrompt].label}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08]">
        {trappedPrompt !== null ? (
          <div className="grid grid-cols-3 gap-3">
            {EXCUSES.map((ex, i) => (
              <button
                key={ex.key}
                type="button"
                onPointerDown={() => useExcuse(i)}
                className={`py-3.5 px-2 rounded-xl font-display font-black uppercase text-sm tracking-wide cursor-pointer active:scale-95 transition-all ${
                  trappedPrompt === i
                    ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.65)]'
                    : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.15]'
                }`}
              >
                [{ex.key}] {ex.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onPointerDown={() => switchLane(0)}
              className={`py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 ${
                lane === 0 ? 'bg-orange-500 text-white' : 'bg-white/[0.08] text-white/75'
              }`}
            >
              ← Carril Izq (A)
            </button>
            <button
              type="button"
              onPointerDown={() => switchLane(1)}
              className={`py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 ${
                lane === 1 ? 'bg-orange-500 text-white' : 'bg-white/[0.08] text-white/75'
              }`}
            >
              ↓ Centro (S)
            </button>
            <button
              type="button"
              onPointerDown={() => switchLane(2)}
              className={`py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 ${
                lane === 2 ? 'bg-orange-500 text-white' : 'bg-white/[0.08] text-white/75'
              }`}
            >
              Carril Der (D) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
