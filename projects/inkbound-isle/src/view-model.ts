import * as THREE from 'three';
import type { Tool } from './gameplay.ts';
import { addInkedPart } from './materials.ts';
import { PALETTE } from './palette.ts';

type PoseVector = readonly [number, number, number];

export interface ToolPose {
  position: PoseVector;
  rotation: PoseVector;
}

export interface ViewModel {
  root: THREE.Group;
  actionPivot: THREE.Group;
  axe: THREE.Group;
  spear: THREE.Group;
  torch: THREE.Group;
}

const neutralPose = (): ToolPose => ({ position: [0, 0, 0], rotation: [0, 0, 0] });
const peak = (time: number, center: number, halfWidth: number) => (
  Math.max(0, 1 - Math.abs(time - center) / halfWidth)
);

export const toolActionDuration = (tool: Tool): number => ({
  hands: 0.34,
  axe: 0.46,
  spear: 0.52,
  torch: 0.4,
})[tool];

export function sampleToolPose(tool: Tool, normalizedTime: number): ToolPose {
  const time = Number.isFinite(normalizedTime)
    ? THREE.MathUtils.clamp(normalizedTime, 0, 1)
    : 0;
  if (time === 0 || time === 1) return neutralPose();

  const anticipation = peak(time, 0.16, 0.16);
  const action = peak(time, 0.47, 0.23);
  const recovery = peak(time, 0.8, 0.2);
  const value = (before: number, active: number, after: number) => (
    before * anticipation + active * action + after * recovery
  );

  if (tool === 'hands') {
    return {
      position: [value(0, 0.03, 0), value(-0.04, 0.02, 0.02), value(0.09, -0.28, -0.05)],
      rotation: [value(-0.12, 0.36, -0.08), value(0.18, -0.24, 0), value(0.1, -0.08, 0.05)],
    };
  }
  if (tool === 'axe') {
    return {
      position: [value(0.08, -0.07, -0.03), value(0.12, -0.1, 0.03), value(0.11, -0.2, 0.06)],
      rotation: [value(0.64, -1.22, 0.28), value(0.08, 0.18, -0.08), value(-0.38, 0.56, -0.12)],
    };
  }
  if (tool === 'spear') {
    return {
      position: [value(0.24, -0.48, 0.05), value(-0.16, 0.05, -0.03), value(0.22, -0.97, 0.12)],
      rotation: [value(-0.5, -0.37, -0.18), value(0.3, -0.42, 0.12), value(-0.45, 0.43, -0.12)],
    };
  }
  return {
    position: [value(0.03, -0.08, -0.01), value(0.09, -0.05, 0.02), value(0.05, -0.17, 0.04)],
    rotation: [value(-0.18, 0.38, -0.1), value(0.2, -0.16, 0.08), value(-0.3, 0.26, 0.12)],
  };
}

function smoothSeamNormals(shape: THREE.BufferGeometry): void {
  shape.computeVertexNormals();
  const positions = shape.getAttribute('position');
  const normals = shape.getAttribute('normal');
  const seams = new Map<string, number[]>();
  for (let index = 0; index < positions.count; index += 1) {
    const key = [positions.getX(index), positions.getY(index), positions.getZ(index)]
      .map((value) => Math.round(value * 1e6)).join(',');
    const indices = seams.get(key) ?? [];
    indices.push(index);
    seams.set(key, indices);
  }
  for (const indices of seams.values()) {
    const normal = new THREE.Vector3();
    for (const index of indices) normal.add(new THREE.Vector3().fromBufferAttribute(normals, index));
    normal.normalize();
    for (const index of indices) normals.setXYZ(index, normal.x, normal.y, normal.z);
  }
}

