import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { BIOME_COLORS, PALETTE } from './palette.ts';
import {
  SEA_LEVEL,
  WORLD_SEED,
  WORLD_SIZE,
  biomeAt,
  createStructureVisual,
  createWorld,
  generateDetailSpawns,
  generateGroundDabSpawns,
  generateResourceSpawns,
  heightAt,
  insideApexSetpieceClearance,
  shoreRadiusAt,
} from './world.ts';

describe('procedural island', () => {
  it('is deterministic, elevated at the center, and underwater at the edge', () => {
    assert.equal(heightAt(17, -9, WORLD_SEED), heightAt(17, -9, WORLD_SEED));
    assert.ok(heightAt(0, 0, WORLD_SEED) > 3);
    assert.ok(heightAt(WORLD_SIZE / 2, 0, WORLD_SEED) < 0);
  });

  it('contains all four requested biomes', () => {
    const biomes = new Set<string>();
    for (let x = -60; x <= 60; x += 10) {
      for (let z = -60; z <= 60; z += 10) biomes.add(biomeAt(x, z, WORLD_SEED));
    }
    assert.deepEqual([...biomes].sort(), ['coast', 'highlands', 'jungle', 'plains']);
  });

  it('places a bounded, repeatable resource population on dry ground', () => {
    const first = generateResourceSpawns(WORLD_SEED);
    const second = generateResourceSpawns(WORLD_SEED);
    assert.deepEqual(first, second);
    assert.ok(first.length >= 32 && first.length <= 60);
    assert.ok(first.every((spawn) => heightAt(spawn.x, spawn.z, WORLD_SEED) > 0.7));
    assert.ok(first.every((spawn) => !insideApexSetpieceClearance(spawn.x, spawn.z)));
    assert.deepEqual(
      [...new Set(first.map((spawn) => spawn.kind))].sort(),
      ['berries', 'fiber', 'stone', 'wood'],
    );
  });

  it('fills every biome with deterministic bounded ecological detail', () => {
    const first = generateDetailSpawns(WORLD_SEED);
    const second = generateDetailSpawns(WORLD_SEED);

    assert.deepEqual(first, second);
    assert.ok(first.length >= 900 && first.length <= 1_300);
    assert.ok(first.every((spawn) => heightAt(spawn.x, spawn.z, WORLD_SEED) > 0.35));
    assert.ok(first.every((spawn) => Math.hypot(spawn.x, spawn.z) > 6));
    assert.deepEqual(
      [...new Set(first.map((spawn) => spawn.kind))].sort(),
      ['brush', 'grass', 'log', 'mushroom', 'rock'],
    );
    assert.deepEqual(
      [...new Set(first.map((spawn) => biomeAt(spawn.x, spawn.z, WORLD_SEED)))].sort(),
      ['coast', 'highlands', 'jungle', 'plains'],
    );
    assert.notDeepEqual(generateDetailSpawns(WORLD_SEED + 1), first);
  });

  it('clusters ground cover while preserving a clean apex approach', () => {
    const spawns = generateDetailSpawns(WORLD_SEED);
    const clustered = spawns.filter((spawn, index) => spawns.some((neighbor, neighborIndex) => (
      index !== neighborIndex
      && spawn.kind === neighbor.kind
      && Math.hypot(spawn.x - neighbor.x, spawn.z - neighbor.z) < 4.5
    )));

    assert.ok(clustered.length / spawns.length >= 0.55);
    assert.ok(spawns.every((spawn) => !insideApexSetpieceClearance(spawn.x, spawn.z)));
  });

  it('finds a bounded shoreline contour for illustrated foam', () => {
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      const radius = shoreRadiusAt(angle, WORLD_SEED);
      const height = heightAt(Math.sin(angle) * radius, Math.cos(angle) * radius, WORLD_SEED);
      assert.ok(radius > 38 && radius < WORLD_SIZE * 0.55);
      assert.ok(Math.abs(height - 0.08) < 0.12);
    }
  });

  it('extends one deterministic indexed ocean well beyond every playable viewpoint fog boundary', () => {
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    const sea = world.root.getObjectByName('Flat illustrated sea');
    const same = createWorld(new THREE.Scene()).root.getObjectByName('Flat illustrated sea') as THREE.Mesh;
    const changed = createWorld(new THREE.Scene(), WORLD_SEED + 1).root.getObjectByName('Flat illustrated sea') as THREE.Mesh;

    assert.ok(sea instanceof THREE.Mesh && !(sea instanceof THREE.InstancedMesh));
    assert.ok(!world.root.getObjectByName('Procedural shoreline foam arcs'), 'shore foam must be integrated into the ocean surface');
    assert.ok(sea.geometry.index);
    const positions = sea.geometry.getAttribute('position');
    const outerRadii: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      const radius = Math.hypot(positions.getX(index), positions.getZ(index));
      if (radius > WORLD_SIZE) outerRadii.push(radius);
    }
    assert.ok(scene.fog instanceof THREE.Fog);
    assert.ok(outerRadii.length >= 256);
    const nearestEdge = Math.min(...outerRadii) - WORLD_SIZE * 0.5;
    assert.ok(nearestEdge > scene.fog.far + 80, `ocean edge is too close to the fog boundary: ${nearestEdge}`);
    assert.ok(sea.geometry.index.count / 3 <= 3_200);
    assert.deepEqual(Array.from(positions.array), Array.from(same.geometry.getAttribute('position').array));
    assert.notDeepEqual(Array.from(positions.array), Array.from(changed.geometry.getAttribute('position').array));
    const before = Array.from(positions.array);
    world.update(120);
    assert.deepEqual(Array.from(positions.array), before, 'shore edge must stay attached while open-water marks move');
    assert.equal(sea.rotation.y, 0);
  });

  it('grounds a narrow irregular foam edge and wet sand directly on the island contour', () => {
    const sea = createWorld(new THREE.Scene()).root.getObjectByName('Flat illustrated sea') as THREE.Mesh;
    const positions = sea.geometry.getAttribute('position');
    const colors = sea.geometry.getAttribute('color');
    const foamWidths = new Set<string>();
    let foamVertices = 0;
    let wetSandVertices = 0;

    assert.ok(colors instanceof THREE.BufferAttribute && colors.itemSize === 4);
    for (let index = 0; index < positions.count; index += 1) {
      const r = colors.getX(index);
      const g = colors.getY(index);
      const b = colors.getZ(index);
      const foam = r > 0.6 && g > 0.6 && b > 0.5;
      const wetSand = r > g * 1.08 && g > b * 1.2;
      if (!foam && !wetSand) continue;
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const y = positions.getY(index) + sea.position.y;
      const shore = shoreRadiusAt(Math.atan2(x, z));
      const offset = Math.hypot(x, z) - shore;
      const ground = heightAt(x, z);
      assert.ok(y >= ground - 0.005);
      assert.ok(Math.abs(y - Math.max(SEA_LEVEL + 0.12, ground + 0.018)) < 0.005);
      if (foam) {
        foamVertices += 1;
        assert.ok(offset >= -0.25 && offset <= 0.35, `detached foam offset: ${offset}`);
        if (offset > 0) foamWidths.add(offset.toFixed(3));
      } else {
        wetSandVertices += 1;
        assert.ok(offset >= -1.65 && offset <= -0.15, `wet sand contour offset: ${offset}`);
      }
    }
    assert.ok(foamVertices >= 512 && wetSandVertices >= 512);
    assert.ok(foamWidths.size >= 20, `irregular foam widths: ${foamWidths.size}`);
  });

  it('uses flat color blocks with translucent turquoise shallows and opaque deeper blue water', () => {
    const sea = createWorld(new THREE.Scene()).root.getObjectByName('Flat illustrated sea') as THREE.Mesh;
    const material = sea.material as THREE.MeshToonMaterial;
    const positions = sea.geometry.getAttribute('position');
    const colors = sea.geometry.getAttribute('color');
    const indices = sea.geometry.index;
    let shallowVertices = 0;
    let deepVertices = 0;
    const tones = new Set<string>();

    assert.ok(colors instanceof THREE.BufferAttribute && colors.itemSize === 4);
    assert.ok(indices);
    assert.equal(material.vertexColors, true);
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    for (let index = 0; index < colors.count; index += 1) {
      const r = colors.getX(index);
      const g = colors.getY(index);
      const b = colors.getZ(index);
      const alpha = colors.getW(index);
      tones.add(`${r.toFixed(4)}:${g.toFixed(4)}:${b.toFixed(4)}`);
      if (r < 0.2 && g > b && g > r * 2 && alpha < 0.75) shallowVertices += 1;
      if (Math.hypot(positions.getX(index), positions.getZ(index)) > WORLD_SIZE) {
        deepVertices += 1;
        assert.ok(b > g && g > r);
        assert.equal(alpha, 1);
        assert.ok(Math.abs(positions.getY(index) + sea.position.y - (SEA_LEVEL + 0.12)) < 0.001);
      }
      if (Math.max(Math.abs(positions.getX(index)), Math.abs(positions.getZ(index))) > WORLD_SIZE * 0.49) {
        assert.equal(alpha, 1, 'transparent water must not reveal the finite underlying terrain edge');
      }
    }
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      const a = indices.getX(triangle);
      for (let corner = 1; corner < 3; corner += 1) {
        const b = indices.getX(triangle + corner);
        assert.equal(colors.getX(a), colors.getX(b));
        assert.equal(colors.getY(a), colors.getY(b));
        assert.equal(colors.getZ(a), colors.getZ(b));
      }
    }
    assert.ok(shallowVertices >= 512 && deepVertices >= 256);
    assert.ok(tones.size >= 5 && tones.size <= 16);
  });

  it('keeps translucent shallows close to shore and interrupts the foam instead of tracing a pale continuous rim', () => {
    const sea = createWorld(new THREE.Scene()).root.getObjectByName('Flat illustrated sea') as THREE.Mesh;
    const positions = sea.geometry.getAttribute('position');
    const colors = sea.geometry.getAttribute('color');
    const foamAngles = new Set<string>();
    const shoreAngles = new Set<string>();
    let furthestShallow = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const angle = Math.atan2(x, z);
      const offset = Math.hypot(x, z) - shoreRadiusAt(angle);
      const r = colors.getX(index);
      const g = colors.getY(index);
      const b = colors.getZ(index);
      const alpha = colors.getW(index);
      if (offset > -0.3 && offset < 0.35) shoreAngles.add(angle.toFixed(3));
      if (r > 0.6 && g > 0.6 && b > 0.5) foamAngles.add(angle.toFixed(3));
      if (r < 0.2 && Math.max(g, b) > r * 2 && alpha > 0.4 && alpha < 0.85) {
        furthestShallow = Math.max(furthestShallow, offset);
      }
      if (r > g * 1.08 && g > b * 1.2) assert.ok(offset >= -0.9, `wet-sand strip too wide: ${offset}`);
    }
    assert.ok(furthestShallow > 0.8 && furthestShallow <= 2.25, `broad painted shallow strip: ${furthestShallow}`);
    assert.ok(foamAngles.size >= shoreAngles.size * 0.48);
    assert.ok(foamAngles.size <= shoreAngles.size * 0.85, `unbroken pale rim: ${foamAngles.size}/${shoreAngles.size}`);
  });

  it('authors a deterministic low-cost offshore vista beyond the western shore', () => {
    const first = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Western coastal vista') as THREE.Group;
    const second = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Western coastal vista') as THREE.Group;
    const changed = createWorld(new THREE.Scene(), WORLD_SEED + 1).root.getObjectByName('Western coastal vista') as THREE.Group;
    const swells = first?.getObjectByName('Layered coastal swell ribbons');
    const islandFills = first?.getObjectByName('Distant coastal island silhouettes');
    const islandInk = first?.getObjectByName('Distant coastal island ink');
    const islandWaterline = first?.getObjectByName('Distant island waterline foam');
    const islandTrees = first?.getObjectByName('Offshore island tree silhouettes');
    const mist = first?.getObjectByName('Cool offshore mist bands');
    let calls = 0;
    let triangles = 0;

    first?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      calls += 1;
      const base = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      triangles += base * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });

    assert.ok(first instanceof THREE.Group);
    assert.ok(swells instanceof THREE.InstancedMesh && swells.count >= 24);
    assert.ok(islandFills instanceof THREE.InstancedMesh && islandFills.count === 3);
    assert.ok(islandInk instanceof THREE.InstancedMesh && islandInk.count === islandFills.count);
    assert.ok(islandWaterline instanceof THREE.InstancedMesh && islandWaterline.count === islandFills.count);
    assert.ok(islandTrees instanceof THREE.InstancedMesh && islandTrees.count >= 5 && islandTrees.count <= 7);
    assert.ok(mist instanceof THREE.InstancedMesh && mist.count >= 3);
    assert.notEqual((islandInk.material as THREE.MeshBasicMaterial).color.getHex(), PALETTE.ink);
    assert.ok((mist.material as THREE.MeshBasicMaterial).opacity <= 0.12);
    assert.deepEqual(
      first.children.map((child) => Array.from((child as THREE.InstancedMesh).instanceMatrix.array)),
      second.children.map((child) => Array.from((child as THREE.InstancedMesh).instanceMatrix.array)),
    );
    assert.notDeepEqual(
      Array.from((swells as THREE.InstancedMesh).instanceMatrix.array),
      Array.from((changed.getObjectByName('Layered coastal swell ribbons') as THREE.InstancedMesh).instanceMatrix.array),
    );
    for (const field of [swells, islandFills, islandWaterline, mist] as THREE.InstancedMesh[]) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      for (let index = 0; index < field.count; index += 1) {
        field.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        assert.ok(Math.hypot(position.x, position.z) >= WORLD_SIZE * 0.36);
        assert.ok(Math.hypot(position.x, position.z) <= WORLD_SIZE * 0.61);
      }
    }
    const fillMatrix = new THREE.Matrix4();
    const foamMatrix = new THREE.Matrix4();
    const fillPosition = new THREE.Vector3();
    const foamPosition = new THREE.Vector3();
    for (let index = 0; index < islandFills.count; index += 1) {
      islandFills.getMatrixAt(index, fillMatrix);
      islandWaterline.getMatrixAt(index, foamMatrix);
      fillPosition.setFromMatrixPosition(fillMatrix);
      foamPosition.setFromMatrixPosition(foamMatrix);
      assert.ok(fillPosition.y <= 0.08, `island ${index} base lift: ${fillPosition.y}`);
      assert.ok(Math.hypot(fillPosition.x - foamPosition.x, fillPosition.z - foamPosition.z) < 0.01);
    }
    assert.ok(calls <= 6, `coastal vista drawables: ${calls}`);
    assert.ok(triangles <= 2_500, `coastal vista triangles: ${triangles}`);
  });

  it('frames the western shoreline with deterministic broad leaning brush masses', () => {
    const first = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Coastal framing brush masses');
    const second = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Coastal framing brush masses');
    const changed = createWorld(new THREE.Scene(), WORLD_SEED + 1).root.getObjectByName('Coastal framing brush masses');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const aspects = new Set<string>();
    let leaned = 0;

    assert.ok(first instanceof THREE.InstancedMesh && first.count >= 12 && first.count <= 16);
    assert.deepEqual(Array.from(first.instanceMatrix.array), Array.from((second as THREE.InstancedMesh).instanceMatrix.array));
    assert.notDeepEqual(Array.from(first.instanceMatrix.array), Array.from((changed as THREE.InstancedMesh).instanceMatrix.array));
    for (let index = 0; index < first.count; index += 1) {
      first.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      aspects.add((scale.x / scale.y).toFixed(2));
      leaned += Number(Math.abs(rotation.x) + Math.abs(rotation.z) > 0.03);
      assert.ok(heightAt(position.x, position.z, WORLD_SEED) > 0.35);
    }
    assert.ok(aspects.size >= 8, `coastal brush aspects: ${aspects.size}`);
    assert.ok(leaned >= first.count * 0.7, `leaning brush count: ${leaned}`);
    assert.ok(((first.geometry.index?.count ?? 0) / 3) * first.count <= 1_800);
  });

  it('layers deterministic near and midground masses beside every fixed world capture', () => {
    const firstWorld = createWorld(new THREE.Scene(), WORLD_SEED);
    const first = firstWorld.root.getObjectByName('Layered scenic depth masses');
    const second = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Layered scenic depth masses');
    const changed = createWorld(new THREE.Scene(), WORLD_SEED + 1).root.getObjectByName('Layered scenic depth masses');

    assert.ok(first instanceof THREE.InstancedMesh && first.count >= 14 && first.count <= 18);
    assert.ok(second instanceof THREE.InstancedMesh && changed instanceof THREE.InstancedMesh);
    assert.deepEqual(Array.from(first.instanceMatrix.array), Array.from(second.instanceMatrix.array));
    assert.notDeepEqual(Array.from(first.instanceMatrix.array), Array.from(changed.instanceMatrix.array));

    const anchors: THREE.Vector3[] = [];
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < first.count; index += 1) {
      first.getMatrixAt(index, matrix);
      anchors.push(new THREE.Vector3().setFromMatrixPosition(matrix));
    }
    const captures = [
      { name: 'lineup', x: 0, z: 5, yaw: 0 },
      { name: 'night', x: 2.5, z: 12, yaw: 0 },
      { name: 'coast', x: -46, z: 8, yaw: 0.78 },
      { name: 'boss', x: 19, z: -11.5, yaw: Math.atan2(-6, 18.5) },
    ] as const;
    for (const capture of captures) {
      const forward = new THREE.Vector2(-Math.sin(capture.yaw), -Math.cos(capture.yaw));
      const right = new THREE.Vector2(Math.cos(capture.yaw), -Math.sin(capture.yaw));
      const projected = anchors.map((anchor) => {
        const offset = new THREE.Vector2(anchor.x - capture.x, anchor.z - capture.z);
        return { depth: offset.dot(forward), lateral: Math.abs(offset.dot(right)) };
      });
      assert.ok(
        projected.some(({ depth, lateral }) => depth >= 4 && depth <= 11 && lateral >= 6),
        `${capture.name} lacks a side-framing near mass`,
      );
      assert.ok(
        projected.some(({ depth, lateral }) => depth >= 12 && depth <= 28 && lateral >= 8),
        `${capture.name} lacks a separate midground mass`,
      );
    }

    const material = first.material as THREE.MeshToonMaterial;
    firstWorld.updateDay(0.5);
    const dayDepth = material.emissiveIntensity;
    firstWorld.updateDay(0.05);
    assert.ok(material.emissiveIntensity > dayDepth && material.emissiveIntensity <= 0.4);
    assert.equal(first.castShadow, false);
    assert.ok(((first.geometry.index?.count ?? 0) / 3) * first.count <= 6_000);
  });

  it('bounds scenic mass screen and route occlusion across fixed captures', () => {
    const field = createWorld(new THREE.Scene(), WORLD_SEED).root.getObjectByName('Layered scenic depth masses') as THREE.InstancedMesh;
    field.geometry.computeBoundingSphere();
    const sphere = field.geometry.boundingSphere!;
    const captures = [
      { name: 'lineup', x: 0, z: 5, yaw: 0, pitch: 0.06 },
      { name: 'night', x: 2.5, z: 12, yaw: 0, pitch: -0.04 },
      { name: 'coast', x: -46, z: 8, yaw: 0.78, pitch: -0.04 },
      { name: 'boss', x: 19, z: -11.5, yaw: Math.atan2(-6, 18.5), pitch: -0.07 },
    ] as const;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const violations: string[] = [];

    for (const capture of captures) {
      const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.08, 240);
      camera.position.set(capture.x, heightAt(capture.x, capture.z, WORLD_SEED) + 1.72, capture.z);
      camera.rotation.set(capture.pitch, capture.yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
      const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const tanHorizontal = tanVertical * camera.aspect;
      let maxArea = 0;
      let routeOcclusion = 0;

      for (let index = 0; index < field.count; index += 1) {
        field.getMatrixAt(index, matrix);
        const center = sphere.center.clone().applyMatrix4(matrix).applyMatrix4(camera.matrixWorldInverse);
        const depth = -center.z;
        if (depth <= camera.near) continue;
        scale.setFromMatrixScale(matrix);
        const radius = sphere.radius * Math.max(scale.x, scale.y, scale.z);
        const halfWidth = radius / (depth * tanHorizontal);
        const halfHeight = radius / (depth * tanVertical);
        const centerX = center.x / (depth * tanHorizontal);
        const centerY = center.y / (depth * tanVertical);
        const minX = Math.max(-1, centerX - halfWidth);
        const maxX = Math.min(1, centerX + halfWidth);
        const minY = Math.max(-1, centerY - halfHeight);
        const maxY = Math.min(1, centerY + halfHeight);
        if (minX >= maxX || minY >= maxY) continue;
        maxArea = Math.max(maxArea, (maxX - minX) * (maxY - minY));
        routeOcclusion += Math.max(0, Math.min(maxX, 0.42) - Math.max(minX, -0.42))
          * Math.max(0, Math.min(maxY, 0.52) - Math.max(minY, -0.38));
      }

      if (maxArea > 0.36 || routeOcclusion > 0.23) {
        violations.push(`${capture.name}: max=${maxArea.toFixed(3)}, route=${routeOcclusion.toFixed(3)}`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it('shortens and widens coastal grass to break the repeated spike rhythm', () => {
    const spawns = generateDetailSpawns(WORLD_SEED).filter((spawn) => spawn.kind === 'grass');
    const grass = createWorld(new THREE.Scene()).root.getObjectByName('Instanced grass') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const aspects = new Set<string>();
    let shortAndBroad = 0;

    spawns.forEach((spawn, index) => {
      if (spawn.biome !== 'coast') return;
      grass.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      aspects.add((scale.x / scale.y).toFixed(2));
      shortAndBroad += Number(scale.x >= scale.y * 0.62);
    });
    const coastalCount = spawns.filter((spawn) => spawn.biome === 'coast').length;
    assert.ok(aspects.size >= 8, `coastal grass aspects: ${aspects.size}`);
    assert.ok(shortAndBroad >= coastalCount * 0.7, `short broad coast grass: ${shortAndBroad}/${coastalCount}`);
  });

  it('uses curved grass ribbons and closed thin broad leaves instead of rigid cones and solid bush boulders', () => {
    const world = createWorld(new THREE.Scene());
    const grass = world.root.getObjectByName('Instanced grass') as THREE.InstancedMesh;
    const brush = world.root.getObjectByName('Instanced brush') as THREE.InstancedMesh;
    const root = new THREE.Vector3();
    const middle = new THREE.Vector3();
    const tip = new THREE.Vector3();
    const other = new THREE.Vector3();
    const bend = new THREE.Vector3();
    const grassPositions = grass.geometry.getAttribute('position');

    assert.equal(grassPositions.count, 21, 'three ribbons each need three width stations and a curled tip');
    assert.equal((grass.material as THREE.Material).side, THREE.DoubleSide);
    for (let blade = 0; blade < 3; blade += 1) {
      const start = blade * 7;
      root.fromBufferAttribute(grassPositions, start).add(other.fromBufferAttribute(grassPositions, start + 1)).multiplyScalar(0.5);
      middle.fromBufferAttribute(grassPositions, start + 4).add(other.fromBufferAttribute(grassPositions, start + 5)).multiplyScalar(0.5).sub(root);
      tip.fromBufferAttribute(grassPositions, start + 6).sub(root);
      assert.ok(bend.crossVectors(middle, tip).length() > 0.02, `straight grass blade ${blade}`);
    }
    const leaves = brush.geometry.getAttribute('position');
    assert.equal(leaves.count, 45, 'five volumetric leaves must replace the three intersecting bush spheres');
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const start = leaf * 9;
      root.set(0, 0, 0);
      middle.set(0, 0, 0);
      for (let corner = 0; corner < 4; corner += 1) {
        root.add(other.fromBufferAttribute(leaves, start + corner).multiplyScalar(0.25));
        middle.add(other.fromBufferAttribute(leaves, start + 4 + corner).multiplyScalar(0.25));
      }
      tip.fromBufferAttribute(leaves, start + 8).sub(root);
      middle.sub(root);
      assert.ok(bend.crossVectors(middle, tip).length() > 0.025, `uncurved broad leaf ${leaf}`);
      const ridgeDepth = other.fromBufferAttribute(leaves, start + 5).distanceTo(bend.fromBufferAttribute(leaves, start + 7));
      const leafWidth = other.fromBufferAttribute(leaves, start + 4).distanceTo(bend.fromBufferAttribute(leaves, start + 6));
      assert.ok(ridgeDepth < leafWidth * 0.35, `boulder-thick leaf ${leaf}`);
    }
    assert.equal(grass.count, 720);
    assert.equal(brush.count, 140);
  });

  it('lays deterministic dry-ground paint as one cheap instanced field', () => {
    const first = generateGroundDabSpawns(WORLD_SEED);
    const second = generateGroundDabSpawns(WORLD_SEED);
    const world = createWorld(new THREE.Scene());
    const field = world.root.getObjectByName('Instanced painted ground dabs');

    assert.deepEqual(first, second);
    assert.ok(first.length >= 170 && first.length <= 185);
    assert.ok(first.every((dab) => heightAt(dab.x, dab.z, WORLD_SEED) > 0.35));
    assert.ok(first.filter((dab) => dab.scaleX > dab.scaleZ * 1.5).length / first.length > 0.7);
    assert.ok(field instanceof THREE.InstancedMesh);
    assert.equal(field.count, first.length);
    assert.ok(field.material instanceof THREE.MeshToonMaterial);
    assert.equal(field.material.transparent, false);
    assert.equal(field.material.depthWrite, true);
    assert.ok(first.every((dab) => dab.scaleX <= 0.95 && dab.scaleZ <= 0.24));
    const trianglesPerDab = (field.geometry.index?.count ?? 0) / 3;
    assert.ok(trianglesPerDab >= 12);
    assert.ok(trianglesPerDab * field.count <= 2_500);

    const actual = new THREE.Color();
    const base = new THREE.Color();
    let maxContrast = 0;
    first.forEach((dab, index) => {
      field.getColorAt(index, actual);
      base.setHex(BIOME_COLORS[biomeAt(dab.x, dab.z)][1]);
      maxContrast = Math.max(maxContrast, Math.hypot(actual.r - base.r, actual.g - base.g, actual.b - base.b));
    });
    assert.ok(maxContrast <= 0.04, `ground paint contrast: ${maxContrast}`);
  });

  it('frames the apex approach with cheap authored layers outside the combat lane', () => {
    const world = createWorld(new THREE.Scene());
    const dressing = world.root.getObjectByName('Apex arena dressing') as THREE.Group;
    const grass = dressing?.getObjectByName('Apex approach grass');
    const stones = dressing?.getObjectByName('Apex framing stones');
    const signals = dressing?.getObjectByName('Apex amber signals');
    const arenaStrokes = dressing?.getObjectByName('Apex arena ink strokes');
    let calls = 0;
    let triangles = 0;

    dressing?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      calls += 1;
      const base = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      triangles += base * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });

    assert.ok(dressing instanceof THREE.Group);
    assert.ok(grass instanceof THREE.InstancedMesh && grass.count >= 40 && grass.count <= 52);
    assert.ok(stones instanceof THREE.InstancedMesh && stones.count >= 12);
    assert.ok(signals instanceof THREE.InstancedMesh && signals.count >= 10);
    assert.ok(arenaStrokes instanceof THREE.InstancedMesh && arenaStrokes.count >= 12);
    assert.ok(calls <= 7, `apex dressing drawables: ${calls}`);
    assert.ok(triangles <= 4_500, `apex dressing triangles: ${triangles}`);
  });

  it('keeps soft cloud banks distant from the playable foreground', () => {
    const clouds = createWorld(new THREE.Scene()).root.getObjectByName('Cel-shaded cloud field') as THREE.Group;
    let outlines = 0;
    clouds.traverse((object) => { outlines += Number(Boolean(object.userData.inkOutline)); });

    assert.equal(clouds.children.length, 6);
    assert.ok(clouds.children.every((cloud) => cloud.children.length === 2));
    assert.ok(new Set(clouds.children.map((cloud) => (cloud.scale.x / cloud.scale.y).toFixed(2))).size >= 4);
    assert.ok(clouds.children.every((cloud) => Math.abs(cloud.position.z) >= 48));
    assert.ok(clouds.children.every((cloud) => cloud.position.y >= 25 && cloud.scale.x <= 2.6));
    assert.ok(clouds.children.filter((cloud) => cloud.position.x <= -80 && cloud.position.z <= -48).length >= 2);
    for (const cloud of clouds.children) {
      const top = cloud.getObjectByName('Bright cloud top') as THREE.Mesh;
      const underside = cloud.getObjectByName('Cool cloud underside') as THREE.Mesh;
      assert.ok(top instanceof THREE.Mesh && top.material instanceof THREE.MeshBasicMaterial);
      assert.ok(underside instanceof THREE.Mesh && underside.material instanceof THREE.MeshBasicMaterial);
      assert.equal((top.material as THREE.MeshBasicMaterial).fog, false);
      assert.equal((underside.material as THREE.MeshBasicMaterial).fog, false);
      assert.ok((top.material as THREE.MeshBasicMaterial).color.getHex() !== (underside.material as THREE.MeshBasicMaterial).color.getHex());
      assert.ok((top.material as THREE.MeshBasicMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l
        > (underside.material as THREE.MeshBasicMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l);
    }
    assert.equal(outlines, 0);
  });

  it('separates a warm daylight key from a cool rim and preserves night readability', () => {
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    const key = world.root.getObjectByName('Warm cel key');
    const ambient = world.root.getObjectByName('Soft sky ambience');
    const rim = world.root.getObjectByName('Cool cel rim');
    const cloudTop = world.root.getObjectByName('Bright cloud top') as THREE.Mesh;

    assert.ok(key instanceof THREE.DirectionalLight);
    assert.ok(ambient instanceof THREE.HemisphereLight);
    assert.ok(rim instanceof THREE.DirectionalLight);
    assert.ok(key.intensity / ambient.intensity >= 4.5);
    assert.ok(rim.intensity >= 1);
    assert.ok(key.color.r > key.color.b && rim.color.b > rim.color.r);
    const dayCloud = (cloudTop.material as THREE.MeshBasicMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l;
    world.updateDay(0.05);
    assert.ok(key.intensity < 0.6 && ambient.intensity >= 0.46);
    assert.ok(rim.intensity >= 0.4);
    assert.ok((cloudTop.material as THREE.MeshBasicMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l < dayCloud);
  });

  it('uses two flat panoramic bands that shift from daylight to a darker night horizon', () => {
    const world = createWorld(new THREE.Scene());
    const bands = world.root.getObjectByName('Flat horizon depth bands');
    const day = new THREE.Color();
    const night = new THREE.Color();

    assert.ok(bands instanceof THREE.InstancedMesh && bands.count === 2);
    assert.equal(bands.geometry.type, 'CylinderGeometry');
    assert.equal((bands.material as THREE.MeshBasicMaterial).transparent, true);
    assert.ok((bands.material as THREE.MeshBasicMaterial).opacity <= 0.09);
    assert.equal((bands.material as THREE.MeshBasicMaterial).depthWrite, false);
    world.updateDay(0.5);
    bands.getColorAt(0, day);
    world.updateDay(0.05);
    bands.getColorAt(0, night);
    assert.notEqual(day.getHex(), night.getHex());
    assert.ok(night.getHSL({ h: 0, s: 0, l: 0 }).l < day.getHSL({ h: 0, s: 0, l: 0 }).l);
  });

  it('adds one deterministic cool canopy ridge that darkens into the night midground', () => {
    const world = createWorld(new THREE.Scene());
    const ridge = world.root.getObjectByName('Distant moonlit canopy ridge');
    const day = new THREE.Color();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    assert.ok(ridge instanceof THREE.InstancedMesh && ridge.count >= 6 && ridge.count <= 8);
    const material = ridge.material as THREE.MeshBasicMaterial;
    assert.ok(((ridge.geometry.index?.count ?? 0) / 3) * ridge.count <= 4_000);
    for (let index = 0; index < ridge.count; index += 1) {
      ridge.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      assert.ok(position.z <= -48 && Math.abs(position.x) <= 48);
    }
    world.updateDay(0.5);
    day.copy(material.color);
    world.updateDay(0.05);
    assert.ok(material.color.getHSL({ h: 0, s: 0, l: 0 }).l < day.getHSL({ h: 0, s: 0, l: 0 }).l);
    assert.ok(material.color.b > material.color.r);
  });

  it('renders each animated wave mark as one depth-safe two-triangle ribbon', () => {
    const root = createWorld(new THREE.Scene()).root;
    const marks = root.getObjectByName('Chunky illustrated wave marks');
    const sea = root.getObjectByName('Flat illustrated sea');

    assert.ok(marks instanceof THREE.InstancedMesh);
    assert.ok(sea instanceof THREE.Mesh);
    assert.equal((marks.geometry.index?.count ?? 0) / 3, 2);
    assert.equal(marks.count, 90);
    assert.ok(marks.instanceColor);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let western = 0;
    for (let index = 0; index < marks.count; index += 1) {
      marks.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      western += Number(position.x < -20);
    }
    assert.ok(western >= 54, `western water streaks: ${western}`);
    assert.equal((marks.material as THREE.Material).depthWrite, false);
    assert.ok(marks.renderOrder > sea.renderOrder, 'opaque ocean bands must not paint over transparent surface marks');
    const swells = root.getObjectByName('Layered coastal swell ribbons')!;
    assert.ok(swells.renderOrder >= marks.renderOrder);
    assert.equal(sea.receiveShadow, false, 'transparent sea must not receive giant offscreen actor shadows');
    const terrain = root.getObjectByName('Procedural four-biome island') as THREE.Mesh;
    assert.equal(terrain.receiveShadow, false, 'submerged terrain must not reveal slab-like offscreen shadows');
  });

  it('leaves actor headroom inside the runtime world render budget', () => {
    const world = createWorld(new THREE.Scene());
    const grass = world.root.getObjectByName('Instanced grass');
    let calls = 0;
    let triangles = 0;
    world.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      calls += 1;
      const base = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      triangles += base * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });

    assert.ok(grass instanceof THREE.InstancedMesh);
    assert.ok((grass.geometry.index?.count ?? 0) / 3 <= 18);
    assert.equal(grass.geometry.name, 'Three-direction leaf ribbon cluster');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const grassAspects = new Set<string>();
    for (let index = 0; index < Math.min(grass.count, 80); index += 1) {
      grass.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      grassAspects.add((scale.x / scale.y).toFixed(2));
    }
    assert.ok(grassAspects.size >= 3, `grass aspect variants: ${grassAspects.size}`);
    assert.ok(calls <= 292, `world drawables: ${calls}`);
    assert.ok(triangles <= 114_000, `world triangles: ${triangles}`);
  });

  it('uses untiled palette-banded terrain and stronger distance fog', () => {
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    const terrain = world.root.getObjectByName('Procedural four-biome island') as THREE.Mesh;
    const material = terrain.material as THREE.MeshToonMaterial;
    const colors = terrain.geometry.getAttribute('color');
    const uniqueColors = new Set<string>();
    for (let index = 0; index < colors.count; index += 1) {
      uniqueColors.add(`${colors.getX(index).toFixed(4)}:${colors.getY(index).toFixed(4)}:${colors.getZ(index).toFixed(4)}`);
    }

    assert.equal(material.map, null);
    assert.ok(uniqueColors.size >= 8 && uniqueColors.size <= 12);
    assert.ok(scene.fog instanceof THREE.Fog);
    assert.ok(scene.fog.near <= 32 && scene.fog.far <= 96);
  });

  it('keeps grounded resource silhouettes inside a tight local render budget', () => {
    const world = createWorld(new THREE.Scene());
    let calls = 0;
    let triangles = 0;

    for (const node of world.resources) {
      assert.ok(node.root.getObjectByName('Painted contact shadow'));
      node.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        calls += 1;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      });
    }

    assert.ok(calls <= 230, `resource drawables: ${calls}`);
    assert.ok(triangles <= 35_000, `resource triangles: ${triangles}`);
  });

  it('seats every berry against an actual leaf surface after the bush silhouette changes', () => {
    const node = createWorld(new THREE.Scene()).resources.find((resource) => resource.kind === 'berries')!;
    const fills: THREE.Mesh[] = [];
    node.root.traverse((child) => { if (child instanceof THREE.Mesh && child.userData.inkFill) fills.push(child); });
    const leaf = fills[0]!;
    const fruit = fills[1]!;
    node.root.updateMatrixWorld(true);
    const toFruit = fruit.matrixWorld.clone().invert().multiply(leaf.matrixWorld);
    const leafPositions = leaf.geometry.getAttribute('position');
    const leafIndices = leaf.geometry.index!;
    const fruitPositions = fruit.geometry.getAttribute('position');
    const triangle = new THREE.Triangle();
    const nearest = new THREE.Vector3();
    for (let start = 0; start < fruitPositions.count; start += 48) {
      const bounds = new THREE.Box3();
      for (let vertex = start; vertex < start + 48; vertex += 1) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(fruitPositions, vertex));
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = bounds.getSize(new THREE.Vector3()).y * 0.5;
      let gap = Infinity;
      for (let face = 0; face < leafIndices.count; face += 3) {
        triangle.a.fromBufferAttribute(leafPositions, leafIndices.getX(face)).applyMatrix4(toFruit);
        triangle.b.fromBufferAttribute(leafPositions, leafIndices.getX(face + 1)).applyMatrix4(toFruit);
        triangle.c.fromBufferAttribute(leafPositions, leafIndices.getX(face + 2)).applyMatrix4(toFruit);
        gap = Math.min(gap, triangle.closestPointToPoint(center, nearest).distanceTo(center));
      }
      assert.ok(gap < radius * 0.9, `floating berry ${start / 48}: surface gap ${gap}, radius ${radius}`);
    }
  });

  it('grounds all static rock and log details in one shared instanced draw', () => {
    const expected = generateDetailSpawns(WORLD_SEED).filter((spawn) => spawn.kind === 'rock' || spawn.kind === 'log');
    const field = createWorld(new THREE.Scene()).root.getObjectByName('Instanced rock and log contact shadows');

    assert.ok(field instanceof THREE.InstancedMesh);
    assert.equal(field.count, expected.length);
    assert.equal((field.geometry.index?.count ?? 0) / 3, 2);
    assert.equal(field.castShadow, false);
  });

  it('adds one restrained non-shadowing light only to a real campfire', () => {
    const real = createStructureVisual('campfire');
    const flame = real.children.find((child) => child.userData.flame);
    const flameFills: THREE.Mesh[] = [];
    flame?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.inkFill) flameFills.push(child);
    });
    const realLights = real.children.filter((child) => child instanceof THREE.PointLight);
    const ghostLights = createStructureVisual('campfire', true).children.filter((child) => child instanceof THREE.PointLight);

    assert.equal(flameFills.length, 2);
    assert.equal(new Set(flameFills.map((fill) => (fill.material as THREE.MeshBasicMaterial).color.getHex())).size, 2);
    assert.ok(flameFills.every((fill) => fill.material instanceof THREE.MeshBasicMaterial && !fill.material.toneMapped));
    assert.equal(realLights.length, 1);
    assert.equal(ghostLights.length, 0);
    assert.ok(realLights[0]!.intensity <= 6);
    assert.ok(realLights[0]!.distance > 0 && realLights[0]!.distance <= 6.5);
    assert.equal(realLights[0]!.castShadow, false);
  });

  it('builds a dimensional unoutlined flame over charred round logs and an ember bed', () => {
    const fire = createStructureVisual('campfire');
    const flame = fire.getObjectByName('Sculpted outer flame');
    assert.ok(flame instanceof THREE.Mesh);
    assert.ok(flame.material instanceof THREE.MeshBasicMaterial && flame.material.vertexColors);
    flame.geometry.computeBoundingBox();
    const size = flame.geometry.boundingBox!.getSize(new THREE.Vector3());
    assert.ok(size.x > 0.5 && size.y > 0.8 && size.z > 0.45, `flat flame silhouette: ${size.toArray()}`);
    const colors = flame.geometry.getAttribute('color');
    const tones = new Set<string>();
    for (let index = 0; index < colors.count; index += 1) tones.add(`${colors.getX(index)}:${colors.getY(index)}:${colors.getZ(index)}`);
    assert.ok(tones.size >= 3 && tones.size <= 4);
    assert.ok(fire.getObjectByName('Charred round firewood'));
    assert.ok(fire.getObjectByName('Campfire ember bed'));
    assert.ok(fire.getObjectByName('Airborne illustrated embers'));
    let outlines = 0;
    fire.children.find((child) => child.userData.flame)?.traverse((child) => { outlines += Number(Boolean(child.userData.inkOutline)); });
    assert.equal(outlines, 0, 'flame must not read as a black outlined inventory decal');
    let calls = 0;
    let triangles = 0;
    fire.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      calls += 1;
      triangles += (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3;
    });
    assert.ok(calls <= 16 && triangles <= 2_600, `campfire budget: ${calls} draws, ${triangles} triangles`);
  });
});
