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

interface TireFlipGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_FLIPS = 6;

export const TireFlipGame: React.FC<TireFlipGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [flipIndex, setFlipIndex] = useState(1);
  const [stage, setStage] = useState<'catch' | 'drive' | 'flipped'>('catch');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [catchGauge, setCatchGauge] = useState(0);
  const [drivePct, setDrivePct] = useState(0);
  const [feedback, setFeedback] = useState('Pulsa Espacio en la zona verde para enganchar bajo el neumático');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<'catch' | 'drive' | 'flipped'>('catch');
  const flipRef = useRef(1);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const unmountedRef = useRef(false);

  const catchPhaseRef = useRef(0);
  const catchBonusRef = useRef(1.0);
  const driveProgressRef = useRef(0);
  const driveTimerRef = useRef(0);
  const tireAngleRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const finishGame = useCallback(() => {
    if (unmountedRef.current) return;
    unmountedRef.current = true;
    onComplete({
      gameId: 'tire_flip',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((160 + scoreRef.current * 0.042) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const nextFlip = useCallback(
    (won: boolean, pts: number, msg: string) => {
      stageRef.current = 'flipped';
      setStage('flipped');
      setFeedback(msg);
      if (won) {
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playPerfect();
      } else {
        comboRef.current = 0;
        setCombo(0);
        sound.playMiss();
      }

      if (flipRef.current >= TOTAL_FLIPS) {
        timeoutRef.current = window.setTimeout(finishGame, 580);
      } else {
        timeoutRef.current = window.setTimeout(() => {
          if (unmountedRef.current) return;
          flipRef.current += 1;
          setFlipIndex(flipRef.current);
          driveProgressRef.current = 0;
          tireAngleRef.current = 0;
          setDrivePct(0);
          stageRef.current = 'catch';
          setStage('catch');
          setFeedback('¡Nuevo neumático de 220 kg! Engancha en la zona verde');
        }, 620);
      }
    },
    [finishGame]
  );

  const handleAction = useCallback(() => {
    if (unmountedRef.current || stageRef.current === 'flipped') return;
    actionsRef.current += 1;

    if (stageRef.current === 'catch') {
      const pos = (Math.sin(catchPhaseRef.current) + 1) * 50;
      const dist = Math.abs(pos - 50);
      const isPerf = dist < 14 * cfg.windowMult;
      catchBonusRef.current = isPerf ? 1.45 : dist < 28 ? 1.15 : 0.85;
      if (isPerf) {
        perfectRef.current += 1;
        comboRef.current += 1;
      } else if (dist >= 28) {
        comboRef.current = 0;
      }
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      setCombo(comboRef.current);

      stageRef.current = 'drive';
      setStage('drive');
      driveProgressRef.current = 0.08;
      driveTimerRef.current = 3.2 - difficulty * 0.22;
      setFeedback(isPerf ? '¡AGARRE PERFECTO! ¡RÁFAGA DE EMPUJE AHORA!' : '¡Agarrado! ¡Pulsa rápido para volcarlo!');
      sound.playTap();
      return;
    }

    if (stageRef.current === 'drive') {
      const impulse = (0.145 - difficulty * 0.01) * (catchBonusRef.current > 1.2 ? 1.15 : 1.0);
      driveProgressRef.current = Math.min(1, driveProgressRef.current + impulse);
      setDrivePct(Math.round(driveProgressRef.current * 100));
      sound.playTap();

      if (driveProgressRef.current >= 1) {
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        setCombo(comboRef.current);
        const pts = Math.round((270 + comboRef.current * 30) * cfg.rewardMult * catchBonusRef.current);
        nextFlip(true, pts, `¡NEUMÁTICO VOLCADO! +${pts} pts`);
      }
    }
  }, [cfg.rewardMult, cfg.windowMult, difficulty, nextFlip]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) handleAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAction]);

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
    dressGymScene(scene, { fogNear: 8, fogFar: 22 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 40);
    camera.position.set(2.15, 1.45, computeResponsiveCameraZ(3.8, aspect, 1.0));
    camera.lookAt(0, 0.72, 0.45);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const turf = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.03, 7),
      new THREE.MeshStandardMaterial({ color: 0x123026, roughness: 0.92 })
    );
    turf.position.set(0, 0.015, 0.4);
    turf.receiveShadow = true;
    scene.add(turf);

    // Giant 220kg Strongman Tractor Tire pivoting around its front contact edge
    const tirePivot = new THREE.Group();
    tirePivot.position.set(0, 0.03, 0.98);
    scene.add(tirePivot);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.78, metalness: 0.08 });
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.9 });
    const tireBody = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.19, 18, 36), tireMat);
    tireBody.rotation.x = Math.PI / 2;
    tireBody.position.set(0, 0.2, -0.46);
    tireBody.castShadow = true;
    tirePivot.add(tireBody);

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.07), treadMat);
      lug.position.set(Math.cos(a) * 0.63, 0.2, -0.46 + Math.sin(a) * 0.63);
      lug.rotation.y = -a;
      tirePivot.add(lug);
    }

    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0.03, -0.44);
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
        rig.root.position.set(0, 0.03, -0.44);
        rig.poseTireFlip(0, 0.03, 0);
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
      camera.position.z = computeResponsiveCameraZ(3.8, nextAsp, 1.0);
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

      if (stageRef.current === 'catch') {
        catchPhaseRef.current += dt * (2.6 + difficulty * 0.65);
        setCatchGauge(Math.round((Math.sin(catchPhaseRef.current) + 1) * 50));
      } else if (stageRef.current === 'drive') {
        driveProgressRef.current = Math.max(0.03, driveProgressRef.current - dt * (0.24 + difficulty * 0.05));
        driveTimerRef.current -= dt;
        setDrivePct(Math.round(driveProgressRef.current * 100));
        if (driveTimerRef.current <= 0) {
          nextFlip(false, 0, '¡El neumático volvió a caer! Más ráfaga en el empuje');
        }
      }

      const targetTireAngle =
        stageRef.current === 'flipped' ? Math.PI : driveProgressRef.current * Math.PI * 0.56;
      tireAngleRef.current = THREE.MathUtils.damp(tireAngleRef.current, targetTireAngle, 12, dt);
      tirePivot.rotation.x = tireAngleRef.current;

      const stageT = stageRef.current === 'catch' ? 0.05 : Math.min(1, driveProgressRef.current * 1.15);
      if (glbRig) {
        glbRig.poseTireFlip(stageT, 0.03, tireAngleRef.current);
      } else {
        athleteRig.upperBody.rotation.x = THREE.MathUtils.lerp(0.75, 0.25, stageT);
        athleteRig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.9, -1.5, stageT);
        athleteRig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.9, -1.5, stageT);
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
  }, [aiModel, athlete, difficulty, nextFlip]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Strongman 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Volteo de Neumático (220 kg)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Volteos</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {flipIndex}/{TOTAL_FLIPS}
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
          {stage === 'catch' ? (
            <>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
                <span>Punto de Agarre</span>
                <span className="text-emerald-400 font-bold">Zona Central</span>
              </div>
              <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-[36%] right-[36%] bg-emerald-500/40 border-x border-emerald-400" />
                <div
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-white"
                  style={{ left: `${catchGauge}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
                <span>Ráfaga de Volteo</span>
                <span className="text-orange-400 font-bold">{drivePct}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-75"
                  style={{ width: `${drivePct}%` }}
                />
              </div>
            </>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08]">
        <button
          type="button"
          onPointerDown={handleAction}
          className={`w-full py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer active:scale-[0.98] transition-all ${
            stage === 'catch'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          {stage === 'catch'
            ? '¡ENGANCHAR NEUMÁTICO! (Espacio)'
            : '¡EMPUJAR RÁPIDO! (Espacio / A / D)'}
        </button>
      </div>
    </div>
  );
};
