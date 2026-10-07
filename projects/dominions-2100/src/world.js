import * as THREE from 'three';

export const TEAM_COLORS = Object.freeze({
  player: 0x28b8ff,
  jugador: 0x28b8ff,
  aliado: 0x4adf8b,
  ally: 0x4adf8b,
  enemy: 0xff5b45,
  enemigo: 0xff5b45,
  neutral: 0xd7c38d,
});

const SELECTION_RING = Symbol('selectionRing');
const sharedGeometry = (geometry) => {
  geometry.userData.shared = true;
  return geometry;
};

const GEO = {
  box: sharedGeometry(new THREE.BoxGeometry(1, 1, 1)),
  sphere: sharedGeometry(new THREE.SphereGeometry(0.5, 12, 8)),
  cylinder: sharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
  cone: sharedGeometry(new THREE.CylinderGeometry(0, 0.5, 1, 10)),
  wheel: sharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12)),
  dome: sharedGeometry(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
  circle: sharedGeometry(new THREE.CircleGeometry(0.5, 24)),
};

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (value) => value * value * (3 - 2 * value);

function seedValue(seed) {
  if (Number.isFinite(seed)) return seed | 0;
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash | 0;
}

function hash2(x, z, seed) {
  let hash = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

/*
 * Minimal in-house version inspired by the reference MIT library:
 * https://github.com/alandaitch/imperios-1800-2100/blob/main/src/art/ProceduralTextures.js
 * Texture API: https://threejs.org/docs/pages/CanvasTexture.html
 */
const surfaceTextures = new Map();

function periodicNoise(x, y, seed, size, cells = 32) {
  const u = (x / (size - 1)) * cells;
  const v = (y / (size - 1)) * cells;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = smooth(u - x0);
  const ty = smooth(v - y0);
  const wrapped = (value) => ((value % cells) + cells) % cells;
  return lerp(
    lerp(hash2(wrapped(x0), wrapped(y0), seed), hash2(wrapped(x0 + 1), wrapped(y0), seed), tx),
    lerp(hash2(wrapped(x0), wrapped(y0 + 1), seed), hash2(wrapped(x0 + 1), wrapped(y0 + 1), seed), tx),
    ty,
  );
}

function makeSurfaceCanvas(kind, size = 128) {
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(size, size);
  else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
  } else return null;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const image = context.createImageData(size, size);
  const seed = seedValue(`surface:${kind}`);
  const tau = Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x === size - 1 ? 0 : x;
      const py = y === size - 1 ? 0 : y;
      const grain = periodicNoise(x, y, seed, size) - 0.5;
      let value;
      if (kind === 'terrain') {
        const weave = Math.sin((x / (size - 1)) * tau * 8) * Math.sin((y / (size - 1)) * tau * 6);
        const fleck = periodicNoise(x, y, seed + 19, size, 48) > 0.82 ? -0.22 : 0;
        value = 0.94 + grain * 0.12 + weave * 0.035 + fleck;
      } else if (kind === 'wall') {
        const row = Math.floor(py / 32);
        const joint = py % 32 < 2 || (px + (row % 2) * 16) % 32 < 2;
        value = joint ? 0.57 + grain * 0.08 : 0.95 + grain * 0.11;
      } else if (kind === 'roof') {
        const row = Math.floor(py / 16);
        const joint = py % 16 < 2 || (px + (row % 2) * 16) % 32 < 2;
        value = joint ? 0.54 + grain * 0.06 : 0.92 + grain * 0.13;
      } else {
        const seam = px % 64 < 2 || py % 64 < 2;
        const dx = ((px + 8) % 32) - 16;
        const dy = ((py + 8) % 32) - 16;
        const rivet = dx * dx + dy * dy < 5;
        const brush = Math.sin((y / (size - 1)) * tau * 32) * 0.025;
        value = rivet ? 0.5 : seam ? 0.68 : 0.94 + grain * 0.07 + brush;
      }
      const byte = Math.round(clamp(value, 0, 1) * 255);
      const offset = (y * size + x) * 4;
      image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = byte;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function surfaceTexture(kind, repeat) {
  const key = `${kind}:${repeat[0]}x${repeat[1]}`;
  if (surfaceTextures.has(key)) return surfaceTextures.get(key);
  const canvas = makeSurfaceCanvas(kind);
  if (!canvas) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `Procedural ${kind}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.userData.shared = true;
  surfaceTextures.set(key, texture);
  return texture;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  return lerp(
    lerp(hash2(x0, z0, seed), hash2(x0 + 1, z0, seed), tx),
    lerp(hash2(x0, z0 + 1, seed), hash2(x0 + 1, z0 + 1, seed), tx),
    tz,
  );
}

function fbm(x, z, seed) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    total += amplitude;
    amplitude *= 0.48;
    frequency *= 2.07;
  }
  return value / total;
}

function makeHeightSampler(size, seed) {
  const numericSeed = seedValue(seed);
  return (x, z) => {
    const broad = (fbm(x * 0.035, z * 0.035, numericSeed) - 0.48) * 5.2;
    const detail = (fbm(x * 0.095 + 31, z * 0.095 - 17, numericSeed) - 0.5) * 1.15;
    const radius = Math.hypot(x, z) / (size * 0.56);
    const edge = Math.max(0, (radius - 0.56) / 0.52);
    const centralShelf = Math.exp(-(x * x + z * z) / (size * size * 0.055)) * 0.62;
    return broad + detail + centralShelf + 0.45 - edge * edge * 7.5;
  };
}

function seededRandom(seed) {
  let state = seedValue(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function terrainColor(height, waterLevel, variation) {
  const color = new THREE.Color();
  if (height < waterLevel - 0.45) color.setHex(0x263f3e);
  else if (height < waterLevel + 0.08) color.setHex(0x887e5f);
  else if (height < waterLevel + 0.42) color.setHex(0xc4aa70);
  else if (height < 2.3) color.setHex(0x536f3f);
  else if (height < 4.2) color.setHex(0x65704d);
  else color.setHex(0x7f8075);
  color.multiplyScalar(0.88 + variation * 0.2);
  return color;
}

function makeTerrain(size, segments, waterLevel, heightAt, seed) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const numericSeed = seedValue(seed);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const height = heightAt(x, z);
    positions.setY(index, height);
    terrainColor(height, waterLevel, valueNoise(x * 0.22, z * 0.22, numericSeed + 77)).toArray(colors, index * 3);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: surfaceTexture('terrain', [18, 18]),
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.02,
    }),
  );
  terrain.name = 'Strategic terrain';
  terrain.receiveShadow = true;
  terrain.userData = { worldSurface: true, raycastRole: 'terrain' };
  return terrain;
}

function makeCoastline(size, waterLevel, heightAt, resolution = 72) {
  const vertices = [];
  const step = size / resolution;
  const half = size / 2;
  const crossing = (a, b) => {
    const ratio = (waterLevel - a.height) / (b.height - a.height);
    return [lerp(a.x, b.x, ratio), waterLevel + 0.055, lerp(a.z, b.z, ratio)];
  };

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const x = -half + column * step;
      const z = -half + row * step;
      const corners = [
        { x, z, height: heightAt(x, z) },
        { x: x + step, z, height: heightAt(x + step, z) },
        { x: x + step, z: z + step, height: heightAt(x + step, z + step) },
        { x, z: z + step, height: heightAt(x, z + step) },
      ];
      const hits = [];
      for (let edge = 0; edge < 4; edge += 1) {
        const a = corners[edge];
        const b = corners[(edge + 1) % 4];
        if ((a.height >= waterLevel) !== (b.height >= waterLevel)) hits.push(crossing(a, b));
      }
      if (hits.length >= 2) vertices.push(...hits[0], ...hits[1]);
      if (hits.length === 4) vertices.push(...hits[2], ...hits[3]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const coast = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xd8e4d2,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  coast.name = 'Espuma costera';
  coast.renderOrder = 3;
  coast.userData = { raycastIgnore: true, scenery: 'coast' };
  return coast;
}

function makeWater(size, waterLevel) {
  const geometry = new THREE.PlaneGeometry(size * 3.5, size * 3.5, 72, 72);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x082e43) },
      uShallow: { value: new THREE.Color(0x217f91) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vec3 point = position;
        float wave = sin(point.x * 0.27 + uTime * 0.85) * 0.045
          + sin(point.z * 0.34 - uTime * 0.65) * 0.035;
        point.y += wave;
        vUv = uv;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float waveA = sin(dot(vUv, vec2(61.0, 37.0)) + uTime * 1.25);
        float waveB = sin(dot(vUv, vec2(-29.0, 53.0)) - uTime * 0.92);
        float glint = pow(max(0.0, waveA * 0.5 + waveB * 0.5), 8.0) * 0.018;
        vec3 color = mix(uDeep, uShallow, 0.38 + vWave * 4.0) + glint;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  water.position.y = waterLevel;
  water.name = 'Ocean';
  water.receiveShadow = true;
  water.renderOrder = 2;
  water.userData = { worldSurface: true, raycastRole: 'water' };
  return water;
}

function makeSky(size) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(size * 3.4, 48, 28),
    new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x315f88) },
        uHorizon: { value: new THREE.Color(0xd9b98f) },
        uGround: { value: new THREE.Color(0x53636a) },
        uSun: { value: new THREE.Color(0xffe7b0) },
        uSunDirection: { value: new THREE.Vector3(-0.55, 0.52, -0.35).normalize() },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSun;
        uniform vec3 uSunDirection;
        varying vec3 vDirection;
        void main() {
          float height = vDirection.y;
          vec3 sky = height < 0.0
            ? mix(uGround, uHorizon, smoothstep(-0.35, 0.05, height))
            : mix(uHorizon, uZenith, smoothstep(0.0, 0.9, height));
          float sunDisc = pow(max(dot(vDirection, uSunDirection), 0.0), 320.0);
          float sunGlow = pow(max(dot(vDirection, uSunDirection), 0.0), 12.0) * 0.24;
          gl_FragColor = vec4(sky + uSun * (sunDisc + sunGlow), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.name = 'Atmospheric sky';
  sky.renderOrder = -1000;
  sky.userData.raycastIgnore = true;
  return sky;
}

function makeScenery(size, waterLevel, heightAt, seed) {
  const group = new THREE.Group();
  group.name = 'Vegetation and rocks';
  group.userData = { scenery: true, raycastIgnore: true };
  const random = seededRandom(`${seed}:scenery`);
  const numericSeed = seedValue(seed);
  const points = (wanted, predicate) => {
    const found = [];
    for (let attempt = 0; attempt < wanted * 18 && found.length < wanted; attempt += 1) {
      const x = (random() - 0.5) * size * 0.9;
      const z = (random() - 0.5) * size * 0.9;
      const y = heightAt(x, z);
      const slope = Math.abs(heightAt(x + 0.6, z) - heightAt(x - 0.6, z))
        + Math.abs(heightAt(x, z + 0.6) - heightAt(x, z - 0.6));
      if (predicate(x, y, z, slope)) found.push({ x, y, z, scale: 0.75 + random() * 0.65 });
    }
    return found;
  };

  const trees = points(105, (x, y, z, slope) => (
    y > waterLevel + 0.5 && y < 3.8 && slope < 1.4
    && (Math.abs(x) > 12 || Math.abs(z) > 10)
    && valueNoise(x * 0.065, z * 0.065, numericSeed + 311) > 0.48
  ));
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d3b26, roughness: 1 }),
    trees.length,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.05, 0.78, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0x345535, roughness: 0.96 }),
    trees.length,
  );
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  trees.forEach((tree, index) => {
    const trunkHeight = 1.25 * tree.scale;
    dummy.position.set(tree.x, tree.y + trunkHeight / 2, tree.z);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(tree.scale, trunkHeight, tree.scale);
    dummy.updateMatrix();
    trunk.setMatrixAt(index, dummy.matrix);

    dummy.position.y = tree.y + trunkHeight + 0.72 * tree.scale;
    dummy.scale.set(tree.scale, 1.65 * tree.scale, tree.scale);
    dummy.updateMatrix();
    crown.setMatrixAt(index, dummy.matrix);
    crown.setColorAt(index, tint.setHSL(0.29 + random() * 0.05, 0.24 + random() * 0.18, 0.25 + random() * 0.1));
  });
  trunk.castShadow = trunk.receiveShadow = true;
  crown.castShadow = crown.receiveShadow = true;
  trunk.userData = crown.userData = { scenery: 'forest', raycastIgnore: true };
  trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true;
  if (crown.instanceColor) crown.instanceColor.needsUpdate = true;
  group.add(trunk, crown);

  const rocks = points(52, (x, y, z, slope) => y > waterLevel + 0.1 && slope < 2.5 && (Math.abs(x) > 9 || Math.abs(z) > 8));
  const rock = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x77786f, roughness: 0.94 }),
    rocks.length,
  );
  rocks.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.22 * item.scale, item.z);
    dummy.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.4);
    dummy.scale.set(item.scale * 0.8, item.scale * (0.35 + random() * 0.35), item.scale);
    dummy.updateMatrix();
    rock.setMatrixAt(index, dummy.matrix);
    rock.setColorAt(index, tint.setHSL(0.14, 0.03 + random() * 0.05, 0.38 + random() * 0.16));
  });
  rock.castShadow = rock.receiveShadow = true;
  rock.userData = { scenery: 'rocks', raycastIgnore: true };
  rock.instanceMatrix.needsUpdate = true;
  if (rock.instanceColor) rock.instanceColor.needsUpdate = true;
  group.add(rock);

  const brushPoints = points(180, (x, y, z, slope) => (
    y > waterLevel + 0.38 && y < 3.5 && slope < 1.2
    && (Math.abs(x) > 10 || Math.abs(z) > 9)
    && valueNoise(x * 0.085, z * 0.085, numericSeed + 719) > 0.55
  ));
  const brush = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.2, 0.62, 4),
    new THREE.MeshStandardMaterial({ color: 0x6d7950, roughness: 1 }),
    brushPoints.length,
  );
  brushPoints.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.22 * item.scale, item.z);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(item.scale * (0.65 + random() * 0.45), item.scale * (0.65 + random() * 0.75), item.scale);
    dummy.updateMatrix();
    brush.setMatrixAt(index, dummy.matrix);
    brush.setColorAt(index, tint.setHSL(0.2 + random() * 0.09, 0.2 + random() * 0.16, 0.33 + random() * 0.12));
  });
  brush.receiveShadow = true;
  brush.userData = { scenery: 'ground-cover', raycastIgnore: true };
  brush.instanceMatrix.needsUpdate = true;
  if (brush.instanceColor) brush.instanceColor.needsUpdate = true;
  group.add(brush);
  return group;
}

function makeLighting(size, shadowMapSize) {
  const lights = new THREE.Group();
  lights.name = 'World lighting';
  const hemisphere = new THREE.HemisphereLight(0xb8d9ff, 0x3d3327, 1.55);
  const fill = new THREE.DirectionalLight(0x91b5d3, 0.55);
  fill.position.set(-35, 28, 38);
  const sun = new THREE.DirectionalLight(0xffdcaa, 3.15);
  sun.position.set(size * 0.42, size * 0.74, size * 0.28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -size * 0.58;
  sun.shadow.camera.right = sun.shadow.camera.top = size * 0.58;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = size * 2.1;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  sun.target.position.set(0, 0, 0);
  lights.add(hemisphere, fill, sun, sun.target);
  lights.userData.sun = sun;
  return lights;
}

/** Enables the world's expected visual pipeline without creating another renderer. */
export function configureRenderer(renderer, { exposure = 1.05, pixelRatio = globalThis.devicePixelRatio || 1 } = {}) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  return renderer;
}

/** Isometric orthographic camera; use resizeIsometricCamera when the viewport changes. */
export function createIsometricCamera({ width = 16, height = 9, viewSize = 48, near = 0.1, far = 400 } = {}) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, near, far);
  camera.position.set(48, 46, 48);
  camera.lookAt(0, 0, 0);
  camera.userData.viewSize = viewSize;
  resizeIsometricCamera(camera, width, height);
  return camera;
}

export function resizeIsometricCamera(camera, width, height) {
  const viewSize = camera.userData.viewSize || 48;
  const aspect = Math.max(width, 1) / Math.max(height, 1);
  camera.left = (-viewSize * aspect) / 2;
  camera.right = (viewSize * aspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  return camera;
}

/**
 * Creates the scene and returns a small API: register, unregister, addEffect,
 * heightAt, update, and dispose. heightAt coordinates are local to the group.
 */
export function createWorld(options = {}) {
  if (options?.isScene) options = { scene: options };
  const {
    scene = new THREE.Scene(),
    renderer,
    size = 96,
    segments = 72,
    waterLevel = -0.65,
    seed = 'empires',
    shadowMapSize = 2048,
  } = options;
  if (renderer) configureRenderer(renderer, options);

  const group = new THREE.Group();
  group.name = 'Empires World';
  group.userData = { world: true, size, waterLevel, seed };
  const heightAt = makeHeightSampler(size, seed);
  const terrain = makeTerrain(size, segments, waterLevel, heightAt, seed);
  const water = makeWater(size, waterLevel);
  const coast = makeCoastline(size, waterLevel, heightAt);
  const scenery = makeScenery(size, waterLevel, heightAt, seed);
  const sky = makeSky(size);
  const lighting = makeLighting(size, shadowMapSize);
  group.add(sky, terrain, water, coast, scenery, lighting);
  scene.add(group);

  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const background = new THREE.Color(0x6f8fa6);
  const fog = new THREE.Fog(0x78909b, size * 0.72, size * 1.9);
  scene.background = background;
  scene.fog = fog;

  const atmosphereByEra = {
    1800: [0x315f88, 0xd9b98f, 0x53636a, 0x082e43, 0x217f91, 0x78909b, 0xffdcaa, 3.15],
    1900: [0x3c566d, 0xb8a17f, 0x555b59, 0x092f40, 0x347986, 0x7d8586, 0xf1c68d, 3.0],
    2000: [0x286b98, 0xb9d3dc, 0x485b65, 0x062d50, 0x2187a1, 0x6f94a4, 0xe2efff, 3.35],
    2100: [0x29396c, 0x93a8cf, 0x344257, 0x071f4c, 0x296ca3, 0x657b9c, 0xc9efff, 3.55],
  };
  const setEra = (era = 1800) => {
    const [zenith, horizon, ground, deep, shallow, fogColor, sunColor, sunIntensity] = atmosphereByEra[era] || atmosphereByEra[1800];
    sky.material.uniforms.uZenith.value.setHex(zenith);
    sky.material.uniforms.uHorizon.value.setHex(horizon);
    sky.material.uniforms.uGround.value.setHex(ground);
    water.material.uniforms.uDeep.value.setHex(deep);
    water.material.uniforms.uShallow.value.setHex(shallow);
    background.setHex(fogColor);
    fog.color.setHex(fogColor);
    lighting.userData.sun.color.setHex(sunColor);
    lighting.userData.sun.intensity = sunIntensity;
  };
  setEra(1800);

  const pickables = [terrain, water];
  const entities = new Set();
  const effects = new Set();
  let elapsedTime = 0;

  const register = (object, { pickable = true } = {}) => {
    group.add(object);
    if (object.userData.selectable) entities.add(object);
    if (pickable && !pickables.includes(object)) pickables.push(object);
    return object;
  };

  const unregister = (object) => {
    group.remove(object);
    entities.delete(object);
    effects.delete(object);
    const index = pickables.indexOf(object);
    if (index >= 0) pickables.splice(index, 1);
    return object;
  };

  const addEffect = (effect) => {
    group.add(effect);
    effects.add(effect);
    return effect;
  };

  const update = (delta = 0, elapsed) => {
    elapsedTime = Number.isFinite(elapsed) ? elapsed : elapsedTime + delta;
    water.material.uniforms.uTime.value = elapsedTime;
    for (const entity of entities) {
      const ring = entity[SELECTION_RING];
      if (!ring?.visible) continue;
      ring.rotation.z += delta * 0.45;
      ring.scale.setScalar(1 + Math.sin(elapsedTime * 4.5) * 0.045);
    }
    for (const effect of effects) {
      effect.update?.(delta);
      if (!effect.done) continue;
      effects.delete(effect);
      group.remove(effect);
      effect.dispose?.();
    }
  };

  const dispose = () => {
    for (const effect of effects) effect.dispose?.();
    effects.clear();
    scene.remove(group);
    disposeObject3D(group);
    surfaceTextures.forEach((texture) => texture.dispose());
    surfaceTextures.clear();
    if (scene.background === background) scene.background = previousBackground;
    if (scene.fog === fog) scene.fog = previousFog;
  };

  return {
    scene,
    group,
    terrain,
    water,
    coast,
    scenery,
    lighting,
    pickables,
    heightAt,
    register,
    unregister,
    addEffect,
    setEra,
    update,
    dispose,
  };
}

export function normalizeEra(era = 1800) {
  if (typeof era === 'number') {
    if (era <= 3) return [1800, 1900, 2000, 2100][clamp(Math.round(era), 0, 3)];
    if (era < 1900) return 1800;
    if (era < 2000) return 1900;
    if (era < 2100) return 2000;
    return 2100;
  }
  const value = String(era).toLowerCase();
  if (value.includes('2100') || value.includes('futur')) return 2100;
  if (value.includes('2000') || value.includes('modern')) return 2000;
  if (value.includes('1900') || value.includes('industrial')) return 1900;
  return 1800;
}

function resolveColor(team, color) {
  if (color?.isColor) return color.clone();
  if (color !== undefined) return new THREE.Color(color);
  if (typeof team === 'number') return new THREE.Color([TEAM_COLORS.player, TEAM_COLORS.enemy, TEAM_COLORS.ally][team] || TEAM_COLORS.neutral);
  return new THREE.Color(TEAM_COLORS[String(team).toLowerCase()] || TEAM_COLORS.neutral);
}

function entityMaterials(team, color, era) {
  const tier = (normalizeEra(era) - 1800) / 100;
  const paintColor = resolveColor(team, color);
  const darkColor = paintColor.clone().multiplyScalar(0.32);
  const wallColors = [0x9a6849, 0x92928a, 0xb5b8b3, 0x303b49];
  const roofColors = [0x463830, 0x3d4448, 0x59656c, 0x111b27];
  const metalMap = surfaceTexture('metal', [2, 2]);
  return {
    paint: new THREE.MeshStandardMaterial({ map: metalMap, color: paintColor, roughness: 0.5, metalness: tier * 0.12 }),
    dark: new THREE.MeshStandardMaterial({ map: metalMap, color: darkColor, roughness: 0.76, metalness: 0.28 }),
    metal: new THREE.MeshStandardMaterial({ map: metalMap, color: tier > 1 ? 0x687580 : 0x4d5251, roughness: 0.45, metalness: 0.72 }),
    wall: new THREE.MeshStandardMaterial({ map: surfaceTexture('wall', [3, 3]), color: wallColors[tier], roughness: tier === 3 ? 0.45 : 0.88, metalness: tier === 3 ? 0.35 : 0.02 }),
    roof: new THREE.MeshStandardMaterial({ map: surfaceTexture('roof', [3, 3]), color: roofColors[tier], roughness: 0.68, metalness: tier * 0.12 }),
    glass: new THREE.MeshStandardMaterial({ color: tier === 3 ? 0x63e9ff : 0x86b9c9, emissive: tier === 3 ? 0x176e88 : 0x08141b, emissiveIntensity: tier === 3 ? 1.7 : 0.35, roughness: 0.16, metalness: 0.2, transparent: true, opacity: 0.82 }),
    accent: new THREE.MeshStandardMaterial({ color: paintColor, emissive: paintColor, emissiveIntensity: tier === 3 ? 1.8 : 0.24, roughness: 0.34, metalness: 0.34 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc79068, roughness: 0.84 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x63432b, roughness: 0.92 }),
  };
}

function setVector(target, value, fallback = [0, 0, 0]) {
  if (value?.isVector3) target.copy(value);
  else target.set(...(Array.isArray(value) ? value : fallback));
}

const outlineGeometries = new WeakMap();
const outlineMaterial = new THREE.LineBasicMaterial({
  color: 0x10171b,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
outlineMaterial.userData.shared = true;

function addPart(root, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { entityPart: true, raycastRole: 'entity' };
  root.add(mesh);
  return mesh;
}

// ponytail: one extra draw per entity; instance outlines if the scale reaches hundreds of units.
function addEntityOutline(root) {
  let largest = null;
  let largestVolume = 0;
  for (const child of root.children) {
    if (!child.isMesh || child.userData.raycastRole !== 'entity') continue;
    const volume = Math.abs(child.scale.x * child.scale.y * child.scale.z);
    if (volume > largestVolume) {
      largest = child;
      largestVolume = volume;
    }
  }
  if (!largest) return;
  let geometry = outlineGeometries.get(largest.geometry);
  if (!geometry) {
    geometry = sharedGeometry(new THREE.EdgesGeometry(largest.geometry, 28));
    outlineGeometries.set(largest.geometry, geometry);
  }
  const outline = new THREE.LineSegments(geometry, outlineMaterial);
  outline.name = 'Readability outline';
  outline.scale.setScalar(1.012);
  outline.renderOrder = 4;
  outline.raycast = () => {};
  outline.userData = { scenery: 'entity-outline', raycastIgnore: true };
  largest.add(outline);
}

function makeEntityRoot(entityType, options, radius) {
  const era = normalizeEra(options.era);
  const team = options.team ?? 'neutral';
  const root = new THREE.Group();
  root.name = options.name || `${entityType}:${options.type}`;
  root.userData = {
    selectable: true,
    entityType,
    type: options.type,
    era,
    team,
    selected: false,
    radius,
  };
  setVector(root.position, options.position);
  root.rotation.y = options.rotation || 0;
  root.scale.setScalar(options.scale ?? 1);

  const shadow = new THREE.Mesh(
    GEO.circle,
    new THREE.MeshBasicMaterial({ color: 0x08100f, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(radius * 1.4, radius * 1.4, 1);
  shadow.position.y = 0.018;
  shadow.userData = { entityPart: true, raycastRole: 'entity-shadow' };
  root.add(shadow);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.92, radius * 1.08, 48),
    new THREE.MeshBasicMaterial({ color: 0xf3d47a, transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  ring.name = 'Selection indicator';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.075;
  ring.visible = false;
  ring.renderOrder = 10;
  ring.userData = { entityPart: true, selectionFx: true };
  root.add(ring);
  root[SELECTION_RING] = ring;
  return root;
}

function addInfantry(root, materials, type, tier) {
  const worker = type === 'trabajador';
  addPart(root, GEO.box, materials.dark, [-0.17, 0.34, 0], [0.17, 0.62, 0.2]);
  addPart(root, GEO.box, materials.dark, [0.17, 0.34, 0], [0.17, 0.62, 0.2]);
  addPart(root, GEO.box, materials.paint, [0, 0.98, 0], [0.58, 0.72, 0.36]);
  addPart(root, GEO.sphere, materials.skin, [0, 1.55, 0], [0.46, 0.5, 0.46]);
  const helmetGeometry = tier === 0 ? GEO.cylinder : GEO.sphere;
  const helmetPosition = tier === 0 && !worker ? [0, 1.84, 0] : [0, 1.75, 0];
  const helmetScale = tier === 0 && !worker ? [0.42, 0.55, 0.42] : [0.52, 0.22, 0.52];
  const helmet = addPart(root, helmetGeometry, materials.dark, helmetPosition, helmetScale);
  helmet.castShadow = true;
  if (tier === 0) {
    addPart(root, GEO.box, worker ? materials.wood : materials.dark, [0, worker ? 1.68 : 1.62, 0.08], [worker ? 0.66 : 0.56, 0.07, 0.5]);
    if (!worker) addPart(root, GEO.cone, materials.accent, [0, 2.24, 0], [0.12, 0.36, 0.12]);
  }
  if (tier >= 2) addPart(root, GEO.box, materials.glass, [0, 1.6, 0.42], [0.36, 0.12, 0.06]);
  if (worker) {
    addPart(root, GEO.cylinder, materials.wood, [0.48, 0.88, 0.12], [0.09, 0.75, 0.09], [0, 0, -0.5]);
    addPart(root, GEO.box, materials.metal, [0.7, 0.58, 0.12], [0.38, 0.1, 0.14], [0, 0, -0.5]);
    addPart(root, GEO.box, materials.wood, [-0.34, 0.93, -0.24], [0.28, 0.42, 0.18], [0, 0.2, 0]);
  } else {
    addPart(root, GEO.cylinder, tier === 0 ? materials.wood : materials.metal, [0.45, 1.02, 0.25], [0.08, 0.86, 0.08], [Math.PI / 2, 0, -0.2]);
    addPart(root, GEO.box, materials.paint, [-0.36, 1.18, 0], [0.22, 0.18, 0.48]);
    addPart(root, GEO.box, materials.paint, [0.36, 1.18, 0], [0.22, 0.18, 0.48]);
    if (tier === 3) addPart(root, GEO.box, materials.accent, [0, 1.1, -0.2], [0.42, 0.2, 0.18]);
  }
}

function addVehicle(root, materials, tier) {
  const bodyY = tier === 3 ? 0.72 : 0.62;
  addPart(root, GEO.box, materials.dark, [0, bodyY, 0], [2.55, 0.58, 1.3]);
  if (tier === 0) {
    addPart(root, GEO.box, materials.paint, [-0.62, 1.16, 0], [0.86, 0.86, 1.14]);
    addPart(root, GEO.cylinder, materials.metal, [0.48, 1.12, 0], [0.46, 1.42, 0.46], [0, 0, Math.PI / 2]);
    addPart(root, GEO.cylinder, materials.dark, [0.72, 1.72, 0], [0.16, 0.82, 0.16]);
    addPart(root, GEO.cone, materials.dark, [0.72, 2.18, 0], [0.28, 0.28, 0.28]);
    for (const z of [-0.7, 0.7]) {
      addPart(root, GEO.wheel, materials.metal, [-0.76, 0.45, z], [0.58, 0.42, 0.58], [Math.PI / 2, 0, 0]);
      addPart(root, GEO.wheel, materials.metal, [0.82, 0.38, z], [0.4, 0.34, 0.4], [Math.PI / 2, 0, 0]);
    }
  } else {
    addPart(root, GEO.box, materials.paint, [-0.36, 1.12, 0], [1.45, 0.68, 1.16]);
    addPart(root, GEO.box, materials.glass, [0.46, 1.22, 0], [0.38, 0.38, 1.18]);
  }
  if (tier > 0 && tier < 3) {
    for (const x of [-0.82, 0.82]) {
      for (const z of [-0.7, 0.7]) addPart(root, GEO.wheel, materials.metal, [x, 0.42, z], [0.44, 0.38, 0.44], [Math.PI / 2, 0, 0]);
    }
  } else if (tier === 3) {
    addPart(root, GEO.box, materials.accent, [-0.75, 0.34, 0], [0.7, 0.12, 1.05]);
    addPart(root, GEO.box, materials.accent, [0.75, 0.34, 0], [0.7, 0.12, 1.05]);
  }
}

function addArtillery(root, materials, tier) {
  addPart(root, GEO.box, tier === 0 ? materials.wood : materials.dark, [0, 0.46, 0], tier === 0 ? [1.7, 0.3, 0.78] : [2.15, 0.42, 1.25]);
  if (tier < 2) {
    for (const z of [-0.72, 0.72]) addPart(root, GEO.wheel, materials.metal, [-0.45, 0.48, z], [0.58, 0.46, 0.58], [Math.PI / 2, 0, 0]);
    if (tier === 0) {
      addPart(root, GEO.box, materials.wood, [-1.28, 0.3, -0.28], [1.45, 0.14, 0.14], [0, 0.08, 0]);
      addPart(root, GEO.box, materials.wood, [-1.28, 0.3, 0.28], [1.45, 0.14, 0.14], [0, -0.08, 0]);
    }
  } else {
    addPart(root, GEO.box, materials.metal, [0, 0.35, -0.72], [2.1, 0.32, 0.28]);
    addPart(root, GEO.box, materials.metal, [0, 0.35, 0.72], [2.1, 0.32, 0.28]);
  }
  addPart(root, GEO.cylinder, materials.paint, [0, 0.88, 0], [0.72, 0.42, 0.72]);
  addPart(root, GEO.cylinder, tier === 3 ? materials.accent : materials.metal, [1.28, 1.05, 0], [0.16, 2.35, 0.16], [0, 0, Math.PI / 2]);
  if (tier >= 2) addPart(root, GEO.box, materials.glass, [-0.28, 1.18, 0], [0.46, 0.25, 0.66]);
}

/** Procedural factory for the gameplay's stable unit types. */
export function createUnit(options = {}) {
  const type = options.type || 'infanteria';
  const era = normalizeEra(options.era);
  const tier = (era - 1800) / 100;
  const radius = type === 'vehiculo' || type === 'artilleria' ? 1.55 : 0.72;
  const root = makeEntityRoot('unit', { ...options, type, era }, radius);
  const materials = entityMaterials(options.team, options.color, era);
  if (type === 'vehiculo') addVehicle(root, materials, tier);
  else if (type === 'artilleria') addArtillery(root, materials, tier);
  else addInfantry(root, materials, type, tier);
  addEntityOutline(root);
  return root;
}

function addWindows(root, materials, width, height, depth, rows = 2) {
  for (let row = 0; row < rows; row += 1) {
    const y = 1.05 + row * ((height - 1.35) / Math.max(rows, 1));
    for (const x of [-width * 0.28, 0, width * 0.28]) {
      addPart(root, GEO.box, materials.glass, [x, y, depth / 2 + 0.025], [width * 0.15, 0.38, 0.055]);
    }
  }
}

function addHistoricRoof(root, materials, width, height, depth) {
  addPart(root, GEO.box, materials.roof, [-width * 0.24, height + 0.26, 0], [width * 0.56, 0.18, depth * 1.08], [0, 0, 0.47]);
  addPart(root, GEO.box, materials.roof, [width * 0.24, height + 0.26, 0], [width * 0.56, 0.18, depth * 1.08], [0, 0, -0.47]);
}

function addIndustrialRoof(root, materials, width, height, depth) {
  const bay = width / 3;
  for (let index = 0; index < 3; index += 1) {
    const x = -width / 2 + bay * (index + 0.5);
    addPart(root, GEO.box, materials.roof, [x - bay * 0.08, height + 0.28, 0], [bay * 0.88, 0.16, depth * 1.06], [0, 0, -0.36]);
    addPart(root, GEO.box, materials.metal, [x + bay * 0.4, height + 0.48, 0], [0.12, 0.62, depth]);
  }
}

function addHistoricFacade(root, materials, width, height, depth, type) {
  const detail = type === 'fabrica' || type === 'laboratorio'
    ? materials.metal
    : type === 'cuartel' ? materials.foundation : materials.wood;
  const front = depth / 2 + 0.065;
  for (const x of [-width * 0.43, width * 0.43]) {
    addPart(root, GEO.box, detail, [x, height * 0.48, front], [0.16, height * 0.78, 0.13]);
  }
  addPart(root, GEO.box, detail, [0, height * 0.8, front], [width * 0.88, 0.14, 0.13]);
}

/** Procedural building factory; footprint remains in userData for placement. */
export function createBuilding(options = {}) {
  const type = options.type || 'centro';
  const era = normalizeEra(options.era);
  const tier = (era - 1800) / 100;
  const profiles = {
    centro: [6.8, 4.6, 5.8],
    vivienda: [4.2, 2.9, 4.1],
    cuartel: [7.2, 3.15, 4.5],
    fabrica: [7.5, 4.2, 5.4],
    laboratorio: [5.6, 4.4, 5.4],
  };
  const [width, height, depth] = profiles[type] || profiles.centro;
  const radius = Math.hypot(width, depth) * 0.52;
  const root = makeEntityRoot('building', { ...options, type, era }, radius);
  root.userData.footprint = { width, depth };
  const materials = entityMaterials(options.team, options.color, era);
  materials.foundation = new THREE.MeshStandardMaterial({ map: surfaceTexture('wall', [3, 3]), color: [0x555048, 0x44484a, 0x4b565d, 0x202a35][tier], roughness: 0.94, metalness: tier * 0.06 });
  const wallTone = { centro: 0x9a6849, vivienda: 0xb28c62, cuartel: 0x687577, fabrica: 0x765040, laboratorio: 0x9ca4a3 }[type] || 0x8d7d6c;
  const roofTone = { centro: 0x463830, vivienda: 0x614633, cuartel: 0x303a3c, fabrica: 0x292724, laboratorio: 0x40525c }[type] || 0x3d4448;
  const surfaceVariation = hash2(seedValue(options.name || type), era, seedValue(type)) - 0.5;
  materials.wall.color.lerp(new THREE.Color(wallTone), 0.48);
  materials.roof.color.lerp(new THREE.Color(roofTone), 0.42);
  materials.wall.color.offsetHSL(surfaceVariation * 0.025, surfaceVariation * 0.035, surfaceVariation * 0.06);
  materials.roof.color.offsetHSL(-surfaceVariation * 0.015, 0, surfaceVariation * 0.04);
  materials.wall.roughness = clamp(materials.wall.roughness + surfaceVariation * 0.14, 0.38, 0.98);
  materials.roof.roughness = clamp(materials.roof.roughness - surfaceVariation * 0.12, 0.4, 0.92);

  addPart(root, GEO.box, materials.foundation, [0, 0.18, 0], [width * 1.08, 0.36, depth * 1.08]);
  addPart(root, GEO.box, materials.wall, [0, height / 2, 0], [width, height, depth]);
  addWindows(root, materials, width, height, depth, type === 'vivienda' ? 1 : 2);

  if (tier === 0) {
    if (type === 'fabrica') addIndustrialRoof(root, materials, width, height, depth);
    else if (type === 'laboratorio') addPart(root, GEO.box, materials.roof, [0, height + 0.16, 0], [width * 1.03, 0.32, depth * 1.03]);
    else addHistoricRoof(root, materials, width, height, depth);
    addHistoricFacade(root, materials, width, height, depth, type);
  } else addPart(root, GEO.box, materials.roof, [0, height + 0.16, 0], [width * 1.03, 0.32, depth * 1.03]);

  if (type === 'centro') {
    addPart(root, tier === 3 ? GEO.cylinder : GEO.box, materials.wall, [0, height + 1.35, 0], [1.65, 2.45, 1.65]);
    addPart(root, GEO.cone, materials.roof, [0, height + 2.8, 0], [1.25, 1.1, 1.25]);
    addPart(root, GEO.cylinder, materials.metal, [0, height + 3.8, 0], [0.08, 1.4, 0.08]);
    addPart(root, GEO.box, materials.accent, [0.45, height + 4.15, 0], [0.9, 0.5, 0.05]);
    if (tier === 0) addPart(root, GEO.cylinder, materials.accent, [0, height + 1.55, 0.86], [0.42, 0.08, 0.42], [Math.PI / 2, 0, 0]);
  } else if (type === 'vivienda') {
    addPart(root, GEO.box, materials.wood, [-width * 0.22, 1.05, depth / 2 + 0.06], [0.85, 1.85, 0.1]);
    addPart(root, GEO.box, materials.roof, [0, 1.72, depth / 2 + 0.48], [2.55, 0.14, 1.05], [0.12, 0, 0]);
    for (const x of [-0.92, 0.92]) addPart(root, GEO.cylinder, materials.wood, [x, 0.82, depth / 2 + 0.72], [0.09, 1.45, 0.09]);
    if (tier === 0) addPart(root, GEO.box, materials.roof, [width * 0.26, height + 0.62, -depth * 0.18], [0.34, 1.25, 0.34]);
    if (tier >= 2) addPart(root, GEO.box, materials.accent, [width * 0.26, height + 0.39, 0], [1.2, 0.1, 1.8]);
  } else if (type === 'cuartel') {
    for (const x of [-width * 0.38, width * 0.38]) {
      addPart(root, GEO.cylinder, materials.wall, [x, height + 1.1, -depth * 0.28], [0.72, 2.2, 0.72]);
      addPart(root, GEO.cone, materials.roof, [x, height + 2.48, -depth * 0.28], [0.92, 0.82, 0.92]);
      addPart(root, GEO.cylinder, materials.accent, [x, height + 1.78, -depth * 0.28], [0.77, 0.16, 0.77]);
    }
    addPart(root, GEO.box, materials.accent, [0, 1.05, depth / 2 + 0.08], [1.65, 1.55, 0.12]);
  } else if (type === 'fabrica') {
    for (const x of [-width * 0.27, width * 0.27]) {
      const chimneyHeight = tier === 0 ? 3.15 : 2.4;
      addPart(root, GEO.cylinder, materials.roof, [x, height + chimneyHeight * 0.55, -depth * 0.24], [tier === 0 ? 0.5 : 0.42, chimneyHeight, tier === 0 ? 0.5 : 0.42]);
      addPart(root, GEO.cylinder, materials.foundation, [x, height + chimneyHeight + 0.08, -depth * 0.24], [tier === 0 ? 0.64 : 0.55, 0.22, tier === 0 ? 0.64 : 0.55]);
    }
    addPart(root, GEO.box, materials.metal, [0, 1.35, depth / 2 + 0.1], [2.35, 2.1, 0.16]);
    if (tier === 0) addPart(root, GEO.cylinder, materials.metal, [width * 0.55, 1.12, 0], [0.62, 1.9, 0.62], [Math.PI / 2, 0, 0]);
  } else if (type === 'laboratorio') {
    addPart(root, GEO.dome, materials.glass, [0, height + 0.12, 0], [3.3, 2.2, 3.3]);
    addPart(root, GEO.cylinder, materials.metal, [0, height + 2.6, 0], [0.12, 2.0, 0.12]);
    addPart(root, GEO.sphere, materials.accent, [0, height + 3.65, 0], [0.38, 0.38, 0.38]);
  }

  if (tier === 3) {
    addPart(root, GEO.box, materials.accent, [0, 0.52, depth / 2 + 0.07], [width * 0.7, 0.09, 0.08]);
    addPart(root, GEO.box, materials.accent, [0, height - 0.45, depth / 2 + 0.07], [width * 0.7, 0.07, 0.08]);
  }
  addEntityOutline(root);
  return root;
}

/** Resolves the selectable root from a Mesh or Raycaster intersection. */
export function findSelectableRoot(target) {
  let object = target?.object || target;
  while (object && !object.userData?.selectable) object = object.parent;
  return object || null;
}

export function setSelected(target, selected = true) {
  const root = findSelectableRoot(target);
  if (!root) return null;
  root.userData.selected = selected;
  if (root[SELECTION_RING]) root[SELECTION_RING].visible = selected;
  return root;
}

/** Self-contained pulse for commands and impacts; world.addEffect manages its lifetime. */
export function createCommandFX(position, color = TEAM_COLORS.player, kind = 'move') {
  const group = new THREE.Group();
  setVector(group.position, position);
  group.name = `FX de orden: ${kind}`;
  group.userData = { effect: true, raycastIgnore: true };
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), material);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 12;
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.28, 2.4, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beacon.position.y = 1.2;
  group.add(ring, beacon);
  if (kind === 'attack') {
    for (const rotation of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.055, 0.1), material);
      bar.position.y = 0.04;
      bar.rotation.y = rotation;
      group.add(bar);
    }
  } else if (kind === 'gather') {
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), material);
    marker.position.y = 0.48;
    marker.rotation.z = Math.PI / 4;
    group.add(marker);
  } else if (kind === 'build') {
    const footprint = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.045, 1.45), material.clone());
    footprint.position.y = 0.03;
    footprint.material.wireframe = true;
    group.add(footprint);
  } else if (kind === 'impact') {
    const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), material);
    flash.position.y = 0.45;
    group.add(flash);
  }
  let age = 0;
  group.done = false;
  group.update = (delta) => {
    age += delta;
    const progress = clamp(age / 0.85, 0, 1);
    ring.scale.setScalar(0.65 + progress * 2.15);
    group.children.forEach((child) => { if (child.isMesh && child !== beacon) child.material.opacity = (1 - progress) * 0.9; });
    beacon.material.opacity = (1 - progress) * 0.35;
    group.rotation.y += delta * (kind === 'attack' ? 2.4 : 0.7);
    group.done = progress >= 1;
  };
  group.dispose = () => disposeObject3D(group);
  return group;
}

export const createImpactFX = createCommandFX;

export function disposeObject3D(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const collectTexture = (value) => {
    if (value?.isTexture && !value.userData.shared) textures.add(value);
    else if (Array.isArray(value)) value.forEach(collectTexture);
  };
  root.traverse((object) => {
    if (object.geometry && !object.geometry.userData.shared) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      Object.values(material).forEach(collectTexture);
      Object.values(material.uniforms ?? {}).forEach((uniform) => collectTexture(uniform?.value));
      if (!material.userData.shared) materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}
