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
} from '../../three/threeUtils';

import { AthleteBuildOptions, buildAthleteModel } from '../../three/buildAthleteModel';

interface BenchPressGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_REPS = 10;

export const BenchPressGame: React.FC<BenchPressGameProps> = ({
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
  const [cursorPos, setCursorPos] = useState(50);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'perfect' | 'good' | 'miss' } | null>(null);
  const [locked, setLocked] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(50);
  const dirRef = useRef(1);
  const lastTimeRef = useRef<number | null>(null);
  const barLiftTargetRef = useRef(0);
  const barLiftCurrentRef = useRef(0);
  const barTiltRef = useRef(0);
  const camShakeRef = useRef(0);
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

    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 6, fogFar: 16 });
    addGymDecor(scene, ['dumbbells', 'squatRack'], { focus: { x: 0, z: 0 }, depth: 2.8 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 40);
    camera.position.set(0, 2.05, 4.4);
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

    // Steel Power Rack
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.35, metalness: 0.82 });
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.94,
      roughness: 0.16,
      anisotropy: 0.7,
    });
    const benchPadMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.65, metalness: 0.05 });

    const rackGroup = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.11, 2.4, 0.11);
    const postPositions: [number, number][] = [
      [-1.1, -0.45],
      [1.1, -0.45],
      [-1.1, 0.45],
      [1.1, 0.45],
    ];
    for (const [px, pz] of postPositions) {
      const post = new THREE.Mesh(postGeo, steelMat);
      post.position.set(px, 1.2, pz);
      post.castShadow = true;
      rackGroup.add(post);
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 0.12), steelMat);
    topBar.position.set(0, 2.35, -0.45);
    rackGroup.add(topBar);

    // Bench
    const benchPad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.5), benchPadMat);
    benchPad.position.set(0, 0.56, 0.2);
    benchPad.castShadow = true;
    const benchLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), steelMat);
    benchLeg1.position.set(0, 0.26, -0.35);
    const benchLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), steelMat);
    benchLeg2.position.set(0, 0.26, 0.75);
    rackGroup.add(benchPad, benchLeg1, benchLeg2);
    scene.add(rackGroup);

    // Sculpted Lifter Athlete lying supine on the bench
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

    // Composite Olympic Barbell Group
    const barbellGroup = new THREE.Group();
    barbellGroup.position.set(0, 1.05, 0.05);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 3.2, 16), chromeMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    barbellGroup.add(shaft);

    const sleeveGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.48, 16);
    sleeveGeo.rotateZ(Math.PI / 2);
    const leftSleeve = new THREE.Mesh(sleeveGeo, chromeMat);
    leftSleeve.position.x = -1.42;
    const rightSleeve = new THREE.Mesh(sleeveGeo, chromeMat);
    rightSleeve.position.x = 1.42;
    barbellGroup.add(leftSleeve, rightSleeve);

    // 5 Dynamic Bumper Plates per side
    const plateColors = [0xff5a1f, 0x0284c7, 0x10b981, 0xf59e0b, 0xe11d48];
    const platePairs: [THREE.Mesh, THREE.Mesh][] = [];
    for (let i = 0; i < 5; i++) {
      const radius = 0.34 - i * 0.03;
      const pGeo = new THREE.CylinderGeometry(radius, radius, 0.055, 28);
      pGeo.rotateZ(Math.PI / 2);
      const pMat = new THREE.MeshStandardMaterial({
        color: plateColors[i],
        roughness: 0.45,
        metalness: 0.18,
      });
      const leftP = new THREE.Mesh(pGeo, pMat);
      leftP.position.x = -1.24 - i * 0.068;
      leftP.castShadow = true;
      const rightP = new THREE.Mesh(pGeo, pMat);
      rightP.position.x = 1.24 + i * 0.068;
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

    let frameId = 0;
    let unmounted = false;

    const tick = (now: number) => {
      if (unmounted) return;
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Update precision meter needle
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
        setCursorPos(next);
      }

      // Smooth 3D barbell lift kinematics
      barLiftCurrentRef.current = THREE.MathUtils.damp(
        barLiftCurrentRef.current,
        barLiftTargetRef.current,
        12,
        dt
      );
      barTiltRef.current = THREE.MathUtils.damp(barTiltRef.current, 0, 10, dt);
      barbellGroup.position.y = 1.05 + barLiftCurrentRef.current * 0.65;
      barbellGroup.rotation.z = barTiltRef.current;

      // Articulate lifter arms pressing upward with the barbell
      const liftT = barLiftCurrentRef.current;
      lifter.leftArmPivot.rotation.x = -1.25 - liftT * 0.28;
      lifter.rightArmPivot.rotation.x = -1.25 - liftT * 0.28;
      lifter.leftArmPivot.rotation.z = -0.35 + liftT * 0.12;
      lifter.rightArmPivot.rotation.z = 0.35 - liftT * 0.12;
      lifter.leftForearmPivot.rotation.x = -1.15 + liftT * 0.95;
      lifter.rightForearmPivot.rotation.x = -1.15 + liftT * 0.95;

      // Plate visibility by current rep load
      const activePlates = platesCountRef.current;
      platePairs.forEach(([l, r], idx) => {
        const vis = idx < activePlates;
        l.visible = vis;
        r.visible = vis;
      });

      // Subtle camera punch on lift
      camShakeRef.current = THREE.MathUtils.damp(camShakeRef.current, 0, 14, dt);
      camera.position.y = 2.05 + Math.sin(now * 0.04) * camShakeRef.current;
      camera.position.z = 4.4 - barLiftCurrentRef.current * 0.18;

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
  }, [cfg.speedMult]);

  const handleLift = useCallback(() => {
    if (stateRef.current.locked) return;
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
    } else if (dist <= goodHalf) {
      nextCombo += 1;
      const mult = 1 + Math.min(1.5, nextCombo * 0.15);
      points = Math.round(90 * mult * cfg.rewardMult);
      fb = { text: '¡BUENA REPETICIÓN!', tone: 'good' };
      sound.playHit();
      barLiftTargetRef.current = 0.72;
    } else {
      nextCombo = 0;
      points = Math.round(15 * cfg.rewardMult);
      fb = { text: 'FALLO DE RITMO', tone: 'miss' };
      sound.playMiss();
      barLiftTargetRef.current = 0.18;
      barTiltRef.current = pos < 50 ? 0.12 : -0.12;
    }

    const nextScore = stateRef.current.score + points;
    const nextMaxCombo = Math.max(stateRef.current.maxCombo, nextCombo);

    setScore(nextScore);
    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);
    setPerfectHits(nextPerfect);
    setFeedback(fb);

    setTimeout(() => {
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
        <div className="mt-4 flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-2 text-xs font-medium text-orange-200">
          <span>Duelo contra {rivalName}</span>
          <span className="font-mono-tabular font-bold">
            Meta: {rivalTargetScore.toLocaleString('es-ES')} pts · Actual: {score.toLocaleString('es-ES')}
          </span>
        </div>
      )}

      {/* 3D Barbell Viewport */}
      <div
        onClick={handleLift}
        className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black cursor-pointer select-none"
      >
        <div ref={mountRef} className="w-full h-full" />

        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
          <span className="bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded">
            Carga en barra: <strong className="text-white font-mono-tabular">{currentWeightKg} kg</strong>
          </span>
          {combo >= 3 && (
            <span className="bg-orange-500 text-white font-bold px-2.5 py-1 rounded">
              MODO BESTIA
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
            className="absolute top-0 bottom-0 w-2 bg-white rounded-sm shadow-none -translate-x-1/2"
            style={{ left: `${cursorPos}%` }}
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
