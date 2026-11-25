import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const INK_OUTLINE_HEX = 0x38261b;
export const STICKER_OUTLINE_HEX = 0xffffff;

const SKIP_STYLIZE_PATTERNS = [
  'book_dynamic',
  'book_flip',
  'book_postit',
  'book_tab',
  'watercolor_canvas',
  'water',
  'glass',
  'smoke',
  'glow',
  'uw_led',
  'chochin',
  'festoon',
  'edison',
  'ashground',
  'charred_log',
  'coal',
  'split_firewood',
  'hearth_',
  'kamachi',
  'eye',
];

const HERO_OUTLINE_NODES = [
  'L05_Pool_Toys_Inflatables_Lanterns',
  'L04_Copper_Aqueduct_Slide',
  'L05_Terracotta_Pots_Trunks',
  'L05_Sanctuary_Vignette_Props',
  'L03_Onsen_Hinoki_Carpentry',
  'L03_Onsen_Kawara_Roof',
  'UI_Station_WatercolorAtelier',
  'L06_Coastal_Pier_Deck',
  'L06_Coastal_Pier_Lantern',
];

let sharedInkOutlineMat = null;
let sharedArchOutlineMat = null;
let sharedStickerMat = null;
let sharedCheekGeo = null;
let sharedCheekMat = null;
let sharedMoleGeo = null;
let sharedMoleMat = null;

