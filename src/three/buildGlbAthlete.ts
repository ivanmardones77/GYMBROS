import * as THREE from 'three';
import { Gender, OutfitId } from '../types/game';
import { athleteModelUrl, disposeObject3D, loadGlbAsset } from './threeUtils';

export const GLB_OUTFIT_ACCENT: Record<
  OutfitId,
  { primary: number; accent: number; metalness: number }
> = {
  basic: { primary: 0x2b2b30, accent: 0xff5a1f, metalness: 0.2 },
  runner: { primary: 0x0284c7, accent: 0x38bdf8, metalness: 0.35 },
  pro: { primary: 0x059669, accent: 0x34d399, metalness: 0.42 },
  titan: { primary: 0xff5a1f, accent: 0xfbbf24, metalness: 0.85 },
};

export interface GlbBoneMap {
  hips?: THREE.Object3D;
  spine02?: THREE.Object3D;
  spine01?: THREE.Object3D;
  spine?: THREE.Object3D;
  neck?: THREE.Object3D;
  head?: THREE.Object3D;
  leftShoulder?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  leftForeArm?: THREE.Object3D;
  leftHand?: THREE.Object3D;
  rightShoulder?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  rightForeArm?: THREE.Object3D;
  rightHand?: THREE.Object3D;
  leftUpLeg?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  leftFoot?: THREE.Object3D;
  leftToeBase?: THREE.Object3D;
  rightUpLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  rightFoot?: THREE.Object3D;
  rightToeBase?: THREE.Object3D;
}

export interface GlbAccessories {
  group: THREE.Group;
  leftWrist: THREE.Mesh;
  rightWrist: THREE.Mesh;
  headband: THREE.Mesh;
  belt: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
}

export function computeRealisticScale(fitnessScore: number): {
  sx: number;
  sy: number;
  sz: number;
} {
  if (fitnessScore < 50) {
    const t = THREE.MathUtils.clamp((fitnessScore - 14) / 36, 0, 1);
    return {
      sx: 1.04 - t * 0.05,
      sy: 0.99 + t * 0.02,
      sz: 1.07 - t * 0.08,
    };
  }
  const t = THREE.MathUtils.clamp((fitnessScore - 50) / 50, 0, 1);
  return {
    sx: 0.98 + t * 0.05,
    sy: 1.0 + t * 0.02,
    sz: 0.98 + t * 0.02,
  };
}

export function applyAiMaterialState(
  root: THREE.Object3D,
  outfit: OutfitId,
  hasBuff: boolean
): void {
  const outfitCfg = GLB_OUTFIT_ACCENT[outfit] || GLB_OUTFIT_ACCENT.basic;
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.emissive.setHex(hasBuff || outfit === 'titan' ? outfitCfg.accent : 0x000000);
        mat.emissiveIntensity = hasBuff ? 0.12 : outfit === 'titan' ? 0.06 : 0;
        mat.needsUpdate = true;
      }
    }
  });
}

export function createGlbAccessories(): GlbAccessories {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.25,
    roughness: 0.28,
    metalness: 0.65,
  });

  const wristGeo = new THREE.TorusGeometry(0.044, 0.012, 10, 24);
  const leftWrist = new THREE.Mesh(wristGeo, mat);
  const rightWrist = new THREE.Mesh(wristGeo, mat);

  const headbandGeo = new THREE.TorusGeometry(0.108, 0.013, 10, 28);
  const headband = new THREE.Mesh(headbandGeo, mat);

  const beltGeo = new THREE.TorusGeometry(0.175, 0.014, 10, 32);
  const belt = new THREE.Mesh(beltGeo, mat);

  group.add(leftWrist, rightWrist, headband, belt);
  return { group, leftWrist, rightWrist, headband, belt, mat };
}

export function extractGlbBones(root: THREE.Object3D): GlbBoneMap {
  const bones: GlbBoneMap = {};
  root.traverse((obj) => {
    switch (obj.name) {
      case 'Hips':
        bones.hips = obj;
        break;
      case 'Spine02':
        bones.spine02 = obj;
        break;
      case 'Spine01':
        bones.spine01 = obj;
        break;
      case 'Spine':
        bones.spine = obj;
        break;
      case 'neck':
        bones.neck = obj;
        break;
      case 'Head':
        bones.head = obj;
        break;
      case 'LeftShoulder':
        bones.leftShoulder = obj;
        break;
      case 'LeftArm':
        bones.leftArm = obj;
        break;
      case 'LeftForeArm':
        bones.leftForeArm = obj;
        break;
      case 'LeftHand':
        bones.leftHand = obj;
        break;
      case 'RightShoulder':
        bones.rightShoulder = obj;
        break;
      case 'RightArm':
        bones.rightArm = obj;
        break;
      case 'RightForeArm':
        bones.rightForeArm = obj;
        break;
      case 'RightHand':
        bones.rightHand = obj;
        break;
      case 'LeftUpLeg':
        bones.leftUpLeg = obj;
        break;
      case 'LeftLeg':
        bones.leftLeg = obj;
        break;
      case 'LeftFoot':
        bones.leftFoot = obj;
        break;
      case 'LeftToeBase':
        bones.leftToeBase = obj;
        break;
      case 'RightUpLeg':
        bones.rightUpLeg = obj;
        break;
      case 'RightLeg':
        bones.rightLeg = obj;
        break;
      case 'RightFoot':
        bones.rightFoot = obj;
        break;
      case 'RightToeBase':
        bones.rightToeBase = obj;
        break;
    }
  });
  return bones;
}

const BONE_KEYS: (keyof GlbBoneMap)[] = [
  'hips',
  'spine02',
  'spine01',
  'spine',
  'neck',
  'head',
  'leftShoulder',
  'leftArm',
  'leftForeArm',
  'leftHand',
  'rightShoulder',
  'rightArm',
  'rightForeArm',
  'rightHand',
  'leftUpLeg',
  'leftLeg',
  'leftFoot',
  'leftToeBase',
  'rightUpLeg',
  'rightLeg',
  'rightFoot',
  'rightToeBase',
];

interface HandCalibration {
  localF: THREE.Vector3;
  localP: THREE.Vector3;
  uGrip: number;
  pGrip: number;
}

/**
 * Reusable controller wrapping a rigged Magnific GLB skeleton with bind-pose
 * capture, Grip morph-target control, analytical 2-bone arm IK, and
 * zero-allocation character-space bone aiming for viewer & minigames.
 */
export class GlbPoseRig {
  readonly root: THREE.Group;
  readonly bones: GlbBoneMap;
  private readonly restQuats: Partial<Record<keyof GlbBoneMap, THREE.Quaternion>> = {};
  private readonly restPos: Partial<Record<keyof GlbBoneMap, THREE.Vector3>> = {};
  private readonly idleQuats: Partial<Record<keyof GlbBoneMap, THREE.Quaternion>> = {};
  private readonly targetQuats: Partial<Record<keyof GlbBoneMap, THREE.Quaternion>> = {};
  private readonly morphMeshes: THREE.Mesh[] = [];
  private readonly handCal: Record<'left' | 'right', HandCalibration>;
  private readonly restFootY: number;

  // Pre-allocated math temporaries (strictly 0 allocations inside tick)
  private readonly tmpContainerQ = new THREE.Quaternion();
  private readonly tmpParentQ = new THREE.Quaternion();
  private readonly tmpDeltaWorldQ = new THREE.Quaternion();
  private readonly tmpLocalDeltaQ = new THREE.Quaternion();
  private readonly tmpBonePos = new THREE.Vector3();
  private readonly tmpChildPos = new THREE.Vector3();
  private readonly tmpCurDir = new THREE.Vector3();
  private readonly tmpTargetDir = new THREE.Vector3();
  private readonly tmpLeftFootPos = new THREE.Vector3();
  private readonly tmpRightFootPos = new THREE.Vector3();

