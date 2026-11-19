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

interface SledPushGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TARGET_DISTANCE = 20;

export const SledPushGame: React.FC<SledPushGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [distance, setDistance] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [cadencePct, setCadencePct] = useState(50);
  const [nextFoot, setNextFoot] = useState<'left' | 'right'>('left');
  const [feedback, setFeedback] = useState('Alterna A (Izq) y D (Der) dentro de la banda verde de empuje');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const nextFootRef = useRef<'left' | 'right'>('left');
  const cadenceRef = useRef(48);
  const stridePhaseRef = useRef(0);
  const distanceRef = useRef(0);
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
      gameId: 'sled_push',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((155 + scoreRef.current * 0.04) * cfg.rewardMult),
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

  const pushFoot = useCallback(
    (foot: 'left' | 'right') => {
      if (unmountedRef.current || distanceRef.current >= TARGET_DISTANCE) return;
      actionsRef.current += 1;

      if (foot !== nextFootRef.current) {
        comboRef.current = 0;
        setCombo(0);
        cadenceRef.current = Math.max(10, cadenceRef.current - 18);
        setFeedback(`¡Pie incorrecto! Alterna: toca ${nextFootRef.current === 'left' ? 'IZQUIERDO (A)' : 'DERECHO (D)'}`);
        sound.playMiss();
        return;
      }

      nextFootRef.current = foot === 'left' ? 'right' : 'left';
      setNextFoot(nextFootRef.current);
      cadenceRef.current = Math.min(100, cadenceRef.current + (17 - difficulty * 1.1));
      stridePhaseRef.current += Math.PI * 0.68;

      const inSweet = cadenceRef.current >= 48 && cadenceRef.current <= 88;
      if (inSweet) {
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const stepM = 0.65 + comboRef.current * 0.025;
        const pts = Math.round((78 + comboRef.current * 9) * cfg.rewardMult);
        distanceRef.current = Math.min(TARGET_DISTANCE, distanceRef.current + stepM);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(`¡EMPUJE POTENTE! ${distanceRef.current.toFixed(1)}m / ${TARGET_DISTANCE}m`);
        sound.playStep(foot === 'left');
      } else {
        const stepM = 0.38;
        const pts = Math.round(42 * cfg.rewardMult);
        distanceRef.current = Math.min(TARGET_DISTANCE, distanceRef.current + stepM);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setFeedback(
          cadenceRef.current > 88
            ? '¡Demasiado acelerado! Mantén la cadencia verde'
            : '¡Acelera el paso hasta la banda verde!'
        );
        sound.playTap();
      }
      setDistance(Number(distanceRef.current.toFixed(1)));

      if (distanceRef.current >= TARGET_DISTANCE) {
        scoreRef.current += Math.round(250 * cfg.rewardMult);
        setScore(scoreRef.current);
        sound.playPerfect();
        window.setTimeout(finishGame, 420);
      }
    },
    [cfg.rewardMult, difficulty, finishGame]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        pushFoot('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        pushFoot('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pushFoot]);

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
    camera.position.set(2.55, 1.48, computeResponsiveCameraZ(3.1, aspect, 1.0));
    camera.lookAt(0, 0.78, 0.35);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Prowler Turf Strip + Scrolling Distance Markers
    const turf = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.03, 18),
      new THREE.MeshStandardMaterial({ color: 0x113325, roughness: 0.9 })
    );
    turf.position.set(0, 0.015, 2.5);
    turf.receiveShadow = true;
    scene.add(turf);

    const markersGroup = new THREE.Group();
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5a1f, emissiveIntensity: 0.25 });
    for (let i = 0; i < 16; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.012, 0.06), stripeMat);
      stripe.position.set(0, 0.034, -4 + i * 1.1);
      markersGroup.add(stripe);
    }
    scene.add(markersGroup);

    // Loaded Heavy Steel Prowler Sled
    const sledGroup = new THREE.Group();
    sledGroup.position.set(0, 0.03, 0.85);
    scene.add(sledGroup);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.28 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.4 });

    for (const sx of [-0.32, 0.32]) {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.05), steelMat);
      ski.position.set(sx, 0.02, 0);
      ski.castShadow = true;
      sledGroup.add(ski);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.02, 12), orangeMat);
      post.position.set(sx, 0.52, -0.35);
      post.castShadow = true;
      sledGroup.add(post);
    }
    const baseDeck = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.65), steelMat);
    baseDeck.position.set(0, 0.06, 0.05);
    sledGroup.add(baseDeck);

    const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 14), steelMat);
    centerPin.position.set(0, 0.36, 0.08);
    sledGroup.add(centerPin);

    for (let p = 0; p < 3; p++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 22), plateMat);
      plate.position.set(0, 0.14 + p * 0.08, 0.08);
      plate.castShadow = true;
      sledGroup.add(plate);
    }

    const pusherRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    pusherRig.root.position.set(0, 0.03, -0.2);
    scene.add(pusherRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0.03, -0.2);
        rig.poseSledPush(0, 0.03);
        scene.add(rig.root);
        glbRig = rig;
        pusherRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.1, nextAsp, 1.0);
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

      const decay = (22 + difficulty * 4.5) * cfg.speedMult;
      cadenceRef.current = Math.max(5, cadenceRef.current - decay * dt);
      setCadencePct(Math.round(cadenceRef.current));

      const moveSpeed = (cadenceRef.current / 100) * 3.8;
      markersGroup.position.z -= moveSpeed * dt;
      if (markersGroup.position.z < -1.1) markersGroup.position.z += 1.1;

      stridePhaseRef.current += dt * (2.2 + (cadenceRef.current / 100) * 6.5);
      if (glbRig) {
        glbRig.poseSledPush(stridePhaseRef.current, 0.03);
      } else {
        const s = Math.sin(stridePhaseRef.current);
        pusherRig.upperBody.rotation.x = 0.55;
        pusherRig.leftArmPivot.rotation.x = -1.25;
        pusherRig.rightArmPivot.rotation.x = -1.25;
        pusherRig.leftLegPivot.rotation.x = s * 0.55;
        pusherRig.rightLegPivot.rotation.x = -s * 0.55;
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
  }, [aiModel, athlete, cfg.speedMult, difficulty]);

  const inZone = cadencePct >= 48 && cadencePct <= 88;
  const distPct = Math.min(100, Math.round((distance / TARGET_DISTANCE) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Cardio Potencia · {cfg.label}</p>
          <h3 className="text-2xl text-white">Trineo Prowler ({distance.toFixed(1)}/{TARGET_DISTANCE}m)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Progreso</div>
            <div className="font-mono-tabular font-black text-xl text-white">{distPct}%</div>
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,360px)] bg-black/75 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
            <span>Cadencia de Empuje</span>
            <span className={inZone ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
              {inZone ? 'Empuje Óptimo' : cadencePct > 88 ? '¡Muy rápido!' : 'Acelera'}
            </span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[48%] right-[12%] bg-emerald-500/35 border-x border-emerald-400" />
            <div
              className={`h-full transition-all duration-75 ${inZone ? 'bg-emerald-400' : 'bg-orange-500'}`}
              style={{ width: `${cadencePct}%` }}
            />
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-sky-400 transition-all duration-75" style={{ width: `${distPct}%` }} />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-2 gap-3">
        <button
          type="button"
          onPointerDown={() => pushFoot('left')}
          className={`py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer active:scale-95 transition-all border ${
            nextFoot === 'left'
              ? 'bg-orange-500 text-white border-orange-300 shadow-[0_0_20px_rgba(255,90,31,0.5)]'
              : 'bg-white/[0.07] text-white/60 border-white/10'
          }`}
        >
          ← Pie Izquierdo (A)
        </button>
        <button
          type="button"
          onPointerDown={() => pushFoot('right')}
          className={`py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer active:scale-95 transition-all border ${
            nextFoot === 'right'
              ? 'bg-orange-500 text-white border-orange-300 shadow-[0_0_20px_rgba(255,90,31,0.5)]'
              : 'bg-white/[0.07] text-white/60 border-white/10'
          }`}
        >
          Pie Derecho (D) →
        </button>
      </div>
    </div>
  );
};
