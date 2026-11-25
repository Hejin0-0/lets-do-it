import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uHaze;
uniform vec3 uSunDir;
uniform vec3 uSunTint;
uniform float uNight;
uniform float uOvercast;
uniform float uTime;
varying vec3 vWorldDir;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float cloudFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = p * 2.06 + vec2(7.3, 11.4);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float elev = clamp(dir.y, 0.0, 1.0);
  float horizonBand = pow(1.0 - elev, 2.65);
  vec3 col = mix(uSky, uHaze, horizonBand);

  // Warm atmospheric sun/moon glow band near horizon
  vec3 sunDir = normalize(uSunDir);
  float sunDot = max(dot(dir, sunDir), 0.0);
  float sunGlow = pow(sunDot, 12.0) * 0.44 + pow(sunDot, 190.0) * 1.25;
  float twilight = clamp(1.0 - abs(sunDir.y) * 2.1, 0.0, 1.0);
  col += uSunTint * sunGlow * (0.48 + 0.52 * twilight) * (1.0 - 0.65 * uOvercast);

  // Soft painterly high-altitude coastal clouds
  if (dir.y > 0.02) {
    vec2 cloudUv = dir.xz / (dir.y + 0.24) * 1.45 + vec2(uTime * 0.008, -uTime * 0.005);
    float c = cloudFbm(cloudUv);
    float cov = mix(0.56, 0.34, uOvercast);
    float cloudMask = smoothstep(cov, cov + 0.28, c) * smoothstep(0.02, 0.22, dir.y) * (1.0 - smoothstep(0.65, 0.98, dir.y));
    vec3 cloudDay = mix(uHaze * 1.25 + vec3(0.18), uSunTint * 1.15, pow(sunDot, 4.0) * 0.65);
    vec3 cloudNight = uHaze * 0.85 + vec3(0.04, 0.07, 0.12);
    vec3 cloudCol = mix(cloudDay, cloudNight, uNight);
    col = mix(col, cloudCol, cloudMask * (0.46 + 0.32 * uOvercast));
  }

  // Crisp twinkling starfield on upper hemisphere at night
  if (uNight > 0.14 && dir.y > 0.05 && uOvercast < 0.75) {
    vec3 cell = floor(dir * 185.0);
    float h = hash31(cell);
    if (h > 0.991) {
      float twinkle = 0.62 + 0.38 * sin(uTime * (1.8 + fract(h * 91.7) * 3.2) + h * 60.0);
      float mask = smoothstep(0.05, 0.30, dir.y) * smoothstep(0.14, 0.68, uNight) * (1.0 - uOvercast);
      vec3 starTint = mix(vec3(0.86, 0.92, 1.0), vec3(1.0, 0.92, 0.78), fract(h * 43.1));
      col += starTint * twinkle * mask * 1.05;
    }
  }

  // Soft overcast atmospheric veil when raining/misty
  vec3 overcastCol = mix(vec3(0.42, 0.49, 0.56), vec3(0.06, 0.10, 0.16), uNight);
  col = mix(col, overcastCol, uOvercast * 0.42);

  gl_FragColor = vec4(col, 1.0);
}
`;

const OCEAN_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float w1 = sin(wp.x * 0.12 + wp.z * 0.04 + uTime * 0.92) * 0.15;
  float w2 = cos(wp.z * 0.16 - wp.x * 0.05 - uTime * 0.74) * 0.13;
  float w3 = sin((wp.x * 0.09 - wp.z * 0.11) + uTime * 1.24) * 0.08;
  wp.y += w1 + w2 + w3;

  float dx = 0.12 * cos(wp.x * 0.12 + wp.z * 0.04 + uTime * 0.92) * 0.15
           + 0.05 * sin(wp.z * 0.16 - wp.x * 0.05 - uTime * 0.74) * 0.13
           + 0.09 * cos((wp.x * 0.09 - wp.z * 0.11) + uTime * 1.24) * 0.08;
  float dz = 0.04 * cos(wp.x * 0.12 + wp.z * 0.04 + uTime * 0.92) * 0.15
           - 0.16 * sin(wp.z * 0.16 - wp.x * 0.05 - uTime * 0.74) * 0.13
           - 0.11 * cos((wp.x * 0.09 - wp.z * 0.11) + uTime * 1.24) * 0.08;
  vNormalW = normalize(vec3(-dx, 1.0, -dz));
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const OCEAN_FRAG = /* glsl */ `
uniform vec3 uSea;
uniform vec3 uShallow;
uniform vec3 uHaze;
uniform vec3 uSunDir;
uniform vec3 uSunTint;
uniform float uNight;
uniform float uOvercast;
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormalW;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Signed approximate distance to the rectangular+lower-terrace coastal basalt island footprint
float islandFootprintDist(vec2 xz) {
  // Upper estate: x in [-18.5, 17.5], z in [-13.0, 7.4]; Lower terrace: x in [-14.8, 14.8], z in [7.4, 19.5]
  vec2 qUp = abs(xz - vec2(-0.5, -2.8)) - vec2(18.6, 10.6);
  float dUp = length(max(qUp, 0.0)) + min(max(qUp.x, qUp.y), 0.0);
  vec2 qLo = abs(xz - vec2(0.0, 13.4)) - vec2(15.2, 6.4);
  float dLo = length(max(qLo, 0.0)) + min(max(qLo.x, qLo.y), 0.0);
  // Smooth-min union of upper and lower cliff footprint
  float h = clamp(0.5 + 0.5 * (dLo - dUp) / 2.2, 0.0, 1.0);
  return mix(dLo, dUp, h) - 2.2 * h * (1.0 - h);
}

