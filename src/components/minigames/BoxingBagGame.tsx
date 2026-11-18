import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import {
  afterDraw,
  createProceduralGymFloorTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeScene,
  dressGymScene,
  addGymDecor,
  loadGlbAsset,
  MODEL_URLS,
} from '../../three/threeUtils';

interface BoxingBagGameProps {
  difficulty: DifficultyLevel;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type PadId = 0 | 1 | 2 | 3;

interface TargetPrompt {
  id: number;
  pad: PadId;
  remainingMs: number;
  totalMs: number;
}

const PAD_META: Record<PadId, { label: string; keyHint: string; code: string; pos: [number, number, number] }> = {
  0: { label: 'Jab Izquierdo', keyHint: 'Q', code: 'KeyQ', pos: [-0.95, 1.72, 0.35] },
  1: { label: 'Cruzado Derecho', keyHint: 'W', code: 'KeyW', pos: [0.95, 1.72, 0.35] },
  2: { label: 'Gancho Izquierdo', keyHint: 'E', code: 'KeyE', pos: [-0.95, 1.12, 0.35] },
  3: { label: 'Uppercut Derecho', keyHint: 'R', code: 'KeyR', pos: [0.95, 1.12, 0.35] },
};

const DURATION_SEC = 26;

export const BoxingBagGame: React.FC<BoxingBagGameProps> = ({
  difficulty,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [activeTarget, setActiveTarget] = useState<TargetPrompt | null>(null);
  const [feedback, setFeedback] = useState<string>('¡Golpea los pads o anillos 3D antes de que cierren!');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(DURATION_SEC);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const targetRef = useRef<TargetPrompt | null>(null);
  const targetIdRef = useRef(1);
  const completedRef = useRef(false);

  // Heavy bag spring state
  const bagAngleZRef = useRef(0);
  const bagVelZRef = useRef(0);
  const bagAngleXRef = useRef(0);
  const bagVelXRef = useRef(0);

  const spawnTarget = useCallback(() => {
    const pad = Math.floor(Math.random() * 4) as PadId;
    const totalMs = Math.max(700, Math.round(1650 * cfg.windowMult));
    const next: TargetPrompt = {
      id: targetIdRef.current++,
      pad,
      remainingMs: totalMs,
      totalMs,
    };
    targetRef.current = next;
    setActiveTarget(next);
  }, [cfg.windowMult]);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'boxing',
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

  const strikePad = useCallback(
    (pad: PadId) => {
      if (completedRef.current || !targetRef.current) return;
      actionsRef.current += 1;

      if (pad === targetRef.current.pad) {
        const ratio = targetRef.current.remainingMs / targetRef.current.totalMs;
        const isPerfect = ratio <= 0.52;
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (isPerfect) perfectRef.current += 1;

        const mult = 1 + Math.min(2.2, comboRef.current * 0.2);
        const pts = Math.round((isPerfect ? 165 : 100) * mult * cfg.rewardMult);
        scoreRef.current += pts;

        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(isPerfect ? `¡IMPACTO PERFECTO! +${pts} pts` : `¡Buen golpe! +${pts} pts`);

        // Kick spring velocity on heavy bag
        const sideSign = pad === 0 || pad === 2 ? 1 : -1;
        bagVelZRef.current = sideSign * (isPerfect ? 4.8 : 3.2);
        bagVelXRef.current = -2.4;

        if (isPerfect) sound.playPerfect();
        else sound.playPunch();

        spawnTarget();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('Pad incorrecto · Se reinició el combo');
        sound.playMiss();
      }
    },
    [cfg.rewardMult, spawnTarget]
  );

  // Three.js 3D Boxing Ring + Swinging Bag + Raycast Target Pads
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    spawnTarget();

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
    dressGymScene(scene, { fogNear: 6, fogFar: 15 });
    addGymDecor(scene, ['dumbbells', 'bench'], { focus: { x: 0, z: 0 }, depth: 2.8 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 35);
    camera.position.set(0, 1.55, 3.9);
    camera.lookAt(0, 1.35, 0);

    createThreePointLights(scene, 5);

    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Overhead Steel Hanging Rig
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.14), metalMat);
    topBeam.position.set(0, 2.75, 0);
    scene.add(topBeam);

    // Swinging Heavy Bag Pivot at (0, 2.7, 0)
    const bagPivot = new THREE.Group();
    bagPivot.position.set(0, 2.7, 0);
    scene.add(bagPivot);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10), metalMat);
    chain.position.y = -0.28;
    bagPivot.add(chain);

    const bagLeatherMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5, metalness: 0.12 });
    const bagBeltMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35, metalness: 0.2 });

    const bagProfile = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.24, 0.06),
      new THREE.Vector2(0.28, 0.35),
      new THREE.Vector2(0.28, 1.15),
      new THREE.Vector2(0.22, 1.28),
      new THREE.Vector2(0.01, 1.32),
    ];
    const bagMesh = new THREE.Mesh(new THREE.LatheGeometry(bagProfile, 24), bagLeatherMat);
    bagMesh.position.y = -1.85;
    bagMesh.castShadow = true;
    bagPivot.add(bagMesh);

    const bagBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.22, 24), bagBeltMat);
    bagBelt.position.y = -1.15;
    bagPivot.add(bagBelt);

    // Magnific heavy bag (chains + bag), hung from the same swinging pivot
    let disposedBag = false;
    loadGlbAsset(MODEL_URLS.bag, 1.85, { anchor: 'top' })
      .then(({ root }) => {
        if (disposedBag) return;
        bagPivot.add(root);
        chain.visible = false;
        bagMesh.visible = false;
        bagBelt.visible = false;
      })
      .catch(() => {});

    // 4 Interactive 3D Target Pads
    const padGroups: THREE.Group[] = [];
    const padRings: THREE.Mesh[] = [];
    const clickableMeshes: THREE.Mesh[] = [];

    ([0, 1, 2, 3] as PadId[]).forEach((padId) => {
      const grp = new THREE.Group();
      grp.position.set(...PAD_META[padId].pos);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x2b2b2b,
        roughness: 0.4,
        metalness: 0.2,
      });
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24), coreMat);
      core.rotation.x = Math.PI / 2;
      core.userData.padId = padId;
      grp.add(core);
      clickableMeshes.push(core);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xff6a2b,
        emissive: 0xff5a1f,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 10, 28), ringMat);
      ring.position.z = 0.03;
      ring.visible = false;
      grp.add(ring);

      scene.add(grp);
      padGroups.push(grp);
      padRings.push(ring);
    });

    // Raycaster for clicking 3D pads directly
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const padId = hits[0].object.userData.padId as PadId | undefined;
        if (padId !== undefined) strikePad(padId);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;
    let unmounted = false;

    const tick = (now: number) => {
      if (unmounted) return;
      const dtMs = Math.min(50, now - last);
      const dt = dtMs / 1000;
      last = now;

      timeRef.current = Math.max(0, timeRef.current - dt);
      setTimeLeft(Math.ceil(timeRef.current));

      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      if (targetRef.current) {
        const rem = targetRef.current.remainingMs - dtMs;
        if (rem <= 0) {
          comboRef.current = 0;
          actionsRef.current += 1;
          setCombo(0);
          setFeedback('¡Objetivo perdido! Mantén la guardia alta');
          sound.playMiss();
          spawnTarget();
        } else {
          targetRef.current = { ...targetRef.current, remainingMs: rem };
          setActiveTarget(targetRef.current);
        }
      }

      // Spring pendulum physics for Heavy Bag
      const k = 32;
      const damp = 4.2;
      bagVelZRef.current += (-k * bagAngleZRef.current - damp * bagVelZRef.current) * dt;
      bagAngleZRef.current += bagVelZRef.current * dt;
      bagVelXRef.current += (-k * bagAngleXRef.current - damp * bagVelXRef.current) * dt;
      bagAngleXRef.current += bagVelXRef.current * dt;

      bagPivot.rotation.z = bagAngleZRef.current;
      bagPivot.rotation.x = bagAngleXRef.current;

      // Update 3D pad visuals
      const curTarget = targetRef.current;
      const ratio = curTarget ? Math.max(0.15, curTarget.remainingMs / curTarget.totalMs) : 0;
      padGroups.forEach((grp, idx) => {
        const isTarget = curTarget?.pad === idx;
        const ring = padRings[idx];
        const core = clickableMeshes[idx];
        const mat = core.material as THREE.MeshStandardMaterial;

        if (isTarget) {
          mat.color.setHex(0xff5a1f);
          mat.emissive.setHex(0x7c2d12);
          ring.visible = true;
          ring.scale.setScalar(0.7 + ratio * 0.65);
          grp.scale.setScalar(1.08);
        } else {
          mat.color.setHex(0x2b2b2b);
          mat.emissive.setHex(0x000000);
          ring.visible = false;
          grp.scale.setScalar(1.0);
        }
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = afterDraw(renderer, () => tick(performance.now()));
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
      disposedBag = true;
      disposeScene(scene, renderer);
    };
  }, [finishGame, spawnTarget, strikePad]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const entry = (Object.entries(PAD_META) as [string, { code: string }][]).find(
        ([, meta]) => meta.code === e.code
      );
      if (entry) {
        e.preventDefault();
        strikePad(Number(entry[0]) as PadId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [strikePad]);

  const ringProgress = activeTarget ? Math.max(0, activeTarget.remainingMs / activeTarget.totalMs) : 0;

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Combate 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Combo Saco de Boxeo</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Tiempo</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Combo</div>
            <div className={`font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 ${combo >= 5 ? 'text-orange-500' : 'text-white'}`}>
              x{combo}
            </div>
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
        <div className="mt-4 flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-2 text-xs font-medium text-orange-200">
          <span>Duelo contra {rivalName}</span>
          <span className="font-mono-tabular font-bold">
            Meta: {rivalTargetScore.toLocaleString('es-ES')} pts · Actual: {score.toLocaleString('es-ES')}
          </span>
        </div>
      )}

      {/* 3D Boxing Ring & Swinging Heavy Bag */}
      <div className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black select-none">
        <div ref={mountRef} className="w-full h-full cursor-pointer" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-3.5 py-1 rounded-lg text-xs text-white/80 whitespace-nowrap">
          {feedback}
        </div>
      </div>

      {/* Tactile Strike Pad Buttons */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([0, 2, 1, 3] as PadId[]).map((padId) => {
          const isActive = activeTarget?.pad === padId;
          return (
            <button
              key={padId}
              onClick={() => strikePad(padId)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-orange-500 border-orange-500 text-white shadow-none'
                  : 'bg-white/[0.03] border-white/10 text-white/90 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="truncate">{PAD_META[padId].label}</span>
                <span className="font-mono-tabular opacity-80">{PAD_META[padId].keyHint}</span>
              </div>
              <div className="mt-2 h-1.5 bg-black/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: isActive ? `${ringProgress * 100}%` : '0%' }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
