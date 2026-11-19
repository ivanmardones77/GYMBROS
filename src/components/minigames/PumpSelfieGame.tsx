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

interface PumpSelfieGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const GAME_DURATION = 26;

export const PumpSelfieGame: React.FC<PumpSelfieGameProps> = ({
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
  const [underLight, setUnderLight] = useState(true);
  const [bomberNear, setBomberNear] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [feedback, setFeedback] = useState('Colócate bajo el foco dorado (A / D) y dispara (Espacio) cuando no haya nadie detrás');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const playerXRef = useRef(0);
  const spotXRef = useRef(0);
  const bomberXRef = useRef(-3.2);
  const bomberWaitRef = useRef(0.6);
  const selfiePosePulseRef = useRef(0);

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
      gameId: 'pump_selfie',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((110 + scoreRef.current * 0.036) * cfg.rewardMult),
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

  const stepX = useCallback((dir: -1 | 1) => {
    playerXRef.current = THREE.MathUtils.clamp(playerXRef.current + dir * 0.42, -1.6, 1.6);
    sound.playTap();
  }, []);

  const snapSelfie = useCallback(() => {
    if (unmountedRef.current || timeLeftRef.current <= 0) return;
    actionsRef.current += 1;
    selfiePosePulseRef.current = 1.0;
    setFlashOn(true);
    window.setTimeout(() => !unmountedRef.current && setFlashOn(false), 160);

    const lightOk = Math.abs(playerXRef.current - spotXRef.current) <= 0.48 * cfg.windowMult + 0.14;
    const bomberBlocked = Math.abs(bomberXRef.current - playerXRef.current) < 0.72;

    if (bomberBlocked) {
      comboRef.current = 0;
      setCombo(0);
      setFeedback('🤦 ¡PHOTOBOMB! Se cruzó un socio secándose detrás');
      sound.playMiss();
    } else if (lightOk) {
      comboRef.current += 1;
      perfectRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const pts = Math.round((195 + comboRef.current * 24) * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setFeedback(`📸 ¡FOTO DE PORTADA! Iluminación 10/10 +${pts} pts`);
      sound.playPerfect();
    } else {
      comboRef.current = 0;
      setCombo(0);
      const pts = Math.round(45 * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setFeedback('Oscuro... muévete bajo el halo dorado del suelo');
      sound.playHit();
    }
  }, [cfg.rewardMult, cfg.windowMult]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
        if (!e.repeat) stepX(-1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
        if (!e.repeat) stepX(1);
      } else if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        snapSelfie();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = false;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [snapSelfie, stepX]);

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
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 42);
    camera.position.set(0, 1.48, computeResponsiveCameraZ(3.65, aspect, 1.0));
    camera.lookAt(0, 1.05, 0);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Golden Overhead "Good Light" Spot Cone & Floor Ring
    const spotGroup = new THREE.Group();
    scene.add(spotGroup);
    const spotRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.56, 32),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    spotRing.rotation.x = -Math.PI / 2;
    spotRing.position.y = 0.02;
    spotGroup.add(spotRing);

    const lightBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.56, 3.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    lightBeam.position.y = 1.62;
    spotGroup.add(lightBeam);

    // Photobomber crossing in background behind athlete
    const bomberRig = buildAthleteModel({
      gender: 'male',
      fitnessScore: 34,
      skinTone: '#E8B896',
      hairColor: '#52525B',
      outfit: 'basic',
    });
    bomberRig.root.position.set(-3.2, 0, -1.05);
    scene.add(bomberRig.root);

    const modelRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    modelRig.root.position.set(0, 0, 0.25);
    scene.add(modelRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, 0.25);
        rig.poseSelfieFlex(0.5, true, 0);
        scene.add(rig.root);
        glbRig = rig;
        modelRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.65, nextAsp, 1.0);
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

      const moveSpd = 2.4;
      if (keysRef.current.left) playerXRef.current = Math.max(-1.6, playerXRef.current - moveSpd * dt);
      if (keysRef.current.right) playerXRef.current = Math.min(1.6, playerXRef.current + moveSpd * dt);

      spotXRef.current = Math.sin(now * 0.00085 * cfg.speedMult) * 1.35;
      spotGroup.position.set(spotXRef.current, 0, 0.25);

      // Photobomber crossing loop
      if (bomberWaitRef.current > 0) {
        bomberWaitRef.current -= dt;
      } else {
        bomberXRef.current += dt * (1.9 + difficulty * 0.35);
        bomberRig.root.position.set(bomberXRef.current, 0, -1.0);
        bomberRig.root.rotation.y = Math.PI / 2;
        const wStep = bomberXRef.current * 4;
        bomberRig.leftLegPivot.rotation.x = Math.sin(wStep) * 0.45;
        bomberRig.rightLegPivot.rotation.x = -Math.sin(wStep) * 0.45;
        if (bomberXRef.current > 3.2) {
          bomberXRef.current = -3.2;
          bomberWaitRef.current = Math.max(0.45, 1.3 - difficulty * 0.15);
        }
      }

      const isLit = Math.abs(playerXRef.current - spotXRef.current) <= 0.56;
      const isBombed = Math.abs(bomberXRef.current - playerXRef.current) < 0.72;
      setUnderLight(isLit);
      setBomberNear(isBombed);

      selfiePosePulseRef.current = THREE.MathUtils.damp(selfiePosePulseRef.current, 0, 6, dt);
      if (glbRig) {
        glbRig.root.position.x = playerXRef.current;
        glbRig.poseSelfieFlex(0.45 + selfiePosePulseRef.current * 0.55, true, 0);
      } else {
        modelRig.root.position.x = playerXRef.current;
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
  }, [aiModel, athlete, cfg.speedMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Cazador del Pump Perfecto</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Combo</div>
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
        {flashOn && <div className="absolute inset-0 bg-white/80 pointer-events-none" />}

        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider">
          <span className={underLight ? 'text-amber-300' : 'text-white/45'}>
            {underLight ? '💡 Luz Dorada OK' : '🌑 Fuera de Foco'}
          </span>
          <span className="text-white/25">·</span>
          <span className={bomberNear ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}>
            {bomberNear ? '⚠️ ¡SOCIO DETRÁS!' : 'Fondo Limpio'}
          </span>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => stepX(-1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ← Foco Izq (A)
        </button>
        <button
          type="button"
          onPointerDown={snapSelfie}
          className={`col-span-2 py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all ${
            underLight && !bomberNear
              ? 'bg-amber-400 text-black shadow-[0_0_24px_rgba(251,191,36,0.65)]'
              : 'bg-white/20 text-white'
          }`}
        >
          📸 ¡DISPARAR SELFIE! (Espacio)
        </button>
        <button
          type="button"
          onPointerDown={() => stepX(1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Foco Der (D) →
        </button>
      </div>
    </div>
  );
};
