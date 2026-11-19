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

interface ShakeMixerGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_SHAKES = 4;
const SHAKES_REQUIRED = 8;

interface OrderTarget {
  label: string;
  targets: [number, number, number]; // percentages 25..80
}

const ORDER_POOL: OrderTarget[] = [
  { label: 'Anabolic Whey Nitro', targets: [68, 45, 55] },
  { label: 'Electro-Recovery Mint', targets: [35, 62, 76] },
  { label: 'Mass Gainer Chocolate', targets: [78, 52, 34] },
  { label: 'Pre-Workout Fury', targets: [44, 74, 62] },
];

export const ShakeMixerGame: React.FC<ShakeMixerGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [orderIdx, setOrderIdx] = useState(0);
  const [stage, setStage] = useState<'dose' | 'blend'>('dose');
  const [lockedSlots, setLockedSlots] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [gaugeVals, setGaugeVals] = useState<[number, number, number]>([50, 50, 50]);
  const [blendCount, setBlendCount] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState('Pulsa 1, 2 y 3 cuando cada dosificador cruce su zona verde');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const orderIdxRef = useRef(0);
  const stageRef = useRef<'dose' | 'blend'>('dose');
  const lockedRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const gaugeRef = useRef<[number, number, number]>([50, 50, 50]);
  const phasesRef = useRef<[number, number, number]>([0.2, 1.4, 2.7]);
  const blendCountRef = useRef(0);
  const shakeImpulseRef = useRef(0);
  const shakePhaseRef = useRef(0);

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
      gameId: 'shake_mixer',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((85 + scoreRef.current * 0.03) * cfg.rewardMult),
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

  const lockIngredient = useCallback(
    (slot: 0 | 1 | 2) => {
      if (unmountedRef.current || stageRef.current !== 'dose' || lockedRef.current[slot]) return;
      actionsRef.current += 1;
      const target = ORDER_POOL[orderIdxRef.current].targets[slot];
      const val = gaugeRef.current[slot];
      const diff = Math.abs(val - target);
      const isPerf = diff <= 11 * cfg.windowMult;
      const isOk = diff <= 20 * cfg.windowMult;

      const nextLocked: [boolean, boolean, boolean] = [...lockedRef.current] as [boolean, boolean, boolean];
      nextLocked[slot] = true;
      lockedRef.current = nextLocked;
      setLockedSlots(nextLocked);

      if (isPerf) {
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const pts = Math.round((130 + comboRef.current * 14) * cfg.rewardMult);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(`¡DOSIS EXACTA! +${pts} pts`);
        sound.playPerfect();
      } else if (isOk) {
        const pts = Math.round(75 * cfg.rewardMult);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setFeedback(`¡Ingrediente añadido! +${pts} pts`);
        sound.playHit();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('Dosis imprecisa — apunta más cerca de la marca verde');
        sound.playMiss();
      }

      if (nextLocked.every(Boolean)) {
        stageRef.current = 'blend';
        setStage('blend');
        blendCountRef.current = 0;
        setBlendCount(0);
        setFeedback('¡Mezcla lista! ¡Pulsa ESPACIO rápido 8 veces para batir!');
      }
    },
    [cfg.rewardMult, cfg.windowMult]
  );

  const shakeCup = useCallback(() => {
    if (unmountedRef.current || stageRef.current !== 'blend') return;
    actionsRef.current += 1;
    blendCountRef.current += 1;
    shakeImpulseRef.current = 1.0;
    setBlendCount(blendCountRef.current);
    sound.playTap();

    if (blendCountRef.current >= SHAKES_REQUIRED) {
      comboRef.current += 1;
      perfectRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const pts = Math.round((220 + comboRef.current * 24) * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      sound.playCoin();

      if (orderIdxRef.current + 1 >= TOTAL_SHAKES) {
        setFeedback(`¡PEDIDO COMPLETADO! +${pts} pts`);
        window.setTimeout(finishGame, 500);
      } else {
        orderIdxRef.current += 1;
        setOrderIdx(orderIdxRef.current);
        lockedRef.current = [false, false, false];
        setLockedSlots([false, false, false]);
        stageRef.current = 'dose';
        setStage('dose');
        setFeedback('¡Siguiente batido! Dosifica con 1, 2 y 3');
      }
    }
  }, [cfg.rewardMult, finishGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'KeyA') {
        e.preventDefault();
        lockIngredient(0);
      } else if (e.code === 'Digit2' || e.code === 'KeyS') {
        e.preventDefault();
        lockIngredient(1);
      } else if (e.code === 'Digit3' || e.code === 'KeyD') {
        e.preventDefault();
        lockIngredient(2);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (stageRef.current === 'blend') {
          shakeCup();
        } else {
          const nextSlot = lockedRef.current.findIndex((v) => !v);
          if (nextSlot !== -1) lockIngredient(nextSlot as 0 | 1 | 2);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lockIngredient, shakeCup]);

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
    camera.position.set(1.25, 1.55, computeResponsiveCameraZ(3.15, aspect, 1.0));
    camera.lookAt(0, 1.05, 0.2);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Supplement Bar Counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.92, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.25 })
    );
    counter.position.set(0, 0.46, 0.45);
    counter.receiveShadow = true;
    scene.add(counter);

    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.68, 0.06, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.2, metalness: 0.4 })
    );
    counterTop.position.set(0, 0.94, 0.45);
    scene.add(counterTop);

    // Decorative Whey / Creatine Tubs on bar
    const tubColors = [0xff5a1f, 0x10b981, 0x38bdf8];
    tubColors.forEach((hex, idx) => {
      const tub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.26, 18),
        new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35 })
      );
      tub.position.set(-0.85 + idx * 0.32, 1.1, 0.55);
      tub.castShadow = true;
      scene.add(tub);
    });

    // Animated 3D Shaker Bottle
    const shakerGroup = new THREE.Group();
    shakerGroup.position.set(0.18, 1.18, 0.35);
    scene.add(shakerGroup);

    const cupBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.065, 0.28, 20),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.85, roughness: 0.15 })
    );
    shakerGroup.add(cupBody);

    const cupLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.058, 0.18, 18),
      new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.35 })
    );
    cupLiquid.position.y = -0.03;
    shakerGroup.add(cupLiquid);

    const cupLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 })
    );
    cupLid.position.y = 0.16;
    shakerGroup.add(cupLid);

    const mixerRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    mixerRig.root.position.set(-0.08, 0, -0.15);
    scene.add(mixerRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(-0.08, 0, -0.15);
        rig.poseShakeMixer(0, 0);
        scene.add(rig.root);
        glbRig = rig;
        mixerRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.15, nextAsp, 1.0);
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

      if (stageRef.current === 'dose') {
        const speeds = [2.2, 2.75, 3.3].map((s) => s * (0.85 + difficulty * 0.14) * cfg.speedMult);
        const nextVals: [number, number, number] = [...gaugeRef.current] as [number, number, number];
        for (let i = 0; i < 3; i++) {
          if (!lockedRef.current[i]) {
            phasesRef.current[i] += dt * speeds[i];
            nextVals[i] = Math.round((Math.sin(phasesRef.current[i]) + 1) * 50);
          }
        }
        gaugeRef.current = nextVals;
        setGaugeVals(nextVals);
      }

      shakeImpulseRef.current = THREE.MathUtils.damp(shakeImpulseRef.current, 0, 8, dt);
      shakePhaseRef.current += dt * (3.2 + shakeImpulseRef.current * 24);

      const bobY = stageRef.current === 'blend' ? Math.sin(shakePhaseRef.current) * (0.04 + shakeImpulseRef.current * 0.14) : 0;
      shakerGroup.position.set(0.18, stageRef.current === 'blend' ? 1.24 + bobY : 1.11, 0.32);
      shakerGroup.rotation.z = stageRef.current === 'blend' ? Math.sin(shakePhaseRef.current) * 0.35 : 0;
      const fillCount = lockedRef.current.filter(Boolean).length;
      cupLiquid.scale.y = Math.max(0.25, fillCount / 3);

      if (glbRig) {
        glbRig.poseShakeMixer(shakePhaseRef.current, 0);
      } else {
        mixerRig.rightArmPivot.rotation.x = -1.2 + Math.sin(shakePhaseRef.current) * 0.35;
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

  const currentOrder = ORDER_POOL[orderIdx];
  const labels = ['Proteína (1)', 'Creatina (2)', 'Electrolitos (3)'];

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Nutrición Bar · {cfg.label}</p>
          <h3 className="text-2xl text-white">Barra de Batidos ({currentOrder.label})</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Pedidos</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {orderIdx + 1}/{TOTAL_SHAKES}
            </div>
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

        <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-80 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl p-3.5 space-y-2.5">
          {stage === 'dose' ? (
            [0, 1, 2].map((i) => {
              const target = currentOrder.targets[i];
              const locked = lockedSlots[i];
              return (
                <div key={i}>
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-white/70 mb-1">
                    <span>{labels[i]}</span>
                    <span className={locked ? 'text-emerald-400 font-bold' : 'text-white/50'}>
                      {locked ? 'Listo' : `Obj: ${target}%`}
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 bg-emerald-500/40 border-x border-emerald-400"
                      style={{ left: `${Math.max(0, target - 11)}%`, width: '22%' }}
                    />
                    <div
                      className={`absolute top-0 bottom-0 w-2.5 -ml-1 rounded-full ${
                        locked ? 'bg-emerald-400' : 'bg-white'
                      }`}
                      style={{ left: `${gaugeVals[i]}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-amber-300 font-bold mb-1.5">
                <span>¡BATIDO EN CURSO!</span>
                <span>
                  {blendCount}/{SHAKES_REQUIRED}
                </span>
              </div>
              <div className="h-3.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round((blendCount / SHAKES_REQUIRED) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08]">
        {stage === 'dose' ? (
          <div className="grid grid-cols-3 gap-3">
            {([0, 1, 2] as const).map((i) => (
              <button
                key={i}
                type="button"
                disabled={lockedSlots[i]}
                onPointerDown={() => lockIngredient(i)}
                className={`py-3.5 rounded-xl font-display italic font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all ${
                  lockedSlots[i]
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                    : 'bg-orange-500 hover:bg-orange-400 text-white'
                }`}
              >
                {lockedSlots[i] ? '✓ Fijado' : labels[i]}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onPointerDown={shakeCup}
            className="w-full py-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-display italic font-black uppercase text-xl tracking-wider cursor-pointer active:scale-[0.98]"
          >
            ¡AGITAR SHAKER! ({blendCount}/{SHAKES_REQUIRED} · Espacio)
          </button>
        )}
      </div>
    </div>
  );
};