  // Pre-allocated IK / hand orientation temporaries
  private readonly ikShoulder = new THREE.Vector3();
  private readonly ikElbow = new THREE.Vector3();
  private readonly ikWrist = new THREE.Vector3();
  private readonly ikToT = new THREE.Vector3();
  private readonly ikDir = new THREE.Vector3();
  private readonly ikPole = new THREE.Vector3();
  private readonly ikElbowTgt = new THREE.Vector3();
  private readonly ikWristClamped = new THREE.Vector3();
  private readonly ikGripVec = new THREE.Vector3();
  private readonly ikSpinePos = new THREE.Vector3();
  private readonly ikNeckPos = new THREE.Vector3();
  private readonly ikWorldF = new THREE.Vector3();
  private readonly ikWorldP = new THREE.Vector3();
  private readonly ikWorldZ = new THREE.Vector3();
  private readonly ikTgtF = new THREE.Vector3();
  private readonly ikTgtP = new THREE.Vector3();
  private readonly ikTgtZ = new THREE.Vector3();
  private readonly ikHandQ = new THREE.Quaternion();
  private readonly ikMatCur = new THREE.Matrix4();
  private readonly ikMatTgt = new THREE.Matrix4();
  private readonly ikTmpVecL = new THREE.Vector3();
  private readonly ikTmpVecR = new THREE.Vector3();
  private readonly ikPoleVec = new THREE.Vector3();
  private readonly ikBenchF = new THREE.Vector3();
  private readonly ikBenchP = new THREE.Vector3();

