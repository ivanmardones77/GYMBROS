import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DifficultyLevel, MinigameResult } from '../../types/game';
import { DIFFICULTY_CONFIG } from '../../data/gameData';
import { sound } from '../../utils/sound';
import { DuelProgressBanner } from '../DuelProgressBanner';
import {
  afterDraw,
  computeResponsiveCameraZ,
  createProceduralGymFloorTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeScene,
  dressGymScene,
  addGymDecor,
} from '../../three/threeUtils';

import { AthleteBuildOptions, buildAthleteModel } from '../../three/buildAthleteModel';
import { GlbPoseRig, loadMinigameGlbAthlete } from '../../three/buildGlbAthlete';
import { buildContinuousRopeChain, updateRopeChain } from '../../three/gymProps';

interface JumpRopeGameProps {
  difficulty: DifficultyLevel;
  athlete?: Omit<AthleteBuildOptions, 'pose' | 'hasBuff'>;
  aiModel?: boolean;
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
  aiModel = true,
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
  const lastSecRef = useRef(DURATION_SEC);
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
  const tripStumbleRef = useRef(0);
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
    // Allow snappy re-jump near landing
    if (jumpHeightRef.current > 0.12) return;

    jumpVelRef.current = 3.85;
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

    let unmounted = false;
    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 6, fogFar: 15 });
    addGymDecor(scene, ['squatRack', 'bench'], {
      focus: { x: 0, z: 0 },
      depth: 2.8,
      isCancelled: () => unmounted,
    });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 35);
    camera.position.set(0.35, 1.55, computeResponsiveCameraZ(3.85, w / h, 1.0));
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

    // Raised Plyometric Circular Jump Platform & Timing Halo Ring
    const matMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.16, 1.24, 0.055, 42),
      new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.75, metalness: 0.12 })
    );
    matMesh.position.y = 0.025;
    matMesh.receiveShadow = true;
    scene.add(matMesh);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff6a2b,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    const timingRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.036, 12, 48), ringMat);
    timingRing.rotation.x = Math.PI / 2;
    timingRing.position.y = 0.058;
    scene.add(timingRing);

    // Full Sculpted Athlete Jumping Rope
    const jumper = buildAthleteModel({
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      skinTone: athlete?.skinTone ?? '#E8B896',
      hairColor: athlete?.hairColor ?? '#1C1C1C',
      outfit: athlete?.outfit ?? 'runner',
    });
    jumper.root.position.set(0, 0.05, 0);
    jumper.leftArmPivot.rotation.z = -0.42;
    jumper.rightArmPivot.rotation.z = 0.42;
    jumper.leftForearmPivot.rotation.x = -0.82;
    jumper.rightForearmPivot.rotation.x = -0.82;
    scene.add(jumper.root);

    // Ergonomic Anodized Speed-Rope Handles attached directly to the athlete's palms
    const handleMat = new THREE.MeshPhysicalMaterial({ color: 0xff5a1f, roughness: 0.26, metalness: 0.72 });
    const gripBandMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const swivelMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.14 });
    const buildSpeedHandle = (dirSign: number) => {
      const hGrp = new THREE.Group();
      // Grip centered in palm, swivel tip extending outward laterally
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.17, 14), handleMat);
      body.rotation.z = Math.PI / 2;
      body.position.x = dirSign * 0.03;
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 14), gripBandMat);
      foam.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), swivelMat);
      tip.position.set(dirSign * 0.115, 0, 0);
      const swivelAnchor = new THREE.Object3D();
      swivelAnchor.position.set(dirSign * 0.125, 0, 0);
      hGrp.add(body, foam, tip, swivelAnchor);
      hGrp.position.set(0, -0.295, 0.018);
      hGrp.rotation.y = -dirSign * 0.18;
      return { hGrp, swivelAnchor };
    };
    const leftHandleRig = buildSpeedHandle(-1);
    const rightHandleRig = buildSpeedHandle(1);
    jumper.leftForearmPivot.add(leftHandleRig.hGrp);
    jumper.rightForearmPivot.add(rightHandleRig.hGrp);

    let glbJumper: GlbPoseRig | null = null;
    loadMinigameGlbAthlete({
      scene,
      gender: athlete?.gender ?? 'male',
      fitnessScore: athlete?.fitnessScore ?? 65,
      outfit: athlete?.outfit ?? 'runner',
      aiModel,
      isCancelled: () => unmounted,
      onLoaded: (rig) => {
        rig.root.position.set(0, 0.05, 0);
        rig.poseJumpRope(0, 0, Math.sin(ropeAngleRef.current), Math.cos(ropeAngleRef.current), 0, 0.05);
        scene.add(rig.root);
        // Move speed-rope handles to scene space (scale 1.0) synced directly to GLB wrists
        leftHandleRig.hGrp.position.set(0, 0, 0);
        rightHandleRig.hGrp.position.set(0, 0, 0);
        scene.add(leftHandleRig.hGrp, rightHandleRig.hGrp);
        glbJumper = rig;
        jumper.root.visible = false;
      },
    });

    // Measure exact rest hand-swivel height so rope sweeps cleanly across the mat
    const leftTipPos = new THREE.Vector3();
    const rightTipPos = new THREE.Vector3();
    jumper.root.updateMatrixWorld(true);
    leftHandleRig.swivelAnchor.getWorldPosition(leftTipPos);
    rightHandleRig.swivelAnchor.getWorldPosition(rightTipPos);
    const restRopeRadiusY = Math.max(0.92, (leftTipPos.y + rightTipPos.y) * 0.5 - 0.06);

    // Pre-allocated Continuous Glowing Speed-Cable Segments (Zero GC inside tick)
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.2,
    });
    const ropeStripeMat = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const ropeSegments = buildContinuousRopeChain(ROPE_SEGMENTS - 1, 0.017, ropeMat, ropeStripeMat, 4);
    ropeSegments.forEach((seg) => scene.add(seg));

    const ropePoints = Array.from({ length: ROPE_SEGMENTS }, () => new THREE.Vector3());
    const tmpMid = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const aspect = cw / ch;
      camera.aspect = aspect;
      camera.position.z = computeResponsiveCameraZ(3.85, aspect, 1.0);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    let last = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      if (unmounted) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      timeRef.current = Math.max(0, timeRef.current - dt);
      const nextSec = Math.ceil(timeRef.current);
      if (nextSec !== lastSecRef.current) {
        lastSecRef.current = nextSec;
        setTimeLeft(nextSec);
      }

      if (timeRef.current <= 0) {
        finishGame();
        return;
      }

      // Spin speed scales cleanly with difficulty, turbo streak & brief snag deceleration on trip
      if (tripStumbleRef.current > 0) {
        tripStumbleRef.current = Math.max(0, tripStumbleRef.current - dt);
      }
      const prevAngle = ropeAngleRef.current;
      const turboFactor = comboRef.current >= 5 ? 1.18 : 1.0;
      const snagSlow = tripStumbleRef.current > 0 ? 0.35 : 1.0;
      const angularSpeed = (3.4 + (difficulty - 1) * 0.45) * turboFactor * snagSlow;
      ropeAngleRef.current += angularSpeed * dt;

      const prevMod = ((prevAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const curMod = ((ropeAngleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // Reset cycle flags as rope crosses top (3*PI/2)
      if (prevMod < Math.PI * 1.5 && curMod >= Math.PI * 1.5) {
        jumpScoredThisCycleRef.current = false;
        missedCheckedThisCycleRef.current = false;
      }

      // Check rope trip only AFTER the valid post-bottom window passes so late valid jumps aren't penalized
      const tripCheckAngle = Math.PI * 0.5 + Math.max(0.35, 0.55 * cfg.windowMult);
      if (!missedCheckedThisCycleRef.current && prevMod < tripCheckAngle && curMod >= tripCheckAngle) {
        missedCheckedThisCycleRef.current = true;
        if (jumpHeightRef.current < 0.06 && !jumpScoredThisCycleRef.current) {
          comboRef.current = 0;
          actionsRef.current += 1;
          tripStumbleRef.current = 0.26;
          setCombo(0);
          setTurboActive(false);
          setFeedback('¡La cuerda tocó tus pies! Salta a tiempo');
          sound.playMiss();
        }
      }

      // Athletic quick-hop pogo gravity physics (crisp ~0.34m peak + tucked knees)
      if (jumpHeightRef.current > 0 || jumpVelRef.current > 0) {
        jumpHeightRef.current += jumpVelRef.current * dt;
        jumpVelRef.current -= 22.0 * dt;
        if (jumpHeightRef.current <= 0) {
          jumpHeightRef.current = 0;
          jumpVelRef.current = 0;
        }
      }
      const jumpNorm = THREE.MathUtils.clamp(jumpHeightRef.current / 0.34, 0, 1);

      // Orbit forearms subtly in a wrist circle synchronized with the turning rope
      const angle = ropeAngleRef.current;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      const stumbleFactor = tripStumbleRef.current > 0 ? Math.sin(tripStumbleRef.current * 24) : 0;

      if (glbJumper) {
        glbJumper.poseJumpRope(jumpNorm, jumpHeightRef.current, sinA, cosA, stumbleFactor, 0.05);
        // Athlete faces +Z: RightHand is on viewer-left (-X), LeftHand is on viewer-right (+X)
        if (glbJumper.bones.rightHand && glbJumper.bones.leftHand) {
          glbJumper.bones.rightHand.getWorldPosition(leftHandleRig.hGrp.position);
          glbJumper.bones.leftHand.getWorldPosition(rightHandleRig.hGrp.position);
          leftHandleRig.hGrp.rotation.set(sinA * 0.14, 0.18, cosA * 0.12);
          rightHandleRig.hGrp.rotation.set(sinA * 0.14, -0.18, -cosA * 0.12);
        }
        leftHandleRig.hGrp.updateMatrixWorld(true);
        rightHandleRig.hGrp.updateMatrixWorld(true);
      } else {
        jumper.root.position.y = 0.05 + jumpHeightRef.current;
        jumper.leftLegPivot.rotation.x = -jumpNorm * 0.45;
        jumper.rightLegPivot.rotation.x = -jumpNorm * 0.45;
        jumper.leftKneePivot.rotation.x = jumpNorm * 0.95;
        jumper.rightKneePivot.rotation.x = jumpNorm * 0.95;
        jumper.shadowMesh.scale.setScalar(Math.max(0.5, 1 - jumpNorm * 0.4));

        jumper.leftArmPivot.rotation.z = -0.42 - jumpNorm * 0.06;
        jumper.rightArmPivot.rotation.z = 0.42 + jumpNorm * 0.06;
        jumper.leftForearmPivot.rotation.x = -0.82 + sinA * 0.11 + jumpNorm * 0.24;
        jumper.rightForearmPivot.rotation.x = -0.82 + sinA * 0.11 + jumpNorm * 0.24;
        jumper.leftForearmPivot.rotation.z = -cosA * 0.08;
        jumper.rightForearmPivot.rotation.z = cosA * 0.08;
        jumper.upperBody.rotation.x = 0.04 + stumbleFactor * 0.14;
        if (jumper.ponytailGroup) {
          jumper.ponytailGroup.rotation.x = 0.18 + jumpNorm * 0.38;
        }
        jumper.root.updateMatrixWorld(true);
      }

      // Query exact world coordinates of both handle swivel tips so rope NEVER detaches
      leftHandleRig.swivelAnchor.getWorldPosition(leftTipPos);
      rightHandleRig.swivelAnchor.getWorldPosition(rightTipPos);

      // Physical catenary + centrifugal drag lag + mat floor brush
      const dragLag = comboRef.current >= 5 ? 0.22 : 0.15;
      const snagDip = tripStumbleRef.current > 0 ? Math.sin(tripStumbleRef.current * 28) * 0.12 : 0;
      const radialArcY = restRopeRadiusY + snagDip;
      const radialArcZ = 1.08;
      const matTopY = 0.068;

      for (let i = 0; i < ROPE_SEGMENTS; i++) {
        const t = i / (ROPE_SEGMENTS - 1);
        const arch = Math.pow(Math.sin(Math.PI * t), 0.72);
        const effAngle = angle - dragLag * arch;
        const effSin = Math.sin(effAngle);
        const effCos = Math.cos(effAngle);

        const baseX = THREE.MathUtils.lerp(leftTipPos.x, rightTipPos.x, t);
        const baseY = THREE.MathUtils.lerp(leftTipPos.y, rightTipPos.y, t);
        const baseZ = THREE.MathUtils.lerp(leftTipPos.z, rightTipPos.z, t);

        // Smooth C-infinity lateral bow (no discontinuity at center)
        const lateralFlare = -Math.sin(Math.PI * 2 * t) * 0.075;
        const x = baseX + lateralFlare;
        const rawY = baseY - arch * radialArcY * effSin;
        const y = rawY < matTopY ? matTopY + (rawY - matTopY) * 0.04 : rawY;
        const clampedY = Math.max(matTopY, y);
        const z = baseZ + arch * radialArcZ * effCos;

        ropePoints[i].set(x, clampedY, z);
      }
      // Guarantee exact 0-gap anchor at handle tips
      ropePoints[0].copy(leftTipPos);
      ropePoints[ROPE_SEGMENTS - 1].copy(rightTipPos);
      updateRopeChain(ropeSegments, ropePoints, tmpMid, tmpDir);

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
        frameId = afterDraw(renderer, () => tick(performance.now()), () => unmounted);
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
  }, [cfg.windowMult, difficulty, finishGame]);

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
        <DuelProgressBanner
          rivalName={rivalName}
          rivalTargetScore={rivalTargetScore}
          score={score}
        />
      )}

      {/* 3D Jump Rope Stage */}
      <div
        onPointerDown={triggerJump}
        className="mt-5 relative h-[56vh] min-h-[360px] max-h-[580px] fc-stage rounded-2xl overflow-hidden bg-black cursor-pointer select-none touch-none"
      >
        <div ref={mountRef} className="w-full h-full" />
        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between text-xs">
          <span className="bg-black/80 border border-white/15 text-white/85 px-2.5 py-1 rounded">
            Ritmo: <strong className="text-white">{turboActive ? 'Turbo x1.2' : 'Constante'}</strong>
          </span>
          {turboActive && (
            <span className="bg-orange-500 text-white font-bold px-2.5 py-1 rounded">
              MODO TURBO
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 border border-white/15 px-3.5 py-1 rounded-lg text-xs text-white/85 whitespace-nowrap">
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
