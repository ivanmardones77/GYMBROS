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

interface PlankCoreGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const GAME_DURATION = 24;

export const PlankCoreGame: React.FC<PlankCoreGameProps> = ({
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
  const [stabilityPct, setStabilityPct] = useState(100);
  const [dotPos, setDotPos] = useState({ x: 0, y: 0 });
  const [feedback, setFeedback] = useState('Mantén el núcleo en el centro con WASD / Flechas o arrastrando el radar');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const cursorRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const tickAccumRef = useRef(0);

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
      gameId: 'plank_core',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((125 + scoreRef.current * 0.038) * cfg.rewardMult),
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

  const nudgeCore = useCallback((dx: number, dy: number) => {
    cursorRef.current.x = THREE.MathUtils.clamp(cursorRef.current.x + dx * 0.25, -1, 1);
    cursorRef.current.y = THREE.MathUtils.clamp(cursorRef.current.y + dy * 0.25, -1, 1);
    velRef.current.x *= 0.5;
    velRef.current.y *= 0.5;
    sound.playTap();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        keysRef.current.down = true;
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
      }
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
    dressGymScene(scene, { fogNear: 7.5, fogFar: 20 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 40);
    camera.position.set(2.35, 1.15, computeResponsiveCameraZ(2.25, aspect, 1.0));
    camera.lookAt(0, 0.28, 0.12);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.68 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Yoga / Core Exercise Mat
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.03, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    mat.position.set(0, 0.015, 0.15);
    mat.receiveShadow = true;
    scene.add(mat);

    const matBorder = new THREE.Mesh(
      new THREE.BoxGeometry(0.99, 0.015, 2.34),
      new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.2 })
    );
    matBorder.position.set(0, 0.008, 0.15);
    scene.add(matBorder);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0.28, -0.55);
    athleteRig.root.rotation.x = Math.PI * 0.46;
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
        rig.root.position.set(0, 0.03, -0.45);
        rig.posePlank(0, 0, 0.03);
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
      camera.position.z = computeResponsiveCameraZ(2.25, nextAsp, 1.0);
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

      const elapsed = GAME_DURATION - timeLeftRef.current;
      const fatigue = 1 + (elapsed / GAME_DURATION) * 0.75;
      const pushForce = (0.72 + difficulty * 0.25) * cfg.speedMult * fatigue;

      // Drift acceleration from micro-tremors & imbalance
      velRef.current.x += Math.sin(now * 0.0033) * pushForce * dt + cursorRef.current.x * 0.4 * dt;
      velRef.current.y += Math.cos(now * 0.0041) * pushForce * dt + cursorRef.current.y * 0.4 * dt;

      // Player steering counter-force
      const steer = 2.65;
      if (keysRef.current.left) velRef.current.x -= steer * dt;
      if (keysRef.current.right) velRef.current.x += steer * dt;
      if (keysRef.current.up) velRef.current.y -= steer * dt;
      if (keysRef.current.down) velRef.current.y += steer * dt;

      velRef.current.x = THREE.MathUtils.clamp(velRef.current.x * 0.96, -1.35, 1.35);
      velRef.current.y = THREE.MathUtils.clamp(velRef.current.y * 0.96, -1.35, 1.35);

      cursorRef.current.x = THREE.MathUtils.clamp(cursorRef.current.x + velRef.current.x * dt, -1, 1);
      cursorRef.current.y = THREE.MathUtils.clamp(cursorRef.current.y + velRef.current.y * dt, -1, 1);

      const dist = Math.hypot(cursorRef.current.x, cursorRef.current.y);
      const stab = Math.max(0, Math.round((1 - Math.min(1, dist)) * 100));
      setStabilityPct(stab);
      setDotPos({ x: cursorRef.current.x, y: cursorRef.current.y });

      tickAccumRef.current += dt;
      if (tickAccumRef.current >= 0.6) {
        tickAccumRef.current -= 0.6;
        actionsRef.current += 1;
        if (dist <= 0.45 * cfg.windowMult) {
          comboRef.current += 1;
          perfectRef.current += 1;
          maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
          const pts = Math.round((68 + comboRef.current * 6) * cfg.rewardMult);
          scoreRef.current += pts;
          setScore(scoreRef.current);
          setCombo(comboRef.current);
          setFeedback(`¡BLOQUEO DE ACERO! Núcleo estable +${pts} pts`);
          sound.playHit();
        } else if (dist <= 0.78) {
          const pts = Math.round(35 * cfg.rewardMult);
          scoreRef.current += pts;
          setScore(scoreRef.current);
          setFeedback('¡Aguanta! Devuelve el punto al centro verde');
        } else {
          comboRef.current = 0;
          setCombo(0);
          setFeedback('¡Temblor fuerte! Corrige hacia el centro');
          sound.playMiss();
        }
      }

      const tremble = Math.sin(now * 0.025) * (0.04 + dist * 0.14) * fatigue;
      if (glbRig) {
        glbRig.posePlank(cursorRef.current.x, cursorRef.current.y + tremble, 0.03);
      } else {
        athleteRig.root.rotation.z = cursorRef.current.x * 0.08;
        athleteRig.root.position.y = 0.28 + tremble * 0.1;
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

  const handleRadarPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type === 'pointermove') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    cursorRef.current.x = THREE.MathUtils.clamp(nx, -1, 1);
    cursorRef.current.y = THREE.MathUtils.clamp(ny, -1, 1);
    velRef.current.x *= 0.35;
    velRef.current.y *= 0.35;
  };

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Core 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Plancha Isométrica Extrema</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Racha</div>
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

        {/* Interactive Core Stability Radar */}
        <div
          onPointerDown={handleRadarPointer}
          onPointerMove={handleRadarPointer}
          className="absolute top-4 right-4 w-36 h-36 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center cursor-crosshair touch-none shadow-2xl"
        >
          <div className="w-16 h-16 rounded-full border-2 border-emerald-400/70 bg-emerald-500/15 pointer-events-none" />
          <div className="absolute inset-x-3 h-px bg-white/10 pointer-events-none" />
          <div className="absolute inset-y-3 w-px bg-white/10 pointer-events-none" />
          <div
            className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white transition-colors pointer-events-none ${
              stabilityPct >= 55 ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
            style={{
              left: `${50 + dotPos.x * 42}%`,
              top: `${50 + dotPos.y * 42}%`,
            }}
          />
          <span className="absolute -bottom-6 text-[10px] font-bold uppercase tracking-wider text-white/75">
            Estabilidad {stabilityPct}%
          </span>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => nudgeCore(-1, 0)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-white font-display uppercase font-bold cursor-pointer"
        >
          ← Izquierda (A)
        </button>
        <button
          type="button"
          onPointerDown={() => nudgeCore(0, -1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-white font-display uppercase font-bold cursor-pointer"
        >
          ↑ Subir (W)
        </button>
        <button
          type="button"
          onPointerDown={() => nudgeCore(0, 1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-white font-display uppercase font-bold cursor-pointer"
        >
          ↓ Bajar (S)
        </button>
        <button
          type="button"
          onPointerDown={() => nudgeCore(1, 0)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-white font-display uppercase font-bold cursor-pointer"
        >
          Derecha (D) →
        </button>
      </div>
    </div>
  );
};
