import * as THREE from 'three';

/**
 * High-detail procedural 3D gym equipment & continuous-geometry helpers.
 * All geometries and materials are allocated once at scene setup so tick()
 * stays strictly zero-allocation.
 */

export function createKnurledSteelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.lineWidth = 1;
    for (let i = -128; i < 256; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 2);
  return tex;
}

export function createPerforatedRackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1f232a';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(4, 0, 4, 256);
    for (let y = 12; y < 250; y += 16) {
      ctx.fillStyle = '#07090d';
      ctx.beginPath();
      ctx.arc(32, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  return tex;
}

export function createTreadmillConsoleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, 512, 256);

    // Subtle bezel border
    ctx.strokeStyle = '#ff5a1f';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 240);

    // Header bar
    ctx.fillStyle = 'rgba(255, 90, 31, 0.16)';
    ctx.fillRect(14, 14, 484, 38);
    ctx.fillStyle = '#ff7a45';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HIIT PRO · TELEMETRY', 28, 40);

    // Equalizer interval bars
    const barCount = 16;
    for (let i = 0; i < barCount; i++) {
      const h = 36 + Math.round(Math.sin(i * 0.55 + 0.6) * 44 + 44);
      ctx.fillStyle = i >= 11 ? '#10b981' : i >= 6 ? '#f59e0b' : '#ff5a1f';
      ctx.fillRect(28 + i * 28, 178 - h, 18, h);
    }

    // Bottom metrics strip
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('PACE', 28, 224);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('BPM 164', 180, 224);
    ctx.fillStyle = '#34d399';
    ctx.fillText('HIIT MAX', 350, 224);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createOakPlatformTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#5c3c24';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      const x = i * 32;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,215,170,0.06)' : 'rgba(20,10,5,0.12)';
      ctx.fillRect(x, 0, 32, 256);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let g = 0; g < 160; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,225,190,0.05)';
      ctx.fillRect((g * 37) % 256, (g * 53) % 256, 2, 22 + (g % 30));
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHurdleStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ff5a1f';
    for (let x = -64; x < 320; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.lineTo(x + 24, 64);
      ctx.lineTo(x + 52, 0);
      ctx.lineTo(x + 28, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Detailed Competition Olympic Barbell with knurled grip zones, shoulder collars,
 * machined sleeves, spin-lock clamps, and calibrated bumper plates (with inner steel hub + rim).
 */
export function buildOlympicBarbell(opts: {
  plateBaseX?: number;
  maxPlates?: number;
  plateStep?: number;
  plateBaseRadius?: number;
} = {}): {
  group: THREE.Group;
  platePairs: [THREE.Group, THREE.Group][];
} {
  const {
    plateBaseX = 1.2,
    maxPlates = 5,
    plateStep = 0.07,
    plateBaseRadius = 0.35,
  } = opts;

  const group = new THREE.Group();

  const knurlTex = createKnurledSteelTexture();
  const barSteelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.24,
    metalness: 0.92,
  });
  const knurlMat = new THREE.MeshStandardMaterial({
    map: knurlTex,
    roughness: 0.5,
    metalness: 0.85,
  });
  const collarMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    metalness: 0.95,
    roughness: 0.14,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.86,
    roughness: 0.28,
  });
  const rubberBlackMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.62,
    metalness: 0.12,
  });

  // Main shaft + dual knurled grip sleeves + machined inner shoulders
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 2.22, 18), barSteelMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  group.add(shaft);

  for (const side of [-1, 1]) {
    const knurl = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.44, 18), knurlMat);
    knurl.rotation.z = Math.PI / 2;
    knurl.position.x = side * 0.56;
    group.add(knurl);

    // Shoulder stop flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.045, 20), collarMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = side * 1.11;
    group.add(flange);

    // Rotating Olympic sleeve
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.52, 20), collarMat);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.x = side * 1.39;
    sleeve.castShadow = true;
    group.add(sleeve);

    // End cap bolt
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), rubberBlackMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = side * 1.655;
    group.add(cap);
  }

  // Calibrated Competition Bumper Plates
  const plateColors = [0xff5a1f, 0x0284c7, 0x10b981, 0xf59e0b, 0xe11d48];
  const platePairs: [THREE.Group, THREE.Group][] = [];

  const createPlate = (radius: number, colorHex: number) => {
    const pGrp = new THREE.Group();
    const colorMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.42,
      metalness: 0.16,
    });

    // Recessed core disc
    const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.046, 30), colorMat);
    core.rotation.z = Math.PI / 2;
    core.castShadow = true;
    pGrp.add(core);

    // Thick outer rubber bumper lip
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.91, 0.032, 12, 32), rubberBlackMat);
    rim.rotation.y = Math.PI / 2;
    rim.castShadow = true;
    pGrp.add(rim);

    // Colored weight ring stripe
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.011, 8, 28), colorMat);
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = 0.022;
    pGrp.add(stripe);

    const stripeBack = stripe.clone();
    stripeBack.position.x = -0.022;
    pGrp.add(stripeBack);

    // Brushed steel Olympic inner hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.056, 20), hubMat);
    hub.rotation.z = Math.PI / 2;
    pGrp.add(hub);

    // Chrome quick-lock collar ring detail on outer edge
    return pGrp;
  };

  for (let i = 0; i < maxPlates; i++) {
    const r = plateBaseRadius - i * 0.024;
    const leftP = createPlate(r, plateColors[i % plateColors.length]);
    leftP.position.x = -(plateBaseX + i * plateStep);
    const rightP = createPlate(r, plateColors[i % plateColors.length]);
    rightP.position.x = plateBaseX + i * plateStep;
    group.add(leftP, rightP);
    platePairs.push([leftP, rightP]);
  }

  // Spin-lock competition clamp collars near end of sleeve
  for (const side of [-1, 1]) {
    const clamp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 18), collarMat);
    body.rotation.z = Math.PI / 2;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.02), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35 }));
    lever.position.set(0, 0.048, 0);
    clamp.add(body, lever);
    clamp.position.x = side * (plateBaseX + maxPlates * plateStep + 0.02);
    group.add(clamp);
  }

  return { group, platePairs };
}

