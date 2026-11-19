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

interface TunnelVisionGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const GAME_DURATION = 26;

export const TunnelVisionGame: React.FC<TunnelVisionGameProps> = ({
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
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gazePct, setGazePct] = useState(50);
  const [pullSide, setPullSide] = useState<'none' | 'left' | 'right'>('none');
  const [repsDone, setRepsDone] = useState(0);
  const [feedback, setFeedback] = useState('Mira recto al suelo (A / D) y pulsa Espacio para clavar cada curl');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const gazeRef = useRef(0); // -1..1 (safe inside +-0.38)
  const pullSideRef = useRef<'none' | 'left' | 'right'>('none');
  const distractorTimerRef = useRef(1.2);
  const distractorWalkRef = useRef(-3.2);
  const curlTRef = useRef(0);
  const curlPulseRef = useRef(0);
  const bustedCooldownRef = useRef(0);

  const repsRef = useRef(0);
  const timeLeftRef = useRef(GAME_DURATION);
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
      gameId: 'tunnel_vision',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((130 + scoreRef.current * 0.038) * cfg.rewardMult),
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

  const steerGaze = useCallback((dir: -1 | 1) => {
    gazeRef.current = THREE.MathUtils.clamp(gazeRef.current + dir * 0.28, -1, 1);
    sound.playTap();
  }, []);

  const doCurlRep = useCallback(() => {
    if (unmountedRef.current || timeLeftRef.current <= 0) return;
    actionsRef.current += 1;
    curlPulseRef.current = 1.0;

    const absGaze = Math.abs(gazeRef.current);
    if (absGaze <= 0.36 * cfg.windowMult) {
      comboRef.current += 1;
      perfectRef.current += 1;
      repsRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const pts = Math.round((145 + comboRef.current * 18) * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setRepsDone(repsRef.current);
      setFeedback(
        pullSideRef.current === 'none'
          ? `¡CURL LIMPIO! +${pts} pts`
          : `¡MODO MONJE! Ni parpadeaste +${pts} pts`
      );
      sound.playPerfect();
    } else if (absGaze <= 0.62) {
      repsRef.current += 1;
      const pts = Math.round(70 * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setRepsDone(repsRef.current);
      setFeedback('¡Cuidado, casi desvías la vista! +70 pts');
      sound.playHit();
    } else {
      comboRef.current = 0;
      setCombo(0);
      setFeedback('¡PILLADO MIRANDO! Perdiste el combo de concentración');
      sound.playMiss();
    }
  }, [cfg.rewardMult, cfg.windowMult]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
        if (!e.repeat) steerGaze(-1);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
        if (!e.repeat) steerGaze(1);
      } else if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault();
        doCurlRep();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = false;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doCurlRep, steerGaze]);

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
    dressGymScene(scene, { fogNear: 9.5, fogFar: 26 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 42);
    camera.position.set(0, 1.66, computeResponsiveCameraZ(4.2, aspect, 1.05));
    camera.lookAt(0, 1.06, -0.25);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.68 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Athlete + 3D Hex Dumbbells synced to gripped fists
    const athleteRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    athleteRig.root.position.set(0, 0, -0.15);
    scene.add(athleteRig.root);

    const buildDumbbell = () => {
      const g = new THREE.Group();
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.22 });
      const headMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55, metalness: 0.25 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.2 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 12), handleMat);
      shaft.castShadow = true;
      g.add(shaft);
      for (const sgn of [-1, 1]) {
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.075, 6), headMat);
        bell.position.y = sgn * 0.11;
        bell.castShadow = true;
        g.add(bell);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.082, 6), trimMat);
        cap.position.y = sgn * 0.11;
        g.add(cap);
      }
      return g;
    };
    const dbLeft = buildDumbbell();
    const dbRight = buildDumbbell();
    scene.add(dbLeft, dbRight);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0, -0.15);
        rig.poseTunnelCurl(0, 0, 0);
        scene.add(rig.root);
        glbRig = rig;
        athleteRig.root.visible = false;
      },
    });

    // Glamorous gym distractor walking cleanly beside athlete inside camera frame
    const distractor = buildAthleteModel({
      gender: 'female',
      fitnessScore: 92,
      skinTone: '#F1C6A8',
      hairColor: '#3B2314',
      outfit: 'pro',
    });
    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.032, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.72 })
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 0.05;
    distractor.root.add(auraRing);
    distractor.root.visible = false;
    scene.add(distractor.root);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = computeResponsiveCameraZ(4.2, nextAsp, 1.05);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    const tmpPos = new THREE.Vector3();
    const tmpAxis = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);

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

      bustedCooldownRef.current = Math.max(0, bustedCooldownRef.current - dt);
      distractorTimerRef.current -= dt;

      if (pullSideRef.current === 'none' && distractorTimerRef.current <= 0) {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        pullSideRef.current = side;
        setPullSide(side);
        distractorWalkRef.current = -2.35;
        distractor.root.visible = true;
      }

      if (pullSideRef.current !== 'none') {
        distractorWalkRef.current += dt * (1.25 + difficulty * 0.22);
        const dirSign = pullSideRef.current === 'right' ? 1 : -1;
        distractor.root.position.set(dirSign * 0.96, 0, distractorWalkRef.current);
        distractor.root.rotation.y = -dirSign * 0.14;
        const step = distractorWalkRef.current * 4.8;
        distractor.leftLegPivot.rotation.x = Math.sin(step) * 0.42;
        distractor.rightLegPivot.rotation.x = -Math.sin(step) * 0.42;
        distractor.leftArmPivot.rotation.x = -Math.sin(step) * 0.28;
        distractor.rightArmPivot.rotation.x = Math.sin(step) * 0.28;

        // Magnetic temptation pulling gaze toward distractor side!
        const pullForce = (0.72 + difficulty * 0.24) * cfg.speedMult;
        gazeRef.current = THREE.MathUtils.clamp(
          gazeRef.current + dirSign * pullForce * dt,
          -1,
          1
        );

        if (Math.abs(gazeRef.current) >= 0.92 && bustedCooldownRef.current <= 0) {
          bustedCooldownRef.current = 1.1;
          comboRef.current = 0;
          setCombo(0);
          setFeedback('¡Cazado mirando de reojo! Vuelve al centro con A / D');
          sound.playMiss();
        }

        if (distractorWalkRef.current >= 1.15) {
          pullSideRef.current = 'none';
          setPullSide('none');
          distractor.root.visible = false;
          distractorTimerRef.current = Math.max(0.7, 1.7 - difficulty * 0.2);
        }
      }

      // Player steering
      const steerSpd = 1.85;
      if (keysRef.current.left) gazeRef.current -= steerSpd * dt;
      if (keysRef.current.right) gazeRef.current += steerSpd * dt;
      gazeRef.current = THREE.MathUtils.clamp(gazeRef.current, -1, 1);
      if (pullSideRef.current === 'none') {
        gazeRef.current = THREE.MathUtils.damp(gazeRef.current, 0, 2.5, dt);
      }

      setGazePct(Math.round((gazeRef.current + 1) * 50));

      curlPulseRef.current = THREE.MathUtils.damp(curlPulseRef.current, 0, 8, dt);
      curlTRef.current = Math.max(curlPulseRef.current, 0.25 + 0.25 * Math.sin(now * 0.004));

      if (glbRig) {
        glbRig.poseTunnelCurl(curlTRef.current, gazeRef.current, 0);
        glbRig.getGripTransform('left', tmpPos, tmpAxis);
        dbLeft.position.copy(tmpPos);
        dbLeft.quaternion.setFromUnitVectors(yAxis, tmpAxis.lengthSq() > 0.01 ? tmpAxis : xAxis);
        glbRig.getGripTransform('right', tmpPos, tmpAxis);
        dbRight.position.copy(tmpPos);
        dbRight.quaternion.setFromUnitVectors(yAxis, tmpAxis.lengthSq() > 0.01 ? tmpAxis : xAxis);
      } else {
        athleteRig.headGroup.rotation.y = gazeRef.current * 0.7;
        athleteRig.leftForearmPivot.rotation.x = -curlTRef.current * 1.65;
        athleteRig.rightForearmPivot.rotation.x = -curlTRef.current * 1.65;
        athleteRig.root.updateMatrixWorld(true);
        athleteRig.leftForearmPivot.localToWorld(dbLeft.position.set(0, -0.295, 0.005));
        athleteRig.rightForearmPivot.localToWorld(dbRight.position.set(0, -0.295, 0.005));
        dbLeft.rotation.set(0, 0, Math.PI / 2);
        dbRight.rotation.set(0, 0, Math.PI / 2);
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
  }, [aiModel, athlete, cfg.speedMult, difficulty, finishGame]);

  const gazeSafe = Math.abs(gazePct - 50) <= 18;

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Picardía Gym 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Vista de Túnel · No Mires ({repsDone} curls)</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Tiempo</div>
            <div className="font-mono-tabular font-black text-xl text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Combo</div>
            <div className="font-mono-tabular font-black text-xl text-fuchsia-400">x{combo}</div>
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
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/60 mb-1.5">
            <span>Control de Mirada</span>
            <span className={gazeSafe ? 'text-emerald-400 font-bold' : 'text-pink-400 font-bold animate-pulse'}>
              {pullSide === 'none'
                ? 'Sin distracciones'
                : pullSide === 'left'
                ? '← ¡Distracción por la IZQ!'
                : '¡Distracción por la DER! →'}
            </span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[32%] right-[32%] bg-emerald-500/35 border-x border-emerald-400" />
            <div
              className={`absolute top-0 bottom-0 w-3.5 -ml-1.5 rounded-full ${
                gazeSafe ? 'bg-emerald-400' : 'bg-pink-500'
              }`}
              style={{ left: `${Math.max(4, Math.min(96, gazePct))}%` }}
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
          onPointerDown={() => steerGaze(-1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ← Mirar Centro (A)
        </button>
        <button
          type="button"
          onPointerDown={doCurlRep}
          className="col-span-2 py-3.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all"
        >
          ¡Clavar Curl! (Espacio)
        </button>
        <button
          type="button"
          onPointerDown={() => steerGaze(1)}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Mirar Centro (D) →
        </button>
      </div>
    </div>
  );
};