function taperedForearmGeometry(): THREE.CapsuleGeometry {
  const shape = new THREE.CapsuleGeometry(0.082, 0.28, 5, 12, 2);
  const positions = shape.getAttribute('position');
  const halfHeight = 0.222;
  for (let index = 0; index < positions.count; index += 1) {
    const progress = THREE.MathUtils.clamp((positions.getY(index) + halfHeight) / (halfHeight * 2), 0, 1);
    const radiusScale = THREE.MathUtils.lerp(1.45, 0.74, THREE.MathUtils.smoothstep(progress, 0, 1));
    const elbow = 1 - progress;
    const bend = Math.sin(progress * Math.PI);
    positions.setX(index, positions.getX(index) * radiusScale * (1 + elbow * 0.08) + bend * 0.065);
    positions.setZ(index, positions.getZ(index) * radiusScale * (1 - elbow * 0.14) - bend * 0.035);
  }
  smoothSeamNormals(shape);
  shape.userData.taperRatio = 1.45 / 0.74;
  shape.userData.elbowPlane = 0.14;
  return shape;
}

// The four finger curls share one drawable. Their roots overlap the palm;
// the empty center is sized to the shaft, not a collection of detached digits.
function curvedDigits(paths: THREE.Vector3[][], radii: number[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 10;
  const sides = 8;
  paths.forEach((points, digit) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.TubeGeometry(curve, segments, radii[digit]!, sides, false);
    const tubePositions = tube.getAttribute('position');
    const tubeUvs = tube.getAttribute('uv');
    const offset = positions.length / 3;
    for (let ring = 0; ring <= segments; ring += 1) {
      const center = curve.getPointAt(ring / segments);
      const taper = ring === segments ? 0.18 : ring === segments - 1 ? 0.82 : 1;
      for (let side = 0; side <= sides; side += 1) {
        const index = ring * (sides + 1) + side;
        const point = new THREE.Vector3().fromBufferAttribute(tubePositions, index)
          .sub(center).multiplyScalar(taper).add(center);
        positions.push(point.x, point.y, point.z);
        uvs.push(tubeUvs.getX(index), tubeUvs.getY(index));
      }
    }
    for (const index of tube.index!.array) indices.push(index + offset);
    for (const end of [0, segments]) {
      const center = curve.getPointAt(end / segments);
      const normal = curve.getTangentAt(end / segments).multiplyScalar(end === 0 ? -1 : 1);
      const centerIndex = positions.length / 3;
      positions.push(center.x, center.y, center.z);
      uvs.push(0.5, 0.5);
      for (let side = 0; side < sides; side += 1) {
        const a = offset + end * (sides + 1) + side;
        const b = a + 1;
        const edgeA = new THREE.Vector3().fromArray(positions, a * 3).sub(center);
        const edgeB = new THREE.Vector3().fromArray(positions, b * 3).sub(center);
        if (edgeA.cross(edgeB).dot(normal) > 0) indices.push(centerIndex, a, b);
        else indices.push(centerIndex, b, a);
      }
    }
    tube.dispose();
  });
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shape.setIndex(indices);
  smoothSeamNormals(shape);
  return shape;
}

function fingerGeometry(direction: number): THREE.BufferGeometry {
  const rows = [-0.055, -0.018, 0.021, 0.058];
  const reach = [0.046, 0.054, 0.057, 0.052];
  return curvedDigits(rows.map((row, digit) => (
    Array.from({ length: 8 }, (_, index) => {
      const angle = THREE.MathUtils.lerp(0.25, digit === 0 ? 3.35 : 3.6, index / 7);
      return new THREE.Vector3(direction * Math.cos(angle) * reach[digit]!, row, Math.sin(angle) * reach[digit]!);
    })
  )), [0.018, 0.021, 0.0225, 0.0205]);
}

function thumbGeometry(direction: number): THREE.BufferGeometry {
  return curvedDigits([[
    [0.055, -0.07, -0.012], [0.085, -0.03, 0.02], [0.071, 0.02, 0.049],
    [0.038, 0.06, 0.072], [-0.01, 0.055, 0.068], [-0.034, 0.029, 0.052],
  ].map(([x, y, z]) => new THREE.Vector3(x! * direction, y!, z!))], [0.024]);
}

