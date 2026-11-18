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

interface JumpRopeGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  rivalTargetScore?: number;
  rivalName?: string;
  onComplete: (result: MinigameResult) => void;
  onCancel: () => void;
}

const DURATION_SEC = 25;
const ROPE_SEGMENTS = 28;

export const JumpRopeGame: React.FC<JumpRopeGameProps> = ({
  difficulty,
  athlete,
  rivalTargetScore,
  rivalName,
  onComplete,
  onCancel,
}) => {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [turboActive, setTurboActive] = useState(false);
  const [feedback, setFeedback] = useState('¡Salta cuando la cuerda toque el aro iluminado!');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(DURATION_SEC);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const actionsRef = useRef(0);
  const completedRef = useRef(false);

  // Rope angle & athlete jump kinematics
  const ropeAngleRef = useRef(Math.PI * 0.85);
  const jumpHeightRef = useRef(0);
  const jumpVelRef = useRef(0);
  const jumpScoredThisCycleRef = useRef(false);
  const missedCheckedThisCycleRef = useRef(false);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      gameId: 'rope',
      difficulty,
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectRef.current,
      totalActions: Math.max(1, actionsRef.current),
      caloriesBurned: Math.round((155 + scoreRef.current * 0.042) * cfg.rewardMult),
      rivalTargetScore,
      rivalName,
    });
  }, [cfg.rewardMult, difficulty, onComplete, rivalName, rivalTargetScore]);

  const triggerJump = useCallback(() => {
    if (completedRef.current) return;
    // Allow jump if close to ground
    if (jumpHeightRef.current > 0.18) return;

    jumpVelRef.current = 5.4;
    actionsRef.current += 1;

    // Bottom sweep angle is around Math.PI / 2 (sin(angle) === 1 -> y lowest)
    // Using angle modulo 2*PI where bottom is PI * 0.5
    const a = ((ropeAngleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const distFromBottom = Math.abs(a - Math.PI * 0.5);
    const sweetAngle = Math.max(0.24, 0.42 * cfg.windowMult);
    const goodAngle = Math.max(0.55, 0.86 * cfg.windowMult);

    if (distFromBottom <= sweetAngle) {
      jumpScoredThisCycleRef.current = true;
      comboRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      perfectRef.current += 1;
      const isTurbo = comboRef.current >= 5;
      const mult = 1 + Math.min(2.5, comboRef.current * 0.22);
      const pts = Math.round((isTurbo ? 185 : 135) * mult * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setTurboActive(isTurbo);
      setFeedback(isTurbo ? `¡DOBLE TURBO x${comboRef.current}! +${pts}` : `¡SALTO PERFECTO! +${pts}`);
      sound.playPerfect();
    } else if (distFromBottom <= goodAngle) {
      jumpScoredThisCycleRef.current = true;
      comboRef.current += 1;
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const mult = 1 + Math.min(1.5, comboRef.current * 0.14);
      const pts = Math.round(80 * mult * cfg.rewardMult);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setTurboActive(comboRef.current >= 5);
      setFeedback(`¡Buen salto! +${pts}`);
      sound.playJump();
    } else {
      comboRef.current = 0;
      setCombo(0);
      setTurboActive(false);
      setFeedback('Salto fuera de ritmo · Espera al aro naranja');
      sound.playTap();
    }
  }, [cfg.rewardMult, cfg.windowMult]);

  // Three.js Jump Rope Arena
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
    dressGymScene(scene, { fogNear: 6, fogFar: 15 });
    addGymDecor(scene, ['squatRack', 'bench'], { focus: { x: 0, z: 0 }, depth: 2.8 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 35);
    camera.position.set(0.35, 1.55, 3.85);
    camera.lookAt(0, 0.85, 0);

    createThreePointLights(scene, 5);

    const floorTex = createProceduralGymFloorTexture(renderer);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Jump Mat & Timing Halo Ring
    const matMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.2, 0.04, 36),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.75 })
    );
    matMesh.position.y = 0.02;
    matMesh.receiveShadow = true;
    scene.add(matMesh);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff6a2b,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    const timingRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 12, 48), ringMat);
    timingRing.rotation.x = Math.PI / 2;
    timingRing.position.y = 0.05;
    scene.add(timingRing);

    // Full Sculpted Athlete Jumping Rope
    const jumper = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'runner',
    });
    jumper.root.position.set(0, 0.04, 0);
    jumper.leftArmPivot.rotation.z = -0.36;
    jumper.rightArmPivot.rotation.z = 0.36;
    jumper.leftForearmPivot.rotation.x = -1.05;
    jumper.rightForearmPivot.rotation.x = -1.05;
    scene.add(jumper.root);

    // Speed-Rope Handles held by athlete's hands
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.3, metalness: 0.5 });
    const handleGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.18, 12);
    const leftHandle = new THREE.Mesh(handleGeo, handleMat);
    leftHandle.position.set(-0.46, 0.98, 0.16);
    leftHandle.rotation.z = Math.PI / 2.2;
    const rightHandle = new THREE.Mesh(handleGeo, handleMat);
    rightHandle.position.set(0.46, 0.98, 0.16);
    rightHandle.rotation.z = -Math.PI / 2.2;
    scene.add(leftHandle, rightHandle);

    // Pre-allocated 3D Rope Link Beads (Zero GC inside tick)
    const ropeBeads: THREE.Mesh[] = [];
    const beadGeo = new THREE.SphereGeometry(0.028, 10, 10);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.castShadow = true;
      scene.add(bead);
      ropeBeads.push(bead);
    }

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

      timeRef.current = Math.max(0, timeRef.current - dt);
      setTimeLeft(Math.ceil(timeRef.current));

      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      // Spin speed scales cleanly with difficulty & turbo streak
      const prevAngle = ropeAngleRef.current;
      const turboFactor = comboRef.current >= 5 ? 1.18 : 1.0;
      const angularSpeed = (3.4 + (difficulty - 1) * 0.45) * turboFactor;
      ropeAngleRef.current += angularSpeed * dt;

      const prevMod = ((prevAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const curMod = ((ropeAngleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // Reset cycle flags as rope crosses top (3*PI/2)
      if (prevMod < Math.PI * 1.5 && curMod >= Math.PI * 1.5) {
        jumpScoredThisCycleRef.current = false;
        missedCheckedThisCycleRef.current = false;
      }

      // Check rope trip when rope passes bottom (PI/2)
      if (!missedCheckedThisCycleRef.current && prevMod < Math.PI * 0.5 && curMod >= Math.PI * 0.5) {
        missedCheckedThisCycleRef.current = true;
        if (jumpHeightRef.current < 0.08 && !jumpScoredThisCycleRef.current) {
          comboRef.current = 0;
          actionsRef.current += 1;
          setCombo(0);
          setTurboActive(false);
          setFeedback('¡La cuerda tocó tus pies! Salta a tiempo');
          sound.playMiss();
        }
      }

      // Athlete jump gravity physics
      if (jumpHeightRef.current > 0 || jumpVelRef.current > 0) {
        jumpHeightRef.current += jumpVelRef.current * dt;
        jumpVelRef.current -= 18.5 * dt;
        if (jumpHeightRef.current <= 0) {
          jumpHeightRef.current = 0;
          jumpVelRef.current = 0;
        }
      }
      jumper.root.position.y = 0.04 + jumpHeightRef.current;
      const jumpNorm = THREE.MathUtils.clamp(jumpHeightRef.current / 0.72, 0, 1);
      jumper.leftLegPivot.rotation.x = -jumpNorm * 0.35;
      jumper.rightLegPivot.rotation.x = -jumpNorm * 0.35;
      jumper.leftKneePivot.rotation.x = jumpNorm * 0.75;
      jumper.rightKneePivot.rotation.x = jumpNorm * 0.75;
      jumper.shadowMesh.scale.setScalar(Math.max(0.5, 1 - jumpNorm * 0.45));

      // Rotate forearms subtly as hands spin the handles
      const angle = ropeAngleRef.current;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      jumper.leftForearmPivot.rotation.x = -1.05 + sinA * 0.16;
      jumper.rightForearmPivot.rotation.x = -1.05 + sinA * 0.16;
      if (jumper.ponytailGroup) {
        jumper.ponytailGroup.rotation.x = 0.18 + jumpNorm * 0.38;
      }

      const handY = 0.98 + jumpHeightRef.current + sinA * 0.03;
      leftHandle.position.set(-0.46, handY, 0.16);
      rightHandle.position.set(0.46, handY, 0.16);

      // Update rope bead arc around the full athlete (angle PI/2 = bottom floor sweep)
      const radiusDrop = 0.96;
      const archCenterY = 1.01 + jumpHeightRef.current * 0.25;

      for (let i = 0; i < ROPE_SEGMENTS; i++) {
        const t = i / (ROPE_SEGMENTS - 1);
        const x = THREE.MathUtils.lerp(-0.48, 0.48, t) + Math.sin(t * Math.PI) * 0.24 * (t < 0.5 ? -1 : 1);
        const arch = Math.sin(t * Math.PI);
        const y = archCenterY - arch * radiusDrop * sinA + arch * 0.95 * (sinA < 0 ? -sinA * 0.28 : 0);
        const z = 0.12 + arch * 1.15 * cosA;
        ropeBeads[i].position.set(x, Math.max(0.04, y), z);
      }

      // Glow timing ring brightly as rope approaches bottom sweep
      const distBottom = Math.abs(curMod - Math.PI * 0.5);
      if (distBottom <= 0.45) {
        ringMat.color.setHex(0x10b981);
        ringMat.emissive.setHex(0x10b981);
        ringMat.emissiveIntensity = 1.4;
        timingRing.scale.setScalar(1.06);
      } else {
        ringMat.color.setHex(0xff6a2b);
        ringMat.emissive.setHex(0xff5a1f);
        ringMat.emissiveIntensity = 0.25;
        timingRing.scale.setScalar(1.0);
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
  }, [difficulty, finishGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (e.repeat) return;
        e.preventDefault();
        triggerJump();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerJump]);

  return (
    <div className="fc-card p-5 sm:p-7 max-w-6xl mx-auto relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <p className="fc-kicker">Cardio 3D · {cfg.label}</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] text-white mt-1">Salto de Cuerda Turbo</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Tiempo</div>
            <div className="font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 text-white">{timeLeft}s</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/40">Combo</div>
            <div className={`font-display font-bold text-[1.6rem] sm:text-[2.1rem] leading-none tabular-nums mt-1 ${turboActive ? 'text-orange-500' : 'text-white'}`}>
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

      {/* 3D Jump Rope Stage */}
      <div
        onPointerDown={triggerJump}
        className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black cursor-pointer select-none touch-none"
      >
        <div ref={mountRef} className="w-full h-full" />
        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs">
          <span className="bg-black/70 backdrop-blur-sm border border-white/10 text-white/80 px-2.5 py-1 rounded">
            Ritmo: <strong className="text-white">{turboActive ? 'Turbo x1.2' : 'Constante'}</strong>
          </span>
          {turboActive && (
            <span className="bg-orange-500 text-white font-bold px-2.5 py-1 rounded">
              MODO TURBO
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-3.5 py-1 rounded-lg text-xs text-white/80 whitespace-nowrap">
          {feedback}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <p className="text-xs text-white/50">
          Pulsa Espacio / W o toca la escena cuando el aro brille en verde
        </p>
        <button
          onPointerDown={triggerJump}
          className="w-full sm:w-auto px-10 py-3.5 fc-btn-accent text-lg rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer select-none touch-none"
        >
          ¡Saltar! (Espacio)
        </button>
      </div>
    </div>
  );
};
