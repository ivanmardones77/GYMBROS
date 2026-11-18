import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import { DuelProgressBanner } from '../DuelProgressBanner';
import {
  afterDraw,
  computeResponsiveCameraZ,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeObject3D,
  disposeScene,
  loadGlbAsset,
  MODEL_URLS,
  dressGymScene,
} from '../../three/threeUtils';

interface MacroCatcherGameProps {
  difficulty: DifficultyLevel;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

interface FallingFood3D {
  id: number;
  lane: 0 | 1 | 2 | 3;
  y: number;
  label: string;
  healthy: boolean;
  points: number;
  mesh: THREE.Group;
}

const LANE_X = [-1.8, -0.6, 0.6, 1.8];
const DURATION_SEC = 25;

export const MacroCatcherGame: React.FC<MacroCatcherGameProps> = ({
  difficulty,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [bowlLane, setBowlLane] = useState<0 | 1 | 2 | 3>(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Atrapa comida limpia y esquiva los ultraprocesados');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const bowlLaneRef = useRef<0 | 1 | 2 | 3>(1);
  const timeRef = useRef(DURATION_SEC);
  const lastSecRef = useRef(DURATION_SEC);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const completedRef = useRef(false);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'macros',
      difficulty,
      score: Math.max(0, scoreRef.current),
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((85 + scoreRef.current * 0.03) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  const moveLane = useCallback((lane: 0 | 1 | 2 | 3) => {
    bowlLaneRef.current = lane;
    setBowlLane(lane);
    sound.playTap();
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

    let unmounted = false;
    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 8, fogFar: 18, cone: false, wallDistance: 7 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 35);
    camera.position.set(0, 2.3, computeResponsiveCameraZ(6.2, aspect, 1.1));
    camera.lookAt(0, 1.45, 0);

    createThreePointLights(scene, 6);

    // Kitchen Prep Counter & 4 Lane Mats
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.3, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.45, metalness: 0.15 })
    );
    counter.position.set(0, -0.15, 0);
    counter.receiveShadow = true;
    scene.add(counter);

    const laneMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 });
    LANE_X.forEach((lx) => {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.02, 1.8), laneMat);
      pad.position.set(lx, 0.01, 0);
      pad.receiveShadow = true;
      scene.add(pad);
    });

    // Composite 3D Metallic Mixing Bowl
    const bowlGroup = new THREE.Group();
    const bowlProfile = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.28, 0.02),
      new THREE.Vector2(0.45, 0.25),
      new THREE.Vector2(0.49, 0.42),
      new THREE.Vector2(0.45, 0.42),
      new THREE.Vector2(0.41, 0.24),
      new THREE.Vector2(0.25, 0.06),
      new THREE.Vector2(0.01, 0.05),
    ];
    const bowlSteel = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.18,
    });
    const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 28), bowlSteel);
    bowlMesh.castShadow = true;
    bowlGroup.add(bowlMesh);

    const bowlRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.032, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.3, metalness: 0.3 })
    );
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.y = 0.42;
    bowlGroup.add(bowlRim);

    bowlGroup.position.set(LANE_X[1], 0.03, 0);
    scene.add(bowlGroup);

    // 3D Food Model Builders
    // Magnific food models (kind 0..4), swapped in once loaded
    const FOOD_GLB: { url: string; h: number }[] = [
      { url: MODEL_URLS.food_avocado, h: 0.42 },
      { url: MODEL_URLS.food_water, h: 0.55 },
      { url: MODEL_URLS.food_salmon, h: 0.3 },
      { url: MODEL_URLS.food_donut, h: 0.3 },
      { url: MODEL_URLS.food_soda, h: 0.5 },
    ];
    const foodTemplates: (THREE.Group | null)[] = [null, null, null, null, null];
    FOOD_GLB.forEach((f, i) => {
      loadGlbAsset(f.url, f.h)
        .then(({ root }) => {
          if (unmounted) {
            disposeObject3D(root);
            return;
          }
          if (root.children[0]) {
            root.children[0].position.y -= f.h / 2; // centre vertically for spinning
          }
          foodTemplates[i] = root;
        })
        .catch(() => {});
    });

    const buildFoodMeshProcedural = (kind: number): { mesh: THREE.Group; label: string; healthy: boolean; points: number } => {
      const grp = new THREE.Group();
      if (kind === 0) {
        // Avocado
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 16, 14),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 })
        );
        shell.scale.set(0.85, 1.25, 0.55);
        const pit = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 })
        );
        pit.position.set(0, -0.04, 0.1);
        grp.add(shell, pit);
        return { mesh: grp, label: 'Aguacate', healthy: true, points: 105 };
      }
      if (kind === 1) {
        // Water bottle
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.42, 16),
          new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.1, transmission: isSoftwareGl ? 0 : 0.4, transparent: true, opacity: 0.85 })
        );
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 0.09, 12),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
        );
        cap.position.y = 0.25;
        grp.add(body, cap);
        return { mesh: grp, label: 'Agua', healthy: true, points: 90 };
      }
      if (kind === 2) {
        // Salmon Fillet
        const salmon = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.18, 0.24),
          new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.35 })
        );
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.43, 0.03, 0.25),
          new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.5 })
        );
        grp.add(salmon, stripe);
        return { mesh: grp, label: 'Salmón', healthy: true, points: 120 };
      }
      if (kind === 3) {
        // Glazed Donut (Junk)
        const dough = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.09, 12, 24),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 })
        );
        const icing = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.075, 10, 24),
          new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.2 })
        );
        icing.position.z = 0.03;
        grp.add(dough, icing);
        return { mesh: grp, label: 'Dona', healthy: false, points: -85 };
      }
      // Red Soda Can (Junk)
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.38, 18),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.65, roughness: 0.25 })
      );
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.14, 0.04, 18),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
      );
      top.position.y = 0.2;
      grp.add(can, top);
      return { mesh: grp, label: 'Refresco', healthy: false, points: -75 };
    };

    const items: FallingFood3D[] = [];
    let spawnTimer = 0.35;
    let nextId = 1;

    // Click directly on 3D counter lanes to move bowl
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        let bestLane: 0 | 1 | 2 | 3 = 0;
        let bestDist = Infinity;
        LANE_X.forEach((lx, idx) => {
          const d = Math.abs(hit.x - lx);
          if (d < bestDist) {
            bestDist = d;
            bestLane = idx as 0 | 1 | 2 | 3;
          }
        });
        moveLane(bestLane);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const aspectNext = cw / ch;
      camera.aspect = aspectNext;
      camera.position.z = computeResponsiveCameraZ(6.2, aspectNext, 1.1);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (unmounted) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      timeRef.current = Math.max(0, timeRef.current - dt);
      const nextSec = Math.ceil(timeRef.current);
      if (nextSec !== lastSecRef.current) {
        lastSecRef.current = nextSec;
        setTimeLeft(nextSec);
      }

      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      // Smooth damped bowl slide
      const targetX = LANE_X[bowlLaneRef.current];
      bowlGroup.position.x = THREE.MathUtils.damp(bowlGroup.position.x, targetX, 18, dt);

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const isHealthy = Math.random() > 0.34;
        const kind = isHealthy ? Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2);
        const built = buildFoodMeshProcedural(kind);
        const tpl = foodTemplates[kind];
        if (tpl) {
          disposeObject3D(built.mesh);
          built.mesh = tpl.clone();
        }
        const lane = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
        built.mesh.position.set(LANE_X[lane], 3.8, 0);
        scene.add(built.mesh);
        items.push({
          id: nextId++,
          lane,
          y: 3.8,
          label: built.label,
          healthy: built.healthy,
          points: built.points,
          mesh: built.mesh,
        });
        spawnTimer = Math.max(0.4, 0.85 / cfg.speedMult);
      }

      const fallSpeed = 1.95 * cfg.speedMult;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y -= fallSpeed * dt;
        item.mesh.position.y = item.y;
        item.mesh.rotation.y += dt * 2.2;

        if (item.y <= 0.55 && item.y >= 0.05 && item.lane === bowlLaneRef.current) {
          actionsRef.current += 1;
          if (item.healthy) {
            comboRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            perfectRef.current += 1;
            const mult = 1 + Math.min(2, comboRef.current * 0.15);
            const pts = Math.round(item.points * mult * cfg.rewardMult);
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setStatusMsg(`+${pts} pts · ${item.label} limpio al plato`);
            sound.playPerfect();
          } else {
            comboRef.current = 0;
            scoreRef.current = Math.max(0, scoreRef.current + item.points);
            setScore(scoreRef.current);
            setCombo(0);
            setStatusMsg(`¡Cuidado! ${item.label} rompió tu racha`);
            sound.playMiss();
          }
          scene.remove(item.mesh);
          disposeObject3D(item.mesh);
          items.splice(i, 1);
          continue;
        }

        if (item.y < -0.3) {
          if (item.healthy) actionsRef.current += 1;
          scene.remove(item.mesh);
          disposeObject3D(item.mesh);
          items.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = afterDraw(renderer, () => tick(performance.now()), () => unmounted);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      foodTemplates.forEach((tpl) => {
        if (tpl) disposeObject3D(tpl);
      });
      disposeScene(scene, renderer);
    };
  }, [cfg.rewardMult, cfg.speedMult, finishGame, moveLane]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        moveLane(Math.max(0, bowlLaneRef.current - 1) as 0 | 1 | 2 | 3);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        moveLane(Math.min(3, bowlLaneRef.current + 1) as 0 | 1 | 2 | 3);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Nutrición 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Plato Fit Express</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Tiempo</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Racha</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-orange-500">x{combo}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Puntos</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-emerald-400">
              {score.toLocaleString('es-ES')}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 font-display uppercase tracking-wider font-bold text-sm text-white/60 border border-white/15 rounded-lg hover:bg-white hover:text-black whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      {rivalTargetScore !== undefined && (
        <DuelProgressBanner
          rivalName={rivalName}
          rivalTargetScore={rivalTargetScore}
          score={score}
        />
      )}

      <p className="mt-3 text-xs font-medium text-white/60">{statusMsg}</p>

      {/* 3D Kitchen Counter Viewport */}
      <div className="mt-3 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage bg-black rounded-2xl overflow-hidden select-none">
        <div ref={mountRef} className="w-full h-full cursor-pointer" />
      </div>

      {/* Lane Quick Controls */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {([0, 1, 2, 3] as (0 | 1 | 2 | 3)[]).map((lane) => (
          <button
            key={lane}
            onClick={() => moveLane(lane)}
            className={`py-3 rounded-xl font-display uppercase tracking-wider text-base font-bold border transition-colors cursor-pointer ${
              bowlLane === lane
                ? 'bg-orange-500 text-white border-orange-600'
                : 'bg-white/[0.03] text-white/75 border-white/10 hover:bg-white/10'
            }`}
          >
            Carril {lane + 1}
          </button>
        ))}
      </div>
    </div>
  );
};