function createOutlineShaderMaterial(hex, thickness, { shakeable = false, opacity = 1.0 } = {}) {
  return new THREE.ShaderMaterial({
    name: shakeable ? 'M_Sticker_Outline' : 'M_Gouache_Ink_Outline',
    side: THREE.BackSide,
    transparent: opacity < 0.99,
    depthWrite: true,
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uThickness: { value: thickness },
      uOpacity: { value: opacity },
      uShake: { value: 0.0 },
      uTime: { value: 0.0 },
    },
    vertexShader: `
      uniform float uThickness;
      uniform float uShake;
      uniform float uTime;
      void main() {
        vec3 n = normalize(normal);
        float jitter = uShake * 0.022 * sin(uTime * 54.0 + position.y * 19.0 + position.x * 13.0);
        vec3 displaced = position + n * (uThickness + jitter);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
  });
}

function getDuckInkMat() {
  if (!sharedInkOutlineMat) {
    // Duck local coordinates are pre-0.38 scale, so 0.036 local ~= 0.0137 m crisp dark-brown ink line.
    sharedInkOutlineMat = createOutlineShaderMaterial(INK_OUTLINE_HEX, 0.036);
  }
  return sharedInkOutlineMat;
}

function getArchInkMat() {
  if (!sharedArchOutlineMat) {
    sharedArchOutlineMat = createOutlineShaderMaterial(INK_OUTLINE_HEX, 0.016);
  }
  return sharedArchOutlineMat;
}

function getStickerOutlineMat() {
  if (!sharedStickerMat) {
    sharedStickerMat = createOutlineShaderMaterial(STICKER_OUTLINE_HEX, 0.048, { shakeable: true });
  }
  return sharedStickerMat;
}

function getCheekBlushAssets() {
  if (!sharedCheekGeo) {
    const left = new THREE.SphereGeometry(0.056, 10, 8);
    left.scale(1.18, 0.62, 0.34);
    left.translate(-0.178, 0.695, 0.214);
    const right = new THREE.SphereGeometry(0.056, 10, 8);
    right.scale(1.18, 0.62, 0.34);
    right.translate(0.178, 0.695, 0.214);
    const gL = left.index ? left.toNonIndexed() : left;
    const gR = right.index ? right.toNonIndexed() : right;
    sharedCheekGeo = mergeGeometries([gL, gR], false);
    left.dispose();
    right.dispose();
    if (gL !== left) gL.dispose();
    if (gR !== right) gR.dispose();
  }
  if (!sharedCheekMat) {
    sharedCheekMat = new THREE.MeshBasicMaterial({
      name: 'M_Duck_Cheek_Blush',
      color: 0xff7c86,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
  }
  return { geo: sharedCheekGeo, mat: sharedCheekMat };
}

function getBeautyMarkAssets() {
  if (!sharedMoleGeo) {
    // Classic Duck #01's single intentional 0.9mm-scale dark espresso beauty mark under its left cheek.
    sharedMoleGeo = new THREE.SphereGeometry(0.019, 8, 6);
    sharedMoleGeo.scale(1.0, 0.92, 0.55);
  }
  if (!sharedMoleMat) {
    sharedMoleMat = new THREE.MeshBasicMaterial({
      name: 'M_Classic_BeautyMark',
      color: 0x26150e,
    });
  }
  return { geo: sharedMoleGeo, mat: sharedMoleMat };
}

function shouldSkipStylize(meshName, mat) {
  if (!mat || !mat.isMeshStandardMaterial) return true;
  if (mat.transparent && mat.opacity < 0.95) return true;
  const key = `${meshName || ''} ${mat.name || ''}`.toLowerCase();
  for (let i = 0; i < SKIP_STYLIZE_PATTERNS.length; i++) {
    if (key.includes(SKIP_STYLIZE_PATTERNS[i])) return true;
  }
  return false;
}

export function patchGouacheMaterial(mat, { strength = 0.72, rim = 0.36, specPop = 0.0, moss = 0.0, warmShadow = false } = {}) {
  if (!mat || !mat.isMeshStandardMaterial || mat.userData.gouacheStylized) return false;
  mat.userData.gouacheStylized = true;
  mat.userData.gouacheParams = { strength, rim, specPop, moss, warmShadow };

  // Monograph Ch. 08 Lookdev Spheres: Soft Vinyl 0.55, Painted Hinoki Wood 0.78, Mossy Stone 0.88
  if (typeof mat.roughness === 'number') {
    mat.roughness = Math.max(mat.roughness, specPop > 0 ? 0.55 : moss > 0 ? 0.86 : 0.68);
  }
  if (typeof mat.metalness === 'number' && mat.metalness < 0.75) {
    mat.metalness = mat.metalness * 0.30;
  }

  const prevCompile = mat.onBeforeCompile;
  mat.customProgramCacheKey = () =>
    `suanbo-gouache-v2-${Math.round(strength * 10)}-${Math.round(rim * 10)}-${Math.round(specPop * 10)}-${Math.round(moss * 10)}-${warmShadow ? 1 : 0}`;
  mat.onBeforeCompile = (shader, renderer) => {
    if (typeof prevCompile === 'function') prevCompile(shader, renderer);
    shader.uniforms.uGouacheStrength = { value: strength };
    shader.uniforms.uGouacheRim = { value: rim };
    shader.uniforms.uGouacheSpec = { value: specPop };
    shader.uniforms.uMossAmount = { value: moss };
    shader.uniforms.uShadowTint = {
      value: warmShadow ? new THREE.Color(0.92, 0.72, 0.62) : new THREE.Color(0.64, 0.78, 0.96),
    };

    if (moss > 0.01) {
      shader.vertexShader =
        `varying vec3 vGouacheWorldNormal;\nvarying vec3 vGouacheWorldPos;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vGouacheWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vGouacheWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      shader.fragmentShader =
        `varying vec3 vGouacheWorldNormal;\nvarying vec3 vGouacheWorldPos;\n` + shader.fragmentShader;
    }

    shader.fragmentShader =
      `uniform float uGouacheStrength;\nuniform float uGouacheRim;\nuniform float uGouacheSpec;\nuniform float uMossAmount;\nuniform vec3 uShadowTint;\n` +
      shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
      `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      {
        vec3 baseAlb = diffuseColor.rgb;
        ${moss > 0.01 ? `
        float gUp = smoothstep(0.64, 0.88, normalize(vGouacheWorldNormal).y);
        float gPatch = 0.5 + 0.5 * sin(vGouacheWorldPos.x * 2.1 + cos(vGouacheWorldPos.z * 2.4)) * cos(vGouacheWorldPos.z * 1.9 - vGouacheWorldPos.x * 1.3);
        float gMossMask = gUp * smoothstep(0.32, 0.72, gPatch) * uMossAmount;
        vec3 gMossCol = mix(vec3(0.267, 0.384, 0.200), vec3(0.494, 0.627, 0.302), gPatch);
        baseAlb = mix(baseAlb, gMossCol, gMossMask);
        ` : ''}
        float gAlbLum = max(0.06, dot(baseAlb, vec3(0.299, 0.587, 0.114)));
        float gLight = dot(totalDiffuse, vec3(0.299, 0.587, 0.114)) / max(0.06, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
        float gB1 = smoothstep(0.16, 0.28, gLight);
        float gB2 = smoothstep(0.56, 0.72, gLight);
        float gB3 = smoothstep(1.08, 1.28, gLight);
        float gCel = (0.18 + gB1 * 0.30 + gB2 * 0.34 + gB3 * 0.26) * clamp(0.68 + gLight * 0.42, 0.62, 1.32);
        vec3 gShadowShift = mix(uShadowTint, vec3(1.04, 1.00, 0.94), gB1);
        vec3 gSat = mix(vec3(gAlbLum), baseAlb, 1.18);
        float gRim = pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.8);
        vec3 gRimCol = gSat * vec3(1.20, 0.96, 0.68) * gRim * uGouacheRim;
        vec3 gHue = totalDiffuse / max(0.001, dot(totalDiffuse, vec3(0.299, 0.587, 0.114)));
        gHue = mix(vec3(1.0), clamp(gHue, 0.45, 1.65), 0.74);
        vec3 gOut = gSat * gHue * gCel * gShadowShift + gRimCol;
        totalDiffuse = mix(totalDiffuse, gOut, uGouacheStrength);
      }`
    );

    if (specPop > 0.01) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',
        `vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
        {
          float gSpLum = dot(totalSpecular, vec3(0.299, 0.587, 0.114));
          float gSpBand = smoothstep(0.10, 0.18, gSpLum);
          totalSpecular = mix(totalSpecular, vec3(1.0, 0.97, 0.88) * (0.28 * gSpBand), uGouacheSpec);
        }`
      );
    }
  };
  mat.needsUpdate = true;
  return true;
}