function knappedStone(outline: readonly (readonly [number, number])[], ridgeX: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const count = outline.length;
  for (const z of [0.004, -0.004]) {
    for (const [x, y] of outline) {
      vertices.push(x, y, z);
      uvs.push(x * 2 + 0.5, y * 2 + 0.5);
    }
  }
  vertices.push(ridgeX, 0, 0.036, ridgeX, 0, -0.029);
  uvs.push(0.5, 0.5, 0.5, 0.5);
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(count * 2, index, next, count * 2 + 1, count + next, count + index);
    indices.push(index, count + index, count + next, index, count + next, next);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setIndex(indices);
  const shape = indexed.toNonIndexed();
  indexed.dispose();
  shape.computeVertexNormals();
  return shape;
}

function woundLashing(): THREE.TubeGeometry {
  const points = Array.from({ length: 49 }, (_, index) => {
    const progress = index / 48;
    const angle = progress * Math.PI * 6;
    return new THREE.Vector3(Math.cos(angle) * 0.032, (progress - 0.5) * 0.12, Math.sin(angle) * 0.032);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, 0.008, 4, false);
}

function torchFlameGeometry(): THREE.LatheGeometry {
  const shape = new THREE.LatheGeometry([
    [0, -0.11], [0.047, -0.075], [0.076, -0.022], [0.052, 0.036], [0.022, 0.086], [0, 0.135],
  ].map(([radius, y]) => new THREE.Vector2(radius, y)), 8);
  const positions = shape.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const progress = (positions.getY(index) + 0.11) / 0.245;
    positions.setX(index, positions.getX(index) + progress * progress * 0.041);
    positions.setZ(index, positions.getZ(index) * 0.88);
  }
  const faces: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < shape.index!.count; index += 3) {
    const corners = [shape.index!.getX(index), shape.index!.getX(index + 1), shape.index!.getX(index + 2)];
    a.fromBufferAttribute(positions, corners[0]!);
    b.fromBufferAttribute(positions, corners[1]!).sub(a);
    c.fromBufferAttribute(positions, corners[2]!).sub(a);
    if (b.cross(c).lengthSq() > 1e-18) faces.push(...corners);
  }
  shape.setIndex(faces);
  smoothSeamNormals(shape);
  return shape;
}

const geometry = {
  forearm: taperedForearmGeometry(),
  cuff: new THREE.CapsuleGeometry(0.072, 0.018, 4, 12),
  wrist: new THREE.CapsuleGeometry(0.054, 0.05, 4, 8),
  palm: new THREE.CapsuleGeometry(0.056, 0.07, 5, 12),
  leftFingers: fingerGeometry(-1),
  rightFingers: fingerGeometry(1),
  leftThumb: thumbGeometry(-1),
  rightThumb: thumbGeometry(1),
  handle: new THREE.CylinderGeometry(0.032, 0.045, 1, 8),
  lashing: woundLashing(),
  fuel: new THREE.CylinderGeometry(0.06, 0.045, 0.14, 8),
  flame: torchFlameGeometry(),
  axeHead: knappedStone([
    [-0.16, -0.06], [-0.05, -0.077], [0.04, -0.06], [0.065, 0.01], [0.03, 0.082],
    [-0.06, 0.09], [-0.19, 0.145], [-0.29, 0.07], [-0.3, -0.038], [-0.27, -0.09],
  ], -0.08),
  spearHead: knappedStone([
    [-0.035, -0.15], [0.035, -0.15], [0.054, -0.1], [0.08, -0.074], [0.065, -0.055],
    [0.073, -0.02], [0.02, 0.1], [0, 0.17], [-0.026, 0.115], [-0.068, 0.015],
    [-0.077, -0.045], [-0.062, -0.062], [-0.083, -0.086], [-0.046, -0.112],
  ], 0),
};

interface HandRig {
  palm: THREE.Group;
}

