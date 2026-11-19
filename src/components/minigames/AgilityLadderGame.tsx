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

interface AgilityLadderGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type LaneIndex = 0 | 1 | 2;
const LANE_X = [-0.62, 0, 0.62] as const;
const LANE_COLORS = [0x38bdf8, 0xff5a1f, 0x34d399] as const;
const GAME_DURATION = 28;
const HIT_Z = 0.0;

interface StepMarker {
  id: number;
  lane: LaneIndex;
  z: number;
  resolved: boolean;
  mesh: THREE.Group;
}

export const AgilityLadderGame: React.FC<AgilityLadderGameProps> = ({
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
  const [activeLane, setActiveLane] = useState<LaneIndex>(1);
  const [feedback, setFeedback] = useState('Usa A / S / D (o ← ↓ →) cuando el aro cruce la línea');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersRef = useRef<StepMarker[]>([]);
  const nextIdRef = useRef(1);
  const spawnTimerRef = useRef(0.35);

  const activeLaneRef = useRef<LaneIndex>(1);
  const posXRef = useRef(0);
  const stridePhaseRef = useRef(0);
  const stepBurstRef = useRef(0);
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
      gameId: 'agility_ladder',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((135 + scoreRef.current * 0.04) * cfg.rewardMult),
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

  const stepToLane = useCallback(
    (lane: LaneIndex) => {
      if (unmountedRef.current || timeLeftRef.current <= 0) return;
      activeLaneRef.current = lane;
      setActiveLane(lane);
      stepBurstRef.current = 1.0;
      actionsRef.current += 1;
      sound.playStep(lane !== 2);

      // Find closest unresolved step marker in that lane near HIT_Z
      let best: StepMarker | null = null;
      let bestDist = Infinity;
      for (const m of markersRef.current) {
        if (m.resolved || m.lane !== lane) continue;
        const d = Math.abs(m.z - HIT_Z);
        if (d < bestDist) {
          bestDist = d;
          best = m;
        }
      }

      const perfectThreshold = 0.42 * cfg.windowMult;
      const goodThreshold = 0.85 * cfg.windowMult;

      if (best && bestDist <= goodThreshold) {
        best.resolved = true;
        best.mesh.visible = false;
        const isPerf = bestDist <= perfectThreshold;
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (isPerf) perfectRef.current += 1;
        const pts = Math.round((isPerf ? 115 : 70) * cfg.rewardMult + comboRef.current * 10);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(isPerf ? `¡PISADA ELÉCTRICA! +${pts}` : `¡Buen apoyo! +${pts}`);
        if (isPerf) sound.playComboHit(comboRef.current);
        else sound.playHit();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('¡Fuera de ritmo! Espera al aro en la línea naranja');
        sound.playMiss();
      }
    },
    [cfg.rewardMult, cfg.windowMult]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        stepToLane(0);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space') {
        e.preventDefault();
        stepToLane(1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        stepToLane(2);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepToLane]);

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
    sceneRef.current = scene;
    dressGymScene(scene, { fogNear: 9, fogFar: 24 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 45);
    camera.position.set(0, 2.35, -computeResponsiveCameraZ(3.15, aspect, 1.0));
    camera.lookAt(0, 0.65, 2.6);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 30),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 3-lane agility turf strip + glowing webbing ladder
    const turf = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.025, 16),
      new THREE.MeshStandardMaterial({ color: 0x102721, roughness: 0.9 })
    );
    turf.position.set(0, 0.012, 4.5);
    turf.receiveShadow = true;
    scene.add(turf);

    const sideRailMat = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    for (const x of [-0.95, -0.31, 0.31, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, 15.5), sideRailMat);
      rail.position.set(x, 0.03, 4.5);
      scene.add(rail);
    }

    // Animated scrolling rungs group
    const rungsGroup = new THREE.Group();
    const rungMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.35 });
    for (let i = 0; i < 18; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.018, 0.045), rungMat);
      rung.position.set(0, 0.032, -2 + i * 0.85);
      rungsGroup.add(rung);
    }
    scene.add(rungsGroup);

    // Hit timing bar across the 3 lanes at Z = 0
    const hitLine = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.02, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xff5a1f,
        emissiveIntensity: 0.7,
      })
    );
    hitLine.position.set(0, 0.036, HIT_Z + 0.18);
    scene.add(hitLine);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0.025, -0.35);
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
        rig.root.position.set(0, 0.025, -0.35);
        rig.poseAgilityStep(0, 0.025);
        scene.add(rig.root);
        glbRig = rig;
        athleteRig.root.visible = false;
      },
    });

    const spawnMarker = () => {
      const lane = Math.floor(Math.random() * 3) as LaneIndex;
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.036, 12, 28),
        new THREE.MeshStandardMaterial({
          color: LANE_COLORS[lane],
          emissive: LANE_COLORS[lane],
          emissiveIntensity: 0.85,
          roughness: 0.25,
        })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20),
        new THREE.MeshStandardMaterial({
          color: LANE_COLORS[lane],
          transparent: true,
          opacity: 0.35,
        })
      );
      g.add(disc);
      const startZ = 10.8;
      g.position.set(LANE_X[lane], 0.06, startZ);
      scene.add(g);
      markersRef.current.push({
        id: nextIdRef.current++,
        lane,
        z: startZ,
        resolved: false,
        mesh: g,
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

      const scrollSpeed = (4.2 + difficulty * 0.72) * cfg.speedMult;
      rungsGroup.position.z -= scrollSpeed * dt * 0.55;
      if (rungsGroup.position.z < -0.85) rungsGroup.position.z += 0.85;

      spawnTimerRef.current -= dt;
      if (spawnTimerRef.current <= 0) {
        spawnMarker();
        spawnTimerRef.current = Math.max(0.36, (0.76 - difficulty * 0.07) / Math.sqrt(cfg.speedMult));
      }

      // Advance markers toward athlete at HIT_Z
      const remaining: StepMarker[] = [];
      for (const m of markersRef.current) {
        m.z -= scrollSpeed * dt;
        m.mesh.position.z = m.z;
        if (!m.resolved && m.z < HIT_Z - 0.85) {
          m.resolved = true;
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          setFeedback('¡Paso perdido!');
          sound.playMiss();
        }
        if (m.z < -2.2 || (m.resolved && !m.mesh.visible)) {
          scene.remove(m.mesh);
        } else {
          remaining.push(m);
        }
      }
      markersRef.current = remaining;

      // Smoothly laterally move athlete across lanes
      const targetX = LANE_X[activeLaneRef.current];
      posXRef.current = THREE.MathUtils.damp(posXRef.current, targetX, 18, dt);
      stepBurstRef.current = Math.max(0, stepBurstRef.current - dt * 2.5);
      stridePhaseRef.current += dt * (9.5 + difficulty * 1.4 + stepBurstRef.current * 8.0);

      if (glbRig) {
        glbRig.root.position.x = posXRef.current;
        glbRig.poseAgilityStep(stridePhaseRef.current, 0.025);
      } else {
        athleteRig.root.position.x = posXRef.current;
        const s = Math.sin(stridePhaseRef.current);
        athleteRig.leftLegPivot.rotation.x = s * 0.55;
        athleteRig.rightLegPivot.rotation.x = -s * 0.55;
        athleteRig.leftKneePivot.rotation.x = Math.max(0, -s) * 0.75;
        athleteRig.rightKneePivot.rotation.x = Math.max(0, s) * 0.75;
        athleteRig.leftArmPivot.rotation.x = -s * 0.45;
        athleteRig.rightArmPivot.rotation.x = s * 0.45;
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
      markersRef.current = [];
      disposeScene(scene, renderer);
    };
  }, [aiModel, athlete, cfg.speedMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Agilidad 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Escalera de Agilidad Pro</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-3 gap-3">
        <button
          type="button"
          onPointerDown={() => stepToLane(0)}
          className={`py-4 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeLane === 0
              ? 'bg-sky-500 text-black border-sky-300'
              : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/35'
          }`}
        >
          ← Izquierda (A)
        </button>
        <button
          type="button"
          onPointerDown={() => stepToLane(1)}
          className={`py-4 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeLane === 1
              ? 'bg-orange-500 text-black border-orange-300'
              : 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border-orange-500/35'
          }`}
        >
          ↓ Centro (S)
        </button>
        <button
          type="button"
          onPointerDown={() => stepToLane(2)}
          className={`py-4 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeLane === 2
              ? 'bg-emerald-500 text-black border-emerald-300'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'
          }`}
        >
          Derecha (D) →
        </button>
      </div>
    </div>
  );
};