function attachHeroPropOutline(mesh) {
  if (!mesh || !mesh.isMesh || !mesh.geometry) return null;
  if (mesh.userData.hasInkOutline) return null;
  const outline = new THREE.Mesh(mesh.geometry, getArchInkMat());
  outline.name = `${mesh.name}_InkOutline`;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.raycast = () => {};
  mesh.add(outline);
  mesh.userData.hasInkOutline = true;
  return outline;
}

export function stylizeSanctuaryRoot(root, { attachOutlines = true } = {}) {
  let stylizedCount = 0;
  let outlineCount = 0;

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (obj.name.endsWith('_InkOutline') || obj.name.endsWith('_StickerOutline')) return;

    const isDuckMesh = obj.name.includes('DuckBody') || obj.name.includes('DuckBeak') || obj.name.startsWith('TrophyDuck_');
    const isEyeCatchlight = obj.material.name && obj.material.name.includes('DuckEyeCatchlight');
    if (isEyeCatchlight) {
      obj.material.emissive?.setHex(0xffffff);
      obj.material.emissiveIntensity = 1.35;
      obj.material.color?.setHex(0xffffff);
      obj.material.roughness = 0.08;
      obj.material.needsUpdate = true;
      return;
    }

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (shouldSkipStylize(obj.name, m)) continue;
      const mn = (m.name || '').toLowerCase();
      const isToy = mn.includes('vinyl') || isDuckMesh || mn.includes('terracotta');
      const isStone = mn.includes('basalt') || mn.includes('stone_coping');
      const isWood = mn.includes('hinoki') || mn.includes('wood') || mn.includes('tatami') || mn.includes('bark') || mn.includes('brick');
      const ok = patchGouacheMaterial(m, {
        strength: isDuckMesh ? 0.86 : isToy ? 0.80 : 0.66,
        rim: isDuckMesh ? 0.56 : isToy ? 0.44 : 0.24,
        specPop: isDuckMesh || mn.includes('vinyl') ? 0.52 : 0.0,
        moss: isStone ? 0.68 : 0.0,
        warmShadow: isWood || isDuckMesh,
      });
      if (ok) stylizedCount += 1;
    }

    if (attachOutlines) {
      let matchesHero = false;
      let cur = obj;
      while (cur) {
        if (cur.name && HERO_OUTLINE_NODES.some((p) => cur.name === p || cur.name.startsWith(p))) {
          matchesHero = true;
          break;
        }
        cur = cur.parent;
      }
      if (matchesHero && !shouldSkipStylize(obj.name, Array.isArray(obj.material) ? obj.material[0] : obj.material)) {
        if (attachHeroPropOutline(obj)) outlineCount += 1;
      }
    }
  });

  return { stylizedCount, outlineCount };
}