function createHand(actionPivot: THREE.Group, side: 'left' | 'right'): HandRig {
  const direction = side === 'left' ? -1 : 1;
  const isLeft = side === 'left';
  const skin = { surface: 'skin' as const };
  const cloth = { surface: 'plain' as const };
  const forearm = new THREE.Group();
  forearm.name = `${side}-forearm`;
  forearm.position.set(direction * 0.7, -0.32, 0.08);
  forearm.rotation.set(-0.28, direction * 0.05, direction * 0.4);
  const forearmPart = addInkedPart(forearm, geometry.forearm, 0x3f6265, [0, 0.08, 0], [1.02, 1, 0.96], isLeft ? [0.02, -0.12, 0.015] : [-0.01, 0.08, -0.025], cloth);
  forearmPart.name = `${side}-forearm-part`;
  const sleeveLength = isLeft ? 7.2 : 6.6;
  forearmPart.scale.y = sleeveLength;
  // Extend only the body side, keeping the sleeve's wrist endpoint fixed.
  forearmPart.position.addScaledVector(
    new THREE.Vector3(0, 1, 0).applyEuler(forearmPart.rotation),
    -0.222 * (sleeveLength - 1),
  );
  const cuff = addInkedPart(forearm, geometry.cuff, 0x294b50, [0, 0.285, -0.004], [1.06, 0.3, 0.9], [0, 0, isLeft ? -0.04 : 0.05], {
    surface: 'plain',
    outline: false,
  });
  cuff.name = `${side}-cuff`;
  actionPivot.add(forearm);

  const wrist = new THREE.Group();
  wrist.name = `${side}-wrist`;
  wrist.position.set(0, 0.305, -0.012);
  wrist.rotation.set(isLeft ? -0.04 : 0.03, direction * 0.08, isLeft ? -0.06 : 0.05);
  const wristPart = addInkedPart(wrist, geometry.wrist, 0xc98562, [direction * 0.028, 0.014, -0.004], [0.92, 0.82, 0.88], [0, 0, 0], { ...skin, outline: false });
  wristPart.name = `${side}-wrist-part`;
  forearm.add(wrist);

  const palm = new THREE.Group();
  palm.name = `${side}-palm`;
  palm.position.set(isLeft ? -0.006 : 0.01, isLeft ? 0.072 : 0.06, isLeft ? -0.018 : -0.03);
  palm.rotation.set(isLeft ? -0.44 : -0.31, isLeft ? -0.18 : 0.1, isLeft ? 0.1 : -0.04);
  const handGrip = new THREE.Group();
  handGrip.name = `${side}-hand-grip`;
  handGrip.position.set(isLeft ? -0.02 : 0.035, 0.012, -0.05);
  palm.add(handGrip);
  const palmPad = addInkedPart(handGrip, geometry.palm, 0xe0a078, [direction * 0.067, -0.006, -0.005], isLeft ? [0.78, 1.02, 0.88] : [0.8, 1, 0.84], [0, 0, 0], {
    ...skin,
    outlineScale: 1.018,
  });
  palmPad.name = `${side}-palm-pad`;
  wrist.add(palm);

  const fingers = addInkedPart(handGrip, isLeft ? geometry.leftFingers : geometry.rightFingers, 0xe0a078, [0, 0, 0], [1, 1, 1], [0, 0, 0], { ...skin, outline: false });
  fingers.name = `${side}-curled-fingers`;
  const thumb = new THREE.Group();
  thumb.name = `${side}-thumb`;
  thumb.userData.viewModelPart = 'thumb';
  const thumbBase = addInkedPart(thumb, isLeft ? geometry.leftThumb : geometry.rightThumb, 0xe0a078, [0, 0, 0], [1, 1, 1], [0, 0, 0], {
    ...skin,
    outline: false,
  });
  thumbBase.name = `${side}-thumb-base`;
  handGrip.add(thumb);

  return { palm };
}

