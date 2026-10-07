import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  ATTACK_EVENT,
  ATTACK_TIMINGS,
  CREATURE_DEFS,
  createAttackState,
  createCreature,
  createIslandCreatures,
  sampleCreaturePose,
  stepAttack,
  updateCreature,
  type Species,
} from './creatures.ts';
import { heightAt } from './world.ts';

const SPECIES: Species[] = ['parasaur', 'raptor', 'rex'];

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

function frontSurfaceBounds(part: THREE.Object3D): THREE.Box3 {
  const fill = part.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
  assert.ok(fill instanceof THREE.Mesh);
  fill.geometry.computeBoundingBox();
  const local = fill.geometry.boundingBox!;
  const threshold = local.min.z + (local.max.z - local.min.z) * 0.55;
  const positions = fill.geometry.getAttribute('position');
  const result = new THREE.Box3();
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getZ(index) < threshold) continue;
    result.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(fill.matrixWorld));
  }
  return result;
}

function embeddedVertexCount(child: THREE.Mesh, parent: THREE.Mesh): number {
  const points = child.geometry.getAttribute('position');
  const across = new THREE.Vector3(1, 0, 0).transformDirection(parent.matrixWorld);
  let embedded = 0;
  for (let vertex = 0; vertex < points.count; vertex += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(points, vertex).applyMatrix4(child.matrixWorld);
    const fromLeft = new THREE.Raycaster(point.clone().addScaledVector(across, -4), across, 0, 8).intersectObject(parent, false)[0];
    const fromRight = new THREE.Raycaster(point.clone().addScaledVector(across, 4), across.clone().negate(), 0, 8).intersectObject(parent, false)[0];
    if (fromLeft && fromRight && fromLeft.distance < 3.999 && fromRight.distance < 3.999) embedded += 1;
  }
  return embedded;
}

function groundClearance(foot: THREE.Object3D, height: (x: number, z: number) => number): number {
  let clearance = Infinity;
  foot.traverse((part) => {
    if (!(part instanceof THREE.Mesh) || !part.userData.inkFill) return;
    const positions = part.geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(part.matrixWorld);
      clearance = Math.min(clearance, point.y - height(point.x, point.z));
    }
  });
  return clearance;
}

describe('dinosaur ecology', () => {
  it('defines a tameable herbivore, hostile pack hunter, and hostile apex predator', () => {
    assert.equal(CREATURE_DEFS.parasaur.tameable, true);
    assert.equal(CREATURE_DEFS.parasaur.hostile, false);
    assert.equal(CREATURE_DEFS.raptor.role, 'pack-hunter');
    assert.equal(CREATURE_DEFS.raptor.hostile, true);
    assert.equal(CREATURE_DEFS.rex.role, 'apex');
    assert.equal(CREATURE_DEFS.rex.hostile, true);
  });

  it('keeps every species silhouette scale and accent color distinct', () => {
    const definitions = Object.values(CREATURE_DEFS);
    assert.equal(new Set(definitions.map((definition) => definition.scale)).size, definitions.length);
    assert.equal(new Set(definitions.map((definition) => definition.accent)).size, definitions.length);
    assert.ok(CREATURE_DEFS.rex.damage > CREATURE_DEFS.raptor.damage);
  });
});