/**
 * Commercial Competition Squat Rack / Power Cage with oak+rubber lifting platform,
 * perforated steel uprights, J-cups, spotter bars, side plate storage horns, and chalk bowl.
 */
export function buildSquatCage3D(): {
  group: THREE.Group;
  depthRingMat: THREE.MeshStandardMaterial;
  depthRing: THREE.Mesh;
} {
  const group = new THREE.Group();

  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.78, metalness: 0.06 });
  const oakTex = createOakPlatformTexture();
  const oakMat = new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.48, metalness: 0.08 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.38, metalness: 0.82 });
  const perfTex = createPerforatedRackTexture();
  const perfSteelMat = new THREE.MeshStandardMaterial({ map: perfTex, roughness: 0.38, metalness: 0.78 });
  const safetyMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.32, metalness: 0.35 });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.16 });

  // Olympic Lifting Platform (Oak center strip + rubber drop zones + beveled steel border)
  const oakCenter = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.075, 2.05), oakMat);
  oakCenter.position.set(0, 0.038, 0);
  oakCenter.receiveShadow = true;
  group.add(oakCenter);

  for (const side of [-1, 1]) {
    const dropZone = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.075, 2.05), rubberMat);
    dropZone.position.set(side * 1.07, 0.038, 0);
    dropZone.receiveShadow = true;
    group.add(dropZone);
  }
  const trimFront = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.045, 0.05), steelMat);
  trimFront.position.set(0, 0.025, 1.04);
  group.add(trimFront);

  // Welded Base Skids + Gussets
  for (const side of [-1.05, 1.05]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 1.45), steelMat);
    skid.position.set(side, 0.1, 0.05);
    skid.castShadow = true;
    group.add(skid);
  }

  // 4 Perforated Uprights + Top Crossbeams + Pull-Up Bar
  const postGeo = new THREE.BoxGeometry(0.1, 2.42, 0.1);
  const postCoords: [number, number][] = [
    [-1.05, -0.45],
    [1.05, -0.45],
    [-1.05, 0.55],
    [1.05, 0.55],
  ];
  for (const [px, pz] of postCoords) {
    const post = new THREE.Mesh(postGeo, perfSteelMat);
    post.position.set(px, 1.29, pz);
    post.castShadow = true;
    group.add(post);

    const footPlate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), steelMat);
    footPlate.position.set(px, 0.09, pz);
    group.add(footPlate);
  }

  // Top side rails + rear crossbeam + front pull-up bar
  for (const side of [-1.05, 1.05]) {
    const topSide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.12), steelMat);
    topSide.position.set(side, 2.46, 0.05);
    group.add(topSide);
  }
  const topRear = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.1), steelMat);
  topRear.position.set(0, 2.46, -0.45);
  group.add(topRear);

  const pullUpBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 2.1, 14), chromeMat);
  pullUpBar.rotation.z = Math.PI / 2;
  pullUpBar.position.set(0, 2.42, 0.55);
  group.add(pullUpBar);

  // J-Cups + Safety Spotter Pins with Orange Guard Strips
  for (const side of [-1, 1]) {
    const sx = side * 1.05;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 1.02), safetyMat);
    arm.position.set(sx, 0.86, 0.05);
    arm.castShadow = true;
    group.add(arm);

    const jcup = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.14), chromeMat);
    jcup.position.set(side * 0.98, 1.5, 0.12);
    group.add(jcup);

    // Side weight storage horn + spare plate
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12), chromeMat);
    horn.rotation.z = Math.PI / 2;
    horn.position.set(side * 1.22, 0.72, -0.45);
    const sparePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 22), rubberMat);
    sparePlate.rotation.z = Math.PI / 2;
    sparePlate.position.set(side * 1.18, 0.72, -0.45);
    group.add(horn, sparePlate);
  }

  // Chalk Stand & Bowl on right side of platform
  const chalkStand = new THREE.Group();
  chalkStand.position.set(1.56, 0, 0.65);
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), steelMat);
  standBase.position.y = 0.02;
  const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.88, 12), steelMat);
  standPole.position.y = 0.46;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.12, 0.14, 18), chromeMat);
  bowl.position.y = 0.92;
  const chalkMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 })
  );
  chalkMound.scale.set(1, 0.45, 1);
  chalkMound.position.y = 0.96;
  chalkStand.add(standBase, standPole, bowl, chalkMound);
  group.add(chalkStand);

  // Depth Ring on Oak Platform
  const depthRingMat = new THREE.MeshStandardMaterial({
    color: 0xff6a2b,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });
  const depthRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.028, 12, 48), depthRingMat);
  depthRing.rotation.x = Math.PI / 2;
  depthRing.position.set(0, 0.088, 0.12);
  group.add(depthRing);

  return { group, depthRingMat, depthRing };
}

