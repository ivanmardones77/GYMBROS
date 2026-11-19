import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Gender, OutfitId } from '../types/game';
import { buildAthleteModel, AthleteRigParts } from '../three/buildAthleteModel';
import {
  applyAiMaterialState,
  computeRealisticScale,
  createGlbAccessories,
  GLB_OUTFIT_ACCENT,
  GlbAccessories,
  GlbPoseRig,
} from '../three/buildGlbAthlete';
import {
  afterDraw,
  computeResponsiveCameraZ,
  createKineticParticleTexture,
  createProceduralGymFloorTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeObject3D,
  disposeScene,
  dressGymScene,
  loadGlbAsset,
  MODEL_URLS,
  athleteModelUrl,
} from '../three/threeUtils';
import { CharacterAvatar } from './CharacterAvatar';
import { RotateCw, Sparkles } from 'lucide-react';

export type KineticMode = 'none' | 'combo' | 'routine';

interface Athlete3DViewerProps {
  gender: Gender;
  fitnessScore: number;
  skinTone?: string;
  hairColor?: string;
  outfit?: OutfitId;
  energy?: number;
  hasBuff?: boolean;
  pose?: 'idle' | 'flex' | 'tired';
  interactive?: boolean;
  showPoseControls?: boolean;
  kineticMode?: KineticMode;
  kineticBurstKey?: number;
  kineticLabel?: string;
  className?: string;
  /** Show the Magnific-generated athlete (beta) instead of the procedural one. */
  aiModel?: boolean;
}

const KINETIC_PARTICLE_COUNT = 110;

const COMBO_PALETTE = [
  new THREE.Color('#F97316'),
  new THREE.Color('#FBBF24'),
  new THREE.Color('#FEF08A'),
];

const ROUTINE_PALETTE = [
  new THREE.Color('#10B981'),
  new THREE.Color('#34D399'),
  new THREE.Color('#FBBF24'),
];

// GLB outfit accent & rig helpers imported from ../three/buildGlbAthlete

