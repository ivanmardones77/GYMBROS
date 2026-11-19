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

interface MobilityFlowGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const GAME_DURATION = 22;

export const MobilityFlowGame: React.FC<MobilityFlowGameProps> = ({
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
  const [breathLabel, setBreathLabel] = useState('Inhala suave');
  const [orbPos, setOrbPos] = useState({ x: 50, y: 50 });
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [inHalo, setInHalo] = useState(true);
  const [feedback, setFeedback] = useState('Sigue el orbe luminoso con el ratón, dedo o WASD para recuperar energía');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const targetRef = useRef({ x: 50, y: 50 });
  const cursorRef = useRef({ x: 50, y: 50 });
  const tickAccumRef = useRef(0);
  const flowPhaseRef = useRef(0);

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
      gameId: 'mobility_flow',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((55 + scoreRef.current * 0.025) * cfg.rewardMult),
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keysRef.current.up = true;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') keysRef.current.down = true;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = true;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keysRef.current.up = false;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') keysRef.current.down = false;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = false;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

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
    camera.position.set(1.15, 1.45, computeResponsiveCameraZ(3.25, aspect, 1.0));
    camera.lookAt(0, 1.0, 0.05);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.68 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Recovery Mat + Cyan Foam Roller
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.03, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    mat.position.set(0, 0.015, 0);
    mat.receiveShadow = true;
    scene.add(mat);

    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.65, 20),
      new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.5 })
    );
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0.45, 0.12, 0.55);
    roller.castShadow = true;
    scene.add(roller);

    const zenOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 18),
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      })
    );
    scene.add(zenOrb);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(-0.2, 0.03, 0);
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
        rig.root.position.set(-0.2, 0.03, 0);
        rig.poseMobilityStretch(0, 0.03);
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
      camera.position.z = computeResponsiveCameraZ(3.25, nextAsp, 1.0);
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

      const speed = (1.1 + difficulty * 0.22) * cfg.speedMult;
      flowPhaseRef.current += dt * speed;
      const p = flowPhaseRef.current;

      // Figure-8 Zen Lissajous orb path inside 18..82% pad
      const tx = 50 + Math.sin(p) * 32;
      const ty = 50 + Math.sin(p * 2) * 24;
      targetRef.current = { x: tx, y: ty };
      setOrbPos({ x: tx, y: ty });

      const breathCycle = (p % (Math.PI * 2)) / (Math.PI * 2);
      setBreathLabel(
        breathCycle < 0.4 ? 'Inhala profundo' : breathCycle < 0.6 ? 'Mantén arriba' : 'Exhala suave'
      );

      // Keyboard control fallback
      const keySpeed = 48 * dt;
      if (keysRef.current.left) cursorRef.current.x = Math.max(6, cursorRef.current.x - keySpeed);
      if (keysRef.current.right) cursorRef.current.x = Math.min(94, cursorRef.current.x + keySpeed);
      if (keysRef.current.up) cursorRef.current.y = Math.max(6, cursorRef.current.y - keySpeed);
      if (keysRef.current.down) cursorRef.current.y = Math.min(94, cursorRef.current.y + keySpeed);
      setPlayerPos({ ...cursorRef.current });

      const dist = Math.hypot(cursorRef.current.x - tx, cursorRef.current.y - ty);
      const inside = dist <= 16 * cfg.windowMult;
      setInHalo(inside);

      tickAccumRef.current += dt;
      if (tickAccumRef.current >= 0.45) {
        tickAccumRef.current -= 0.45;
        actionsRef.current += 1;
        if (inside) {
          comboRef.current += 1;
          perfectRef.current += 1;
          maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
          const pts = Math.round((62 + comboRef.current * 5) * cfg.rewardMult);
          scoreRef.current += pts;
          setScore(scoreRef.current);
          setCombo(comboRef.current);
          setFeedback(`¡Flujo Armónico! Recuperación activa +${pts} pts`);
          sound.playPushChime();
        } else {
          comboRef.current = 0;
          setCombo(0);
          setFeedback('Guía tu cursor dentro del aura turquesa');
        }
      }

      zenOrb.position.set(((tx - 50) / 50) * 0.9, 1.35 + ((50 - ty) / 50) * 0.45, 0.45);
      roller.rotation.y = Math.sin(p) * 0.4;

      if (glbRig) {
        glbRig.poseMobilityStretch(p, 0.03);
      } else {
        const reach = 0.5 + 0.5 * Math.sin(p * 0.5);
        athleteRig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.4, -2.6, reach);
        athleteRig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.4, -2.6, reach);
        athleteRig.upperBody.rotation.z = Math.sin(p) * 0.14;
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
  }, [aiModel, athlete, cfg.rewardMult, cfg.speedMult, cfg.windowMult, difficulty, finishGame]);

  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 100;
    const ny = ((e.clientY - rect.top) / rect.height) * 100;
    cursorRef.current.x = THREE.MathUtils.clamp(nx, 4, 96);
    cursorRef.current.y = THREE.MathUtils.clamp(ny, 4, 96);
    setPlayerPos({ ...cursorRef.current });
  };

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Recuperación Zen · {cfg.label}</p>
          <h3 className="text-2xl text-white">Estiramiento &amp; Foam Roller (+Energía)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Flujo</div>
            <div className="font-mono-tabular font-black text-xl text-teal-400">x{combo}</div>
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

        {/* Breath Pad Overlay */}
        <div
          onPointerMove={handlePadPointer}
          onPointerDown={handlePadPointer}
          className="absolute inset-0 cursor-crosshair touch-none"
        >
          <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-xl bg-black/75 border border-teal-400/40 text-xs font-bold text-teal-300 uppercase tracking-wider pointer-events-none">
            {breathLabel}
          </div>

          {/* Moving Zen Target Halo */}
          <div
            className={`absolute w-20 h-20 -ml-10 -mt-10 rounded-full border-2 flex items-center justify-center transition-colors pointer-events-none ${
              inHalo
                ? 'border-teal-300 bg-teal-400/20 shadow-[0_0_24px_rgba(45,212,191,0.55)]'
                : 'border-white/35 bg-white/5'
            }`}
            style={{ left: `${orbPos.x}%`, top: `${orbPos.y}%` }}
          >
            <div className="w-4 h-4 rounded-full bg-teal-300" />
          </div>

          {/* Player Breath Cursor */}
          <div
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-white border-2 border-teal-400 shadow pointer-events-none"
            style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap pointer-events-none">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] flex items-center justify-between text-xs text-teal-200/80">
        <span>Coste reducido (25% Energía) · Al completar recuperas +28 Energía y +12% Hidratación</span>
        <span className="font-bold uppercase tracking-wider text-teal-400">Ratón / Touch / WASD</span>
      </div>
    </div>
  );
};