  constructor(root: THREE.Group) {
    this.root = root;
    this.bones = extractGlbBones(root);

    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences && m.morphTargetInfluences.length > 0) {
        this.morphMeshes.push(m);
      }
    });

    root.updateMatrixWorld(true);
    for (const key of BONE_KEYS) {
      const b = this.bones[key];
      if (!b) continue;
      this.restQuats[key] = b.quaternion.clone();
      this.restPos[key] = b.position.clone();
      this.idleQuats[key] = b.quaternion.clone();
      this.targetQuats[key] = b.quaternion.clone();
    }

    const calibrateHand = (side: 'left' | 'right'): HandCalibration => {
      const sgn = side === 'left' ? 1 : -1;
      const hBone = side === 'left' ? this.bones.leftHand : this.bones.rightHand;
      const fBone = side === 'left' ? this.bones.leftForeArm : this.bones.rightForeArm;
      const fallback: HandCalibration = {
        localF: new THREE.Vector3(0, -1, 0),
        localP: new THREE.Vector3(-sgn, 0, 0),
        uGrip: 0.08,
        pGrip: 0.025,
      };
      if (!hBone || !fBone) return fallback;

      const hp = new THREE.Vector3();
      const fp = new THREE.Vector3();
      hBone.getWorldPosition(hp);
      fBone.getWorldPosition(fp);
      const armDir = hp.clone().sub(fp).normalize();
      const restFWorld = armDir.clone().multiplyScalar(0.65).add(new THREE.Vector3(0, -0.35, 0)).normalize();
      const restPWorld = new THREE.Vector3()
        .crossVectors(restFWorld, new THREE.Vector3(0, 0, sgn))
        .normalize();
      restPWorld.addScaledVector(restFWorld, -restPWorld.dot(restFWorld)).normalize();

      const hq = new THREE.Quaternion();
      hBone.getWorldQuaternion(hq);
      const invHq = hq.clone().invert();
      const handLenScale = hp.distanceTo(fp) / 0.24;

      return {
        localF: restFWorld.applyQuaternion(invHq).normalize(),
        localP: restPWorld.applyQuaternion(invHq).normalize(),
        uGrip: 0.084 * handLenScale,
        pGrip: 0.026 * handLenScale,
      };
    };

    this.handCal = {
      left: calibrateHand('left'),
      right: calibrateHand('right'),
    };

    const lf = this.bones.leftFoot;
    const rf = this.bones.rightFoot;
    if (lf && rf) {
      lf.getWorldPosition(this.tmpLeftFootPos);
      rf.getWorldPosition(this.tmpRightFootPos);
      this.restFootY = Math.min(this.tmpLeftFootPos.y, this.tmpRightFootPos.y);
    } else {
      this.restFootY = 0.14;
    }
  }

  /** Blends the procedural `Grip` morph target (`0` = open hand, `1` = closed fist around bar/handle). */
  setGrip(amount: number): void {
    const clamped = THREE.MathUtils.clamp(amount, 0, 1);
    for (let i = 0; i < this.morphMeshes.length; i++) {
      const inf = this.morphMeshes[i].morphTargetInfluences;
      if (inf && inf.length > 0) {
        inf[0] = clamped;
      }
    }
  }

  /** Restores all skeleton bones back to their clean A-pose bind transform. */
  resetToBindPose(keys: (keyof GlbBoneMap)[] = BONE_KEYS): void {
    for (const key of keys) {
      const b = this.bones[key];
      const rq = this.restQuats[key];
      const rp = this.restPos[key];
      if (b && rq) b.quaternion.copy(rq);
      if (b && rp) b.position.copy(rp);
    }
  }

  /** Aim `bone -> childBone` along a world-space direction vector (zero allocations). */
  private aimWorldDir(
    bone: THREE.Object3D | undefined,
    childBone: THREE.Object3D | undefined,
    worldDir: THREE.Vector3
  ): void {
    if (!bone || !childBone || !bone.parent) return;
    this.root.updateMatrixWorld(true);
    bone.getWorldPosition(this.tmpBonePos);
    childBone.getWorldPosition(this.tmpChildPos);
    this.tmpCurDir.copy(this.tmpChildPos).sub(this.tmpBonePos);
    if (this.tmpCurDir.lengthSq() < 1e-6 || worldDir.lengthSq() < 1e-6) return;
    this.tmpCurDir.normalize();
    this.tmpTargetDir.copy(worldDir).normalize();

    this.tmpDeltaWorldQ.setFromUnitVectors(this.tmpCurDir, this.tmpTargetDir);
    bone.parent.getWorldQuaternion(this.tmpParentQ);
    this.tmpLocalDeltaQ
      .copy(this.tmpParentQ)
      .invert()
      .multiply(this.tmpDeltaWorldQ)
      .multiply(this.tmpParentQ);
    bone.quaternion.premultiply(this.tmpLocalDeltaQ);
  }

  /** Aim `bone -> childBone` along a direction vector in `this.root` character space (+X left, +Y up, +Z front). */
  aimCharDir(
    bone: THREE.Object3D | undefined,
    childBone: THREE.Object3D | undefined,
    cx: number,
    cy: number,
    cz: number,
    blend = 1
  ): void {
    if (!bone || !childBone || !bone.parent || blend <= 0.001) return;
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(this.tmpContainerQ);

    this.tmpTargetDir.set(cx, cy, cz);
    if (this.tmpTargetDir.lengthSq() < 1e-6) return;
    this.tmpTargetDir.normalize().applyQuaternion(this.tmpContainerQ);

    bone.getWorldPosition(this.tmpBonePos);
    childBone.getWorldPosition(this.tmpChildPos);
    this.tmpCurDir.copy(this.tmpChildPos).sub(this.tmpBonePos);
    if (this.tmpCurDir.lengthSq() < 1e-6) return;
    this.tmpCurDir.normalize();

    this.tmpDeltaWorldQ.setFromUnitVectors(this.tmpCurDir, this.tmpTargetDir);
    if (blend < 0.999) {
      this.tmpDeltaWorldQ.slerp(this.tmpParentQ.identity(), 1 - blend);
    }

    bone.parent.getWorldQuaternion(this.tmpParentQ);
    this.tmpLocalDeltaQ
      .copy(this.tmpParentQ)
      .invert()
      .multiply(this.tmpDeltaWorldQ)
      .multiply(this.tmpParentQ);
    bone.quaternion.premultiply(this.tmpLocalDeltaQ);
  }

  /** Applies an incremental character-space axis-angle rotation onto a leaf bone (e.g. hand/wrist curl). */
  private rotateCharAxis(
    bone: THREE.Object3D | undefined,
    ax: number,
    ay: number,
    az: number,
    angle: number
  ): void {
    if (!bone || !bone.parent || Math.abs(angle) < 1e-4) return;
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(this.tmpContainerQ);
    this.tmpTargetDir.set(ax, ay, az).normalize().applyQuaternion(this.tmpContainerQ);
    this.tmpDeltaWorldQ.setFromAxisAngle(this.tmpTargetDir, angle);
    bone.parent.getWorldQuaternion(this.tmpParentQ);
    this.tmpLocalDeltaQ
      .copy(this.tmpParentQ)
      .invert()
      .multiply(this.tmpDeltaWorldQ)
      .multiply(this.tmpParentQ);
    bone.quaternion.premultiply(this.tmpLocalDeltaQ);
  }

  /**
   * Analytical 2-bone arm IK placing `LeftHand`/`RightHand` onto `wristTargetWorld`
   * with elbow pointing toward `poleDirWorld` (zero allocations).
   */
  private solveArmToWristWorld(
    side: 'left' | 'right',
    wristTargetWorld: THREE.Vector3,
    poleDirWorld: THREE.Vector3
  ): void {
    const arm = side === 'left' ? this.bones.leftArm : this.bones.rightArm;
    const fore = side === 'left' ? this.bones.leftForeArm : this.bones.rightForeArm;
    const hand = side === 'left' ? this.bones.leftHand : this.bones.rightHand;
    if (!arm || !fore || !hand) return;

    this.root.updateMatrixWorld(true);
    arm.getWorldPosition(this.ikShoulder);
    fore.getWorldPosition(this.ikElbow);
    hand.getWorldPosition(this.ikWrist);

    const l1 = this.ikShoulder.distanceTo(this.ikElbow);
    const l2 = this.ikElbow.distanceTo(this.ikWrist);
    if (l1 < 1e-4 || l2 < 1e-4) return;

    this.ikToT.copy(wristTargetWorld).sub(this.ikShoulder);
    const rawDist = this.ikToT.length();
    if (rawDist < 1e-5) return;

    const minR = Math.abs(l1 - l2) + 0.02;
    const maxR = (l1 + l2) * 0.985;
    const dist = THREE.MathUtils.clamp(rawDist, minR, maxR);
    this.ikDir.copy(this.ikToT).multiplyScalar(1 / rawDist);

    const cosA = THREE.MathUtils.clamp(
      (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist),
      -1,
      1
    );
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    this.ikPole.copy(poleDirWorld).addScaledVector(this.ikDir, -poleDirWorld.dot(this.ikDir));
    if (this.ikPole.lengthSq() < 1e-6) {
      this.ikPole.set(side === 'left' ? 1 : -1, 0, 0);
    } else {
      this.ikPole.normalize();
    }

    this.ikElbowTgt
      .copy(this.ikShoulder)
      .addScaledVector(this.ikDir, l1 * cosA)
      .addScaledVector(this.ikPole, l1 * sinA);

    this.ikTmpVecL.copy(this.ikElbowTgt).sub(this.ikShoulder);
    this.aimWorldDir(arm, fore, this.ikTmpVecL);

    this.ikWristClamped.copy(this.ikShoulder).addScaledVector(this.ikDir, dist);
    this.ikTmpVecR.copy(this.ikWristClamped).sub(this.ikElbowTgt);
    this.aimWorldDir(fore, hand, this.ikTmpVecR);
  }

  /** Aligns `LeftHand`/`RightHand` palm normal & finger direction cleanly in world space. */
  private orientHandWorld(
    side: 'left' | 'right',
    targetFWorld: THREE.Vector3,
    targetPWorld: THREE.Vector3
  ): void {
    const h = side === 'left' ? this.bones.leftHand : this.bones.rightHand;
    if (!h || !h.parent) return;
    const cal = this.handCal[side];

    this.root.updateMatrixWorld(true);
    h.getWorldQuaternion(this.ikHandQ);

    this.ikWorldF.copy(cal.localF).applyQuaternion(this.ikHandQ).normalize();
    this.ikWorldP.copy(cal.localP).applyQuaternion(this.ikHandQ);
    this.ikWorldP.addScaledVector(this.ikWorldF, -this.ikWorldP.dot(this.ikWorldF)).normalize();
    this.ikWorldZ.crossVectors(this.ikWorldF, this.ikWorldP).normalize();

    this.ikTgtF.copy(targetFWorld).normalize();
    this.ikTgtP.copy(targetPWorld);
    this.ikTgtP.addScaledVector(this.ikTgtF, -this.ikTgtP.dot(this.ikTgtF)).normalize();
    this.ikTgtZ.crossVectors(this.ikTgtF, this.ikTgtP).normalize();

    this.ikMatCur.makeBasis(this.ikWorldF, this.ikWorldP, this.ikWorldZ);
    this.ikMatTgt.makeBasis(this.ikTgtF, this.ikTgtP, this.ikTgtZ);
    this.ikMatCur.transpose();
    this.ikMatTgt.multiply(this.ikMatCur);
    this.tmpDeltaWorldQ.setFromRotationMatrix(this.ikMatTgt);

    h.parent.getWorldQuaternion(this.tmpParentQ);
    this.tmpLocalDeltaQ
      .copy(this.tmpParentQ)
      .invert()
      .multiply(this.tmpDeltaWorldQ)
      .multiply(this.tmpParentQ);
    h.quaternion.premultiply(this.tmpLocalDeltaQ);
  }

  /** Writes the actual world position of the gripped fist hollow center into `out`. */
  private computeActualGripWorld(side: 'left' | 'right', out: THREE.Vector3): void {
    const h = side === 'left' ? this.bones.leftHand : this.bones.rightHand;
    if (!h) {
      out.set(0, 1, 0);
      return;
    }
    const cal = this.handCal[side];
    h.getWorldPosition(out);
    h.getWorldQuaternion(this.ikHandQ);
    this.ikWorldF.copy(cal.localF).applyQuaternion(this.ikHandQ).normalize();
    this.ikWorldP.copy(cal.localP).applyQuaternion(this.ikHandQ).normalize();
    out.addScaledVector(this.ikWorldF, cal.uGrip).addScaledVector(this.ikWorldP, cal.pGrip);
  }

  /**
   * Drives a natural, athletic standing Idle posture (breathing chest, relaxed bent arms,
   * soft half-closed hands, subtle head poise) and blends cleanly into Double-Biceps Flex
   * or Tired recovery without shoulder torsion.
   */
  applyViewerPoseOverlay(flexBlend: number, tiredBlend: number, elapsed: number): void {
    const b = this.bones;
    const allUpperKeys: (keyof GlbBoneMap)[] = [
      'hips',
      'spine02',
      'spine01',
      'spine',
      'neck',
      'head',
      'leftShoulder',
      'leftArm',
      'leftForeArm',
      'leftHand',
      'rightShoulder',
      'rightArm',
      'rightForeArm',
      'rightHand',
      'leftUpLeg',
      'leftLeg',
      'leftFoot',
      'rightUpLeg',
      'rightLeg',
      'rightFoot',
    ];

    this.resetToBindPose(allUpperKeys);

    // Subtle organic breathing & relaxed standing athletic stance (arms resting naturally, elbows soft)
    const breath = Math.sin(elapsed * 2.1);
    const sway = Math.sin(elapsed * 0.85) * 0.015;
    this.aimCharDir(b.spine01, b.spine, sway, 0.996, -0.03 + breath * 0.014);
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, Math.sin(elapsed * 0.65) * 0.04, 0.99, 0.04 + breath * 0.01);
    }

    // Grounded, slightly athletic shoulder-width stance (toes gently out, slight knee softness)
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -0.995, 0.02);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -0.995, 0.02);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.03, -0.996, -0.04);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.03, -0.996, -0.04);

    // Relaxed natural arm hang with soft elbow bend (never T-pose, never LeftShoulder pinch)
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.25, -0.96, 0.05 + breath * 0.015);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.25, -0.96, 0.05 + breath * 0.015);
    this.aimCharDir(b.leftForeArm, b.leftHand, 0.12, -0.92, 0.36 + breath * 0.02);
    this.aimCharDir(b.rightForeArm, b.rightHand, -0.12, -0.92, 0.36 + breath * 0.02);

    if (tiredBlend > 0.01) {
      const pant = Math.sin(elapsed * 3.4) * 0.032 * tiredBlend;
      this.aimCharDir(
        b.spine01,
        b.spine,
        0,
        0.96,
        0.24 + pant,
        Math.min(1, tiredBlend * 0.9)
      );
      if (b.neck && b.head) {
        this.aimCharDir(b.neck, b.head, 0, 0.92, 0.36, Math.min(1, tiredBlend * 0.9));
      }
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.2, -0.93, 0.28, Math.min(1, tiredBlend * 0.85));
      this.aimCharDir(b.rightArm, b.rightForeArm, -0.2, -0.93, 0.28, Math.min(1, tiredBlend * 0.85));
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.1, -0.84, 0.52, Math.min(1, tiredBlend * 0.85));
      this.aimCharDir(b.rightForeArm, b.rightHand, 0.1, -0.84, 0.52, Math.min(1, tiredBlend * 0.85));
    }

    // Half-relaxed hand curl in Idle/Tired -> tight flexed fists in Double-Biceps Flex
    const idleGrip = THREE.MathUtils.lerp(0.34, 0.22, tiredBlend);
    this.setGrip(THREE.MathUtils.lerp(idleGrip, 0.95, flexBlend));

    if (flexBlend <= 0.005) {
      this.alignStandingFloor(0);
      return;
    }

    const upperKeys: (keyof GlbBoneMap)[] = [
      'spine02',
      'spine01',
      'spine',
      'neck',
      'head',
      'leftShoulder',
      'leftArm',
      'leftForeArm',
      'leftHand',
      'rightShoulder',
      'rightArm',
      'rightForeArm',
      'rightHand',
    ];

    // Snapshot Idle/Tired pose built above
    for (const k of upperKeys) {
      const bone = b[k];
      const iq = this.idleQuats[k];
      if (bone && iq) iq.copy(bone.quaternion);
    }

    // Deterministic Double-Biceps Flex from clean A-pose bind orientation
    this.resetToBindPose(upperKeys);
    this.aimCharDir(b.spine01, b.spine, 0, 0.99, -0.07);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.94, 0.22, 0.14);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.94, 0.22, 0.14);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.58, 0.78, 0.24);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.58, 0.78, 0.24);
    this.rotateCharAxis(b.leftHand, 0, 0, 1, 0.36);
    this.rotateCharAxis(b.rightHand, 0, 0, 1, -0.36);

    // Slerp smoothly between Idle and Flex
    for (const k of upperKeys) {
      const bone = b[k];
      const iq = this.idleQuats[k];
      const tq = this.targetQuats[k];
      if (bone && iq && tq) {
        tq.copy(bone.quaternion);
        bone.quaternion.copy(iq).slerp(tq, flexBlend);
      }
    }
    this.alignStandingFloor(0);
  }

  /** Shifts `this.root.position.y` so the lowest foot ankle keeps exact floor height during bends. */
  private alignStandingFloor(floorOffsetY: number): void {
    const lf = this.bones.leftFoot;
    const rf = this.bones.rightFoot;
    if (!lf || !rf) return;
    this.root.updateMatrixWorld(true);
    lf.getWorldPosition(this.tmpLeftFootPos);
    rf.getWorldPosition(this.tmpRightFootPos);
    const minFootY = Math.min(this.tmpLeftFootPos.y, this.tmpRightFootPos.y);
    const targetFootY = this.restFootY + floorOffsetY;
    this.root.position.y += targetFootY - minFootY;
  }

  /**
   * Bench Press supine pose (`liftT` 0 = chest, 1 = lockout) using closed `Grip` fists
   * and 2-bone analytical arm IK locked onto the barbell knurling; returns achieved world bar (y, z).
   */
  poseBenchPress(
    liftT: number,
    targetBarY = 0.96 + liftT * 0.19,
    targetBarZ = 0.05
  ): { barY: number; barZ: number } {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);
    this.aimCharDir(b.spine01, b.spine, 0, 0.99, 0.08);

    // Wide planted bench stance: knees past end of bench pad, shins angled cleanly forward toward floor
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.2, -0.97, -0.1);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.2, -0.97, -0.1);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.06, -0.34, -0.94);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.06, -0.34, -0.94);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.08, -0.94, 0.32);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.08, -0.94, 0.32);

    // Pronated bench grip orientation: palms UP supporting barbell, thumbs inward, curled fingers over top
    this.ikBenchF.set(0, 0.12, -0.99).normalize();
    this.ikBenchP.set(0, 1, 0);

    this.root.updateMatrixWorld(true);
    const gripX = b.leftArm && b.rightArm
      ? Math.max(0.36, this.handCal.left.uGrip * 4.7)
      : 0.39;

    for (const side of ['left', 'right'] as const) {
      const sgn = side === 'left' ? 1 : -1;
      const cal = this.handCal[side];
      this.ikGripVec
        .set(sgn * gripX, targetBarY, targetBarZ)
        .addScaledVector(this.ikBenchF, -cal.uGrip)
        .addScaledVector(this.ikBenchP, -cal.pGrip);
      this.ikPoleVec.set(sgn * 0.75, -0.55, 0.35);
      this.solveArmToWristWorld(side, this.ikGripVec, this.ikPoleVec);
      this.orientHandWorld(side, this.ikBenchF, this.ikBenchP);
    }

    this.root.updateMatrixWorld(true);
    this.computeActualGripWorld('left', this.ikTmpVecL);
    this.computeActualGripWorld('right', this.ikTmpVecR);
    return {
      barY: (this.ikTmpVecL.y + this.ikTmpVecR.y) * 0.5,
      barZ: (this.ikTmpVecL.z + this.ikTmpVecR.z) * 0.5,
    };
  }

  /**
   * Squat rack pose (`squatDepth` 0 = standing, 1 = deep parallel squat) with bar anchored across
   * upper traps and both closed fists locked to the barbell; returns synced bar (y, z).
   */
  poseSquat(squatDepth: number, baseFloorY = 0): { barY: number; barZ: number } {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);
    // Forward torso brace + proud chest
    this.aimCharDir(b.spine01, b.spine, 0, 0.98, 0.06 + squatDepth * 0.44);
    // Knees track forward & outward while shins angle backward (-Z) from knees over mid-foot
    const thighY = THREE.MathUtils.lerp(-0.98, -0.22, squatDepth);
    const thighZ = 0.05 + squatDepth * 0.90;
    const shinZ = -0.02 - squatDepth * 0.36;
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.22, thighY, thighZ);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.22, thighY, thighZ);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.94, shinZ);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.94, shinZ);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.14, -0.20, 0.97);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.14, -0.20, 0.97);

    this.alignStandingFloor(baseFloorY);
    this.root.updateMatrixWorld(true);

    // Anchor barbell cleanly across upper traps / rear delts
    let barY = 1.54 - squatDepth * 0.36;
    let barZ = 0.06 + squatDepth * 0.06;
    if (b.spine && b.neck) {
      b.spine.getWorldPosition(this.ikSpinePos);
      b.neck.getWorldPosition(this.ikNeckPos);
      barY = THREE.MathUtils.lerp(this.ikSpinePos.y, this.ikNeckPos.y, 0.65) + 0.05;
      barZ = THREE.MathUtils.lerp(this.ikSpinePos.z, this.ikNeckPos.z, 0.65) - 0.065;
    }

    // Back-squat overhand grip: palms forward, fingers wrapping up/over bar, thumbs inward
    this.ikBenchF.set(0, 0.94, -0.35).normalize();
    this.ikBenchP.set(0, 0.35, 0.94).normalize();
    const gripX = Math.max(0.38, this.handCal.left.uGrip * 4.8);

    for (const side of ['left', 'right'] as const) {
      const sgn = side === 'left' ? 1 : -1;
      const cal = this.handCal[side];
      this.ikGripVec
        .set(sgn * gripX, barY, barZ)
        .addScaledVector(this.ikBenchF, -cal.uGrip)
        .addScaledVector(this.ikBenchP, -cal.pGrip);
      this.ikPoleVec.set(sgn * 0.45, -0.82, -0.35);
      this.solveArmToWristWorld(side, this.ikGripVec, this.ikPoleVec);
      this.orientHandWorld(side, this.ikBenchF, this.ikBenchP);
    }

    this.root.updateMatrixWorld(true);
    return { barY, barZ };
  }

  /**
   * Treadmill sprint / hurdle jump pose driven by full gait phase `stridePhase` (radians)
   * for asymmetric knee flexion (~98 deg heel recovery during swing, soft ~20 deg stance absorption).
   */
  poseSprint(
    stridePhase: number,
    isJumping: boolean,
    jumpHeight: number,
    speed: number,
    floorY: number
  ): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(0.76);

    const pL = stridePhase;
    const pR = stridePhase + Math.PI;
    const speedFactor = THREE.MathUtils.clamp((speed - 4.5) / 14, 0.25, 1.0);

    // Forward athletic sprint lean + subtle counter-rotation between pelvis & shoulders
    const leanZ = isJumping ? 0.34 : 0.16 + speedFactor * 0.20;
    const torsoTwist = isJumping ? 0.03 : Math.sin(pL) * 0.09 * speedFactor;
    this.aimCharDir(b.spine01, b.spine, torsoTwist, 0.95, leanZ);
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, -torsoTwist * 0.4, 0.99, -0.06);
    }

    // Thigh pitch (+Z forward knee drive, -Z rear push-off) & asymmetric knee bend (>0 folds shin backward)
    const swingAmp = 0.62 + speedFactor * 0.22;
    const thL = isJumping ? 0.94 : Math.sin(pL) * swingAmp + 0.14;
    const thR = isJumping ? -0.32 : Math.sin(pR) * swingAmp + 0.14;

    const recL = 0.5 + 0.5 * Math.cos(pL + 0.65);
    const recR = 0.5 + 0.5 * Math.cos(pR + 0.65);
    const maxFlex = 1.48 + speedFactor * 0.38;
    const stanceFlex = 0.34;
    const kneeBendL = isJumping ? 0.92 : stanceFlex + (maxFlex - stanceFlex) * Math.pow(recL, 0.85);
    const kneeBendR = isJumping ? 1.68 : stanceFlex + (maxFlex - stanceFlex) * Math.pow(recR, 0.85);

    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.07, -Math.cos(thL), Math.sin(thL));
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.07, -Math.cos(thR), Math.sin(thR));

    const shAngleL = thL - kneeBendL;
    const shAngleR = thR - kneeBendR;
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.03, -Math.cos(shAngleL), Math.sin(shAngleL));
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.03, -Math.cos(shAngleR), Math.sin(shAngleR));

    // Natural ankle plantar/dorsiflexion synced to shin angle
    const footAngL = shAngleL + 1.30;
    const footAngR = shAngleR + 1.30;
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.06, -Math.cos(footAngL), Math.sin(footAngL));
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.06, -Math.cos(footAngR), Math.sin(footAngR));

    // Counter-swinging sprinter arms with ~95 deg bent elbows pumping hip-to-cheek
    const armAmp = 0.65 + speedFactor * 0.25;
    const armL = isJumping ? 0.55 : -Math.sin(pL) * armAmp + 0.05;
    const armR = isJumping ? -0.45 : -Math.sin(pR) * armAmp + 0.05;
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.16, -Math.cos(armL), Math.sin(armL));
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.16, -Math.cos(armR), Math.sin(armR));

    const elbowL = isJumping ? 1.55 : 1.48 + Math.max(0, Math.sin(armL)) * 0.35;
    const elbowR = isJumping ? 1.45 : 1.48 + Math.max(0, Math.sin(armR)) * 0.35;
    const faL = armL + elbowL;
    const faR = armR + elbowR;
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.09, -Math.cos(faL), Math.sin(faL));
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.09, -Math.cos(faR), Math.sin(faR));

    // Subtle vertical flight bounce twice per stride cycle (peaks between footstrikes)
    const strideBounce = isJumping
      ? 0
      : Math.pow(Math.abs(Math.sin(stridePhase + 0.2)), 1.5) * (0.025 + speedFactor * 0.032);
    this.alignStandingFloor(floorY + jumpHeight + strideBounce);
  }

  /** Athletic half-squat slamming battle ropes (`leftWave`, `rightWave` in [-1..1]). */
  poseBattleRopes(leftWave: number, rightWave: number, floorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);
    this.aimCharDir(b.spine01, b.spine, 0, 0.92, 0.34);

    // Wide grounded half-squat (knees tracking forward over toes, shins angled back)
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.18, -0.78, 0.60);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.18, -0.78, 0.60);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.05, -0.97, -0.20);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.05, -0.97, -0.20);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.12, -0.22, 0.96);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.12, -0.22, 0.96);

    // Vigorous alternating shoulder + forearm rope slam
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.22, -0.72 + leftWave * 0.45, 0.64);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.22, -0.72 + rightWave * 0.45, 0.64);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.06, -0.12 + leftWave * 0.55, 0.96);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.06, -0.12 + rightWave * 0.55, 0.96);

    this.alignStandingFloor(floorY);
  }

  /** Jump-rope pogo hop & wrist-flick turn (`jumpNorm` 0..1). */
  poseJumpRope(
    jumpNorm: number,
    jumpHeight: number,
    sinA: number,
    cosA: number,
    stumbleAmount: number,
    baseFloorY: number
  ): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);
    this.aimCharDir(b.spine01, b.spine, 0, 0.99, 0.06 + stumbleAmount * 0.28);

    const legFwd = jumpNorm * 0.48;
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -1 + jumpNorm * 0.25, legFwd);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -1 + jumpNorm * 0.25, legFwd);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -1 + jumpNorm * 0.16, -jumpNorm * 0.58);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -1 + jumpNorm * 0.16, -jumpNorm * 0.58);

    // Elbows tucked near hips, forearms extended out/forward spinning speed-rope wrists
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.44 + jumpNorm * 0.06, -0.9, 0.08);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.44 - jumpNorm * 0.06, -0.9, 0.08);
    this.aimCharDir(
      b.leftForeArm,
      b.leftHand,
      0.28 - cosA * 0.1,
      -0.38 + sinA * 0.14 + jumpNorm * 0.22,
      0.86
    );
    this.aimCharDir(
      b.rightForeArm,
      b.rightHand,
      -0.28 + cosA * 0.1,
      -0.38 + sinA * 0.14 + jumpNorm * 0.22,
      0.86
    );

    this.alignStandingFloor(baseFloorY + jumpHeight);
  }

  /** Conventional Deadlift pull (`liftT` 0 = floor setup .. 1 = tall lockout) with lateral bar tilt & 2-bone IK grip. */
  poseDeadlift(liftT: number, tiltRad: number, baseFloorY = 0): { barY: number; barZ: number } {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const hinge = THREE.MathUtils.lerp(1.02, 0.04, liftT);
    this.aimCharDir(b.spine01, b.spine, 0, Math.cos(hinge), Math.sin(hinge));
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, 0, Math.cos(hinge * 0.45), Math.sin(hinge * 0.45));
    }

    const thighY = THREE.MathUtils.lerp(-0.56, -0.99, liftT);
    const thighZ = THREE.MathUtils.lerp(0.80, 0.05, liftT);
    const shinZ = THREE.MathUtils.lerp(-0.22, -0.03, liftT);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.16, thighY, thighZ);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.16, thighY, thighZ);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.96, shinZ);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.96, shinZ);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.12, -0.20, 0.97);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.12, -0.20, 0.97);

    this.alignStandingFloor(baseFloorY);
    this.root.updateMatrixWorld(true);

    const barY = baseFloorY + THREE.MathUtils.lerp(0.45, 0.88, liftT);
    const barZ = THREE.MathUtils.lerp(0.28, 0.21, liftT);
    const gripX = Math.max(0.32, this.handCal.left.uGrip * 4.2);

    this.ikBenchF.set(0, -0.92, -0.38).normalize();
    this.ikBenchP.set(0, 0.38, -0.92).normalize();

    for (const side of ['left', 'right'] as const) {
      const sgn = side === 'left' ? 1 : -1;
      const cal = this.handCal[side];
      const handY = barY + Math.sin(tiltRad) * sgn * gripX;
      this.ikGripVec
        .set(sgn * gripX, handY, barZ)
        .addScaledVector(this.ikBenchF, -cal.uGrip)
        .addScaledVector(this.ikBenchP, -cal.pGrip);
      this.ikPoleVec.set(sgn * 0.45, 0.12, -0.82);
      this.solveArmToWristWorld(side, this.ikGripVec, this.ikPoleVec);
      this.orientHandWorld(side, this.ikBenchF, this.ikBenchP);
    }

    this.root.updateMatrixWorld(true);
    return { barY, barZ };
  }

  /** Pull-up / Muscle-up bar hang (`pullT` 0 = active hang .. 1 = chin over bar .. 1.35 = muscle-up). */
  posePullUp(pullT: number, barY = 2.25, barZ = 0.14): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const lean = pullT > 0.95 ? 0.22 * (pullT - 0.95) : 0.05;
    this.aimCharDir(b.spine01, b.spine, 0, 0.99, lean);

    // Slight hollow-body knee tuck behind
    const tuck = Math.min(1, pullT * 0.85);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -0.96, 0.12 + tuck * 0.18);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -0.96, 0.12 + tuck * 0.18);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.78, -0.58 - tuck * 0.25);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.78, -0.58 - tuck * 0.25);

    this.root.updateMatrixWorld(true);
    if (b.leftArm) {
      b.leftArm.getWorldPosition(this.tmpBonePos);
      // Active scapular hang keeps slight elbow bend & clean shoulder clearance
      const targetShoulderY =
        barY - THREE.MathUtils.lerp(0.24, 0.08, Math.min(1, pullT)) + Math.max(0, pullT - 1) * 0.30;
      this.root.position.y += targetShoulderY - this.tmpBonePos.y;
    }
    this.root.updateMatrixWorld(true);

    const gripX = Math.max(0.54, this.handCal.left.uGrip * 6.2);
    if (pullT <= 1.0) {
      this.ikBenchF.set(0, 0.55, -0.83).normalize();
      this.ikBenchP.set(0, -0.83, 0.55).normalize();
    } else {
      this.ikBenchF.set(0, -0.4, 0.92).normalize();
      this.ikBenchP.set(0, -0.92, -0.4).normalize();
    }

    for (const side of ['left', 'right'] as const) {
      const sgn = side === 'left' ? 1 : -1;
      const cal = this.handCal[side];
      this.ikGripVec
        .set(sgn * gripX, barY, barZ)
        .addScaledVector(this.ikBenchF, -cal.uGrip)
        .addScaledVector(this.ikBenchP, -cal.pGrip);
      this.ikPoleVec.set(sgn * 0.78, -0.45, 0.52);
      this.solveArmToWristWorld(side, this.ikGripVec, this.ikPoleVec);
      this.orientHandWorld(side, this.ikBenchF, this.ikBenchP);
    }
    this.root.updateMatrixWorld(true);
  }

  /** Strongman Tire Flip (`stageT` 0 = low catch under tire .. 1 = chest explosive drive). */
  poseTireFlip(stageT: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const lean = THREE.MathUtils.lerp(0.84, 0.32, stageT);
    this.aimCharDir(b.spine01, b.spine, 0, Math.cos(lean), Math.sin(lean));

    const thighY = THREE.MathUtils.lerp(-0.46, -0.88, stageT);
    const thighZ = THREE.MathUtils.lerp(0.80, 0.44, stageT);
    const shinZ = THREE.MathUtils.lerp(-0.28, -0.18, stageT);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.22, thighY, thighZ);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.22, thighY, thighZ);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.94, shinZ);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.94, shinZ);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.12, -0.22, 0.96);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.12, -0.22, 0.96);

    const armY = THREE.MathUtils.lerp(-0.82, -0.34, stageT);
    const armZ = THREE.MathUtils.lerp(0.44, 0.54, stageT);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.42, armY, armZ);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.42, armY, armZ);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.10, THREE.MathUtils.lerp(-0.15, 0.72, stageT), 0.76);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.10, THREE.MathUtils.lerp(-0.15, 0.72, stageT), 0.76);

    this.alignStandingFloor(baseFloorY);
  }

  /** Fast footwork drill on agility ladder (`stridePhase` in radians). */
  poseAgilityStep(stridePhase: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(0.65);

    this.aimCharDir(b.spine01, b.spine, Math.sin(stridePhase) * 0.08, 0.96, 0.22);

    const sL = Math.max(0, Math.sin(stridePhase));
    const sR = Math.max(0, -Math.sin(stridePhase));
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.12, -0.92 + sL * 0.52, 0.25 + sL * 0.62);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.12, -0.92 + sR * 0.52, 0.25 + sR * 0.62);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.92, -0.16 - sL * 0.52);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.92, -0.16 - sR * 0.52);

    const armDrive = Math.sin(stridePhase) * 0.55;
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.26, -0.78, -armDrive + 0.15);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.26, -0.78, armDrive + 0.15);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.1, 0.25, 0.94);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.1, 0.25, 0.94);

    this.alignStandingFloor(baseFloorY + Math.abs(Math.sin(stridePhase)) * 0.045);
  }

  /** Boxing slip/duck & counter punch (`dodgeX` -1..1, `duckT` 0..1, `punchT` 0..1). */
  poseBoxingDefense(dodgeX: number, duckT: number, punchT: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const leanFwd = 0.18 + duckT * 0.30 + punchT * 0.14;
    const twistX = dodgeX * 0.28 - punchT * 0.16;
    this.aimCharDir(b.spine01, b.spine, twistX, 0.94, leanFwd);
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, dodgeX * 0.14, 0.98, -0.05);
    }

    const dip = 0.24 + duckT * 0.34;
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.22, -0.92 + dip * 0.45, 0.34 + dip * 0.44);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.22, -0.95 + dip * 0.45, -0.14 + dip * 0.40);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.95, -0.18 - dip * 0.22);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.95, -0.22 - dip * 0.22);

    // Peek-a-boo guard with lower-shoulder clearance & sharp cross extension via forearm
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.38, -0.62, 0.64);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.18, 0.88, 0.42);

    this.aimCharDir(b.rightArm, b.rightForeArm, -0.44, -0.68 + punchT * 0.14, 0.52 + punchT * 0.08);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.14 - punchT * 0.10, 0.88 - punchT * 0.86, 0.42 + punchT * 0.57);

    this.alignStandingFloor(baseFloorY);
  }

  /** Wall Ball Squat-to-Overhead Launch (`squatT` 0..1, `throwT` 0..1). */
  poseWallBall(squatT: number, throwT: number, aimX: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(0.45);

    this.aimCharDir(b.spine01, b.spine, aimX * 0.10, 0.97, squatT * 0.30 - throwT * 0.06);

    const thighY = THREE.MathUtils.lerp(-0.97, -0.36, squatT);
    const thighZ = 0.06 + squatT * 0.78;
    const shinZ = -0.04 - squatT * 0.30;
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.22, thighY, thighZ);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.22, thighY, thighZ);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.94, shinZ);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.94, shinZ);

    // Chest-rack hold -> upward wall launch without underarm fold
    const armUp = THREE.MathUtils.lerp(-0.62, -0.04, throwT);
    const armFwd = THREE.MathUtils.lerp(0.56, 0.50, throwT);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.46 + aimX * 0.06, armUp, armFwd);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.46 + aimX * 0.06, armUp, armFwd);
    const faUp = THREE.MathUtils.lerp(0.86, 0.96, throwT);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.14 + aimX * 0.08, faUp, 0.32);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.14 + aimX * 0.08, faUp, 0.32);

    this.alignStandingFloor(baseFloorY + throwT * 0.06);
  }

  /** Seated Rowing Ergometer stroke (`strokeT` 0 = forward catch .. 1 = finish pull). */
  poseRowing(strokeT: number, seatY = 0.42): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const lean = THREE.MathUtils.lerp(0.38, -0.30, strokeT);
    this.aimCharDir(b.spine01, b.spine, 0, Math.cos(lean), Math.sin(lean));

    // Seated thighs forward, knees bend high at catch (strokeT=0) and extend forward at finish (strokeT=1)
    const thighY = THREE.MathUtils.lerp(0.06, -0.08, strokeT);
    const thighZ = THREE.MathUtils.lerp(0.95, 0.98, strokeT);
    const shinY = THREE.MathUtils.lerp(-0.98, -0.45, strokeT);
    const shinZ = THREE.MathUtils.lerp(0.08, 0.88, strokeT);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.16, thighY, thighZ);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.16, thighY, thighZ);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, shinY, shinZ);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, shinY, shinZ);

    // Arms reach smoothly at catch -> elbows sweep past ribs at finish
    const armFwd = THREE.MathUtils.lerp(0.42, -0.38, strokeT);
    const armDown = THREE.MathUtils.lerp(-0.66, -0.64, strokeT);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.46, armDown, armFwd);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.46, armDown, armFwd);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.12, THREE.MathUtils.lerp(-0.1, 0.25, strokeT), 0.96);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.12, THREE.MathUtils.lerp(-0.1, 0.25, strokeT), 0.96);

    if (b.hips) {
      this.root.position.y = seatY - 0.82;
    }
    this.root.updateMatrixWorld(true);
  }

  /** Forearm Isometric Plank (`wobbleX` -1..1, `trembleY` small offset). */
  posePlank(wobbleX: number, trembleY: number, floorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(0.8);

    this.aimCharDir(b.spine01, b.spine, wobbleX * 0.06, 0.99, -0.04 + trembleY * 0.08);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.06, -0.995, 0.02);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.06, -0.995, 0.02);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.02, -0.995, -0.03);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.02, -0.995, -0.03);
    this.aimCharDir(b.leftFoot, b.leftToeBase, 0.04, -0.92, -0.35);
    this.aimCharDir(b.rightFoot, b.rightToeBase, -0.04, -0.92, -0.35);

    // Forearms planted under chest supporting body
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.18, -0.32, 0.92);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.18, -0.32, 0.92);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.22, 0.92, 0.24);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.22, 0.92, 0.24);

    // Tilt athlete prone over mat, keeping lowest toe/forearm resting near floorY
    this.root.rotation.x = Math.PI * 0.47;
    this.root.rotation.z = wobbleX * 0.07;
    this.root.updateMatrixWorld(true);
    if (b.leftToeBase) {
      b.leftToeBase.getWorldPosition(this.tmpLeftFootPos);
      this.root.position.y += (floorY + 0.04 + trembleY * 0.015) - this.tmpLeftFootPos.y;
    }
    this.root.updateMatrixWorld(true);
  }

  /** Heavy Prowler Sled Push (`stridePhase` in radians). */
  poseSledPush(stridePhase: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    // Deep 36-deg forward drive torso angle
    this.aimCharDir(b.spine01, b.spine, Math.sin(stridePhase) * 0.05, 0.80, 0.58);

    const pL = stridePhase;
    const pR = stridePhase + Math.PI;
    const thL = Math.sin(pL) * 0.62 - 0.14;
    const thR = Math.sin(pR) * 0.62 - 0.14;
    const kbL = 0.36 + 0.95 * (0.5 + 0.5 * Math.cos(pL + 0.45));
    const kbR = 0.36 + 0.95 * (0.5 + 0.5 * Math.cos(pR + 0.45));

    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -Math.cos(thL), Math.sin(thL));
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -Math.cos(thR), Math.sin(thR));
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -Math.cos(thL - kbL), Math.sin(thL - kbL));
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -Math.cos(thR - kbR), Math.sin(thR - kbR));

    // Wide braced upper arms + forward forearms pushing upright sled handles
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.48, -0.52, 0.48);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.48, -0.52, 0.48);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.06, 0.32, 0.94);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.06, 0.32, 0.94);

    this.alignStandingFloor(baseFloorY);
  }

  /** Supplement Bar Shaker Mix (`shakePhase` in radians). */
  poseShakeMixer(shakePhase: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    const bob = Math.sin(shakePhase) * 0.25;
    this.aimCharDir(b.spine01, b.spine, Math.sin(shakePhase * 0.5) * 0.05, 0.98, 0.06);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -0.995, 0.02);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -0.995, 0.02);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.03, -0.995, -0.04);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.03, -0.995, -0.04);

    // Right arm vigorously shaking cup chest-high, left braced smoothly
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.28, -0.58 + bob * 0.35, 0.68);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.18, 0.65 + bob * 0.85, 0.62);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.28, -0.88, 0.25);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.15, -0.22, 0.92);

    this.alignStandingFloor(baseFloorY);
  }

  /** Guided Mobility Flow Stretch (`flowPhase` in radians). */
  poseMobilityStretch(flowPhase: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(0.15);

    const swayX = Math.sin(flowPhase) * 0.18;
    const reachUp = 0.5 + 0.5 * Math.sin(flowPhase * 0.5);
    this.aimCharDir(b.spine01, b.spine, swayX, 0.96, 0.05);
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, swayX * 0.4, 0.98, -0.06);
    }

    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.16, -0.96, 0.14);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.16, -0.96, 0.14);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.04, -0.98, -0.12);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.04, -0.98, -0.12);

    // Smooth open chest & overhead forearm sweep without collapsing deltoids
    const armY = THREE.MathUtils.lerp(-0.62, 0.12, reachUp);
    this.aimCharDir(b.leftArm, b.leftForeArm, 0.58 + swayX * 0.25, armY, 0.32);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.58 + swayX * 0.25, armY, 0.32);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.16 + swayX * 0.35, 0.88, 0.34);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.16 + swayX * 0.35, 0.88, 0.34);

    this.alignStandingFloor(baseFloorY);
  }

  /** Standing Dumbbell Curl with gaze deflection (`curlT` 0..1, `headYaw` -1..1). */
  poseTunnelCurl(curlT: number, headYaw: number, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    this.aimCharDir(b.spine01, b.spine, 0, 0.99, 0.04);
    if (b.neck && b.head) {
      this.aimCharDir(b.neck, b.head, headYaw * 0.65, 0.96, -0.12);
    }

    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.1, -0.99, 0.06);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.1, -0.99, 0.06);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.03, -0.99, -0.05);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.03, -0.99, -0.05);

    this.aimCharDir(b.leftArm, b.leftForeArm, 0.40, -0.90, 0.14);
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.40, -0.90, 0.14);
    const faY = THREE.MathUtils.lerp(-0.55, 0.88, curlT);
    const faZ = THREE.MathUtils.lerp(0.82, 0.42, curlT);
    this.aimCharDir(b.leftForeArm, b.leftHand, -0.08, faY, faZ);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.08, faY, faZ);

    this.alignStandingFloor(baseFloorY);
  }

  /** Front Double Biceps Flex vs Casual Neck-Stretch Disguise (`flexT` 0..1). */
  poseMirrorFlex(flexT: number, disguise: boolean, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(disguise ? 0.15 : 1.0);

    if (disguise) {
      this.aimCharDir(b.spine01, b.spine, 0.12, 0.98, 0.02);
      if (b.neck && b.head) {
        this.aimCharDir(b.neck, b.head, 0.35, 0.92, 0.18);
      }
      this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.08, -0.995, 0.02);
      this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.08, -0.995, 0.02);
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.36, -0.92, 0.08);
      this.aimCharDir(b.rightArm, b.rightForeArm, -0.44, -0.78, 0.25);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.05, -0.82, 0.45);
      this.aimCharDir(b.rightForeArm, b.rightHand, 0.28, 0.78, 0.35);
    } else {
      const puff = 0.08 + flexT * 0.10;
      this.aimCharDir(b.spine01, b.spine, 0, 0.99, -puff);
      this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.16, -0.98, 0.08);
      this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.16, -0.98, 0.08);
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.94, 0.08 + flexT * 0.16, 0.18);
      this.aimCharDir(b.rightArm, b.rightForeArm, -0.94, 0.08 + flexT * 0.16, 0.18);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.45, 0.88, 0.18);
      this.aimCharDir(b.rightForeArm, b.rightHand, 0.45, 0.88, 0.18);
    }

    this.alignStandingFloor(baseFloorY);
  }

  /** Sneaky Heist Walk / Dumbbell Carry (`walkPhase` in rad, `sneaking`, `hasWeights`). */
  poseStealthCarry(walkPhase: number, sneaking: boolean, hasWeights: boolean, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(hasWeights ? 1.0 : 0.4);

    const crouch = sneaking ? 0.32 : 0.08;
    this.aimCharDir(b.spine01, b.spine, Math.sin(walkPhase) * 0.06, 0.94, crouch + 0.14);

    const s = Math.sin(walkPhase) * (sneaking ? 0.36 : 0.55);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.10, -0.94 + crouch * 0.3, s + crouch * 0.4);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.10, -0.94 + crouch * 0.3, -s + crouch * 0.4);
    this.aimCharDir(b.leftLeg, b.leftFoot, 0.03, -0.94, -Math.max(0, -s) * 0.45 - crouch * 0.35);
    this.aimCharDir(b.rightLeg, b.rightFoot, -0.03, -0.94, -Math.max(0, s) * 0.45 - crouch * 0.35);

    if (hasWeights) {
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.42, -0.90, 0.15);
      this.aimCharDir(b.rightArm, b.rightForeArm, -0.42, -0.90, 0.15);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.05, -0.55, 0.78);
      this.aimCharDir(b.rightForeArm, b.rightHand, 0.05, -0.55, 0.78);
    } else {
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.34, -0.84, -s * 0.4 + 0.25);
      this.aimCharDir(b.rightArm, b.rightForeArm, -0.34, -0.84, s * 0.4 + 0.25);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.12, 0.28, 0.92);
      this.aimCharDir(b.rightForeArm, b.rightHand, 0.12, 0.28, 0.92);
    }

    this.alignStandingFloor(baseFloorY);
  }

  /** Selfie Pump Pose (`flexT` 0..1, `phoneHold`). */
  poseSelfieFlex(flexT: number, phoneHold: boolean, baseFloorY = 0): void {
    const b = this.bones;
    this.resetToBindPose();
    this.setGrip(1.0);

    this.aimCharDir(b.spine01, b.spine, -0.12, 0.98, -0.08 * flexT);
    this.aimCharDir(b.leftUpLeg, b.leftLeg, 0.14, -0.98, 0.06);
    this.aimCharDir(b.rightUpLeg, b.rightLeg, -0.14, -0.98, 0.06);

    if (phoneHold) {
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.35, -0.45, 0.78);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.15, 0.72, 0.65);
    } else {
      this.aimCharDir(b.leftArm, b.leftForeArm, 0.46, -0.78, 0.30);
      this.aimCharDir(b.leftForeArm, b.leftHand, -0.25, 0.45, 0.78);
    }
    this.aimCharDir(b.rightArm, b.rightForeArm, -0.90, 0.06 + flexT * 0.15, 0.22);
    this.aimCharDir(b.rightForeArm, b.rightHand, 0.48, 0.86, 0.18);

    this.alignStandingFloor(baseFloorY);
  }
}