export function attachCartoonDuckFeatures(duckRoot, designId = '01-classic') {
  if (!duckRoot) return null;
  if (duckRoot.userData.cartoonRig) return duckRoot.userData.cartoonRig;

  let bodyMesh = null;
  let eyeL = null;
  let eyeR = null;

  duckRoot.traverse((ch) => {
    if (!ch.isMesh) return;
    const nm = ch.name || '';
    if (nm.includes('DuckBody') && !bodyMesh) bodyMesh = ch;
    else if (nm.includes('DuckEye_L')) eyeL = ch;
    else if (nm.includes('DuckEye_R')) eyeR = ch;

    const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m) continue;
      if ((m.name || '').includes('DuckEyeCatchlight')) {
        m.emissive?.setHex(0xffffff);
        m.emissiveIntensity = 1.45;
        m.color?.setHex(0xffffff);
        m.needsUpdate = true;
      } else if (!shouldSkipStylize(nm, m)) {
        patchGouacheMaterial(m, { strength: 0.86, rim: 0.58, specPop: 0.56 });
      }
    }
  });

  let inkOutline = null;
  let stickerOutline = null;
  if (bodyMesh && bodyMesh.geometry) {
    inkOutline = new THREE.Mesh(bodyMesh.geometry, getDuckInkMat());
    inkOutline.name = `${duckRoot.name}_InkOutline`;
    inkOutline.castShadow = false;
    inkOutline.receiveShadow = false;
    inkOutline.raycast = () => {};
    bodyMesh.add(inkOutline);

    // Individual sticker material clone only needed for squeeze-shake intensity; keep uniform shared until active
    stickerOutline = new THREE.Mesh(bodyMesh.geometry, getStickerOutlineMat().clone());
    stickerOutline.name = `${duckRoot.name}_StickerOutline`;
    stickerOutline.visible = false;
    stickerOutline.castShadow = false;
    stickerOutline.receiveShadow = false;
    stickerOutline.raycast = () => {};
    bodyMesh.add(stickerOutline);
  }

  const { geo: cheekGeo, mat: cheekMat } = getCheekBlushAssets();
  const cheeks = new THREE.Mesh(cheekGeo, cheekMat);
  cheeks.name = 'DuckCheekBlush';
  cheeks.castShadow = false;
  cheeks.receiveShadow = false;
  cheeks.raycast = () => {};
  duckRoot.add(cheeks);

  let beautyMark = null;
  if (designId === '01-classic') {
    const { geo: moleGeo, mat: moleMat } = getBeautyMarkAssets();
    beautyMark = new THREE.Mesh(moleGeo, moleMat);
    beautyMark.name = 'DuckBeautyMark';
    beautyMark.position.set(-0.194, 0.674, 0.222);
    beautyMark.castShadow = false;
    beautyMark.receiveShadow = false;
    beautyMark.raycast = () => {};
    duckRoot.add(beautyMark);
  }

  const rig = {
    bodyMesh,
    eyeL,
    eyeR,
    eyeLBaseScaleY: eyeL ? eyeL.scale.y : 1,
    eyeRBaseScaleY: eyeR ? eyeR.scale.y : 1,
    inkOutline,
    stickerOutline,
    cheeks,
    beautyMark,
    stickerActive: false,
  };
  duckRoot.userData.cartoonRig = rig;
  return rig;
}

export function setDuckStickerHighlight(rig, active, shake = 0) {
  if (!rig || !rig.stickerOutline) return;
  rig.stickerActive = Boolean(active);
  rig.stickerOutline.visible = rig.stickerActive;
  if (rig.stickerOutline.material?.uniforms?.uShake) {
    rig.stickerOutline.material.uniforms.uShake.value = shake;
  }
}

export function updateCartoonDuckRig(rig, {
  time = 0,
  phase = 0,
  syncBlink = false,
  eyelidSquint = 0,
  squeezePressure = 0,
  happyEyes = false,
  sleepingEyes = false,
} = {}) {
  if (!rig) return;
  if (rig.stickerOutline?.visible && rig.stickerOutline.material?.uniforms) {
    rig.stickerOutline.material.uniforms.uTime.value = time;
    rig.stickerOutline.material.uniforms.uShake.value = squeezePressure;
  }
  if (!rig.eyeL || !rig.eyeR) return;

  // Deterministic staggered natural Disney blink (~0.09s every 4.6s) OR exact 0.05s synchronized blink!
  const cycle = (time + phase * 1.37) % 4.6;
  const naturalBlink = cycle < 0.09 ? 1.0 : 0.0;
  const blinkFactor = syncBlink ? 1.0 : naturalBlink;
  const squintFactor = Math.max(eyelidSquint, squeezePressure * 0.72);
  let scaleY = blinkFactor > 0.5 ? 0.12 : Math.max(0.28, 1.0 - squintFactor * 0.68);
  if (sleepingEyes) scaleY = 0.14;
  else if (happyEyes) scaleY = 0.42;
  rig.eyeL.scale.y = rig.eyeLBaseScaleY * scaleY;
  rig.eyeR.scale.y = rig.eyeRBaseScaleY * scaleY;
}