/**
 * Commercial Bench Press Rack + Contoured Stitched Bench Cushion + Safety Spotters.
 */
export function buildBenchPressStation3D(): {
  group: THREE.Group;
  rackLedMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.36, metalness: 0.84 });
  const perfTex = createPerforatedRackTexture();
  const perfMat = new THREE.MeshStandardMaterial({ map: perfTex, roughness: 0.36, metalness: 0.8 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x18191e, roughness: 0.52, metalness: 0.08 });
  const bolsterMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.42, metalness: 0.14 });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.16 });

  // Competition Half-Rack Uprights + Base Runners
  const postGeo = new THREE.BoxGeometry(0.11, 2.35, 0.11);
  for (const [px, pz] of [
    [-1.08, -0.45],
    [1.08, -0.45],
    [-1.08, 0.42],
    [1.08, 0.42],
  ] as [number, number][]) {
    const post = new THREE.Mesh(postGeo, perfMat);
    post.position.set(px, 1.18, pz);
    post.castShadow = true;
    group.add(post);
  }

  for (const side of [-1.08, 1.08]) {
    const baseRun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 1.2), steelMat);
    baseRun.position.set(side, 0.035, 0);
    const topSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 1.02), steelMat);
    topSide.position.set(side, 2.34, 0);
    const jCup = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.14), chromeMat);
    jCup.position.set(side * 0.94, 0.98, 0.05);
    const spotter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.95), bolsterMat);
    spotter.position.set(side, 0.64, 0);
    group.add(baseRun, topSide, jCup, spotter);
  }

  const topCross = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.11), steelMat);
  topCross.position.set(0, 2.34, -0.45);
  group.add(topCross);

  // Reactive LED Strips along front posts
  const rackLedMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.35,
    roughness: 0.25,
  });
  for (const sideX of [-1.02, 1.02]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.85, 0.025), rackLedMat);
    strip.position.set(sideX, 1.18, 0.48);
    group.add(strip);
  }

  // Ergonomic Competition Bench (welded spine + T-feet + contoured stitched cushion)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 1.5), steelMat);
  spine.position.set(0, 0.44, 0.22);
  const rearFoot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.12), steelMat);
  rearFoot.position.set(0, 0.03, -0.42);
  const frontFoot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.12), steelMat);
  frontFoot.position.set(0, 0.03, 0.85);
  const legRear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.12), steelMat);
  legRear.position.set(0, 0.22, -0.42);
  const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.12), steelMat);
  legFront.position.set(0, 0.22, 0.85);
  group.add(spine, rearFoot, frontFoot, legRear, legFront);

  // Thick leather bench pad + side accent trim
  const mainPad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 1.48), padMat);
  mainPad.position.set(0, 0.56, 0.22);
  mainPad.castShadow = true;
  mainPad.receiveShadow = true;
  group.add(mainPad);

  for (const side of [-0.235, 0.235]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 1.44), bolsterMat);
    trim.position.set(side, 0.56, 0.22);
    group.add(trim);
  }

  // Headrest rounded cap
  const headrest = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.13, 18), padMat);
  headrest.position.set(0, 0.56, -0.52);
  headrest.castShadow = true;
  group.add(headrest);

  return { group, rackLedMat };
}

