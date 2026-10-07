import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  ChunkEffects,
  EFFECT_KINDS,
  MAX_PARTICLES,
  recipe,
  sampleEffectParticle,
} from './effects.ts';

describe('cartoon effect recipes', () => {
  it('keeps every recipe finite, positive, and ordered', () => {
    for (const kind of EFFECT_KINDS) {
      const effect = recipe(kind);
      const numbers = [
        effect.count,
        ...effect.life,
        ...effect.size,
        effect.gravity,
        ...effect.verticalForce,
        ...effect.horizontalForce,
      ];

      assert.ok(numbers.every(Number.isFinite), `${kind} must contain only finite values`);
      assert.ok(numbers.every((value) => value >= 0), `${kind} must not contain negative values`);
      assert.ok(effect.count > 0 && effect.count <= MAX_PARTICLES);
      assert.ok(effect.life[0] <= effect.life[1]);
      assert.ok(effect.size[0] <= effect.size[1]);
      assert.ok(effect.verticalForce[0] <= effect.verticalForce[1]);
      assert.ok(effect.horizontalForce[0] <= effect.horizontalForce[1]);
      assert.ok(effect.shape === 'puff' || effect.shape === 'shard');
    }
  });

  it('makes heavy hits larger, longer, denser, and stronger than light hits', () => {
    const light = recipe('lightHit');
    const heavy = recipe('heavyHit');

    assert.ok(heavy.count > light.count);
    assert.ok(heavy.life[1] > light.life[1]);
    assert.ok(heavy.size[1] > light.size[1]);
    assert.ok(heavy.verticalForce[1] > light.verticalForce[1]);
    assert.ok(heavy.horizontalForce[1] > light.horizontalForce[1]);
  });

  it('keeps footstep dust low and lateral', () => {
    const dust = recipe('stepDust');

    assert.equal(dust.shape, 'puff');
    assert.ok(dust.count >= 5, 'comic dust needs enough overlapping lobes to read as one chunky trail');
    assert.ok(dust.verticalForce[1] < dust.horizontalForce[1] * 0.55);
    assert.ok(dust.gravity < recipe('lightHit').gravity);
  });

  it('samples deterministic particles inside the requested impact direction', () => {
    const direction = { x: 1, z: 0 };
    const first = Array.from({ length: 12 }, (_, index) => (
      sampleEffectParticle('heavyHit', index, 0x5eed, direction)
    ));
    const repeated = Array.from({ length: 12 }, (_, index) => (
      sampleEffectParticle('heavyHit', index, 0x5eed, direction)
    ));
    const alternate = Array.from({ length: 12 }, (_, index) => (
      sampleEffectParticle('heavyHit', index, 0xbeef, direction)
    ));

    assert.deepEqual(repeated, first);
    assert.notDeepEqual(alternate, first);
    assert.ok(first.every((sample) => sample.velocityX * direction.x + sample.velocityZ * direction.z > 0));
    assert.ok(first.flatMap(Object.values).every(Number.isFinite));
  });
});