describe('species anatomy and locomotion', () => {
  it('builds every species with a lower jaw, articulated feet, skin surfaces, and contact shadow', () => {
    for (const species of SPECIES) {
      const creature = createCreature(species, `anatomy-${species}`, new THREE.Vector3());

      assert.equal(creature.root.userData.surface, 'skin');
      assert.ok(creature.jaw.children.length > 0, `${species} needs visible lower-jaw geometry`);
      assert.equal(creature.feet.length, creature.legs.length);
      assert.ok(creature.feet.every((foot) => foot.children.length > 0), `${species} needs visible feet`);
      assert.ok(creature.root.getObjectByName('contact-shadow'), `${species} needs a grounding shadow`);

      creature.feet.forEach((foot, index) => {
        let ancestor: THREE.Object3D | null = foot;
        while (ancestor && ancestor !== creature.legs[index]) ancestor = ancestor.parent;
        assert.equal(ancestor, creature.legs[index], `${species} foot ${index} must belong to its leg chain`);
      });
    }
  });

  it('keeps species proportions distinct without using world scale or material color', () => {
    const signatures = SPECIES.map((species) => {
      const creature = createCreature(species, `bounds-${species}`, new THREE.Vector3());
      creature.root.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(creature.root).getSize(new THREE.Vector3());
      return `${(size.x / size.y).toFixed(2)}:${(size.z / size.y).toFixed(2)}`;
    });

    assert.equal(new Set(signatures).size, SPECIES.length);
  });

  it('uses deliberate rounded or planar geometry for every species jaw silhouette', () => {
    const jaws: Record<Species, readonly string[]> = {
      parasaur: ['parasaur-upper-jaw', 'parasaur-lower-jaw'],
      raptor: ['raptor-narrow-upper-jaw', 'raptor-narrow-lower-jaw'],
      rex: ['rex-heavy-upper-jaw', 'rex-heavy-lower-jaw'],
    };

    for (const species of SPECIES) {
      const creature = createCreature(species, `face-${species}`, new THREE.Vector3());
      for (const name of jaws[species]) {
        const feature = creature.root.getObjectByName(name);
        assert.ok(feature, `${species} is missing ${name}`);
        let triangles = 0;
        feature.traverse((child) => {
          if (!(child instanceof THREE.Mesh) || !child.userData.inkFill) return;
          triangles = Math.max(
            triangles,
            (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3,
          );
        });
        assert.ok(triangles >= 240, `${name} lacks an authored surface at ${triangles} triangles`);
      }
    }
  });

  it('gives the apex a readable cranial hierarchy and planted base', () => {
    const rex = createCreature('rex', 'apex-hierarchy', new THREE.Vector3());
    for (const name of [
      'rex-cranial-plane',
      'rex-heavy-upper-jaw',
      'rex-heavy-lower-jaw',
      'rex-mouth-line',
      'rex-mouth-cavity',
      'rex-lower-jaw-mass',
      'rex-left-front-fang',
      'rex-left-middle-fang',
      'rex-left-rear-fang',
      'rex-right-front-fang',
      'rex-right-middle-fang',
      'rex-right-rear-fang',
      'rex-recessed-brow',
      'left-knee-mass',
      'right-knee-mass',
      'left-shin',
      'right-shin',
    ]) {
      assert.ok(rex.root.getObjectByName(name), `missing ${name}`);
    }

    rex.root.updateMatrixWorld(true);
    const upperBox = frontSurfaceBounds(rex.root.getObjectByName('rex-heavy-upper-jaw')!);
    const lowerBox = frontSurfaceBounds(rex.root.getObjectByName('rex-lower-jaw-mass')!);
    const lowerMassBox = lowerBox;
    const mouthBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-mouth-line')!);
    const cavityBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-mouth-cavity')!);
    const tongueBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-signal-jaw')!);
    const browBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-recessed-brow')!);
    const skullBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-cranial-plane')!);
    const leftEyeBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('left-eye-white')!);
    const rightEyeBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('right-eye-white')!);
    const eyeBoxes = [leftEyeBox, rightEyeBox];
    const toothBoxes = [
      'rex-left-front-fang',
      'rex-left-middle-fang',
      'rex-left-rear-fang',
      'rex-right-front-fang',
      'rex-right-middle-fang',
      'rex-right-rear-fang',
    ].map((name) => new THREE.Box3().setFromObject(rex.root.getObjectByName(name)!));
    const upperSize = upperBox.getSize(new THREE.Vector3());
    const skullSize = skullBox.getSize(new THREE.Vector3());
    const mouthSize = mouthBox.getSize(new THREE.Vector3());
    const upperY = upperBox.getCenter(new THREE.Vector3()).y;
    const lowerY = lowerBox.getCenter(new THREE.Vector3()).y;
    const mouthY = mouthBox.getCenter(new THREE.Vector3()).y;
    assert.ok(upperY > mouthY && mouthY > lowerY, 'mouth line must separate upper and lower jaw masses');
    assert.ok(mouthSize.z >= upperSize.z * 0.65, 'mouth line must survive at encounter distance');
    assert.ok(mouthSize.y >= upperSize.y * 0.45, 'mouth cavity must be visibly open');
    assert.ok(mouthSize.y <= upperSize.y * 0.85, 'mouth cavity must stay controlled');
    assert.ok(cavityBox.max.z - tongueBox.max.z >= 0.4, 'tongue must stay recessed inside the dark mouth');
    assert.ok(cavityBox.max.z - tongueBox.max.z <= 0.9, 'red cavity must remain visible behind the front lip');
    assert.ok(upperBox.min.y - lowerMassBox.max.y >= 0.4, 'apex mouth cavity needs a readable open gap');
    assert.ok(skullSize.z >= skullSize.y * 2.4, 'apex skull must read as a long reptilian head');
    for (const toothBox of toothBoxes) {
      assert.ok(toothBox.min.x >= upperBox.min.x && toothBox.max.x <= upperBox.max.x, 'fang must stay inside the jaw width');
      assert.ok(toothBox.min.y <= cavityBox.max.y && toothBox.max.y >= cavityBox.min.y, 'fang must overlap the mouth cavity');
    }
    const frontFang = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-left-front-fang')!);
    const middleFang = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-left-middle-fang')!);
    assert.ok(frontFang.max.z > middleFang.max.z, 'front fangs must reach the muzzle front');
    assert.ok(frontFang.getSize(new THREE.Vector3()).y >= 0.6, 'front fangs must survive encounter distance');
    for (const eyeBox of eyeBoxes) {
      const eyeSize = eyeBox.getSize(new THREE.Vector3());
      assert.ok(eyeBox.min.y > upperBox.max.y, 'both eyes must sit completely above the upper-jaw silhouette');
      assert.ok(eyeSize.x <= skullSize.x * 0.35, 'apex eyes must not dominate the skull');
    }
    assert.ok(
      browBox.getCenter(new THREE.Vector3()).y > leftEyeBox.getCenter(new THREE.Vector3()).y,
      'angular brow must hood the recessed eye',
    );

    const thigh = rex.root.getObjectByName('left-heavy-thigh')?.children[0];
    const shin = rex.root.getObjectByName('left-shin')?.children[0];
    const shinRig = rex.root.getObjectByName('left-shin');
    const footRig = rex.root.getObjectByName('left-weight-bearing-foot');
    const foot = footRig?.children[0];
    const forearm = rex.root.getObjectByName('rex-left-short-arm');
    const shoulders = rex.root.getObjectByName('rex-shoulders');
    const pelvis = rex.root.getObjectByName('rex-wide-pelvis');
    const contact = rex.root.getObjectByName('contact-shadow');
    assert.ok(thigh && thigh.scale.x >= 0.68, 'apex thigh needs load-bearing mass');
    assert.ok(shin && shin.scale.x >= 0.45, 'apex shin must taper instead of reading as a stilt');
    assert.ok(foot && foot.scale.x >= 0.65, 'apex foot needs a broad planted silhouette');
    assert.ok(shinRig && shinRig.rotation.x >= 0.25, 'apex shin needs a digitigrade bend');
    assert.ok(footRig && Number(footRig.userData.restRotationX) <= -0.25, 'apex foot must counter-rotate into the ground');
    assert.ok(shoulders && pelvis && shoulders.position.y - pelvis.position.y >= 0.5, 'apex chest must rise clearly above the pelvis');
    assert.ok(shoulders && rex.head.getWorldPosition(new THREE.Vector3()).y - shoulders.getWorldPosition(new THREE.Vector3()).y >= 0.25 * rex.definition.scale, 'apex head must rise out of the shoulder wedge');
    assert.ok(forearm && shoulders, 'apex needs connected forearms');
    const armBox = new THREE.Box3().setFromObject(forearm);
    const shoulderBox = new THREE.Box3().setFromObject(rex.root.getObjectByName('rex-continuous-torso')!);
    assert.ok(armBox.intersectsBox(shoulderBox), 'apex short arms must remain connected to the chest');
    assert.ok(armBox.getSize(new THREE.Vector3()).y <= shoulderBox.getSize(new THREE.Vector3()).y * 0.55, 'apex arms must stay tucked and small');
    assert.ok(contact && contact.scale.x >= 3 && contact.position.y >= 0.045, 'apex needs a visible contact anchor');
    for (const name of ['rex-left-foot-shadow', 'rex-right-foot-shadow']) {
      const footShadow = rex.root.getObjectByName(name);
      assert.ok(footShadow && footShadow.position.y >= 0.045, `missing planted anchor ${name}`);
    }
  });

  it('joins apex cheek, skull, and tapered snout into one smooth connected surface', () => {
    const rex = createCreature('rex', 'apex-organic-head', new THREE.Vector3());
    const head = rex.root.getObjectByName('rex-heavy-upper-jaw');
    assert.ok(head);
    const fills = head.children.filter((child) => child instanceof THREE.Mesh && child.userData.inkFill);
    assert.equal(fills.length, 1, 'head must use one continuous filled surface');
    const fill = fills[0];
    assert.ok(fill instanceof THREE.Mesh);
    const geometry = fill.geometry;
    const index = geometry.index;
    assert.ok(index, 'continuous head needs shared indexed vertices');
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const depth = bounds.max.z - bounds.min.z;
    const cheek = new THREE.Box3();
    const nose = new THREE.Box3();
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, vertex);
      if (point.z < bounds.min.z + depth * 0.5) cheek.expandByPoint(point);
      if (point.z > bounds.min.z + depth * 0.85) nose.expandByPoint(point);
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normals, vertex).length() - 1) < 0.001);
    }
    assert.ok(nose.getSize(new THREE.Vector3()).x < cheek.getSize(new THREE.Vector3()).x * 0.7, 'snout must taper out of the broad cheek');
    const adjacency = new Map<number, Set<number>>();
    const edges = new Map<string, number>();
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const a = index.getX(triangle);
      const b = index.getX(triangle + 1);
      const c = index.getX(triangle + 2);
      for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
        if (!adjacency.has(from)) adjacency.set(from, new Set());
        adjacency.get(from)!.add(to);
        const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    const pending = [index.getX(0)];
    const visited = new Set<number>();
    while (pending.length > 0) {
      const vertex = pending.pop()!;
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      pending.push(...adjacency.get(vertex)!);
    }
    assert.equal(visited.size, positions.count, 'cheek and muzzle cannot be disconnected primitive islands');
    assert.ok([...edges.values()].every((uses) => uses === 2), 'head must close without open seams');
    assert.equal(rex.root.getObjectByName('rex-left-cheek-plane'), undefined, 'separate circular cheek disks must be removed');
    assert.equal(rex.root.getObjectByName('rex-right-cheek-plane'), undefined, 'separate circular cheek disks must be removed');
  });

  it('curves the lower jaw upward into its rear hinge instead of a separate tray', () => {
    const rex = createCreature('rex', 'apex-organic-jaw', new THREE.Vector3());
    rex.root.updateMatrixWorld(true);
    const jaw = rex.root.getObjectByName('rex-lower-jaw-mass');
    assert.ok(jaw);
    const whole = new THREE.Box3().setFromObject(jaw);
    const front = frontSurfaceBounds(jaw);
    assert.ok(whole.max.y - front.max.y >= 0.6, 'rear mandible must rise continuously into the cheek hinge');
  });

  for (const species of SPECIES) {
    it(`connects ${species} chest, waist, and pelvis in one continuous surface with a tapered tail`, () => {
      const creature = createCreature(species, `connected-${species}`, new THREE.Vector3());
      const torso = creature.root.getObjectByName(`${species}-continuous-torso`);
      assert.ok(torso, `${species} still uses separate balloon-like trunk masses`);
      for (const part of [torso, creature.tail]) {
        const fills: THREE.Mesh[] = [];
        part.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.inkFill) fills.push(child);
        });
        assert.equal(fills.length, 1, `${part.name} must not overlap separate ellipsoid shells`);
        const geometry = fills[0]!.geometry;
        const indices = geometry.index;
        assert.ok(indices);
        const positions = geometry.getAttribute('position');
        const links = new Map<number, Set<number>>();
        const edges = new Map<string, number>();
        for (let index = 0; index < indices.count; index += 3) {
          const triangle = [indices.getX(index), indices.getX(index + 1), indices.getX(index + 2)];
          for (const [a, b] of [[triangle[0]!, triangle[1]!], [triangle[1]!, triangle[2]!], [triangle[2]!, triangle[0]!]]) {
            if (!links.has(a!)) links.set(a!, new Set());
            links.get(a!)!.add(b!);
            const edge = `${Math.min(a!, b!)}:${Math.max(a!, b!)}`;
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        const pending = [indices.getX(0)];
        const visited = new Set<number>();
        while (pending.length) {
          const vertex = pending.pop()!;
          if (visited.has(vertex)) continue;
          visited.add(vertex);
          pending.push(...links.get(vertex)!);
        }
        assert.equal(visited.size, positions.count, `${part.name} contains disconnected geometry`);
        assert.ok([...edges.values()].every((uses) => uses === 2), `${part.name} has an open seam`);
      }
    });

    it(`connects ${species} thigh, shin, and ankle with overlapping actual skin vertices`, () => {
      const creature = createCreature(species, `limb-contact-${species}`, new THREE.Vector3());
      creature.root.updateMatrixWorld(true);
      creature.legs.forEach((leg, index) => {
        const fills: THREE.Mesh[] = [];
        leg.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.inkFill && child.userData.surface === 'skin') fills.push(child);
        });
        assert.equal(fills.length, 3, `${leg.name} needs a continuous thigh, shin, and ankle-foot chain`);
        const [thigh, shin, foot] = fills;
        assert.ok(thigh && shin && foot);
        assert.ok(embeddedVertexCount(shin, thigh) + embeddedVertexCount(thigh, shin) >= 3, `${leg.name} knee joint is disconnected`);
        assert.ok(embeddedVertexCount(foot, shin) + embeddedVertexCount(shin, foot) >= 3, `${creature.feet[index]!.name} floats away from the shin`);
      });
      if (species === 'rex') {
        const torsoWidth = new THREE.Box3().setFromObject(creature.root.getObjectByName('rex-continuous-torso')!).getSize(new THREE.Vector3()).x;
        for (const foot of creature.feet) {
          const width = new THREE.Box3().setFromObject(foot).getSize(new THREE.Vector3()).x;
          assert.ok(width <= torsoWidth * 0.58, 'apex feet must not read as giant paddles');
        }
      }
    });
  }

  it('keeps species feet compact and ankle-led instead of broad slipper silhouettes', () => {
    const maximumRatios: Record<Species, readonly [width: number, depth: number]> = {
      parasaur: [0.25, 0.22],
      raptor: [0.34, 0.34],
      rex: [0.36, 0.29],
    };

    for (const species of SPECIES) {
      const creature = createCreature(species, `foot-silhouette-${species}`, new THREE.Vector3());
      creature.root.updateMatrixWorld(true);
      const torsoSize = new THREE.Box3()
        .setFromObject(creature.root.getObjectByName(`${species}-continuous-torso`)!)
        .getSize(new THREE.Vector3());
      const [maximumWidth, maximumDepth] = maximumRatios[species];

      for (const foot of creature.feet) {
        const size = new THREE.Box3().setFromObject(foot).getSize(new THREE.Vector3());
        assert.ok(size.x / torsoSize.x <= maximumWidth, `${species} foot is ${((size.x / torsoSize.x) * 100).toFixed(1)}% of torso width`);
        assert.ok(size.z / torsoSize.z <= maximumDepth, `${species} foot is ${((size.z / torsoSize.z) * 100).toFixed(1)}% of torso depth`);
        assert.ok(size.y >= size.z * 0.62, `${species} ankle collapses into a flat slipper`);
      }
    }
  });

  it('embeds the raptor arms in its chest and uses one connected shoulder-to-wrist surface', () => {
    const creature = createCreature('raptor', 'raptor-arm-contact', new THREE.Vector3());
    creature.root.updateMatrixWorld(true);
    const torso = creature.root.getObjectByName('raptor-continuous-torso')!.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
    assert.ok(torso instanceof THREE.Mesh);
    for (const side of ['left', 'right']) {
      const arm = creature.root.getObjectByName(`raptor-${side}-connected-arm`);
      assert.ok(arm);
      const skin = arm.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
      assert.ok(skin instanceof THREE.Mesh);
      assert.ok(embeddedVertexCount(skin, torso) >= 3, `${side} raptor arm floats outside the chest`);
    }
  });

  it('anchors the small apex eyes to the sculpted cranial surface', () => {
    const rex = createCreature('rex', 'apex-eye-contact', new THREE.Vector3());
    rex.root.updateMatrixWorld(true);
    const head = rex.root.getObjectByName('rex-heavy-upper-jaw');
    assert.ok(head);
    const fill = head.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
    assert.ok(fill instanceof THREE.Mesh);
    const outward = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
    for (const name of ['left-eye-white', 'right-eye-white']) {
      const eye = rex.root.getObjectByName(name);
      assert.ok(eye);
      const origin = eye.getWorldPosition(new THREE.Vector3()).addScaledVector(outward, 0.2);
      const ray = new THREE.Raycaster(origin, outward.clone().negate(), 0, 0.28);
      assert.ok(ray.intersectObject(fill, false).length > 0, `${name} floats away from the cranium`);
    }
  });

  it('embeds apex nostrils in the front muzzle instead of floating above it', () => {
    const rex = createCreature('rex', 'apex-nostril-contact', new THREE.Vector3());
    rex.root.updateMatrixWorld(true);
    const upperJaw = rex.root.getObjectByName('rex-heavy-upper-jaw');
    assert.ok(upperJaw);
    const fill = upperJaw.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
    assert.ok(fill instanceof THREE.Mesh);
    const outward = new THREE.Vector3(0, 0, 1).transformDirection(upperJaw.matrixWorld);
    for (const name of ['rex-left-nostril', 'rex-right-nostril']) {
      const nostril = rex.root.getObjectByName(name);
      assert.ok(nostril);
      const origin = nostril.getWorldPosition(new THREE.Vector3()).addScaledVector(outward, 0.2);
      const ray = new THREE.Raycaster(origin, outward.clone().negate(), 0, 0.25);
      assert.ok(ray.intersectObject(fill, false).length > 0, `${name} hovers away from the muzzle surface`);
    }
  });

  for (const side of ['left', 'right']) {
    for (const depth of ['front', 'middle', 'rear']) {
      it(`embeds the ${side} ${depth} fang root cap in the actual head surface`, () => {
        const rex = createCreature('rex', 'apex-fang-contact', new THREE.Vector3());
        rex.root.updateMatrixWorld(true);
        const head = rex.root.getObjectByName('rex-heavy-upper-jaw');
        const headFill = head?.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
        const fangName = `rex-${side}-${depth}-fang`;
        const fang = rex.root.getObjectByName(fangName);
        const fangFill = fang?.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
        assert.ok(head && headFill instanceof THREE.Mesh && fangFill instanceof THREE.Mesh);
        const positions = fangFill.geometry.getAttribute('position');
        fangFill.geometry.computeBoundingBox();
        const capY = fangFill.geometry.boundingBox!.min.y;
        const upward = new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld);
        let capVertices = 0;
        for (let vertex = 0; vertex < positions.count; vertex += 1) {
          if (Math.abs(positions.getY(vertex) - capY) > 0.000001) continue;
          const capPoint = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(fangFill.matrixWorld);
          const below = new THREE.Raycaster(capPoint.clone().addScaledVector(upward, -1), upward, 0, 2);
          const above = new THREE.Raycaster(capPoint.clone().addScaledVector(upward, 1), upward.clone().negate(), 0, 2);
          const underside: THREE.Intersection | undefined = below.intersectObject(headFill, false)[0];
          const topside: THREE.Intersection | undefined = above.intersectObject(headFill, false)[0];
          assert.ok(underside && topside, `${fangName} root extends outside the head surface`);
          assert.ok(underside.distance <= 0.995, `${fangName} root floats ${(underside.distance - 1).toFixed(5)}m below the head`);
          assert.ok(topside.distance <= 0.995, `${fangName} root must stay below the head's top surface`);
          capVertices += 1;
        }
        assert.ok(capVertices >= 3, 'contact must cover the root cap, not only the tooth center');
      });
    }
  }

  it('keeps a recessed red tongue visible through the open jaw', () => {
    const rex = createCreature('rex', 'apex-mouth-visibility', new THREE.Vector3());
    rex.root.updateMatrixWorld(true);
    const surfaces = ['rex-signal-jaw', 'rex-mouth-cavity', 'rex-heavy-upper-jaw', 'rex-lower-jaw-mass'].map((name) => {
      const part = rex.root.getObjectByName(name);
      const fill = part?.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
      assert.ok(fill instanceof THREE.Mesh);
      return fill;
    });
    const tongue = surfaces[0];
    assert.ok(tongue);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(rex.head.matrixWorld);
    const origin = tongue.getWorldPosition(new THREE.Vector3()).addScaledVector(forward, 4);
    const ray = new THREE.Raycaster(origin, forward.clone().negate(), 0, 8);
    assert.ok(ray.intersectObjects(surfaces, false)[0]?.object === tongue, 'mouth geometry hides the red tongue');
  });

  it('builds named shoulder, pelvis, and neck masses within the rounded-surface render budget', () => {
    const landmarks: Record<Species, readonly string[]> = {
      parasaur: ['parasaur-shoulders', 'parasaur-pelvis', 'parasaur-neck'],
      raptor: ['raptor-shoulders', 'raptor-pelvis', 'raptor-neck'],
      rex: ['rex-shoulders', 'rex-wide-pelvis', 'rex-forward-neck'],
    };
    const ceilings: Record<Species, readonly [number, number]> = {
      parasaur: [7_000, 50],
      raptor: [7_000, 50],
      rex: [11_000, 65],
    };
    let islandTriangles = 0;
    let islandMeshes = 0;
    for (const species of SPECIES) {
      const creature = createCreature(species, `massing-${species}`, new THREE.Vector3());
      for (const name of landmarks[species]) {
        assert.ok(creature.root.getObjectByName(name), `${species} is missing ${name}`);
      }
      const [triangles, meshes] = ceilings[species];
      const cost = renderCost(creature.root);
      assert.ok(cost.triangles <= triangles, `${species} uses ${cost.triangles} triangles`);
      assert.ok(cost.meshes <= meshes, `${species} uses ${cost.meshes} meshes`);
      const count = species === 'parasaur' ? 3 : species === 'raptor' ? 4 : 1;
      islandTriangles += cost.triangles * count;
      islandMeshes += cost.meshes * count;
    }
    assert.ok(islandTriangles <= 55_000, `all eight creatures use ${islandTriangles} triangles`);
    assert.ok(islandMeshes <= 410, `all eight creatures use ${islandMeshes} meshes`);
  });

  it('authors the apex as a readable dark-teal, grounded low-poly silhouette', () => {
    const rex = createCreature('rex', 'apex-readability', new THREE.Vector3());
    const bodyColor = CREATURE_DEFS.rex.body;
    const red = (bodyColor >> 16) & 0xff;
    const green = (bodyColor >> 8) & 0xff;
    const blue = bodyColor & 0xff;

    assert.ok(green >= 60 && blue >= 60);
    assert.ok(green > red && blue > red);
    for (const name of ['rex-signal-crest', 'rex-left-signal-eye', 'rex-right-signal-eye', 'rex-signal-jaw']) {
      const accent = rex.root.getObjectByName(name);
      assert.ok(accent, `missing ${name}`);
      const fill = accent.children.find((child) => child instanceof THREE.Mesh && child.userData.inkFill);
      assert.ok(fill instanceof THREE.Mesh);
      assert.ok(fill.material instanceof THREE.MeshToonMaterial);
      assert.equal(fill.material.color.getHex(), CREATURE_DEFS.rex.accent);
      assert.ok(fill.material.emissiveIntensity >= 0.65);
    }
    for (const name of ['rex-left-nostril', 'rex-right-nostril']) {
      assert.ok(rex.root.getObjectByName(name), `missing ${name}`);
    }

    rex.root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(rex.body).getSize(new THREE.Vector3());
    assert.ok(size.z > size.y * 2.3, 'apex silhouette should read horizontally');
    assert.ok(rex.feet.every((foot) => new THREE.Box3().setFromObject(foot).min.y <= 0.03));

    let triangles = 0;
    rex.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      if (child.userData.inkFill) assert.equal(child.material.userData.shared, true);
    });
    assert.ok(triangles <= 11_000, `apex uses ${triangles} triangles`);
  });

  it('keeps hostile main-part colors out of crushed-black daylight values', () => {
    for (const species of ['raptor', 'rex'] as const) {
      const creature = createCreature(species, `daylight-${species}`, new THREE.Vector3());
      const colors = new Set<number>();

      creature.root.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.userData.inkFill || child.userData.surface !== 'skin') return;
        assert.ok(child.material instanceof THREE.MeshToonMaterial);
        const color = child.material.color.getHex();
        if (color !== creature.definition.accent) colors.add(color);
      });

      assert.ok(colors.size >= 4, `${species} needs broad anatomical color separation`);
      for (const color of colors) {
        const red = (color >> 16) & 0xff;
        const green = (color >> 8) & 0xff;
        const blue = color & 0xff;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        assert.ok(luminance >= 72, `${species} uses crushed-black skin #${color.toString(16).padStart(6, '0')}`);
      }
    }
  });

  it('holds a stationary planted pose while idle', () => {
    for (const species of SPECIES) {
      const first = sampleCreaturePose(species, 0, false, 'idle');
      const later = sampleCreaturePose(species, 42, false, 'idle');
      assert.deepEqual(later, first);
      assert.equal(first.bodyLift, 0);
      assert.equal(first.legSwing, 0);
      assert.equal(first.footLift, 0);
    }
  });

  for (const species of SPECIES) {
    for (const slope of [0, 0.18]) {
      it(`plants ${species} on ${slope ? 'sloped' : 'flat'} terrain at delta zero and holds without jumping`, () => {
        const height = (x: number, z: number) => 2 + slope * x - slope * 0.65 * z;
        const creature = createCreature(species, `planted-${species}`, new THREE.Vector3(3, height(3, -5), -5));
        creature.tamed = true;
        creature.command = 'stay';
        creature.root.rotation.y = 0.63;
        let planted: THREE.Vector3[] | undefined;
        for (const [delta, elapsed] of [[0, 0], [1 / 60, 0.5], [0, 10], [1 / 60, 11]]) {
          updateCreature(creature, delta!, elapsed!, new THREE.Vector3(50, 2, 50), height, false);
          creature.root.updateMatrixWorld(true);
          creature.feet.forEach((foot, index) => {
            const gap = groundClearance(foot, height);
            assert.ok(gap >= -0.002 && gap <= 0.025, `${species} foot ${index} has ${gap.toFixed(4)}m terrain clearance`);
            const up = new THREE.Vector3(0, 1, 0).transformDirection(foot.matrixWorld);
            const normal = new THREE.Vector3(-slope, 1, slope * 0.65).normalize();
            assert.ok(up.dot(normal) > 0.999, 'the sole must follow the terrain plane, not balance on its tip');
            if (planted) assert.ok(foot.getWorldPosition(new THREE.Vector3()).distanceTo(planted[index]!) < 0.00001, 'stationary foot drifts or jumps');
          });
          planted = creature.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
        }
      });
    }
  }

  it('keeps real-island feet clear of terrain and connected through a full moving stride', () => {
    const creatures = createIslandCreatures(heightAt);
    const geometries = new Map<THREE.Mesh, THREE.BufferGeometry>();
    const shinLengths = new Map<THREE.Object3D, number>();
    for (const creature of creatures) {
      creature.tamed = true;
      creature.command = 'stay';
      creature.definition = { ...creature.definition, hostile: false };
      creature.root.traverse((part) => {
        if (part instanceof THREE.Mesh) geometries.set(part, part.geometry);
      });
      creature.feet.forEach((foot) => shinLengths.set(foot.parent!.children[0]!, foot.parent!.children[0]!.scale.y));
      updateCreature(creature, 0, 0, new THREE.Vector3(40, 2, 50), heightAt, false);
    }
    for (let frame = 0; frame < 20; frame += 1) {
      for (const creature of creatures) {
        creature.command = frame === 0 ? 'stay' : 'follow';
        updateCreature(creature, frame === 0 ? 0 : 1 / 30, frame / 30, new THREE.Vector3(40, 2, 50), heightAt, false);
        creature.root.updateMatrixWorld(true);
        const clearances = creature.feet.map((foot) => groundClearance(foot, heightAt));
        assert.ok(clearances.every((gap) => Number.isFinite(gap) && gap >= -0.01), `${creature.id} feet penetrate real terrain: ${clearances}`);
        assert.ok(Math.min(...clearances) <= 0.035, `${creature.id} has no planted foot`);
        for (const leg of creature.legs) {
          const fills: THREE.Mesh[] = [];
          leg.traverse((part) => {
            if (part instanceof THREE.Mesh && part.userData.inkFill && part.userData.surface === 'skin') fills.push(part);
          });
          assert.ok(embeddedVertexCount(fills[2]!, fills[1]!) + embeddedVertexCount(fills[1]!, fills[2]!) >= 3, `${creature.id} ankle opens a gap during frame ${frame}`);
          assert.ok(embeddedVertexCount(fills[1]!, fills[0]!) + embeddedVertexCount(fills[0]!, fills[1]!) >= 3, `${creature.id} knee opens a gap during its stride`);
          const shin = fills[1]!.parent!;
          const lengthRatio = shin.scale.y / shinLengths.get(shin)!;
          assert.ok(lengthRatio >= 0.6 - 0.00001 && lengthRatio <= 1.35 + 0.00001, `${creature.id} calf deforms to ${lengthRatio.toFixed(3)}x its authored length`);
          assert.ok(groundClearance(leg, heightAt) >= -0.01, `${creature.id} lower leg penetrates the terrain`);
        }
      }
    }
    for (const [mesh, geometry] of geometries) assert.equal(mesh.geometry, geometry, 'grounding must not allocate new geometry per frame');
  });

  it('locks planted feet in world space and releases them without a pop on the real island', () => {
    const starts: Record<Species, readonly [number, number, number, number]> = {
      parasaur: [-18, 10, 24, 18],
      raptor: [30, 22, 43, 39],
      rex: [25, -30, 41, -7],
    };
    for (const species of SPECIES) {
      const [x, z, targetX, targetZ] = starts[species];
      const creature = createCreature(species, `stance-${species}`, new THREE.Vector3(x, heightAt(x, z), z));
      creature.tamed = true;
      creature.command = 'follow';
      creature.definition = { ...creature.definition, hostile: false };
      const target = new THREE.Vector3(targetX, 2, targetZ);
      updateCreature(creature, 0, 0, target, heightAt, false);
      let previous = creature.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
      let previousGait = creature.gaitDistance;
      let maxPlantedStep = 0;
      let maxTransitionStep = 0;
      let plantedSamples = 0;
      for (let frame = 1; frame <= 180; frame += 1) {
        updateCreature(creature, 1 / 60, frame / 60, target, heightAt, false);
        creature.root.updateMatrixWorld(true);
        const stride = sampleCreaturePose(species, creature.gaitDistance, true, 'idle').strideLength;
        creature.feet.forEach((foot, index) => {
          const current = foot.getWorldPosition(new THREE.Vector3());
          const step = Math.hypot(current.x - previous[index]!.x, current.z - previous[index]!.z);
          const diagonal = species === 'parasaur' && index >= 2 ? -1 : 1;
          const side = (index % 2 === 0 ? 1 : -1) * diagonal;
          const before = Math.sin(previousGait / stride * Math.PI * 2) * side;
          const after = Math.sin(creature.gaitDistance / stride * Math.PI * 2) * side;
          if (before < -0.3 && after < -0.3) {
            maxPlantedStep = Math.max(maxPlantedStep, step);
            plantedSamples += 1;
          }
          maxTransitionStep = Math.max(maxTransitionStep, step);
          previous[index]!.copy(current);
        });
        previousGait = creature.gaitDistance;
      }
      assert.ok(plantedSamples > 20, `${species} did not exercise a planted stance`);
      assert.ok(maxPlantedStep <= 0.004, `${species} planted foot slipped ${maxPlantedStep.toFixed(4)}m in one frame`);
      assert.ok(maxTransitionStep <= 0.22, `${species} foot popped ${maxTransitionStep.toFixed(4)}m at a stance transition`);
    }
  });

  it('bounds full 3D swing travel at the longest runtime frame', () => {
    const maximums: Partial<Record<Species, number>> = {};
    for (const species of SPECIES) {
      const creature = createCreature(species, `long-frame-${species}`, new THREE.Vector3(0, heightAt(0, 8), 8));
      creature.tamed = true;
      creature.command = 'follow';
      creature.definition = { ...creature.definition, hostile: false };
      const target = new THREE.Vector3(20, 2, 35);
      updateCreature(creature, 0, 0, target, heightAt, false);
      let previous = creature.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
      let maximum = 0;
      for (let frame = 1; frame <= 60; frame += 1) {
        updateCreature(creature, 0.05, frame * 0.05, target, heightAt, false);
        creature.root.updateMatrixWorld(true);
        creature.feet.forEach((foot, index) => {
          const current = foot.getWorldPosition(new THREE.Vector3());
          maximum = Math.max(maximum, current.distanceTo(previous[index]!));
          previous[index]!.copy(current);
        });
      }
      maximums[species] = maximum;
    }
    assert.ok(
      SPECIES.every((species) => maximums[species]! <= 0.55),
      `50ms foot travel exceeded 0.55m: ${SPECIES.map((species) => `${species}=${maximums[species]!.toFixed(3)}`).join(', ')}`,
    );
  });

  it('eases from locomotion into attack anticipation without snapping legs or feet', () => {
    for (const species of ['raptor', 'rex'] as const) {
      const creature = createCreature(species, `attack-transition-${species}`, new THREE.Vector3(0, 2, 0));
      const chase = new THREE.Vector3(0, 2, species === 'rex' ? 25 : 18);
      for (let frame = 1; frame <= 30; frame += 1) updateCreature(creature, 1 / 60, frame / 60, chase, () => 2, false);
      creature.root.updateMatrixWorld(true);
      const previousFeet = creature.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
      const previousLegs = creature.legs.map((leg) => leg.rotation.x);
      const distance = creature.definition.attackRange + 0.2;
      const attackTarget = new THREE.Vector3(
        creature.root.position.x + Math.sin(creature.root.rotation.y) * distance,
        2,
        creature.root.position.z + Math.cos(creature.root.rotation.y) * distance,
      );
      const event = updateCreature(creature, 1 / 60, 0.52, attackTarget, () => 2, false);
      creature.root.updateMatrixWorld(true);
      assert.ok((event & ATTACK_EVENT.alert) !== 0, `${species} did not enter anticipation`);
      const legStep = Math.max(...creature.legs.map((leg, index) => Math.abs(leg.rotation.x - previousLegs[index]!)));
      const footStep = Math.max(...creature.feet.map((foot, index) => foot.getWorldPosition(new THREE.Vector3()).distanceTo(previousFeet[index]!)));
      assert.ok(legStep <= 0.12, `${species} leg snapped ${legStep.toFixed(3)}rad into anticipation`);
      assert.ok(footStep <= 0.12, `${species} foot popped ${footStep.toFixed(3)}m into anticipation`);
    }
  });

  it('uses a distinct grounded stride for each species', () => {
    const poses = SPECIES.map((species) => sampleCreaturePose(species, 0.37, true, 'idle'));

    assert.equal(new Set(poses.map((pose) => pose.strideLength)).size, SPECIES.length);
    assert.equal(new Set(poses.map((pose) => pose.legSwing.toFixed(3))).size, SPECIES.length);
    assert.ok(poses.every((pose) => pose.footLift >= 0));
  });

  it('counter-rotates shoulder, pelvis, and neck while compressing planted strides', () => {
    for (const species of SPECIES) {
      const stride = sampleCreaturePose(species, 0, true, 'idle').strideLength;
      const planted = sampleCreaturePose(species, 0, true, 'idle');
      const passing = sampleCreaturePose(species, stride * 0.25, true, 'idle');

      assert.ok(planted.bodyLift < 0, `${species} needs landing compression`);
      assert.ok(passing.bodyLift > planted.bodyLift, `${species} needs weighted rise`);
      assert.ok(passing.shoulderRoll * passing.pelvisRoll < 0, `${species} masses move together`);
      assert.ok(passing.neckYaw * passing.shoulderRoll < 0, `${species} neck does not counterbalance`);
      assert.ok(passing.tailYaw * passing.shoulderRoll < 0, `${species} tail does not counterbalance`);
    }
  });

  it('separates attack anticipation, active bite, and recovery silhouettes', () => {
    const windup = sampleCreaturePose('rex', 0, false, 'windup');
    const active = sampleCreaturePose('rex', 0, false, 'active');
    const recovery = sampleCreaturePose('rex', 0, false, 'recovery');

    assert.ok(windup.headPitch < 0);
    assert.ok(active.headPitch > recovery.headPitch);
    assert.ok(active.jawOpen > windup.jawOpen);
    assert.notEqual(recovery.bodyPitch, windup.bodyPitch);
  });

  it('loads hostile attacks through a braced mass transfer and grounded recovery', () => {
    for (const species of ['raptor', 'rex'] as const) {
      const scale = species === 'rex' ? 1 : 0.75;
      const windup = sampleCreaturePose(species, 0, false, 'windup');
      const active = sampleCreaturePose(species, 0, false, 'active');
      const recovery = sampleCreaturePose(species, 0, false, 'recovery');

      assert.ok(windup.bodyLift <= -0.07 * scale, `${species} windup does not compress its mass`);
      assert.ok(Math.abs(windup.legSwing) >= 0.12 * scale, `${species} windup has no braced step`);
      assert.ok(windup.shoulderRoll * windup.pelvisRoll < 0, `${species} windup masses do not counter-brace`);
      assert.ok(active.shoulderDrive - active.pelvisDrive >= 0.22 * scale, `${species} active pose has no pelvis-to-shoulder drive`);
      assert.ok(active.legSwing * windup.legSwing < 0, `${species} active pose does not drive through its brace`);
      assert.ok(recovery.bodyLift < 0 && recovery.bodyLift > windup.bodyLift, `${species} recovery does not settle out of compression`);
      assert.ok(
        Math.abs(recovery.shoulderDrive - recovery.pelvisDrive)
          < Math.abs(active.shoulderDrive - active.pelvisDrive),
        `${species} recovery keeps the active mass extension`,
      );

      const creature = createCreature(species, `attack-weight-${species}`, new THREE.Vector3(0, 2, 0));
      const shoulders = creature.root.getObjectByName(`${species}-shoulders`)!;
      const pelvis = creature.root.getObjectByName(species === 'rex' ? 'rex-wide-pelvis' : `${species}-pelvis`)!;
      const shoulderRestZ = shoulders.position.z;
      const pelvisRestZ = pelvis.position.z;
      const target = new THREE.Vector3(0, 2, creature.definition.attackRange);
      updateCreature(creature, 0, 0, target, () => 2, false);
      const planted = creature.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));

      creature.attack = { phase: 'active', remaining: 1, hitPending: false };
      updateCreature(creature, 0, 0, target, () => 2, false);
      creature.root.updateMatrixWorld(true);
      assert.ok(shoulders.position.z > shoulderRestZ, `${species} shoulders do not drive forward`);
      assert.ok(pelvis.position.z < pelvisRestZ, `${species} pelvis does not brace behind the bite`);
      creature.feet.forEach((foot, index) => {
        assert.ok(foot.getWorldPosition(new THREE.Vector3()).distanceTo(planted[index]!) <= 0.04, `${species} foot ${index} breaks contact during mass transfer`);
        const gap = groundClearance(foot, () => 2);
        assert.ok(gap >= -0.002 && gap <= 0.025, `${species} active foot ${index} has ${gap.toFixed(4)}m terrain clearance`);
      });

      creature.attack = { phase: 'recovery', remaining: 1, hitPending: false };
      updateCreature(creature, 0, 0, target, () => 2, false);
      assert.ok(Math.abs(shoulders.position.z - shoulderRestZ) < active.shoulderDrive, `${species} shoulders do not settle in recovery`);
      assert.ok(Math.abs(pelvis.position.z - pelvisRestZ) < Math.abs(active.pelvisDrive), `${species} pelvis does not settle in recovery`);
    }
  });
});