/**
 * Commercial Motorized Gym Treadmill Shell (Motor hood cowl, twin curved handrails,
 * glowing telemetry console, side footboards, front & rear steel roller drums).
 */
export function buildTreadmillStation3D(): {
  group: THREE.Group;
  consoleGlowMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x181b21, roughness: 0.45, metalness: 0.58 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.32, metalness: 0.45 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.82, metalness: 0.08 });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.2 });

  // Non-slip aluminum side stepboards along entire running lane
  for (const side of [-1, 1]) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 18.2), chassisMat);
    step.position.set(side * 0.96, 0.06, -5);
    step.receiveShadow = true;
    const orangeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 18.2), accentMat);
    orangeTrim.position.set(side * 1.05, 0.1, -5);
    group.add(step, orangeTrim);
  }

  // Rear Steel Roller Drum
  const rearRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.85, 16), chromeMat);
  rearRoller.rotation.z = Math.PI / 2;
  rearRoller.position.set(0, 0.06, 3.85);
  group.add(rearRoller);

  // Open-lane Pro HIIT Treadmill Console Gantry (hurdles pass cleanly underneath along x=0)
  const frontDeck = new THREE.Group();
  frontDeck.position.set(0, 0, -2.15);

  // Twin side motor housings + front roller ends outside the obstacle lane
  for (const side of [-1, 1]) {
    const sideHousing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.86), chassisMat);
    sideHousing.position.set(side * 1.08, 0.16, 0);
    sideHousing.castShadow = true;

    const sideCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 16), accentMat);
    sideCap.rotation.z = Math.PI / 2;
    sideCap.position.set(side * 1.08, 0.22, 0.38);
    frontDeck.add(sideHousing, sideCap);

    // Angled side upright pillars + curved ergonomic handrails
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.82, 0.14), chassisMat);
    mast.position.set(side * 1.04, 1.02, 0.05);
    mast.rotation.x = -0.14;
    mast.castShadow = true;
    frontDeck.add(mast);

    const railCurve = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.72, 6, 12), gripMat);
    railCurve.rotation.x = Math.PI / 2 - 0.15;
    railCurve.position.set(side * 1.02, 1.15, 0.48);
    frontDeck.add(railCurve);

    // Water bottle holder pods
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 14), gripMat);
    pod.position.set(side * 1.02, 1.56, 0.24);
    frontDeck.add(pod);
  }

  // Elevated Telemetry Console Bridge (high above runner & 0.6m hurdles)
  const consoleFrame = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.52, 0.24), chassisMat);
  consoleFrame.position.set(0, 1.98, 0.14);
  consoleFrame.rotation.x = -0.35;
  consoleFrame.castShadow = true;
  frontDeck.add(consoleFrame);

  const consoleTex = createTreadmillConsoleTexture();
  const consoleGlowMat = new THREE.MeshStandardMaterial({
    map: consoleTex,
    emissive: 0xff5a1f,
    emissiveMap: consoleTex,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4), consoleGlowMat);
  screen.position.set(0, 1.99, 0.27);
  screen.rotation.x = -0.35;
  frontDeck.add(screen);

  group.add(frontDeck);
  return { group, consoleGlowMat };
}

/**
 * Competition Athletic Track Hurdle (weighted steel T-base, upright telescoping posts,
 * orange-white striped crossbar).
 */
export function buildTrackHurdle3D(stripeTex: THREE.CanvasTexture): THREE.Group {
  const grp = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.88 });
  const boardMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.35, metalness: 0.08 });

  for (const side of [-0.56, 0.56]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.52), steelMat);
    foot.position.set(side, 0.022, 0.08);
    foot.castShadow = true;

    const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.56, 12), chromeMat);
    upright.position.set(side, 0.3, 0);
    upright.castShadow = true;

    grp.add(foot, upright);
  }

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.16, 0.04), boardMat);
  crossbar.position.set(0, 0.52, 0);
  crossbar.castShadow = true;
  grp.add(crossbar);

  return grp;
}

