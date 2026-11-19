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

interface DodgeCounterGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

type AttackDir = 'left' | 'right' | 'high';
type Phase = 'idle' | 'telegraph' | 'counter' | 'recover';

const TOTAL_ROUNDS = 12;

export const DodgeCounterGame: React.FC<DodgeCounterGameProps> = ({
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
  const [phase, setPhase] = useState<Phase>('idle');
  const [attackDir, setAttackDir] = useState<AttackDir | null>(null);
  const [alertPct, setAlertPct] = useState(0);
  const [feedback, setFeedback] = useState('Prepárate en guardia · Esquiva cada golpe y ¡contraataca con Espacio!');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const attackDirRef = useRef<AttackDir>('left');
  const phaseTimerRef = useRef(0.75);
  const phaseDurationRef = useRef(0.75);

  const dodgeXRef = useRef(0);
  const duckTRef = useRef(0);
  const punchTRef = useRef(0);
  const padRecoilRef = useRef(0);

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
      gameId: 'dodge_counter',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((140 + scoreRef.current * 0.04) * cfg.rewardMult),
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

  const enterNextRoundOrFinish = useCallback(() => {
    if (roundRef.current >= TOTAL_ROUNDS) {
      finishGame();
      return;
    }
    roundRef.current += 1;
    setRound(roundRef.current);
    phaseRef.current = 'idle';
    setPhase('idle');
    setAttackDir(null);
    phaseDurationRef.current = Math.max(0.32, 0.65 - difficulty * 0.06);
    phaseTimerRef.current = phaseDurationRef.current;
  }, [difficulty, finishGame]);

  const handleDefense = useCallback(
    (move: AttackDir) => {
      if (unmountedRef.current) return;
      // Map move visually onto athlete
      if (move === 'left') dodgeXRef.current = -1;
      else if (move === 'right') dodgeXRef.current = 1;
      else duckTRef.current = 1;

      if (phaseRef.current !== 'telegraph') {
        sound.playTap();
        return;
      }

      actionsRef.current += 1;
      // Required defense: against a left hook coming from rival left, slip right (or match instruction directly shown on HUD!)
      if (move === attackDirRef.current) {
        const timingRatio = 1 - phaseTimerRef.current / Math.max(0.1, phaseDurationRef.current);
        const crisp = timingRatio > 0.45;
        comboRef.current += 1;
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        if (crisp) perfectRef.current += 1;

        const dodgePts = Math.round((crisp ? 120 : 85) * cfg.rewardMult);
        scoreRef.current += dodgePts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);

        phaseRef.current = 'counter';
        setPhase('counter');
        phaseDurationRef.current = Math.max(0.55, 0.92 * cfg.windowMult);
        phaseTimerRef.current = phaseDurationRef.current;
        setFeedback('¡ESQUIVADO! ¡PULSA ESPACIO PARA CONTRAATACAR!');
        sound.playHit();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedback('¡Guardia equivocada! Lee la dirección del impacto');
        sound.playMiss();
        phaseRef.current = 'recover';
        setPhase('recover');
        phaseTimerRef.current = 0.42;
      }
    },
    [cfg.rewardMult, cfg.windowMult]
  );

  const handleCounter = useCallback(() => {
    if (unmountedRef.current) return;
    punchTRef.current = 1.0;

    if (phaseRef.current === 'counter') {
      actionsRef.current += 1;
      padRecoilRef.current = 1.0;
      comboRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      perfectRef.current += 1;

      const pts = Math.round((210 + comboRef.current * 20) * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setFeedback(`¡CONTRAATAQUE LETAL! +${pts} pts`);
      sound.playPunch();
      sound.playPerfect();

      phaseRef.current = 'recover';
      setPhase('recover');
      phaseTimerRef.current = 0.36;
    } else {
      sound.playTap();
    }
  }, [cfg.rewardMult]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleDefense('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleDefense('right');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        handleDefense('high');
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleCounter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCounter, handleDefense]);

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
    dressGymScene(scene, { fogNear: 7.5, fogFar: 20 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const aspect = w / h;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 40);
    camera.position.set(1.35, 1.55, -computeResponsiveCameraZ(3.1, aspect, 1.0));
    camera.lookAt(0, 1.05, 0.48);

    createThreePointLights(scene, 6);
    addGymDecor(scene, ['dumbbells', 'bench'], { isCancelled: () => unmountedRef.current });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createProceduralGymFloorTexture(renderer), roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Boxing ring mat
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.05, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 })
    );
    mat.position.set(0, 0.025, 0.4);
    mat.receiveShadow = true;
    scene.add(mat);

    // Robotic Sparring Pad & Telegraphing Striking Arm
    const dummyGroup = new THREE.Group();
    dummyGroup.position.set(0, 0.05, 1.05);
    scene.add(dummyGroup);

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 1.45, 20),
      new THREE.MeshStandardMaterial({ color: 0x262626, metalness: 0.7, roughness: 0.3 })
    );
    stand.position.y = 0.725;
    dummyGroup.add(stand);

    const padMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.45 });
    const targetPad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.45, 24), padMat);
    targetPad.position.set(0, 1.32, 0);
    targetPad.castShadow = true;
    dummyGroup.add(targetPad);

    const strikeArmPivot = new THREE.Group();
    strikeArmPivot.position.set(0, 1.35, -0.05);
    dummyGroup.add(strikeArmPivot);

    const strikeGloveMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xe11d48,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    const strikeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6 })
    );
    strikeBeam.position.set(0, 0, -0.35);
    strikeArmPivot.add(strikeBeam);

    const strikeGlove = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 16), strikeGloveMat);
    strikeGlove.position.set(0, 0, -0.78);
    strikeArmPivot.add(strikeGlove);

    const fighterRig = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'pro',
    });
    fighterRig.root.position.set(0, 0.05, -0.15);
    scene.add(fighterRig.root);

    let glbRig: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'pro',
      aiModel,
      isCancelled: () => unmountedRef.current,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0.05, -0.15);
        rig.poseBoxingDefense(0, 0, 0, 0.05);
        scene.add(rig.root);
        glbRig = rig;
        fighterRig.root.visible = false;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextAsp = cw / ch;
      camera.aspect = nextAsp;
      camera.position.z = -computeResponsiveCameraZ(3.1, nextAsp, 1.0);
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

      phaseTimerRef.current -= dt;
      if (phaseRef.current === 'idle' && phaseTimerRef.current <= 0) {
        const dirs: AttackDir[] = ['left', 'right', 'high'];
        const chosen = dirs[Math.floor(Math.random() * dirs.length)];
        attackDirRef.current = chosen;
        setAttackDir(chosen);
        phaseRef.current = 'telegraph';
        setPhase('telegraph');
        phaseDurationRef.current = Math.max(0.55, (1.18 - difficulty * 0.11) * cfg.windowMult);
        phaseTimerRef.current = phaseDurationRef.current;
        setFeedback(
          chosen === 'left'
            ? '¡VIENE GOLPE! Esquiva a la IZQUIERDA (A / ←)'
            : chosen === 'right'
            ? '¡VIENE GOLPE! Esquiva a la DERECHA (D / →)'
            : '¡BARRIDO ALTO! ¡AGÁCHATE (S / ↓)!'
        );
      } else if (phaseRef.current === 'telegraph') {
        const pct = Math.min(
          100,
          Math.max(0, Math.round((1 - phaseTimerRef.current / phaseDurationRef.current) * 100))
        );
        setAlertPct(pct);
        if (phaseTimerRef.current <= 0) {
          actionsRef.current += 1;
          comboRef.current = 0;
          setCombo(0);
          setFeedback('¡Impacto recibido! Reacciona más rápido');
          sound.playMiss();
          phaseRef.current = 'recover';
          setPhase('recover');
          phaseTimerRef.current = 0.45;
        }
      } else if (phaseRef.current === 'counter') {
        const pct = Math.min(
          100,
          Math.max(0, Math.round((phaseTimerRef.current / phaseDurationRef.current) * 100))
        );
        setAlertPct(pct);
        if (phaseTimerRef.current <= 0) {
          setFeedback('Ventana de contraataque cerrada');
          phaseRef.current = 'recover';
          setPhase('recover');
          phaseTimerRef.current = 0.3;
        }
      } else if (phaseRef.current === 'recover' && phaseTimerRef.current <= 0) {
        enterNextRoundOrFinish();
      }

      // Animate dummy arm swing
      if (phaseRef.current === 'telegraph') {
        const p = 1 - phaseTimerRef.current / Math.max(0.1, phaseDurationRef.current);
        strikeArmPivot.visible = true;
        if (attackDirRef.current === 'left') {
          strikeArmPivot.position.set(0.35, 1.32, 0);
          strikeArmPivot.rotation.set(0, THREE.MathUtils.lerp(-1.1, 0.25, p), 0);
        } else if (attackDirRef.current === 'right') {
          strikeArmPivot.position.set(-0.35, 1.32, 0);
          strikeArmPivot.rotation.set(0, THREE.MathUtils.lerp(1.1, -0.25, p), 0);
        } else {
          strikeArmPivot.position.set(0, 1.62, 0);
          strikeArmPivot.rotation.set(THREE.MathUtils.lerp(-0.9, 0.15, p), 0, 0);
        }
        strikeGloveMat.emissiveIntensity = 0.4 + p * 0.9;
      } else {
        strikeArmPivot.visible = false;
      }

      padRecoilRef.current = THREE.MathUtils.damp(padRecoilRef.current, 0, 10, dt);
      dummyGroup.rotation.x = padRecoilRef.current * 0.26;

      dodgeXRef.current = THREE.MathUtils.damp(dodgeXRef.current, 0, 8, dt);
      duckTRef.current = THREE.MathUtils.damp(duckTRef.current, 0, 9, dt);
      punchTRef.current = THREE.MathUtils.damp(punchTRef.current, 0, 12, dt);

      if (glbRig) {
        glbRig.poseBoxingDefense(dodgeXRef.current, duckTRef.current, punchTRef.current, 0.05);
      } else {
        fighterRig.upperBody.rotation.z = -dodgeXRef.current * 0.35;
        fighterRig.upperBody.rotation.x = 0.15 + duckTRef.current * 0.5;
        fighterRig.rightArmPivot.rotation.x = -1.2 - punchTRef.current * 0.5;
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
  }, [aiModel, athlete, cfg.windowMult, difficulty, enterNextRoundOrFinish]);

  return (
    <div className="w-full max-w-4xl mx-auto fc-card overflow-hidden">
      <div className="px-6 py-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="fc-kicker">Combate 3D · {cfg.label}</p>
          <h3 className="text-2xl text-white">Esquiva y Contraataque</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Asaltos</div>
            <div className="font-mono-tabular font-black text-xl text-white">
              {round}/{TOTAL_ROUNDS}
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

        {phase === 'telegraph' && attackDir && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,340px)] bg-rose-950/90 border border-rose-400/50 rounded-xl px-4 py-2.5">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.16em] text-rose-200 font-bold mb-1.5">
              <span>
                {attackDir === 'left'
                  ? '← ESQUIVA IZQ (A)'
                  : attackDir === 'right'
                  ? 'ESQUIVA DER (D) →'
                  : '↓ AGÁCHATE (S)'}
              </span>
              <span>IMPACTO</span>
            </div>
            <div className="h-2.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${alertPct}%` }} />
            </div>
          </div>
        )}

        {phase === 'counter' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92%,340px)] bg-amber-950/90 border border-amber-400 rounded-xl px-4 py-2.5 animate-pulse">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.16em] text-amber-300 font-black mb-1.5">
              <span>¡CONTRAATAQUE ABIERTO!</span>
              <span>ESPACIO</span>
            </div>
            <div className="h-2.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 transition-all duration-75" style={{ width: `${alertPct}%` }} />
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="p-4 bg-black/60 border-t border-white/[0.08] grid grid-cols-4 gap-3">
        <button
          type="button"
          onPointerDown={() => handleDefense('left')}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/25 border border-white/10 active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ← Esquivar (A)
        </button>
        <button
          type="button"
          onPointerDown={() => handleDefense('high')}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/25 border border-white/10 active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          ↓ Agachar (S)
        </button>
        <button
          type="button"
          onPointerDown={() => handleDefense('right')}
          className="py-3.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/25 border border-white/10 active:scale-95 text-white font-display uppercase font-bold tracking-wider cursor-pointer"
        >
          Esquivar (D) →
        </button>
        <button
          type="button"
          onPointerDown={handleCounter}
          className={`py-3.5 rounded-xl font-display italic font-black uppercase text-lg tracking-wider cursor-pointer active:scale-95 transition-all ${
            phase === 'counter'
              ? 'bg-amber-400 text-black shadow-[0_0_24px_rgba(251,191,36,0.75)]'
              : 'bg-orange-500/25 hover:bg-orange-500/40 text-orange-300 border border-orange-500/40'
          }`}
        >
          ¡GOLPEAR! (Espacio)
        </button>
      </div>
    </div>
  );
};
