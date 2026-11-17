import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  afterDraw,
  createStudioRenderer,
  createThreePointLights,
  detectSoftwareGl,
  disposeScene,
  dressGymScene,
  loadGlbAsset,
  MODEL_URLS,
} from '../three/threeUtils';
import { Trophy } from 'lucide-react';

export const Trophy3DWidget: React.FC<{ className?: string }> = ({ className = 'w-28 h-28' }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

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
    camera.position.set(0, 0.7, 2.5);
    camera.lookAt(0, 0.45, 0);

    createThreePointLights(scene, 3);

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
    loadGlbAsset(MODEL_URLS.trophy, 1.05)
      .then(({ root }) => {
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
    let unmounted = false;

    const tick = () => {
      if (unmounted) return;
      const t = clock.getElapsedTime();
      trophy.rotation.y = t * 0.85;
      trophy.position.y = Math.sin(t * 2) * 0.03;

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = afterDraw(renderer, tick);
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

  return <div ref={mountRef} className={`rounded-xl overflow-hidden bg-black ${className}`} />;
};