/**
 * Heavy Steel Boxing Bag A-Frame Gantry + Overhead Swivel Bracket.
 */
export function buildBoxingRig3D(): THREE.Group {
  const grp = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.35, metalness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35, metalness: 0.35 });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.18 });

  // Side A-frame legs standing wide out of target pad area
  for (const side of [-1, 1]) {
    const sx = side * 1.55;
    const baseSkid = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 1.45), steelMat);
    baseSkid.position.set(sx, 0.035, 0);
    baseSkid.receiveShadow = true;

    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.82, 0.12), steelMat);
    upright.position.set(sx, 1.42, 0);
    upright.castShadow = true;

    const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.68, 0.08), accentMat);
    gusset.position.set(side * 1.32, 2.52, 0);
    gusset.rotation.z = side * 0.78;

    const frontBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), steelMat);
    frontBrace.position.set(sx, 0.32, 0.38);
    frontBrace.rotation.x = 0.68;

    const rearBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), steelMat);
    rearBrace.position.set(sx, 0.32, -0.38);
    rearBrace.rotation.x = -0.68;

    grp.add(baseSkid, upright, gusset, frontBrace, rearBrace);
  }

  // Overhead I-Beam + Swivel D-Ring Shackle
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.13, 0.16), steelMat);
  topBeam.position.set(0, 2.78, 0);
  topBeam.castShadow = true;

  const centerBracket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.2), accentMat);
  centerBracket.position.set(0, 2.71, 0);

  const swivelRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 10, 20), chromeMat);
  swivelRing.position.set(0, 2.65, 0);

  grp.add(topBeam, centerBracket, swivelRing);
  return grp;
}

/**
 * Sculpted 3D Leather Boxing Glove for kinetic punch feedback.
 */
export function buildBoxingGlove3D(side: -1 | 1): THREE.Group {
  const grp = new THREE.Group();

  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.3,
    metalness: 0.14,
    clearcoat: 0.35,
  });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

  // Main padded fist dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 16), leatherMat);
  dome.scale.set(0.95, 0.92, 1.25);
  dome.castShadow = true;
  grp.add(dome);

  // Locked boxing thumb on inner side
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.11, 6, 10), leatherMat);
  thumb.position.set(-side * 0.13, -0.02, 0.04);
  thumb.rotation.z = side * 0.42;
  thumb.rotation.x = 0.45;
  grp.add(thumb);

  // Velcro wrist cuff + white stripe
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.16, 16), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, -0.02, 0.22);
  grp.add(cuff);

  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 20), trimMat);
  stripe.position.set(0, -0.02, 0.17);
  grp.add(stripe);

  return grp;
}

/**
 * Allocates N cylinder segments forming a solid continuous flexible rope curve.
 * Update positions every frame with updateRopeChain() with zero heap allocations.
 */
export function buildContinuousRopeChain(
  segmentCount: number,
  radius: number,
  primaryMat: THREE.Material,
  accentMat?: THREE.Material,
  stripeEvery = 4
): THREE.Mesh[] {
  const unitGeo = new THREE.CylinderGeometry(radius, radius, 1.0, 10);
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const mat = accentMat && i % stripeEvery === 0 ? accentMat : primaryMat;
    const mesh = new THREE.Mesh(unitGeo, mat);
    mesh.castShadow = true;
    segs.push(mesh);
  }
  return segs;
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export function updateRopeChain(
  segments: THREE.Mesh[],
  points: THREE.Vector3[],
  tmpMid: THREE.Vector3,
  tmpDir: THREE.Vector3
): void {
  const count = Math.min(segments.length, points.length - 1);
  for (let i = 0; i < count; i++) {
    const pA = points[i];
    const pB = points[i + 1];
    tmpMid.addVectors(pA, pB).multiplyScalar(0.5);
    tmpDir.subVectors(pB, pA);
    const len = tmpDir.length();
    const seg = segments[i];
    seg.position.copy(tmpMid);
    if (len > 0.0001) {
      tmpDir.divideScalar(len);
      seg.quaternion.setFromUnitVectors(UP_AXIS, tmpDir);
      seg.scale.set(1, len * 1.08, 1);
    }
  }
}
