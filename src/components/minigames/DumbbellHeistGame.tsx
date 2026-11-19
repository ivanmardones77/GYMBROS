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

interface DumbbellHeistGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const TOTAL_HEISTS = 2;

export const DumbbellHeistGame: React.FC<DumbbellHeistGameProps> = ({
  difficulty,
  athlete,
  aiModel = true,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [phase, setPhase] = useState<'approach' | 'return'>('approach');
  const [broLooking, setBroLooking] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [feedback, setFeedback] = useState('El Gym Bro mira el móvil: mantén Espacio para acercarte al rack');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const movingRef = useRef(false);
  const broLookingRef = useRef(false);
  const broTimerRef = useRef(2.2);
  const heistPhaseRef = useRef<'approach' | 'return'>('approach');
  const progressRef = useRef(0); // 0 = bench, 1 = rack
  const walkPhaseRef = useRef(0);
  const bustedCooldownRef = useRef(0);

  const roundRef = useRef(1);
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
      gameId: 'dumbbell_heist',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((150 + scoreRef.current * 0.04) * cfg.rewardMult),
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

  const setMoveHold = useCallback((active: boolean) => {
    if (unmountedRef.current) return;
    movingRef.current = active;
    setIsMoving(active);
    if (active) sound.playTap();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        setMoveHold(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setMoveHold(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setMoveHold]);

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
    camera.position.set(2.55, 1.58, computeResponsiveCameraZ(3.95, aspect, 1.02));
    camera.lookAt(0.15, 0.92, 0.55);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['bench', 'squatRack'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Dumbbell Rack at z = 1.95
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 0, 1.95);
    scene.add(rackGroup);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.25 });
    const rackShelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.72, 0.42), ironMat);
    rackShelf.position.y = 0.36;
    rackShelf.castShadow = true;
    rackGroup.add(rackShelf);

    const buildGoldDumbbell = () => {
      const g = new THREE.Group();
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.85, roughness: 0.22 });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        metalness: 0.65,
        roughness: 0.28,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 12), handleMat);
      shaft.castShadow = true;
      g.add(shaft);
      for (const sgn of [-1, 1]) {
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.08, 6), headMat);
        bell.position.y = sgn * 0.11;
        bell.castShadow = true;
        g.add(bell);
      }
      return g;
    };

    const prizePair = new THREE.Group();
    const rackDbL = buildGoldDumbbell();
    rackDbL.rotation.z = Math.PI / 2;
    rackDbL.position.set(-0.22, 0.79, 0);
    const rackDbR = buildGoldDumbbell();
    rackDbR.rotation.z = Math.PI / 2;
    rackDbR.position.set(0.22, 0.79, 0);
    prizePair.add(rackDbL, rackDbR);
    rackGroup.add(prizePair);

    const heldDbL = buildGoldDumbbell();
    const heldDbR = buildGoldDumbbell();
    heldDbL.visible = false;
    heldDbR.visible = false;
    scene.add(heldDbL, heldDbR);

    // Gym Bro Guard beside rack
    const broRig = buildAthleteModel({
      gender: 'male',
      fitnessScore: 86,
      skinTone: '#D6A17D',
      hairColor: '#111827',
      outfit: 'titan',
    });
    broRig.root.position.set(1.05, 0, 1.75);
    broRig.root.rotation.y = -0.35;
    scene.add(broRig.root);

    const phoneGroup = new THREE.Group();
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.16, 0.014),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 })
    );
    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.072, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phoneScreen.position.z = 0.008;
    phoneGroup.add(phoneBody, phoneScreen);
    scene.add(phoneGroup);

    const thiefRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    thiefRig.root.position.set(0, 0, -1.0);
    scene.add(thiefRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, -1.0);
        rig.poseStealthCarry(0, true, false, 0);
        scene.add(rig.root);
        glbRig = rig;
        thiefRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(3.95, nextAsp, 1.02);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    const tmpPos = new THREE.Vector3();
    const tmpAxis = new THREE.Vector3();
    const tmpPhonePos = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (unmountedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      bustedCooldownRef.current = Math.max(0, bustedCooldownRef.current - dt);
      broTimerRef.current -= dt;
      if (broTimerRef.current <= 0) {
        const nextWatch = !broLookingRef.current;
        broLookingRef.current = nextWatch;
        setBroLooking(nextWatch);
        broTimerRef.current = nextWatch
          ? Math.max(0.8, 1.45 - difficulty * 0.1)
          : Math.max(1.25, 2.35 - difficulty * 0.22);
        if (nextWatch) {
          setFeedback('🚨 ¡LEVANTÓ LA VISTA DEL MÓVIL! ¡QUIETO!');
        } else {
          setFeedback('📱 Mira su móvil otra vez — ¡avanza sigiloso!');
        }
      }

      const looking = broLookingRef.current;
      broRig.root.rotation.y = THREE.MathUtils.damp(broRig.root.rotation.y, looking ? -1.25 : -0.35, 10, dt);
      broRig.headGroup.rotation.x = THREE.MathUtils.damp(broRig.headGroup.rotation.x, looking ? -0.05 : 0.42, 10, dt);
      broRig.headGroup.rotation.y = THREE.MathUtils.damp(broRig.headGroup.rotation.y, looking ? -0.45 : 0, 10, dt);
      broRig.leftArmPivot.rotation.x = THREE.MathUtils.damp(broRig.leftArmPivot.rotation.x, looking ? -0.1 : -0.78, 10, dt);
      broRig.rightArmPivot.rotation.x = THREE.MathUtils.damp(broRig.rightArmPivot.rotation.x, looking ? -0.1 : -0.78, 10, dt);
      broRig.leftForearmPivot.rotation.x = THREE.MathUtils.damp(broRig.leftForearmPivot.rotation.x, looking ? -0.25 : -1.05, 10, dt);
      broRig.rightForearmPivot.rotation.x = THREE.MathUtils.damp(broRig.rightForearmPivot.rotation.x, looking ? -0.25 : -1.05, 10, dt);
      broRig.leftArmPivot.rotation.z = looking ? -0.22 : 0.14;
      broRig.rightArmPivot.rotation.z = looking ? 0.22 : -0.14;

      broRig.root.updateMatrixWorld(true);
      broRig.rightForearmPivot.localToWorld(tmpPhonePos.set(-0.08, -0.30, 0.06));
      phoneGroup.position.copy(tmpPhonePos);
      phoneGroup.rotation.set(-0.55, broRig.root.rotation.y + Math.PI, 0);
      phoneGroup.visible = !looking;

      if (movingRef.current) {
        if (broLookingRef.current && bustedCooldownRef.current <= 0) {
          bustedCooldownRef.current = 0.85;
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          progressRef.current = Math.max(0, heistPhaseRef.current === 'approach' ? progressRef.current - 0.18 : progressRef.current + 0.18);
          setFeedback('😡 "¡Oye, que estoy usando esas mancuernas!" (-progreso)');
          sound.playMiss();
        } else if (!broLookingRef.current) {
          const speed = (0.42 + difficulty * 0.04) * (heistPhaseRef.current === 'return' ? 1.15 : 1.0);
          walkPhaseRef.current += dt * 7.5;
          if (heistPhaseRef.current === 'approach') {
            progressRef.current = Math.min(1, progressRef.current + speed * dt);
            if (progressRef.current >= 1) {
              actionsRef.current += 1;
              comboRef.current += 1;
              perfectRef.current += 1;
              maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
              const pts = Math.round((260 + comboRef.current * 28) * cfg.rewardMult);
              scoreRef.current += pts;
              setScore(scoreRef.current);
              setCombo(comboRef.current);
              heistPhaseRef.current = 'return';
              setPhase('return');
              prizePair.visible = false;
              setFeedback(`💪 ¡MANCUERNAS ROBADAS (+${pts})! ¡Vuelve al banco sin que mire!`);
              sound.playPerfect();
            }
          } else {
            progressRef.current = Math.max(0, progressRef.current - speed * dt);
            if (progressRef.current <= 0) {
              actionsRef.current += 1;
              comboRef.current += 1;
              perfectRef.current += 1;
              maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
              const pts = Math.round((340 + comboRef.current * 36) * cfg.rewardMult);
              scoreRef.current += pts;
              setScore(scoreRef.current);
              setCombo(comboRef.current);
              sound.playCoin();

              if (roundRef.current >= TOTAL_HEISTS) {
                finishGame();
                return;
              }
              roundRef.current += 1;
              setRound(roundRef.current);
              heistPhaseRef.current = 'approach';
              setPhase('approach');
              prizePair.visible = true;
              setFeedback(`¡BOTÍN ASEGURADO (+${pts})! Segundo par de 24 kg listo`);
            }
          }
        }
      }

      setProgressPct(Math.round(progressRef.current * 100));

      const zPos = THREE.MathUtils.lerp(-1.05, 1.45, progressRef.current);
      const facingY = heistPhaseRef.current === 'return' ? Math.PI : 0;
      const hasWeights = heistPhaseRef.current === 'return';

      heldDbL.visible = hasWeights;
      heldDbR.visible = hasWeights;

      if (glbRig) {
        glbRig.root.position.z = zPos;
        glbRig.root.rotation.y = facingY;
        glbRig.poseStealthCarry(walkPhaseRef.current, !hasWeights, hasWeights, 0);
        if (hasWeights) {
          glbRig.getGripTransform('left', tmpPos, tmpAxis);
          heldDbL.position.copy(tmpPos);
          heldDbL.quaternion.setFromUnitVectors(yAxis, tmpAxis.lengthSq() > 0.01 ? tmpAxis : xAxis);
          glbRig.getGripTransform('right', tmpPos, tmpAxis);
          heldDbR.position.copy(tmpPos);
          heldDbR.quaternion.setFromUnitVectors(yAxis, tmpAxis.lengthSq() > 0.01 ? tmpAxis : xAxis);
        }
      } else {
        thiefRig.root.position.z = zPos;
        thiefRig.root.rotation.y = facingY;
        thiefRig.leftLegPivot.rotation.x = Math.sin(walkPhaseRef.current) * 0.45;
        thiefRig.rightLegPivot.rotation.x = -Math.sin(walkPhaseRef.current) * 0.45;
        if (hasWeights) {
          thiefRig.leftArmPivot.rotation.x = -0.35;
          thiefRig.rightArmPivot.rotation.x = -0.35;
          thiefRig.leftForearmPivot.rotation.x = -0.75;
          thiefRig.rightForearmPivot.rotation.x = -0.75;
          thiefRig.root.updateMatrixWorld(true);
          thiefRig.leftForearmPivot.localToWorld(heldDbL.position.set(0, -0.295, 0.005));
          thiefRig.rightForearmPivot.localToWorld(heldDbR.position.set(0, -0.295, 0.005));
          heldDbL.rotation.set(Math.PI / 2, 0, 0);
          heldDbR.rotation.set(Math.PI / 2, 0, 0);
        }
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
  }, [aiModel, athlete, cfg.rewardMult, difficulty, finishGame]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Asalto al Rack de Mancuernas</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Misión</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {round}/{TOTAL_HEISTS}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Sigilo</div>
            <div className="font-mono-tabular font-black text-xl text-amber-400">x{combo}</div>
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,360px)] bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] mb-1.5">
            <span className="text-white/70">
              {phase === 'approach' ? 'Acercándose al Rack' : 'Escape con Mancuernas'}
            </span>
            <span className={broLooking ? 'text-rose-400 font-black animate-pulse' : 'text-emerald-400 font-bold'}>
              {broLooking ? '👀 ¡MIRANDO!' : '📱 MÓVIL (VÍA LIBRE)'}
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                phase === 'return' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${progressPct}%` }}
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
          onPointerDown={() => setMoveHold(true)}
          onPointerUp={() => setMoveHold(false)}
          onPointerLeave={() => setMoveHold(false)}
          className={`w-full py-4 rounded-xl font-display italic font-black uppercase text-xl tracking-wider cursor-pointer transition-all ${
            isMoving
              ? 'bg-amber-400 text-black scale-[0.98]'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          {isMoving
            ? phase === 'approach'
              ? '¡AVANZANDO EN SILENCIO!'
              : '¡ESCAPANDO CON EL BOTÍN!'
            : 'MANTÉN PARA MOVERTE SIGILOSO (Espacio / W)'}
        </button>
      </div>
    </div>
  );
};
