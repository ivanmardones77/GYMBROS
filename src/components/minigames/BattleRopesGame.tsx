import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import { DuelProgressBanner } from '../DuelProgressBanner';
import {
  afterDraw,
  computeResponsiveCameraZ,
  createProceduralGymFloorTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeScene,
  dressGymScene,
  addGymDecor,
} from '../../three/threeUtils';

import { AthleteBuildOptions, buildAthleteModel } from '../../three/buildAthleteModel';
import { GlbPoseRig, loadMinigameGlbAthlete } from '../../three/buildGlbAthlete';
import { buildContinuousRopeChain, updateRopeChain } from '../../three/gymProps';

interface BattleRopesGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const DURATION_SEC = 24;
const ROPE_NODES = 24;

export const BattleRopesGame: React.FC<BattleRopesGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [expectedSide, setExpectedSide] = useState<'left' | 'right' | 'slam'>('left');
  const [powerMeter, setPowerMeter] = useState(0);
  const [feedback, setFeedback] = useState('¡Alterna Azote Izquierdo (A) y Derecho (D) sin parar!');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(DURATION_SEC);
  const lastSecRef = useRef(DURATION_SEC);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const expectedSideRef = useRef<'left' | 'right' | 'slam'>('left');
  const powerRef = useRef(0);
  const completedRef = useRef(false);

  // Wave impulse state for left & right ropes
  const leftWaveAmpRef = useRef(0);
  const rightWaveAmpRef = useRef(0);
  const leftPhaseRef = useRef(0);
  const rightPhaseRef = useRef(0);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'battle_ropes',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((165 + scoreRef.current * 0.045) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  const strikeRope = useCallback(
    (side: 'left' | 'right' | 'slam') => {
      if (completedRef.current) return;
      actionsRef.current += 1;

      const wanted = expectedSideRef.current;

      if (wanted === 'slam') {
        if (side === 'slam') {
          comboRef.current += 2;
          perfectRef.current += 2;
          maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
          const pts = Math.round((260 + comboRef.current * 24) * cfg.rewardMult);
          scoreRef.current += pts;
          powerRef.current = 0;
          leftWaveAmpRef.current = 1.0;
          rightWaveAmpRef.current = 1.0;
          expectedSideRef.current = 'left';
          setExpectedSide('left');
          setPowerMeter(0);
          setScore(scoreRef.current);
          setCombo(comboRef.current);
          setFeedback(`¡ONDA DE CHOQUE DOBLE! +${pts} pts`);
          sound.playPerfect();
          return;
        } else {
          // Wrong input while Double Slam ready
          comboRef.current = 0;
          powerRef.current = Math.max(0, powerRef.current - 35);
          setPowerMeter(powerRef.current);
          setCombo(0);
          setFeedback('¡Pulsa DOBLE AZOTE (Espacio) cuando la barra esté llena!');
          sound.playMiss();
          return;
        }
      }

      if (side === wanted) {
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        perfectRef.current += 1;

        const mult = 1 + Math.min(2.0, comboRef.current * 0.14);
        const pts = Math.round(75 * mult * cfg.rewardMult);
        scoreRef.current += pts;

        if (side === 'left') {
          leftWaveAmpRef.current = 0.85;
          leftPhaseRef.current = 0;
        } else {
          rightWaveAmpRef.current = 0.85;
          rightPhaseRef.current = 0;
        }

        const nextPower = Math.min(100, powerRef.current + 14);
        powerRef.current = nextPower;
        setPowerMeter(nextPower);

        if (nextPower >= 100) {
          expectedSideRef.current = 'slam';
          setExpectedSide('slam');
          setFeedback('¡BARRA LLENA! ¡Lanza DOBLE AZOTE (Espacio)!');
          sound.playCoin();
        } else {
          const nextSide = side === 'left' ? 'right' : 'left';
          expectedSideRef.current = nextSide;
          setExpectedSide(nextSide);
          setFeedback(
            comboRef.current >= 8
              ? `¡TORMENTA DE OLAS x${comboRef.current}! +${pts}`
              : `¡Onda limpia! +${pts}`
          );
          if (comboRef.current >= 3) {
            sound.playComboHit(comboRef.current);
          } else {
            sound.playPunch();
          }
        }

        setScore(scoreRef.current);
        setCombo(comboRef.current);
      } else if (side !== 'slam') {
        comboRef.current = 0;
        setCombo(0);
        setFeedback(`Alterna las manos · Ahora toca ${wanted === 'left' ? 'Izquierda (A)' : 'Derecha (D)'}`);
        sound.playMiss();
      }
    },
    [cfg.rewardMult]
  );

  // Three.js Dynamic Dual Battle Ropes Stage
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
    dressGymScene(scene, { fogNear: 6, fogFar: 15, focus: { x: 0, z: -0.45 } });
    addGymDecor(scene, ['squatRack', 'dumbbells'], {
      focus: { x: 0, z: -0.45 },
      depth: 2.8,
      isCancelled: () => unmounted,
    });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 35);
    camera.position.set(1.25, 1.95, computeResponsiveCameraZ(3.85, w / h, 1.0));
    camera.lookAt(0, 0.75, -0.45);

    createThreePointLights(scene, 6);

    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 16),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Weighted Steel Battle-Rope Anchor Sled at far end (z = -3.6)
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x262a33, metalness: 0.85, roughness: 0.28 });
    const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.16 });
    const sledGroup = new THREE.Group();
    sledGroup.position.set(0, 0, -3.6);

    const sledPlate = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.72), steelMat);
    sledPlate.position.y = 0.04;
    sledPlate.castShadow = true;
    sledPlate.receiveShadow = true;
    sledGroup.add(sledPlate);

    const plateColors = [0xff5a1f, 0x0284c7];
    for (const side of [-0.26, 0.26]) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 12), chromeMat);
      horn.position.set(side, 0.3, -0.06);
      sledGroup.add(horn);

      for (let p = 0; p < 2; p++) {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2 - p * 0.025, 0.2 - p * 0.025, 0.05, 22),
          new THREE.MeshStandardMaterial({ color: plateColors[p], roughness: 0.45, metalness: 0.16 })
        );
        disc.position.set(side, 0.11 + p * 0.058, -0.06);
        disc.castShadow = true;
        sledGroup.add(disc);
      }

      // Steel anchor shackle facing athlete
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 10, 20), chromeMat);
      shackle.position.set(side * 0.54, 0.24, 0.22);
      sledGroup.add(shackle);
    }
    scene.add(sledGroup);

    const anchorRingMat = new THREE.MeshStandardMaterial({
      color: 0xff6a2b,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.5,
      roughness: 0.25,
    });
    const anchorRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.036, 12, 40), anchorRingMat);
    anchorRing.rotation.x = Math.PI / 2;
    anchorRing.position.set(0, 0.04, -3.6);
    scene.add(anchorRing);

    // Sculpted Athlete in athletic battle-rope half-squat stance
    const fighter = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    fighter.root.position.set(0, 0, 2.25);
    fighter.root.rotation.y = Math.PI;
    fighter.pelvisGroup.position.y = 0.82;
    fighter.upperBody.position.y = 0.92;
    fighter.upperBody.rotation.x = 0.22;
    fighter.leftLegPivot.position.y = 0.78;
    fighter.rightLegPivot.position.y = 0.78;
    fighter.leftLegPivot.rotation.x = -0.45;
    fighter.rightLegPivot.rotation.x = -0.45;
    fighter.leftKneePivot.rotation.x = 0.75;
    fighter.rightKneePivot.rotation.x = 0.75;
    fighter.leftForearmPivot.rotation.x = -0.55;
    fighter.rightForearmPivot.rotation.x = -0.55;
    scene.add(fighter.root);

    let glbFighter: GlbPoseRig | null = null;
    const glbLeftHandPos = new THREE.Vector3(-0.38, 0.92, 1.75);
    const glbRightHandPos = new THREE.Vector3(0.38, 0.92, 1.75);
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmounted,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, 2.25);
        rig.root.rotation.y = Math.PI;
        rig.poseBattleRopes(0, 0, 0);
        scene.add(rig.root);
        glbFighter = rig;
        fighter.root.visible = false;
      },
    });

    // Pre-allocated Continuous Braided 3D Battle Ropes + Heat-Shrink Hand Grips (Zero GC)
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.74, metalness: 0.08 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.42, metalness: 0.14 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.2 });

    const leftRopeSegs = buildContinuousRopeChain(ROPE_NODES - 1, 0.052, ropeMat, stripeMat, 3);
    const rightRopeSegs = buildContinuousRopeChain(ROPE_NODES - 1, 0.052, ropeMat, stripeMat, 3);
    leftRopeSegs.forEach((s) => scene.add(s));
    rightRopeSegs.forEach((s) => scene.add(s));

    const gripGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.28, 14);
    gripGeo.rotateX(Math.PI / 2);
    const leftGrip = new THREE.Mesh(gripGeo, gripMat);
    const rightGrip = new THREE.Mesh(gripGeo, gripMat);
    scene.add(leftGrip, rightGrip);

    const leftPoints = Array.from({ length: ROPE_NODES }, () => new THREE.Vector3());
    const rightPoints = Array.from({ length: ROPE_NODES }, () => new THREE.Vector3());
    const tmpMid = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const aspect = cw / ch;
      camera.aspect = aspect;
      camera.position.z = computeResponsiveCameraZ(3.85, aspect, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (unmounted) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
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

      // Decay wave amplitudes & advance traveling wave phases
      leftWaveAmpRef.current = THREE.MathUtils.damp(leftWaveAmpRef.current, 0.08, 3.8, dt);
      rightWaveAmpRef.current = THREE.MathUtils.damp(rightWaveAmpRef.current, 0.08, 3.8, dt);
      leftPhaseRef.current += dt * (11 + leftWaveAmpRef.current * 8);
      rightPhaseRef.current += dt * (11 + rightWaveAmpRef.current * 8);

      // Pump athlete's arms vigorously with rope waves
      const leftHandWave = Math.sin(leftPhaseRef.current) * leftWaveAmpRef.current;
      const rightHandWave = Math.sin(rightPhaseRef.current) * rightWaveAmpRef.current;
      let startLx = -0.38;
      let startLy = 0.92 + leftHandWave * 0.14;
      let startLz = 1.75;
      let startRx = 0.38;
      let startRy = 0.92 + rightHandWave * 0.14;
      let startRz = 1.75;

      if (glbFighter) {
        glbFighter.poseBattleRopes(leftHandWave, rightHandWave, 0);
        if (glbFighter.bones.leftHand && glbFighter.bones.rightHand) {
          // Athlete faces -Z: anatomical LeftHand is on -X, RightHand is on +X
          glbFighter.bones.leftHand.getWorldPosition(glbLeftHandPos);
          glbFighter.bones.rightHand.getWorldPosition(glbRightHandPos);
          startLx = glbLeftHandPos.x;
          startLy = glbLeftHandPos.y;
          startLz = glbLeftHandPos.z;
          startRx = glbRightHandPos.x;
          startRy = glbRightHandPos.y;
          startRz = glbRightHandPos.z;
        }
      } else {
        fighter.leftArmPivot.rotation.x = -0.78 + leftHandWave * 0.55;
        fighter.rightArmPivot.rotation.x = -0.78 + rightHandWave * 0.55;
      }

      for (let i = 0; i < ROPE_NODES; i++) {
        const t = i / (ROPE_NODES - 1); // 0 at player hands, 1 at anchor
        const envelope = Math.sin(t * Math.PI) * (1 - t * 0.25);

        const zL = THREE.MathUtils.lerp(startLz, -3.38, t);
        const baseYL = THREE.MathUtils.lerp(startLy, 0.24, t);
        const xL = THREE.MathUtils.lerp(startLx, -0.14, t);
        const waveL = Math.sin(t * 9.5 - leftPhaseRef.current) * leftWaveAmpRef.current * 0.72 * envelope;
        leftPoints[i].set(xL, i === 0 ? startLy : Math.max(0.06, baseYL + waveL), zL);

        const zR = THREE.MathUtils.lerp(startRz, -3.38, t);
        const baseYR = THREE.MathUtils.lerp(startRy, 0.24, t);
        const xR = THREE.MathUtils.lerp(startRx, 0.14, t);
        const waveR = Math.sin(t * 9.5 - rightPhaseRef.current) * rightWaveAmpRef.current * 0.72 * envelope;
        rightPoints[i].set(xR, i === 0 ? startRy : Math.max(0.06, baseYR + waveR), zR);
      }

      leftGrip.position.copy(leftPoints[0]);
      rightGrip.position.copy(rightPoints[0]);
      updateRopeChain(leftRopeSegs, leftPoints, tmpMid, tmpDir);
      updateRopeChain(rightRopeSegs, rightPoints, tmpMid, tmpDir);

      if (expectedSideRef.current === 'slam') {
        anchorRingMat.color.setHex(0x10b981);
        anchorRingMat.emissive.setHex(0x10b981);
        anchorRingMat.emissiveIntensity = 1.4 + Math.sin(now * 0.015) * 0.4;
        anchorRing.scale.setScalar(1.18);
      } else {
        anchorRingMat.color.setHex(0xff6a2b);
        anchorRingMat.emissive.setHex(0xff5a1f);
        anchorRingMat.emissiveIntensity = 0.4 + (powerRef.current / 100) * 0.7;
        anchorRing.scale.setScalar(1.0);
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
      disposeScene(scene, renderer);
    };
  }, [finishGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        strikeRope('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        strikeRope('right');
      } else if (e.code === 'Space') {
        e.preventDefault();
        strikeRope('slam');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [strikeRope]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Combate & HIIT 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Olas de Battle Ropes</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Tiempo</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Combo</div>
            <div className={`font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 ${combo >= 8 ? 'text-orange-500' : 'text-white'}`}>
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
        <DuelProgressBanner
          rivalName={rivalName}
          rivalTargetScore={rivalTargetScore}
          score={score}
        />
      )}

      {/* 3D Battle Ropes Viewport */}
      <div className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black select-none">
        <div ref={mountRef} className="w-full h-full" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 border border-white/15 px-3.5 py-1 rounded-lg text-xs text-white/85 whitespace-nowrap">
          {feedback}
        </div>
      </div>

      {/* Shockwave Meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-white/60">Carga de Onda Doble</span>
          <span className="font-mono-tabular font-bold text-orange-500">{powerMeter}%</span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-150 ${
              expectedSide === 'slam' ? 'bg-emerald-500' : 'bg-orange-500'
            }`}
            style={{ width: `${powerMeter}%` }}
          />
        </div>
      </div>

      {/* Tactile Left / Double Slam / Right Controls */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <button
          onPointerDown={() => strikeRope('left')}
          className={`py-3.5 px-4 rounded-xl font-display uppercase tracking-wider font-bold text-base border transition-all cursor-pointer select-none touch-none ${
            expectedSide === 'left'
              ? 'bg-orange-500 border-orange-500 text-white shadow-none'
              : 'bg-white/[0.03] border-white/10 text-white/75 hover:bg-white/10'
          }`}
        >
          Azote Izq. (A)
        </button>

        <button
          onPointerDown={() => strikeRope('slam')}
          className={`py-3.5 px-4 rounded-xl font-display uppercase tracking-wider font-bold text-base border transition-all cursor-pointer select-none touch-none ${
            expectedSide === 'slam'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-none'
              : 'bg-white/[0.06] border-white/10 text-white/50'
          }`}
        >
          Doble Azote (Espacio)
        </button>

        <button
          onPointerDown={() => strikeRope('right')}
          className={`py-3.5 px-4 rounded-xl font-display uppercase tracking-wider font-bold text-base border transition-all cursor-pointer select-none touch-none ${
            expectedSide === 'right'
              ? 'bg-orange-500 border-orange-500 text-white shadow-none'
              : 'bg-white/[0.03] border-white/10 text-white/75 hover:bg-white/10'
          }`}
        >
          Azote Der. (D)
        </button>
      </div>
    </div>
  );
};
