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

interface RowingGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const GAME_DURATION = 26;

export const RowingGame: React.FC<RowingGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [meters, setMeters] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [strokePct, setStrokePct] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState<'catch' | 'drive' | 'recovery'>('catch');
  const [isHolding, setIsHolding] = useState(false);
  const [feedback, setFeedback] = useState('Mantén Espacio para remar hasta la zona verde y suelta para recuperar');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const holdingRef = useRef(false);
  const strokeRef = useRef(0); // 0 = catch, 1 = finish
  const strokeDirRef = useRef<'drive' | 'recovery'>('drive');
  const peakDriveRef = useRef(0);

  const timeLeftRef = useRef(GAME_DURATION);
  const metersRef = useRef(0);
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
      gameId: 'rowing',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((145 + scoreRef.current * 0.042) * cfg.rewardMult),
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

  const setDriveHold = useCallback((active: boolean) => {
    if (unmountedRef.current || timeLeftRef.current <= 0) return;

    if (active && !holdingRef.current) {
      holdingRef.current = true;
      setIsHolding(true);
      if (strokeDirRef.current === 'recovery' && strokeRef.current > 0.25) {
        // Pulled before sliding all the way back to the catch
        comboRef.current = 0;
        setCombo(0);
        setFeedback('¡Tirón anticipado! Deja deslizar el carro hasta atrás (<20%)');
        sound.playMiss();
      }
      strokeDirRef.current = 'drive';
      setPhaseLabel('drive');
    } else if (!active && holdingRef.current) {
      holdingRef.current = false;
      setIsHolding(false);
      actionsRef.current += 1;
      const peak = peakDriveRef.current;

      if (peak >= 0.72 && peak <= 0.96) {
        comboRef.current += 1;
        perfectRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        const addM = Math.round(14 + comboRef.current * 1.5);
        const pts = Math.round((140 + comboRef.current * 18) * cfg.rewardMult);
        metersRef.current += addM;
        scoreRef.current += pts;
        setMeters(metersRef.current);
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setFeedback(`¡PALADA POTENTE (+${addM}m)! Recupera suave hasta la base`);
        sound.playPerfect();
      } else if (peak >= 0.5) {
        const addM = 9;
        const pts = Math.round(80 * cfg.rewardMult);
        metersRef.current += addM;
        scoreRef.current += pts;
        setMeters(metersRef.current);
        setScore(scoreRef.current);
        setFeedback(`¡Buena palada! (+${addM}m) Apunta entre 72% y 95%`);
        sound.playHit();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('Palada demasiado corta — mantén más tiempo');
        sound.playMiss();
      }
      peakDriveRef.current = 0;
      strokeDirRef.current = 'recovery';
      setPhaseLabel('recovery');
    }
  }, [cfg.rewardMult]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') && !e.repeat) {
        e.preventDefault();
        setDriveHold(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') {
        setDriveHold(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setDriveHold]);

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
    camera.position.set(2.35, 1.38, computeResponsiveCameraZ(3.15, aspect, 1.0));
    camera.lookAt(0, 0.65, 0.15);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.68 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 3D Concept2-style Indoor Rowing Ergometer
    const ergGroup = new THREE.Group();
    scene.add(ergGroup);

    const railMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.22 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55, metalness: 0.3 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.2 });

    const monorail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 2.2), railMat);
    monorail.position.set(0, 0.34, -0.05);
    monorail.castShadow = true;
    ergGroup.add(monorail);

    const rearLeg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.08), darkMat);
    rearLeg.position.set(0, 0.17, -1.05);
    ergGroup.add(rearLeg);

    const frontStand = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.12), darkMat);
    frontStand.position.set(0, 0.29, 0.92);
    ergGroup.add(frontStand);

    const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24), darkMat);
    flywheel.rotation.z = Math.PI / 2;
    flywheel.position.set(0, 0.44, 0.96);
    flywheel.castShadow = true;
    ergGroup.add(flywheel);

    const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 10, 24), orangeMat);
    fanRing.rotation.y = Math.PI / 2;
    fanRing.position.set(0.1, 0.44, 0.96);
    ergGroup.add(fanRing);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.28), darkMat);
    seat.position.set(0, 0.41, 0);
    seat.castShadow = true;
    ergGroup.add(seat);

    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 12), orangeMat);
    handleBar.rotation.z = Math.PI / 2;
    ergGroup.add(handleBar);

    const rowerRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    rowerRig.root.position.set(0, 0.02, 0);
    scene.add(rowerRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, 0);
        rig.poseRowing(0, 0.42);
        scene.add(rig.root);
        glbRig = rig;
        rowerRig.root.visible = false;
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

      timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
      setTimeLeft(Math.ceil(timeLeftRef.current));
      if (timeLeftRef.current <= 0) {
        finishGame();
        return;
      }

      if (holdingRef.current) {
        strokeRef.current = Math.min(1, strokeRef.current + dt * (1.35 + difficulty * 0.16) * cfg.speedMult);
        peakDriveRef.current = Math.max(peakDriveRef.current, strokeRef.current);
        flywheel.rotation.x += dt * 16;
        if (strokeRef.current >= 1) {
          // Overpulled beyond 96%
          setDriveHold(false);
        }
      } else {
        strokeRef.current = Math.max(0, strokeRef.current - dt * (0.95 + difficulty * 0.1));
        flywheel.rotation.x += dt * 4;
        if (strokeRef.current <= 0.08) {
          setPhaseLabel('catch');
        }
      }

      setStrokePct(Math.round(strokeRef.current * 100));

      const seatZ = THREE.MathUtils.lerp(0.18, -0.58, strokeRef.current);
      seat.position.z = seatZ;
      handleBar.position.set(0, THREE.MathUtils.lerp(0.76, 0.84, strokeRef.current), THREE.MathUtils.lerp(0.55, -0.15, strokeRef.current));

      if (glbRig) {
        glbRig.root.position.z = seatZ;
        glbRig.poseRowing(strokeRef.current, 0.42);
      } else {
        rowerRig.root.position.z = seatZ;
        rowerRig.pelvisGroup.position.y = 0.44;
        rowerRig.upperBody.rotation.x = THREE.MathUtils.lerp(0.35, -0.25, strokeRef.current);
        rowerRig.leftLegPivot.rotation.x = -1.25 + strokeRef.current * 0.85;
        rowerRig.rightLegPivot.rotation.x = -1.25 + strokeRef.current * 0.85;
        rowerRig.leftKneePivot.rotation.x = 1.65 - strokeRef.current * 1.4;
        rowerRig.rightKneePivot.rotation.x = 1.65 - strokeRef.current * 1.4;
        rowerRig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-1.1, -0.3, strokeRef.current);
        rowerRig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-1.1, -0.3, strokeRef.current);
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
  }, [aiModel, athlete, cfg.speedMult, difficulty, finishGame, setDriveHold]);

  const inSweetSpot = strokePct >= 72 && strokePct <= 95;

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Cardio 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Remo Indoor Olímpico ({meters}m)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
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
            <span>
              {phaseLabel === 'catch'
                ? 'Listo (Base)'
                : phaseLabel === 'drive'
                ? 'Tirón (Drive)'
                : 'Recuperación'}
            </span>
            <span className={inSweetSpot ? 'text-emerald-400 font-bold' : 'text-orange-400 font-bold'}>
              {strokePct}% · Zona 72–95%
            </span>
          </div>
          <div className="relative h-3.5 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[72%] right-[5%] bg-emerald-500/35 border-x border-emerald-400" />
            <div
              className={`h-full transition-all duration-75 ${
                inSweetSpot ? 'bg-emerald-400' : 'bg-orange-500'
              }`}
              style={{ width: `${strokePct}%` }}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08]">
        <button
          type="button"
          onPointerDown={() => setDriveHold(true)}
          onPointerUp={() => setDriveHold(false)}
          onPointerLeave={() => setDriveHold(false)}
          className={`w-full py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer transition-all ${
            isHolding
              ? 'bg-emerald-400 text-black scale-[0.98]'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          {isHolding ? '¡SUELTA EN LA ZONA VERDE!' : 'MANTÉN PARA REMAR (Espacio / ↓)'}
        </button>
      </div>
    </div>
  );
};