export const Athlete3DViewer: React.FC<Athlete3DViewerProps> = ({
  gender,
  fitnessScore,
  skinTone = '#E8B896',
  hairColor = '#1C1C1C',
  outfit = 'basic',
  energy = 100,
  hasBuff = false,
  pose = 'idle',
  interactive = true,
  showPoseControls = true,
  kineticMode = 'none',
  kineticBurstKey = 0,
  kineticLabel,
  className = 'w-full h-64',
  aiModel = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [manualFlex, setManualFlex] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const effectivePose: 'idle' | 'flex' | 'tired' = manualFlex ? 'flex' : pose;

  const rigRef = useRef<AthleteRigParts | null>(null);
  const aiRootRef = useRef<THREE.Group | null>(null);
  const aiRigRef = useRef<GlbPoseRig | null>(null);
  const aiAccRef = useRef<GlbAccessories | null>(null);
  const unmountedFlag = useRef(false);
  const aiModelRef = useRef(aiModel);
  const [aiLoading, setAiLoading] = useState(false);
  aiModelRef.current = aiModel;
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const propsRef = useRef({
    gender,
    fitnessScore,
    skinTone,
    hairColor,
    outfit,
    energy,
    hasBuff,
    pose: effectivePose,
    kineticMode,
    kineticBurstKey,
    autoRotate,
  });
  propsRef.current = {
    gender,
    fitnessScore,
    skinTone,
    hairColor,
    outfit,
    energy,
    hasBuff,
    pose: effectivePose,
    kineticMode,
    kineticBurstKey,
    autoRotate,
  };

  // Mount Three.js scene once
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
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 6, fogFar: 15, floorY: -0.1, wallDistance: 5.5 });
    scene.environment = envMap;
    sceneRef.current = scene;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(0.35, 1.45, 3.25);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enablePan = false;
    controls.enableZoom = interactive;
    controls.enableRotate = interactive;
    controls.minDistance = 2.2;
    controls.maxDistance = 4.6;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = propsRef.current.autoRotate;
    controls.autoRotateSpeed = 1.8;
    controls.update();
    controlsRef.current = controls;

    createThreePointLights(scene, 4);

    // Subtle upward podium accent light synced to outfit / kinetic energy
    const podiumLight = new THREE.PointLight(0xff5a1f, 0.45, 3.8, 1.6);
    podiumLight.position.set(0, 0.22, 0.65);
    scene.add(podiumLight);

    // Gym Floor & Brushed Steel Podium
    const floorTex = createProceduralGymFloorTexture(renderer);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    const podiumBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.88, 0.1, 36),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.65, metalness: 0.25 })
    );
    podiumBase.position.y = -0.05;
    podiumBase.receiveShadow = true;
    scene.add(podiumBase);

    const podiumInnerDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.78, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff5a1f,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      })
    );
    podiumInnerDisc.rotation.x = -Math.PI / 2;
    podiumInnerDisc.position.y = 0.002;
    scene.add(podiumInnerDisc);

    const podiumRimMat = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.25,
      roughness: 0.28,
      metalness: 0.85,
    });
    const podiumRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.83, 0.022, 12, 48),
      podiumRimMat
    );
    podiumRim.rotation.x = Math.PI / 2;
    podiumRim.position.y = 0.0;
    scene.add(podiumRim);

    // Background Dumbbell Rack with real weighted dumbbells for studio gym depth
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-1.75, -0.1, -1.75);
    rackGroup.rotation.y = 0.45;
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.75 });
    const dbRubberMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.7, metalness: 0.12 });
    const dbChromeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.9 });
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.4), rackMat);
    post1.position.set(-0.55, 0.45, 0);
    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.4), rackMat);
    post2.position.set(0.55, 0.45, 0);
    const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.35), rackMat);
    shelfTop.position.set(0, 0.74, 0);
    const shelfLow = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.35), rackMat);
    shelfLow.position.set(0, 0.38, 0.04);
    rackGroup.add(post1, post2, shelfTop, shelfLow);

    for (let i = -2; i <= 2; i++) {
      const dbHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 10), dbChromeMat);
      dbHandle.rotation.x = Math.PI / 2;
      dbHandle.position.set(i * 0.22, 0.82, 0);
      const dbHeadA = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.048, 12), dbRubberMat);
      dbHeadA.rotation.x = Math.PI / 2;
      dbHeadA.position.set(i * 0.22, 0.82, -0.1);
      const dbHeadB = dbHeadA.clone();
      dbHeadB.position.z = 0.1;
      rackGroup.add(dbHandle, dbHeadA, dbHeadB);
    }
    scene.add(rackGroup);

    // Magnific bench replaces the procedural dumbbell rack once loaded
    loadGlbAsset(MODEL_URLS.bench, 1.0)
      .then(({ root }) => {
        if (unmountedFlag.current || unmounted) {
          disposeObject3D(root);
          return;
        }
        root.position.set(-1.7, -0.1, -2.4);
        root.rotation.y = 0.5;
        scene.add(root);
        rackGroup.visible = false;
      })
      .catch(() => {});
    loadGlbAsset(MODEL_URLS.dumbbells, 0.85)
      .then(({ root }) => {
        if (unmountedFlag.current || unmounted) {
          disposeObject3D(root);
          return;
        }
        root.position.set(1.55, -0.1, -2.0);
        root.rotation.y = -0.6;
        scene.add(root);
      })
      .catch(() => {});

    // Accessories overlay for GLB athlete (wristbands, headband, belt)
    const glbAccessories = createGlbAccessories();
    glbAccessories.group.visible = false;
    scene.add(glbAccessories.group);
    aiAccRef.current = glbAccessories;

    // Kinetic Energy Particle System (THREE.Points with pre-allocated typed arrays)
    const particleCount = KINETIC_PARTICLE_COUNT;
    const posArr = new Float32Array(particleCount * 3);
    const colorArr = new Float32Array(particleCount * 3);
    const baseColorArr = new Float32Array(particleCount * 3);
    const pAngles = new Float32Array(particleCount);
    const pRadii = new Float32Array(particleCount);
    const pHeights = new Float32Array(particleCount);
    const pUpSpeeds = new Float32Array(particleCount);
    const pAngSpeeds = new Float32Array(particleCount);
    const pPhases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.42 + Math.random() * 0.66;
      const y = 0.05 + Math.random() * 2.15;
      pAngles[i] = a;
      pRadii[i] = r;
      pHeights[i] = y;
      pUpSpeeds[i] = 0.55 + Math.random() * 0.95;
      pAngSpeeds[i] = (1.6 + Math.random() * 2.2) * (i % 5 === 0 ? -1 : 1);
      pPhases[i] = Math.random() * Math.PI * 2;

      const idx = i * 3;
      posArr[idx] = Math.cos(a) * r;
      posArr[idx + 1] = y;
      posArr[idx + 2] = Math.sin(a) * r;
    }

    const applyKineticPalette = (mode: KineticMode) => {
      const palette = mode === 'routine' ? ROUTINE_PALETTE : COMBO_PALETTE;
      for (let i = 0; i < particleCount; i++) {
        const c = palette[i % palette.length];
        const idx = i * 3;
        baseColorArr[idx] = c.r;
        baseColorArr[idx + 1] = c.g;
        baseColorArr[idx + 2] = c.b;
        colorArr[idx] = c.r;
        colorArr[idx + 1] = c.g;
        colorArr[idx + 2] = c.b;
      }
    };
    applyKineticPalette(propsRef.current.kineticMode);

    const particleGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3);
    const colorAttr = new THREE.BufferAttribute(colorArr, 3);
    particleGeo.setAttribute('position', posAttr);
    particleGeo.setAttribute('color', colorAttr);

    const particleTex = createKineticParticleTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.14,
      map: particleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const kineticPoints = new THREE.Points(particleGeo, particleMat);
    kineticPoints.visible = propsRef.current.kineticMode !== 'none';
    kineticPoints.frustumCulled = false;
    scene.add(kineticPoints);

    // Build initial procedural athlete
    const initialRig = buildAthleteModel(propsRef.current);
    rigRef.current = initialRig;
    initialRig.root.visible = !aiModelRef.current;
    scene.add(initialRig.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.position.z = computeResponsiveCameraZ(3.25, aspect, 0.9);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let frameId = 0;
    let unmounted = false;
    let lastMode: KineticMode = propsRef.current.kineticMode;
    let lastBurstKey = propsRef.current.kineticBurstKey;
    let kineticAlpha = lastMode !== 'none' ? 0.92 : 0;
    let burstImpulse = lastMode !== 'none' ? 0.85 : 0;
    let flexBlend = propsRef.current.pose === 'flex' ? 1 : 0;
    let tiredBlend = propsRef.current.pose === 'tired' ? 1 : 0;

    const tick = () => {
      if (unmounted) return;
      const dt = Math.min(0.05, Math.max(0.001, clock.getDelta()));
      elapsed += dt;

      const rig = rigRef.current;
      const cur = propsRef.current;
      const isTired = cur.pose === 'tired' || cur.energy < 25;
      const isFlex = cur.pose === 'flex' && !isTired;

      flexBlend = THREE.MathUtils.damp(flexBlend, isFlex ? 1 : 0, 7.5, dt);
      tiredBlend = THREE.MathUtils.damp(tiredBlend, isTired ? 1 : 0, 6.0, dt);

      controls.autoRotate = cur.autoRotate;

      // Sync kinetic mode / burst trigger without recreating scene
      if (cur.kineticMode !== lastMode) {
        if (cur.kineticMode !== 'none') {
          applyKineticPalette(cur.kineticMode);
          burstImpulse = 1.0;
        }
        lastMode = cur.kineticMode;
      }
      if (cur.kineticBurstKey !== lastBurstKey) {
        lastBurstKey = cur.kineticBurstKey;
        if (cur.kineticMode !== 'none') {
          burstImpulse = 1.0;
        }
      }

      const targetAlpha = cur.kineticMode === 'none' ? 0 : 0.95;
      kineticAlpha = THREE.MathUtils.damp(kineticAlpha, targetAlpha, 4.5, dt);
      burstImpulse = THREE.MathUtils.damp(burstImpulse, 0, 2.6, dt);

      // Animate procedural classic rig
      if (rig && rig.root.visible) {
        const freq = isTired ? 3.2 : 1.95;
        const amp = isTired ? 0.025 : 0.014;
        const breath = Math.sin(elapsed * freq);

        rig.upperBody.position.y = 1.02 + breath * amp;
        rig.upperBody.scale.set(1 + breath * 0.012, 1 + breath * 0.018, 1 + breath * 0.018);
        rig.upperBody.rotation.z = Math.sin(elapsed * 0.95) * 0.022;
        rig.upperBody.rotation.x = (isTired ? 0.14 : 0.02) + breath * 0.015;

        // Smooth animated show-off pose transitions for Classic procedural rig
        const cPhase = (elapsed * 0.44) % 3;
        const wFn = (d: number) => {
          const m = Math.min(Math.abs(d), Math.abs(d - 3), Math.abs(d + 3));
          const u = THREE.MathUtils.clamp(1 - Math.max(0, m - 0.32) / 0.36, 0, 1);
          return u * u * (3 - 2 * u);
        };
        let pA = wFn(cPhase - 0.5);
        let pB = wFn(cPhase - 1.5);
        let pC = wFn(cPhase - 2.5);
        const pSum = Math.max(1e-4, pA + pB + pC);
        pA /= pSum;
        pB /= pSum;
        pC /= pSum;

        const baseArmZ = isTired ? 0.18 : 0.2;
        const flexArmZL = pA * 1.24 + pB * 0.45 + pC * 0.35;
        const flexArmZR = pA * 1.24 + pB * 2.45 + pC * 0.35;
        const flexArmXL = pA * 0 + pB * 0.15 + pC * (-0.75 - Math.sin(elapsed * 10.5) * 0.12);
        const flexArmXR = pA * 0 + pB * -0.25 + pC * (-0.75 - Math.sin(elapsed * 10.5) * 0.12);
        const flexForeZL = pA * (-1.65 - Math.sin(elapsed * 6.2) * 0.14) + pB * 0.85 + pC * 0.65;
        const flexForeZR = pA * (1.65 + Math.sin(elapsed * 6.2) * 0.14) + pB * 0.15 + pC * -0.65;

        rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(-baseArmZ, -flexArmZL, flexBlend);
        rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(baseArmZ, flexArmZR, flexBlend);
        rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(0, flexArmXL, flexBlend);
        rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(0, flexArmXR, flexBlend);
        rig.leftForearmPivot.rotation.z = THREE.MathUtils.lerp(0, flexForeZL, flexBlend);
        rig.rightForearmPivot.rotation.z = THREE.MathUtils.lerp(0, flexForeZR, flexBlend);
        rig.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(-0.22, pC * -0.9, flexBlend);
        rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(-0.22, pC * -0.9, flexBlend);

        rig.upperBody.rotation.z = Math.sin(elapsed * 0.95) * 0.022 + flexBlend * (pB * 0.14);
        rig.upperBody.rotation.x =
          (isTired ? 0.14 : 0.02) + breath * 0.015 + flexBlend * (pC * 0.24 - (pA + pB) * 0.08);

        rig.headGroup.rotation.y =
          Math.sin(elapsed * 0.7) * 0.08 + flexBlend * (pA * Math.sin(elapsed * 2.3) * 0.35 + pB * -0.32);
        rig.headGroup.rotation.x =
          Math.cos(elapsed * freq) * 0.025 + tiredBlend * 0.12 + flexBlend * (pC * 0.16 - pB * 0.16);
        if (rig.ponytailGroup) {
          rig.ponytailGroup.rotation.z = Math.sin(elapsed * 1.9) * 0.06;
        }

        if (rig.buffRing.visible) {
          rig.buffRing.rotation.z = elapsed * 0.9;
        }
      }

      // Animate & customize Realistic GLB rig
      const aiRoot = aiRootRef.current;
      const aiRig = aiRigRef.current;
      if (aiRoot && aiRig && aiModelRef.current) {
        const scaleTarget = computeRealisticScale(cur.fitnessScore);
        aiRoot.scale.x = THREE.MathUtils.damp(aiRoot.scale.x, scaleTarget.sx, 5, dt);
        aiRoot.scale.y = THREE.MathUtils.damp(aiRoot.scale.y, scaleTarget.sy, 5, dt);
        aiRoot.scale.z = THREE.MathUtils.damp(aiRoot.scale.z, scaleTarget.sz, 5, dt);

        // Apply clean character-space Double-Biceps Flex / Tired breathing pose
        aiRig.applyViewerPoseOverlay(flexBlend, tiredBlend, elapsed);

        // Hide loose torus overlays on photorealistic GLB rig (prevents floating rings around neck/wrists)
        if (aiAccRef.current) {
          aiAccRef.current.group.visible = false;
        }
      } else if (aiAccRef.current) {
        aiAccRef.current.group.visible = false;
      }

      // Sync podium rim & floor light with outfit or active kinetic energy
      const outfitAccentHex = (GLB_OUTFIT_ACCENT[cur.outfit] || GLB_OUTFIT_ACCENT.basic).accent;
      if (kineticAlpha > 0.01) {
        kineticPoints.visible = true;
        const speedMult = (cur.kineticMode === 'combo' ? 1.45 : 1.1) + burstImpulse * 1.65;
        const radiusExpansion = 1 + burstImpulse * 0.42;
        particleMat.opacity = kineticAlpha;
        particleMat.size = 0.13 + burstImpulse * 0.07;

        const kineticHex = cur.kineticMode === 'routine' ? 0x10b981 : 0xff6a2b;
        podiumRimMat.color.setHex(kineticHex);
        podiumRimMat.emissive.setHex(kineticHex);
        podiumRimMat.emissiveIntensity =
          kineticAlpha * (0.55 + 0.25 * Math.sin(elapsed * 5.2) + burstImpulse * 0.8);
        podiumInnerDisc.material.color.setHex(kineticHex);
        podiumInnerDisc.material.opacity = 0.18 + burstImpulse * 0.14;
        podiumLight.color.setHex(kineticHex);
        podiumLight.intensity = 0.75 + burstImpulse * 0.9;

        for (let i = 0; i < particleCount; i++) {
          pAngles[i] += pAngSpeeds[i] * speedMult * dt;
          pHeights[i] += pUpSpeeds[i] * (0.85 + burstImpulse * 1.1) * dt;
          if (pHeights[i] > 2.25) {
            pHeights[i] = 0.04;
          }

          const taper = 1 - Math.abs(pHeights[i] - 1.1) * 0.22;
          const r = pRadii[i] * taper * radiusExpansion + Math.sin(elapsed * 3.1 + pPhases[i]) * 0.04;
          const idx = i * 3;
          posArr[idx] = Math.cos(pAngles[i]) * r;
          posArr[idx + 1] = pHeights[i];
          posArr[idx + 2] = Math.sin(pAngles[i]) * r;

          const edgeFade = Math.min(1, pHeights[i] * 3.2) * Math.min(1, (2.25 - pHeights[i]) * 2.4);
          const shimmer = 0.72 + 0.28 * Math.sin(elapsed * 7.5 + pPhases[i]);
          const brightness = edgeFade * shimmer;
          colorArr[idx] = baseColorArr[idx] * brightness;
          colorArr[idx + 1] = baseColorArr[idx + 1] * brightness;
          colorArr[idx + 2] = baseColorArr[idx + 2] * brightness;
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
      } else {
        kineticPoints.visible = false;
        podiumRimMat.color.setHex(outfitAccentHex);
        podiumRimMat.emissive.setHex(outfitAccentHex);
        podiumRimMat.emissiveIntensity = cur.hasBuff ? 0.55 + Math.sin(elapsed * 3.5) * 0.2 : 0.22;
        podiumInnerDisc.material.color.setHex(outfitAccentHex);
        podiumInnerDisc.material.opacity = cur.hasBuff ? 0.2 : 0.1;
        podiumLight.color.setHex(outfitAccentHex);
        podiumLight.intensity = cur.hasBuff ? 0.7 : 0.35;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        frameId = afterDraw(renderer, tick, () => unmounted);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    unmountedFlag.current = false;

    return () => {
      unmounted = true;
      unmountedFlag.current = true;
      aiRootRef.current = null;
      aiRigRef.current = null;
      aiAccRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      disposeScene(scene, renderer);
    };
  }, [interactive]);

  // Rebuild classic procedural athlete only when physique, skin/hair, outfit, buff, or low-energy threshold changes
  const isLowEnergy = energy < 25;
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      disposeObject3D(rigRef.current.root);
    }

    const nextRig = buildAthleteModel({
      gender,
      fitnessScore,
      skinTone,
      hairColor,
      outfit,
      hasBuff,
      pose: propsRef.current.pose === 'tired' || isLowEnergy ? 'tired' : propsRef.current.pose,
    });
    rigRef.current = nextRig;
    nextRig.root.visible = !aiModelRef.current;
    scene.add(nextRig.root);
  }, [gender, fitnessScore, skinTone, hairColor, outfit, hasBuff, isLowEnergy]);

  // Magnific AI athlete: rigged GLB chosen by gender + physique stage
  const aiUrl = athleteModelUrl(gender, fitnessScore);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) rigRef.current.root.visible = !aiModel;

    const clearAi = () => {
      if (aiRootRef.current) {
        scene.remove(aiRootRef.current);
        disposeObject3D(aiRootRef.current);
        aiRootRef.current = null;
      }
      aiRigRef.current = null;
    };

    if (!aiModel) {
      clearAi();
      return;
    }

    let cancelled = false;
    if (!aiRootRef.current) setAiLoading(true);

    loadGlbAsset(aiUrl, gender === 'female' ? 1.68 : 1.8, { cloneMaterials: true })
      .then(({ root }) => {
        if (cancelled || unmountedFlag.current || sceneRef.current !== scene) {
          disposeObject3D(root);
          return;
        }
        setAiLoading(false);
        clearAi();
        root.position.y = -0.05;
        const initScale = computeRealisticScale(fitnessScore);
        root.scale.set(initScale.sx, initScale.sy, initScale.sz);

        const rig = new GlbPoseRig(root);
        rig.applyViewerPoseOverlay(
          propsRef.current.pose === 'flex' ? 1 : 0,
          propsRef.current.pose === 'tired' || propsRef.current.energy < 25 ? 1 : 0,
          0
        );
        aiRigRef.current = rig;

        applyAiMaterialState(root, propsRef.current.outfit, propsRef.current.hasBuff);
        scene.add(root);
        aiRootRef.current = root;
        if (rigRef.current) rigRef.current.root.visible = false;
      })
      .catch(() => {
        setAiLoading(false);
        clearAi();
        if (rigRef.current) rigRef.current.root.visible = true;
      });
    return () => {
      cancelled = true;
    };
  }, [aiModel, aiUrl, gender]);

  // Apply subtle outfit sheen / buff highlight onto cloned GLB material
  useEffect(() => {
    const aiRoot = aiRootRef.current;
    if (!aiRoot) return;
    applyAiMaterialState(aiRoot, outfit, hasBuff);
  }, [outfit, hasBuff, aiModel, aiUrl]);

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0.35, 1.45, 3.25);
    controlsRef.current.target.set(0, 1.0, 0);
    controlsRef.current.update();
  };

  if (webglFailed) {
    return (
      <div className={`flex items-center justify-center bg-black rounded-xl ${className}`}>
        <CharacterAvatar
          gender={gender}
          fitnessScore={fitnessScore}
          skinTone={skinTone}
          hairColor={hairColor}
          outfit={outfit}
          energy={energy}
          hasBuff={hasBuff}
          pose={effectivePose}
          className="w-40 h-52"
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={interactive ? handleResetCamera : undefined}
      className={`relative rounded-xl overflow-hidden bg-black ${className}`}
    >
      <div ref={mountRef} className="w-full h-full" />
      {aiModel && aiLoading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="w-9 h-9 rounded-full border-[3px] border-white/15 border-t-orange-500 animate-spin" />
          <span className="font-display uppercase tracking-[0.18em] font-bold text-xs text-white/60">
            Cargando atleta…
          </span>
        </div>
      )}
      {kineticMode !== 'none' && (
        <span
          className={`pointer-events-none absolute top-3 right-3 text-[11px] font-bold tracking-tight bg-black/80 px-2.5 py-1 rounded-lg border border-white/15 ${
            kineticMode === 'routine' ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          {kineticLabel ||
            (kineticMode === 'routine'
              ? 'Energía Cinética · Rutina Completada'
              : 'Energía Cinética · Combo Alto')}
        </span>
      )}
      {interactive && showPoseControls && (
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setManualFlex((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-display uppercase tracking-wider font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
              manualFlex
                ? 'bg-orange-500 text-white border-orange-400'
                : 'bg-black/80 text-white/80 border-white/15 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {manualFlex ? 'Pose Flex' : 'Flex'}
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            title="Activar rotación automática 360°"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-display uppercase tracking-wider font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
              autoRotate
                ? 'bg-white text-black border-white'
                : 'bg-black/80 text-white/80 border-white/15 hover:text-white'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
            360°
          </button>
        </div>
      )}
      {interactive && (
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 text-[10px] font-medium text-white/55 bg-black/75 px-2 py-0.5 rounded border border-white/10">
          Arrastra · Doble clic centra
        </span>
      )}
    </div>
  );
};
