import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  afterDraw,
  createKineticParticleTexture,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeObject3D,
  disposeScene,
  dressGymScene,
  loadGlbAsset,
  MODEL_URLS,
} from '../three/threeUtils';
import { Trophy } from 'lucide-react';

export const Trophy3DWidget: React.FC<{ className?: string }> = ({ className = 'w-28 h-28' }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const spinBoostRef = useRef(0);
  const hoverTiltRef = useRef({ x: 0, y: 0 });

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
      setFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    dressGymScene(scene, { fogNear: 4, fogFar: 12, cone: false, wallDistance: 4 });
    scene.environment = envMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 20);
    camera.position.set(0, 0.72, 2.55);
    camera.lookAt(0, 0.48, 0);

    createThreePointLights(scene, 3);

    const goldLight = new THREE.PointLight(0xfbbf24, 1.1, 4.5, 1.6);
    goldLight.position.set(0, 0.65, 1.1);
    scene.add(goldLight);

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.16,
      anisotropy: 0.75,
    });
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      metalness: 0.35,
      roughness: 0.42,
    });

    const trophy = new THREE.Group();

    // Plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 24), obsidianMat);
    plinth.position.y = 0.11;
    trophy.add(plinth);

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.04), goldMat);
    plaque.position.set(0, 0.11, 0.45);
    trophy.add(plaque);

    // Kettlebell Sphere Body
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), obsidianMat);
    bell.position.y = 0.56;
    trophy.add(bell);

    // Kettlebell Handle
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 12, 28, Math.PI), goldMat);
    handle.position.y = 0.84;
    trophy.add(handle);

    // Winged Accents
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(0.35, 0.22, 0.48, 0.58);
    wingShape.quadraticCurveTo(0.22, 0.44, 0.05, 0.18);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 2,
    });

    const rightWing = new THREE.Mesh(wingGeo, goldMat);
    rightWing.position.set(0.14, 0.48, -0.02);
    trophy.add(rightWing);

    const leftWing = new THREE.Mesh(wingGeo, goldMat);
    leftWing.scale.x = -1;
    leftWing.position.set(-0.14, 0.48, -0.02);
    trophy.add(leftWing);

    scene.add(trophy);

    // Subtle golden champion sparkles orbiting the trophy
    const sparkCount = 26;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkAngles = new Float32Array(sparkCount);
    const sparkRadii = new Float32Array(sparkCount);
    const sparkHeights = new Float32Array(sparkCount);
    const sparkSpeeds = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      sparkAngles[i] = Math.random() * Math.PI * 2;
      sparkRadii[i] = 0.42 + Math.random() * 0.34;
      sparkHeights[i] = 0.08 + Math.random() * 1.05;
      sparkSpeeds[i] = 0.22 + Math.random() * 0.38;
    }
    const sparkGeo = new THREE.BufferGeometry();
    const sparkAttr = new THREE.BufferAttribute(sparkPos, 3);
    sparkGeo.setAttribute('position', sparkAttr);
    const sparkMat = new THREE.PointsMaterial({
      size: 0.085,
      map: createKineticParticleTexture(),
      color: 0xfcd34d,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    let unmounted = false;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    loadGlbAsset(MODEL_URLS.trophy, 1.05)
      .then(({ root }) => {
        if (unmounted) {
          disposeObject3D(root);
          return;
        }
        trophy.clear();
        trophy.add(root);
      })
      .catch(() => {});

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let angleY = 0;

    const tick = () => {
      if (unmounted) return;
      const dt = Math.min(0.05, Math.max(0.001, clock.getDelta()));
      const t = clock.elapsedTime;

      spinBoostRef.current = THREE.MathUtils.damp(spinBoostRef.current, 0, 3.2, dt);
      angleY += (0.85 + spinBoostRef.current) * dt;
      trophy.rotation.y = angleY + hoverTiltRef.current.x * 0.35;
      trophy.rotation.x = THREE.MathUtils.damp(trophy.rotation.x, hoverTiltRef.current.y * 0.16, 6, dt);
      trophy.position.y = Math.sin(t * 2.1) * 0.032;

      goldLight.intensity = 1.05 + Math.sin(t * 3.0) * 0.2 + spinBoostRef.current * 0.12;

      for (let i = 0; i < sparkCount; i++) {
        sparkAngles[i] += (0.9 + sparkSpeeds[i]) * dt;
        sparkHeights[i] += sparkSpeeds[i] * dt;
        if (sparkHeights[i] > 1.15) sparkHeights[i] = 0.05;
        const idx = i * 3;
        sparkPos[idx] = Math.cos(sparkAngles[i]) * sparkRadii[i];
        sparkPos[idx + 1] = sparkHeights[i];
        sparkPos[idx + 2] = Math.sin(sparkAngles[i]) * sparkRadii[i];
      }
      sparkAttr.needsUpdate = true;

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = afterDraw(renderer, tick, () => unmounted);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposeScene(scene, renderer);
    };
  }, []);

  if (failed) {
    return (
      <div className={`bg-amber-500/10 rounded-xl flex items-center justify-center ${className}`}>
        <Trophy className="w-8 h-8 text-amber-400" />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      onClick={() => {
        spinBoostRef.current = Math.min(8, spinBoostRef.current + 4.5);
      }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
        hoverTiltRef.current = { x: nx, y: ny };
      }}
      onPointerLeave={() => {
        hoverTiltRef.current = { x: 0, y: 0 };
      }}
      title="Toca para girar el trofeo"
      className={`rounded-xl overflow-hidden bg-black cursor-pointer ${className}`}
    />
  );
};