/**
 * Single-draw-call diagonal volumetric afternoon/morning sunbeam shafts (Monograph Ch. 05 God Rays).
 */
export function createVolumetricSunbeams(scene) {
  const parts = [];
  const shafts = [
    { pos: [-1.5, 4.4, -2.0], rotZ: -0.44, rotY: 0.18, w: 2.8, h: 9.2 },
    { pos: [3.2, 4.7, -2.5],  rotZ: -0.44, rotY: 0.14, w: 3.4, h: 9.8 },
    { pos: [7.8, 4.3, -1.6],  rotZ: -0.44, rotY: 0.10, w: 2.5, h: 8.8 },
  ];
  for (const s of shafts) {
    const g = new THREE.PlaneGeometry(s.w, s.h, 1, 1);
    g.rotateZ(s.rotZ);
    g.rotateY(s.rotY);
    g.translate(s.pos[0], s.pos[1], s.pos[2]);
    const ni = g.index ? g.toNonIndexed() : g;
    parts.push(ni);
    if (ni !== g) g.dispose();
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  const mat = new THREE.ShaderMaterial({
    name: 'M_Monograph_GodRays',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uStrength: { value: 0.0 },
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Color(0xffe4a8) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uStrength;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float across = sin(vUv.x * 3.14159265);
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        float shimmer = 0.85 + 0.15 * sin(vUv.x * 18.0 + uTime * 0.45);
        float a = across * across * along * shimmer * uStrength * 0.18;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'Monograph_Volumetric_Sunbeams';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  scene.add(mesh);

  return {
    mesh,
    update(time, simHour, overcast = 0, hidden = false) {
      mat.uniforms.uTime.value = time;
      // Strongest during Morning POV (08:30) and Golden Afternoon (15:30-17:45), zero at night
      const h = ((simHour % 24) + 24) % 24;
      const morning = Math.exp(-Math.pow((h - 8.8) / 2.6, 2));
      const afternoon = Math.exp(-Math.pow((h - 16.6) / 1.9, 2)) * 0.72;
      const strength = hidden ? 0 : Math.max(morning, afternoon) * (1 - overcast * 0.8);
      mat.uniforms.uStrength.value = strength;
      mesh.visible = strength > 0.02;
    },
  };
}

/**
 * Cracked pastel spotted eggshell halves for Monograph Ch. 03 Hatching animation.
 */
export function createHatchEggProp(scene) {
  const group = new THREE.Group();
  group.name = 'Monograph_Hatch_Egg';
  group.visible = false;

  const mat = new THREE.MeshStandardMaterial({
    name: 'M_Hatch_Eggshell',
    color: 0xf7efe0,
    roughness: 0.72,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  patchGouacheMaterial(mat, { strength: 0.84, rim: 0.42, warmShadow: true });

  const topHalf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mat);
  const botHalf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), mat);
  topHalf.raycast = () => {};
  botHalf.raycast = () => {};
  group.add(topHalf, botHalf);
  scene.add(group);

  return {
    group,
    update(active, pos, progress) {
      group.visible = Boolean(active && pos && progress > 0 && progress < 1);
      if (!group.visible) return;
      group.position.set(pos.x, pos.y + 0.14, pos.z);
      const lift = Math.sin(progress * Math.PI);
      topHalf.position.set(progress * 0.18, 0.08 + lift * 0.36, 0);
      topHalf.rotation.z = -progress * 1.35;
      botHalf.position.set(-progress * 0.12, -0.04 - progress * 0.08, 0);
      botHalf.rotation.z = progress * 0.55;
      const sc = 1 - Math.max(0, (progress - 0.7) / 0.3);
      group.scale.setScalar(Math.max(0.01, sc));
    },
  };
}

