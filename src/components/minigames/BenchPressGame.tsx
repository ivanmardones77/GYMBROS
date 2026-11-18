import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import { DuelProgressBanner } from '../DuelProgressBanner';
import {
  afterDraw,
  computeResponsiveCameraZ,
  createKineticParticleTexture,
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
import { buildBenchPressStation3D, buildOlympicBarbell } from '../../three/gymProps';

interface BenchPressGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_REPS = 10;

export const BenchPressGame: React.FC<BenchPressGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [rep, setRep] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectHits, setPerfectHits] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'perfect' | 'good' | 'miss' } | null>(null);
  const [locked, setLocked] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const cursorElRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(50);
  const dirRef = useRef(1);
  const lastTimeRef = useRef<number | null>(null);
  const barLiftTargetRef = useRef(0);
  const barLiftCurrentRef = useRef(0);
  const barTiltRef = useRef(0);
  const camShakeRef = useRef(0);
  const baseCamZRef = useRef(4.4);
  const platesCountRef = useRef(1);
  const repTimeoutRef = useRef<number | null>(null);
  const unmountedGameRef = useRef(false);
  const burstTriggerRef = useRef<{ seq: number; tone: 'perfect' | 'good' | 'miss' }>({
    seq: 0,
    tone: 'perfect',
  });

  useEffect(() => {
    unmountedGameRef.current = false;
    return () => {
      unmountedGameRef.current = true;
      if (repTimeoutRef.current !== null) {
        window.clearTimeout(repTimeoutRef.current);
        repTimeoutRef.current = null;
      }
    };
  }, []);

  const stateRef = useRef({
    rep: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectHits: 0,
    locked: false,
  });
  stateRef.current = { rep, score, combo, maxCombo, perfectHits, locked };

  const platesCount = Math.min(5, Math.ceil(rep / 2) + (difficulty - 1));
  platesCountRef.current = platesCount;
  const currentWeightKg = 40 + platesCount * 20;

  const sweetHalf = Math.max(4.5, 9.5 * cfg.windowMult - (rep - 1) * 0.25);
  const goodHalf = Math.max(12, 22 * cfg.windowMult - (rep - 1) * 0.45);
  const targetCenter = 50;

  // Three.js 3D Gym Rack + Barbell Stage
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
    dressGymScene(scene, { fogNear: 6, fogFar: 16 });
    addGymDecor(scene, ['dumbbells', 'squatRack'], {
      focus: { x: 0, z: 0 },
      depth: 2.8,
      isCancelled: () => unmounted,
    });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    baseCamZRef.current = computeResponsiveCameraZ(4.4, aspect, 1.05);
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 40);
    camera.position.set(0, 2.05, baseCamZRef.current);
    camera.lookAt(0, 1.05, 0);

    createThreePointLights(scene, 5);

    // Rubber Gym Floor
    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Competition Bench Press Half-Rack + Contoured Stitched Bench + Spotter Arms
    const { group: rackGroup, rackLedMat } = buildBenchPressStation3D();
    scene.add(rackGroup);

    // Sculpted Lifter Athlete lying supine on the bench (procedural fallback until GLB resolves)
    const lifter = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    lifter.root.position.set(0, 0.68, 0.75);
    lifter.root.rotation.x = -Math.PI / 2;
    lifter.shadowMesh.visible = false;
    // Bend legs cleanly over end of bench
    lifter.leftLegPivot.rotation.x = 0.15;
    lifter.rightLegPivot.rotation.x = 0.15;
    lifter.leftKneePivot.rotation.x = 1.4;
    lifter.rightKneePivot.rotation.x = 1.4;
    scene.add(lifter.root);

    let glbLifter: GlbPoseRig | null = null;
    const tmpShoulderPos = new THREE.Vector3();
    let benchOffsetY = 0.68;
    let benchOffsetZ = 1.38;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmounted,
      onLoaded: (rig) => {
        rig.root.rotation.x = -Math.PI / 2;
        rig.root.position.set(0, 0, 0);
        rig.poseBenchPress(barLiftCurrentRef.current);
        if (rig.bones.spine) {
          rig.bones.spine.getWorldPosition(tmpShoulderPos);
          benchOffsetZ = 0.05 - tmpShoulderPos.z;
          benchOffsetY = 0.72 - tmpShoulderPos.y;
        }
        rig.root.position.set(0, benchOffsetY, benchOffsetZ);
        scene.add(rig.root);
        glbLifter = rig;
        lifter.root.visible = false;
      },
    });

    // Knurled Olympic Barbell + Calibrated Bumper Plates + Spin-Lock Collars
    const { group: barbellGroup, platePairs } = buildOlympicBarbell({
      plateBaseX: 1.24,
      maxPlates: 5,
      plateStep: 0.068,
      plateBaseRadius: 0.34,
    });
    barbellGroup.position.set(0, 1.05, 0.05);
    scene.add(barbellGroup);

    // 3D Impact Spark Particles around Barbell
    const sparkCount = 40;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = new Float32Array(sparkCount * 3);
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPosAttr = new THREE.BufferAttribute(sparkPos, 3);
    sparkGeo.setAttribute('position', sparkPosAttr);
    const sparkMat = new THREE.PointsMaterial({
      size: 0.13,
      map: createKineticParticleTexture(),
      color: 0x34d399,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    sparkPoints.frustumCulled = false;
    scene.add(sparkPoints);
    let lastBurstSeq = 0;
    let sparkLife = 0;
    let ledGlow = 0.35;

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const aspectNext = cw / ch;
      camera.aspect = aspectNext;
      baseCamZRef.current = computeResponsiveCameraZ(4.4, aspectNext, 1.05);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let frameId = 0;

    const tick = (now: number) => {
      if (unmounted) return;
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Update precision meter needle via direct DOM style (0 React re-renders per frame)
      if (!stateRef.current.locked) {
        const repSpeedBoost = 1 + (stateRef.current.rep - 1) * 0.065;
        const speed = 95 * cfg.speedMult * repSpeedBoost;
        let next = posRef.current + dirRef.current * speed * dt;
        if (next >= 98) {
          next = 98;
          dirRef.current = -1;
        } else if (next <= 2) {
          next = 2;
          dirRef.current = 1;
        }
        posRef.current = next;
        if (cursorElRef.current) {
          cursorElRef.current.style.left = `${next}%`;
        }
      }

      // Smooth 3D barbell lift kinematics
      barLiftCurrentRef.current = THREE.MathUtils.damp(
        barLiftCurrentRef.current,
        barLiftTargetRef.current,
        12,
        dt
      );
      barTiltRef.current = THREE.MathUtils.damp(barTiltRef.current, 0, 10, dt);

      const liftT = barLiftCurrentRef.current;
      const desiredBarY = 0.96 + liftT * 0.2;
      if (glbLifter) {
        const achieved = glbLifter.poseBenchPress(liftT, desiredBarY, 0.05);
        barbellGroup.position.set(0, achieved.barY, achieved.barZ);
      } else {
        barbellGroup.position.set(0, 1.05 + liftT * 0.65, 0.05);
        lifter.leftArmPivot.rotation.x = -1.25 - liftT * 0.28;
        lifter.rightArmPivot.rotation.x = -1.25 - liftT * 0.28;
        lifter.leftArmPivot.rotation.z = -0.35 + liftT * 0.12;
        lifter.rightArmPivot.rotation.z = 0.35 - liftT * 0.12;
        lifter.leftForearmPivot.rotation.x = -1.15 + liftT * 0.95;
        lifter.rightForearmPivot.rotation.x = -1.15 + liftT * 0.95;
      }
      barbellGroup.rotation.z = barTiltRef.current;

      // Plate visibility by current rep load
      const activePlates = platesCountRef.current;
      platePairs.forEach(([l, r], idx) => {
        const vis = idx < activePlates;
        l.visible = vis;
        r.visible = vis;
      });

      // Trigger 3D burst & rack LED feedback on lift
      if (burstTriggerRef.current.seq !== lastBurstSeq) {
        lastBurstSeq = burstTriggerRef.current.seq;
        const tone = burstTriggerRef.current.tone;
        const hex = tone === 'perfect' ? 0x10b981 : tone === 'good' ? 0xfbbf24 : 0xf43f5e;
        rackLedMat.color.setHex(hex);
        rackLedMat.emissive.setHex(hex);
        ledGlow = tone === 'perfect' ? 1.8 : 1.05;
        if (tone !== 'miss') {
          sparkMat.color.setHex(hex);
          sparkLife = 1.0;
          for (let i = 0; i < sparkCount; i++) {
            const side = i % 2 === 0 ? -1.25 : 1.25;
            const idx = i * 3;
            sparkPos[idx] = side + (Math.random() - 0.5) * 0.25;
            sparkPos[idx + 1] = barbellGroup.position.y + (Math.random() - 0.5) * 0.2;
            sparkPos[idx + 2] = 0.05 + (Math.random() - 0.5) * 0.2;
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.2 + Math.random() * 2.2;
            sparkVel[idx] = Math.cos(ang) * spd;
            sparkVel[idx + 1] = 1.2 + Math.random() * 2.4;
            sparkVel[idx + 2] = Math.sin(ang) * spd;
          }
          sparkPosAttr.needsUpdate = true;
        }
      }

      ledGlow = THREE.MathUtils.damp(ledGlow, 0.3, 4.5, dt);
      rackLedMat.emissiveIntensity = ledGlow;

      if (sparkLife > 0.01) {
        sparkPoints.visible = true;
        sparkLife = Math.max(0, sparkLife - dt * 1.9);
        sparkMat.opacity = sparkLife;
        for (let i = 0; i < sparkCount; i++) {
          const idx = i * 3;
          sparkVel[idx + 1] -= 5.8 * dt;
          sparkPos[idx] += sparkVel[idx] * dt;
          sparkPos[idx + 1] += sparkVel[idx + 1] * dt;
          sparkPos[idx + 2] += sparkVel[idx + 2] * dt;
        }
        sparkPosAttr.needsUpdate = true;
      } else {
        sparkPoints.visible = false;
      }

      // Subtle camera punch on lift
      camShakeRef.current = THREE.MathUtils.damp(camShakeRef.current, 0, 14, dt);
      camera.position.y = 2.05 + Math.sin(now * 0.04) * camShakeRef.current;
      camera.position.z = baseCamZRef.current - barLiftCurrentRef.current * 0.18;

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
  }, [cfg.speedMult]);

  const handleLift = useCallback(() => {
    if (stateRef.current.locked || unmountedGameRef.current) return;
    setLocked(true);

    const pos = posRef.current;
    const dist = Math.abs(pos - targetCenter);
    const currentRep = stateRef.current.rep;

    let points = 0;
    let nextCombo = stateRef.current.combo;
    let nextPerfect = stateRef.current.perfectHits;
    let fb: { text: string; tone: 'perfect' | 'good' | 'miss' };

    if (dist <= sweetHalf) {
      nextCombo += 1;
      nextPerfect += 1;
      const mult = 1 + Math.min(2.5, nextCombo * 0.25);
      points = Math.round(160 * mult * cfg.rewardMult);
      fb = { text: nextCombo >= 3 ? `¡PERFECTO x${nextCombo}!` : '¡EMPUJE PERFECTO!', tone: 'perfect' };
      sound.playPerfect();
      barLiftTargetRef.current = 1.0;
      camShakeRef.current = 0.06;
      burstTriggerRef.current = { seq: burstTriggerRef.current.seq + 1, tone: 'perfect' };
    } else if (dist <= goodHalf) {
      nextCombo += 1;
      const mult = 1 + Math.min(1.5, nextCombo * 0.15);
      points = Math.round(90 * mult * cfg.rewardMult);
      fb = { text: '¡BUENA REPETICIÓN!', tone: 'good' };
      sound.playComboHit(nextCombo);
      barLiftTargetRef.current = 0.72;
      burstTriggerRef.current = { seq: burstTriggerRef.current.seq + 1, tone: 'good' };
    } else {
      nextCombo = 0;
      points = Math.round(15 * cfg.rewardMult);
      fb = { text: 'FALLO DE RITMO', tone: 'miss' };
      sound.playMiss();
      barLiftTargetRef.current = 0.18;
      barTiltRef.current = pos < 50 ? 0.12 : -0.12;
      burstTriggerRef.current = { seq: burstTriggerRef.current.seq + 1, tone: 'miss' };
    }

    const nextScore = stateRef.current.score + points;
    const nextMaxCombo = Math.max(stateRef.current.maxCombo, nextCombo);

    setScore(nextScore);
    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);
    setPerfectHits(nextPerfect);
    setFeedback(fb);

    if (repTimeoutRef.current !== null) window.clearTimeout(repTimeoutRef.current);
    repTimeoutRef.current = window.setTimeout(() => {
      if (unmountedGameRef.current) return;
      barLiftTargetRef.current = 0;
      if (currentRep >= TOTAL_REPS) {
        onComplete({
          gameId: 'bench',
          difficulty,
          score: nextScore,
          maxCombo: nextMaxCombo,
          perfectHits: nextPerfect,
          totalActions: TOTAL_REPS,
          caloriesBurned: Math.round(115 * cfg.rewardMult + nextPerfect * 8),
          rivalTargetScore,
          rivalName,
        });
      } else {
        setRep(currentRep + 1);
        setFeedback(null);
        setLocked(false);
      }
    }, 440);
  }, [cfg.rewardMult, difficulty, goodHalf, onComplete, rivalName, rivalTargetScore, sweetHalf]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleLift();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLift]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Fuerza 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Press de Banca Explosivo</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Serie</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-white">
              {rep} / {TOTAL_REPS}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Combo</div>
            <div className={`font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 ${combo >= 3 ? 'text-orange-500' : 'text-white'}`}>
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

      {/* 3D Barbell Viewport */}
      <div
        onClick={handleLift}
        className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black cursor-pointer select-none"
      >
        <div ref={mountRef} className="w-full h-full" />

        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
          <span className="bg-black/80 border border-white/15 px-2.5 py-1 rounded">
            Carga en barra: <strong className="text-white font-mono-tabular">{currentWeightKg} kg</strong>
          </span>
          {combo >= 3 && (
            <span className="bg-orange-500 text-white font-bold px-2.5 py-1 rounded">
              MODO BESTIA
            </span>
          )}
        </div>

        {feedback && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 border border-white/10 px-4 py-1.5 rounded-lg">
            <span
              className={`text-sm font-extrabold tracking-wide ${
                feedback.tone === 'perfect'
                  ? 'text-emerald-400'
                  : feedback.tone === 'good'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {feedback.text}
            </span>
          </div>
        )}
      </div>

      {/* Precision Power Meter */}
      <div className="mt-5">
        <div className="relative h-10 bg-white/[0.06] border border-white/10 rounded-lg overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-amber-400/80"
            style={{ left: `${targetCenter - goodHalf}%`, width: `${goodHalf * 2}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-emerald-500"
            style={{ left: `${targetCenter - sweetHalf}%`, width: `${sweetHalf * 2}%` }}
          />
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#141414]/90 -translate-x-1/2" />
          <div
            ref={cursorElRef}
            className="absolute top-0 bottom-0 w-2 bg-white rounded-sm shadow-none -translate-x-1/2"
            style={{ left: '50%' }}
          />
        </div>

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs text-white/50">
            Zona Verde = Máxima potencia · Toca la escena 3D o pulsa Espacio
          </p>
          <button
            onClick={handleLift}
            disabled={locked}
            className="w-full sm:w-auto px-10 py-3.5 fc-btn-accent disabled:opacity-60 text-lg rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            ¡Empujar Barra! (Espacio)
          </button>
        </div>
      </div>
    </div>
  );
};
