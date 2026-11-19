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

interface DumbbellHeistGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_HEISTS = 2;

export const DumbbellHeistGame: React.FC<DumbbellHeistGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [phase, setPhase] = useState<'approach' | 'return'>('approach');
  const [broLooking, setBroLooking] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [feedback, setFeedback] = useState('El Gym Bro mira el móvil: mantén Espacio para acercarte al rack');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const movingRef = useRef(false);
  const broLookingRef = useRef(false);
  const broTimerRef = useRef(2.2);
  const heistPhaseRef = useRef<'approach' | 'return'>('approach');
  const progressRef = useRef(0); // 0 = bench, 1 = rack
  const walkPhaseRef = useRef(0);
  const bustedCooldownRef = useRef(0);

  const roundRef = useRef(1);
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
      gameId: 'dumbbell_heist',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((150 + scoreRef.current * 0.04) * cfg.rewardMult),
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

  const setMoveHold = useCallback((active: boolean) => {
    if (unmountedRef.current) return;
    movingRef.current = active;
    setIsMoving(active);
    if (active) sound.playTap();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        setMoveHold(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setMoveHold(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setMoveHold]);

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
    dressGymScene(scene, { fogNear: 8, fogFar: 24 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 45);
    camera.position.set(2.55, 1.55, computeResponsiveCameraZ(3.6, aspect, 1.0));
    camera.lookAt(0, 0.88, 0.75);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['bench', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Dumbbell Rack at z = 1.95
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 0, 1.95);
    scene.add(rackGroup);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.25 });
    const rackShelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.72, 0.42), ironMat);
    rackShelf.position.y = 0.36;
    rackShelf.castShadow = true;
    rackGroup.add(rackShelf);

    const prizeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.45 });
    const prizePair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.22), prizeMat);
    prizePair.position.set(0, 0.8, 0);
    rackGroup.add(prizePair);

    // Gym Bro Guard beside rack
    const broRig = buildAthleteModel({
      gender: 'male',
      fitnessScore: 86,
      skinTone: '#D6A17D',
      hairColor: '#111827',
      outfit: 'titan',
    });
    broRig.root.position.set(1.05, 0, 1.75);
    broRig.root.rotation.y = -0.35;
    scene.add(broRig.root);

    const phoneGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const phoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.03), phoneGlowMat);
    phoneMesh.position.set(0.85, 1.25, 1.55);
    scene.add(phoneMesh);

    const thiefRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    thiefRig.root.position.set(0, 0, -1.0);
    scene.add(thiefRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, -1.0);
        rig.poseStealthCarry(0, true, false, 0);
        scene.add(rig.root);
        glbRig = rig;
        thiefRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.6, nextAsp, 1.0);
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

      bustedCooldownRef.current = Math.max(0, bustedCooldownRef.current - dt);
      broTimerRef.current -= dt;
      if (broTimerRef.current <= 0) {
        const nextWatch = !broLookingRef.current;
        broLookingRef.current = nextWatch;
        setBroLooking(nextWatch);
        broTimerRef.current = nextWatch
          ? Math.max(0.8, 1.45 - difficulty * 0.1)
          : Math.max(1.25, 2.35 - difficulty * 0.22);
        if (nextWatch) {
          setFeedback('🚨 ¡LEVANTÓ LA VISTA DEL MÓVIL! ¡QUIETO!');
        } else {
          setFeedback('📱 Mira su móvil otra vez — ¡avanza sigiloso!');
        }
      }

      phoneMesh.visible = !broLookingRef.current;
      broRig.headGroup.rotation.x = broLookingRef.current ? 0 : 0.45;
      broRig.headGroup.rotation.y = broLookingRef.current ? -0.85 : 0;

      if (movingRef.current) {
        if (broLookingRef.current && bustedCooldownRef.current <= 0) {
          bustedCooldownRef.current = 0.85;
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          progressRef.current = Math.max(0, heistPhaseRef.current === 'approach' ? progressRef.current - 0.18 : progressRef.current + 0.18);
          setFeedback('😡 "¡Oye, que estoy usando esas mancuernas!" (-progreso)');
          sound.playMiss();
        } else if (!broLookingRef.current) {
          const speed = (0.42 + difficulty * 0.04) * (heistPhaseRef.current === 'return' ? 1.15 : 1.0);
          walkPhaseRef.current += dt * 7.5;
          if (heistPhaseRef.current === 'approach') {
            progressRef.current = Math.min(1, progressRef.current + speed * dt);
            if (progressRef.current >= 1) {
              actionsRef.current += 1;
              comboRef.current += 1;
              perfectRef.current += 1;
              maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
              const pts = Math.round((260 + comboRef.current * 28) * cfg.rewardMult);
              scoreRef.current += pts;
              setScore(scoreRef.current);
              setCombo(comboRef.current);
              heistPhaseRef.current = 'return';
              setPhase('return');
              prizePair.visible = false;
              setFeedback(`💪 ¡MANCUERNAS ROBADAS (+${pts})! ¡Vuelve al banco sin que mire!`);
              sound.playPerfect();
            }
          } else {
            progressRef.current = Math.max(0, progressRef.current - speed * dt);
            if (progressRef.current <= 0) {
              actionsRef.current += 1;
              comboRef.current += 1;
              perfectRef.current += 1;
              maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
              const pts = Math.round((340 + comboRef.current * 36) * cfg.rewardMult);
              scoreRef.current += pts;
              setScore(scoreRef.current);
              setCombo(comboRef.current);
              sound.playCoin();

              if (roundRef.current >= TOTAL_HEISTS) {
                finishGame();
                return;
              }
              roundRef.current += 1;
              setRound(roundRef.current);
              heistPhaseRef.current = 'approach';
              setPhase('approach');
              prizePair.visible = true;
              setFeedback(`¡BOTÍN ASEGURADO (+${pts})! Segundo par de 24 kg listo`);
            }
          }
        }
      }

      setProgressPct(Math.round(progressRef.current * 100));

      const zPos = THREE.MathUtils.lerp(-1.05, 1.45, progressRef.current);
      const facingY = heistPhaseRef.current === 'return' ? Math.PI : 0;
      const hasWeights = heistPhaseRef.current === 'return';

      if (glbRig) {
        glbRig.root.position.z = zPos;
        glbRig.root.rotation.y = facingY;
        glbRig.poseStealthCarry(walkPhaseRef.current, !hasWeights, hasWeights, 0);
      } else {
        thiefRig.root.position.z = zPos;
        thiefRig.root.rotation.y = facingY;
        thiefRig.leftLegPivot.rotation.x = Math.sin(walkPhaseRef.current) * 0.45;
        thiefRig.rightLegPivot.rotation.x = -Math.sin(walkPhaseRef.current) * 0.45;
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
  }, [aiModel, athlete, cfg.rewardMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Asalto al Rack de Mancuernas</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Misión</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {round}/{TOTAL_HEISTS}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Sigilo</div>
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,360px)] bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] mb-1.5">
            <span className="text-white/70">
              {phase === 'approach' ? 'Acercándose al Rack' : 'Escape con Mancuernas'}
            </span>
            <span className={broLooking ? 'text-rose-400 font-black animate-pulse' : 'text-emerald-400 font-bold'}>
              {broLooking ? '👀 ¡MIRANDO!' : '📱 MÓVIL (VÍA LIBRE)'}
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                phase === 'return' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08]">
        <button
          type="button"
          onPointerDown={() => setMoveHold(true)}
          onPointerUp={() => setMoveHold(false)}
          onPointerLeave={() => setMoveHold(false)}
          className={`w-full py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer transition-all ${
            isMoving
              ? 'bg-amber-400 text-black scale-[0.98]'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          {isMoving
            ? phase === 'approach'
              ? '¡AVANZANDO EN SILENCIO!'
              : '¡ESCAPANDO CON EL BOTÍN!'
            : 'MANTÉN PARA MOVERTE SIGILOSO (Espacio / W)'}
        </button>
      </div>
    </div>
  );
};