void main() {
  vec2 xz = vWorldPos.xz;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 N = normalize(vNormalW);

  // Multi-octave capillary micro-waves for sparkling realistic ocean surface
  float n1 = noise2(xz * 0.42 + vec2(uTime * 0.48, -uTime * 0.34));
  float n2 = noise2(xz * 1.15 - vec2(uTime * 0.62, uTime * 0.51));
  float n3 = sin(xz.x * 0.65 + xz.y * 0.38 + uTime * 1.85) * 0.5 + 0.5;
  vec2 micro = vec2(
    (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.09 + (n3 - 0.5) * 0.05,
    (n2 - 0.5) * 0.14 - (n1 - 0.5) * 0.09
  );
  N = normalize(N + vec3(micro.x, 0.0, micro.y));

  // Crisp signed distance from actual basalt cliff shoreline (no giant blurry pale ring!)
  float shoreD = islandFootprintDist(xz);
  float rockJitter = (noise2(xz * 0.28) - 0.5) * 1.4;
  float sd = shoreD + rockJitter;

  // Deep-to-coastal shallow emerald transition close to cliff (kept subtle so masonry corners frame cleanly)
  float shallowBand = 1.0 - smoothstep(0.0, 11.0, max(0.0, sd));
  vec3 waterCol = mix(uSea, uShallow, shallowBand * 0.44);

  // Subtle translucent turquoise wave-crest subsurface tint
  float crest = smoothstep(0.08, 0.34, vWorldPos.y + 4.15);
  waterCol += uShallow * crest * (0.22 - 0.12 * uNight);

  // Schlick Fresnel sky & horizon reflection
  float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.2);
  vec3 reflCol = mix(uHaze * (0.92 - 0.18 * uNight), uSea * 1.25, 0.18);
  waterCol = mix(waterCol, reflCol, clamp(fresnel * 0.74, 0.05, 0.78));

  // Sparkling sun / moon glitter path across capillary ripples
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float specTight = pow(max(dot(N, H), 0.0), 220.0) * 1.9;
  float specWide = pow(max(dot(N, H), 0.0), 34.0) * 0.24;
  waterCol += uSunTint * (specTight + specWide) * (1.0 - 0.38 * uNight) * (1.0 - 0.72 * uOvercast);

  // Tight, delicate lacy coastal surf foam hugging close to the dark basalt waterline
  float foamNoise = noise2(xz * 1.85 + vec2(uTime * 0.32, -uTime * 0.26)) * 0.60
                  + noise2(xz * 4.6 - vec2(uTime * 0.52, uTime * 0.44)) * 0.40;
  float waveBand1 = sin(sd * 3.4 - uTime * 2.15) * 0.5 + 0.5;
  float tightEdge = (1.0 - smoothstep(-0.15, 1.45, sd)) * smoothstep(-1.0, 0.10, sd);
  float lacyFoam = smoothstep(0.54, 0.84, foamNoise + tightEdge * 0.36 + waveBand1 * 0.16) * tightEdge;
  vec3 foamCol = mix(vec3(0.76, 0.86, 0.90), uHaze * 1.12 + vec3(0.10), 0.45 + 0.35 * uNight);
  waterCol = mix(waterCol, foamCol, clamp(lacyFoam * 0.46, 0.0, 0.46));

  // Warm pier lantern reflection shimmer right under the handcrafted coastal pier (x ~ -2.6, z ~ 22.4)
  vec2 pierLampXZ = vec2(-2.62, 22.42);
  float pierDist = length(xz - pierLampXZ);
  float pierShimmer = exp(-pierDist * 0.32) * (0.45 + 0.55 * n2) * (0.35 + 0.75 * uNight);
  waterCol += vec3(1.0, 0.68, 0.28) * pierShimmer * 0.42;

  // Atmospheric distance perspective into coastal mist horizon
  float camDist = length(xz - cameraPosition.xz);
  float fogStart = mix(72.0, 42.0, uOvercast);
  float fogEnd = mix(310.0, 195.0, uOvercast);
  float fogF = smoothstep(fogStart, fogEnd, camDist);
  waterCol = mix(waterCol, uHaze, fogF);

  gl_FragColor = vec4(waterCol, 1.0);
}
`;

function setLinearRgb(target, rgb) {
  target.setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);
}

/**
 * Deterministic volcanic basalt cliff skirt hugging the exact upper + lower sanctuary
 * terraces, sculpted with craggy coastal rock strata and wet waterline shading.
 * Kept strictly below Y = -2.35 underneath Lower Grotto so grotto water (-2.18) stays clean!
 */
function buildBasaltCliffIsland() {
  const segsR = 96;
  const segsH = 10;
  // Open-ended perimeter cliff skirt ONLY (no top cap!) so Lower Grotto (-2.18) and Upper Pool (-1.10) stay 100% unobstructed.
  const geo = new THREE.CylinderGeometry(1.0, 1.0, 4.4, segsR, segsH, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cTopDry = new THREE.Color(0x363b40);
  const cMidMoss = new THREE.Color(0x283633);
  const cWetDark = new THREE.Color(0x161c20);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const ang = Math.atan2(vz, vx);
    // Clamp strictly to [0, 1] to prevent Float32 negative epsilon -> Math.pow NaN
    const u = THREE.MathUtils.clamp((vy + 2.2) / 4.4, 0.0, 1.0);

    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    // Smoothly transition cliff footprint from wide Upper Terrace (north) to Lower Terrace (south) without corner undercuts
    const southFrac = THREE.MathUtils.smoothstep(sa, -0.15, 0.45);
    const rxBase = THREE.MathUtils.lerp(18.85, 15.65, southFrac);
    const rzBase = THREE.MathUtils.lerp(15.6, 16.4, southFrac);
    const p = 3.2;
    const normTerm = Math.pow(Math.abs(ca / rxBase), p) + Math.pow(Math.abs(sa / rzBase), p);
    const superR = 1.0 / Math.pow(Math.max(1e-6, normTerm), 1.0 / p);

    // Organic craggy rock strata flare toward sea floor
    const crag =
      Math.sin(ang * 7.0 + u * 2.6) * 0.72 +
      Math.cos(ang * 13.0 - u * 4.2) * 0.44 +
      Math.sin(ang * 23.0 + u * 6.5) * 0.22;
    const flare = THREE.MathUtils.lerp(1.18, 0.99, Math.pow(u, 0.72));
    const ledge = Math.sin(u * Math.PI * 5.0) * 0.26 * (1.0 - u * 0.5);

    const rFinal = superR * flare + crag * (1.0 - u * 0.35) + ledge;
    const x = ca * rFinal - 0.45;
    const z = sa * rFinal + 2.6;
    // Tuck top rim cleanly underneath the masonry slabs (Upper Terrace slab bottom -2.20, Lower Terrace bottom -3.25)
    const southBlend = THREE.MathUtils.smoothstep(z, 6.2, 8.8);
    const maxTopY = THREE.MathUtils.lerp(-1.15, -3.12, southBlend);
    const y = THREE.MathUtils.lerp(-6.50, maxTopY, u);

    pos.setXYZ(i, x, y, z);

    const wetMask = 1.0 - THREE.MathUtils.smoothstep(y, -4.45, -3.45);
    const mossMask = THREE.MathUtils.smoothstep(Math.sin(ang * 9.0 + u * 3.0), 0.15, 0.85) * (1.0 - wetMask) * 0.65;
    tmpCol.copy(cTopDry).lerp(cMidMoss, mossMask).lerp(cWetDark, wetMask);
    const strataShade = 0.88 + 0.20 * Math.sin(y * 3.8 + ang * 4.0);
    colors[i * 3] = tmpCol.r * strataShade;
    colors[i * 3 + 1] = tmpCol.g * strataShade;
    colors[i * 3 + 2] = tmpCol.b * strataShade;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SanctuaryCliffPedestal';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return { mesh, geo, mat };
}

/**
 * Distant misty coastal headlands + tiny pulsing lighthouse beacon far across the bay.
 * Single merged ring geometry (1 draw call) + 1 glowing beacon sprite/sphere!
 */
function buildDistantHorizonHeadlands() {
  const segs = 128;
  const radius = 248;
  const geo = new THREE.CylinderGeometry(radius, radius, 1.0, segs, 1, true);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i); // -0.5 or +0.5
    const vz = pos.getZ(i);
    const ang = Math.atan2(vz, vx);
    if (vy > 0) {
      const m1 = Math.max(0, Math.sin(ang * 2.0 + 0.6)) * 16.5;
      const m2 = Math.max(0, Math.cos(ang * 3.0 - 1.1)) * 10.5;
      const m3 = Math.max(0, Math.sin(ang * 5.0 + 2.2)) * 4.8;
      const ridge = (Math.sin(ang * 11.0) * 2.1 + Math.cos(ang * 19.0) * 1.1) * (m1 + m2 + m3 > 2 ? 1.0 : 0.0);
      const h = Math.max(0.1, m1 + m2 + m3 + ridge);
      pos.setY(i, -4.35 + h);
    } else {
      pos.setY(i, -4.45);
    }
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color: 0x162436,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SanctuaryHorizonHeadlands';
  mesh.renderOrder = -4;

  const beaconGeo = new THREE.SphereGeometry(0.95, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.name = 'SanctuaryDistantLighthouse';
  beaconMesh.position.set(-146, 5.2, 198);

  return { mesh, geo, mat, beaconMesh, beaconGeo, beaconMat };
}

/**
 * Stylized coastal ocean, sculpted basalt sea-cliff, distant misty headlands & 24h sky dome
 * synced directly to src/pool/daylight.js and weather overcast state.
 */
export function createOceanBackdrop(scene) {
  const group = new THREE.Group();
  group.name = 'SanctuaryOceanBackdrop';

  const skyUniforms = {
    uSky: { value: new THREE.Color(0x0b1628) },
    uHaze: { value: new THREE.Color(0x1f3652) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.3, -0.7).normalize() },
    uSunTint: { value: new THREE.Color(0xffb570) },
    uNight: { value: 0.4 },
    uOvercast: { value: 0.0 },
    uTime: { value: 0 },
  };
  const skyGeo = new THREE.SphereGeometry(390, 36, 22);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'SanctuarySkyDome';
  skyMesh.renderOrder = -10;
  group.add(skyMesh);

  const oceanUniforms = {
    uSea: { value: new THREE.Color(0x0c344c) },
    uShallow: { value: new THREE.Color(0x1e6b6e) },
    uHaze: { value: new THREE.Color(0x1f3652) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.3, -0.7).normalize() },
    uSunTint: { value: new THREE.Color(0xffb570) },
    uNight: { value: 0.4 },
    uOvercast: { value: 0.0 },
    uTime: { value: 0 },
  };
  const oceanGeo = new THREE.PlaneGeometry(740, 740, 112, 112);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    fog: false,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.name = 'SanctuaryCoastalOcean';
  oceanMesh.position.set(0, -4.15, 0);
  oceanMesh.renderOrder = -5;
  group.add(oceanMesh);

  const cliff = buildBasaltCliffIsland();
  group.add(cliff.mesh);

  const headlands = buildDistantHorizonHeadlands();
  group.add(headlands.mesh);
  group.add(headlands.beaconMesh);

  scene.add(group);

  const _hazeCol = new THREE.Color();
  const _deepCol = new THREE.Color(0x0b1524);

  function update(t, dl, overcast = 0.0) {
    skyUniforms.uTime.value = t;
    oceanUniforms.uTime.value = t;
    skyUniforms.uOvercast.value = overcast;
    oceanUniforms.uOvercast.value = overcast;

    // Gentle 4.5s rotating lighthouse pulse across the twilight/night bay
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 1.4), 6.0);
    headlands.beaconMesh.scale.setScalar(0.55 + 1.15 * pulse);
    if (!dl) return;

    setLinearRgb(skyUniforms.uSky.value, dl.sky);
    setLinearRgb(skyUniforms.uHaze.value, dl.haze);
    setLinearRgb(skyUniforms.uSunTint.value, dl.tint);
    skyUniforms.uSunDir.value.set(dl.dir[0], Math.max(0.03, dl.dir[1]), dl.dir[2]).normalize();
    skyUniforms.uNight.value = dl.night;

    setLinearRgb(oceanUniforms.uSea.value, dl.sea);
    setLinearRgb(oceanUniforms.uShallow.value, dl.shallow);
    setLinearRgb(oceanUniforms.uHaze.value, dl.haze);
    setLinearRgb(oceanUniforms.uSunTint.value, dl.tint);
    oceanUniforms.uSunDir.value.copy(skyUniforms.uSunDir.value);
    oceanUniforms.uNight.value = dl.night;

    _hazeCol.copy(skyUniforms.uHaze.value);
    headlands.mat.color.copy(_hazeCol).lerp(_deepCol, 0.55 + 0.25 * dl.night);
    headlands.mat.opacity = THREE.MathUtils.lerp(0.56, 0.78, dl.night) * (1.0 - 0.35 * overcast);
    headlands.beaconMesh.visible = dl.night > 0.22;
  }

  function dispose() {
    skyGeo.dispose();
    skyMat.dispose();
    oceanGeo.dispose();
    oceanMat.dispose();
    cliff.geo.dispose();
    cliff.mat.dispose();
    headlands.geo.dispose();
    headlands.mat.dispose();
    headlands.beaconGeo.dispose();
    headlands.beaconMat.dispose();
    scene.remove(group);
  }

  return { group, skyMesh, oceanMesh, cliffMesh: cliff.mesh, update, dispose };
}
