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

interface TreadmillSprintGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

interface Obstacle3D {
  id: number;
  z: number; // -14 approaching to +3
  cleared: boolean;
  hit: boolean;
  mesh: THREE.Group;
}

const DURATION_SEC = 25;

export const TreadmillSprintGame: React.FC<TreadmillSprintGameProps> = ({
  difficulty,
  athlete,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [speed, setSpeed] = useState(8);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [nextFoot, setNextFoot] = useState<'L' | 'R'>('L');
  const [statusMsg, setStatusMsg] = useState('¡Alterna Izquierda y Derecha para acelerar!');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const speedRef = useRef(8);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const nextFootRef = useRef<'L' | 'R'>('L');
  const jumpHeightRef = useRef(0);
  const jumpVelRef = useRef(0);
  const isJumpingRef = useRef(false);
  const stridePhaseRef = useRef(0);
  const timeRef = useRef(DURATION_SEC);
  const completedRef = useRef(false);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'sprint',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((150 + scoreRef.current * 0.045) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

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
    dressGymScene(scene, { fogNear: 7, fogFar: 18, wallDistance: 12, cone: false });
    addGymDecor(scene, ['squatRack', 'dumbbells'], { focus: { x: 0, z: 0 }, depth: 4.5 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 40);
    camera.position.set(1.85, 1.8, 3.6);
    camera.lookAt(0, 0.85, -1.5);

    createThreePointLights(scene, 7);

    // Gym Floor & Treadmill Belt Deck
    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 28),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const trackDeck = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.08, 18),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.72, metalness: 0.12 })
    );
    trackDeck.position.set(0, 0.04, -5);
    trackDeck.receiveShadow = true;
    scene.add(trackDeck);

    // Side metallic rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.3, metalness: 0.75 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 18), railMat);
    leftRail.position.set(-0.92, 0.08, -5);
    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 18), railMat);
    rightRail.position.set(0.92, 0.08, -5);
    scene.add(leftRail, rightRail);

    // Moving track belt stripes
    const beltStripes: THREE.Mesh[] = [];
    const stripeGeo = new THREE.BoxGeometry(1.45, 0.015, 0.18);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(stripeGeo, stripeMat);
      m.position.set(0, 0.085, 2 - i * 1.5);
      scene.add(m);
      beltStripes.push(m);
    }

    // 3D Sculpted Runner Athlete facing -Z
    const runner = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 68,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'runner',
    });
    runner.root.rotation.y = Math.PI; // Run away from camera down the track
    runner.root.position.set(0, 0.09, 0.8);
    scene.add(runner.root);

    // Obstacle factory (3D Traffic Cone Hurdle)
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.35, metalness: 0.1 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const createConeObstacle = () => {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.45), coneMat);
      base.position.y = 0.03;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.56, 16), coneMat);
      cone.position.y = 0.32;
      cone.castShadow = true;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 0.14, 16), whiteMat);
      collar.position.y = 0.32;
      grp.add(base, cone, collar);
      return grp;
    };

    const obstacles: Obstacle3D[] = [];
    let nextObId = 1;
    let nextSpawnTimer = 1.4;

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
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      timeRef.current = Math.max(0, timeRef.current - dt);
      setTimeLeft(Math.ceil(timeRef.current));

      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      // Natural speed decay
      speedRef.current = Math.max(4.5, speedRef.current - dt * (3.1 * cfg.speedMult * 0.85));
      setSpeed(Number(speedRef.current.toFixed(1)));

      if (speedRef.current > 10) {
        scoreRef.current += Math.round(speedRef.current * dt * 3.5 * cfg.rewardMult);
        setScore(scoreRef.current);
      }

      // Belt & Runner Kinematics
      const worldSpeed = (2.8 + speedRef.current * 0.38) * cfg.speedMult;
      for (const s of beltStripes) {
        s.position.z += worldSpeed * dt;
        if (s.position.z > 3.5) s.position.z -= 18;
      }

      // Jump Physics
      if (isJumpingRef.current || jumpHeightRef.current > 0) {
        jumpVelRef.current -= 19.5 * dt;
        jumpHeightRef.current += jumpVelRef.current * dt;
        if (jumpHeightRef.current <= 0) {
          jumpHeightRef.current = 0;
          jumpVelRef.current = 0;
          isJumpingRef.current = false;
        }
      }

      stridePhaseRef.current += dt * (4 + speedRef.current * 0.65);
      const swing = isJumpingRef.current ? 0.55 : Math.sin(stridePhaseRef.current) * 0.72;
      runner.root.position.y = 0.09 + jumpHeightRef.current;
      runner.leftLegPivot.rotation.x = swing;
      runner.rightLegPivot.rotation.x = -swing;
      runner.leftKneePivot.rotation.x = isJumpingRef.current
        ? 0.95
        : Math.max(0.05, -swing * 0.85);
      runner.rightKneePivot.rotation.x = isJumpingRef.current
        ? 0.95
        : Math.max(0.05, swing * 0.85);
      runner.leftArmPivot.rotation.x = -swing * 0.85;
      runner.rightArmPivot.rotation.x = swing * 0.85;
      runner.leftForearmPivot.rotation.x = -0.95;
      runner.rightForearmPivot.rotation.x = -0.95;
      runner.upperBody.rotation.x = 0.14 + Math.min(0.18, speedRef.current * 0.008);
      if (runner.ponytailGroup) {
        runner.ponytailGroup.rotation.x = 0.18 + Math.abs(Math.sin(stridePhaseRef.current)) * 0.25;
      }
      runner.shadowMesh.scale.setScalar(Math.max(0.45, 1 - jumpHeightRef.current * 0.5));

      // Dynamic FOV widening with speed
      const targetFov = 44 + (speedRef.current - 6) * 0.55;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
      camera.updateProjectionMatrix();

      // Spawn & move 3D hurdles
      nextSpawnTimer -= dt;
      if (nextSpawnTimer <= 0) {
        const mesh = createConeObstacle();
        mesh.position.set(0, 0.09, -15);
        scene.add(mesh);
        obstacles.push({ id: nextObId++, z: -15, cleared: false, hit: false, mesh });
        const minGap = Math.max(1.2, 2.35 / cfg.speedMult);
        nextSpawnTimer = minGap + Math.random() * 0.9;
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        ob.z += worldSpeed * dt;
        ob.mesh.position.z = ob.z;

        // Collision check around runner z = 0.8
        if (!ob.cleared && !ob.hit && ob.z >= 0.45 && ob.z <= 1.15) {
          if (jumpHeightRef.current > 0.35) {
            ob.cleared = true;
            comboRef.current += 2;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            perfectRef.current += 1;
            const bonus = Math.round(140 * cfg.rewardMult);
            scoreRef.current += bonus;
            setCombo(comboRef.current);
            setScore(scoreRef.current);
            setStatusMsg(`¡Salto limpio! +${bonus} pts`);
            sound.playPerfect();
          } else {
            ob.hit = true;
            ob.mesh.rotation.x = 1.2;
            comboRef.current = 0;
            speedRef.current = Math.max(5, speedRef.current * 0.55);
            setCombo(0);
            setStatusMsg('¡Tropiezo! Salta con Espacio o W');
            sound.playMiss();
          }
        }

        if (ob.z > 3.5) {
          scene.remove(ob.mesh);
          obstacles.splice(i, 1);
        }
      }

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
  }, [cfg.rewardMult, cfg.speedMult, finishGame]);

  const handleStride = useCallback(
    (foot: 'L' | 'R') => {
      if (completedRef.current) return;
      actionsRef.current += 1;

      if (foot === nextFootRef.current) {
        nextFootRef.current = foot === 'L' ? 'R' : 'L';
        setNextFoot(nextFootRef.current);
        speedRef.current = Math.min(25, speedRef.current + 1.85);
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const pts = Math.round((18 + comboRef.current * 1.5) * cfg.rewardMult);
        scoreRef.current += pts;
        setCombo(comboRef.current);
        setScore(scoreRef.current);
        sound.playStep(foot === 'L');
      } else {
        speedRef.current = Math.max(6, speedRef.current - 1.1);
        comboRef.current = Math.max(0, comboRef.current - 1);
        setCombo(comboRef.current);
        sound.playTap();
      }
    },
    [cfg.rewardMult]
  );

  const handleJump = useCallback(() => {
    if (isJumpingRef.current || jumpHeightRef.current > 0.05 || completedRef.current) return;
    isJumpingRef.current = true;
    jumpVelRef.current = 7.4;
    sound.playJump();
    actionsRef.current += 1;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStride('L');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleStride('R');
      } else if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleJump, handleStride]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Cardio 3D · {cfg.label}</p>
          <h2 className="text-[2.6rem] text-white mt-1">Sprint HIIT en Cinta</h2>
        </div>
        <div className="flex items-center gap-7">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Tiempo</div>
            <div className="font-display font-bold text-[2.1rem] leading-none tabular-nums mt-1 text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Velocidad</div>
            <div className="font-display font-bold text-[2.1rem] leading-none tabular-nums mt-1 text-orange-500">{speed.toFixed(1)} km/h</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Puntos</div>
            <div className="font-display font-bold text-[2.1rem] leading-none tabular-nums mt-1 text-emerald-400">
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

      {/* 3D Treadmill Track Viewport */}
      <div className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage bg-black rounded-2xl overflow-hidden select-none">
        <div ref={mountRef} className="w-full h-full" />
        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
          <span className="bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded">{statusMsg}</span>
          <span className="bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded font-mono-tabular text-amber-400 font-bold">
            Combo x{combo}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <button
          onClick={() => handleStride('L')}
          className={`py-4 rounded-xl font-display uppercase tracking-wider font-bold text-base border transition-all cursor-pointer select-none ${
            nextFoot === 'L'
              ? 'bg-orange-500 text-white border-orange-600 shadow-none scale-[1.01]'
              : 'bg-white/[0.03] text-white/75 border-white/10 hover:bg-white/10'
          }`}
        >
          Pie Izquierdo (A / ←)
        </button>

        <button
          onClick={handleJump}
          className="py-4 rounded-xl font-display uppercase tracking-wider font-bold text-base bg-white hover:bg-white/85 active:scale-[0.98] text-black transition-all cursor-pointer select-none"
        >
          Saltar Obstáculo (Espacio)
        </button>

        <button
          onClick={() => handleStride('R')}
          className={`py-4 rounded-xl font-display uppercase tracking-wider font-bold text-base border transition-all cursor-pointer select-none ${
            nextFoot === 'R'
              ? 'bg-orange-500 text-white border-orange-600 shadow-none scale-[1.01]'
              : 'bg-white/[0.03] text-white/75 border-white/10 hover:bg-white/10'
          }`}
        >
          Pie Derecho (D / →)
        </button>
      </div>
    </div>
  );
};
