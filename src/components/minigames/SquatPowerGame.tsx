import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../../three/threeUtils';

import { AthleteBuildOptions, buildAthleteModel } from '../../three/buildAthleteModel';

interface SquatPowerGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_REPS = 10;

export const SquatPowerGame: React.FC<SquatPowerGameProps> = ({
  difficulty,
  athlete,
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
  const [chargePct, setChargePct] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'perfect' | 'good' | 'miss' } | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const chargeRef = useRef(0);
  const holdingRef = useRef(false);
  const barYTargetRef = useRef(1.58);
  const barYCurrentRef = useRef(1.58);
  const barTiltRef = useRef(0);
  const camPulseRef = useRef(0);
  const platesCountRef = useRef(1);

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
  const currentWeightKg = 60 + platesCount * 25;

  // Target depth sweet spot (72% is ideal parallel squat depth)
  const targetCenter = 74;
  const sweetHalf = Math.max(4.5, 9 * cfg.windowMult - (rep - 1) * 0.22);
  const goodHalf = Math.max(11, 18 * cfg.windowMult - (rep - 1) * 0.35);

  const resolveSquat = useCallback(
    (finalCharge: number) => {
      if (stateRef.current.locked) return;
      holdingRef.current = false;
      setIsHolding(false);
      setLocked(true);

      const currentRep = stateRef.current.rep;
      const dist = Math.abs(finalCharge - targetCenter);

      let pts = 0;
      let nextCombo = stateRef.current.combo;
      let nextPerfect = stateRef.current.perfectHits;
      let fb: { text: string; tone: 'perfect' | 'good' | 'miss' };

      if (finalCharge >= 98.5) {
        nextCombo = 0;
        pts = Math.round(10 * cfg.rewardMult);
        fb = { text: '¡SOBRECARGA! Soltaste tarde', tone: 'miss' };
        sound.playMiss();
        barTiltRef.current = 0.14;
      } else if (dist <= sweetHalf) {
        nextCombo += 1;
        nextPerfect += 1;
        const mult = 1 + Math.min(2.4, nextCombo * 0.24);
        pts = Math.round(170 * mult * cfg.rewardMult);
        fb = { text: nextCombo >= 3 ? `¡POTENCIA PURA x${nextCombo}!` : '¡SENTADILLA PERFECTA!', tone: 'perfect' };
        sound.playPerfect();
        camPulseRef.current = 0.08;
      } else if (dist <= goodHalf) {
        nextCombo += 1;
        const mult = 1 + Math.min(1.4, nextCombo * 0.14);
        pts = Math.round(95 * mult * cfg.rewardMult);
        fb = { text: '¡BUENA PROFUNDIDAD!', tone: 'good' };
        sound.playHit();
      } else {
        nextCombo = 0;
        pts = Math.round(20 * cfg.rewardMult);
        fb = {
          text: finalCharge < targetCenter ? 'MUY CORTA · Baja más' : 'PASADO DE ZONA',
          tone: 'miss',
        };
        sound.playMiss();
        barTiltRef.current = -0.1;
      }

      // Snap barbell back to standing lockout
      barYTargetRef.current = 1.72;

      const nextScore = stateRef.current.score + pts;
      const nextMaxCombo = Math.max(stateRef.current.maxCombo, nextCombo);

      setScore(nextScore);
      setCombo(nextCombo);
      setMaxCombo(nextMaxCombo);
      setPerfectHits(nextPerfect);
      setFeedback(fb);

      window.setTimeout(() => {
        barYTargetRef.current = 1.58;
        chargeRef.current = 0;
        setChargePct(0);

        if (currentRep >= TOTAL_REPS) {
          onComplete({
            gameId: 'squats',
            difficulty,
            score: nextScore,
            maxCombo: nextMaxCombo,
            perfectHits: nextPerfect,
            totalActions: TOTAL_REPS,
            caloriesBurned: Math.round(135 * cfg.rewardMult + nextPerfect * 10),
            rivalTargetScore,
            rivalName,
          });
        } else {
          setRep(currentRep + 1);
          setFeedback(null);
          setLocked(false);
        }
      }, 460);
    },
    [cfg.rewardMult, difficulty, goodHalf, onComplete, rivalName, rivalTargetScore, sweetHalf]
  );

  const startHold = useCallback(() => {
    if (stateRef.current.locked || holdingRef.current) return;
    holdingRef.current = true;
    setIsHolding(true);
    setFeedback(null);
    sound.playTap();
  }, []);

  const releaseHold = useCallback(() => {
    if (!holdingRef.current || stateRef.current.locked) return;
    resolveSquat(chargeRef.current);
  }, [resolveSquat]);

  // Three.js Squat Rack + Safety Pins + Weighted Barbell + Depth Ring
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
    dressGymScene(scene, { fogNear: 6, fogFar: 16 });
    addGymDecor(scene, ['dumbbells', 'bench'], { focus: { x: 0, z: 0 }, depth: 2.8 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 40);
    camera.position.set(0.55, 1.85, 4.35);
    camera.lookAt(0, 1.08, 0);

    createThreePointLights(scene, 5);

    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Lifting Platform
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.08, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.55, metalness: 0.15 })
    );
    platform.position.set(0, 0.04, 0);
    platform.receiveShadow = true;
    scene.add(platform);

    // Squat Cage Posts
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.78 });
    const safetyMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35, metalness: 0.4 });
    const postGeo = new THREE.BoxGeometry(0.11, 2.5, 0.11);
    const postCoords: [number, number][] = [
      [-1.05, -0.4],
      [1.05, -0.4],
      [-1.05, 0.55],
      [1.05, 0.55],
    ];
    for (const [px, pz] of postCoords) {
      const p = new THREE.Mesh(postGeo, cageMat);
      p.position.set(px, 1.25, pz);
      p.castShadow = true;
      scene.add(p);
    }

    // Safety Spotter Arms
    for (const side of [-1.05, 1.05]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.05), safetyMat);
      arm.position.set(side, 0.85, 0.08);
      scene.add(arm);
    }

    // Depth Ring on Floor (glows emerald when charge is inside sweet spot)
    const depthRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    const depthRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.032, 12, 48), depthRingMat);
    depthRing.rotation.x = Math.PI / 2;
    depthRing.position.set(0, 0.095, 0.1);
    scene.add(depthRing);

    // Sculpted Athlete performing the squat inside the cage
    const squatter = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    squatter.root.position.set(0, 0.08, 0.14);
    squatter.leftArmPivot.rotation.z = -1.05;
    squatter.rightArmPivot.rotation.z = 1.05;
    squatter.leftArmPivot.rotation.x = -0.35;
    squatter.rightArmPivot.rotation.x = -0.35;
    squatter.leftForearmPivot.rotation.z = -1.75;
    squatter.rightForearmPivot.rotation.z = 1.75;
    scene.add(squatter.root);

    // Olympic Barbell
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.94,
      roughness: 0.16,
    });
    const barbellGroup = new THREE.Group();
    barbellGroup.position.set(0, 1.58, 0.1);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 3.2, 16), chromeMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    barbellGroup.add(shaft);

    const plateColors = [0xff5a1f, 0x0284c7, 0x10b981, 0xf59e0b, 0xe11d48];
    const platePairs: [THREE.Mesh, THREE.Mesh][] = [];
    for (let i = 0; i < 5; i++) {
      const radius = 0.36 - i * 0.025;
      const pGeo = new THREE.CylinderGeometry(radius, radius, 0.058, 28);
      pGeo.rotateZ(Math.PI / 2);
      const pMat = new THREE.MeshStandardMaterial({
        color: plateColors[i],
        roughness: 0.42,
        metalness: 0.2,
      });
      const leftP = new THREE.Mesh(pGeo, pMat);
      leftP.position.x = -1.2 - i * 0.072;
      leftP.castShadow = true;
      const rightP = new THREE.Mesh(pGeo, pMat);
      rightP.position.x = 1.2 + i * 0.072;
      rightP.castShadow = true;
      barbellGroup.add(leftP, rightP);
      platePairs.push([leftP, rightP]);
    }
    scene.add(barbellGroup);

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
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      if (holdingRef.current && !stateRef.current.locked) {
        const repBoost = 1 + (stateRef.current.rep - 1) * 0.055;
        const speed = 78 * cfg.speedMult * repBoost;
        const nextCharge = Math.min(100, chargeRef.current + speed * dt);
        chargeRef.current = nextCharge;
        setChargePct(nextCharge);

        // Lower barbell into squat position as charge increases
        barYTargetRef.current = 1.58 - (nextCharge / 100) * 0.66;

        if (nextCharge >= 100) {
          resolveSquat(100);
        }
      }

      barYCurrentRef.current = THREE.MathUtils.damp(barYCurrentRef.current, barYTargetRef.current, 14, dt);
      barTiltRef.current = THREE.MathUtils.damp(barTiltRef.current, 0, 10, dt);
      barbellGroup.position.y = barYCurrentRef.current;
      barbellGroup.rotation.z = barTiltRef.current;

      // Articulate athlete squat kinematics smoothly with barbell height
      const squatDepth = THREE.MathUtils.clamp((1.58 - barYCurrentRef.current) / 0.66, 0, 1);
      const dropY = squatDepth * 0.42;
      squatter.pelvisGroup.position.y = 0.92 - dropY;
      squatter.upperBody.position.y = 1.02 - dropY;
      squatter.upperBody.rotation.x = 0.05 + squatDepth * 0.28;
      squatter.leftLegPivot.position.y = 0.88 - dropY;
      squatter.rightLegPivot.position.y = 0.88 - dropY;
      squatter.leftLegPivot.rotation.x = -squatDepth * 0.98;
      squatter.rightLegPivot.rotation.x = -squatDepth * 0.98;
      squatter.leftKneePivot.rotation.x = squatDepth * 1.48;
      squatter.rightKneePivot.rotation.x = squatDepth * 1.48;

      // Color depth ring dynamically based on proximity to targetCenter
      const dist = Math.abs(chargeRef.current - targetCenter);
      if (holdingRef.current && dist <= sweetHalf) {
        depthRingMat.color.setHex(0x10b981);
        depthRingMat.emissive.setHex(0x10b981);
        depthRingMat.emissiveIntensity = 1.25;
        depthRing.scale.setScalar(1.06);
      } else if (holdingRef.current && chargeRef.current > targetCenter + goodHalf) {
        depthRingMat.color.setHex(0xf43f5e);
        depthRingMat.emissive.setHex(0xe11d48);
        depthRingMat.emissiveIntensity = 1.0;
        depthRing.scale.setScalar(1.02);
      } else {
        depthRingMat.color.setHex(0xff6a2b);
        depthRingMat.emissive.setHex(0xff5a1f);
        depthRingMat.emissiveIntensity = holdingRef.current ? 0.65 : 0.25;
        depthRing.scale.setScalar(1.0);
      }

      const activePlates = platesCountRef.current;
      platePairs.forEach(([l, r], idx) => {
        const vis = idx < activePlates;
        l.visible = vis;
        r.visible = vis;
      });

      camPulseRef.current = THREE.MathUtils.damp(camPulseRef.current, 0, 12, dt);
      camera.position.y = 1.85 + Math.sin(now * 0.04) * camPulseRef.current;

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
      disposeScene(scene, renderer);
    };
  }, [cfg.speedMult, goodHalf, resolveSquat, sweetHalf]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (e.repeat) return;
        e.preventDefault();
        startHold();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        releaseHold();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [releaseHold, startHold]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Fuerza 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Sentadilla de Hierro</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Repetición</div>
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
        <div className="mt-4 flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-2 text-xs font-medium text-orange-200">
          <span>Duelo contra {rivalName}</span>
          <span className="font-mono-tabular font-bold">
            Meta: {rivalTargetScore.toLocaleString('es-ES')} pts · Actual: {score.toLocaleString('es-ES')}
          </span>
        </div>
      )}

      {/* 3D Squat Cage Viewport */}
      <div
        onPointerDown={startHold}
        onPointerUp={releaseHold}
        onPointerLeave={releaseHold}
        className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black cursor-pointer select-none touch-none"
      >
        <div ref={mountRef} className="w-full h-full" />

        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
          <span className="bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded">
            Carga en sentadilla: <strong className="text-white font-mono-tabular">{currentWeightKg} kg</strong>
          </span>
          {combo >= 3 && (
            <span className="bg-orange-500 text-white font-bold px-2.5 py-1 rounded">
              PIERNAS DE ACERO
            </span>
          )}
        </div>

        {feedback && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-sm px-4 py-1.5 rounded-lg">
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

      {/* Depth Hold Meter */}
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
          <div
            className="absolute top-0 bottom-0 right-0 bg-rose-500/25"
            style={{ width: '5%' }}
          />
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/10 transition-none"
            style={{ width: `${chargePct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-2 bg-white rounded-sm -translate-x-1/2"
            style={{ left: `${chargePct}%` }}
          />
        </div>

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs text-white/50">
            Mantén pulsado para bajar y suelta justo en la zona verde
          </p>
          <button
            onPointerDown={startHold}
            onPointerUp={releaseHold}
            onPointerLeave={releaseHold}
            disabled={locked}
            className={`px-8 py-3.5 text-white font-display italic uppercase font-black tracking-wider text-lg rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer select-none touch-none ${
              isHolding ? 'bg-emerald-600 scale-[0.98]' : 'bg-orange-500 hover:bg-orange-400'
            } disabled:opacity-60`}
          >
            {isHolding ? '¡Suelta en Zona Verde!' : 'Mantener (Espacio)'}
          </button>
        </div>
      </div>
    </div>
  );
};