describe('cartoon effect pool', () => {
  it('never multiplies instance tints by an absent vertex-color attribute', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    effects.play('lightHit', new THREE.Vector3(), 0xe8a83e, { seed: 42 });
    effects.play('tame', new THREE.Vector3(), 0x65e08a, { seed: 42 });

    for (const mesh of scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)) {
      const material = mesh.material as THREE.MeshBasicMaterial | THREE.MeshToonMaterial;
      assert.ok(mesh.instanceColor, `${mesh.name} must supply its instance tint`);
      assert.ok(!material.vertexColors || mesh.geometry.hasAttribute('color'),
        `${mesh.name} enables a missing color attribute, which multiplies valid instance tints to black`);
      assert.equal(material.color.getHex(), 0xffffff, 'the shared material must not tint all instances');
    }
  });

  it('shares at most two instanced meshes across a hard 260-instance cap', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    const meshes = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);

    assert.equal(MAX_PARTICLES, 260);
    assert.ok(meshes.length <= 2);
    assert.equal(meshes.reduce((total, mesh) => total + mesh.count, 0), MAX_PARTICLES);

    effects.burst(new THREE.Vector3(), 0xff0000, 10_000, Number.POSITIVE_INFINITY);
    effects.trail(new THREE.Vector3(), 'jungle', false);
    assert.equal(meshes.reduce((total, mesh) => total + mesh.count, 0), MAX_PARTICLES);
  });

  it('uses authored low-poly silhouettes instead of stock sphere and tetrahedron particles', () => {
    const scene = new THREE.Scene();
    new ChunkEffects(scene);
    const meshes = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    const puffs = meshes.find((mesh) => mesh.name.includes('puffs'));
    const shards = meshes.find((mesh) => mesh.name.includes('shards'));
    assert.ok(puffs && shards);
    assert.equal(puffs.geometry.type, 'BufferGeometry');
    assert.equal(shards.geometry.type, 'BufferGeometry');
    const triangleCount = (geometry: THREE.BufferGeometry) => (
      geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3
    );
    assert.ok(triangleCount(puffs.geometry) <= 32, 'chunky puffs need a cheap authored cluster silhouette');
    assert.ok(triangleCount(shards.geometry) >= 8, 'impact leaves need more articulation than a tetrahedron slab');
    for (const geometry of [puffs.geometry, shards.geometry]) {
      const position = geometry.getAttribute('position');
      for (let index = 0; index < position.count; index += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(position, index);
        const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
        const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
        assert.ok(new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).lengthSq() > 1e-10,
          `${geometry.name} must not contain collapsed faces`);
      }
    }
  });

  it('does not turn generic miss or build bursts into hit-confirmation cores', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    effects.burst(new THREE.Vector3(), 0xe9e2cf, 3, 0.25, { seed: 42 });
    const mesh = scene.children.find((child): child is THREE.InstancedMesh => (
      child instanceof THREE.InstancedMesh && child.name.includes('puffs')
    ));
    assert.ok(mesh);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    assert.equal(matrix.getMaxScaleOnAxis(), 0, 'only explicit hit effects have a contact-confirmation core');
  });

  it('reuses the same geometry and instance buffers through mixed effects and expiry', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    const meshes = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    const resources = meshes.map((mesh) => [mesh.geometry, mesh.instanceMatrix, mesh.instanceColor]);
    for (let index = 0; index < 160; index += 1) {
      effects.play(EFFECT_KINDS[index % EFFECT_KINDS.length]!, new THREE.Vector3(), 0xe8a83e, { seed: index });
      effects.update(1 / 60);
    }
    effects.update(2);
    const matrix = new THREE.Matrix4();
    meshes.forEach((mesh, index) => {
      assert.equal(mesh.geometry, resources[index]![0]);
      assert.equal(mesh.instanceMatrix, resources[index]![1]);
      assert.equal(mesh.instanceColor, resources[index]![2]);
      for (let slot = 0; slot < mesh.count; slot += 1) {
        mesh.getMatrixAt(slot, matrix);
        assert.equal(matrix.getMaxScaleOnAxis(), 0, 'expired slots must be hidden');
      }
    });
    assert.equal(scene.children.length, 2);
  });

  it('routes impact centers and recipe debris through the same two fixed pools', () => {
    for (const kind of EFFECT_KINDS) {
      const scene = new THREE.Scene();
      const effects = new ChunkEffects(scene);
      effects.play(kind, new THREE.Vector3(1, 2, 3), 0x65e08a);

      for (const shape of ['puff', 'shard'] as const) {
        const mesh = scene.children.find((child): child is THREE.InstancedMesh => (
          child instanceof THREE.InstancedMesh && child.name.toLowerCase().includes(shape)
        ));
        assert.ok(mesh, `${shape} pool must exist`);
        const matrix = new THREE.Matrix4();
        let visible = 0;
        for (let index = 0; index < mesh.count; index += 1) {
          mesh.getMatrixAt(index, matrix);
          if (matrix.getMaxScaleOnAxis() > 0) visible += 1;
        }
        const hasImpactCore = kind === 'lightHit' || kind === 'heavyHit';
        const expected = kind === 'tame'
          ? shape === 'puff' ? 8 : 4
          : hasImpactCore
          ? shape === 'puff' ? 1 : recipe(kind).count - 1
          : recipe(kind).shape === shape ? recipe(kind).count : 0;
        assert.equal(visible, expected);
      }
    }
  });

  it('keeps a bright impact core anchored to contact while debris travels, with a larger heavy core', () => {
    const contact = new THREE.Vector3(3, 1.4, -2);
    const coreSizes: number[] = [];
    for (const kind of ['lightHit', 'heavyHit'] as const) {
      const scene = new THREE.Scene();
      const effects = new ChunkEffects(scene);
      effects.play(kind, contact, 0xe8a83e, { seed: 42, direction: { x: 0.5, z: -1 } });
      effects.update(0.18);
      const puffs = scene.children.find((child): child is THREE.InstancedMesh => (
        child instanceof THREE.InstancedMesh && child.name.includes('puffs')
      ));
      assert.ok(puffs);
      const matrix = new THREE.Matrix4();
      puffs.getMatrixAt(0, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(position.distanceTo(contact) < 1e-5, `${kind} must mark the actual contact, not a displaced spray`);
      puffs.geometry.computeBoundingSphere();
      assert.ok(puffs.geometry.boundingSphere);
      const coreDiameter = puffs.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis() * 2;
      assert.ok(coreDiameter > 0.13, `${kind} must retain a readable center at 180ms`);
      coreSizes.push(coreDiameter);
      const color = new THREE.Color();
      puffs.getColorAt(0, color);
      assert.ok(color.r > 0.7 && color.g > 0.6 && color.b > 0.4, 'contact core must be a light accent');
      const shards = scene.children.find((child): child is THREE.InstancedMesh => (
        child instanceof THREE.InstancedMesh && child.name.includes('shards')
      ));
      assert.ok(shards);
      shards.getMatrixAt(kind === 'heavyHit' ? 5 : 3, matrix);
      assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(contact) > 0.1);
    }
    assert.ok(coreSizes[1]! > coreSizes[0]! * 1.5, 'heavy impact needs a distinct center hierarchy');
  });

  it('keeps every impact piece inside a first-person-safe world-size envelope', () => {
    const contact = new THREE.Vector3(3, 1.4, -2);
    const maximumDiameter = 0.3;
    const coreDiameters: number[] = [];
    for (const kind of ['lightHit', 'heavyHit'] as const) {
      const scene = new THREE.Scene();
      const effects = new ChunkEffects(scene);
      effects.play(kind, contact, 0xff5b3d, {
        seed: 42,
        direction: { x: 0.5, z: -1 },
        impactScale: 0.35,
      });
      const meshes = scene.children.filter((child): child is THREE.InstancedMesh => (
        child instanceof THREE.InstancedMesh
      ));
      const matrix = new THREE.Matrix4();
      for (const mesh of meshes) {
        mesh.geometry.computeBoundingSphere();
        assert.ok(mesh.geometry.boundingSphere);
        for (let index = 0; index < mesh.count; index += 1) {
          mesh.getMatrixAt(index, matrix);
          const diameter: number = mesh.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis() * 2;
          assert.ok(diameter <= maximumDiameter + 1e-6,
            `${kind} ${mesh.name} slot ${index} is ${diameter.toFixed(3)}m wide`);
        }
      }
      const core = meshes.find((mesh) => mesh.name.includes('puffs'));
      assert.ok(core?.geometry.boundingSphere);
      core.getMatrixAt(0, matrix);
      assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(contact) < 1e-5);
      const coreDiameter = core.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis() * 2;
      assert.ok(coreDiameter >= 0.13, `${kind} core must remain readable at interaction range`);
      coreDiameters.push(coreDiameter);
    }
    assert.ok(coreDiameters[1]! > coreDiameters[0]! * 1.5,
      'heavy contact must remain clearly larger than light contact');
  });

  it('keeps distant contact readable while camera-close damage stays compact', () => {
    const coreDiameter = (impactScale?: number): number => {
      const scene = new THREE.Scene();
      const effects = new ChunkEffects(scene);
      const options = impactScale === undefined ? { seed: 42 } : { seed: 42, impactScale };
      effects.play('lightHit', new THREE.Vector3(), 0xff5b3d, options);
      const core = scene.children.find((child): child is THREE.InstancedMesh => (
        child instanceof THREE.InstancedMesh && child.name.includes('puffs')
      ));
      assert.ok(core);
      core.geometry.computeBoundingSphere();
      assert.ok(core.geometry.boundingSphere);
      const matrix = new THREE.Matrix4();
      core.getMatrixAt(0, matrix);
      return core.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis() * 2;
    };

    const worldContact = coreDiameter();
    const cameraCloseDamage = coreDiameter(0.35);
    assert.ok(worldContact >= cameraCloseDamage * 1.55,
      `world contact ${worldContact.toFixed(3)}m is not more readable than camera-close damage ${cameraCloseDamage.toFixed(3)}m`);
    assert.ok(worldContact <= 0.3, 'world contact core becomes a screen-blocking disc');
  });

  it('does not shrink the non-combat tame celebration', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    effects.play('tame', new THREE.Vector3(), 0x65e08a, { seed: 42 });
    const puffs = scene.children.find((child): child is THREE.InstancedMesh => (
      child instanceof THREE.InstancedMesh && child.name.includes('puffs')
    ));
    assert.ok(puffs);
    const matrix = new THREE.Matrix4();
    puffs.getMatrixAt(1, matrix);
    assert.ok(matrix.getMaxScaleOnAxis() >= 0.2, 'tame celebration was scaled like a combat impact');
  });

  it('builds a layered directional hit glyph without black slab debris', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    const contact = new THREE.Vector3(1, 1.2, -3);
    effects.play('heavyHit', contact, 0xe8a83e, { seed: 42, direction: { x: 1, z: 0 } });
    effects.update(0.08);
    const shards = scene.children.find((child): child is THREE.InstancedMesh => (
      child instanceof THREE.InstancedMesh && child.name.includes('shards')
    ));
    assert.ok(shards);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    let contactRays = 0;
    for (let index = 0; index < recipe('heavyHit').count - 1; index += 1) {
      shards.getMatrixAt(index, matrix);
      matrix.decompose(position, new THREE.Quaternion(), scale);
      if (position.distanceTo(contact) < 0.34 && Math.max(scale.x, scale.y, scale.z) > Math.min(scale.x, scale.y, scale.z) * 3) {
        contactRays += 1;
      }
      shards.getColorAt(index, color);
      assert.ok(Math.max(color.r, color.g, color.b) > 0.28, 'impact palette must not contain black slabs');
    }
    assert.ok(contactRays >= 4, 'the contact needs a readable inner star before the outer debris');
  });

  it('keeps tame accents compact, rising, green/light, and legible without scene lights', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    const origin = new THREE.Vector3(0, 1, 0);
    effects.play('tame', origin, 0x65e08a, { seed: 42, direction: { x: 0.5, z: -1 } });
    effects.update(0.18);
    const meshes = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    assert.equal(meshes.length, 2);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const hues = new Set<number>();
    let visible = 0;
    for (const mesh of meshes) {
      assert.ok(mesh.material instanceof THREE.MeshBasicMaterial, 'flat illustrated accents must not disappear at night');
      assert.equal(mesh.material.toneMapped, false);
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        if (matrix.getMaxScaleOnAxis() === 0) continue;
        const position = new THREE.Vector3().setFromMatrixPosition(matrix);
        assert.ok(Math.hypot(position.x, position.z) > 0.38 && Math.hypot(position.x, position.z) < 0.9,
          'the friendly crown must stay separated but compact');
        assert.ok(position.y > origin.y, 'the positive cue must rise');
        mesh.getColorAt(index, color);
        assert.ok(color.g > color.r && color.g > color.b, 'tame palette must stay recognizably green');
        hues.add(color.getHex());
        visible += 1;
      }
    }
    assert.equal(visible, recipe('tame').count);
    assert.ok(hues.size >= 3, 'separate green and light accents must survive instancing');
  });

  it('forms the tame cue from a soft lobe crown punctuated by four leaf accents', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    const origin = new THREE.Vector3(0, 1, 0);
    effects.play('tame', origin, 0x65e08a, { seed: 42 });
    effects.update(0.18);
    const puffs = scene.children.find((child): child is THREE.InstancedMesh => (
      child instanceof THREE.InstancedMesh && child.name.includes('puffs')
    ));
    const shards = scene.children.find((child): child is THREE.InstancedMesh => (
      child instanceof THREE.InstancedMesh && child.name.includes('shards')
    ));
    assert.ok(puffs && shards);
    const matrix = new THREE.Matrix4();
    let puffCount = 0;
    let shardCount = 0;
    for (let index = 0; index < puffs.count; index += 1) {
      puffs.getMatrixAt(index, matrix);
      if (matrix.getMaxScaleOnAxis() > 0) puffCount += 1;
      shards.getMatrixAt(index, matrix);
      if (matrix.getMaxScaleOnAxis() > 0) shardCount += 1;
    }
    assert.equal(puffCount, 8, 'soft celebratory lobes carry the friendly read');
    assert.equal(shardCount, 4, 'four leaf accents preserve the tame identity without becoming grass');
  });

  it('keeps dust low without sinking and differentiates foliage and water trails within the fixed pools', () => {
    for (const [biome, inWater] of [['coast', false], ['jungle', false], ['coast', true]] as const) {
      const scene = new THREE.Scene();
      const effects = new ChunkEffects(scene);
      effects.trail(new THREE.Vector3(0, 0.08, 0), biome, inWater, { seed: 42 });
      effects.update(0.18);
      const shape = biome === 'jungle' && !inWater ? 'shards' : 'puffs';
      const mesh = scene.children.find((child): child is THREE.InstancedMesh => (
        child instanceof THREE.InstancedMesh && child.name.includes(shape)
      ));
      assert.ok(mesh);
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(0, matrix);
      assert.ok(matrix.getMaxScaleOnAxis() > 0, `${shape} must carry this trail`);
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      matrix.decompose(position, new THREE.Quaternion(), scale);
      assert.ok(position.y >= 0.08 - 1e-6, 'trail must not sink below its contact center');
      if (inWater) assert.ok(scale.y > scale.x * 2, 'water needs upright splash droplets');
      else if (biome === 'coast') {
        assert.ok(scale.y < scale.x * 0.7, 'dust needs a low trail silhouette');
        assert.ok(scale.y > scale.x * 0.5, 'dust puffs must stay chunky instead of collapsing into slash marks');
        effects.update(0.08);
        mesh.getMatrixAt(0, matrix);
        assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).y >= 0.08 - 1e-6);
      }
    }
  });

  it('ignores public effects with a non-finite position', () => {
    const scene = new THREE.Scene();
    const effects = new ChunkEffects(scene);
    effects.play('heavyHit', new THREE.Vector3(Number.NaN, 2, 3), 0xff0000);

    const matrix = new THREE.Matrix4();
    for (const mesh of scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)) {
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        assert.equal(matrix.getMaxScaleOnAxis(), 0);
      }
    }
  });
});
