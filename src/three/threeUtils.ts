import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createStudioRenderer(
  container: HTMLElement,
  isSoftwareGl: boolean,
  options?: { alpha?: boolean }
): { renderer: THREE.WebGLRenderer; envMap: THREE.Texture } {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: options?.alpha ?? false,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  return { renderer, envMap: envTex };
}

export function createThreePointLights(scene: THREE.Scene, shadowExtent = 6): void {
  // Neutral-warm key light from above-front (casts the main shadow)
  const key = new THREE.DirectionalLight(0xfff3e8, 2.3);
  key.position.set(3.2, 8.5, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 25;
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  // Low, moody fill so the room stays dark
  const hemi = new THREE.HemisphereLight(0xe8eef5, 0x0a0a0a, 0.55);
  hemi.position.set(0, 10, 0);
  scene.add(hemi);

  // Front soft fill so faces never go black
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-2.5, 2.5, 6);
  scene.add(fill);

  // Signature orange rim from back-left
  const rimWarm = new THREE.DirectionalLight(0xff6a2b, 1.15);
  rimWarm.position.set(-5, 3.5, -4.5);
  scene.add(rimWarm);

  // Cool white rim from back-right for silhouette separation
  const rimCool = new THREE.DirectionalLight(0xdfe9ff, 1.4);
  rimCool.position.set(5, 4.5, -4);
  scene.add(rimCool);
}

function radialTexture(stops: [number, string][], size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface GymSceneOptions {
  fogNear?: number;
  fogFar?: number;
  /** Where the overhead spotlight lands (the athlete / main prop). */
  focus?: { x: number; z: number };
  /** Height of the floor surface in this scene. */
  floorY?: number;
  /** Distance of the back LED wall from the focus point. */
  wallDistance?: number;
  /** Disable the light cone (e.g. top-down cameras). */
  cone?: boolean;
}

/**
 * Premium "night gym" dressing shared by every 3D scene:
 * gradient backdrop, fog, LED light strips on a back wall,
 * a volumetric overhead cone and a light pool on the floor.
 */
export function dressGymScene(scene: THREE.Scene, opts: GymSceneOptions = {}): THREE.Group {
  const { fogNear = 6, fogFar = 16, focus = { x: 0, z: 0 }, floorY = 0, wallDistance = 6.5, cone = true } = opts;
  const BG = '#0A0A0A';

  // Backdrop gradient (dark top, warm haze at the horizon)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 4;
  bgCanvas.height = 256;
  const bctx = bgCanvas.getContext('2d');
  if (bctx) {
    const g = bctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#050505');
    g.addColorStop(0.5, '#120d0b');
    g.addColorStop(0.62, '#1a110c');
    g.addColorStop(1, '#0A0A0A');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, 4, 256);
  }
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  scene.fog = new THREE.Fog(BG, fogNear, fogFar);
  // Keep reflections subtle so the room reads as a dark, moody gym
  (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.45;

  const group = new THREE.Group();
  group.name = 'gym-dressing';

  // Back wall LED strips (unaffected by fog so they glow through the haze)
  const wallZ = focus.z - wallDistance;
  const stripWhite = new THREE.MeshBasicMaterial({ color: 0xd9d9d9, fog: false, toneMapped: false });
  const stripOrange = new THREE.MeshBasicMaterial({ color: 0xff5a1f, fog: false, toneMapped: false });
  const stripDim = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, fog: false });
  const glowTex = radialTexture([
    [0, 'rgba(255,255,255,0.55)'],
    [0.35, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue; // keep the area behind the athlete clean
    const x = focus.x + i * 2.1;
    const isAccent = Math.abs(i) === 2;
    const h = isAccent ? 3.2 : 2.4;
    const mat = isAccent ? stripOrange : Math.abs(i) % 2 === 1 ? stripWhite : stripDim;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.02), mat);
    bar.position.set(x, floorY + 0.6 + h / 2, wallZ);
    group.add(bar);
    if (mat !== stripDim) {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: isAccent ? 0xff5a1f : 0xffffff,
          transparent: true,
          opacity: isAccent ? 0.7 : 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      glow.scale.set(1.6, h * 1.35, 1);
      glow.position.copy(bar.position);
      group.add(glow);
    }
  }
  // Horizontal accent line along the wall
  const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.03, 0.02), stripOrange);
  rail.position.set(focus.x, floorY + 0.35, wallZ + 0.01);
  group.add(rail);

  // Dark wall panel to catch the glow
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 9),
    new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.95, metalness: 0 })
  );
  wall.position.set(focus.x, floorY + 4, wallZ - 0.05);
  group.add(wall);

  if (cone) {
    // Volumetric overhead cone
    const coneCanvas = document.createElement('canvas');
    coneCanvas.width = 4;
    coneCanvas.height = 128;
    const cctx = coneCanvas.getContext('2d');
    if (cctx) {
      const g = cctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,240,225,0.0)');
      g.addColorStop(0.2, 'rgba(255,240,225,0.055)');
      g.addColorStop(1, 'rgba(255,240,225,0.012)');
      cctx.fillStyle = g;
      cctx.fillRect(0, 0, 4, 128);
    }
    const coneTex = new THREE.CanvasTexture(coneCanvas);
    const coneMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 1.55, 5.2, 40, 1, true),
      new THREE.MeshBasicMaterial({
        map: coneTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      })
    );
    coneMesh.position.set(focus.x, floorY + 2.6, focus.z);
    coneMesh.renderOrder = 2;
    group.add(coneMesh);
  }

  // Light pool on the floor
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture([
        [0, 'rgba(240,240,240,0.18)'],
        [0.45, 'rgba(230,230,230,0.06)'],
        [1, 'rgba(255,160,120,0)'],
      ]),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(focus.x, floorY + 0.004, focus.z);
  pool.renderOrder = 1;
  group.add(pool);

  scene.add(group);
  return group;
}

