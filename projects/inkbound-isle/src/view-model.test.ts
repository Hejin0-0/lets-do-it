import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import type { Tool } from './gameplay.ts';
import { surfaceTexture } from './materials.ts';
import { createViewModel, sampleToolPose, setViewModelTool, toolActionDuration } from './view-model.ts';

const TOOLS: readonly Tool[] = ['hands', 'axe', 'spear', 'torch'];

function projectedBounds(object: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  const points: THREE.Vector3[] = [];
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const positions = child.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      points.push(new THREE.Vector3()
        .fromBufferAttribute(positions, index)
        .applyMatrix4(child.matrixWorld)
        .project(camera));
    }
  });
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    maxX: Math.max(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
}

function renderCost(object: THREE.Object3D): { triangles: number; meshes: number } {
  let triangles = 0;
  let meshes = 0;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshes += 1;
    triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
  });
  return { triangles, meshes };
}

describe('first-person view model', () => {
  it('owns connected hands and selected-tool visibility through its public runtime pose', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const leftForearm = viewModel.root.getObjectByName('left-forearm');
    const leftArmPart = viewModel.root.getObjectByName('left-forearm-part');
    const leftWristPart = viewModel.root.getObjectByName('left-wrist-part');
    assert.ok(leftForearm && leftArmPart && leftWristPart);

    setViewModelTool(viewModel, 'hands');
    camera.updateMatrixWorld(true);
    assert.ok(leftForearm.position.x < 0);
    assert.equal(viewModel.axe.visible || viewModel.spear.visible || viewModel.torch.visible, false);
    assert.equal(new THREE.Box3().setFromObject(leftArmPart)
      .intersectsBox(new THREE.Box3().setFromObject(leftWristPart)), true);

    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    assert.ok(leftForearm.position.x > 0);
    assert.equal(viewModel.spear.visible, true);
    assert.equal(viewModel.axe.visible || viewModel.torch.visible, false);
    assert.equal(new THREE.Box3().setFromObject(leftArmPart)
      .intersectsBox(new THREE.Box3().setFromObject(leftWristPart)), true);

    const shaft = viewModel.spear.getObjectByName('spear-shaft');
    const leftPad = viewModel.root.getObjectByName('left-palm-pad');
    const rightPad = viewModel.root.getObjectByName('right-palm-pad');
    assert.ok(shaft && leftPad && rightPad);
    const shaftCenter = shaft.getWorldPosition(new THREE.Vector3());
    const shaftAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    for (const pad of [leftPad, rightPad]) {
      const offset = pad.getWorldPosition(new THREE.Vector3()).sub(shaftCenter);
      const distance = offset.clone().sub(shaftAxis.clone().multiplyScalar(offset.dot(shaftAxis))).length();
      assert.ok(distance >= 0.025 && distance <= 0.045, `${pad.name} contact distance ${distance}`);
    }
  });

  it('uses attached curled finger masses and an opposing thumb instead of disks and pegs', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    const leftPalm = viewModel.root.getObjectByName('left-palm');
    const rightPalm = viewModel.root.getObjectByName('right-palm');
    const leftPad = viewModel.root.getObjectByName('left-palm-pad');
    const rightPad = viewModel.root.getObjectByName('right-palm-pad');
    assert.ok(leftPalm && rightPalm && leftPad && rightPad);
    for (const side of ['left', 'right'] as const) {
      for (let index = 1; index <= 3; index += 1) {
        assert.equal(viewModel.root.getObjectByName(`${side}-knuckle-${index}`), undefined);
      }
      const pad = viewModel.root.getObjectByName(`${side}-palm-pad`);
      const thumbBase = viewModel.root.getObjectByName(`${side}-thumb-base`);
      const fingers = viewModel.root.getObjectByName(`${side}-curled-fingers`);
      assert.ok(pad && thumbBase && fingers, `${side} needs attached curled fingers`);
      assert.equal(viewModel.root.getObjectByName(`${side}-thumb-tip`), undefined);
      let thumbMesh: THREE.Mesh | undefined;
      thumbBase.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.inkFill) thumbMesh = object;
      });
      assert.ok(thumbMesh);
      assert.equal(thumbMesh.geometry.type, 'BufferGeometry');
      thumbMesh.geometry.computeBoundingBox();
      const size = thumbMesh.geometry.boundingBox!.getSize(new THREE.Vector3());
      assert.ok(size.x >= 0.08 && size.y >= 0.1 && size.z >= 0.075, 'thumb must hook around the shaft');
      assert.equal(new THREE.Box3().setFromObject(pad)
        .intersectsBox(new THREE.Box3().setFromObject(thumbBase)), true);
      assert.equal(new THREE.Box3().setFromObject(pad)
        .intersectsBox(new THREE.Box3().setFromObject(fingers)), true);
    }
    assert.notDeepEqual(leftPad.scale.toArray(), rightPad.scale.toArray());
    assert.ok(Math.abs(leftPalm.rotation.x - rightPalm.rotation.x) >= 0.08);
    assert.equal(viewModel.root.getObjectByName('right-tool-grip')?.position.x, 0.035);
  });

  it('centers both curved grips on the selected shaft and encloses it on three sides', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    for (const selected of ['spear', 'axe', 'torch'] as const) {
      setViewModelTool(viewModel, selected);
      camera.updateMatrixWorld(true);
      const tool = viewModel[selected];
      const shaft = tool.getObjectByName(`${selected}-shaft`);
      assert.ok(shaft);
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(tool.getWorldQuaternion(new THREE.Quaternion()));
      const origin = tool.getWorldPosition(new THREE.Vector3());
      for (const side of selected === 'torch' ? ['right'] as const : ['left', 'right'] as const) {
        const grip = viewModel.root.getObjectByName(`${side}-hand-grip`);
        const fingers = viewModel.root.getObjectByName(`${side}-curled-fingers`);
        assert.ok(grip && fingers, `${side} needs a shaft-local grip`);
        const offset = grip.getWorldPosition(new THREE.Vector3()).sub(origin);
        assert.ok(offset.clone().sub(axis.clone().multiplyScalar(offset.dot(axis))).length() < 1e-6);
        const gripAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(grip.getWorldQuaternion(new THREE.Quaternion()));
        assert.ok(gripAxis.dot(axis) > 0.9999);
        const scale = grip.getWorldScale(new THREE.Vector3()).x;
        for (const row of [-0.055, -0.018, 0.021, 0.058]) {
          for (const angle of [Math.PI / 4, Math.PI / 2, Math.PI * 5 / 6]) {
            const localDirection = new THREE.Vector3((side === 'left' ? -1 : 1) * Math.cos(angle), 0, Math.sin(angle));
            const direction = localDirection.applyQuaternion(grip.getWorldQuaternion(new THREE.Quaternion()));
            const ray: THREE.Raycaster = new THREE.Raycaster(grip.localToWorld(new THREE.Vector3(0, row, 0)), direction);
            const hit: THREE.Intersection | undefined = ray.intersectObject(fingers, true)[0];
            assert.ok(hit, `${selected} ${side} finger row ${row} leaves shaft unenclosed at ${angle}`);
            assert.ok(hit.distance / scale >= 0.018 && hit.distance / scale <= 0.065,
              `${selected} ${side} finger clearance ${hit.distance / scale}`);
          }
        }
      }
    }
  });

  it('shows an opposing thumb across the front of each spear grip, not buried behind the fingers', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    for (const side of ['left', 'right'] as const) {
      const grip = viewModel.root.getObjectByName(`${side}-hand-grip`);
      const thumb = viewModel.root.getObjectByName(`${side}-thumb-base`);
      const fingers = viewModel.root.getObjectByName(`${side}-curled-fingers`);
      assert.ok(grip && thumb && fingers);
      const direction = side === 'left' ? -1 : 1;
      let visible = 0;
      for (const [x, y, z] of [[0.028, 0.058, 0.074], [0.008, 0.055, 0.07], [-0.014, 0.048, 0.062]]) {
        const point = grip.localToWorld(new THREE.Vector3(x! * direction, y!, z!));
        const ray: THREE.Raycaster = new THREE.Raycaster(new THREE.Vector3(), point.normalize());
        const thumbHit: THREE.Intersection | undefined = ray.intersectObject(thumb, true)[0];
        const fingerHit: THREE.Intersection | undefined = ray.intersectObject(fingers, true)[0];
        if (thumbHit && (!fingerHit || thumbHit.distance < fingerHit.distance)) visible += 1;
      }
      assert.ok(visible >= 2, `${side} thumb is hidden behind the repeated finger bars (${visible}/3)`);
    }
  });

  it('varies finger reach while keeping all four grips connected', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    const fingers = viewModel.root.getObjectByName('right-curled-fingers');
    const fill = fingers?.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
    assert.ok(fill instanceof THREE.Mesh);
    const positions = fill.geometry.getAttribute('position');
    const reach = [-0.055, -0.018, 0.021, 0.058].map((row) => {
      let front = -Infinity;
      for (let index = 0; index < positions.count; index += 1) {
        if (Math.abs(positions.getY(index) - row) < 0.006) front = Math.max(front, positions.getZ(index));
      }
      return front;
    });
    assert.ok(reach.every(Number.isFinite));
    assert.ok(Math.max(...reach) - Math.min(...reach) > 0.009, 'identical finger reach reads as four parallel bars');
  });

  it('bends the cloth body through an interior ring instead of stretching a straight tube', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    const sleeve = viewModel.root.getObjectByName('left-forearm-part');
    const fill = sleeve?.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
    assert.ok(fill instanceof THREE.Mesh);
    const positions = fill.geometry.getAttribute('position');
    const middleX: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index)) < 0.0001) middleX.push(positions.getX(index));
    }
    assert.ok(middleX.length >= 12, 'sleeve body needs an interior bend ring');
    assert.ok((Math.min(...middleX) + Math.max(...middleX)) / 2 >= 0.045);
  });

  it('keeps lighting normals continuous across the curved skin and cloth seams', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    for (const name of ['left-curled-fingers', 'right-thumb-base', 'left-forearm-part']) {
      const part = viewModel.root.getObjectByName(name);
      const fill = part?.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
      assert.ok(fill instanceof THREE.Mesh);
      const positions = fill.geometry.getAttribute('position');
      const normals = fill.geometry.getAttribute('normal');
      const seen = new Map<string, THREE.Vector3>();
      for (let index = 0; index < positions.count; index += 1) {
        const key = [positions.getX(index), positions.getY(index), positions.getZ(index)]
          .map((value) => Math.round(value * 1e6)).join(',');
        const normal = new THREE.Vector3().fromBufferAttribute(normals, index);
        const previous = seen.get(key);
        if (previous) assert.ok(previous.dot(normal) > 0.999, `${name} has a lighting seam at ${key}`);
        seen.set(key, normal);
      }
    }
  });

  it('keeps cuff, wrist, and palm connected and selection idempotent under action transforms', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(8, 4, -2);
    camera.rotation.set(0.13, -0.47, 0.1);
    const viewModel = createViewModel(camera);
    for (const tool of TOOLS) {
      const pose = sampleToolPose(tool, 0.47);
      viewModel.actionPivot.position.set(...pose.position);
      viewModel.actionPivot.rotation.set(...pose.rotation);
      setViewModelTool(viewModel, tool);
      camera.updateMatrixWorld(true);
      const leftForearm = viewModel.root.getObjectByName('left-forearm');
      assert.ok(leftForearm);
      const firstPosition = leftForearm.position.clone();
      setViewModelTool(viewModel, tool);
      camera.updateMatrixWorld(true);
      assert.ok(leftForearm.position.distanceTo(firstPosition) < 1e-10);
      for (const side of ['left', 'right'] as const) {
        const bounds = (part: string): THREE.Box3 => {
          const object = viewModel.root.getObjectByName(`${side}-${part}`);
          assert.ok(object);
          return new THREE.Box3().setFromObject(object);
        };
        assert.ok(bounds('forearm-part').intersectsBox(bounds('cuff')));
        assert.ok(bounds('cuff').intersectsBox(bounds('wrist-part')));
        assert.ok(bounds('wrist-part').intersectsBox(bounds('palm-pad')));
      }
    }
  });

  it('keeps both sleeve body caps below the viewport through neutral, attack, and recovery', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    for (const fov of [60, 70, 75, 95, 99]) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      for (const tool of TOOLS) {
        setViewModelTool(viewModel, tool);
        for (const phase of Array.from({ length: 41 }, (_, index) => index / 40)) {
          const pose = sampleToolPose(tool, phase);
          viewModel.actionPivot.position.set(...pose.position);
          viewModel.actionPivot.rotation.set(...pose.rotation);
          for (const sway of [-0.06, 0, 0.06]) {
            viewModel.root.rotation.z = sway;
            camera.updateMatrixWorld(true);
            for (const side of ['left', 'right'] as const) {
              const sleeve = viewModel.root.getObjectByName(`${side}-forearm-part`);
              const fill = sleeve?.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
              assert.ok(fill instanceof THREE.Mesh);
              const { radius, height } = fill.geometry.parameters as { radius: number; height: number };
              const bottomPlane = (point: THREE.Vector3): number => {
                const clip = new THREE.Vector4(point.x, point.y, point.z, 1)
                  .applyMatrix4(fill.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
                  .applyMatrix4(camera.projectionMatrix);
                // Homogeneous clipping also handles the body end behind the camera.
                return clip.y + clip.w;
              };
              assert.ok(bottomPlane(new THREE.Vector3(0, -height / 2 - radius, 0)) < 0,
                `${tool} ${side} body endpoint is exposed at ${fov}° phase ${phase}`);
              const positions = fill.geometry.getAttribute('position');
              let capTop = -Infinity;
              for (let index = 0; index < positions.count; index += 1) {
                if (positions.getY(index) > -height / 2 + 0.0001) continue;
                capTop = Math.max(capTop, bottomPlane(new THREE.Vector3().fromBufferAttribute(positions, index)));
              }
              assert.ok(capTop < 0, `${tool} ${side} body cap crosses the bottom clip plane at ${fov}° phase ${phase}: ${capTop}`);
            }
          }
        }
      }
    }
  });

  it('tapers sleeves through rounded cuffs into articulated capsule wrists', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'hands');
    camera.updateMatrixWorld(true);

    for (const side of ['left', 'right'] as const) {
      const forearm = viewModel.root.getObjectByName(`${side}-forearm-part`);
      const cuff = viewModel.root.getObjectByName(`${side}-cuff`);
      const wrist = viewModel.root.getObjectByName(`${side}-wrist-part`);
      const palm = viewModel.root.getObjectByName(`${side}-palm-pad`);
      assert.ok(forearm && cuff && wrist && palm);
      let taperRatio = 0;
      let elbowPlane = 0;
      let roundedCuff = false;
      let articulatedWrist = false;
      forearm.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.inkFill) {
          taperRatio = object.geometry.userData.taperRatio as number;
          elbowPlane = object.geometry.userData.elbowPlane as number;
        }
      });
      cuff.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'CapsuleGeometry') roundedCuff = true;
      });
      wrist.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'CapsuleGeometry') articulatedWrist = true;
      });
      assert.ok(taperRatio >= 1.35);
      assert.ok(elbowPlane >= 0.1);
      assert.equal(roundedCuff, true);
      assert.equal(articulatedWrist, true);
      assert.equal(new THREE.Box3().setFromObject(forearm)
        .intersectsBox(new THREE.Box3().setFromObject(cuff)), true);
      assert.equal(new THREE.Box3().setFromObject(cuff)
        .intersectsBox(new THREE.Box3().setFromObject(wrist)), true);
      const bounds = projectedBounds(palm, camera);
      assert.ok(bounds.maxY >= -0.68 && bounds.maxY <= -0.25);
      assert.ok(bounds.maxY - bounds.minY >= 0.195);
    }
  });

  it('visibly occludes the spear with both curved grips in the boss view', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    const shaft = viewModel.spear.getObjectByName('spear-shaft');
    assert.ok(shaft);
    for (const side of ['left', 'right'] as const) {
      const hand = viewModel.root.getObjectByName(`${side}-hand-grip`);
      assert.ok(hand);
      for (const row of [-0.018, 0.021, 0.058]) {
        const target: THREE.Vector3 = hand.localToWorld(new THREE.Vector3(0, row, 0));
        const ray: THREE.Raycaster = new THREE.Raycaster(new THREE.Vector3(), target.normalize());
        const skinHit: THREE.Intersection | undefined = ray.intersectObject(hand, true)[0];
        const shaftHit: THREE.Intersection | undefined = ray.intersectObject(shaft, true)[0];
        assert.ok(skinHit && shaftHit, `${side} boss grip does not cover the shaft at ${row}`);
        assert.ok(skinHit.distance < shaftHit.distance, `${side} shaft appears in front of fingers at ${row}`);
      }
    }
  });

  it('separates the support forearm direction and value from the spear shaft', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    const forearm = viewModel.root.getObjectByName('left-forearm-part');
    const shaft = viewModel.spear.getObjectByName('spear-shaft');
    const palm = viewModel.root.getObjectByName('left-palm-pad');
    assert.ok(forearm && shaft && palm);
    const forearmAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(forearm.getWorldQuaternion(new THREE.Quaternion()));
    const shaftAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    const angle = Math.acos(Math.min(1, Math.abs(forearmAxis.dot(shaftAxis))));
    assert.ok(angle >= THREE.MathUtils.degToRad(40));

    const fillMaterial = (object: THREE.Object3D) => {
      let material: THREE.MeshToonMaterial | undefined;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.inkFill && child.material instanceof THREE.MeshToonMaterial) {
          material = child.material;
        }
      });
      return material;
    };
    const shaftMaterial = fillMaterial(shaft);
    const palmMaterial = fillMaterial(palm);
    assert.ok(shaftMaterial && palmMaterial);
    const luminance = ({ r, g, b }: THREE.Color) => r * 0.2126 + g * 0.7152 + b * 0.0722;
    assert.ok(luminance(palmMaterial.color) - luminance(shaftMaterial.color) >= 0.18);
  });

  it('keeps the off-hand clear of the torch and limits warm light spill on the grip', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'torch');
    camera.updateMatrixWorld(true);
    const leftPad = viewModel.root.getObjectByName('left-palm-pad');
    const shaft = viewModel.torch.getObjectByName('torch-shaft');
    const light = viewModel.torch.children.find((child) => child instanceof THREE.PointLight);
    assert.ok(leftPad && shaft && light instanceof THREE.PointLight);
    const shaftCenter = shaft.getWorldPosition(new THREE.Vector3());
    const shaftAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    const offset = leftPad.getWorldPosition(new THREE.Vector3()).sub(shaftCenter);
    const distance = offset.clone().sub(shaftAxis.clone().multiplyScalar(offset.dot(shaftAxis))).length();
    assert.ok(distance >= 0.15);
    assert.ok(light.intensity <= 0.8 && light.distance <= 7);
  });

  it('returns every tool to a finite neutral pose at both action boundaries', () => {
    for (const tool of TOOLS) {
      const start = sampleToolPose(tool, 0);
      const end = sampleToolPose(tool, 1);
      assert.deepEqual(start, end);
      assert.ok([...start.position, ...start.rotation].every((value) => value === 0));
      assert.deepEqual(sampleToolPose(tool, Number.NaN), start);
      assert.deepEqual(sampleToolPose(tool, -1), start);
      assert.deepEqual(sampleToolPose(tool, 2), start);
    }
  });

  it('gives each tool distinct bounded anticipation, active, and recovery poses', () => {
    for (const time of [0.16, 0.47, 0.8]) {
      const poses = TOOLS.map((tool) => sampleToolPose(tool, time));
      assert.equal(new Set(poses.map((pose) => JSON.stringify(pose))).size, TOOLS.length);
      assert.ok(poses.every((pose) => [...pose.position, ...pose.rotation]
        .every((value) => Number.isFinite(value) && Math.abs(value) <= 1.6)));
    }
    for (const tool of TOOLS) {
      const phases = [0.16, 0.47, 0.8].map((time) => JSON.stringify(sampleToolPose(tool, time)));
      assert.equal(new Set(phases).size, phases.length);
    }
  });

  it('drives the spear from a readable wind-up through hit contact and into recoil', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);
    setViewModelTool(viewModel, 'spear');
    const head = viewModel.spear.getObjectByName('spear-head');
    assert.ok(head);
    const sample = (phase: number) => {
      const pose = sampleToolPose('spear', phase);
      viewModel.actionPivot.position.set(...pose.position);
      viewModel.actionPivot.rotation.set(...pose.rotation);
      camera.updateMatrixWorld(true);
      const world = head.getWorldPosition(new THREE.Vector3());
      const screen = world.clone().project(camera);
      return { screen, depth: -world.applyMatrix4(camera.matrixWorldInverse).z };
    };

    const neutral = sample(0);
    const windUp = sample(0.16);
    const contact = sample(0.47);
    const recoil = sample(0.62);
    const recovery = sample(0.8);
    const screenArc = new THREE.Vector2(contact.screen.x, contact.screen.y)
      .distanceTo(new THREE.Vector2(windUp.screen.x, windUp.screen.y));

    assert.ok(screenArc >= 0.38, `spear contact arc is only ${screenArc}`);
    assert.ok(windUp.screen.x - contact.screen.x >= 0.26, 'wind-up must load at the lower-right before striking inward');
    assert.ok(contact.screen.y - windUp.screen.y >= 0.2, 'contact must cut visibly upward from the wind-up');
    assert.ok(Math.hypot(contact.screen.x, contact.screen.y) <= 0.18, 'spear contact must arrive at the reticle');
    assert.ok(contact.depth - windUp.depth >= 0.48, 'contact must deliver a decisive forward thrust');
    assert.ok(contact.depth - recoil.depth >= 0.2, 'the spear must rebound after contact');
    assert.ok(recovery.screen.distanceTo(neutral.screen) <= 0.16, 'recovery must settle near the held pose');
  });

  it('holds weapon actions on screen long enough to read anticipation, contact, and recoil', () => {
    const durations = TOOLS.map((tool) => toolActionDuration(tool));
    assert.ok(durations.every((duration) => Number.isFinite(duration) && duration >= 0.3 && duration <= 0.65));
    assert.ok(toolActionDuration('spear') * 30 >= 15, 'spear action exposes fewer than fifteen 30fps frames');
    assert.ok(toolActionDuration('spear') > toolActionDuration('hands'));
    assert.ok(toolActionDuration('spear') >= toolActionDuration('axe'));
  });

  it('parents rounded arm and hand chains to a real shared tool grip', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const rightForearm = viewModel.root.getObjectByName('right-forearm');
    const rightWrist = viewModel.root.getObjectByName('right-wrist');
    const rightPalm = viewModel.root.getObjectByName('right-palm');
    const grip = viewModel.root.getObjectByName('right-tool-grip');
    assert.equal(viewModel.root.parent, camera);
    assert.equal(viewModel.actionPivot.parent, viewModel.root);
    assert.equal(rightWrist?.parent, rightForearm);
    assert.equal(rightPalm?.parent, rightWrist);
    assert.equal(grip?.parent, rightPalm);
    assert.equal(viewModel.axe.parent, grip);
    assert.equal(viewModel.spear.parent, grip);
    assert.equal(viewModel.torch.parent, grip);

    let roundedForearm = false;
    rightForearm?.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry.type === 'CapsuleGeometry') roundedForearm = true;
    });
    assert.equal(roundedForearm, true);

    const maps = new Set<THREE.Texture>();
    viewModel.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (material instanceof THREE.MeshToonMaterial && material.map) maps.add(material.map);
    });
    assert.ok(maps.has(surfaceTexture('skin')));
    assert.ok(maps.has(surfaceTexture('plain')));
    assert.ok(maps.has(surfaceTexture('wood')));
    assert.ok(maps.has(surfaceTexture('stone')));

    const fillMaterial = (name: string) => {
      let material: THREE.MeshToonMaterial | undefined;
      viewModel.root.getObjectByName(name)?.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.inkFill && object.material instanceof THREE.MeshToonMaterial) {
          material = object.material;
        }
      });
      return material;
    };
    const skinMaterial = fillMaterial('right-palm-pad');
    const clothMaterial = fillMaterial('right-forearm-part');
    const woodMaterial = fillMaterial('spear-shaft');
    assert.ok(skinMaterial && clothMaterial && woodMaterial);
    assert.equal(skinMaterial.map, surfaceTexture('skin'));
    assert.equal(clothMaterial.map, surfaceTexture('plain'));
    assert.equal(woodMaterial.map, surfaceTexture('wood'));
    const luminance = ({ r, g, b }: THREE.Color) => r * 0.2126 + g * 0.7152 + b * 0.0722;
    assert.ok(luminance(skinMaterial.color) - luminance(clothMaterial.color) >= 0.25);
    assert.notEqual(clothMaterial.color.getHex(), woodMaterial.color.getHex());
  });

  it('stages both forearms from the lower corners into inward readable grips', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const leftForearm = viewModel.root.getObjectByName('left-forearm');
    const rightForearm = viewModel.root.getObjectByName('right-forearm');
    const leftWrist = viewModel.root.getObjectByName('left-wrist');
    const rightWrist = viewModel.root.getObjectByName('right-wrist');
    const leftPalm = viewModel.root.getObjectByName('left-palm');
    const rightPalm = viewModel.root.getObjectByName('right-palm');
    const grip = viewModel.root.getObjectByName('right-tool-grip');

    assert.ok(leftForearm && rightForearm && leftWrist && rightWrist && leftPalm && rightPalm && grip);
    assert.ok(leftForearm.position.x <= -0.34 && rightForearm.position.x >= 0.34);
    assert.ok(Math.abs(leftForearm.position.x) <= 0.75 && Math.abs(rightForearm.position.x) <= 0.75);
    assert.ok(leftForearm.position.y <= -0.16 && rightForearm.position.y <= -0.16);
    assert.ok(leftForearm.rotation.z <= -0.3 && rightForearm.rotation.z >= 0.35);
    assert.ok(Math.abs(leftForearm.position.y - rightForearm.position.y) >= 0.02);
    assert.ok(Math.abs(Math.abs(leftForearm.rotation.z) - Math.abs(rightForearm.rotation.z)) >= 0.04);
    assert.ok(leftWrist.position.y >= 0.28 && rightWrist.position.y >= 0.28);
    assert.ok(leftPalm.position.y > 0 && rightPalm.position.y > 0);
    assert.ok(grip.position.y >= 0);
    assert.ok(viewModel.root.scale.x <= 0.56);
    assert.equal(viewModel.root.getObjectByName('left-thumb')?.parent?.name, 'left-hand-grip');
    assert.equal(viewModel.root.getObjectByName('right-thumb')?.parent?.name, 'right-hand-grip');
  });

  it('uses rounded grip anatomy without internal ink tangles and articulates each thumb', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());

    for (const side of ['left', 'right'] as const) {
      const palm = viewModel.root.getObjectByName(`${side}-palm-pad`);
      const thumb = viewModel.root.getObjectByName(`${side}-thumb`);
      assert.ok(palm && thumb);

      const palmMesh = palm.children.find((part) => part instanceof THREE.Mesh && part.userData.inkFill);
      assert.ok(palmMesh instanceof THREE.Mesh);
      assert.equal(palmMesh.geometry.type, 'CapsuleGeometry');
      assert.ok((palmMesh.geometry.parameters.radialSegments as number) >= 12);

      const thumbFills: THREE.Mesh[] = [];
      thumb.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.inkFill) thumbFills.push(object);
        assert.notEqual(object.userData.inkOutline, true, `${side} thumb has an internal outline seam`);
      });
      assert.equal(thumbFills.length, 1);
    }
  });

  it('uses the depth buffer for internal hand and tool self-occlusion', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());

    assert.ok(viewModel.root.position.z < -0.3 && viewModel.root.position.z > -0.9);
    viewModel.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        assert.equal(material.depthTest, true, `${object.name || object.type} skips self-occlusion`);
        assert.equal(material.depthWrite, true, `${object.name || object.type} cannot establish depth`);
      }
    });
    const cost = renderCost(viewModel.root);
    assert.ok(cost.triangles <= 6_000, `${cost.triangles} triangles exceeds the viewmodel budget`);
    assert.ok(cost.meshes <= 36, `${cost.meshes} drawables exceeds the viewmodel budget`);
  });

  it('runs every selected tool shaft through the right palm grip origin', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const grip = viewModel.root.getObjectByName('right-tool-grip');
    assert.ok(grip);
    camera.updateMatrixWorld(true);
    const gripOrigin = grip.getWorldPosition(new THREE.Vector3());

    for (const [tool, shaftName] of [
      [viewModel.axe, 'axe-shaft'],
      [viewModel.spear, 'spear-shaft'],
      [viewModel.torch, 'torch-shaft'],
    ] as const) {
      const shaft = tool.getObjectByName(shaftName);
      assert.ok(shaft, `${shaftName} is missing`);
      assert.ok(new THREE.Box3().setFromObject(shaft).containsPoint(gripOrigin), `${shaftName} misses grip`);
    }
  });

  it('flanks the spear shaft with separated palms and opposing thumbs', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const leftForearm = viewModel.root.getObjectByName('left-forearm');
    const leftPalm = viewModel.root.getObjectByName('left-palm');
    const rightPalm = viewModel.root.getObjectByName('right-palm');
    const leftPad = viewModel.root.getObjectByName('left-palm-pad');
    const rightPad = viewModel.root.getObjectByName('right-palm-pad');
    const leftThumb = viewModel.root.getObjectByName('left-thumb');
    const rightThumb = viewModel.root.getObjectByName('right-thumb');
    const grip = viewModel.root.getObjectByName('right-tool-grip');
    assert.ok(leftForearm && leftPalm && rightPalm && leftPad && rightPad && leftThumb && rightThumb && grip);

    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    const gripPoint = grip.getWorldPosition(new THREE.Vector3());
    const leftPadPoint = leftPad.getWorldPosition(new THREE.Vector3());
    const rightPadPoint = rightPad.getWorldPosition(new THREE.Vector3());
    const leftPalmPoint = leftPalm.getWorldPosition(new THREE.Vector3());
    const rightPalmPoint = rightPalm.getWorldPosition(new THREE.Vector3());
    assert.ok(leftPadPoint.x < gripPoint.x && gripPoint.x < rightPadPoint.x);
    assert.ok(leftPalmPoint.y - rightPalmPoint.y >= 0.14);
    assert.ok(leftThumb.getWorldPosition(new THREE.Vector3()).x > leftPadPoint.x);
    assert.ok(rightThumb.getWorldPosition(new THREE.Vector3()).x < rightPadPoint.x);
  });

  it('contacts rather than impales both palms and gives the neutral spear visible weight', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const leftForearm = viewModel.root.getObjectByName('left-forearm');
    const shaft = viewModel.spear.getObjectByName('spear-shaft');
    const leftPad = viewModel.root.getObjectByName('left-palm-pad');
    const rightPad = viewModel.root.getObjectByName('right-palm-pad');
    assert.ok(leftForearm && shaft && leftPad && rightPad);

    setViewModelTool(viewModel, 'spear');
    camera.updateMatrixWorld(true);
    const shaftCenter = shaft.getWorldPosition(new THREE.Vector3());
    const shaftAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    for (const pad of [leftPad, rightPad]) {
      const offset = pad.getWorldPosition(new THREE.Vector3()).sub(shaftCenter);
      const distance = offset.clone().sub(shaftAxis.clone().multiplyScalar(offset.dot(shaftAxis))).length();
      assert.ok(distance >= 0.025 && distance <= 0.045, `${pad.name} contact distance ${distance}`);
    }
    assert.ok(Math.abs(viewModel.spear.rotation.x) + Math.abs(viewModel.spear.rotation.z) >= 0.16);
  });

  it('gives the axe and spear named, readable working ends while preserving grip contracts', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());

    assert.ok(viewModel.axe.getObjectByName('axe-head'));
    assert.ok(viewModel.spear.getObjectByName('spear-head'));
    const spearShaft = viewModel.spear.getObjectByName('spear-shaft');
    const spearHead = viewModel.spear.getObjectByName('spear-head');
    const spearLashing = viewModel.spear.getObjectByName('spear-lashing');
    assert.ok(spearShaft && spearHead && spearLashing);
    viewModel.spear.updateMatrixWorld(true);
    const lashingBounds = new THREE.Box3().setFromObject(spearLashing);
    assert.equal(lashingBounds.intersectsBox(new THREE.Box3().setFromObject(spearShaft)), true);
    assert.equal(lashingBounds.intersectsBox(new THREE.Box3().setFromObject(spearHead)), true);
    assert.ok(spearShaft.scale.y <= 0.85);
    assert.ok(spearLashing.scale.x <= 0.9);
    let spearHeadFaces = 0;
    spearHead.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.inkFill) {
        spearHeadFaces = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      }
    });
    assert.ok(spearHeadFaces >= 16 && spearHeadFaces <= 100, 'working edge needs bounded shaped faces');
    assert.ok(viewModel.axe.getObjectByName('axe-shaft'));
    assert.ok(viewModel.spear.getObjectByName('spear-shaft'));
    assert.ok(viewModel.torch.getObjectByName('torch-flame-outer'));
    assert.ok(viewModel.torch.getObjectByName('torch-flame-core'));
  });

  it('uses shaped stone working edges and actual lashings where the tools meet their shafts', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    for (const tool of ['axe', 'spear'] as const) {
      const head = viewModel[tool].getObjectByName(`${tool}-head`);
      const shaft = viewModel[tool].getObjectByName(`${tool}-shaft`);
      const lashing = viewModel[tool].getObjectByName(`${tool}-lashing`);
      assert.ok(head && shaft && lashing, `${tool} needs a physical head attachment`);
      const fill = head.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
      assert.ok(fill instanceof THREE.Mesh);
      assert.equal(fill.geometry.type, 'BufferGeometry', `${tool} working end is still an unshaped primitive`);
      const headBounds = new THREE.Box3().setFromObject(head);
      const wrapBounds = new THREE.Box3().setFromObject(lashing);
      assert.ok(wrapBounds.intersectsBox(headBounds));
      assert.ok(wrapBounds.intersectsBox(new THREE.Box3().setFromObject(shaft)));
      const wrapFill = lashing.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
      assert.ok(wrapFill instanceof THREE.Mesh);
      assert.notEqual(wrapFill.geometry.type, 'CylinderGeometry', 'lashing must read as wound fibers, not a solid collar');
    }
    const fuel = viewModel.torch.getObjectByName('torch-fuel-wrap');
    assert.ok(fuel, 'torch flame needs a fuel bundle, not a bare stick');
    assert.ok(new THREE.Box3().setFromObject(fuel)
      .intersectsBox(new THREE.Box3().setFromObject(viewModel.torch.getObjectByName('torch-shaft')!)));
  });

  it('seats every shaft-level lashing turn against the actual wood surface', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(8, 4, -2);
    camera.rotation.set(0.13, -0.47, 0.1);
    const viewModel = createViewModel(camera);
    for (const selected of ['axe', 'spear'] as const) {
      setViewModelTool(viewModel, selected);
      camera.updateMatrixWorld(true);
      const tool = viewModel[selected];
      const shaft = tool.getObjectByName(`${selected}-shaft`)!;
      const lashing = tool.getObjectByName(`${selected}-lashing`)!;
      const probeMesh = (part: THREE.Object3D): THREE.Mesh => {
        const fill = part.children.find((object) => object instanceof THREE.Mesh && object.userData.inkFill);
        assert.ok(fill instanceof THREE.Mesh);
        const mesh = new THREE.Mesh(fill.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        mesh.matrixWorld.copy(fill.matrixWorld);
        return mesh;
      };
      const wood = probeMesh(shaft);
      const rope = probeMesh(lashing);
      assert.ok(rope.geometry instanceof THREE.TubeGeometry);
      const scale = tool.getWorldScale(new THREE.Vector3()).x;
      let probes = 0;
      for (let ring = 1; ring < 36; ring += 1) {
        const center: THREE.Vector3 = rope.geometry.parameters.path.getPointAt(ring / 36).applyMatrix4(rope.matrixWorld);
        const localCenter = tool.worldToLocal(center.clone());
        if (localCenter.y >= shaft.position.y + shaft.scale.y / 2 - 0.003) continue;
        const origin = tool.localToWorld(new THREE.Vector3(0, localCenter.y, 0));
        const ray: THREE.Raycaster = new THREE.Raycaster(origin, center.sub(origin).normalize());
        const woodHit: THREE.Intersection | undefined = ray.intersectObject(wood, false)[0];
        const ropeHit: THREE.Intersection | undefined = ray.intersectObject(rope, false)[0];
        assert.ok(woodHit && ropeHit, `${selected} turn ${ring} has no probeable contact`);
        const gap = (ropeHit.distance - woodHit.distance) / scale;
        assert.ok(gap <= 0.001, `${selected} turn ${ring} floats ${gap} units above its shaft`);
        probes += 1;
      }
      assert.ok(probes >= 12, `${selected} needs coverage around multiple full lashing turns`);
      (wood.material as THREE.Material).dispose();
      (rope.material as THREE.Material).dispose();
    }
  });

  it('builds a compact two-layer toon torch flame without white-hot emission', () => {
    const camera = new THREE.PerspectiveCamera();
    const viewModel = createViewModel(camera);
    const outer = viewModel.torch.getObjectByName('torch-flame-outer');
    const core = viewModel.torch.getObjectByName('torch-flame-core');
    const lights: THREE.PointLight[] = [];
    viewModel.torch.traverse((object) => {
      if (object instanceof THREE.PointLight) lights.push(object);
    });

    assert.ok(outer && core);
    const flameBounds = projectedBounds(outer, camera);
    assert.ok(flameBounds.maxY - flameBounds.minY < 0.5);
    for (const flame of [outer, core]) {
      flame.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.userData.inkFill) return;
        const material = object.material;
        assert.ok(material instanceof THREE.MeshBasicMaterial);
        assert.equal(material.toneMapped, false);
        assert.notEqual(material.color.getHex(), 0xffffff);
      });
    }
    assert.equal(lights.length, 1);
    assert.ok(lights[0]!.intensity <= 1.5 && lights[0]!.distance <= 10);
  });

  it('does not submit collapsed faces in the authored stone edges or curved flame', () => {
    const viewModel = createViewModel(new THREE.PerspectiveCamera());
    for (const name of ['axe-head', 'spear-head', 'torch-flame-outer']) {
      const object = viewModel.root.getObjectByName(name);
      const fill = object?.children.find((part) => part instanceof THREE.Mesh && part.userData.inkFill);
      assert.ok(fill instanceof THREE.Mesh);
      const positions = fill.geometry.getAttribute('position');
      const indices = fill.geometry.index;
      for (let offset = 0; offset < (indices?.count ?? positions.count); offset += 3) {
        const corner = (index: number) => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(index) : index);
        const a = corner(offset);
        const area = corner(offset + 1).sub(a).cross(corner(offset + 2).sub(a)).lengthSq();
        assert.ok(area > 1e-18, `${name} has a collapsed face at ${offset / 3}`);
      }
    }
  });

  it('keeps every selected tool inside the right-side safe area and clear of the reticle', () => {
    const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100);
    const viewModel = createViewModel(camera);

    assert.ok(viewModel.root.scale.x <= 0.5);
    assert.ok(viewModel.root.position.y <= -0.44);

    for (const [selected, tool] of [
      ['axe', viewModel.axe],
      ['spear', viewModel.spear],
      ['torch', viewModel.torch],
    ] as const) {
      setViewModelTool(viewModel, selected);
      const bounds = projectedBounds(tool, camera);
      assert.ok(bounds.minX >= 0.08, `${tool.name} crosses the reticle safe area`);
      assert.ok(bounds.maxX <= 0.98, `${tool.name} leaves the right edge`);
      assert.ok(bounds.minY >= -1.08, `${tool.name} leaves the bottom edge`);
      assert.ok(bounds.maxY <= 0.94, `${tool.name} leaves the top edge`);
      if (selected === 'spear') {
        assert.ok(bounds.maxY <= -0.04, 'spear dominates the upper center frame');
        assert.ok(bounds.maxY - bounds.minY <= 0.88, 'spear silhouette is too tall');
      }
    }
  });
});
