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

interface MirrorPosingGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type WatchState = 'safe' | 'warning' | 'watching';
const GAME_DURATION = 25;

export const MirrorPosingGame: React.FC<MirrorPosingGameProps> = ({
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
  const [watchState, setWatchState] = useState<WatchState>('safe');
  const [isPosing, setIsPosing] = useState(false);
  const [feedback, setFeedback] = useState('Nadie mira: mantén Espacio para sacar doble bíceps y suelta en rojo');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const posingRef = useRef(false);
  const watchRef = useRef<WatchState>('safe');
  const stateTimerRef = useRef(2.4);
  const tickAccumRef = useRef(0);
  const flexTRef = useRef(0);
  const bustedFlagRef = useRef(false);

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
      gameId: 'mirror_posing',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((115 + scoreRef.current * 0.035) * cfg.rewardMult),
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

  const setPoseHold = useCallback((active: boolean) => {
    if (unmountedRef.current || timeLeftRef.current <= 0) return;
    if (active && !posingRef.current) {
      posingRef.current = true;
      setIsPosing(true);
      sound.playTap();
    } else if (!active && posingRef.current) {
      posingRef.current = false;
      setIsPosing(false);
      if (watchRef.current === 'warning') {
        actionsRef.current += 1;
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const pts = Math.round(115 * cfg.rewardMult);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(`¡DISIMULO MAESTRO! Justo a tiempo +${pts} pts`);
        sound.playPerfect();
      }
    }
  }, [cfg.rewardMult]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        setPoseHold(true);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        setPoseHold(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setPoseHold(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setPoseHold]);

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
    camera.position.set(0.28, 1.38, computeResponsiveCameraZ(3.05, aspect, 1.0));
    camera.lookAt(0, 1.05, -0.25);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], {
      focus: { x: 0, z: -0.2 },
      isCancelled: () => unmountedRef.current,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Mirror POV Frame & LED Status Light Perimeter (framing edges without blocking camera view)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
    const statusStripMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
    });
    for (const sx of [-1.85, 1.85]) {
      const sidePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.12), frameMat);
      sidePost.position.set(sx, 1.3, 0.85);
      scene.add(sidePost);
      const sideLed = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.45, 0.04), statusStripMat);
      sideLed.position.set(sx - Math.sign(sx) * 0.055, 1.3, 0.82);
      scene.add(sideLed);
    }
    const statusBar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.09, 0.1), statusStripMat);
    statusBar.position.set(0, 2.52, 0.85);
    scene.add(statusBar);

    // Background Gym Monitor / Staff NPC who patrols behind athlete and turns during warning/watching
    const monitorRig = buildAthleteModel({
      gender: 'male',
      fitnessScore: 72,
      skinTone: '#DFB08C',
      hairColor: '#18181B',
      outfit: 'basic',
    });
    monitorRig.root.position.set(-1.1, 0, -1.65);
    monitorRig.root.rotation.y = Math.PI / 2;
    scene.add(monitorRig.root);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0, 0.05);
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
        rig.root.position.set(0, 0, 0.05);
        rig.poseMirrorFlex(0, true, 0);
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
      camera.position.z = computeResponsiveCameraZ(3.05, nextAsp, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;
    let patrolPhase = 0;

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

      stateTimerRef.current -= dt;
      if (stateTimerRef.current <= 0) {
        if (watchRef.current === 'safe') {
          watchRef.current = 'warning';
          setWatchState('warning');
          stateTimerRef.current = Math.max(0.42, 0.88 * cfg.windowMult);
          setFeedback('⚠️ ¡SE ACERCAN PASOS EN EL ESPEJO! ¡Suelta / disimula!');
          sound.playTap();
        } else if (watchRef.current === 'warning') {
          watchRef.current = 'watching';
          setWatchState('watching');
          bustedFlagRef.current = false;
          stateTimerRef.current = 1.2 + Math.random() * 0.7;
          setFeedback('👀 ¡EL MONITOR ESTÁ MIRANDO! Quédate estirando el cuello');
        } else {
          watchRef.current = 'safe';
          setWatchState('safe');
          stateTimerRef.current = (1.9 + Math.random() * 1.4) / Math.sqrt(cfg.speedMult);
          setFeedback('Luz verde — ¡A posar frente al espejo!');
        }
      }

      if (watchRef.current === 'safe') {
        statusStripMat.color.setHex(0x10b981);
        statusStripMat.emissive.setHex(0x10b981);
        patrolPhase += dt * 1.15;
        const nextX = Math.sin(patrolPhase) * 1.35;
        const vx = Math.cos(patrolPhase);
        monitorRig.root.position.x = nextX;
        const targetYaw = vx >= 0 ? Math.PI * 0.55 : -Math.PI * 0.55;
        monitorRig.root.rotation.y = THREE.MathUtils.damp(monitorRig.root.rotation.y, targetYaw, 6, dt);
        const step = patrolPhase * 4.5;
        monitorRig.leftLegPivot.rotation.x = Math.sin(step) * 0.35;
        monitorRig.rightLegPivot.rotation.x = -Math.sin(step) * 0.35;
        monitorRig.leftArmPivot.rotation.x = -Math.sin(step) * 0.25;
        monitorRig.rightArmPivot.rotation.x = Math.sin(step) * 0.25;
        monitorRig.headGroup.rotation.y = 0;
      } else if (watchRef.current === 'warning') {
        statusStripMat.color.setHex(0xfbbf24);
        statusStripMat.emissive.setHex(0xfbbf24);
        // Monitor stops and begins turning head/torso toward the mirror
        monitorRig.root.rotation.y = THREE.MathUtils.damp(monitorRig.root.rotation.y, 0.45, 7, dt);
        monitorRig.leftLegPivot.rotation.x = THREE.MathUtils.damp(monitorRig.leftLegPivot.rotation.x, 0, 8, dt);
        monitorRig.rightLegPivot.rotation.x = THREE.MathUtils.damp(monitorRig.rightLegPivot.rotation.x, 0, 8, dt);
        monitorRig.headGroup.rotation.y = THREE.MathUtils.damp(monitorRig.headGroup.rotation.y, -0.35, 8, dt);
      } else {
        statusStripMat.color.setHex(0xf43f5e);
        statusStripMat.emissive.setHex(0xf43f5e);
        // Monitor stares straight toward athlete/mirror!
        monitorRig.root.rotation.y = THREE.MathUtils.damp(monitorRig.root.rotation.y, -Math.atan2(monitorRig.root.position.x, 1.7), 10, dt);
        monitorRig.leftLegPivot.rotation.x = 0;
        monitorRig.rightLegPivot.rotation.x = 0;
        monitorRig.headGroup.rotation.y = 0;
      }

      if (posingRef.current) {
        if (watchRef.current === 'watching' && !bustedFlagRef.current) {
          bustedFlagRef.current = true;
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          setFeedback('😳 ¡TE PILLARON POSANDO! Qué vergüenza...');
          sound.playMiss();
        } else if (watchRef.current !== 'watching') {
          tickAccumRef.current += dt;
          if (tickAccumRef.current >= 0.42) {
            tickAccumRef.current -= 0.42;
            actionsRef.current += 1;
            comboRef.current += 1;
            perfectRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            const pts = Math.round((85 + comboRef.current * 8) * cfg.rewardMult);
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            sound.playHit();
          }
        }
      }

      flexTRef.current = THREE.MathUtils.damp(flexTRef.current, posingRef.current ? 1 : 0, 10, dt);

      if (glbRig) {
        glbRig.poseMirrorFlex(flexTRef.current, !posingRef.current, 0);
      } else {
        athleteRig.leftArmPivot.rotation.z = posingRef.current ? 1.35 : 0.15;
        athleteRig.rightArmPivot.rotation.z = posingRef.current ? -1.35 : -0.15;
        athleteRig.leftForearmPivot.rotation.x = posingRef.current ? -1.45 : -0.2;
        athleteRig.rightForearmPivot.rotation.x = posingRef.current ? -1.45 : -0.2;
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
  }, [aiModel, athlete, cfg.rewardMult, cfg.speedMult, cfg.windowMult, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Posing Pirata en el Espejo</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Racha</div>
            <div className="font-mono-tabular font-black text-xl text-purple-400">x{combo}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Ego Pts</div>
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

        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-xl border text-xs font-black uppercase tracking-wider backdrop-blur-md transition-colors ${
            watchState === 'safe'
              ? 'bg-emerald-950/85 border-emerald-400 text-emerald-300'
              : watchState === 'warning'
              ? 'bg-amber-950/90 border-amber-400 text-amber-300 animate-pulse'
              : 'bg-rose-950/90 border-rose-500 text-rose-300'
          }`}
        >
          {watchState === 'safe'
            ? 'VÍA LIBRE · ¡SACA BÍCEPS!'
            : watchState === 'warning'
            ? '⚠️ ¡SE GIRAN! SUELTA AHORA'
            : '👀 MIRANDO · DISIMULA ESTIRANDO'}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-3 gap-3">
        <button
          type="button"
          onPointerDown={() => setPoseHold(true)}
          onPointerUp={() => setPoseHold(false)}
          onPointerLeave={() => setPoseHold(false)}
          className={`col-span-2 py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer transition-all ${
            isPosing
              ? 'bg-purple-400 text-black scale-[0.98]'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {isPosing ? '¡POSANDO A TOPE! (Suelta para disimular)' : 'MANTÉN PARA POSAR (Espacio)'}
        </button>
        <button
          type="button"
          onPointerDown={() => setPoseHold(false)}
          className="py-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Disimular (S)
        </button>
      </div>
    </div>
  );
};