export interface MinigameGlbLoaderOptions {
  scene: THREE.Scene;
  gender: Gender;
  fitnessScore: number;
  outfit: OutfitId;
  aiModel?: boolean;
  isCancelled: () => boolean;
  onLoaded: (rig: GlbPoseRig) => void;
}

/**
 * Loads the realistic GLB athlete asynchronously for minigame stations without blocking
 * frame 1, configures outfit sheen & physique scaling, and invokes `onLoaded` if still active.
 */
export function loadMinigameGlbAthlete({
  scene,
  gender,
  fitnessScore,
  outfit,
  aiModel = true,
  isCancelled,
  onLoaded,
}: MinigameGlbLoaderOptions): void {
  if (!aiModel) return;
  const url = athleteModelUrl(gender, fitnessScore);
  const height = gender === 'female' ? 1.68 : 1.8;

  loadGlbAsset(url, height, { cloneMaterials: true })
    .then(({ root }) => {
      if (isCancelled() || (!scene.parent && scene.children.length === 0)) {
        disposeObject3D(root);
        return;
      }
      const s = computeRealisticScale(fitnessScore);
      root.scale.set(s.sx, s.sy, s.sz);
      applyAiMaterialState(root, outfit, false);
      const rig = new GlbPoseRig(root);
      onLoaded(rig);
    })
    .catch(() => {
      // Procedural fallback remains visible seamlessly
    });
}
