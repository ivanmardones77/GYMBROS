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

interface WallBallGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type TargetIdx = 0 | 1 | 2;
type BallStage = 'ready' | 'flight' | 'catch_window';

const TARGET_X = [-1.05, 0, 1.05] as const;
const TARGET_Y = 2.68;
const TOTAL_THROWS = 10;

export const WallBallGame: React.FC<WallBallGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [throwNum, setThrowNum] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [activeTarget, setActiveTarget] = useState<TargetIdx>(1);
  const [stage, setStage] = useState<BallStage>('ready');
  const [squatChargePct, setSquatChargePct] = useState(0);
  const [feedback, setFeedback] = useState('Carga la sentadilla y lanza con A / S / D hacia la diana iluminada');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<BallStage>('ready');
  const activeTargetRef = useRef<TargetIdx>(1);
  const chosenTargetRef = useRef<TargetIdx>(1);
  const squatPhaseRef = useRef(0);
  const flightTRef = useRef(0);
  const catchProgressRef = useRef(0);
  const throwPowerRef = useRef(1);
  const aimXRef = useRef(0);

  const throwRef = useRef(1);
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
      gameId: 'wall_ball',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((150 + scoreRef.current * 0.042) * cfg.rewardMult),
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

  const pickNextTarget = useCallback(() => {
    const next = Math.floor(Math.random() * 3) as TargetIdx;
    activeTargetRef.current = next;
    setActiveTarget(next);
  }, []);

  const handleLaunch = useCallback(
    (lane: TargetIdx) => {
      if (unmountedRef.current || stageRef.current !== 'ready') return;
      actionsRef.current += 1;
      chosenTargetRef.current = lane;
      aimXRef.current = TARGET_X[lane] * 0.65;

      // Squat cycle sin^2 value gives sweet-spot power between 68..100
      const charge = 0.5 + 0.5 * Math.sin(squatPhaseRef.current);
      const rightTarget = lane === activeTargetRef.current;
      const crispPower = charge >= 0.65;

      throwPowerRef.current = rightTarget ? (crispPower ? 1.35 : 1.0) : 0.45;
      if (rightTarget) {
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (crispPower) perfectRef.current += 1;
        const pts = Math.round((crispPower ? 165 : 105) * cfg.rewardMult + comboRef.current * 14);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(crispPower ? `¡IMPACTO EN LA DIANA! +${pts} pts · ¡Prepárate para atrapar!` : `¡En la diana! +${pts} · Atrápalo al caer`);
        if (crispPower) sound.playPerfect();
        else sound.playHit();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('¡Diana equivocada! Apunta a la diana brillante');
        sound.playMiss();
      }

      stageRef.current = 'flight';
      setStage('flight');
      flightTRef.current = 0;
      sound.playJump();
    },
    [cfg.rewardMult]
  );

  const handleCatch = useCallback(() => {
    if (unmountedRef.current || stageRef.current !== 'catch_window') return;
    actionsRef.current += 1;
    const dist = Math.abs(catchProgressRef.current - 0.72);
    const caught = dist < 0.24 * cfg.windowMult;

    if (caught) {
      comboRef.current += 1;
      perfectRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const pts = Math.round((110 + comboRef.current * 12) * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setFeedback(`¡RECEPCIÓN LIMPIA! +${pts} pts`);
      sound.playComboHit(comboRef.current);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setFeedback('¡Recepción tardía! Pierdes el impulso');
      sound.playMiss();
    }

    if (throwRef.current >= TOTAL_THROWS) {
      finishGame();
    } else {
      throwRef.current += 1;
      setThrowNum(throwRef.current);
      stageRef.current = 'ready';
      setStage('ready');
      pickNextTarget();
    }
  }, [cfg.rewardMult, cfg.windowMult, finishGame, pickNextTarget]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleLaunch(0);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleLaunch(1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleLaunch(2);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (stageRef.current === 'catch_window') handleCatch();
        else if (stageRef.current === 'ready') handleLaunch(activeTargetRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCatch, handleLaunch]);

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
    dressGymScene(scene, { fogNear: 9, fogFar: 25 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 45);
    camera.position.set(1.95, 1.85, -computeResponsiveCameraZ(3.6, aspect, 1.0));
    camera.lookAt(0, 1.55, 0.9);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Target Wall + 3 Circular Wall-Ball Targets
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 4.2, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.85 })
    );
    wall.position.set(0, 2.1, 1.45);
    wall.receiveShadow = true;
    scene.add(wall);

    const targetMats: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const ringGroup = new THREE.Group();
      ringGroup.position.set(TARGET_X[i], TARGET_Y, 1.31);
      const tMat = new THREE.MeshStandardMaterial({
        color: 0x3f3f46,
        emissive: 0xff5a1f,
        emissiveIntensity: 0.15,
        roughness: 0.35,
      });
      targetMats.push(tMat);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), tMat);
      disc.rotation.x = Math.PI / 2;
      ringGroup.add(disc);
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      center.rotation.x = Math.PI / 2;
      ringGroup.add(center);
      scene.add(ringGroup);
    }

    // 9kg Medicine Ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 24, 20),
      new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        emissive: 0xff5a1f,
        emissiveIntensity: 0.18,
        roughness: 0.55,
      })
    );
    ball.castShadow = true;
    scene.add(ball);

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0, -0.35);
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
        rig.root.position.set(0, 0, -0.35);
        rig.poseWallBall(0.3, 0, 0, 0);
        scene.add(rig.root);
        glbRig = rig;
        athleteRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = -computeResponsiveCameraZ(3.6, nextAsp, 1.0);
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

      // Update glowing target highlight
      targetMats.forEach((m, idx) => {
        const isOn = idx === activeTargetRef.current;
        m.color.setHex(isOn ? 0xff5a1f : 0x27272a);
        m.emissiveIntensity = isOn ? 0.85 : 0.08;
      });

      let squatT = 0.4;
      let throwT = 0;

      if (stageRef.current === 'ready') {
        squatPhaseRef.current += dt * (2.6 + difficulty * 0.55) * cfg.speedMult;
        const charge = 0.5 + 0.5 * Math.sin(squatPhaseRef.current);
        setSquatChargePct(Math.round(charge * 100));
        squatT = 1 - charge * 0.72;
        ball.position.set(0, THREE.MathUtils.lerp(1.05, 1.38, charge), -0.05);
      } else if (stageRef.current === 'flight') {
        flightTRef.current += dt * (1.8 + difficulty * 0.2);
        const f = Math.min(1, flightTRef.current);
        throwT = Math.max(0, 1 - f * 2.2);
        squatT = 0.1;
        const tx = TARGET_X[chosenTargetRef.current];
        const arcY = Math.sin(f * Math.PI) * 0.45;
        ball.position.set(
          THREE.MathUtils.lerp(0, tx, f),
          THREE.MathUtils.lerp(1.45, TARGET_Y, f) + arcY,
          THREE.MathUtils.lerp(-0.05, 1.15, f)
        );
        if (f >= 1) {
          stageRef.current = 'catch_window';
          setStage('catch_window');
          catchProgressRef.current = 0;
        }
      } else if (stageRef.current === 'catch_window') {
        catchProgressRef.current += dt * (1.25 + difficulty * 0.18) * cfg.speedMult;
        const c = Math.min(1, catchProgressRef.current);
        const tx = TARGET_X[chosenTargetRef.current];
        squatT = Math.max(0.25, c * 0.7);
        throwT = 0.55 * (1 - c);
        ball.position.set(
          THREE.MathUtils.lerp(tx, 0, c),
          THREE.MathUtils.lerp(TARGET_Y, 1.05, c) + Math.sin(c * Math.PI) * 0.25,
          THREE.MathUtils.lerp(1.15, -0.05, c)
        );
        if (c >= 1) {
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          setFeedback('¡Balón al suelo! Atrápalo con Espacio al bajar');
          sound.playMiss();
          if (throwRef.current >= TOTAL_THROWS) {
            finishGame();
            return;
          }
          throwRef.current += 1;
          setThrowNum(throwRef.current);
          stageRef.current = 'ready';
          setStage('ready');
          pickNextTarget();
        }
      }

      aimXRef.current = THREE.MathUtils.damp(aimXRef.current, 0, 6, dt);

      if (glbRig) {
        glbRig.poseWallBall(squatT, throwT, aimXRef.current, 0);
      } else {
        athleteRig.leftLegPivot.rotation.x = -squatT * 0.85;
        athleteRig.rightLegPivot.rotation.x = -squatT * 0.85;
        athleteRig.leftKneePivot.rotation.x = squatT * 1.45;
        athleteRig.rightKneePivot.rotation.x = squatT * 1.45;
        athleteRig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.9, -2.5, throwT);
        athleteRig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.9, -2.5, throwT);
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
  }, [aiModel, athlete, cfg.speedMult, difficulty, finishGame, pickNextTarget]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Agilidad 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Balón Medicinal a la Diana (9 kg)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Lanzam.</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {throwNum}/{TOTAL_THROWS}
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,340px)] bg-black/75 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
            <span>{stage === 'catch_window' ? '¡Atrapa el balón!' : 'Impulso de Sentadilla'}</span>
            <span className="text-orange-400 font-bold">
              Diana: {activeTarget === 0 ? 'IZQ' : activeTarget === 1 ? 'CENTRO' : 'DER'}
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                squatChargePct >= 65 ? 'bg-emerald-400' : 'bg-orange-500'
              }`}
              style={{ width: `${stage === 'catch_window' ? 100 : squatChargePct}%` }}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => handleLaunch(0)}
          className={`py-3.5 rounded-xl font-display italic font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeTarget === 0 && stage === 'ready'
              ? 'bg-orange-500 text-white border-orange-300'
              : 'bg-white/[0.08] text-white/80 border-white/10'
          }`}
        >
          Diana Izq (A)
        </button>
        <button
          type="button"
          onPointerDown={() => handleLaunch(1)}
          className={`py-3.5 rounded-xl font-display italic font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeTarget === 1 && stage === 'ready'
              ? 'bg-orange-500 text-white border-orange-300'
              : 'bg-white/[0.08] text-white/80 border-white/10'
          }`}
        >
          Centro (S)
        </button>
        <button
          type="button"
          onPointerDown={() => handleLaunch(2)}
          className={`py-3.5 rounded-xl font-display italic font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border ${
            activeTarget === 2 && stage === 'ready'
              ? 'bg-orange-500 text-white border-orange-300'
              : 'bg-white/[0.08] text-white/80 border-white/10'
          }`}
        >
          Diana Der (D)
        </button>
        <button
          type="button"
          onPointerDown={handleCatch}
          className={`py-3.5 rounded-xl font-display italic font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all ${
            stage === 'catch_window'
              ? 'bg-emerald-400 text-black shadow-[0_0_24px_rgba(52,211,153,0.75)]'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
          }`}
        >
          ¡Atrapar! (Espacio)
        </button>
      </div>
    </div>
  );
};