export function createProceduralGymFloorTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, size, size);

    // Rubber mat granules (deterministic pseudo-random)
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = rnd();
      ctx.fillStyle =
        r < 0.03 ? 'rgba(255,90,31,0.25)' : r < 0.4 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.45)';
      const d = r < 0.06 ? 1.6 : 1.2 + rnd() * 1.4;
      ctx.fillRect(x, y, d, d);
    }

    // Tile seams with a subtle bevel
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, size - 8, size - 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createContactShadowMesh(radius = 1.0, opacity = 0.45): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, `rgba(0, 0, 0, ${opacity * 1.4})`);
    grad.addColorStop(0.55, `rgba(0, 0, 0, ${opacity * 0.55})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  return mesh;
}

export function createKineticParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function computeResponsiveCameraZ(baseZ: number, aspect: number, minAspect = 1.05): number {
  if (aspect >= minAspect) return baseZ;
  const factor = Math.min(1.48, minAspect / Math.max(0.55, aspect));
  return baseZ * factor;
}

export function afterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  isCancelled?: () => boolean
): number {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl || typeof gl.fenceSync !== 'function') {
    return window.setTimeout(() => {
      if (!isCancelled?.()) cb();
    }, 80);
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    if (isCancelled?.()) {
      try {
        if (sync) gl.deleteSync(sync);
      } catch {
        // Ignore lost context errors
      }
      return;
    }
    let state: number = gl.SIGNALED;
    try {
      state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    } catch {
      return;
    }
    if (state === gl.UNSIGNALED) {
      window.setTimeout(poll, 5);
    } else {
      try {
        if (sync) gl.deleteSync(sync);
      } catch {
        // Ignore lost context errors
      }
      window.setTimeout(() => {
        if (!isCancelled?.()) cb();
      }, 80);
    }
  };
  return window.setTimeout(poll, 5);
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      if (!obj.userData?.sharedGlbGeometry) {
        obj.geometry?.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const isSharedMat = Boolean(obj.userData?.sharedGlbMaterial);
      const isClonedMat = Boolean(obj.userData?.clonedGlbMaterial);
      for (const m of mats) {
        if (!m) continue;
        if (isSharedMat && !isClonedMat) continue;
        if (!isClonedMat) {
          for (const val of Object.values(m)) {
            if (val && typeof val === 'object' && 'isTexture' in val) {
              (val as THREE.Texture).dispose();
            }
          }
        }
        m.dispose();
      }
    }
  });
}

export function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  disposeObject3D(scene);
  if (scene.environment) {
    scene.environment.dispose();
  }
  renderer.dispose();
}

// ---------- Magnific GLB assets ----------

const gltfCache = new Map<string, Promise<GLTF>>();

const M = (f: string) => `${import.meta.env.BASE_URL}models/${f}.glb`;
const MA = (f: string) => `${import.meta.env.BASE_URL}models/${f}.glb?rig=5`;
export const MODEL_URLS = {
  bench: M('bench'),
  bag: M('bag'),
  dumbbells: M('dumbbells'),
  trophy: M('trophy'),
  squatRack: M('squat_rack'),
  athlete_m_start: MA('athlete_m_start'),
  athlete_m_elite: MA('athlete_m_elite'),
  athlete_f_start: MA('athlete_f_start'),
  athlete_f_elite: MA('athlete_f_elite'),
  food_avocado: M('food_avocado'),
  food_water: M('food_water'),
  food_salmon: M('food_salmon'),
  food_donut: M('food_donut'),
  food_soda: M('food_soda'),
};

/** Picks the Magnific athlete GLB for a gender + fitness score. */
export function athleteModelUrl(gender: 'male' | 'female', fitnessScore: number): string {
  const elite = fitnessScore >= 50;
  if (gender === 'female') return elite ? MODEL_URLS.athlete_f_elite : MODEL_URLS.athlete_f_start;
  return elite ? MODEL_URLS.athlete_m_elite : MODEL_URLS.athlete_m_start;
}

export type DecorId = 'bench' | 'dumbbells' | 'squatRack';
const DECOR_SPEC: Record<DecorId, { url: keyof typeof MODEL_URLS; h: number }> = {
  bench: { url: 'bench', h: 1.15 },
  dumbbells: { url: 'dumbbells', h: 0.95 },
  squatRack: { url: 'squatRack', h: 2.3 },
};

/** Async-loads Magnific props as background decoration, left/right of the focus. */
export function addGymDecor(
  scene: THREE.Scene,
  items: DecorId[],
  opts: {
    focus?: { x: number; z: number };
    floorY?: number;
    spread?: number;
    depth?: number;
    isCancelled?: () => boolean;
  } = {}
): void {
  const { focus = { x: 0, z: 0 }, floorY = 0, spread = 2.9, depth = 2.6, isCancelled } = opts;
  items.forEach((id, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const spec = DECOR_SPEC[id];
    loadGlbAsset(MODEL_URLS[spec.url], spec.h)
      .then(({ root }) => {
        if (isCancelled?.()) {
          disposeObject3D(root);
          return;
        }
        if (!isCancelled && !scene.parent && scene.children.length === 0) {
          disposeObject3D(root);
          return;
        }
        root.position.set(focus.x + side * (spread + row * 1.2), floorY, focus.z - depth - row * 1.1);
        root.rotation.y = -side * 0.55;
        scene.add(root);
      })
      .catch(() => {});
  });
}

/**
 * Loads a GLB (cached), clones it, scales it to `height` metres,
 * centres it on X/Z and sits it on y = 0. Returns the wrapper group
 * plus any animation clips the file contains.
 */
export async function loadGlbAsset(
  url: string,
  height: number,
  opts: { anchor?: 'bottom' | 'top'; cloneMaterials?: boolean } = {}
): Promise<{ root: THREE.Group; animations: THREE.AnimationClip[] }> {
  let p = gltfCache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url);
    gltfCache.set(url, p);
  }
  const gltf = await p;
  const model = cloneSkinned(gltf.scene) as THREE.Object3D;

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = height / Math.max(0.0001, size.y);
  model.scale.multiplyScalar(s);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const c = box2.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= opts.anchor === 'top' ? box2.max.y : box2.min.y;

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.userData.sharedGlbGeometry = true;
      m.userData.sharedGlbMaterial = true;
      if (opts.cloneMaterials && m.material) {
        m.material = Array.isArray(m.material)
          ? m.material.map((mat) => mat.clone())
          : m.material.clone();
        m.userData.clonedGlbMaterial = true;
      }
    }
  });

  const root = new THREE.Group();
  root.add(model);
  return { root, animations: gltf.animations };
}

/** Warms the GLB cache in the background (parsed once, cloned later). */
export function preloadGlbAssets(urls: string[]): void {
  for (const url of urls) {
    if (gltfCache.has(url)) continue;
    const p = new GLTFLoader().loadAsync(url);
    p.catch(() => gltfCache.delete(url));
    gltfCache.set(url, p);
  }
}