function createTools(grip: THREE.Group): Pick<ViewModel, 'axe' | 'spear' | 'torch'> {
  const wood = { surface: 'wood' as const };
  const stone = { surface: 'stone' as const };

  const axe = new THREE.Group();
  axe.name = 'gripped-axe';
  const axeShaft = addInkedPart(axe, geometry.handle, PALETTE.wood, [0, 0.24, 0], [0.92, 0.72, 0.92], [0, 0, 0], wood);
  axeShaft.name = 'axe-shaft';
  const axeHead = addInkedPart(axe, geometry.axeHead, 0x73867e, [0, 0.6, 0], [1, 1, 1], [0.08, 0, -0.14], stone);
  axeHead.name = 'axe-head';
  addInkedPart(axe, geometry.lashing, 0xc2a77a, [0, 0.59, 0], [1, 0.9, 0.95], [0, 0, 0], {
    surface: 'wood', outline: false,
  }).name = 'axe-lashing';
  axe.rotation.set(0.08, 0.02, -0.08);

  const spear = new THREE.Group();
  spear.name = 'gripped-spear';
  const spearShaft = addInkedPart(spear, geometry.handle, 0x5c3d27, [0, 0.31, 0], [0.7, 0.75, 0.7], [0, 0, 0], wood);
  spearShaft.name = 'spear-shaft';
  const spearLashing = addInkedPart(spear, geometry.lashing, 0xc2a77a, [0, 0.68, 0], [0.82, 0.78, 0.68], [0, 0, 0], {
    surface: 'wood',
    outline: false,
  });
  spearLashing.name = 'spear-lashing';
  const spearHead = addInkedPart(spear, geometry.spearHead, 0x73867e, [0, 0.8, 0], [0.88, 0.88, 0.82], [0, 0, 0], {
    ...stone,
    outlineScale: 1.018,
  });
  spearHead.name = 'spear-head';
  spear.rotation.set(-0.12, -0.03, -0.08);

  const torch = new THREE.Group();
  torch.name = 'gripped-torch';
  const torchShaft = addInkedPart(torch, geometry.handle, PALETTE.wood, [0, 0.27, 0], [0.96, 0.58, 0.96], [0, 0, 0], wood);
  torchShaft.name = 'torch-shaft';
  addInkedPart(torch, geometry.fuel, 0x66503a, [0, 0.555, 0], [1, 1, 1], [0, 0, 0], {
    ...wood, outline: false,
  }).name = 'torch-fuel-wrap';
  const outerFlame = addInkedPart(torch, geometry.flame, PALETTE.danger, [0, 0.68, 0], [1, 1, 1], [0.04, 0, -0.08], {
    outline: false,
    unlit: true,
  });
  outerFlame.name = 'torch-flame-outer';
  const flameCore = addInkedPart(torch, geometry.flame, PALETTE.amber, [0.014, 0.637, 0.05], [0.58, 0.64, 0.64], [-0.08, 0, 0.12], {
    outline: false,
    unlit: true,
  });
  flameCore.name = 'torch-flame-core';
  const light = new THREE.PointLight(PALETTE.amber, 0.75, 6.5, 1.8);
  light.position.set(0, 0.68, 0);
  torch.add(light);
  torch.rotation.set(0.04, 0, -0.03);

  grip.add(axe, spear, torch);
  axe.visible = false;
  spear.visible = false;
  torch.visible = false;
  return { axe, spear, torch };
}

export function createViewModel(camera: THREE.Camera): ViewModel {
  const root = new THREE.Group();
  root.name = 'Rounded first-person hands and tools';
  root.position.set(0, -0.44, -0.74);
  root.scale.setScalar(0.48);

  const actionPivot = new THREE.Group();
  actionPivot.name = 'view-model-action-pivot';
  root.add(actionPivot);
  createHand(actionPivot, 'left');
  const rightHand = createHand(actionPivot, 'right');

  const grip = new THREE.Group();
  grip.name = 'right-tool-grip';
  grip.position.set(0.035, 0.012, -0.05);
  grip.rotation.set(0.16, 0.03, -0.14);
  rightHand.palm.add(grip);
  const tools = createTools(grip);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    if (!material) return;
    const overlayMaterial = material.clone();
    overlayMaterial.depthTest = true;
    overlayMaterial.depthWrite = true;
    child.material = overlayMaterial;
    child.castShadow = false;
    child.receiveShadow = false;
    child.renderOrder = 100;
    child.frustumCulled = false;
  });
  camera.add(root);
  const viewModel = { root, actionPivot, ...tools };
  setViewModelTool(viewModel, 'hands');
  return viewModel;
}