describe('readable dinosaur attacks', () => {
  it('keeps each hostile authored silhouette outside the camera at its attack separation', () => {
    for (const species of ['raptor', 'rex'] as const) {
      const creature = createCreature(species, `camera-clearance-${species}`, new THREE.Vector3());
      creature.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(creature.root);
      const forwardReach = bounds.max.z - creature.root.position.z;
      const clearance = creature.definition.attackRange - forwardReach;
      assert.ok(clearance >= 1.45, `${species} leaves only ${clearance.toFixed(3)}m ahead of its authored silhouette`);
    }
  });

  it('stops hostile lunges at a first-person-safe distance without losing the hit window', () => {
    const player = new THREE.Vector3(0, 2, 0);
    for (const species of ['raptor', 'rex'] as const) {
      const separation = CREATURE_DEFS[species].attackRange;
      const creature = createCreature(species, `personal-space-${species}`, new THREE.Vector3(0, 2, separation + 0.4));
      let minimum = Infinity;
      let hitWindows = 0;
      for (let frame = 0; frame < 120; frame += 1) {
        const event = updateCreature(creature, 1 / 60, frame / 60, player, () => 2, false);
        if ((event & ATTACK_EVENT.hitWindow) !== 0) {
          hitWindows += 1;
          creature.attack.hitPending = false;
        }
        if (creature.attack.phase === 'active') minimum = Math.min(minimum, creature.root.position.distanceTo(player));
        if (hitWindows > 0 && creature.attack.phase === 'recovery') break;
      }
      assert.equal(hitWindows, 1, `${species} must retain one bite hit window`);
      assert.ok(minimum >= separation - 0.00001, `${species} lunge entered player space at ${minimum.toFixed(3)}m`);
    }
  });

  it('keeps one pending hit while an active lunge closes on a moving target', () => {
    const player = new THREE.Vector3(0, 2, 0);
    for (const species of ['raptor', 'rex'] as const) {
      const creature = createCreature(species, `moving-target-${species}`, new THREE.Vector3(0, 2, CREATURE_DEFS[species].attackRange + 0.2));
      updateCreature(creature, 0, 0, player, () => 2, false);
      updateCreature(creature, ATTACK_TIMINGS[species].alert, ATTACK_TIMINGS[species].alert, player, () => 2, false);
      player.z = -0.6;
      let hits = 0;
      for (let frame = 1; frame <= 180; frame += 1) {
        const event = updateCreature(creature, 1 / 60, frame / 60, player, () => 2, false);
        if ((event & ATTACK_EVENT.hitWindow) !== 0) {
          hits += 1;
          creature.attack.hitPending = false;
        }
        if (creature.attack.phase === 'recovery') break;
      }
      assert.equal(hits, 1, `${species} lost its hit while closing the active lunge`);
      player.z = 0;
    }
  });

  it('signals before opening exactly one raptor hit window', () => {
    const attack = createAttackState();

    assert.equal(stepAttack(attack, 0, true, 'raptor'), ATTACK_EVENT.alert);
    assert.equal(attack.phase, 'alert');
    assert.equal(stepAttack(attack, ATTACK_TIMINGS.raptor.alert - 0.01, true, 'raptor'), ATTACK_EVENT.none);
    assert.equal(stepAttack(attack, 0.02, true, 'raptor'), ATTACK_EVENT.windup);
    assert.equal(attack.phase, 'windup');
    assert.equal(stepAttack(attack, ATTACK_TIMINGS.raptor.windup, true, 'raptor'), ATTACK_EVENT.hitWindow);
    assert.equal(stepAttack(attack, ATTACK_TIMINGS.raptor.active * 0.5, true, 'raptor'), ATTACK_EVENT.none);
  });

  it('recovers before another attack and gives the apex a longer tell', () => {
    const attack = createAttackState();
    stepAttack(attack, 0, true, 'raptor');
    stepAttack(attack, ATTACK_TIMINGS.raptor.alert, true, 'raptor');
    stepAttack(attack, ATTACK_TIMINGS.raptor.windup, true, 'raptor');
    stepAttack(attack, ATTACK_TIMINGS.raptor.active, true, 'raptor');
    assert.equal(attack.phase, 'recovery');
    assert.equal(stepAttack(attack, ATTACK_TIMINGS.raptor.recovery, false, 'raptor'), ATTACK_EVENT.recovered);
    assert.equal(attack.phase, 'idle');
    assert.ok(
      ATTACK_TIMINGS.rex.alert + ATTACK_TIMINGS.rex.windup
        > ATTACK_TIMINGS.raptor.alert + ATTACK_TIMINGS.raptor.windup,
    );
  });
});
