import * as THREE from 'three';
import { Gender, OutfitId } from '../types/game';
import { OUTFITS } from '../data/gameData';

export interface AthleteRigParts {
  root: THREE.Group;
  pelvisGroup: THREE.Group;
  upperBody: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  ponytailGroup?: THREE.Group;
  shadowMesh: THREE.Mesh;
  buffRing: THREE.Mesh;
}

export interface AthleteBuildOptions {
  gender: Gender;
  fitnessScore: number;
  skinTone: string;
  hairColor: string;
  outfit: OutfitId;
  hasBuff?: boolean;
  pose?: 'idle' | 'flex' | 'tired';
}

function createAthleticShirtTexture(
  baseHex: string,
  accentHex: string,
  fitnessRatio: number,
  isMale: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Breathable athletic micro-mesh weave
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let y = 0; y < 256; y += 4) {
      for (let x = y % 8 === 0 ? 0 : 2; x < 256; x += 4) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Side compression ventilation panels
    ctx.fillStyle = 'rgba(10, 14, 22, 0.34)';
    ctx.fillRect(0, 0, 28, 256);
    ctx.fillRect(228, 0, 28, 256);
    ctx.fillRect(114, 0, 28, 256);

    // Side seam racing accent stripes
    ctx.fillStyle = accentHex;
    ctx.fillRect(26, 16, 4, 224);
    ctx.fillRect(226, 16, 4, 224);

    // Accent V-chevron & GymBros crest on front chest (centered around x=64 on Lathe UV)
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(28, 66);
    ctx.lineTo(64, 86);
    ctx.lineTo(100, 66);
    ctx.stroke();

    // Small chest badge bar
    ctx.fillStyle = accentHex;
    ctx.fillRect(54, 48, 20, 6);

    // Subtle muscle definition shading when fitter
    if (fitnessRatio > 0.3) {
      const alpha = Math.min(0.28, (fitnessRatio - 0.3) * 0.38);
      ctx.strokeStyle = `rgba(15, 23, 42, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, 108);
      ctx.quadraticCurveTo(64, 116, 90, 108);
      ctx.stroke();

      // Linea alba center shading
      ctx.beginPath();
      ctx.moveTo(64, 114);
      ctx.lineTo(64, 210);
      ctx.stroke();

      if (isMale && fitnessRatio > 0.5) {
        for (let row = 0; row < 3; row++) {
          const yy = 132 + row * 22;
          ctx.beginPath();
          ctx.moveTo(46, yy);
          ctx.lineTo(82, yy);
          ctx.stroke();
        }
      }
    }

    // Collar & bottom hem stitching
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 256, 8);
    ctx.fillRect(0, 244, 256, 12);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShortsTexture(accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#18202c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 420; i++) {
      ctx.fillRect((i * 29) % 128, (i * 53) % 128, 1, 1);
    }
    // Side sporty stripes
    ctx.fillStyle = accentHex;
    ctx.fillRect(10, 0, 6, 128);
    ctx.fillRect(74, 0, 6, 128);
    // Hem line
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 122, 128, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildAthleteModel(opts: AthleteBuildOptions): AthleteRigParts {
  const { gender, fitnessScore, skinTone, hairColor, outfit, hasBuff = false, pose = 'idle' } = opts;
  const p = THREE.MathUtils.clamp((fitnessScore - 12) / 88, 0, 1);
  const isMale = gender === 'male';

  const root = new THREE.Group();

  const outfitHex = OUTFITS[outfit]?.color || '#64748B';
  const accentHex = outfit === 'titan' ? '#FBBF24' : outfit === 'pro' ? '#34D399' : '#FF5A1F';

  // Calibrated PBR Materials
  const skinBaseColor = new THREE.Color(skinTone);
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinBaseColor,
    roughness: 0.56,
    metalness: 0.02,
    sheen: 0.25,
    sheenColor: new THREE.Color('#ffd6c4'),
  });

  const lipColor = skinBaseColor.clone().lerp(new THREE.Color('#9F1239'), 0.38);
  const lipMat = new THREE.MeshStandardMaterial({
    color: lipColor,
    roughness: 0.45,
    metalness: 0.02,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hairColor),
    roughness: 0.64,
    metalness: 0.08,
  });

  const shirtTex = createAthleticShirtTexture(outfitHex, accentHex, p, isMale);
  const shirtMat = new THREE.MeshPhysicalMaterial({
    map: shirtTex,
    roughness: outfit === 'titan' ? 0.32 : 0.65,
    metalness: outfit === 'titan' ? 0.34 : 0.06,
    sheen: 0.22,
    sheenColor: new THREE.Color('#ffffff'),
  });

  const shortsTex = createShortsTexture(accentHex);
  const shortsMat = new THREE.MeshStandardMaterial({
    map: shortsTex,
    roughness: 0.7,
    metalness: 0.05,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: outfit === 'titan' ? 0.22 : 0.36,
    metalness: outfit === 'titan' ? 0.84 : 0.22,
  });

  const sockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F1F5F9'),
    roughness: 0.85,
  });

  const shoeUpperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#14171f'),
    roughness: 0.42,
    metalness: 0.14,
  });

  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F8FAFC'),
    roughness: 0.46,
    metalness: 0.05,
  });

  const shoeTreadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#090b0f'),
    roughness: 0.82,
    metalness: 0.05,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#181a20'),
    roughness: 0.55,
    metalness: 0.15,
  });

  const sleeveCompressionMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#11141a'),
    roughness: 0.62,
    metalness: 0.1,
  });

  const scleraMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.18,
  });

  const irisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isMale ? '#3B2F2F' : '#1E3A5F'),
    roughness: 0.14,
  });

  const pupilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#090D16'),
    roughness: 0.08,
  });

  // Anatomical Proportions driven by fitness transformation (0 = out of shape, 1 = elite)
  const shoulderW = isMale ? 0.255 + p * 0.125 : 0.21 + p * 0.075;
  const waistR = isMale ? 0.235 - p * 0.085 : 0.215 - p * 0.08;
  const hipR = isMale ? 0.215 - p * 0.04 : 0.235 - p * 0.035;
  const chestR = isMale ? 0.23 + p * 0.07 : 0.205 + p * 0.04;
  const bellyDepth = 1 + (1 - p) * 0.36;
  const armR = isMale ? 0.056 + p * 0.034 : 0.049 + p * 0.022;
  const thighR = isMale ? 0.092 + p * 0.022 : 0.095 + p * 0.016;

  // Ground contact shadow
  const shadowGeo = new THREE.CircleGeometry(0.46, 28);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.01;
  root.add(shadowMesh);

  // Buff aura ring
  const buffGeo = new THREE.TorusGeometry(0.56, 0.018, 12, 48);
  buffGeo.rotateX(Math.PI / 2);
  const buffMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    emissive: 0xea580c,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const buffRing = new THREE.Mesh(buffGeo, buffMat);
  buffRing.position.y = 0.03;
  buffRing.visible = hasBuff;
  root.add(buffRing);

  // Sculpted Leg Builder (Hip Joint -> Quad -> Knee Sleeve/Cap -> Calf -> Crew Sock -> Detailed Multi-Layer Sneaker)
  const buildLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * (hipR * 0.54), 0.88, 0);

    // Seamless hip sphere
    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(thighR * 0.98, 14, 12), shortsMat);
    legPivot.add(hipBall);

    // Tapered athletic shorts sleeve + sculpted quad
    const thighProfile = [
      new THREE.Vector2(0.01, -0.4),
      new THREE.Vector2(thighR * 0.66, -0.39),
      new THREE.Vector2(thighR * 0.84, -0.31),
      new THREE.Vector2(thighR * 1.04, -0.24),
      new THREE.Vector2(thighR * 1.08, -0.06),
      new THREE.Vector2(thighR * 1.02, 0.02),
      new THREE.Vector2(0.01, 0.03),
    ];
    const shortsMesh = new THREE.Mesh(new THREE.LatheGeometry(thighProfile.slice(2), 18), shortsMat);
    shortsMesh.castShadow = true;
    legPivot.add(shortsMesh);

    const shortsHem = new THREE.Mesh(
      new THREE.TorusGeometry(thighR * 0.98, 0.011, 8, 20),
      accentMat
    );
    shortsHem.rotation.x = Math.PI / 2;
    shortsHem.position.y = -0.235;
    legPivot.add(shortsHem);

    const lowerQuadGeo = new THREE.CylinderGeometry(thighR * 0.86, thighR * 0.67, 0.16, 16);
    const lowerQuad = new THREE.Mesh(lowerQuadGeo, skinMat);
    lowerQuad.position.y = -0.31;
    lowerQuad.castShadow = true;
    legPivot.add(lowerQuad);

    // Knee Pivot
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.4, 0);
    legPivot.add(kneePivot);

    const useKneeSleeve = outfit === 'pro' || outfit === 'titan' || p > 0.6;
    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(thighR * 0.66, 14, 12),
      useKneeSleeve ? sleeveCompressionMat : skinMat
    );
    kneeCap.scale.set(0.96, 1.0, 1.08);
    kneeCap.castShadow = true;
    kneePivot.add(kneeCap);

    if (useKneeSleeve) {
      const kneeBand = new THREE.Mesh(
        new THREE.CylinderGeometry(thighR * 0.72, thighR * 0.69, 0.09, 14),
        sleeveCompressionMat
      );
      kneeBand.position.y = -0.02;
      const kneeTrim = new THREE.Mesh(
        new THREE.TorusGeometry(thighR * 0.71, 0.009, 6, 18),
        accentMat
      );
      kneeTrim.rotation.x = Math.PI / 2;
      kneeTrim.position.y = 0.025;
      kneePivot.add(kneeBand, kneeTrim);
    }

    // Anatomically curved calf
    const calfProfile = [
      new THREE.Vector2(0.01, -0.39),
      new THREE.Vector2(thighR * 0.42, -0.38),
      new THREE.Vector2(thighR * 0.56, -0.26),
      new THREE.Vector2(thighR * (0.74 + p * 0.09), -0.14),
      new THREE.Vector2(thighR * 0.68, -0.04),
      new THREE.Vector2(thighR * 0.6, 0.0),
    ];
    const calfMesh = new THREE.Mesh(new THREE.LatheGeometry(calfProfile, 16), skinMat);
    calfMesh.castShadow = true;
    kneePivot.add(calfMesh);

    // Athletic Crew Sock
    const sockMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(thighR * 0.47, thighR * 0.44, 0.11, 14),
      sockMat
    );
    sockMesh.position.y = -0.35;
    kneePivot.add(sockMesh);

    const sockStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(thighR * 0.48, thighR * 0.48, 0.022, 14),
      accentMat
    );
    sockStripe.position.y = -0.31;
    kneePivot.add(sockStripe);

    // Multi-Part Sculpted Athletic Trainer Sneaker
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.44, 0.048);

    // Grip outsole pad
    const outsole = new THREE.Mesh(new THREE.CapsuleGeometry(0.063, 0.15, 6, 14), shoeTreadMat);
    outsole.rotation.x = Math.PI / 2;
    outsole.scale.set(1.06, 1.0, 0.2);
    outsole.position.set(0, -0.036, 0.015);
    shoeGroup.add(outsole);

    // Cushioned EVA midsole
    const midsole = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.146, 6, 14), shoeSoleMat);
    midsole.rotation.x = Math.PI / 2;
    midsole.scale.set(1.05, 1.0, 0.42);
    midsole.position.set(0, -0.018, 0.015);
    midsole.castShadow = true;
    shoeGroup.add(midsole);

    // Upper sneaker body + sculpted vamp
    const upperBodyShoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.125, 8, 14), shoeUpperMat);
    upperBodyShoe.rotation.x = Math.PI / 2;
    upperBodyShoe.scale.set(1.02, 1.0, 0.78);
    upperBodyShoe.position.set(0, 0.016, 0.01);
    upperBodyShoe.castShadow = true;
    shoeGroup.add(upperBodyShoe);

    // Heel stabilizer counter clip + padded collar + laces crossbars
    const heelClip = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.045, 14, 1, false, Math.PI * 0.55, Math.PI * 0.9), accentMat);
    heelClip.position.set(0, 0.008, -0.055);
    shoeGroup.add(heelClip);

    const heelCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.075, 14), accentMat);
    heelCollar.position.set(0, 0.04, -0.055);
    shoeGroup.add(heelCollar);

    const tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.044, 0.075), accentMat);
    tongueMesh.position.set(0, 0.054, 0.015);
    tongueMesh.rotation.x = -0.38;
    shoeGroup.add(tongueMesh);

    // Crisp side sneaker stripes & lace bars
    for (const sSide of [-0.057, 0.057]) {
      const sideBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.105), accentMat);
      sideBar.position.set(sSide, 0.015, 0.008);
      sideBar.rotation.x = -0.18;
      shoeGroup.add(sideBar);
    }
    for (let l = 0; l < 3; l++) {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.007, 0.012), shoeSoleMat);
      lace.position.set(0, 0.047 - l * 0.008, 0.028 + l * 0.025);
      shoeGroup.add(lace);
    }

    kneePivot.add(shoeGroup);
    return { legPivot, kneePivot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  root.add(leftLeg.legPivot, rightLeg.legPivot);

  // Pelvis / Sculpted Shorts Waist + Optional Weightlifting Belt
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.92;
  root.add(pelvisGroup);

  const pelvisProfile = [
    new THREE.Vector2(0.01, -0.1),
    new THREE.Vector2(hipR * 1.02, -0.08),
    new THREE.Vector2(hipR * 1.04, 0.01),
    new THREE.Vector2(waistR * 1.01, 0.1),
    new THREE.Vector2(0.01, 0.11),
  ];
  const pelvisMesh = new THREE.Mesh(new THREE.LatheGeometry(pelvisProfile, 24), shortsMat);
  pelvisMesh.scale.set(1, 1, bellyDepth * 0.84);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  const waistbandMesh = new THREE.Mesh(
    new THREE.TorusGeometry(waistR * 0.96, 0.024, 10, 28),
    accentMat
  );
  waistbandMesh.rotation.x = Math.PI / 2;
  waistbandMesh.scale.set(1, bellyDepth * 0.84, 1);
  waistbandMesh.position.y = 0.1;
  pelvisGroup.add(waistbandMesh);

  if (outfit === 'pro' || outfit === 'titan') {
    const liftBelt = new THREE.Mesh(
      new THREE.CylinderGeometry(waistR * 1.04, waistR * 1.05, 0.095, 24, 1, true),
      gloveMat
    );
    liftBelt.scale.set(1, 1, bellyDepth * 0.84);
    liftBelt.position.y = 0.11;
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.068, 0.024),
      accentMat
    );
    buckle.position.set(0, 0.11, waistR * 0.86 * bellyDepth);
    pelvisGroup.add(liftBelt, buckle);
  }

  // Upper Body Group (pivoted at waist y = 1.02)
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 1.02, 0);
  root.add(upperBody);

  // Sculpted Torso using high-res anatomical Lathe profile
  const torsoProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(waistR * 0.99, 0.02),
    new THREE.Vector2(waistR * (1.06 - p * 0.15), 0.16),
    new THREE.Vector2(chestR * 0.94, 0.33),
    new THREE.Vector2(chestR * 1.02, 0.44),
    new THREE.Vector2(shoulderW * 0.92, 0.54),
    new THREE.Vector2(0.115, 0.59),
    new THREE.Vector2(0.075, 0.62),
    new THREE.Vector2(0.01, 0.625),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 28);
  const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
  torsoMesh.scale.set(1, 1, 0.7 * bellyDepth);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  upperBody.add(torsoMesh);

  // Collar trim ring
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 10, 24), accentMat);
  collarRing.rotation.x = Math.PI / 2 - 0.12;
  collarRing.position.set(0, 0.595, 0.01);
  upperBody.add(collarRing);

  // Subtle anatomical pectoral contour when athletic
  if (p > 0.32) {
    const pecGeo = new THREE.SphereGeometry(0.095, 16, 14);
    pecGeo.scale(1.12, 0.74, 0.52);
    const leftPec = new THREE.Mesh(pecGeo, shirtMat);
    leftPec.position.set(-0.082, 0.41, chestR * 0.51);
    const rightPec = new THREE.Mesh(pecGeo, shirtMat);
    rightPec.position.set(0.082, 0.41, chestR * 0.51);
    upperBody.add(leftPec, rightPec);
  }

  // Sculpted Articulated Arms (Shoulder Sleeve + Bicep Lathe + Elbow + Forearm + Wristband + Lifting Glove)
  const buildArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * (shoulderW * 0.95 + armR * 0.42), 0.51, 0);

    // Fitted athletic sleeve / shoulder deltoid cap + trim ring
    const deltGeo = new THREE.SphereGeometry(armR * (1.16 + p * 0.18), 16, 14);
    deltGeo.scale(1.0, 1.18, 0.96);
    const deltMesh = new THREE.Mesh(deltGeo, shirtMat);
    deltMesh.castShadow = true;
    armPivot.add(deltMesh);

    const sleeveTrim = new THREE.Mesh(
      new THREE.TorusGeometry(armR * 0.96, 0.009, 8, 18),
      accentMat
    );
    sleeveTrim.rotation.x = Math.PI / 2;
    sleeveTrim.position.y = -0.075;
    armPivot.add(sleeveTrim);

    // Sculpted Upper Arm
    const upperArmProfile = [
      new THREE.Vector2(0.01, -0.31),
      new THREE.Vector2(armR * 0.75, -0.3),
      new THREE.Vector2(armR * (0.96 + p * 0.17), -0.17),
      new THREE.Vector2(armR * 0.98, -0.05),
      new THREE.Vector2(armR * 0.88, 0.0),
    ];
    const upperArmMesh = new THREE.Mesh(new THREE.LatheGeometry(upperArmProfile, 16), skinMat);
    upperArmMesh.castShadow = true;
    armPivot.add(upperArmMesh);

    // Forearm pivot at elbow
    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -0.31, 0);
    armPivot.add(forearmPivot);

    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.74, 12, 10), skinMat);
    forearmPivot.add(elbowCap);

    // Sculpted tapered forearm
    const forearmProfile = [
      new THREE.Vector2(0.01, -0.26),
      new THREE.Vector2(armR * 0.56, -0.25),
      new THREE.Vector2(armR * 0.74, -0.13),
      new THREE.Vector2(armR * (0.84 + p * 0.11), -0.05),
      new THREE.Vector2(armR * 0.73, 0.0),
    ];
    const forearmMesh = new THREE.Mesh(new THREE.LatheGeometry(forearmProfile, 14), skinMat);
    forearmMesh.castShadow = true;
    forearmPivot.add(forearmMesh);

    // Athletic Wristband
    const bandMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(armR * 0.65, armR * 0.63, 0.048, 14),
      accentMat
    );
    bandMesh.position.y = -0.228;
    forearmPivot.add(bandMesh);

    // Sculpted Hand + Fingerless Gym Lifting Glove Wrap
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.295, 0.005);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(armR * 0.92, armR * 1.15, armR * 0.58), gloveMat);
    palm.castShadow = true;
    handGroup.add(palm);

    const knucklePad = new THREE.Mesh(new THREE.BoxGeometry(armR * 0.96, armR * 0.34, armR * 0.64), accentMat);
    knucklePad.position.set(0, -armR * 0.32, 0);
    handGroup.add(knucklePad);

    const fingers = new THREE.Mesh(
      new THREE.CapsuleGeometry(armR * 0.38, armR * 0.55, 6, 10),
      skinMat
    );
    fingers.rotation.z = Math.PI / 2;
    fingers.position.set(0, -armR * 0.65, armR * 0.12);
    handGroup.add(fingers);

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(armR * 0.2, armR * 0.38, 6, 8),
      skinMat
    );
    thumb.position.set(-side * armR * 0.46, -armR * 0.15, armR * 0.25);
    thumb.rotation.z = side * 0.45;
    thumb.rotation.x = 0.35;
    handGroup.add(thumb);

    forearmPivot.add(handGroup);
    return { armPivot, forearmPivot };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm.armPivot, rightArm.armPivot);

  // Initial pose setup
  const isFlex = pose === 'flex' || p > 0.75;
  if (isFlex) {
    leftArm.armPivot.rotation.z = -1.22;
    rightArm.armPivot.rotation.z = 1.22;
    leftArm.forearmPivot.rotation.z = -1.65;
    rightArm.forearmPivot.rotation.z = 1.65;
  } else if (pose === 'tired') {
    upperBody.rotation.x = 0.14;
    leftArm.armPivot.rotation.z = -0.18;
    rightArm.armPivot.rotation.z = 0.18;
  } else {
    leftArm.armPivot.rotation.z = -0.2;
    rightArm.armPivot.rotation.z = 0.2;
    leftArm.forearmPivot.rotation.x = -0.22;
    rightArm.forearmPivot.rotation.x = -0.22;
  }

  // Sculpted Neck & Traps Blend
  const neckProfile = [
    new THREE.Vector2(0.01, 0.58),
    new THREE.Vector2(0.095, 0.59),
    new THREE.Vector2(0.068, 0.65),
    new THREE.Vector2(0.063, 0.73),
    new THREE.Vector2(0.01, 0.74),
  ];
  const neckMesh = new THREE.Mesh(new THREE.LatheGeometry(neckProfile, 16), skinMat);
  upperBody.add(neckMesh);

  // Sculpted Head & Expressive Face
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.82, 0.01);
  upperBody.add(headGroup);

  const jawRoundness = 1 + (1 - p) * 0.12;
  const headProfile = [
    new THREE.Vector2(0.005, -0.145),
    new THREE.Vector2(0.072 * jawRoundness, -0.115),
    new THREE.Vector2(0.118 * jawRoundness, -0.055),
    new THREE.Vector2(0.132, 0.015),
    new THREE.Vector2(0.128, 0.085),
    new THREE.Vector2(0.09, 0.135),
    new THREE.Vector2(0.005, 0.152),
  ];
  const headGeo = new THREE.LatheGeometry(headProfile, 26);
  headGeo.scale(isMale ? 0.96 : 0.91, 1.0, 1.06);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.028, 10, 10);
  earGeo.scale(0.45, 1.15, 0.72);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.128, -0.01, -0.01);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.128, -0.01, -0.01);
  headGroup.add(leftEar, rightEar);

  // Layered Expressive Eyes
  const buildEye = (xOffset: number) => {
    const eyeGrp = new THREE.Group();
    eyeGrp.position.set(xOffset, 0.012, 0.118);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), scleraMat);
    sclera.scale.set(1.12, 0.86, 0.65);
    eyeGrp.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), irisMat);
    iris.position.set(0, 0, 0.009);
    iris.scale.set(1, 1, 0.6);
    eyeGrp.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), pupilMat);
    pupil.position.set(0, 0, 0.014);
    eyeGrp.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 6, 6), scleraMat);
    glint.position.set(0.005, 0.004, 0.018);
    eyeGrp.add(glint);

    return eyeGrp;
  };
  headGroup.add(buildEye(-0.048), buildEye(0.048));

  // Expressive Eyebrows
  const browGeo = new THREE.CapsuleGeometry(0.007, 0.036, 4, 8);
  browGeo.rotateZ(Math.PI / 2);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(-0.048, 0.046, 0.122);
  leftBrow.rotation.z = pose === 'tired' ? 0.16 : isFlex ? -0.14 : -0.04;
  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(0.048, 0.046, 0.122);
  rightBrow.rotation.z = pose === 'tired' ? -0.16 : isFlex ? 0.14 : 0.04;
  headGroup.add(leftBrow, rightBrow);

  // Sculpted Nose
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.028, 6, 8), skinMat);
  noseBridge.position.set(0, -0.015, 0.138);
  noseBridge.rotation.x = -0.22;
  headGroup.add(noseBridge);

  // Expressive Mouth
  if (pose === 'tired') {
    const pantMouth = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), lipMat);
    pantMouth.scale.set(1.2, 0.65, 0.5);
    pantMouth.position.set(0, -0.072, 0.125);
    headGroup.add(pantMouth);
  } else {
    const smileMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI * 0.72),
      lipMat
    );
    smileMesh.position.set(0, -0.058, 0.125);
    smileMesh.rotation.z = Math.PI + Math.PI * 0.14;
    headGroup.add(smileMesh);
  }

  // Sculpted Layered Hairstyle
  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.138, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCrown.scale.set(isMale ? 0.99 : 0.96, 1.02, 1.09);
  hairCrown.rotation.x = -0.24;
  hairCrown.position.set(0, 0.022, -0.008);
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  if (isMale) {
    const tuft1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.075, 6, 10), hairMat);
    tuft1.rotation.z = Math.PI / 2 - 0.18;
    tuft1.rotation.x = 0.35;
    tuft1.position.set(-0.015, 0.125, 0.065);
    const tuft2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.065, 6, 10), hairMat);
    tuft2.rotation.z = Math.PI / 2 + 0.15;
    tuft2.position.set(0.025, 0.115, 0.05);
    headGroup.add(tuft1, tuft2);
  } else {
    const bangLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.075, 6, 10), hairMat);
    bangLeft.position.set(-0.075, 0.085, 0.085);
    bangLeft.rotation.z = 0.48;
    bangLeft.rotation.x = 0.25;
    const bangRight = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.075, 6, 10), hairMat);
    bangRight.position.set(0.075, 0.085, 0.085);
    bangRight.rotation.z = -0.48;
    bangRight.rotation.x = 0.25;
    headGroup.add(bangLeft, bangRight);
  }

  let ponytailGroup: THREE.Group | undefined;
  if (!isMale) {
    ponytailGroup = new THREE.Group();
    ponytailGroup.position.set(0, 0.045, -0.145);

    const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.01, 8, 16), accentMat);
    ponytailGroup.add(hairTie);

    const tailProfile = [
      new THREE.Vector2(0.005, -0.22),
      new THREE.Vector2(0.022, -0.18),
      new THREE.Vector2(0.048, -0.09),
      new THREE.Vector2(0.036, -0.02),
      new THREE.Vector2(0.024, 0.01),
    ];
    const tailMesh = new THREE.Mesh(new THREE.LatheGeometry(tailProfile, 14), hairMat);
    tailMesh.rotation.x = 0.42;
    tailMesh.castShadow = true;
    ponytailGroup.add(tailMesh);
    headGroup.add(ponytailGroup);
  }

  // Athletic Headband unlocked at fitness > 35
  if (p > 0.35) {
    const headbandGeo = new THREE.TorusGeometry(0.132, 0.016, 10, 28);
    headbandGeo.rotateX(Math.PI / 2 - 0.16);
    const headbandMesh = new THREE.Mesh(headbandGeo, accentMat);
    headbandMesh.scale.set(0.98, 1.08, 1);
    headbandMesh.position.set(0, 0.068, 0.004);
    headGroup.add(headbandMesh);
  }

  return {
    root,
    pelvisGroup,
    upperBody,
    headGroup,
    leftArmPivot: leftArm.armPivot,
    rightArmPivot: rightArm.armPivot,
    leftForearmPivot: leftArm.forearmPivot,
    rightForearmPivot: rightArm.forearmPivot,
    leftLegPivot: leftLeg.legPivot,
    rightLegPivot: rightLeg.legPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightKneePivot: rightLeg.kneePivot,
    ponytailGroup,
    shadowMesh,
    buffRing,
  };
}