export function setViewModelTool(viewModel: ViewModel, tool: Tool): void {
  const leftForearm = viewModel.root.getObjectByName('left-forearm');
  const rightForearm = viewModel.root.getObjectByName('right-forearm');
  if (leftForearm) {
    if (tool === 'spear') {
      leftForearm.position.set(0.32, 0.1, -0.23);
      leftForearm.rotation.set(-0.18, 0, -0.6);
    } else if (tool === 'axe') {
      leftForearm.position.set(0.44, -0.02, -0.08);
      leftForearm.rotation.set(-0.28, 0.08, -0.28);
    } else if (tool === 'torch') {
      leftForearm.position.set(-0.56, -0.22, 0.06);
      leftForearm.rotation.set(-0.24, -0.05, -0.36);
    } else {
      leftForearm.position.set(-0.62, -0.22, 0.05);
      leftForearm.rotation.set(-0.3, -0.08, -0.33);
    }
  }
  if (rightForearm) {
    const holdingTool = tool !== 'hands';
    rightForearm.position.set(holdingTool ? 0.68 : 0.67, holdingTool ? -0.27 : -0.18, holdingTool ? 0.06 : 0.08);
    rightForearm.rotation.set(holdingTool ? -0.28 : -0.18, 0.05, holdingTool ? 0.34 : 0.39);
  }
  const toolGrip = viewModel.root.getObjectByName('right-tool-grip');
  const selected = tool === 'hands' ? undefined : viewModel[tool];
  const shaft = selected?.getObjectByName(`${tool}-shaft`);
  for (const side of ['right', 'left'] as const) {
    const hand = viewModel.root.getObjectByName(`${side}-hand-grip`);
    const forearm = side === 'right' ? rightForearm : leftForearm;
    if (!hand?.parent || !forearm || !toolGrip) continue;
    const holding = selected && (side === 'right' || tool !== 'torch');
    hand.scale.set(1, 1, 1);
    if (side === 'right') {
      hand.position.copy(toolGrip.position);
      hand.quaternion.copy(toolGrip.quaternion);
      if (selected) hand.quaternion.multiply(selected.quaternion);
    } else {
      hand.position.set(-0.02, 0.012, -0.05);
      hand.rotation.set(0.05, -0.12, 0.08);
    }
    if (!holding) {
      hand.position.y += 0.02;
      hand.scale.y = 1.08;
    }
    if (holding && shaft) {
      const alongShaft = side === 'right' ? 0 : tool === 'spear' ? 0.34 : 0.23;
      const fraction = THREE.MathUtils.clamp((alongShaft - shaft.position.y) / shaft.scale.y + 0.5, 0, 1);
      const radius = THREE.MathUtils.lerp(0.045, 0.032, fraction) * shaft.scale.x;
      hand.scale.set(radius / 0.0305, 1, radius / 0.0305);
      if (side === 'left') {
        viewModel.root.updateWorldMatrix(true, true);
        hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion())).invert()
          .multiply(selected.getWorldQuaternion(new THREE.Quaternion()));
        hand.updateWorldMatrix(false, false);
        const target = selected.localToWorld(new THREE.Vector3(0, alongShaft, 0));
        const current = hand.getWorldPosition(new THREE.Vector3());
        // Move the connected support arm, never detach its palm to fake contact.
        forearm.position.add(viewModel.actionPivot.worldToLocal(target)
          .sub(viewModel.actionPivot.worldToLocal(current)));
      }
    }
    viewModel.root.updateWorldMatrix(true, true);
    const wrist = viewModel.root.getObjectByName(`${side}-wrist`);
    const wristPart = viewModel.root.getObjectByName(`${side}-wrist-part`);
    const cuff = viewModel.root.getObjectByName(`${side}-cuff`);
    if (wrist && wristPart && cuff) {
      const start = wrist.worldToLocal(cuff.localToWorld(new THREE.Vector3(0, 0.03, 0)));
      const end = wrist.worldToLocal(hand.localToWorld(new THREE.Vector3(side === 'left' ? -0.058 : 0.058, -0.056, -0.012)));
      const axis = end.clone().sub(start);
      wristPart.position.copy(start).add(end).multiplyScalar(0.5);
      wristPart.scale.set(0.9, (axis.length() + 0.055) / 0.158, 0.85);
      wristPart.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    }
  }
  viewModel.axe.visible = tool === 'axe';
  viewModel.spear.visible = tool === 'spear';
  viewModel.torch.visible = tool === 'torch';
}
