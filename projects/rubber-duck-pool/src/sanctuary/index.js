import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import waterVert from './shaders/sanctuaryWater.vert.glsl?raw';
import waterFrag from './shaders/sanctuaryWater.frag.glsl?raw';
import fireVert from './shaders/proceduralFire.vert.glsl?raw';
import fireFrag from './shaders/proceduralFire.frag.glsl?raw';

import { sampleSanctuaryCircuit, CIRCUIT_LAP_SECONDS } from './circulation.js';
import { createSanctuaryPhysics } from './physics.js';
import { createOceanBackdrop } from './ocean-backdrop.js';
import { applyOfficialDuckDesign, attachDuckHat, updateDuckHats, getSignatureHatForDesign, setDuckHatTilt } from './duck-hats.js';
import { createAmbientAudio } from './ambient-audio.js';
import { createSecretTracker, SANCTUARY_SECRETS } from './secrets.js';
import { createI18n, SUPPORTED_LANGS } from './i18n.js';
import { createSanctuaryGraph, GUITAR_CHORDS, FISHING_BAITS, SHELL_SHOP_ITEMS } from './sanctuary-graph.js';
import { createDramaEngine } from './drama-engine.js';
import { createDramaVfx } from './drama-vfx.js';
import { createWeatherSystem, WEATHER_MODES } from './weather.js';
import { createSanctuaryCameraRig } from './camera-rig.js';
import { createLogbookSync } from './logbook-sync.js';
import { createQuirksEngine } from './quirks-engine.js';
import {
  stylizeSanctuaryRoot,
  attachCartoonDuckFeatures,
  setDuckStickerHighlight,
  updateCartoonDuckRig,
  createVolumetricSunbeams,
  createHatchEggProp,
} from './stylized-look.js';
import {
  createDuckPoseController,
  MONOGRAPH_CAMERA_SCRIPTS,
  sampleWaterPovCameraBob,
} from './duck-poses.js';
import { buildPortalHref, parsePortalQuery } from './portal-link.js';
import { createLogbook } from '../pool/logbook.js';
import { daylight } from '../pool/daylight.js';
import { DESIGNS } from '../pool/ducks.js';
import { createDiegeticBook3D } from './book.js';
import {
  createSanctuaryLoop,
  classifyRoastTier,
  hearthUnlockForToast,
  ROAST_TIERS,
  SPECIAL_HEARTH_DUCKS,
} from './sanctuary-loop.js';
import { TOOL_ICONS, SLIDER_ICONS, BRUSH_VISUALS, PALETTE_DAB_SVG } from './brush-icons.js';
import { WatercolorCanvasEngine } from './watercolor/WatercolorEngine.ts';
import { BRUSH_PRESETS, buildBrush } from './watercolor/brushes.ts';
import { PAPERS } from './watercolor/papers.ts';
import { PALETTE } from './watercolor/palette.ts';

const assetUrl = (rel) => new URL(rel, document.baseURI).href;
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

const CAMERA_PRESETS = {
  hero: {
    pos: b2t(-0.6, -29.5, 14.2),
    target: b2t(0.0, -2.6, 1.0),
    fov: 44,
  },
  onsen_interior: {
    pos: b2t(-11.45, 3.20, 1.72),
    target: b2t(-16.50, 3.20, 1.56),
    fov: 56,
  },
  book_desk: {
    pos: b2t(-8.92, -6.48, 1.54),
    target: b2t(-9.18, -5.05, 0.98),
    fov: 37,
  },
  atelier_canvas: {
    pos: b2t(2.60, -6.72, 1.54),
    target: b2t(2.85, -5.57, 1.30),
    fov: 35,
  },
  campfire_close: {
    pos: b2t(-7.18, -12.36, -1.28),
    target: b2t(-8.62, -14.22, -1.62),
    fov: 40,
  },
  fishing_pier: {
    pos: b2t(-2.78, -18.45, 0.62),
    target: b2t(-4.10, -27.80, -2.55),
    fov: 48,
  },
};

const DUCK_CATALOG_META = {
  classic:   { name: '클래식 덕',   hex: '#f2c138' },
  mint:      { name: '민트 덕',     hex: '#68d8b6' },
  cherry:    { name: '체리 덕',     hex: '#df4a5b' },
  daisy:     { name: '데이지 덕',   hex: '#f7ecc2' },
  lightning: { name: '라이트닝 덕', hex: '#39b8ff' },
  cow:       { name: '카우 덕',     hex: '#e8e4da' },
  heart:     { name: '하트 덕',     hex: '#f47da8' },
  stars:     { name: '스타즈 덕',   hex: '#2f4587' },
  tiger:     { name: '타이거 덕',   hex: '#e57e2a' },
  lavender:  { name: '라벤더 덕',   hex: '#9d7cd8' },
  crown:     { name: '크라운 덕',   hex: '#f4c842' },
  prism:     { name: '프리즘 덕',   hex: '#7ae8ff' },
};

const STAGE_LABELS = {
  upper_pool:     '상부 에메랄드 풀',
  slide:          '구리 슬라이드 하강',
  grotto:         '하부 소용돌이 동굴',
  intake_channel: '동측 취수로',
  siphon_lift:    '유리 사이펀 상승',
  return_tube:    '상부 유리 리턴 튜브',
  flamingo:       '플라밍고 튜브',
  upper_swim:     '상부 온실 풀',
};

const BUCKET_VARIETIES = [
  { id: 'classic',  name: '클래식', hex: '#f2c138' },
  { id: 'mint',     name: '민트',   hex: '#68d8b6' },
  { id: 'cherry',   name: '체리',   hex: '#df4a5b' },
  { id: 'daisy',    name: '데이지', hex: '#f7ecc2' },
  { id: 'tiger',    name: '타이거', hex: '#e57e2a' },
  { id: 'lavender', name: '라벤더', hex: '#9d7cd8' },
];

// =========================================================================
// CORE LOOP PERSISTENCE & BRIEF TOAST HELPER
// =========================================================================
const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const sanctuaryLoop = createSanctuaryLoop(storage);
const sharedLogbook = createLogbook(storage);
const logbookSync = createLogbookSync({ logbook: sharedLogbook });
const sanctuaryGraph = createSanctuaryGraph({ store: storage, seed: 8842 });
const dramaEngine = createDramaEngine({ store: storage });
const i18n = createI18n('ko', storage);
const secretTracker = createSecretTracker(storage);
const ambientAudio = createAmbientAudio();
// as on the first map, the sound starts on the first touch or key (before the touch's own handlers, so they are
// heard), a later one wakes it if the browser paused it, and it pauses while the page is out of sight
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => ambientAudio.ensure(), { capture: true });
document.addEventListener('visibilitychange', () => ambientAudio.setHidden(document.hidden));
// the ducks the player sent down the slide, heard round the circuit until they come up the siphon: as on the first map,
// the circuit is heard for the duck the player is with (these and the one followed), not for every duck going round
const sentDown = new Set();
const weatherSystem = createWeatherSystem({ store: storage });
const sanctuaryPhysics = createSanctuaryPhysics({ seed: 4201, mode: 'circuit' });
const quirksEngine = createQuirksEngine({ store: storage });
let sanctuaryBook = null;
let photoMode = false;
const reducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
let stylizedOutlineCount = 0;
let hoveredDuckEntry = null;
let hoverDuckTimer = 0;
let hoverBurpFired = false;
let cutinTimer = null;

const cutinEl = document.getElementById('cartoon-cutin');
const cutinStampEl = document.getElementById('cutin-stamp');
const cutinTitleEl = document.getElementById('cutin-title');
const cutinSubEl = document.getElementById('cutin-sub');
const subliminalEl = document.getElementById('subliminal-flash');
const subliminalTextEl = document.getElementById('subliminal-text');

function triggerCartoonCutin(title, sub = '', stampText = '수안보 극비 승인', durationMs = 1450) {
  if (!cutinEl || photoMode) return false;
  if (cutinStampEl) cutinStampEl.textContent = stampText;
  if (cutinTitleEl) cutinTitleEl.textContent = title;
  if (cutinSubEl) cutinSubEl.textContent = sub;
  cutinEl.classList.remove('hidden');
  // Restart pop keyframe cleanly for back-to-back slams
  const card = cutinEl.querySelector('.cutin-card');
  if (card) {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }
  ambientAudio.playCue('stamp');
  quirksEngine.triggerHitStop(0.05);
  if (cutinTimer) clearTimeout(cutinTimer);
  cutinTimer = setTimeout(() => cutinEl.classList.add('hidden'), durationMs);
  return true;
}

function syncValveUi() {
  const qst = quirksEngine.getState();
  const label = `🌡 ${qst.waterTempC.toFixed(1)}°C`;
  for (const id of ['val-cmp-temp', 'val-onsen-temp']) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = label;
      el.classList.toggle('at-target', qst.atResonanceTemp);
    }
  }
}

const DUCK_ID_BY_KEY = Object.fromEntries(
  DESIGNS.map((d) => [d.id.replace(/^\d+-/, ''), d.id])
);
const WEARABLE_HAT_IDS = ['party', 'tophat', 'crown', 'shades', 'bowtie', 'flower', 'pirate', 'propeller'];
const UNEXPECTED_SHOWCASE_IDS = ['14-terrarium', '15-citrus', '16-cloud', '18-ramen', '20-radio', '21-magnet', '22-snow-globe', '23-mosaic'];

const toastEl = document.getElementById('sanctuary-toast');
let toastTimer = null;
function showToast(msg, durationMs = 3200) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), durationMs);
}

const whisperEl = document.getElementById('sanctuary-whisper');
let whisperTimer = null;
function showWhisper(msg, durationMs = 5200) {
  if (!whisperEl || photoMode || focusMode || followedDuck) return;
  whisperEl.textContent = msg;
  whisperEl.classList.remove('hidden');
  if (whisperTimer) clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => whisperEl.classList.add('hidden'), durationMs);
}

// =========================================================================
// LAZY 3-KEYFRAME CYCLES-MATCHED PMREM ENVIRONMENTS (FAST BOOT + 24H SYNC)
// =========================================================================
const ENV_PRESETS = {
  day: { zenith: [0.30, 0.58, 0.92], horizon: [0.72, 0.86, 0.98], ground: [0.24, 0.28, 0.30], warmGain: 0.36, poolGain: 0.70 },
  dusk: { zenith: [0.052, 0.095, 0.210], horizon: [0.235, 0.245, 0.375], ground: [0.056, 0.060, 0.082], warmGain: 1.08, poolGain: 0.54 },
  night: { zenith: [0.015, 0.030, 0.078], horizon: [0.045, 0.080, 0.150], ground: [0.024, 0.028, 0.040], warmGain: 1.20, poolGain: 0.62 },
};
const envTexCache = {};

function getSanctuaryEnv(renderer, key) {
  if (envTexCache[key]) return envTexCache[key];
  const spec = ENV_PRESETS[key] || ENV_PRESETS.dusk;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyGeo = new THREE.SphereGeometry(20, 24, 16);
  const envScene = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uZenith: { value: new THREE.Color(...spec.zenith) },
      uHorizon: { value: new THREE.Color(...spec.horizon) },
      uGround: { value: new THREE.Color(...spec.ground) },
      uWarmGain: { value: spec.warmGain },
      uPoolGain: { value: spec.poolGain },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform float uWarmGain;
      uniform float uPoolGain;
      varying vec3 vDir;
      void main() {
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 col = y >= 0.0 ? mix(uHorizon, uZenith, pow(y, 0.55)) : mix(uHorizon * 0.48, uGround, pow(-y, 0.5));
        float warmPatch = exp(-pow(length(vDir - normalize(vec3(0.35, 0.28, -0.35))), 2.0) * 9.0);
        float warmPatch2 = exp(-pow(length(vDir - normalize(vec3(-0.60, 0.18, -0.25))), 2.0) * 11.0);
        float poolGlow = exp(-pow(length(vDir - normalize(vec3(0.12, -0.35, -0.10))), 2.0) * 7.0);
        col += vec3(1.15, 0.72, 0.30) * (warmPatch * 0.85 + warmPatch2 * 0.55) * uWarmGain;
        col += vec3(0.08, 0.68, 0.60) * poolGlow * uPoolGain;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  const rt = pmrem.fromScene(envScene, 0.04);
  skyGeo.dispose();
  skyMat.dispose();
  pmrem.dispose();
  envTexCache[key] = rt.texture;
  return rt.texture;
}

// =========================================================================
// RENDERER, SCENE & SELECTIVE CINEMATIC BLOOM POST-PROCESSING
// =========================================================================
const canvas = document.getElementById('gl') || document.getElementById('studio-canvas');
const hoverTip = document.getElementById('hover-tip');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const BG_DEFAULT = new THREE.Color(0x16263d);
const BG_CAMPFIRE = new THREE.Color(0x020306);
scene.background = BG_DEFAULT;
scene.fog = new THREE.FogExp2(0x16263d, 0.0);

let activeEnvKey = 'dusk';
const twilightEnvTex = getSanctuaryEnv(renderer, 'dusk');
scene.environment = twilightEnvTex;
scene.environmentIntensity = 0.76;

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 900);
camera.position.copy(CAMERA_PRESETS.hero.pos);

const composerRt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 0,
});
const composer = new EffectComposer(renderer, composerRt);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
composer.setSize(window.innerWidth, window.innerHeight);
let lastSceneDrawCalls = 0;
let lastSceneTriangles = 0;
const sceneRenderPass = new RenderPass(scene, camera);
const origRenderPass = sceneRenderPass.render.bind(sceneRenderPass);
sceneRenderPass.render = (r, wb, rb, dt, ma) => {
  origRenderPass(r, wb, rb, dt, ma);
  lastSceneDrawCalls = r.info.render.calls;
  lastSceneTriangles = r.info.render.triangles;
};
composer.addPass(sceneRenderPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.17,  // restrained cinematic strength (lanterns & fire glow without blowing out paper/glass!)
  0.46,  // crisp halo radius
  0.95   // high HDR luminance threshold so watercolor easel & white flanges stay razor-crisp
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
let bloomEnabled = true;

const oceanBackdrop = createOceanBackdrop(scene);
const dramaVfx = createDramaVfx(scene);
const bookDetailObjs = [];
const BOOK_DESK_WORLD = b2t(-9.12, -5.10, 0.98);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.5;
controls.maxDistance = 68;
controls.target.copy(CAMERA_PRESETS.hero.target);
controls.update();

const hemiLight = new THREE.HemisphereLight(0x5a88c8, 0x0c141c, 0.36);
scene.add(hemiLight);

const moonDir = new THREE.DirectionalLight(0x9bc0f8, 0.96);
moonDir.position.copy(b2t(-20, -18, 30));
moonDir.castShadow = true;
moonDir.shadow.mapSize.set(2048, 2048);
moonDir.shadow.camera.near = 6;
moonDir.shadow.camera.far = 78;
const sc = 22;
moonDir.shadow.camera.left = -sc;
moonDir.shadow.camera.right = sc;
moonDir.shadow.camera.top = sc;
moonDir.shadow.camera.bottom = -sc;
moonDir.shadow.bias = -0.0005;
moonDir.shadow.normalBias = 0.025;
scene.add(moonDir);

function addPoint(bx, by, bz, color, intensity, distance) {
  const l = new THREE.PointLight(color, intensity, distance, 1.85);
  l.position.copy(b2t(bx, by, bz));
  scene.add(l);
  return l;
}

const warmConservatoryLight = addPoint(2.8, 3.0, 5.2, 0xffaa44, 58, 28);
const warmConservatoryEast  = addPoint(11.6, 2.2, 4.6, 0xffae4e, 34, 20);
const warmOnsenLight        = addPoint(-14.2, 3.2, 2.6, 0xffb85c, 32, 14);
const emeraldPoolLight      = addPoint(2.6, -2.0, 0.2, 0x18f5d8, 44, 24);
const atelierLampLight      = addPoint(3.2, -5.8, 1.85, 0xffd698, 3.6, 6.5);
const bookDeskLampLight     = addPoint(-8.82, -5.24, 1.50, 0xffbe6a, 4.4, 4.8);
const campfireCoreLight     = addPoint(-8.60, -14.20, -1.60, 0xff5a0c, 22, 10.8);
const campfireHandFillLight = addPoint(-7.65, -13.10, -1.30, 0xff9a44, 0.0, 4.2);
const pierLanternLight      = addPoint(-2.62, -22.46, -0.05, 0xffbe5c, 18, 12.5);

// Layer 4: Cool forensic investigator overhead SpotLight (#CBE8F5) illuminating the 3D field-log book
const bookOverheadSpot = new THREE.SpotLight(0xb2dff5, 0.0, 3.6, Math.PI * 0.21, 0.65, 1.4);
bookOverheadSpot.position.copy(b2t(-9.12, -5.35, 2.05));
bookOverheadSpot.target.position.copy(b2t(-9.11, -5.10, 0.98));
scene.add(bookOverheadSpot);
scene.add(bookOverheadSpot.target);

let sanctuaryBrightness = 1.0;
let sanctuaryDuckCap = 36;
const portalInit = parsePortalQuery(window.location.search);
let timeMode = portalInit.hour !== null ? 'manual' : 'auto';
let simHour = portalInit.hour !== null ? portalInit.hour : 18.12;
let lastNight = 0.55;
let ecoMode = false;
let slideRides = 0;
let lastRenderNow = 0;
const DAY_CYCLE_HOURS_PER_SEC = 24 / 1800; // Full 24h cycle every 30 real minutes

function formatHourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const icon = h >= 6 && h < 17 ? '☀️' : (h >= 17 && h < 20.5) || (h >= 4.5 && h < 6) ? '🌅' : '🌙';
  return `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function applyDaylight(hour, t = 0) {
  const dl = daylight(hour);
  const wx = weatherSystem.getState();
  lastNight = dl.night;
  oceanBackdrop.update(t, dl, wx.overcast);

  // Sync sky/water shader colors, directional sun/moon & weather raindrop ripples
  waterUniforms.uSkyColor.value.setRGB(dl.sky[0], dl.sky[1], dl.sky[2], THREE.LinearSRGBColorSpace);
  waterUniforms.uHorizonColor.value.setRGB(dl.haze[0], dl.haze[1], dl.haze[2], THREE.LinearSRGBColorSpace);
  waterUniforms.uMoonDir.value.set(dl.dir[0], Math.max(0.08, dl.dir[1]), dl.dir[2]).normalize();
  waterUniforms.uNight.value = dl.night;
  waterUniforms.uRain.value = wx.rain;

  if (focusMode !== 'campfire') {
    const nextEnvKey = dl.night < 0.28 ? 'day' : dl.night < 0.72 ? 'dusk' : 'night';
    if (!ptActive && activeEnvKey !== nextEnvKey) {
      activeEnvKey = nextEnvKey;
      scene.environment = getSanctuaryEnv(renderer, activeEnvKey);
    }

    const overcastDim = 1.0 - 0.26 * wx.overcast;
    const lanternGain = (0.30 + 0.80 * dl.night + 0.16 * wx.overcast) * sanctuaryBrightness;
    const sunGain = (0.72 + 0.78 * (1 - dl.night)) * overcastDim * sanctuaryBrightness;
    moonDir.position.set(dl.dir[0] * 36, Math.max(8, dl.dir[1] * 38), dl.dir[2] * 36);
    moonDir.color.setRGB(dl.tint[0], dl.tint[1], dl.tint[2], THREE.LinearSRGBColorSpace);
    moonDir.intensity = 1.08 * sunGain;

    hemiLight.color.setRGB(
      Math.min(1, dl.haze[0] * 1.4 + 0.14),
      Math.min(1, dl.haze[1] * 1.4 + 0.18),
      Math.min(1, dl.haze[2] * 1.4 + 0.24),
      THREE.LinearSRGBColorSpace
    );
    hemiLight.intensity = (0.36 + 0.40 * (1 - dl.night)) * sanctuaryBrightness;

    warmConservatoryLight.intensity = 58 * lanternGain;
    warmConservatoryEast.intensity = 34 * lanternGain;
    warmOnsenLight.intensity = 32 * (0.45 + 0.55 * lanternGain);
    emeraldPoolLight.intensity = 44 * (0.42 + 0.68 * dl.night) * sanctuaryBrightness;
    pierLanternLight.intensity = 19 * (0.38 + 0.85 * dl.night) * sanctuaryBrightness;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.06, 0.96, dl.night) * sanctuaryBrightness;
    scene.environmentIntensity = (0.70 + 0.26 * (1 - dl.night)) * overcastDim;

    // Gentle atmospheric mist/rain haze matched to coastal horizon
    scene.fog.color.setRGB(dl.haze[0], dl.haze[1], dl.haze[2], THREE.LinearSRGBColorSpace);
    scene.fog.density = wx.fogDensity;

    // Restrained cinematic bloom (keeps watercolor canvas & glass flanges crisp while lanterns glow)
    bloomPass.strength = THREE.MathUtils.lerp(0.12, 0.21, dl.night);
  }

  const timeBtn = document.getElementById('btn-cmp-time');
  const timeVal = document.getElementById('val-time-hour');
  const timeSl = document.getElementById('sl-time-hour');
  const txt = formatHourLabel(hour);
  if (timeBtn && timeBtn.textContent !== txt) timeBtn.textContent = txt;
  if (timeVal) timeVal.textContent = txt.slice(2).trim();
  if (timeSl && document.activeElement !== timeSl) timeSl.value = (((hour % 24) + 24) % 24).toFixed(1);
}

function setTimeHour(hour, mode = 'manual') {
  simHour = ((Number(hour) % 24) + 24) % 24;
  timeMode = mode;
  document.querySelectorAll('[data-time-preset]').forEach((b) => {
    const p = b.dataset.timePreset;
    const match = (mode === 'auto' && p === 'auto')
      || (mode === 'manual' && p === 'day' && simHour >= 9 && simHour < 16)
      || (mode === 'manual' && p === 'dusk' && simHour >= 16 && simHour < 20)
      || (mode === 'manual' && p === 'night' && (simHour >= 20 || simHour < 5));
    b.classList.toggle('active', match);
  });
  applyDaylight(simHour, clock ? clock.getElapsedTime() : 0);
  checkSecrets();
}

function setEcoMode(on) {
  ecoMode = Boolean(on);
  const pr = ecoMode ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.35);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  const btn = document.getElementById('btn-cmp-eco');
  if (btn) {
    btn.classList.toggle('active', ecoMode);
    btn.title = i18n.t('companion.ecoHint');
  }
  checkSecrets();
}

function syncAudioUi() {
  const st = ambientAudio.getState();
  const radioBtn = document.getElementById('btn-onsen-radio');
  if (radioBtn) {
    radioBtn.classList.toggle('active', st.radioOn);
    radioBtn.textContent = i18n.t(st.radioOn ? 'ui.radioOn' : 'ui.radioOff');
  }
  const muteBtn = document.getElementById('btn-aud-mute');
  if (muteBtn) muteBtn.textContent = st.muted ? '🔇' : '🔊';
  for (const ch of ['water', 'hearth', 'rain', 'radio']) {
    const sl = document.getElementById(`sl-aud-${ch}`);
    const vl = document.getElementById(`val-aud-${ch}`);
    const pct = Math.round((st.channels[ch] || 0) * 100);
    if (sl && document.activeElement !== sl) sl.value = String(st.channels[ch] || 0);
    if (vl) vl.textContent = `${pct}%`;
  }
  const audBtn = document.getElementById('btn-cmp-audio');
  if (audBtn) audBtn.classList.toggle('active', st.started && !st.muted);
}

function applyTranslations() {
  const lang = i18n.getLang();
  document.documentElement.lang = lang;
  const setText = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = i18n.t(key); };
  setText('btn-exit-focus', 'ui.back');
  setText('lbl-onsen-bright', 'ui.brightness');
  setText('lbl-onsen-ducks', 'ui.duckCount');
  setText('btn-pt-exit', 'ui.webglReturn');
  setText('btn-follow-squeak', 'ride.pet');
  setText('btn-follow-toss', 'ride.toss');
  setText('btn-follow-next', 'ride.next');
  setText('btn-follow-exit', 'ride.exit');
  setText('btn-follow-rename', 'ride.rename');
  setText('btn-follow-hat', 'ride.hat');
  setText('btn-follow-tilt', 'quirk.tiltBtn');
  setText('btn-follow-squeeze', 'quirk.squeezeBtn');
  setText('btn-follow-dive', 'quirk.diveBtn');
  setText('btn-follow-sleep', 'quirk.sleepBtn');
  setText('lbl-cmp-valve', 'quirk.valveLabel');
  setText('lbl-cmp-cameras', 'quirk.camerasLabel');
  setText('btn-cam-water', 'quirk.camWater');
  setText('btn-cam-iso', 'quirk.camIso');
  setText('btn-cam-study', 'quirk.camStudy');
  setText('btn-cam-night', 'quirk.camNight');
  const stampBtn = document.getElementById('btn-book-stamp');
  if (stampBtn) stampBtn.textContent = i18n.t(sanctuaryBook?.getStampMode?.() ? 'quirk.stampModeOn' : 'quirk.stampMode');
  setText('lbl-cmp-weather', 'weather.label');
  setText('btn-wx-clear', 'weather.clear');
  setText('btn-wx-petals', 'weather.petals');
  setText('btn-wx-mist', 'weather.mist');
  setText('btn-wx-rain', 'weather.rain');
  setText('btn-photo-snap', 'photo.snap');
  setText('btn-photo-exit', 'photo.exit');
  setText('btn-onsen-terminal', 'terminal.open');
  setText('lbl-term-title', 'terminal.title');
  setText('btn-term-send', 'terminal.send');
  const termInput = document.getElementById('term-input');
  if (termInput) termInput.placeholder = i18n.t('terminal.placeholder');
  setText('btn-cf-hand', 'focus.campfire.manualRoast');
  setText('btn-cf-orbit', 'focus.campfire.view');
  setText('btn-cf-stoke', 'focus.campfire.ignite');
  setText('btn-cf-fresh', 'focus.campfire.newSkewer');
  setText('btn-wc-ref', 'focus.atelier.sketch');
  setText('btn-wc-release-duck', 'focus.atelier.release');
  setText('lbl-cmp-title', 'companion.title');
  setText('lbl-aud-water', 'companion.water');
  setText('lbl-aud-hearth', 'companion.hearth');
  setText('lbl-aud-rain', 'companion.rain');
  setText('lbl-aud-radio', 'companion.radio');
  setText('lbl-cmp-time', 'companion.time');
  setText('btn-time-auto', 'companion.timeAuto');
  setText('btn-time-day', 'companion.timeDay');
  setText('btn-time-dusk', 'companion.timeDusk');
  setText('btn-time-night', 'companion.timeNight');
  setText('lbl-cmp-pomo', 'pomodoro.title');
  setText('lbl-cmp-shop', 'shop.title');
  setText('lbl-cmp-requests', 'requests.title');
  setText('btn-cmp-yuzu', 'companion.yuzuBtn');
  toastEl?.classList.add('hidden');

  const langBtn = document.getElementById('btn-cmp-lang');
  if (langBtn) langBtn.textContent = lang.toUpperCase();

  // Refresh localized hover tooltips on interactive scene targets
  const roleKey = {
    book: 'hover.book',
    onsen: 'hover.library',
    atelier: 'hover.atelier',
    campfire: 'hover.campfire',
    fishing: 'hover.fishing',
    ctl_bright: 'hover.brightnessDial',
    ctl_ducks: 'hover.countDial',
    ctl_radio: 'hover.radio',
    bucket: 'hover.duckBin',
    stand: 'hover.skewerStand',
  };
  for (const list of [interactiveTargets, onsenInteractiveTargets, campfireInteractiveTargets]) {
    for (const item of list) {
      if (roleKey[item.role]) item.label = i18n.t(roleKey[item.role]);
    }
  }
  for (const dp of duckPickTargets) {
    const defaultName = dp.entry.designId ? i18n.t(`duck.${dp.entry.designId}`) : dp.entry.name;
    const dName = sanctuaryGraph.getDuckName(dp.entry.id, defaultName);
    dp.entry.name = dName;
    dp.label = i18n.t('ride.rideWith', { name: dName });
  }
  if (followedDuck && followDuckName) followDuckName.textContent = followedDuck.name;
  const traitEl = document.getElementById('follow-duck-trait');
  if (followedDuck && traitEl) {
    const tr = followedDuck.physPose?.trait || 'standard';
    traitEl.textContent = i18n.t(`trait.${tr}`);
  }
  syncFishingUi?.();
  syncCompanionExtrasUi?.();
  syncFollowPalBadge?.();
  syncAudioUi();
  syncWcModeBtn();
  sanctuaryBook?.setLanguage(lang);
}

function getSecretContext() {
  const st = ambientAudio.getState();
  return {
    hour: simHour,
    radioOn: st.radioOn,
    goldenRoastUnlocked: sanctuaryLoop.hearthUnlocks.golden_smore !== null,
    customCreated: sanctuaryLoop.stats.customCreated,
    ducksPetted: sanctuaryLoop.stats.ducksPetted,
    ridesTaken: sanctuaryLoop.stats.ridesTaken,
    slideRides,
    ecoMode,
    rainVol: st.channels.rain,
    hearthVol: st.channels.hearth,
  };
}

function checkSecrets() {
  const newly = secretTracker.evaluate(getSecretContext(), Date.now());
  if (!newly.length) return newly;
  for (const sec of newly) {
    const duckName = i18n.t(`duck.${sec.unlocks}`);
    const secName = i18n.t(`secret.${sec.id}.name`);
    const designMeta = DESIGNS.find((d) => d.id === sec.unlocks);
    spawnCircuitSpecialDuck({
      id: `secret_${sec.unlocks}`,
      designId: sec.unlocks,
      name: duckName,
      hex: designMeta?.fx?.colours?.[0] || '#ffd84a',
      hatId: sec.unlocks === '19-moon' ? 'flower' : sec.unlocks === '17-bookbinder' ? 'tophat' : 'none',
      launchSplash: true,
      startU: 0.16,
    });
    showToast(i18n.t('toast.secretUnlocked', { secret: secName, duck: duckName }), 4200);
  }
  if (secretTracker.getUnlocked().length === SANCTUARY_SECRETS.length) {
    showToast(i18n.t('toast.allSecrets'), 4600);
  }
  sanctuaryBook?.refresh();
  return newly;
}

/** A duck says its own recorded voice from where it is (ambient-audio.js duckVoice); as: 'voice' for the duck the
 * player touched. */
function duckSqueak(entry, as = 'squeak') {
  ambientAudio.duckVoice(entry?.designId, entry?.id, entry?.obj?.position, as);
}

function applySanctuaryBrightness(val) {
  sanctuaryBrightness = THREE.MathUtils.clamp(val, 0.55, 1.65);
  if (focusMode !== 'campfire') {
    waterUniforms.uBrightness.value = sanctuaryBrightness;
    applyDaylight(simHour, clock ? clock.getElapsedTime() : 0);
  }
  const sl = document.getElementById('sl-onsen-bright');
  const vl = document.getElementById('val-onsen-bright');
  if (sl) sl.value = String(sanctuaryBrightness);
  if (vl) vl.textContent = `${Math.round(sanctuaryBrightness * 100)}%`;
}

function applySanctuaryDuckCap(cap) {
  sanctuaryDuckCap = Math.round(THREE.MathUtils.clamp(cap, 4, Math.max(36, duckRoots.length)));
  for (let i = 0; i < duckRoots.length; i++) {
    // Always keep user-created custom, hearth-unlocked & secret ducks visible!
    duckRoots[i].obj.visible = duckRoots[i].isSpecial || i < sanctuaryDuckCap;
  }
  const sl = document.getElementById('sl-onsen-ducks');
  const vl = document.getElementById('val-onsen-ducks');
  if (sl) sl.value = String(sanctuaryDuckCap);
  if (vl) vl.textContent = String(sanctuaryDuckCap);
}

function toggleOnsenRadio() {
  ambientAudio.ensure();
  ambientAudio.toggleRadio();
  syncAudioUi();
  checkSecrets();
}

// =========================================================================
// 3D WATER RIPPLE RING POOL (FOR DUCK CLICKS & SPLASHDOWNS)
// =========================================================================
const RIPPLE_MAX = 14;
const rippleGeo = new THREE.RingGeometry(0.18, 0.26, 28);
rippleGeo.rotateX(-Math.PI / 2);
const ripplePool = Array.from({ length: RIPPLE_MAX }, () => {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xaefaf0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(rippleGeo, mat);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, age: 0, dur: 0.9, active: false };
});
let rippleCursor = 0;

function spawnWaterRipple(x, y, z, scaleMax = 1.0) {
  addShaderWake(x, z, 1.2 + scaleMax * 0.9, Math.min(1.1, 0.55 + scaleMax * 0.35), 1.35);
  const r = ripplePool[rippleCursor % RIPPLE_MAX];
  rippleCursor++;
  r.active = true;
  r.age = 0;
  r.dur = 0.85;
  r.scaleMax = scaleMax;
  r.mesh.position.set(x, y + 0.03, z);
  r.mesh.scale.setScalar(0.55);
  r.mat.opacity = 0.78;
  r.mesh.visible = true;
}

// =========================================================================
// LIVE 3D VOLUMETRIC `procedural-fire` SHADER & 90 SPARK STREAKS
// =========================================================================
const CAMPFIRE_WORLD = b2t(-8.60, -14.20, -2.055);
const FIRE_CORE_WORLD = new THREE.Vector3(CAMPFIRE_WORLD.x, CAMPFIRE_WORLD.y + 0.34, CAMPFIRE_WORLD.z);
const cfYawRad = (38 * Math.PI) / 180;

const fireUniforms = {
  uTime:     { value: 0 },
  uFireSize: { value: 1.0 },
  uStoke:    { value: 0.0 },
  uPop:      { value: 0.0 },
  uGust:     { value: new THREE.Vector2(0, 0) },
  uCamLocal: { value: new THREE.Vector3(0, 0, 2) },
  uDetail:   { value: 0.0 },
};
const fireMat = new THREE.ShaderMaterial({
  vertexShader: fireVert,
  fragmentShader: fireFrag,
  uniforms: fireUniforms,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
});
const fireVolumeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), fireMat);
fireVolumeMesh.name = 'Live_ProceduralFire_Volume';
fireVolumeMesh.scale.set(1.04, 1.44, 1.04);
fireVolumeMesh.position.set(
  CAMPFIRE_WORLD.x - Math.cos(cfYawRad) * 0.04,
  CAMPFIRE_WORLD.y + 0.70,
  CAMPFIRE_WORLD.z + Math.sin(cfYawRad) * 0.04
);
fireVolumeMesh.renderOrder = 10;
scene.add(fireVolumeMesh);

const SPARK_COUNT = 90;
const streakGeo = new THREE.CylinderGeometry(0.00045, 0.00105, 1.0, 4, 1, false);
const streakMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.92,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const sparkMesh = new THREE.InstancedMesh(streakGeo, streakMat, SPARK_COUNT);
sparkMesh.frustumCulled = false;
scene.add(sparkMesh);

const sparkPool = Array.from({ length: SPARK_COUNT }, () => ({
  alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(),
  age: 0, tb: 1, T: 1200, dmm: 0.6, seed: Math.random() * 100,
}));
function spawnSpark(sp, isBurst = false) {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (isBurst ? 0.14 : 0.26);
  sp.p.set(CAMPFIRE_WORLD.x + Math.cos(ang) * r, CAMPFIRE_WORLD.y + 0.06 + Math.random() * 0.16, CAMPFIRE_WORLD.z + Math.sin(ang) * r);
  if (isBurst) {
    const spd = 2.2 + Math.random() * 2.4;
    sp.v.set((Math.cos(ang) * 0.6 + (Math.random() - 0.5)) * spd * 0.5, (0.85 + Math.random()) * spd * 0.68, (Math.sin(ang) * 0.6 + (Math.random() - 0.5)) * spd * 0.5);
    sp.dmm = 0.45 + Math.random() * 0.85;
    sp.T = 1280 + Math.random() * 110;
  } else {
    sp.v.set((Math.random() - 0.5) * 0.45, 0.72 + Math.random() * 1.35, (Math.random() - 0.5) * 0.45);
    sp.dmm = 0.30 + Math.random() * 0.65;
    sp.T = 1160 + Math.random() * 140;
  }
  sp.age = 0;
  sp.tb = (0.35 + 1.3 * sp.dmm * sp.dmm) * (0.65 + 0.7 * Math.random());
  sp.alive = true;
}
function burstSparks(count) {
  let n = 0;
  for (let i = 0; i < SPARK_COUNT && n < count; i++) {
    if (!sparkPool[i].alive || sparkPool[i].age > 0.6) { spawnSpark(sparkPool[i], true); n++; }
  }
}
for (let i = 0; i < 20; i++) {
  spawnSpark(sparkPool[i], false);
  const preT = Math.random() * 0.7;
  sparkPool[i].p.addScaledVector(sparkPool[i].v, preT * 0.5);
  sparkPool[i].age = preT;
}

// =========================================================================
// SELF-CONTAINED OPTICAL ONSEN WATER SHADER (VORONOI CAUSTICS + LIVE WAKES)
// =========================================================================
const MAX_WATER_WAKES = 12;
const wakeSlots = Array.from({ length: MAX_WATER_WAKES }, () => ({
  x: 0, z: 0, radius: 0.4, maxRadius: 1.8, strength: 0, age: 1, dur: 1,
}));
let wakeCursor = 0;

function addShaderWake(x, z, maxRadius = 1.65, strength = 0.85, dur = 1.25) {
  const s = wakeSlots[wakeCursor % MAX_WATER_WAKES];
  wakeCursor++;
  s.x = x;
  s.z = z;
  s.radius = 0.25;
  s.maxRadius = maxRadius;
  s.strength = strength;
  s.age = 0;
  s.dur = dur;
}

const waterUniforms = {
  uTime: { value: 0 },
  uMoonDir: { value: moonDir.position.clone().normalize() },
  uSkyColor: { value: new THREE.Color(0x163864) },
  uHorizonColor: { value: new THREE.Color(0x224c72) },
  uBrightness: { value: 1.0 },
  uNight: { value: 0.5 },
  uRain: { value: 0.0 },
  uWakes: { value: Array.from({ length: MAX_WATER_WAKES }, () => new THREE.Vector4(0, 0, 0.5, 0)) },
};
const lygiaWaterMat = new THREE.ShaderMaterial({
  vertexShader: waterVert,
  fragmentShader: waterFrag,
  uniforms: waterUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// =========================================================================
// `msurguy/watercolor-playground` GPU FLUID ENGINE ON 3D EASEL
// =========================================================================
let wcEngine = null;
let wcTex = null;
let wcFrontMat = null;
let wcMeshTarget = null;
let wcPaintActive = true;
let wcPainting = false;
let wcRefVisible = true;
let wcPaperIdx = 0;
let wcActivePigmentHex = PALETTE[0].hex;
let wcBrushSizeUi = 0.52;
const WC_REF_OPACITY_ATELIER = 0.88;

const atelierFocusUI = document.getElementById('atelier-focus-ui');
const wcCursorEl = document.getElementById('wc-cursor');

function syncWcPigmentColor(hex) {
  wcActivePigmentHex = hex;
  if (atelierFocusUI) atelierFocusUI.style.setProperty('--wc-pigment', hex);
}

function syncWcCursorSize() {
  if (!wcCursorEl) return;
  const px = Math.round(14 + wcBrushSizeUi * 34);
  wcCursorEl.style.width = `${px}px`;
  wcCursorEl.style.height = `${px}px`;
}

function initWatercolorEngine() {
  if (wcEngine) return wcEngine;
  wcEngine = new WatercolorCanvasEngine(800, 600, () => {
    if (wcTex) wcTex.needsUpdate = true;
  });
  wcEngine.setPigment(PALETTE[0].pigment);
  wcEngine.setBrush(buildBrush(BRUSH_PRESETS[0]));
  wcTex = new THREE.CanvasTexture(wcEngine.canvas);
  wcTex.flipY = false;
  wcTex.colorSpace = THREE.SRGBColorSpace;
  wcTex.anisotropy = 4;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    wcEngine.setReferenceImage(img, wcRefVisible ? (focusMode === 'atelier' ? WC_REF_OPACITY_ATELIER : 0.96) : 0.0);
  };
  img.src = assetUrl('sanctuary/textures/watercolor_easel_canvas.jpg');

  if (wcFrontMat) {
    wcFrontMat.map = wcTex;
    wcFrontMat.needsUpdate = true;
  }
  return wcEngine;
}

// =========================================================================
// STATE: FOCUS MODES, INTERACTIVE PROPS, FOLLOW-DUCK CAM & SPECIAL DUCKS
// =========================================================================
let focusMode = null; // null | 'atelier' | 'campfire' | 'onsen' | 'book'
let followedDuck = null;
const followOffset = new THREE.Vector3(0, 1.35, -2.6);

const interactiveTargets = [];
const duckPickTargets = [];
const onsenInteractiveTargets = [];
const campfireInteractiveTargets = [];
const duckRoots = [];
const emberBreathingMats = [];
const waterStreamTextures = [];
const onsenIndoorObjs = [];
const duckTemplateMap = new Map();
const staticCampfireSkewerObjs = [];

function setStaticCampfireSkewersVisible(visible) {
  for (let i = 0; i < staticCampfireSkewerObjs.length; i++) {
    staticCampfireSkewerObjs[i].visible = visible;
  }
}

const customDuckGroup = new THREE.Group();
customDuckGroup.name = 'Live_CustomAndSpecialDucks';
scene.add(customDuckGroup);

// Handheld Bamboo Skewer Group
const handSkewerGroup = new THREE.Group();
handSkewerGroup.name = 'Live_Handheld_RoastSkewer';
handSkewerGroup.visible = false;
scene.add(handSkewerGroup);

const skewerShaftGeo = new THREE.CylinderGeometry(0.0024, 0.0056, 0.72, 8);
const skewerShaftMat = new THREE.MeshStandardMaterial({ color: 0x7c5a38, roughness: 0.84, metalness: 0.0 });
const skewerShaftMesh = new THREE.Mesh(skewerShaftGeo, skewerShaftMat);
skewerShaftMesh.position.y = 0.36;
handSkewerGroup.add(skewerShaftMesh);

const skewerWrapGeo = new THREE.CylinderGeometry(0.0074, 0.0078, 0.12, 8);
const skewerWrapMat = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.92 });
const skewerWrapMesh = new THREE.Mesh(skewerWrapGeo, skewerWrapMat);
skewerWrapMesh.position.y = 0.06;
handSkewerGroup.add(skewerWrapMesh);

const skewerDuckHolder = new THREE.Group();
handSkewerGroup.add(skewerDuckHolder);

let skewerList = ['classic', 'mint', 'cherry'];
let skewerDuckEntries = [];
let cfHandMode = true;
let cfDipHeld = false;
let cfPointerNdc = { x: 0.0, y: 0.05 };
let cfSmoothedNdc = { x: 0.0, y: 0.05 };
let cfDepthSmooth = 0.22;
let cfSkewerSpin = 0.0;
let cfSkewerSpinTarget = 0.0;
let cfFireSize = 1.0;
let cfStoke = 0.0;
let cfPop = 0.0;
let cfGustX = 0.0;
let cfGustZ = 0.0;
let cfNextBucketCycle = 0;

const C_GOLDEN = new THREE.Color(0xc87424);
const C_CHAR = new THREE.Color(0x2f150a);

function stripCloneDecorations(clone) {
  const toRemove = [];
  clone.traverse((ch) => {
    const nm = ch.name || '';
    if (
      nm.endsWith('_InkOutline') ||
      nm.endsWith('_StickerOutline') ||
      nm === 'DuckCheekBlush' ||
      nm === 'DuckBeautyMark' ||
      nm.startsWith('DuckHat_')
    ) {
      toRemove.push(ch);
    }
  });
  for (let i = 0; i < toRemove.length; i++) {
    toRemove[i].parent?.remove(toRemove[i]);
  }
  delete clone.userData.cartoonRig;
}

function applyToastLookToClone(clone, toastLevel) {
  const lv = THREE.MathUtils.clamp(toastLevel, 0, 1);
  clone.traverse((ch) => {
    if (!ch.isMesh || !ch.material) return;
    const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
    const cloned = arr.map((orig) => {
      const m = orig.clone();
      const nm = (orig.name || '').toLowerCase();
      if (m.color && !nm.includes('eye') && !nm.includes('black') && !nm.includes('outline')) {
        const origCol = m.color.clone();
        if (lv < 0.58) m.color.copy(origCol).lerp(C_GOLDEN, lv / 0.58);
        else m.color.copy(C_GOLDEN).lerp(C_CHAR, (lv - 0.58) / 0.42);
        m.roughness = THREE.MathUtils.lerp(m.roughness ?? 0.28, 0.78, lv);
        if (m.emissive) {
          m.emissive.setRGB(0.18 * lv, 0.06 * lv, 0.01 * lv);
          m.emissiveIntensity = 0.35;
        }
      }
      return m;
    });
    ch.material = Array.isArray(ch.material) ? cloned : cloned[0];
  });
}

function updateDuckMaterialToast(entry, heatGlow = 0) {
  const lv = THREE.MathUtils.clamp(entry.toast, 0, 1);
  for (const mEntry of entry.mats) {
    if (lv < 0.58) {
      mEntry.mat.color.copy(mEntry.origColor).lerp(C_GOLDEN, lv / 0.58);
    } else {
      mEntry.mat.color.copy(C_GOLDEN).lerp(C_CHAR, (lv - 0.58) / 0.42);
    }
    mEntry.mat.roughness = THREE.MathUtils.lerp(mEntry.origRough, 0.85, lv);
    if (mEntry.mat.emissive) {
      const g = Math.max(lv * 0.20, heatGlow * 0.42);
      mEntry.mat.emissive.setRGB(0.28 * g, 0.08 * g, 0.01 * g);
      mEntry.mat.emissiveIntensity = g > 0.01 ? 0.55 : 0.0;
    }
  }
}

function rebuildHandheldSkewer(preserveToast = false) {
  const prevToasts = preserveToast ? skewerDuckEntries.map((e) => e.toast) : [];
  while (skewerDuckHolder.children.length) skewerDuckHolder.remove(skewerDuckHolder.children[0]);
  skewerDuckEntries = [];

  const n = skewerList.length;
  for (let i = 0; i < n; i++) {
    const id = skewerList[i];
    const tpl = duckTemplateMap.get(id) || duckTemplateMap.get('classic');
    if (!tpl) continue;
    const clone = tpl.clone(true);
    stripCloneDecorations(clone);
    const box = new THREE.Box3().setFromObject(clone);
    const sz = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(sz.x, sz.y, sz.z, 0.01);
    clone.scale.multiplyScalar(0.098 / maxDim);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    const box2 = new THREE.Box3().setFromObject(clone);
    const cen = box2.getCenter(new THREE.Vector3());
    clone.position.sub(cen);

    const wrap = new THREE.Group();
    wrap.add(clone);
    const yAlong = n === 1 ? 0.50 : THREE.MathUtils.lerp(0.32, 0.64, i / (n - 1));
    wrap.position.set(0, yAlong, 0);
    wrap.rotation.set(0, Math.PI * 0.42 + (i - 1.5) * 0.22, -Math.PI * 0.24);
    skewerDuckHolder.add(wrap);

    const mats = [];
    clone.traverse((ch) => {
      if (ch.isMesh && ch.material) {
        const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
        const clonedMats = arr.map((orig) => {
          const c = orig.clone();
          const onm = (orig.name || '').toLowerCase();
          if (c.color && !onm.includes('eye') && !onm.includes('black') && !onm.includes('outline')) {
            mats.push({ mat: c, origColor: c.color.clone(), origRough: c.roughness ?? 0.25 });
          }
          return c;
        });
        ch.material = Array.isArray(ch.material) ? clonedMats : clonedMats[0];
      }
    });

    const entry = { id, root: wrap, mats, toast: prevToasts[i] ?? 0.0 };
    updateDuckMaterialToast(entry, 0);
    skewerDuckEntries.push(entry);
  }
  renderCampfireMinimalBar();
}

function addDuckToSkewer(varietyId) {
  if (skewerList.length >= 4) skewerList.shift();
  skewerList.push(varietyId);
  rebuildHandheldSkewer(true);
}
function removeDuckSlot(idx) {
  if (idx < 0 || idx >= skewerList.length) return;
  skewerList.splice(idx, 1);
  rebuildHandheldSkewer(true);
}
function resetFreshSkewer() {
  if (skewerList.length === 0) skewerList = ['classic', 'mint', 'cherry'];
  rebuildHandheldSkewer(false);
}

const cfReleaseBtn = document.getElementById('btn-cf-release');

function averageSkewerToast() {
  if (!skewerDuckEntries.length) return 0;
  return skewerDuckEntries.reduce((s, e) => s + e.toast, 0) / skewerDuckEntries.length;
}

function updateRoastReadout() {
  const el = document.getElementById('cf-roast-readout');
  if (!el) return;
  if (!skewerDuckEntries.length) {
    el.textContent = '빈 꼬치';
    cfReleaseBtn?.classList.add('hidden');
    return;
  }
  const avg = averageSkewerToast();
  const pct = Math.round(avg * 100);
  const tier = classifyRoastTier(avg);
  el.textContent = tier === ROAST_TIERS.RAW ? `${pct}%`
    : tier === ROAST_TIERS.TOASTY ? `노릇 ${pct}%`
    : tier === ROAST_TIERS.GOLDEN ? `골든 ${pct}%`
    : `그을림 ${pct}%`;

  const unlockRes = sanctuaryLoop.recordRoast(avg, Date.now());
  if (unlockRes.newlyUnlocked) {
    burstSparks(56);
    showToast(`🔥 특선 해금! 「${unlockRes.newlyUnlocked.name}」을(를) 성소 풀에 띄울 수 있습니다.`);
  }
  if (cfReleaseBtn) {
    const readyUnlock = hearthUnlockForToast(avg);
    cfReleaseBtn.classList.toggle('hidden', !readyUnlock);
    if (readyUnlock === 'golden_smore') cfReleaseBtn.textContent = '✨ 골든 덕 띄우기';
    else if (readyUnlock === 'charred_ember') cfReleaseBtn.textContent = '🔥 숯불 덕 띄우기';
  }
}

function setAllSkewerToast(level01) {
  const lv = THREE.MathUtils.clamp(level01, 0, 1);
  for (const e of skewerDuckEntries) {
    e.toast = lv;
    updateDuckMaterialToast(e, lv * 0.4);
  }
  updateRoastReadout();
}

// =========================================================================
// CUSTOM WATERCOLOR DUCK & HEARTH ROASTED DUCK SPAWNER (CORE LOOP!)
// =========================================================================
function findDuckById(duckId) {
  return duckRoots.find((d) => d.id === duckId) || null;
}

function spawnCircuitSpecialDuck({
  id,
  designId = null,
  name,
  hex,
  hatId = 'none',
  textureDataUrl = null,
  toastLevel = null,
  launchSplash = true,
  startU = 0.04,
}) {
  const existing = findDuckById(id);
  if (existing) {
    if (launchSplash) {
      existing.launchT = 0.001;
      sanctuaryPhysics.applyImpulse(existing.id, 0.35, -0.25, 0.35);
    }
    return existing;
  }
  const tpl = duckTemplateMap.get('classic') || duckTemplateMap.values().next().value;
  if (!tpl) return null;

  const clone = tpl.clone(true);
  stripCloneDecorations(clone);
  clone.name = `Duck_Special_${id}`;
  clone.rotation.order = 'YXZ';
  const baseScale = tpl.scale.clone().multiplyScalar(1.06);
  clone.scale.copy(baseScale);

  if (textureDataUrl) {
    const tex = new THREE.TextureLoader().load(textureDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    clone.traverse((ch) => {
      if (!ch.isMesh || !ch.material) return;
      const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
      const mapped = arr.map((orig) => {
        const m = orig.clone();
        const nm = (ch.name + ' ' + (orig.name || '')).toLowerCase();
        const isBody = nm.includes('body') || (!nm.includes('beak') && !nm.includes('eye') && !nm.includes('sphere'));
        if (isBody) {
          m.map = tex;
          m.color.setHex(0xffffff);
          m.roughness = 0.34;
          m.metalness = 0.02;
          m.needsUpdate = true;
        }
        return m;
      });
      ch.material = Array.isArray(ch.material) ? mapped : mapped[0];
    });
  } else if (designId) {
    applyOfficialDuckDesign(clone, designId, assetUrl);
  } else if (toastLevel !== null) {
    applyToastLookToClone(clone, toastLevel);
  }

  const resolvedHatId = hatId && hatId !== 'none' ? hatId : (getSignatureHatForDesign(designId) || 'none');
  const hatMesh = resolvedHatId !== 'none' ? attachDuckHat(clone, resolvedHatId) : null;
  const cartoonRig = attachCartoonDuckFeatures(clone, designId || 'custom');
  customDuckGroup.add(clone);

  const physDesign = designId || (toastLevel !== null ? id : 'custom');
  const pose = sanctuaryPhysics.addDuck({
    id,
    designId: physDesign,
    name,
    hex,
    u: startU,
  });
  clone.position.set(pose.x, pose.y, pose.z);

  const entry = {
    id,
    designId: physDesign,
    kind: 'circuit',
    isSpecial: true,
    name,
    hex,
    hatId: resolvedHatId,
    hatMesh,
    cartoonRig,
    physPose: pose,
    obj: clone,
    basePos: clone.position.clone(),
    baseScale,
    baseYaw: 0,
    phase: duckRoots.length * 0.77,
    stage: pose.stage,
    hopT: launchSplash ? 1.0 : 0.0,
    launchT: launchSplash ? 0.001 : 0.0,
    launchFrom: b2t(2.85, -5.57, 1.35),
  };

  duckRoots.push(entry);
  duckPickTargets.push({ obj: clone, entry, label: i18n.t('ride.rideWith', { name }) });
  if (launchSplash) {
    sanctuaryPhysics.applyRadialWave(pose.x, pose.z, 1.8, 0.9);
    spawnWaterRipple(pose.x, pose.y, pose.z, 1.8);
    duckSqueak(entry);
  }
  return entry;
}

function captureWatercolorThumbnail() {
  const eng = initWatercolorEngine();
  const tmp = document.createElement('canvas');
  tmp.width = 360;
  tmp.height = 270;
  const ctx2d = tmp.getContext('2d');
  ctx2d.fillStyle = '#f8f3e6';
  ctx2d.fillRect(0, 0, tmp.width, tmp.height);
  ctx2d.drawImage(eng.canvas, 0, 0, tmp.width, tmp.height);
  return tmp.toDataURL('image/jpeg', 0.86);
}

function releaseCustomWatercolorDuck() {
  const dataUrl = captureWatercolorThumbnail();
  const record = sanctuaryLoop.addCustomDuck({
    dataUrl,
    hex: wcActivePigmentHex,
    timestamp: Date.now(),
  });
  const duckEntry = spawnCircuitSpecialDuck({
    id: record.id,
    name: record.name,
    hex: record.hex,
    textureDataUrl: record.dataUrl,
    launchSplash: true,
    startU: 0.34, // Right approaching the Copper Slide so player sees it splash and ride immediately!
  });
  exitFocusMode(true);
  if (duckEntry) {
    duckEntry.launchFrom = b2t(2.85, -5.57, 1.35);
    startFollowDuck(duckEntry);
  }
  sanctuaryGraph.addBait('ink', 2, 'atelier->fishing');
  syncFishingUi();
  syncCompanionExtrasUi();
  showToast(i18n.t('toast.atelierJoined', { name: record.name }));
  checkSecrets();
  return record;
}

function releaseRoastedHearthDuck() {
  const avg = averageSkewerToast();
  const unlockId = hearthUnlockForToast(avg);
  if (!unlockId) return null;
  sanctuaryLoop.recordRoast(avg, Date.now());
  const spec = SPECIAL_HEARTH_DUCKS[unlockId];
  const duckEntry = spawnCircuitSpecialDuck({
    id: spec.id,
    name: i18n.t(`duck.${spec.id}`),
    hex: spec.hex,
    toastLevel: spec.toastLevel,
    launchSplash: true,
    startU: 0.37,
  });
  exitFocusMode(true);
  if (duckEntry) {
    duckEntry.launchFrom = b2t(-8.60, -14.20, -1.20);
    startFollowDuck(duckEntry);
  }
  sanctuaryGraph.addBait('smore', 2, 'campfire->fishing');
  syncFishingUi();
  syncCompanionExtrasUi();
  showToast(i18n.t('toast.hearthJoined', { name: i18n.t(`duck.${spec.id}`) }));
  checkSecrets();
  return spec;
}

// =========================================================================
// RIDE-ALONG FOLLOW-DUCK CAMERA & PETTING JUICE
// =========================================================================
const followDuckUI = document.getElementById('follow-duck-ui');
const followDuckDot = document.getElementById('follow-duck-dot');
const followDuckName = document.getElementById('follow-duck-name');
const followDuckTrait = document.getElementById('follow-duck-trait');
const followDuckPal = document.getElementById('follow-duck-pal');
const followDuckStage = document.getElementById('follow-duck-stage');
const renameInputEl = document.getElementById('input-duck-rename');
const fishingFocusUI = document.getElementById('fishing-focus-ui');
const onsenTerminalUI = document.getElementById('onsen-terminal-ui');
const termOutputEl = document.getElementById('term-output');
const termInputEl = document.getElementById('term-input');

let selectedPomoMinutes = 25;

function formatClockMMSS(sec) {
  const s = Math.max(0, Math.ceil(sec || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function syncFollowPalBadge() {
  if (!followDuckPal) return;
  if (!followedDuck) {
    followDuckPal.classList.add('hidden');
    return;
  }
  const partner = dramaEngine.getPartnerForDuck(followedDuck.id);
  if (partner) {
    followDuckPal.textContent = i18n.t('drama.palBadge', { name: partner });
    followDuckPal.classList.remove('hidden');
  } else {
    followDuckPal.classList.add('hidden');
  }
}

function awardCompletedRequests(completed = []) {
  if (!completed.length) return;
  const lang = i18n.getLang();
  for (const req of completed) {
    sanctuaryGraph.addShells(req.rewardShells, 'requests->shells');
    if (req.rewardBait) {
      sanctuaryGraph.addBait(req.rewardBait.id, req.rewardBait.count, 'requests->fishing');
    }
    ambientAudio.playCue('windchime');
    showToast(i18n.t('requests.completed', {
      title: req.title[lang] || req.title.en,
      shells: req.rewardShells,
    }), 4200);
  }
  syncFishingUi();
  syncCompanionExtrasUi();
  sanctuaryBook?.refresh();
}

function handlePomodoroComplete(res) {
  if (!res?.completed) return;
  let duckLabel = 'Mystery Duck';
  if (res.arrived) {
    const entry = spawnGraphDesignDuck(res.arrived.id, { launchSplash: true, startU: 0.14 });
    duckLabel = entry?.name || i18n.t(`duck.${res.arrived.id}`);
  }
  ambientAudio.playCue('windchime');
  showToast(i18n.t('pomodoro.completed', { shells: res.shellsAwarded, duck: duckLabel }), 4600);
  syncCompanionExtrasUi();
  syncFishingUi();
  sanctuaryBook?.refresh();
}

function buyShellItemAndFeedback(itemId) {
  const present = duckRoots.map((d) => d.designId).filter(Boolean);
  const res = sanctuaryGraph.buyShellItem(itemId, present);
  if (!res.ok) {
    showToast(i18n.t(res.reason === 'all_hats_unlocked' ? 'shop.allHats' : 'shop.noShells'), 2800);
    return res;
  }
  if (res.arrived) {
    spawnGraphDesignDuck(res.arrived.id, { launchSplash: true, startU: 0.16 });
  }
  ambientAudio.playCue('chime');
  showToast(i18n.t('shop.bought', { label: i18n.t(`shop.${itemId}`) }), 3200);
  syncFishingUi();
  syncCompanionExtrasUi();
  sanctuaryBook?.refresh();
  return res;
}

function syncCompanionExtrasUi() {
  const gst = sanctuaryGraph.getState();
  const dst = dramaEngine.getState();
  const lang = i18n.getLang();

  const shellEl = document.getElementById('val-cmp-shells');
  if (shellEl) shellEl.textContent = `🐚 ${gst.shells}`;

  const clockEl = document.getElementById('val-pomo-clock');
  if (clockEl) clockEl.textContent = formatClockMMSS(gst.pomodoro.remainingSec);
  const toggleBtn = document.getElementById('btn-pomo-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = i18n.t(gst.pomodoro.running ? 'pomodoro.pause' : 'pomodoro.start');
    toggleBtn.classList.toggle('active', gst.pomodoro.running);
  }

  const shopEl = document.getElementById('cmp-shop-grid');
  if (shopEl) {
    if (shopEl.childElementCount !== SHELL_SHOP_ITEMS.length) {
      shopEl.textContent = '';
      for (const item of SHELL_SHOP_ITEMS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cmp-shop-btn';
        btn.dataset.shopItem = item.id;
        const labelSpan = document.createElement('span');
        const costEm = document.createElement('em');
        btn.append(labelSpan, costEm);
        btn.addEventListener('click', () => buyShellItemAndFeedback(item.id));
        shopEl.appendChild(btn);
      }
    }
    const buttons = shopEl.children;
    for (let i = 0; i < SHELL_SHOP_ITEMS.length; i++) {
      const item = SHELL_SHOP_ITEMS[i];
      const btn = buttons[i];
      if (!btn) continue;
      const labelSpan = btn.firstElementChild;
      const costEm = btn.lastElementChild;
      if (labelSpan) labelSpan.textContent = i18n.t(`shop.${item.id}`);
      if (costEm) costEm.textContent = `${item.cost}🐚`;
    }
  }

  const reqCountEl = document.getElementById('val-cmp-req-count');
  if (reqCountEl) reqCountEl.textContent = `${dst.completedRequests.length}/${dst.totalRequests}`;
  const reqListEl = document.getElementById('cmp-request-list');
  if (reqListEl) {
    reqListEl.innerHTML = '';
    const active = dramaEngine.getActiveRequests(lang, 3);
    if (!active.length) {
      const li = document.createElement('li');
      li.className = 'cmp-req-item done';
      li.textContent = i18n.t('requests.allDone');
      reqListEl.appendChild(li);
    } else {
      for (const r of active) {
        const li = document.createElement('li');
        li.className = 'cmp-req-item';
        li.innerHTML = `<span>○ ${r.title}</span><em>+${r.rewardShells}🐚</em>`;
        reqListEl.appendChild(li);
      }
    }
  }
}

function spawnGraphDesignDuck(designId, { launchSplash = true, startU = 0.12, launchFrom = b2t(1.2, 1.5, 4.2) } = {}) {
  if (!designId) return null;
  const designMeta = DESIGNS.find((d) => d.id === designId);
  if (!designMeta) return null;
  const duckId = `graph_${designId}`;
  const name = sanctuaryGraph.getDuckName(duckId, i18n.t(`duck.${designId}`));
  const entry = spawnCircuitSpecialDuck({
    id: duckId,
    designId,
    name,
    hex: designMeta.fx?.colours?.[0] || '#ffd84a',
    hatId: sanctuaryGraph.getDuckHat(duckId),
    launchSplash,
    startU,
  });
  if (entry && launchSplash) {
    entry.launchFrom = launchFrom.clone();
    duckPoses.triggerPose(entry.id, 'hatch', 1.45);
    dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 0xffe484, 14, 1.8);
    dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'star');
    ambientAudio.playCue('arrival');
  }
  sanctuaryBook?.refresh();
  return entry;
}

function renameDuckById(duckId, rawName) {
  const entry = findDuckById(duckId);
  if (!entry) return { ok: false, name: '', argUnlocked: null };
  const res = sanctuaryGraph.renameDuck(duckId, rawName, i18n.getLang());
  if (!res.ok) return res;
  entry.name = res.name;
  const pick = duckPickTargets.find((p) => p.entry === entry);
  if (pick) pick.label = i18n.t('ride.rideWith', { name: res.name });
  if (followedDuck === entry && followDuckName) followDuckName.textContent = res.name;
  if (res.argUnlocked) {
    spawnGraphDesignDuck(res.argUnlocked.unlocks, { launchSplash: true, startU: 0.18 });
    showToast(`🔓 ${res.argUnlocked.message}`, 4400);
  }
  awardCompletedRequests(dramaEngine.recordAction('rename').completed);
  return res;
}

function cycleDuckHatById(duckId) {
  const entry = findDuckById(duckId);
  if (!entry) return 'none';
  const nextHat = sanctuaryGraph.cycleDuckHat(duckId);
  entry.hatId = nextHat;
  entry.hatMesh = attachDuckHat(entry.obj, nextHat);
  petDuck(entry);
  dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y + 0.3, entry.obj.position.z, 0x9ef8e8, 10, 1.3);
  if (nextHat !== 'none') {
    awardCompletedRequests(dramaEngine.recordAction('hat').completed);
  }
  return nextHat;
}

function selectBaitAndSync(baitId) {
  const chosen = sanctuaryGraph.selectBait(baitId);
  syncFishingUi();
  return chosen;
}

function syncFishingUi() {
  const gst = sanctuaryGraph.getState();
  const st = gst.fishing;
  const statusEl = document.getElementById('fish-status');
  const btn = document.getElementById('btn-fish-action');
  const countEl = document.getElementById('fish-catch-count');
  const shellEl = document.getElementById('fish-shell-count');
  const reelWrap = document.getElementById('fish-reel-wrap');
  const reelFill = document.getElementById('fish-reel-fill');
  const baitRow = document.getElementById('fish-bait-row');
  const shownBait = st.phase !== 'idle' ? st.activeBait : gst.selectedBait;

  if (countEl) countEl.textContent = `🐟 ${st.catches}`;
  if (shellEl) shellEl.textContent = `🐚 ${gst.shells}`;
  if (baitRow) {
    if (baitRow.childElementCount !== FISHING_BAITS.length) {
      baitRow.textContent = '';
      for (const b of FISHING_BAITS) {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.dataset.baitId = b.id;
        pill.addEventListener('click', () => selectBaitAndSync(b.id));
        baitRow.appendChild(pill);
      }
    }
    const pills = baitRow.children;
    for (let i = 0; i < FISHING_BAITS.length; i++) {
      const b = FISHING_BAITS[i];
      const pill = pills[i];
      if (!pill) continue;
      const qty = b.infinite ? '∞' : (gst.baits[b.id] || 0);
      const isEmpty = !b.infinite && qty <= 0 && shownBait !== b.id;
      pill.className = `fish-bait-btn${shownBait === b.id ? ' active' : ''}${isEmpty ? ' empty' : ''}`;
      pill.textContent = `${b.icon} ${i18n.t(`bait.${b.id}`)}${b.infinite ? '' : ` ${qty}`}`;
    }
  }

  const showGauge = st.phase === 'biting' || st.phase === 'reeling';
  if (reelWrap) reelWrap.classList.toggle('hidden', !showGauge);
  if (reelFill) reelFill.style.width = `${Math.round(st.reelProgress * 100)}%`;

  if (!statusEl || !btn) return;
  btn.classList.toggle('biting', showGauge);
  if (st.phase === 'idle') {
    statusEl.textContent = i18n.t('hover.fishing');
    btn.textContent = i18n.t('fishing.cast');
  } else if (st.phase === 'waiting') {
    statusEl.textContent = i18n.t('fishing.waiting');
    btn.textContent = i18n.t('fishing.cancel');
  } else if (st.phase === 'reeling') {
    statusEl.textContent = i18n.t('fishing.reeling');
    btn.textContent = `${i18n.t('fishing.reel')} ${Math.round(st.reelProgress * 100)}%`;
  } else {
    statusEl.textContent = i18n.t('fishing.bite');
    btn.textContent = i18n.t('fishing.reel');
  }
}

function handleFishingAction(forceCatch = false, pump = 0.36) {
  const st = sanctuaryGraph.getState().fishing;
  if (!forceCatch && st.phase === 'idle') {
    sanctuaryGraph.castLine();
    ambientAudio.playCue('chime');
    const bp = dramaVfx.bobberGroup.position;
    dramaVfx.emitBurst(bp.x, bp.y, bp.z, 0x8efce8, 10, 1.3);
    syncFishingUi();
    return { action: 'cast' };
  }
  const simNow = Math.max(clock ? clock.getElapsedTime() : 0, logbookSync.getMaxObservedTime() + 0.05);
  const res = sanctuaryGraph.reelLine({ logbook: sharedLogbook, lang: i18n.getLang(), forceCatch, pump, simTime: simNow });
  syncFishingUi();
  if (!res.caught && res.phase === 'reeling') {
    ambientAudio.playCue('chime');
    const bp = dramaVfx.bobberGroup.position;
    dramaVfx.emitBurst(bp.x, bp.y + 0.08, bp.z, 0x9efcf4, 8, 1.45);
    return res;
  }
  if (res.caught && res.reward) {
    ambientAudio.playCue('catch');
    dramaVfx.triggerCatchReveal(res.catchInfo?.colorHex || 0xffe680);
    if (res.catchInfo?.baitUsed && res.catchInfo.baitUsed !== 'basic') {
      awardCompletedRequests(dramaEngine.recordAction('crafted_bait_catch').completed);
    }
    const ci = res.catchInfo;
    const rw = res.reward;
    const spLine = ci
      ? i18n.t('fishing.caughtSpecies', {
          rarity: i18n.t(`rarity.${ci.rarity}`),
          species: ci.name,
          cm: ci.cm,
          shells: ci.shells,
        })
      : '';
    if (rw.kind === 'collectible') {
      showToast(`${spLine} · ${i18n.t('fishing.caughtCollectible', { title: rw.title })}`, 4500);
    } else if (rw.kind === 'hat') {
      showToast(`${spLine} · ${i18n.t('fishing.caughtHat', { label: rw.label })}`, 4400);
    } else if (rw.kind === 'bottle_clue') {
      showToast(`${spLine} · ${i18n.t('fishing.caughtClue')}`, 4500);
    } else {
      showToast(spLine || i18n.t('fishing.caughtGlass'), 3600);
    }
    if (ci && (ci.rarity === 'rare' || ci.rarity === 'mythic' || ci.cm >= 45)) {
      triggerCartoonCutin(i18n.t('quirk.cutinRareCatch'), spLine, '수안보 대어');
    }
    syncCompanionExtrasUi();
    sanctuaryBook?.refresh();
  }
  return res;
}

const terminalHistory = [];
function appendTerminalLines(lines) {
  for (const l of lines) terminalHistory.push(l);
  while (terminalHistory.length > 18) terminalHistory.shift();
  if (termOutputEl) {
    termOutputEl.textContent = terminalHistory.join('\n');
    termOutputEl.scrollTop = termOutputEl.scrollHeight;
  }
}

function openOnsenTerminal(forceOpen) {
  if (!onsenTerminalUI) return false;
  const open = typeof forceOpen === 'boolean' ? forceOpen : onsenTerminalUI.classList.contains('hidden');
  onsenTerminalUI.classList.toggle('hidden', !open);
  document.getElementById('btn-onsen-terminal')?.classList.toggle('active', open);
  if (open) {
    ambientAudio.playCue('terminal');
    if (terminalHistory.length === 0) {
      const help = sanctuaryGraph.runTerminalCommand('HELP', { lang: i18n.getLang() });
      appendTerminalLines(help.lines);
    }
    termInputEl?.focus();
  }
  return open;
}

function runTerminalAndShow(cmd) {
  const clean = String(cmd || '').trim();
  if (!clean) return null;
  appendTerminalLines([`> ${clean}`]);
  const res = sanctuaryGraph.runTerminalCommand(clean, {
    lang: i18n.getLang(),
    stats: { duckCount: duckRoots.length, collisions: sanctuaryPhysics.getStats().collisionCount },
  });
  appendTerminalLines(res.lines);
  ambientAudio.playCue('terminal');
  if (res.freq) {
    document.querySelectorAll('.term-freq-btn').forEach((b) => b.classList.toggle('active', b.dataset.freq === res.freq));
    if (res.freq === '104.2') {
      quirksEngine.triggerSubliminal('quirk.subliminal1', 0.05);
    }
  }
  if (res.weatherCmd) {
    setWeatherMode(res.weatherCmd, false);
  }
  if (res.dropYuzu) {
    dropYuzuInPool(2.4, -0.10, -1.6);
  }
  if (res.unlockedDuck) {
    spawnGraphDesignDuck(res.unlockedDuck, { launchSplash: true, startU: 0.22 });
    const dName = i18n.t(`duck.${res.unlockedDuck}`);
    showToast(`📻 ${dName} — ${res.lines[0]}`, 4200);
  }
  if (res.ok && (res.freq || res.unlockedDuck)) {
    awardCompletedRequests(dramaEngine.recordAction('terminal').completed);
  }
  return res;
}

function strumCampfireGuitar(chordIdx) {
  const res = sanctuaryGraph.recordGuitarStrum(chordIdx, i18n.getLang());
  const { chord, recentChords, harmony } = res;
  ambientAudio.strumGuitarChord(chord.freqs);
  burstSparks(harmony ? 58 : 22);
  cfStoke = Math.min(1, cfStoke + (harmony ? 0.65 : 0.25));
  // Ducks subtly hop & sing in rhythm with campfire guitar strums!
  for (let i = 0; i < duckRoots.length; i += harmony ? 1 : 3) {
    if (duckRoots[i].obj.visible) {
      duckRoots[i].hopT = Math.max(duckRoots[i].hopT, harmony ? 0.95 : 0.62);
      if (i % (harmony ? 4 : 9) === 0) {
        const p = duckRoots[i].obj.position;
        dramaVfx.emitEmote(p.x, p.y, p.z, 'music');
      }
    }
  }
  const btns = document.querySelectorAll('.cf-chord-btn');
  btns.forEach((b, i) => {
    if (i === chordIdx) {
      b.classList.add('strummed');
      setTimeout(() => b.classList.remove('strummed'), 220);
    }
  });
  const pips = document.querySelectorAll('#cf-chord-seq span');
  pips.forEach((sp, i) => sp.classList.toggle('lit', harmony ? true : i < recentChords.length));

  if (harmony) {
    ambientAudio.playCue('windchime');
    if (harmony.unlocksDuck) {
      spawnGraphDesignDuck(harmony.unlocksDuck, { launchSplash: true, startU: 0.20 });
    }
    showToast(i18n.t('harmony.unlocked', { title: harmony.title, shells: harmony.rewardShells }), 4600);
    triggerCartoonCutin(i18n.t('quirk.cutinHarmony'), harmony.title, '수안보 합창');
    awardCompletedRequests(dramaEngine.recordAction('harmony').completed);
    syncCompanionExtrasUi();
    syncFishingUi();
    sanctuaryBook?.refresh();
  }
  return res;
}

function isFlatWaterStage(stage) {
  return !stage
    || stage === 'upper_pool'
    || stage === 'grotto'
    || stage === 'intake_channel'
    || stage === 'flamingo'
    || stage === 'upper_swim';
}

function petDuck(entry) {
  if (!entry) return;
  entry.hopT = 1.0;
  duckPoses.triggerPose(entry.id, 'happy_splash', 1.1);
  sanctuaryLoop.recordPet();
  if (entry.physPose) {
    sanctuaryPhysics.applyImpulse(entry.id, Math.cos(entry.phase) * 0.45, Math.sin(entry.phase) * 0.45, 0.32);
    sanctuaryPhysics.applyRadialWave(entry.obj.position.x, entry.obj.position.z, 1.4, 0.7);
  }
  if (isFlatWaterStage(entry.stage)) {
    spawnWaterRipple(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 1.35);
  }
  dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y + 0.2, entry.obj.position.z, 0xffe484, 7, 1.1);
  dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'heart');
  duckSqueak(entry, 'voice');
  checkSecrets();
}

function tossDuck(entry) {
  if (!entry) return false;
  entry.hopT = 1.65;
  sanctuaryLoop.recordPet();
  const yaw = entry.obj.rotation.y || 0;
  if (entry.physPose) {
    sanctuaryPhysics.applyImpulse(entry.id, Math.sin(yaw) * 1.45, Math.cos(yaw) * 1.45, 0.72);
    sanctuaryPhysics.applyRadialWave(entry.obj.position.x, entry.obj.position.z, 2.6, 1.45);
  }
  if (isFlatWaterStage(entry.stage)) {
    spawnWaterRipple(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 2.0);
  }
  dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y + 0.25, entry.obj.position.z, 0x9efcf4, 14, 1.85);
  dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'splash');
  ambientAudio.playCue('splash', entry.obj.position);
  duckSqueak(entry);
  checkSecrets();
  return true;
}

function dropYuzuInPool(x = 2.6, y = -0.10, z = -1.6) {
  dramaVfx.spawnYuzu(x, y, z);
  spawnWaterRipple(x, y, z, 1.75);
  sanctuaryPhysics.applyRadialWave(x, z, 2.4, 0.45);
  ambientAudio.playCue('yuzu', { x, y, z });
  sanctuaryGraph.addBait('yuzu', 1, 'yuzu->fishing');
  awardCompletedRequests(dramaEngine.recordAction('yuzu').completed);
  syncFishingUi();
  showWhisper(i18n.t('whisper.yuzu'));
  return { x, y, z, activeCount: dramaVfx.getActiveYuzus().length };
}

function startFollowDuck(entry) {
  if (!entry) return;
  if (focusMode) exitFocusMode(true);
  followedDuck = entry;
  camTween = null;
  whisperEl?.classList.add('hidden');
  sanctuaryLoop.recordRide();
  petDuck(entry);
  if (followDuckUI) followDuckUI.classList.remove('hidden');
  if (followDuckDot) followDuckDot.style.background = entry.hex || '#f2c138';
  if (followDuckName) {
    followDuckName.textContent = entry.name;
    followDuckName.classList.remove('hidden');
  }
  if (renameInputEl) renameInputEl.classList.add('hidden');
  if (followDuckTrait) {
    const tr = entry.physPose?.trait || 'standard';
    followDuckTrait.textContent = i18n.t(`trait.${tr}`);
  }
  syncFollowPalBadge();
  if (followDuckStage) followDuckStage.textContent = i18n.t(`stage.${entry.stage}`) || i18n.t('ui.sanctuaryPool');
  controls.minDistance = 0.85;
  controls.maxDistance = 12;
  const p = entry.obj.position;
  controls.target.copy(p);
  camera.position.set(p.x - 1.9, p.y + 1.35, p.z + 2.35);
  camera.fov = 46;
  camera.updateProjectionMatrix();
  controls.update();
}

function stopFollowDuck(returnHero = true, instant = false) {
  if (!followedDuck) return;
  followedDuck = null;
  if (followDuckUI) followDuckUI.classList.add('hidden');
  controls.minDistance = 0.5;
  controls.maxDistance = 68;
  if (returnHero) goPreset('hero', instant);
}

function cycleFollowDuck() {
  const riders = duckRoots.filter((d) => d.kind === 'circuit' && d.obj.visible);
  if (!riders.length) return;
  const idx = riders.indexOf(followedDuck);
  startFollowDuck(riders[(idx + 1) % riders.length]);
}

function crankThermalValve(dir = 1) {
  ambientAudio.ensure();
  ambientAudio.playCue('valve');
  const res = quirksEngine.crankValve(dir);
  syncValveUi();
  if (res.resonanceTriggered) {
    ambientAudio.playCue('stare');
    sanctuaryGraph.recordEdge('valve->stare');
    triggerCartoonCutin(i18n.t('quirk.resonanceCutin'), i18n.t('quirk.resonanceSub'), '38.4°C 극비');
  }
  return res;
}

function tiltDuckAccessoryById(duckId) {
  const entry = findDuckById(duckId) || followedDuck;
  if (!entry) return null;
  if (!entry.hatMesh) {
    const fallbackHat = getSignatureHatForDesign(entry.designId) || 'towel';
    entry.hatId = fallbackHat;
    entry.hatMesh = attachDuckHat(entry.obj, fallbackHat);
  }
  const res = quirksEngine.tiltAccessory(entry.id);
  setDuckHatTilt(entry.hatMesh, res.deg);
  duckSqueak(entry);
  if (res.slipped) {
    entry.hopT = Math.max(entry.hopT, 1.15);
    dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y + 0.36, entry.obj.position.z, 0xfff3d4, 10, 1.4);
  }
  showToast(i18n.t(res.noteKey), 2400);
  return res;
}

function squeezeAndFireDuckJet(duckId, simulatedHoldSec = 0) {
  const entry = findDuckById(duckId) || followedDuck;
  if (!entry) return null;
  if (simulatedHoldSec > 0) {
    quirksEngine.beginSqueeze(entry.id);
    const steps = Math.max(1, Math.round(simulatedHoldSec * 60));
    for (let i = 0; i < steps; i++) quirksEngine.step(1 / 60);
  }
  const rel = quirksEngine.releaseSqueeze(entry.id);
  if (rel.firedJet) {
    const yaw = entry.obj.rotation.y || 0;
    dramaVfx.emitWaterJet(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, yaw, rel.power);
    dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'jet');
    if (entry.physPose) {
      sanctuaryPhysics.applyImpulse(entry.id, -Math.sin(yaw) * (1.2 + rel.power * 1.6), -Math.cos(yaw) * (1.2 + rel.power * 1.6), 0.35);
    }
    if (isFlatWaterStage(entry.stage)) {
      spawnWaterRipple(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 1.85);
    }
    ambientAudio.playCue('waterjet', entry.obj.position);
    duckSqueak(entry);
    showToast(i18n.t('quirk.squeezeJet'), 2800);
  }
  return rel;
}

document.getElementById('btn-follow-squeak')?.addEventListener('click', () => petDuck(followedDuck));
document.getElementById('btn-follow-toss')?.addEventListener('click', () => tossDuck(followedDuck));
document.getElementById('btn-follow-tilt')?.addEventListener('click', () => {
  if (followedDuck) tiltDuckAccessoryById(followedDuck.id);
});
const followSqueezeBtn = document.getElementById('btn-follow-squeeze');
followSqueezeBtn?.addEventListener('pointerdown', () => {
  if (!followedDuck) return;
  quirksEngine.beginSqueeze(followedDuck.id);
  duckSqueak(followedDuck, 'voice');
});
followSqueezeBtn?.addEventListener('pointerup', () => {
  if (followedDuck) squeezeAndFireDuckJet(followedDuck.id, 0);
});
followSqueezeBtn?.addEventListener('pointerleave', () => {
  if (followedDuck && quirksEngine.getSqueezePressure(followedDuck.id) > 0) {
    squeezeAndFireDuckJet(followedDuck.id, 0);
  }
});
document.getElementById('btn-valve-up')?.addEventListener('click', () => crankThermalValve(1));
document.getElementById('btn-valve-down')?.addEventListener('click', () => crankThermalValve(-1));
document.getElementById('btn-onsen-valve-up')?.addEventListener('click', () => crankThermalValve(1));
document.getElementById('btn-onsen-valve-down')?.addEventListener('click', () => crankThermalValve(-1));
document.getElementById('btn-book-stamp')?.addEventListener('click', (e) => {
  if (!sanctuaryBook) return;
  const next = sanctuaryBook.setStampMode(!sanctuaryBook.getStampMode());
  e.currentTarget.classList.toggle('active', next);
  e.currentTarget.textContent = i18n.t(next ? 'quirk.stampModeOn' : 'quirk.stampMode');
});
syncValveUi();
document.getElementById('btn-follow-next')?.addEventListener('click', () => cycleFollowDuck());
document.getElementById('btn-follow-exit')?.addEventListener('click', () => stopFollowDuck(true));

// =========================================================================
// SMOOTH CAMERA TWEEN
// =========================================================================
let camTween = null;
function glideTo(pos, target, targetFov = 44, durationMs = 680) {
  const dur = reducedMotion?.matches ? Math.min(160, durationMs) : durationMs;
  camTween = {
    t0: performance.now(), dur,
    p0: camera.position.clone(), p1: pos.clone(),
    g0: controls.target.clone(), g1: target.clone(),
    f0: camera.fov, f1: targetFov,
  };
}
const sunbeams = createVolumetricSunbeams(scene);
const hatchEgg = createHatchEggProp(scene);
const duckPoses = createDuckPoseController();
let activeCameraScript = null;
let waterPovBasePos = null;

function syncCameraScriptButtons() {
  document.querySelectorAll('[data-cam-script]').forEach((b) => {
    b.classList.toggle('active', b.dataset.camScript === activeCameraScript);
  });
}

function triggerDuckPose(duckId, pose, durationSec = 1.6) {
  const entry = findDuckById(duckId);
  if (!entry) return false;
  const ok = duckPoses.triggerPose(entry.id, pose, durationSec);
  if (!ok) return false;
  if (pose === 'dive') {
    if (isFlatWaterStage(entry.stage)) spawnWaterRipple(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 1.8);
    dramaVfx.emitBurst(entry.obj.position.x, entry.obj.position.y + 0.12, entry.obj.position.z, 0x7ae8e0, 11, 1.5);
    dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'splash');
    ambientAudio.playCue('splash', entry.obj.position);
  } else if (pose === 'sleep') {
    dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'sleep');
  } else if (pose === 'happy_splash') {
    dramaVfx.emitEmote(entry.obj.position.x, entry.obj.position.y, entry.obj.position.z, 'heart');
  }
  return true;
}

function applyCameraScript(scriptId, instant = false) {
  const spec = MONOGRAPH_CAMERA_SCRIPTS.find((s) => s.id === scriptId);
  if (!spec) return null;
  if (focusMode) exitFocusMode(true);
  if (followedDuck) stopFollowDuck(false, true);
  activeCameraScript = spec.id;
  const pos = b2t(spec.pos[0], spec.pos[1], spec.pos[2]);
  const target = b2t(spec.target[0], spec.target[1], spec.target[2]);
  waterPovBasePos = spec.id === 'water_pov' ? pos.clone() : null;
  setTimeHour(spec.hour, 'manual');
  if (instant) {
    camTween = null;
    camera.position.copy(pos);
    controls.target.copy(target);
    camera.fov = spec.fov;
    camera.updateProjectionMatrix();
    controls.update();
  } else {
    glideTo(pos, target, spec.fov, 720);
  }
  syncCameraScriptButtons();
  return spec;
}

function goPreset(name, instant = false) {
  const p = CAMERA_PRESETS[name];
  if (!p) return;
  activeCameraScript = null;
  waterPovBasePos = null;
  syncCameraScriptButtons();
  const fov = p.fov || 44;
  if (instant) {
    camTween = null;
    camera.position.copy(p.pos);
    controls.target.copy(p.target);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.update();
  } else {
    glideTo(p.pos, p.target, fov, 680);
  }
}

// =========================================================================
// LAZY-LOADED ON-DEMAND BROWSER GPU PATH TRACER ('P' KEY)
// =========================================================================
let ptActive = false;
let pathTracer = null;
let ptSamples = 0;
let ptLoading = false;
let ptEquirectEnv = null;
const waterMeshes = [];
const ptWaterMat = new THREE.MeshPhysicalMaterial({
  color: 0x16c8b6,
  roughness: 0.05,
  metalness: 0.0,
  transmission: 0.82,
  ior: 1.333,
  thickness: 0.9,
});
const ptStatusPill = document.getElementById('pt-status-pill');
const ptSamplesEl = document.getElementById('pt-samples');

function makePtTwilightEquirect() {
  if (ptEquirectEnv) return ptEquirectEnv;
  const w = 128, h = 64;
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const phi = (1 - v) * Math.PI;
    const cy = Math.cos(phi);
    const sy = Math.sin(phi);
    for (let x = 0; x < w; x++) {
      const th = (x / w) * Math.PI * 2;
      const dx = sy * Math.cos(th), dz = sy * Math.sin(th);
      let r, g, b;
      if (cy >= 0) {
        const k = Math.pow(cy, 0.55);
        r = THREE.MathUtils.lerp(0.115, 0.035, k);
        g = THREE.MathUtils.lerp(0.210, 0.075, k);
        b = THREE.MathUtils.lerp(0.345, 0.165, k);
      } else {
        const k = Math.pow(-cy, 0.5);
        r = THREE.MathUtils.lerp(0.052, 0.030, k);
        g = THREE.MathUtils.lerp(0.095, 0.040, k);
        b = THREE.MathUtils.lerp(0.155, 0.060, k);
      }
      const moon = Math.exp(-((dx + 0.52) ** 2 + (cy - 0.72) ** 2 + (dz - 0.46) ** 2) * 18.0);
      r += moon * 1.4; g += moon * 1.7; b += moon * 2.3;
      const idx = (y * w + x) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 1.0;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  ptEquirectEnv = tex;
  return tex;
}

async function togglePathTracer(forceState) {
  const next = typeof forceState === 'boolean' ? forceState : !ptActive;
  if (next === ptActive || ptLoading) return;
  if (!next) {
    ptActive = false;
    fireVolumeMesh.visible = true;
    sparkMesh.visible = true;
    waterMeshes.forEach((w) => { w.mesh.material = w.webglMat; });
    scene.environment = twilightEnvTex;
    ptStatusPill.classList.add('hidden');
    return;
  }
  ptLoading = true;
  ptStatusPill.classList.remove('hidden');
  ptSamplesEl.textContent = 'Path Tracer 초기화 중...';
  try {
    if (!pathTracer) {
      const mod = await import('three-gpu-pathtracer');
      pathTracer = new mod.WebGLPathTracer(renderer);
      pathTracer.renderScale = 0.60;
      pathTracer.bounces = 4;
      pathTracer.filterGlossyFactor = 0.5;
    }
    fireVolumeMesh.visible = false;
    sparkMesh.visible = false;
    waterMeshes.forEach((w) => { w.mesh.material = ptWaterMat; });
    scene.environment = makePtTwilightEquirect();
    pathTracer.setScene(scene, camera);
    pathTracer.reset();
    ptSamples = 0;
    ptActive = true;
  } catch (err) {
    console.error('PathTracer init failed:', err);
    fireVolumeMesh.visible = true;
    sparkMesh.visible = true;
    waterMeshes.forEach((w) => { w.mesh.material = w.webglMat; });
    scene.environment = twilightEnvTex;
    ptStatusPill.classList.add('hidden');
  } finally {
    ptLoading = false;
  }
}

document.getElementById('btn-pt-exit')?.addEventListener('click', () => togglePathTracer(false));
controls.addEventListener('change', () => {
  if (ptActive && pathTracer) {
    pathTracer.updateCamera();
    ptSamples = 0;
  }
});

// =========================================================================
// PROGRESSIVE 4-CHUNK STREAMING GLB LOADER (CORE FIRST -> ONSEN/BOOK/STATIONS)
// =========================================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(assetUrl('sanctuary/draco/'));
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const chunkProgressEl = document.getElementById('chunk-progress');
const chunksLoaded = [];
const chunkTimings = {};
const loadT0 = performance.now();

function loadGlbAsync(relPath) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    loader.load(
      assetUrl(relPath),
      (gltf) => resolve({ gltf, ms: Math.round(performance.now() - t0) }),
      undefined,
      reject
    );
  });
}

function bindSceneNodes(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      const isTransparentFx = obj.name.includes('Water') || obj.name.includes('Glass') || obj.name.includes('Smoke') || obj.name.includes('Splash');
      const isSmallDetail =
        obj.name.includes('DuckEye') ||
        obj.name.includes('DuckBeak') ||
        obj.name.includes('Sphere') ||
        obj.name.startsWith('Book_') ||
        obj.name.startsWith('TrophyDuck_') ||
        obj.name.startsWith('UI_BucketDuck_');
      obj.castShadow = !isTransparentFx && !isSmallDetail;
      obj.receiveShadow = !isTransparentFx;

      if (obj.name.includes('L04_Rippling_Sanctuary_Water')) {
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((m) => (m.name.includes('Water') ? lygiaWaterMat : m));
        } else if (obj.material && obj.material.name.includes('Water')) {
          obj.material = lygiaWaterMat;
        }
        waterMeshes.push({ mesh: obj, webglMat: obj.material });
      }

      const matsList = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of matsList) {
        if (!m) continue;
        if ('transmission' in m && m.transmission > 0) {
          m.transmission = 0;
          m.transparent = true;
          m.depthWrite = false;
        }
        if (m.name.includes('Glass') || m.name.includes('Smoke')) {
          m.transparent = true;
          m.depthWrite = false;
        }
        if (m.name.includes('Water_Stream')) {
          m.transparent = true;
          m.opacity = 0.48;
          m.roughness = 0.06;
          m.color.setHex(0x48e0d8);
          m.depthWrite = false;
          if (m.map) {
            m.map.wrapS = THREE.RepeatWrapping;
            m.map.wrapT = THREE.RepeatWrapping;
            waterStreamTextures.push(m.map);
          }
        }
        if (m.name.includes('Watercolor_Canvas')) {
          wcFrontMat = m;
          wcMeshTarget = obj;
          m.color.setHex(0xffffff);
          m.roughness = 0.92;
        }
      }
    }

    if (
      obj.name === 'L03_Interior_Study_Furniture' ||
      obj.name === 'L03_Tokonoma_Ukiyoe_Duck_Scroll' ||
      obj.name === 'L03_Interior_Gold_Byobu_Screen' ||
      obj.name === 'UI_Control_BrightnessDial' ||
      obj.name === 'UI_Control_DuckCapSlider' ||
      obj.name === 'UI_Control_RadioConsole' ||
      (obj.name.startsWith('TrophyDuck_') && (!obj.parent || !obj.parent.name.startsWith('TrophyDuck_')) && obj.position.x < -10.0)
    ) {
      onsenIndoorObjs.push(obj);
    }

    if (
      obj.name.startsWith('Book_Tab_') ||
      obj.name === 'Book_Prop_PostIt' ||
      obj.name === 'Book_Prop_MaskingTape'
    ) {
      bookDetailObjs.push(obj);
    }

    if (
      obj.name === 'UI_Campfire_RoastSkewer' ||
      (obj.name.startsWith('UI_Campfire_RoastDuck_') && (!obj.parent || !obj.parent.name.startsWith('UI_Campfire_RoastDuck_')))
    ) {
      staticCampfireSkewerObjs.push(obj);
    }

    if (
      obj.name === 'UI_Prop_CollectionBook' ||
      obj.name === 'L03_Book_Reading_Desk' ||
      obj.name === 'Book_Page_Left' ||
      obj.name === 'Book_Page_Right'
    ) {
      const entry = { obj, role: 'book', label: i18n.t('hover.book') };
      interactiveTargets.push(entry);
      onsenInteractiveTargets.push(entry);
    } else if (
      obj.name === 'L03_Onsen_Hinoki_Carpentry' ||
      obj.name === 'L03_Onsen_Shoji_Screens' ||
      obj.name === 'L03_Onsen_Kawara_Roof' ||
      obj.name === 'L03_Onsen_Interior_Tatami'
    ) {
      interactiveTargets.push({ obj, role: 'onsen', label: i18n.t('hover.library') });
    } else if (obj.name === 'UI_Control_BrightnessDial') {
      onsenInteractiveTargets.push({ obj, role: 'ctl_bright', label: i18n.t('hover.brightnessDial') });
    } else if (obj.name === 'UI_Control_DuckCapSlider') {
      onsenInteractiveTargets.push({ obj, role: 'ctl_ducks', label: i18n.t('hover.countDial') });
    } else if (obj.name === 'UI_Control_RadioConsole') {
      onsenInteractiveTargets.push({ obj, role: 'ctl_radio', label: i18n.t('hover.radio') });
    } else if (obj.name === 'UI_Station_WatercolorAtelier' || obj.name === 'UI_Atelier_WatercolorCanvas') {
      interactiveTargets.push({ obj, role: 'atelier', label: i18n.t('hover.atelier') });
    } else if (obj.name.startsWith('L06_Coastal_Pier_')) {
      interactiveTargets.push({ obj, role: 'fishing', label: i18n.t('hover.fishing') });
    } else if (
      obj.name === 'UI_Station_RoastingCampfire' ||
      obj.name === 'UI_Station_Campfire_Stones' ||
      obj.name === 'UI_Campfire_RoastSkewer' ||
      obj.name === 'UI_Campfire_DuckBucket' ||
      obj.name === 'UI_Campfire_SkewerStand'
    ) {
      interactiveTargets.push({ obj, role: 'campfire', label: i18n.t('hover.campfire') });
      if (obj.name === 'UI_Station_RoastingCampfire' || obj.name === 'UI_Station_Campfire_Stones') {
        obj.traverse((ch) => {
          if (ch.isMesh && ch.material) {
            const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
            arr.forEach((m) => {
              if (!m || !m.name) return;
              if (m.name.includes('AshGround') || m.name.includes('Kamachi') || m.name.includes('Charred_Log') || m.name.includes('Split_Firewood') || m.name.includes('EndGrain') || m.name.includes('Coal')) {
                m.envMapIntensity = 0.05;
                if (m.name.includes('Kamachi')) { m.roughnessMap = null; m.roughness = 0.96; m.needsUpdate = true; }
                else if (m.name.includes('AshGround')) { m.roughness = Math.max(m.roughness ?? 0.94, 0.96); }
              } else if (m.name.includes('Stone') || m.name.includes('Hearth_') || m.name.includes('Basalt') || m.name.includes('Pebble')) {
                m.envMapIntensity = 0.08;
                m.roughness = Math.max(m.roughness ?? 0.88, 0.90);
              } else if (m.name.includes('Iron') || m.name.includes('Tetsubin')) {
                m.envMapIntensity = 0.22;
              }
              if (m.name.includes('Charred_Log') || m.name.includes('CoalBed') || m.name.includes('CoalChunk') || m.name.includes('Split_Firewood')) {
                emberBreathingMats.push({ mat: m, baseEmit: m.emissiveIntensity ?? 3.5 });
              }
            });
          }
        });
      }
      if (obj.name === 'UI_Campfire_DuckBucket') {
        campfireInteractiveTargets.push({ obj, role: 'bucket', label: i18n.t('hover.duckBin') });
      } else if (obj.name === 'UI_Campfire_SkewerStand') {
        campfireInteractiveTargets.push({ obj, role: 'stand', label: i18n.t('hover.skewerStand') });
      }
    }

    if (obj.name.startsWith('UI_BucketDuck_') && (!obj.parent || !obj.parent.name.startsWith('UI_BucketDuck_'))) {
      const match = BUCKET_VARIETIES.find((v) => obj.name.toLowerCase().includes(v.id)) || BUCKET_VARIETIES[0];
      campfireInteractiveTargets.push({ obj, role: 'bucket_duck', variety: match.id, label: i18n.t('hover.duckToSkewer', { name: match.name }) });
      interactiveTargets.push({ obj, role: 'campfire', label: i18n.t('hover.campfire') });
    }
  });
  interactiveTargets.sort((a, b) => (a.role === 'book' ? -1 : b.role === 'book' ? 1 : 0));
  const styleSummary = stylizeSanctuaryRoot(root);
  stylizedOutlineCount += styleSummary.outlineCount;
}

function registerCoreDucks(root) {
  const seen = new Set();
  const circuitObjs = [];
  let upperIdx = 0;

  root.traverse((obj) => {
    if (!obj.name || seen.has(obj)) return;
    const isPoolDuck = obj.name.startsWith('Duck_') && (!obj.parent || !obj.parent.name.startsWith('Duck_'));
    const isBucketDuck = obj.name.startsWith('UI_BucketDuck_') && (!obj.parent || !obj.parent.name.startsWith('UI_BucketDuck_'));
    if (!isPoolDuck && !isBucketDuck) return;
    seen.add(obj);

    const lower = obj.name.toLowerCase();
    const catKey = Object.keys(DUCK_CATALOG_META).find((k) => lower.includes(k)) || 'classic';
    const meta = DUCK_CATALOG_META[catKey];
    if (!duckTemplateMap.has(catKey)) {
      duckTemplateMap.set(catKey, obj);
    }

    if (!isPoolDuck) return;
    obj.rotation.order = 'YXZ';
    const baseScale = obj.scale.clone();
    const basePos = obj.position.clone();
    const baseYaw = obj.rotation.y;

    if (obj.name.startsWith('Duck_Upper_')) {
      const idx = upperIdx++;
      const isFlamingoRider = obj.name.includes('_00_');
      let designId = DUCK_ID_BY_KEY[catKey] || '01-classic';
      let hex = meta.hex;
      // Showcase unexpected designs (14..23) across upper pool ducks using official WebP atlases
      if (!isFlamingoRider && idx >= 4 && idx - 4 < UNEXPECTED_SHOWCASE_IDS.length) {
        designId = UNEXPECTED_SHOWCASE_IDS[idx - 4];
        const dSpec = applyOfficialDuckDesign(obj, designId, assetUrl);
        hex = dSpec?.fx?.colours?.[0] || hex;
      }
      const sigHat = getSignatureHatForDesign(designId);
      const hatId = !isFlamingoRider
        ? (sigHat || (idx % 3 === 1 ? WEARABLE_HAT_IDS[(idx >> 1) % WEARABLE_HAT_IDS.length] : 'none'))
        : (sigHat || 'none');
      const hatMesh = hatId !== 'none' ? attachDuckHat(obj, hatId) : null;
      const cartoonRig = attachCartoonDuckFeatures(obj, designId);
      const dName = i18n.t(`duck.${designId}`);

      let physPose = null;
      if (!isFlamingoRider) {
        physPose = sanctuaryPhysics.addDuck({
          id: obj.name,
          designId,
          name: dName,
          hex,
          x: basePos.x,
          z: basePos.z,
          initialStage: 'upper_pool',
        });
      }
      const entry = {
        id: obj.name,
        designId,
        kind: isFlamingoRider ? 'flamingo' : 'physics',
        isSpecial: false,
        name: dName,
        hex,
        hatId,
        hatMesh,
        cartoonRig,
        physPose,
        obj, basePos, baseScale, baseYaw,
        phase: idx * 1.17,
        stage: isFlamingoRider ? 'flamingo' : 'upper_pool',
        hopT: 0,
        launchT: 0,
      };
      duckRoots.push(entry);
      duckPickTargets.push({ obj, entry, label: i18n.t('ride.rideWith', { name: dName }) });
    } else {
      circuitObjs.push({ obj, basePos, baseScale, baseYaw, catKey, hex: meta.hex });
    }
  });

  const totalCircuit = Math.max(1, circuitObjs.length);
  circuitObjs.forEach((item, idx) => {
    const u0 = idx / totalCircuit;
    const designId = DUCK_ID_BY_KEY[item.catKey] || '01-classic';
    const dName = i18n.t(`duck.${designId}`);
    const sigHat = getSignatureHatForDesign(designId);
    const hatId = sigHat || (idx % 3 === 0 ? WEARABLE_HAT_IDS[idx % WEARABLE_HAT_IDS.length] : 'none');
    const hatMesh = hatId !== 'none' ? attachDuckHat(item.obj, hatId) : null;
    const cartoonRig = attachCartoonDuckFeatures(item.obj, designId);
    const physPose = sanctuaryPhysics.addDuck({
      id: item.obj.name,
      designId,
      name: dName,
      hex: item.hex,
      u: u0,
    });
    const entry = {
      id: item.obj.name,
      designId,
      kind: 'circuit',
      isSpecial: false,
      name: dName,
      hex: item.hex,
      hatId,
      hatMesh,
      cartoonRig,
      physPose,
      obj: item.obj,
      basePos: item.basePos,
      baseScale: item.baseScale,
      baseYaw: item.baseYaw,
      phase: idx * 0.91,
      stage: physPose.stage,
      hopT: 0,
      launchT: 0,
    };
    duckRoots.push(entry);
    duckPickTargets.push({ obj: item.obj, entry, label: i18n.t('ride.rideWith', { name: dName }) });
  });

  // Restore persisted custom watercolor, unlocked hearth, and unlocked secret ducks into live physics!
  sanctuaryLoop.customDucks.forEach((cd, i) => {
    spawnCircuitSpecialDuck({
      id: cd.id,
      name: cd.name,
      hex: cd.hex,
      textureDataUrl: cd.dataUrl,
      launchSplash: false,
      startU: (0.14 + i * 0.16) % 1,
    });
  });
  const unlocks = sanctuaryLoop.hearthUnlocks;
  Object.values(SPECIAL_HEARTH_DUCKS).forEach((spec, i) => {
    if (unlocks[spec.id] !== null) {
      spawnCircuitSpecialDuck({
        id: spec.id,
        name: i18n.t(`duck.${spec.id}`),
        hex: spec.hex,
        toastLevel: spec.toastLevel,
        launchSplash: false,
        startU: (0.42 + i * 0.25) % 1,
      });
    }
  });
  secretTracker.getUnlocked().forEach((sec, i) => {
    const designMeta = DESIGNS.find((d) => d.id === sec.unlocks);
    spawnCircuitSpecialDuck({
      id: `secret_${sec.unlocks}`,
      designId: sec.unlocks,
      name: sanctuaryGraph.getDuckName(`secret_${sec.unlocks}`, i18n.t(`duck.${sec.unlocks}`)),
      hex: designMeta?.fx?.colours?.[0] || '#ffd84a',
      hatId: sanctuaryGraph.getDuckHat(`secret_${sec.unlocks}`),
      launchSplash: false,
      startU: (0.08 + i * 0.21) % 1,
    });
  });
  sanctuaryGraph.getState().argDucks.forEach((designId, i) => {
    if (!duckRoots.some((d) => d.designId === designId)) {
      spawnGraphDesignDuck(designId, { launchSplash: false, startU: (0.22 + i * 0.17) % 1 });
    }
  });
  // Register 3D Coastal Pier Fishing Rig as a direct Zero-UI clickable station
  interactiveTargets.push({ obj: dramaVfx.fishingRig, role: 'fishing', label: i18n.t('hover.fishing') });
  interactiveTargets.push({ obj: dramaVfx.bobberGroup, role: 'fishing', label: i18n.t('hover.fishing') });
}

function bindBookChunk(bookRoot) {
  const bookMeshes = {
    leftPage: bookRoot.getObjectByName('Book_Page_Left') || null,
    rightPage: bookRoot.getObjectByName('Book_Page_Right') || null,
    flipLeaf: bookRoot.getObjectByName('Book_FlipLeaf') || null,
    postIt: bookRoot.getObjectByName('Book_Prop_PostIt') || null,
    maskingTape: bookRoot.getObjectByName('Book_Prop_MaskingTape') || null,
    tabs: [0, 1, 2, 3].map((i) => bookRoot.getObjectByName(`Book_Tab_${i}`) || null),
  };
  sanctuaryBook = createDiegeticBook3D({
    meshes: bookMeshes,
    renderer,
    logbook: sharedLogbook,
    loop: sanctuaryLoop,
    secrets: secretTracker,
    graph: sanctuaryGraph,
    drama: dramaEngine,
    quirks: quirksEngine,
    lang: i18n.getLang(),
    onPlayFlipSound: () => ambientAudio.playCue('page'),
    onScratchRedaction: () => {
      ambientAudio.playCue('scratch');
      sanctuaryGraph.recordEdge('book->redaction');
      showToast(i18n.t('quirk.redactedClick'), 3200);
    },
    onPageStamp: () => {
      ambientAudio.playCue('stamp');
      showToast(i18n.t('quirk.stampSlammed'), 2200);
    },
    onFollowDuckId: (duckId) => {
      let target = null;
      if (String(duckId).startsWith('design:')) {
        const designId = String(duckId).slice(7);
        target = duckRoots.find((d) => d.designId === designId && d.obj.visible)
          || spawnGraphDesignDuck(designId, { launchSplash: true, startU: 0.16 });
      } else {
        target = findDuckById(duckId);
      }
      if (!target && SPECIAL_HEARTH_DUCKS[duckId]) {
        const spec = SPECIAL_HEARTH_DUCKS[duckId];
        target = spawnCircuitSpecialDuck({
          id: spec.id,
          name: i18n.t(`duck.${spec.id}`),
          hex: spec.hex,
          toastLevel: spec.toastLevel,
          launchSplash: true,
          startU: 0.36,
        });
      }
      if (target) {
        exitFocusMode(true);
        startFollowDuck(target);
      }
    },
  });
  const bookRig = sanctuaryBook.getReadingRigPoses();
  if (bookRig) {
    CAMERA_PRESETS.book_desk.pos.copy(bookRig.camPos);
    CAMERA_PRESETS.book_desk.target.copy(bookRig.camTarget);
    CAMERA_PRESETS.book_desk.fov = bookRig.fov;
    bookOverheadSpot.position.copy(bookRig.spotPos);
    bookOverheadSpot.target.position.copy(bookRig.spotTarget);
    bookOverheadSpot.target.updateMatrixWorld(true);
  }
}

async function bootChunkedSanctuary() {
  try {
    // Stage 1 (Priority 1): Core terrain, conservatory, hydro loop, water & ducks -> Fast First Paint!
    const coreRes = await loadGlbAsync('sanctuary/chunks/chunk_01_core.glb');
    scene.add(coreRes.gltf.scene);
    bindSceneNodes(coreRes.gltf.scene);
    registerCoreDucks(coreRes.gltf.scene);
    logbookSync.syncNow(0.6, simHour, duckRoots);
    chunksLoaded.push('core');
    chunkTimings.core = coreRes.ms;
    window.__sanctuaryCoreMs = Math.round(performance.now() - loadT0);
    window.__sanctuaryCoreReady = true;
    applyDaylight(simHour, 0);
    if (chunkProgressEl) chunkProgressEl.textContent = 'Chunk 1/4 · Ready';

    // Stage 2 (Parallel): Onsen interior, 3D Field-Log Book, Watercolor & Campfire stations
    const restSpecs = [
      { id: 'onsen', path: 'sanctuary/chunks/chunk_02_onsen.glb' },
      { id: 'book', path: 'sanctuary/chunks/chunk_03_book.glb' },
      { id: 'stations', path: 'sanctuary/chunks/chunk_04_stations.glb' },
    ];
    await Promise.all(
      restSpecs.map(async (sp) => {
        const res = await loadGlbAsync(sp.path);
        scene.add(res.gltf.scene);
        bindSceneNodes(res.gltf.scene);
        if (sp.id === 'book') bindBookChunk(res.gltf.scene);
        if (sp.id === 'stations') rebuildHandheldSkewer(false);
        chunksLoaded.push(sp.id);
        chunkTimings[sp.id] = res.ms;
        if (chunkProgressEl) chunkProgressEl.textContent = `Chunk ${chunksLoaded.length}/4`;
      })
    );

    const prevIndoorVis = onsenIndoorObjs.map((o) => o.visible);
    onsenIndoorObjs.forEach((o) => { o.visible = true; });
    handSkewerGroup.visible = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.compile(scene, camera);
    handSkewerGroup.visible = false;
    onsenIndoorObjs.forEach((o, i) => { o.visible = prevIndoorVis[i]; });

    if (chunkProgressEl) chunkProgressEl.classList.add('hidden');
    applyTranslations();
    window.__sanctuaryLoadMs = Math.round(performance.now() - loadT0);
    window.__sanctuaryReady = true;
  } catch (err) {
    console.error('Chunked GLB Load Error:', err);
  }
}

bootChunkedSanctuary();

// =========================================================================
// COMPANION PILL (4-CH AUDIO MIXER, 24H DAYLIGHT, ECO 30FPS, 3-LANG I18N)
// =========================================================================
const companionDrawer = document.getElementById('companion-drawer');
function toggleCompanionDrawer(forceOpen) {
  if (!companionDrawer) return false;
  const open = typeof forceOpen === 'boolean' ? forceOpen : companionDrawer.classList.contains('hidden');
  companionDrawer.classList.toggle('hidden', !open);
  if (open) {
    ambientAudio.ensure();
    syncAudioUi();
    syncCompanionExtrasUi();
  }
  return open;
}
document.querySelectorAll('[data-pomo-min]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPomoMinutes = Number(btn.dataset.pomoMin) || 25;
    document.querySelectorAll('[data-pomo-min]').forEach((b) => b.classList.toggle('active', b === btn));
    sanctuaryGraph.startFocusTimer(selectedPomoMinutes);
    syncCompanionExtrasUi();
  });
});
document.getElementById('btn-pomo-toggle')?.addEventListener('click', () => {
  sanctuaryGraph.toggleFocusTimer(selectedPomoMinutes);
  syncCompanionExtrasUi();
});
document.getElementById('btn-cmp-yuzu')?.addEventListener('click', () => {
  const t = clock ? clock.getElapsedTime() : 0;
  dropYuzuInPool(2.2 + Math.sin(t * 1.7) * 2.2, -0.10, -1.6 + Math.cos(t * 1.3) * 1.3);
});
document.getElementById('btn-cmp-fish')?.addEventListener('click', () => enterFocusMode('fishing'));
document.getElementById('btn-cmp-arrival')?.addEventListener('click', () => {
  const present = duckRoots.map((d) => d.designId).filter(Boolean);
  const { arrived } = sanctuaryGraph.triggerArrivalNow(present);
  if (arrived) {
    const entry = spawnGraphDesignDuck(arrived.id, { launchSplash: true, startU: 0.14 });
    showToast(i18n.t('arrival.arrived', { name: entry?.name || arrived.label }), 4000);
  }
});
document.getElementById('btn-follow-rename')?.addEventListener('click', () => {
  if (!followedDuck || !renameInputEl || !followDuckName) return;
  followDuckName.classList.add('hidden');
  renameInputEl.value = followedDuck.name;
  renameInputEl.classList.remove('hidden');
  renameInputEl.focus();
  renameInputEl.select();
});
function commitInlineRename() {
  if (!renameInputEl || renameInputEl.classList.contains('hidden')) return;
  const val = renameInputEl.value;
  renameInputEl.classList.add('hidden');
  followDuckName?.classList.remove('hidden');
  if (followedDuck && val.trim()) renameDuckById(followedDuck.id, val);
}
renameInputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitInlineRename(); }
  else if (e.key === 'Escape') {
    renameInputEl.classList.add('hidden');
    followDuckName?.classList.remove('hidden');
  }
});
renameInputEl?.addEventListener('blur', commitInlineRename);
document.getElementById('btn-follow-hat')?.addEventListener('click', () => {
  if (followedDuck) cycleDuckHatById(followedDuck.id);
});
document.getElementById('btn-follow-dive')?.addEventListener('click', () => {
  if (followedDuck) {
    triggerDuckPose(followedDuck.id, 'dive', 1.6);
    showToast(i18n.t('quirk.poseDive', { name: followedDuck.name }), 2200);
  }
});
document.getElementById('btn-follow-sleep')?.addEventListener('click', () => {
  if (followedDuck) {
    triggerDuckPose(followedDuck.id, 'sleep', 6.5);
    showToast(i18n.t('quirk.poseSleep', { name: followedDuck.name }), 2200);
  }
});
document.querySelectorAll('[data-cam-script]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.camScript;
    if (id) applyCameraScript(id, false);
  });
});
if (portalInit.muted === true) {
  ambientAudio.setMasterMuted(true);
  syncAudioUi();
}
document.getElementById('btn-portal-classic')?.addEventListener('click', (e) => {
  logbookSync.flush(clock ? clock.getElapsedTime() : 0, simHour, duckRoots);
  e.currentTarget.setAttribute('href', buildPortalHref('index.html', {
    hour: simHour,
    muted: ambientAudio.isMuted(),
  }));
});
document.getElementById('btn-fish-action')?.addEventListener('click', () => handleFishingAction(false));
document.getElementById('btn-onsen-terminal')?.addEventListener('click', () => openOnsenTerminal());
document.getElementById('btn-term-close')?.addEventListener('click', () => openOnsenTerminal(false));
document.getElementById('term-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!termInputEl) return;
  runTerminalAndShow(termInputEl.value);
  termInputEl.value = '';
});
document.querySelectorAll('.term-freq-btn').forEach((btn) => {
  btn.addEventListener('click', () => runTerminalAndShow(`TUNE ${btn.dataset.freq}`));
});
const cfGuitarEl = document.getElementById('cf-guitar-chords');
if (cfGuitarEl) {
  GUITAR_CHORDS.forEach((ch, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cf-chord-btn';
    b.textContent = ch.label;
    b.title = `${ch.label} (${idx + 1})`;
    b.addEventListener('click', () => strumCampfireGuitar(idx));
    cfGuitarEl.appendChild(b);
  });
}

// =========================================================================
// WEATHER & ZERO-HUD POSTCARD PHOTO MODE
// =========================================================================
const photoModeUI = document.getElementById('photo-mode-ui');

function syncWeatherUi() {
  const mode = weatherSystem.getMode();
  document.querySelectorAll('[data-weather-preset]').forEach((b) => {
    b.classList.toggle('active', b.dataset.weatherPreset === mode);
  });
}

function setWeatherMode(mode, immediate = false) {
  weatherSystem.setMode(mode, { manual: true, immediate });
  syncWeatherUi();
  if (mode === 'petals') ambientAudio.playCue('windchime');
  applyDaylight(simHour, clock ? clock.getElapsedTime() : 0);
  return weatherSystem.getState();
}

function setPhotoMode(forceOn) {
  const next = typeof forceOn === 'boolean' ? forceOn : !photoMode;
  if (next === photoMode) return photoMode;
  photoMode = next;
  document.body.classList.toggle('photo-mode', photoMode);
  photoModeUI?.classList.toggle('hidden', !photoMode);
  document.getElementById('btn-cmp-photo')?.classList.toggle('active', photoMode);
  if (photoMode) {
    companionDrawer?.classList.add('hidden');
    controls.enabled = true;
  }
  return photoMode;
}

function capturePostcardPng() {
  try {
    // Render a fresh frame synchronously right before reading back canvas pixels
    if (shouldUseComposer()) composer.render();
    else renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `rubber-duck-sanctuary-${Math.round(simHour * 10)}.png`;
    a.click();
    showToast(i18n.t('photo.saved'), 2800);
    return true;
  } catch {
    return false;
  }
}

document.getElementById('btn-cmp-photo')?.addEventListener('click', () => setPhotoMode());
document.getElementById('btn-photo-exit')?.addEventListener('click', () => setPhotoMode(false));
document.getElementById('btn-photo-snap')?.addEventListener('click', () => capturePostcardPng());
document.querySelectorAll('[data-weather-preset]').forEach((btn) => {
  btn.addEventListener('click', () => setWeatherMode(btn.dataset.weatherPreset, false));
});
syncWeatherUi();

document.getElementById('btn-cmp-time')?.addEventListener('click', () => toggleCompanionDrawer());
document.getElementById('btn-cmp-audio')?.addEventListener('click', () => toggleCompanionDrawer());
document.getElementById('btn-cmp-eco')?.addEventListener('click', () => setEcoMode(!ecoMode));
document.getElementById('btn-cmp-lang')?.addEventListener('click', () => {
  const cur = SUPPORTED_LANGS.indexOf(i18n.getLang());
  i18n.setLang(SUPPORTED_LANGS[(cur + 1) % SUPPORTED_LANGS.length]);
});
document.getElementById('btn-aud-mute')?.addEventListener('click', () => {
  ambientAudio.ensure();
  ambientAudio.setMasterMuted(!ambientAudio.isMuted());
  syncAudioUi();
});
for (const ch of ['water', 'hearth', 'rain', 'radio']) {
  document.getElementById(`sl-aud-${ch}`)?.addEventListener('input', (e) => {
    ambientAudio.ensure();
    const val = Number(e.target.value);
    ambientAudio.setChannel(ch, val);
    if (ch === 'rain') {
      weatherSystem.syncFromRainAudio(val);
      syncWeatherUi();
    }
    syncAudioUi();
    checkSecrets();
  });
}
document.getElementById('sl-time-hour')?.addEventListener('input', (e) => {
  setTimeHour(Number(e.target.value), 'manual');
});
document.querySelectorAll('[data-time-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const p = btn.dataset.timePreset;
    if (p === 'auto') setTimeHour(simHour, 'auto');
    else if (p === 'day') setTimeHour(12.5, 'manual');
    else if (p === 'dusk') setTimeHour(18.2, 'manual');
    else if (p === 'night') setTimeHour(22.8, 'manual');
  });
});
i18n.onChange(() => applyTranslations());
applyTranslations();

// =========================================================================
// FOCUS MODES (ATELIER, CAMPFIRE, ONSEN INTERIOR, COLLECTOR BOOK)
// =========================================================================
const focusExitBar = document.getElementById('focus-exit-bar');
const campfireFocusUI = document.getElementById('campfire-focus-ui');
const onsenFocusUI = document.getElementById('onsen-focus-ui');

document.getElementById('sl-onsen-bright').addEventListener('input', (e) => applySanctuaryBrightness(Number(e.target.value)));
document.getElementById('sl-onsen-ducks').addEventListener('input', (e) => applySanctuaryDuckCap(Number(e.target.value)));
document.getElementById('btn-onsen-radio').addEventListener('click', () => toggleOnsenRadio());

let lastCampfireEnterMs = 0;
let heldDuckDrag = null;
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.145);
const _dragHitPt = new THREE.Vector3();

function cancelHeldDuckDrag() {
  if (!heldDuckDrag) return;
  const wasActive = heldDuckDrag.active;
  const id = heldDuckDrag.entry.id;
  heldDuckDrag = null;
  if (wasActive) {
    sanctuaryPhysics.cancelGrab(id);
    canvas.style.cursor = 'grab';
  }
  if (!focusMode) controls.enabled = true;
}

const cameraRig = createSanctuaryCameraRig({
  camera,
  controls,
  isBlocked: () => Boolean(focusMode) || ptActive || Boolean(heldDuckDrag?.active),
  onMove: () => { camTween = null; },
  onReset: () => {
    if (followedDuck) stopFollowDuck(true, false);
    else goPreset('hero', false);
  },
  onToggleMute: () => {
    ambientAudio.ensure();
    const next = !ambientAudio.isMuted();
    ambientAudio.setMasterMuted(next);
    syncAudioUi();
    showToast(i18n.t(next ? 'ui.soundMuted' : 'ui.soundUnmuted'), 2200);
  },
});

function enterFocusMode(mode, instant = false) {
  if (!['atelier', 'campfire', 'onsen', 'book', 'fishing'].includes(mode)) return;
  const enterT0 = performance.now();
  cameraRig.clear();
  cancelHeldDuckDrag();
  if (followedDuck) stopFollowDuck(false);
  if (ptActive) togglePathTracer(false);
  if (focusMode === 'campfire' && mode !== 'campfire') restoreFromCampfireMood();
  if (focusMode === 'fishing' && mode !== 'fishing') sanctuaryGraph.cancelFishing();

  focusMode = mode;
  focusExitBar.classList.remove('hidden');
  campfireFocusUI.classList.add('hidden');
  atelierFocusUI.classList.add('hidden');
  onsenFocusUI.classList.add('hidden');
  fishingFocusUI?.classList.add('hidden');
  onsenTerminalUI?.classList.add('hidden');
  whisperEl?.classList.add('hidden');
  cutinEl?.classList.add('hidden');
  toastEl?.classList.add('hidden');
  wcCursorEl?.classList.add('hidden');
  handSkewerGroup.visible = false;
  campfireHandFillLight.intensity = 0.0;
  setStaticCampfireSkewersVisible(true);

  if (mode === 'atelier') {
    initWatercolorEngine();
    atelierFocusUI.classList.remove('hidden');
    if (wcFrontMat) wcFrontMat.color.setHex(0xffffff);
    if (wcEngine && wcRefVisible) wcEngine.setReferenceOpacity(WC_REF_OPACITY_ATELIER);
    wcPaintActive = true;
    syncWcModeBtn();
    syncWcCursorSize();
    controls.enabled = false;
    goPreset('atelier_canvas', instant);
  } else if (mode === 'campfire') {
    campfireFocusUI.classList.remove('hidden');
    if (wcEngine && wcRefVisible) wcEngine.setReferenceOpacity(0.96);
    hemiLight.intensity = 0.14;
    moonDir.intensity = 0.18;
    warmConservatoryLight.intensity = 6;
    warmConservatoryEast.intensity = 4;
    emeraldPoolLight.intensity = 4;
    campfireHandFillLight.intensity = 3.2;
    scene.environmentIntensity = 0.14;
    scene.background = BG_CAMPFIRE;
    scene.fog.color.copy(BG_CAMPFIRE);
    scene.fog.density = 0.115;
    bloomPass.strength = 0.22;
    oceanBackdrop.group.visible = false;

    cfHandMode = true;
    syncCfModeBtns();
    controls.enabled = false;
    handSkewerGroup.visible = true;
    setStaticCampfireSkewersVisible(false);
    goPreset('campfire_close', instant);
    lastCampfireEnterMs = +(performance.now() - enterT0).toFixed(2);
  } else if (mode === 'onsen') {
    onsenFocusUI.classList.remove('hidden');
    for (let i = 0; i < onsenIndoorObjs.length; i++) onsenIndoorObjs[i].visible = true;
    controls.enabled = true;
    controls.minDistance = 0.4;
    controls.maxDistance = 5.8;
    goPreset('onsen_interior', instant);
  } else if (mode === 'book') {
    logbookSync.flush(clock.getElapsedTime(), simHour, duckRoots);
    sanctuaryBook?.refresh();
    document.getElementById('btn-book-stamp')?.classList.remove('hidden');
    controls.enabled = false;
    goPreset('book_desk', instant);
    if (instant) {
      bookOverheadSpot.intensity = 3.8;
      bookDeskLampLight.intensity = 1.9 * sanctuaryBrightness;
    }
  } else if (mode === 'fishing') {
    fishingFocusUI?.classList.remove('hidden');
    syncFishingUi();
    controls.enabled = false;
    goPreset('fishing_pier', instant);
  }
}

function restoreFromCampfireMood() {
  scene.fog.density = 0.0;
  scene.background = BG_DEFAULT;
  oceanBackdrop.group.visible = true;
  scene.environmentIntensity = 0.72;
  campfireHandFillLight.intensity = 0.0;
  handSkewerGroup.visible = false;
  setStaticCampfireSkewersVisible(true);
  applySanctuaryBrightness(sanctuaryBrightness);
}

function exitFocusMode(instant = false) {
  if (!focusMode) return;
  const prev = focusMode;
  focusMode = null;
  wcPainting = false;
  cfDipHeld = false;
  controls.enabled = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 68;
  if (wcEngine && wcRefVisible) wcEngine.setReferenceOpacity(0.96);
  focusExitBar.classList.add('hidden');
  const stampBtn = document.getElementById('btn-book-stamp');
  if (stampBtn) {
    stampBtn.classList.add('hidden');
    stampBtn.classList.remove('active');
    stampBtn.textContent = i18n.t('quirk.stampMode');
  }
  sanctuaryBook?.setStampMode(false);
  campfireFocusUI.classList.add('hidden');
  atelierFocusUI.classList.add('hidden');
  onsenFocusUI.classList.add('hidden');
  fishingFocusUI?.classList.add('hidden');
  onsenTerminalUI?.classList.add('hidden');
  whisperEl?.classList.add('hidden');
  cutinEl?.classList.add('hidden');
  toastEl?.classList.add('hidden');
  wcCursorEl?.classList.add('hidden');
  if (prev === 'fishing') sanctuaryGraph.cancelFishing();
  if (prev === 'campfire') restoreFromCampfireMood();
  if (prev === 'book' && instant) {
    bookOverheadSpot.intensity = 0.0;
    bookDeskLampLight.intensity = 4.4 * sanctuaryBrightness;
  }
  goPreset('hero', instant);
}

document.getElementById('btn-exit-focus').addEventListener('click', () => exitFocusMode());

// =========================================================================
// VISUAL BRUSH-ICON & STROKE-SWATCH ATELIER UI BINDINGS
// =========================================================================
function syncWcModeBtn() {
  const b = document.getElementById('btn-wc-mode');
  if (!b) return;
  b.classList.toggle('active', wcPaintActive);
  b.textContent = wcPaintActive ? '🖌️ 그리기' : '🧭 시점';
}

// 1. Slider Icons
const icSize = document.getElementById('wc-ic-size');
const icWater = document.getElementById('wc-ic-water');
const icLoad = document.getElementById('wc-ic-load');
if (icSize) icSize.innerHTML = SLIDER_ICONS.size;
if (icWater) icWater.innerHTML = SLIDER_ICONS.water;
if (icLoad) icLoad.innerHTML = SLIDER_ICONS.load;

// 2. Top 4 Visual Tool Icons (Brush / Water / Pen / Lift)
const wcToolRowEl = document.getElementById('wc-tool-row');
Object.entries(TOOL_ICONS).forEach(([toolId, meta], idx) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `wc-tool-btn${idx === 0 ? ' active' : ''}`;
  btn.dataset.tool = toolId;
  btn.title = meta.label;
  btn.setAttribute('aria-label', meta.label);
  btn.innerHTML = meta.svg;
  btn.addEventListener('click', () => {
    const eng = initWatercolorEngine();
    eng.setTool(toolId);
    wcToolRowEl.querySelectorAll('.wc-tool-btn').forEach((x) => x.classList.toggle('active', x === btn));
  });
  wcToolRowEl.appendChild(btn);
});

// 3. 10 Visual Brush Cards (Brush Head Silhouette + Dynamic Pigment-Tinted Brush Stroke!)
const wcBrushListEl = document.getElementById('wc-brush-list');
BRUSH_PRESETS.forEach((preset, idx) => {
  const vis = BRUSH_VISUALS[preset.id] || BRUSH_VISUALS.round;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `wc-brush-btn${idx === 0 ? ' active' : ''}`;
  b.dataset.brush = preset.id;
  b.title = `${vis.ko} (${preset.name}) — ${preset.hint}`;
  b.setAttribute('aria-label', `${vis.ko} (${preset.name})`);
  b.innerHTML = `
    <span class="wc-brush-head">${vis.toolSvg}</span>
    <span class="wc-brush-stroke">${vis.strokeSvg}</span>
  `;
  b.addEventListener('click', () => {
    const eng = initWatercolorEngine();
    eng.setBrush(buildBrush(preset));
    eng.setTool('brush');
    wcToolRowEl.querySelectorAll('.wc-tool-btn').forEach((t) => t.classList.toggle('active', t.dataset.tool === 'brush'));
    wcBrushListEl.querySelectorAll('.wc-brush-btn').forEach((x) => x.classList.toggle('active', x === b));
  });
  wcBrushListEl.appendChild(b);
});

// 4. Organic Watercolor Paint-Dab Palette Swatches (dynamically recolor brush strokes!)
const wcSwatchesEl = document.getElementById('wc-swatches');
const wcPigmentNameEl = document.getElementById('wc-pigment-name');
PALETTE.forEach((p, idx) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `wc-swatch${idx === 0 ? ' active' : ''}`;
  b.style.color = p.hex;
  b.title = p.name;
  b.setAttribute('aria-label', p.name);
  b.innerHTML = PALETTE_DAB_SVG;
  b.addEventListener('click', () => {
    const eng = initWatercolorEngine();
    eng.setPigment(p.pigment);
    syncWcPigmentColor(p.hex);
    if (eng.tool === 'water' || eng.tool === 'lift') {
      eng.setTool('brush');
      wcToolRowEl.querySelectorAll('.wc-tool-btn').forEach((t) => t.classList.toggle('active', t.dataset.tool === 'brush'));
    }
    wcSwatchesEl.querySelectorAll('.wc-swatch').forEach((s) => s.classList.toggle('active', s === b));
    wcPigmentNameEl.textContent = p.name.toUpperCase();
  });
  wcSwatchesEl.appendChild(b);
});
syncWcPigmentColor(PALETTE[0].hex);

document.getElementById('sl-wc-size').addEventListener('input', (e) => {
  wcBrushSizeUi = Number(e.target.value);
  syncWcCursorSize();
  initWatercolorEngine().setParams({ size: wcBrushSizeUi });
});
document.getElementById('sl-wc-water').addEventListener('input', (e) => initWatercolorEngine().setParams({ water: Number(e.target.value) }));
document.getElementById('sl-wc-load').addEventListener('input', (e) => initWatercolorEngine().setParams({ load: Number(e.target.value) }));

document.getElementById('btn-wc-undo').addEventListener('click', () => wcEngine?.undo());
document.getElementById('btn-wc-redo').addEventListener('click', () => wcEngine?.redo());
document.getElementById('btn-wc-dry').addEventListener('click', () => wcEngine?.fix());
document.getElementById('btn-wc-clear').addEventListener('click', () => {
  const eng = initWatercolorEngine();
  eng.clear();
  wcRefVisible = false;
  eng.setReferenceOpacity(0.0);
  document.getElementById('btn-wc-ref').classList.remove('active');
});
document.getElementById('btn-wc-ref').addEventListener('click', (e) => {
  const eng = initWatercolorEngine();
  wcRefVisible = !wcRefVisible;
  eng.setReferenceOpacity(wcRefVisible ? WC_REF_OPACITY_ATELIER : 0.0);
  e.currentTarget.classList.toggle('active', wcRefVisible);
});
document.getElementById('btn-wc-paper').addEventListener('click', (e) => {
  const eng = initWatercolorEngine();
  wcPaperIdx = (wcPaperIdx + 1) % PAPERS.length;
  eng.setPaper(PAPERS[wcPaperIdx]);
  e.currentTarget.textContent = PAPERS[wcPaperIdx].name.toUpperCase();
});
document.getElementById('btn-wc-mode').addEventListener('click', () => {
  wcPaintActive = !wcPaintActive;
  controls.enabled = !wcPaintActive;
  if (!wcPaintActive) wcCursorEl?.classList.add('hidden');
  syncWcModeBtn();
});
document.getElementById('btn-wc-release-duck').addEventListener('click', () => releaseCustomWatercolorDuck());

// =========================================================================
// CAMPFIRE CUSTOMIZER & HANDHELD ROAST UI BINDINGS
// =========================================================================
function syncCfModeBtns() {
  document.getElementById('btn-cf-hand').classList.toggle('active', cfHandMode);
  document.getElementById('btn-cf-orbit').classList.toggle('active', !cfHandMode);
  controls.enabled = !cfHandMode;
}

function renderCampfireMinimalBar() {
  const slotsEl = document.getElementById('cf-skewer-slots');
  if (slotsEl) {
    slotsEl.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      if (i < skewerList.length) {
        const v = BUCKET_VARIETIES.find((x) => x.id === skewerList[i]) || BUCKET_VARIETIES[0];
        btn.className = 'cf-slot-btn';
        btn.style.background = v.hex;
        btn.title = `${v.name} 덕 제거`;
        btn.textContent = String(i + 1);
        btn.addEventListener('click', () => removeDuckSlot(i));
      } else {
        btn.className = 'cf-slot-btn empty';
        btn.textContent = '+';
        btn.disabled = true;
      }
      slotsEl.appendChild(btn);
    }
  }
  updateRoastReadout();
}

const picksEl = document.getElementById('cf-bucket-picks');
if (picksEl) {
  BUCKET_VARIETIES.forEach((v) => {
    const b = document.createElement('button');
    b.className = 'cf-pick-btn';
    b.style.background = v.hex;
    b.title = `${v.name} 덕 꼬치에 추가`;
    b.addEventListener('click', () => addDuckToSkewer(v.id));
    picksEl.appendChild(b);
  });
}

document.getElementById('btn-cf-hand').addEventListener('click', () => { cfHandMode = true; syncCfModeBtns(); });
document.getElementById('btn-cf-orbit').addEventListener('click', () => { cfHandMode = false; syncCfModeBtns(); });
document.getElementById('btn-cf-stoke').addEventListener('click', () => { cfStoke = Math.min(1, cfStoke + 0.85); burstSparks(48); });
document.getElementById('btn-cf-fresh').addEventListener('click', () => resetFreshSkewer());
cfReleaseBtn?.addEventListener('click', () => releaseRoastedHearthDuck());

// =========================================================================
// 3D RAYCAST INTERACTION (STATIONS + ALL LIVE DUCKS!)
// =========================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

function setPointerFromEvent(ev) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickTarget(ev, list) {
  setPointerFromEvent(ev);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(list.map((t) => t.obj), true);
  if (!hits.length) return null;
  for (const h of hits) {
    let cur = h.object;
    while (cur) {
      const found = list.find((t) => t.obj === cur);
      if (found) return { target: found, dist: h.distance };
      cur = cur.parent;
    }
  }
  return null;
}

function pickCanvasUv(ev) {
  if (!wcMeshTarget) return null;
  setPointerFromEvent(ev);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(wcMeshTarget, false);
  return hits.length && hits[0].uv ? hits[0].uv : null;
}

canvas.addEventListener('pointermove', (ev) => {
  if (heldDuckDrag && ev.pointerId === heldDuckDrag.pointerId) {
    if (!heldDuckDrag.active && Math.hypot(ev.clientX - heldDuckDrag.x0, ev.clientY - heldDuckDrag.y0) > 6) {
      if (sanctuaryPhysics.grabDuck(heldDuckDrag.entry.id)) {
        heldDuckDrag.active = true;
        hoverTip.classList.add('hidden');
        duckSqueak(heldDuckDrag.entry);
      } else {
        cancelHeldDuckDrag();
      }
    }
    if (heldDuckDrag?.active) {
      canvas.style.cursor = 'grabbing';
      setPointerFromEvent(ev);
      raycaster.setFromCamera(pointer, camera);
      _dragPlane.constant = -heldDuckDrag.planeY;
      if (raycaster.ray.intersectPlane(_dragPlane, _dragHitPt)) {
        const nowMs = performance.now();
        const dtDrag = Math.max(0.008, (nowMs - heldDuckDrag.prevT) / 1000);
        const instVx = (_dragHitPt.x - heldDuckDrag.prevX) / dtDrag;
        const instVz = (_dragHitPt.z - heldDuckDrag.prevZ) / dtDrag;
        heldDuckDrag.vx = heldDuckDrag.vx * 0.45 + instVx * 0.55;
        heldDuckDrag.vz = heldDuckDrag.vz * 0.45 + instVz * 0.55;
        heldDuckDrag.prevX = _dragHitPt.x;
        heldDuckDrag.prevZ = _dragHitPt.z;
        heldDuckDrag.prevT = nowMs;
        sanctuaryPhysics.moveGrabbedDuck(heldDuckDrag.entry.id, _dragHitPt.x, _dragHitPt.z);
      }
      return;
    }
  }

  if (focusMode === 'book') {
    if (sanctuaryBook) {
      setPointerFromEvent(ev);
      raycaster.setFromCamera(pointer, camera);
      const bHit = sanctuaryBook.pickInteractive(raycaster);
      if (bHit) {
        canvas.style.cursor = 'pointer';
        hoverTip.textContent = bHit.label;
        hoverTip.style.left = `${ev.clientX}px`;
        hoverTip.style.top = `${ev.clientY}px`;
        hoverTip.classList.remove('hidden');
      } else {
        canvas.style.cursor = 'default';
        hoverTip.classList.add('hidden');
      }
    }
    return;
  }

  if (focusMode === 'atelier' && wcPaintActive) {
    hoverTip.classList.add('hidden');
    const uv = pickCanvasUv(ev);
    if (uv) {
      canvas.style.cursor = 'none';
      if (wcCursorEl) {
        wcCursorEl.style.left = `${ev.clientX}px`;
        wcCursorEl.style.top = `${ev.clientY}px`;
        wcCursorEl.classList.remove('hidden');
      }
      if (wcPainting && wcEngine) {
        wcEngine.pointerMoveUv(uv.x, 1.0 - uv.y, ev.pointerType === 'pen' ? ev.pressure : -1);
      }
    } else {
      canvas.style.cursor = 'default';
      wcCursorEl?.classList.add('hidden');
    }
    return;
  }
  wcCursorEl?.classList.add('hidden');

  if (focusMode === 'campfire') {
    setPointerFromEvent(ev);
    if (cfHandMode) {
      cfPointerNdc.x = THREE.MathUtils.clamp(pointer.x, -0.95, 0.95);
      cfPointerNdc.y = THREE.MathUtils.clamp(pointer.y, -0.85, 0.85);
    }
    const cfHit = pickTarget(ev, campfireInteractiveTargets)?.target;
    if (cfHit) {
      canvas.style.cursor = 'pointer';
      hoverTip.textContent = cfHit.label;
      hoverTip.style.left = `${ev.clientX}px`;
      hoverTip.style.top = `${ev.clientY}px`;
      hoverTip.classList.remove('hidden');
    } else {
      canvas.style.cursor = cfHandMode ? 'none' : 'grab';
      hoverTip.classList.add('hidden');
    }
    return;
  }

  if (focusMode === 'onsen') {
    const hit = pickTarget(ev, onsenInteractiveTargets)?.target;
    if (hit) {
      canvas.style.cursor = 'pointer';
      hoverTip.textContent = hit.label;
      hoverTip.style.left = `${ev.clientX}px`;
      hoverTip.style.top = `${ev.clientY}px`;
      hoverTip.classList.remove('hidden');
    } else {
      canvas.style.cursor = 'grab';
      hoverTip.classList.add('hidden');
    }
    return;
  }

  // Main Sanctuary view: check both stations and live ducks, picking the closer target!
  const stHit = pickTarget(ev, interactiveTargets);
  const dkHit = pickTarget(ev, duckPickTargets);
  const pickedDuck = (dkHit && (!stHit || dkHit.dist <= stHit.dist + 0.15)) ? dkHit.target.entry : null;
  if (pickedDuck !== hoveredDuckEntry) {
    hoveredDuckEntry = pickedDuck;
    hoverDuckTimer = 0;
    hoverBurpFired = false;
  }
  const best = pickedDuck ? dkHit.target : stHit?.target;
  if (best) {
    canvas.style.cursor = 'pointer';
    hoverTip.textContent = best.label;
    hoverTip.style.left = `${ev.clientX}px`;
    hoverTip.style.top = `${ev.clientY}px`;
    hoverTip.classList.remove('hidden');
  } else {
    canvas.style.cursor = 'grab';
    hoverTip.classList.add('hidden');
  }
});

canvas.addEventListener('pointerleave', () => {
  hoveredDuckEntry = null;
  hoverDuckTimer = 0;
  hoverBurpFired = false;
  wcCursorEl?.classList.add('hidden');
  hoverTip.classList.add('hidden');
});

canvas.addEventListener('pointerdown', (ev) => {
  pointerDownPos = { x: ev.clientX, y: ev.clientY };
  if (focusMode === 'atelier' && wcPaintActive) {
    const uv = pickCanvasUv(ev);
    if (uv) {
      wcPainting = true;
      initWatercolorEngine().pointerDownUv(uv.x, 1.0 - uv.y, ev.pointerType === 'pen' ? ev.pressure : -1);
    }
    return;
  }
  if (focusMode === 'campfire') {
    const cfHit = pickTarget(ev, campfireInteractiveTargets)?.target;
    if (cfHit) {
      if (cfHit.role === 'bucket_duck') addDuckToSkewer(cfHit.variety);
      else if (cfHit.role === 'bucket') {
        const nextV = BUCKET_VARIETIES[cfNextBucketCycle % BUCKET_VARIETIES.length];
        cfNextBucketCycle++;
        addDuckToSkewer(nextV.id);
      } else if (cfHit.role === 'stand') resetFreshSkewer();
      return;
    }
    if (cfHandMode && ev.button === 0) cfDipHeld = true;
    return;
  }
  if (!focusMode && ev.button === 0 && !ev.shiftKey) {
    const stHit = pickTarget(ev, interactiveTargets);
    const dkHit = pickTarget(ev, duckPickTargets);
    if (dkHit && (!stHit || dkHit.dist <= stHit.dist + 0.15)) {
      const entry = dkHit.target.entry;
      const stg = entry.physPose?.stage;
      if (stg === 'upper_pool' || stg === 'grotto') {
        heldDuckDrag = {
          entry,
          pointerId: ev.pointerId,
          x0: ev.clientX,
          y0: ev.clientY,
          active: false,
          vx: 0,
          vz: 0,
          prevX: entry.obj.position.x,
          prevZ: entry.obj.position.z,
          prevT: performance.now(),
          planeY: stg === 'grotto' ? -2.22 : -0.145,
        };
        controls.enabled = false;
      }
    }
  }
});

canvas.addEventListener('pointercancel', cancelHeldDuckDrag);
window.addEventListener('blur', cancelHeldDuckDrag);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelHeldDuckDrag();
});

canvas.addEventListener('pointerup', (ev) => {
  if (heldDuckDrag && ev.pointerId === heldDuckDrag.pointerId) {
    const drag = heldDuckDrag;
    heldDuckDrag = null;
    if (!focusMode) controls.enabled = true;
    if (drag.active) {
      canvas.style.cursor = 'grab';
      const mood = quirksEngine.getDuckMood(drag.entry.id);
      const throwScale = 1 / mood.massMultiplier;
      const rel = sanctuaryPhysics.releaseGrabbedDuck(drag.entry.id, drag.vx * throwScale, drag.vz * throwScale);
      const flingSpeed = Math.hypot(drag.vx, drag.vz);
      if (flingSpeed > 2.2) quirksEngine.triggerHitStop(0.05);
      const grudgeRes = quirksEngine.recordDuckFling(drag.entry.id);
      sanctuaryGraph.recordEdge('hand->physics');
      ambientAudio.playCue(rel?.launchedSlide ? 'slide' : 'splash', rel ? { x: rel.x, y: drag.planeY, z: rel.z } : null);
      duckSqueak(drag.entry);
      if (rel?.launchedSlide) sentDown.add(drag.entry.id);
      if (grudgeRes.stubborn && rel) {
        dramaVfx.emitEmote(rel.x, drag.planeY + 0.15, rel.z, 'anger');
        showWhisper(i18n.t('quirk.grudgeWhisper'), 4800);
      } else if (rel?.launchedSlide) {
        slideRides += 1;
        dramaVfx.emitBurst(rel.x, -0.05, rel.z, 0xffd86b, 14, 1.7);
        dramaVfx.emitEmote(rel.x, -0.05, rel.z, 'star');
        showWhisper(i18n.t('whisper.slideDrop'), 4200);
        checkSecrets();
      } else if (rel) {
        spawnWaterRipple(rel.x, drag.planeY, rel.z, 1.55);
        dramaVfx.emitBurst(rel.x, drag.planeY + 0.12, rel.z, 0x9efcf4, 9, 1.35);
      }
      return;
    }
  }
  if (wcPainting) {
    wcPainting = false;
    wcEngine?.pointerUpUv();
    return;
  }
  if (cfDipHeld) {
    cfDipHeld = false;
    return;
  }
  if (Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y) > 6) return;

  if (focusMode === 'book') {
    if (sanctuaryBook) {
      hoverTip.classList.add('hidden');
      setPointerFromEvent(ev);
      raycaster.setFromCamera(pointer, camera);
      const handled = sanctuaryBook.handleClick(raycaster, { shiftKey: ev.shiftKey });
      if (!handled) {
        const onDesk = pickTarget(ev, interactiveTargets)?.target?.role === 'book';
        if (!onDesk) exitFocusMode();
      }
    }
    return;
  }

  if (focusMode === 'onsen') {
    const hit = pickTarget(ev, onsenInteractiveTargets)?.target;
    if (!hit) return;
    if (hit.role === 'book') enterFocusMode('book');
    else if (hit.role === 'ctl_bright') {
      const steps = [0.75, 1.0, 1.25, 1.5];
      const next = steps.find((s) => s > sanctuaryBrightness + 0.05) ?? steps[0];
      applySanctuaryBrightness(next);
    } else if (hit.role === 'ctl_ducks') {
      const steps = [6, 12, 18, 30, 36];
      const next = steps.find((s) => s > sanctuaryDuckCap) ?? steps[0];
      applySanctuaryDuckCap(next);
    } else if (hit.role === 'ctl_radio') {
      toggleOnsenRadio();
      openOnsenTerminal(true);
    }
    return;
  }

  if (focusMode === 'fishing') {
    handleFishingAction(false);
    return;
  }

  if (focusMode) return;
  const stHit = pickTarget(ev, interactiveTargets);
  const dkHit = pickTarget(ev, duckPickTargets);
  if (dkHit && (!stHit || dkHit.dist <= stHit.dist + 0.15)) {
    const entry = dkHit.target.entry;
    if (followedDuck === entry) petDuck(entry);
    else startFollowDuck(entry);
    return;
  }
  const hit = stHit?.target;
  if (!hit) {
    // Clicking open sanctuary water sends a radial splash wave (Shift+click drops a fragrant Yuzu!)
    if (waterMeshes.length) {
      setPointerFromEvent(ev);
      raycaster.setFromCamera(pointer, camera);
      const wHits = raycaster.intersectObjects(waterMeshes.map((w) => w.mesh), false);
      if (wHits.length) {
        const pt = wHits[0].point;
        if (ev.shiftKey) {
          dropYuzuInPool(pt.x, pt.y, pt.z);
        } else {
          sanctuaryPhysics.applyRadialWave(pt.x, pt.z, 2.4, 1.5);
          spawnWaterRipple(pt.x, pt.y, pt.z, 1.7);
          ambientAudio.playCue('splash', pt);
        }
      }
    }
    return;
  }
  if (hit.role === 'atelier') enterFocusMode('atelier');
  else if (hit.role === 'campfire') enterFocusMode('campfire');
  else if (hit.role === 'onsen') enterFocusMode('onsen');
  else if (hit.role === 'book') enterFocusMode('book');
  else if (hit.role === 'fishing') enterFocusMode('fishing');
});

canvas.addEventListener('wheel', (ev) => {
  if (focusMode === 'campfire' && cfHandMode) {
    ev.preventDefault();
    cfSkewerSpinTarget += ev.deltaY * 0.008;
  }
}, { passive: false });

controls.addEventListener('start', () => { camTween = null; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  if (ptActive && pathTracer) pathTracer.updateCamera();
});

window.addEventListener('keydown', (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (heldDuckDrag?.active) { cancelHeldDuckDrag(); return; }
    if (photoMode) { setPhotoMode(false); return; }
    if (ptActive) { togglePathTracer(false); return; }
    if (focusMode) { exitFocusMode(); return; }
    if (followedDuck) { stopFollowDuck(true); return; }
  } else if (k === 'c' && !focusMode) {
    setPhotoMode();
  } else if (k === 'v' && !focusMode && !followedDuck) {
    const nextW = weatherSystem.cycleMode();
    syncWeatherUi();
    if (nextW === 'petals') ambientAudio.playCue('windchime');
  } else if (k === 'y' && !focusMode) {
    dropYuzuInPool(2.2 + Math.sin(clock.getElapsedTime() * 1.7) * 2.4, -0.10, -1.6 + Math.cos(clock.getElapsedTime() * 1.3) * 1.4);
  } else if (e.key === ' ' && followedDuck && !focusMode) {
    e.preventDefault();
    tossDuck(followedDuck);
  } else if (k === 'f' && !focusMode) {
    enterFocusMode('fishing');
  } else if (focusMode === 'fishing' && e.key === ' ') {
    e.preventDefault();
    handleFishingAction(false);
  } else if (k >= '1' && k <= '4' && !focusMode) {
    const script = MONOGRAPH_CAMERA_SCRIPTS[Number(k) - 1];
    if (script) applyCameraScript(script.id, false);
  } else if (k === 'p' && focusMode !== 'campfire' && focusMode !== 'atelier' && focusMode !== 'book') {
    togglePathTracer();
  } else if (focusMode === 'campfire') {
    if (k >= '1' && k <= '6') strumCampfireGuitar(Number(k) - 1);
    else if (k === 's') { cfStoke = Math.min(1, cfStoke + 0.85); burstSparks(48); }
    else if (k === 'p') { cfPop = 1.0; burstSparks(34); }
    else if (k === 'g') { const a = Math.random() * Math.PI * 2; cfGustX = Math.cos(a) * 0.9; cfGustZ = Math.sin(a) * 0.9; }
    else if (k === 'q') cfSkewerSpinTarget -= 0.45;
    else if (k === 'e') cfSkewerSpinTarget += 0.45;
    else if (k === ' ') cfDipHeld = true;
  } else if (focusMode === 'book') {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      sanctuaryBook?.nextPage();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      sanctuaryBook?.prevPage();
    }
  } else if (focusMode === 'atelier') {
    if ((e.metaKey || e.ctrlKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) wcEngine?.redo(); else wcEngine?.undo();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') cfDipHeld = false;
});

// =========================================================================
// MAIN 60FPS ANIMATION LOOP
// =========================================================================
const clock = new THREE.Clock();
let prevT = 0;
const _invFireMat = new THREE.Matrix4();
const _camLocal = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _col = new THREE.Color();
const _camF = new THREE.Vector3();
const _camR = new THREE.Vector3();
const _camU = new THREE.Vector3();
const _tipPos = new THREE.Vector3();
const _handlePos = new THREE.Vector3();
const _duckWorld = new THREE.Vector3();
const _prevFollowPos = new THREE.Vector3();
let readoutTick = 0;
let emoteCooldown = 0;
let passiveWakeTimer = 0;
const frameDtRing = [];

function shouldUseComposer() {
  return bloomEnabled && !ecoMode && !ptActive && focusMode !== 'book' && focusMode !== 'atelier';
}

function processPhysicsEvents(physEvents, liveVisuals = true) {
  for (let i = 0; i < physEvents.length; i++) {
    const ev = physEvents[i];
    if (liveVisuals && (ev.id === followedDuck?.id || sentDown.has(ev.id))) ambientAudio.hear(ev);
    if (ev.type === 'launch') sentDown.delete(ev.id);
    if (ev.type === 'collision') {
      const duckA = findDuckById(ev.a);
      const duckB = findDuckById(ev.b);
      const bondRes = dramaEngine.recordCollision(ev.a, ev.b, duckA?.name || ev.a, duckB?.name || ev.b);
      if (bondRes.newPal) {
        sanctuaryGraph.recordEdge('physics->affinity');
        if (liveVisuals) {
          if (duckA) dramaVfx.emitEmote(duckA.obj.position.x, duckA.obj.position.y, duckA.obj.position.z, 'heart');
          if (duckB) dramaVfx.emitEmote(duckB.obj.position.x, duckB.obj.position.y, duckB.obj.position.z, 'heart');
          showWhisper(i18n.t('drama.poolPal', { a: bondRes.newPal.nameA, b: bondRes.newPal.nameB }), 5200);
        }
        syncFollowPalBadge();
        syncCompanionExtrasUi();
        sanctuaryBook?.refresh();
      }
      if (bondRes.completed.length) awardCompletedRequests(bondRes.completed);
      if (liveVisuals && ev.impulse > 0.08) {
        spawnWaterRipple(ev.x, -0.14, ev.z, 0.75);
        dramaVfx.emitBurst(ev.x, -0.05, ev.z, 0xbefcf4, 4, 0.9);
        if (ev.impulse > 0.22 && emoteCooldown <= 0) {
          dramaVfx.emitEmote(ev.x, 0.08, ev.z, 'spark');
          showWhisper(i18n.t('whisper.collision'), 4200);
          emoteCooldown = 1.6;
        }
      }
    } else if (ev.type === 'overtake') {
      dramaEngine.recordOvertake(ev.id, ev.passed || 'neighbor');
      if (liveVisuals) {
        const passer = findDuckById(ev.id);
        if (passer) {
          dramaVfx.emitBurst(passer.obj.position.x, passer.obj.position.y, passer.obj.position.z, 0xffe468, 8, 1.4);
          if (emoteCooldown <= 0) {
            dramaVfx.emitEmote(passer.obj.position.x, passer.obj.position.y, passer.obj.position.z, 'star');
            showWhisper(i18n.t('whisper.overtake'), 4200);
            emoteCooldown = 1.4;
          }
        }
      }
    } else if (liveVisuals && (ev.type === 'splash' || ev.type === 'launch')) {
      const wy = ev.type === 'splash' ? -2.20 : -0.14;
      spawnWaterRipple(ev.x, wy, ev.z, 1.45);
      dramaVfx.emitBurst(ev.x, wy + 0.08, ev.z, 0x8efce8, 6, 1.2);
    } else if (liveVisuals && ev.type === 'slide' && followedDuck && followedDuck.id === ev.id) {
      slideRides += 1;
      checkSecrets();
    }
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  if (ecoMode && now - lastRenderNow < 32.5) return;
  const frameMs = lastRenderNow > 0 ? Math.min(200, now - lastRenderNow) : 16.7;
  lastRenderNow = now;
  frameDtRing.push(frameMs);
  if (frameDtRing.length > 90) frameDtRing.shift();

  const t = clock.getElapsedTime();
  const dt = Math.min(0.05, Math.max(0.001, t - prevT));
  prevT = t;
  emoteCooldown = Math.max(0, emoteCooldown - dt);

  const wxState = weatherSystem.step(dt);
  const qTick = quirksEngine.step(dt);
  if (subliminalEl) {
    const showSub = qTick.subliminalActive && !photoMode;
    subliminalEl.classList.toggle('hidden', !showSub);
    if (showSub && subliminalTextEl) {
      subliminalTextEl.textContent = i18n.t(qTick.subliminalTextKey);
    }
  }
  if (hoveredDuckEntry && !focusMode && !heldDuckDrag?.active) {
    hoverDuckTimer += dt;
    if (hoverDuckTimer > 3.5 && !hoverBurpFired) {
      hoverBurpFired = true;
      ambientAudio.playCue('burp');
      showWhisper(i18n.t('quirk.hoverBurp'), 3800);
    }
  }
  if (timeMode === 'auto') {
    simHour = (simHour + dt * DAY_CYCLE_HOURS_PER_SEC) % 24;
  }
  applyDaylight(simHour, t);

  if (camTween) {
    const u = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    camera.position.lerpVectors(camTween.p0, camTween.p1, e);
    controls.target.lerpVectors(camTween.g0, camTween.g1, e);
    camera.fov = THREE.MathUtils.lerp(camTween.f0, camTween.f1, e);
    camera.updateProjectionMatrix();
    if (u >= 1) camTween = null;
  }

  // Track followed duck position delta before updating ducks so user can still freely orbit around it!
  if (followedDuck && !focusMode) {
    _prevFollowPos.copy(followedDuck.obj.position);
  }

  const insideOnsen =
    focusMode === 'onsen' ||
    (camera.position.x < -8.8 && camera.position.z < 2.5 && camera.position.z > -9.2);
  for (let i = 0; i < onsenIndoorObjs.length; i++) {
    onsenIndoorObjs[i].visible = insideOnsen;
  }

  const nearBook = focusMode === 'book' || camera.position.distanceToSquared(BOOK_DESK_WORLD) < 90;
  for (let i = 0; i < bookDetailObjs.length; i++) {
    bookDetailObjs[i].visible = nearBook;
  }

  // Zeigarnik passive mystery duck arrival countdown
  if (window.__sanctuaryCoreReady && focusMode !== 'campfire') {
    const arrRes = sanctuaryGraph.tickArrival(dt, duckRoots.map((d) => d.designId).filter(Boolean));
    const arrBtn = document.getElementById('btn-cmp-arrival');
    if (arrBtn) {
      const pct = Math.round(arrRes.progress * 100);
      const lbl = `🐥 ${pct}%`;
      if (arrBtn.textContent !== lbl) arrBtn.textContent = lbl;
    }
    if (arrRes.arrived) {
      const entry = spawnGraphDesignDuck(arrRes.arrived.id, { launchSplash: true, startU: 0.14 });
      showToast(i18n.t('arrival.arrived', { name: entry?.name || arrRes.arrived.label }), 4000);
    }
  }

  // 30-second coastal pier fishing bite & tactile reeling timer
  const fishTick = sanctuaryGraph.stepFishing(dt);
  const liveFish = sanctuaryGraph.getState().fishing;
  if (fishTick.event === 'bite') {
    ambientAudio.playCue('bite');
    const bp = dramaVfx.bobberGroup.position;
    dramaVfx.emitBurst(bp.x, bp.y, bp.z, 0xffe268, 12, 1.5);
    syncFishingUi();
  } else if (fishTick.event === 'escaped_gently') {
    syncFishingUi();
  } else if (liveFish.phase === 'reeling' && focusMode === 'fishing') {
    const reelFill = document.getElementById('fish-reel-fill');
    if (reelFill) reelFill.style.width = `${Math.round(liveFish.reelProgress * 100)}%`;
  }

  // Spirit City Focus Pomodoro tick
  const pomoTick = sanctuaryGraph.tickFocusTimer(dt, duckRoots.map((d) => d.designId).filter(Boolean));
  if (pomoTick.completed) {
    handlePomodoroComplete(pomoTick);
  } else if (sanctuaryGraph.getState().pomodoro.running) {
    const clockEl = document.getElementById('val-pomo-clock');
    if (clockEl) {
      const lbl = formatClockMMSS(pomoTick.remainingSec);
      if (clockEl.textContent !== lbl) clockEl.textContent = lbl;
    }
  }

  if (ptActive && pathTracer) {
    controls.update();
    pathTracer.renderSample();
    ptSamples++;
    if (ptSamples % 2 === 0 || ptSamples < 6) {
      ptSamplesEl.textContent = `Path Tracing · ${ptSamples} spp`;
    }
    return;
  }

  // Update 3D water ripple rings
  for (let i = 0; i < ripplePool.length; i++) {
    const r = ripplePool[i];
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= r.dur) {
      r.active = false;
      r.mesh.visible = false;
      continue;
    }
    const p = r.age / r.dur;
    r.mesh.scale.setScalar(0.55 + p * 2.6 * r.scaleMax);
    r.mat.opacity = (1 - p) * (1 - p) * 0.72;
  }

  // Update live shader concentric wake slots + passive moving-duck wakes
  passiveWakeTimer += dt;
  if (passiveWakeTimer >= 0.24 && duckRoots.length) {
    passiveWakeTimer = 0;
    const pick = duckRoots[Math.floor((t * 7.3) % duckRoots.length)];
    if (pick?.obj.visible && pick.physPose && (pick.stage === 'upper_pool' || pick.stage === 'grotto')) {
      addShaderWake(pick.obj.position.x, pick.obj.position.z, 1.15, 0.42, 1.35);
    }
  }
  const uWakes = waterUniforms.uWakes.value;
  for (let i = 0; i < MAX_WATER_WAKES; i++) {
    const s = wakeSlots[i];
    if (s.age < s.dur) {
      s.age += dt;
      const u = Math.min(1, s.age / s.dur);
      const rad = THREE.MathUtils.lerp(0.25, s.maxRadius, u);
      const amp = s.strength * (1 - u) * (1 - u);
      uWakes[i].set(s.x, s.z, rad, amp);
    } else {
      uWakes[i].set(0, 0, 0.5, 0);
    }
  }

  if (focusMode !== 'campfire') {
    waterUniforms.uTime.value = t;
    for (let i = 0; i < waterStreamTextures.length; i++) {
      waterStreamTextures[i].offset.y = -(t * 0.95) % 1.0;
    }

    // Active floating Yuzu citrus toys gently attract nearby ducks in the thermal pool!
    const activeYuzus = dramaVfx.getActiveYuzus();
    for (let i = 0; i < activeYuzus.length; i++) {
      const yz = activeYuzus[i];
      sanctuaryPhysics.applyRadialWave(yz.x, yz.z, 4.2, -0.52 * dt);
    }

    const physEvents = qTick.hitStopped
      ? []
      : sanctuaryPhysics.step(dt, t, { night: lastNight });
    if (physEvents.length) {
      for (let i = 0; i < physEvents.length; i++) {
        if (physEvents[i].type === 'collision' && physEvents[i].impulse > 0.36) {
          quirksEngine.triggerHitStop(0.05);
          break;
        }
      }
      processPhysicsEvents(physEvents, true);
    }
    logbookSync.step(dt, { simTime: t, simHour, duckEntries: duckRoots, physEvents });

    const zzzDue = duckPoses.step(dt);
    for (let i = 0; i < zzzDue.length; i++) {
      const sleeping = findDuckById(zzzDue[i]);
      if (sleeping && sleeping.obj.visible) {
        dramaVfx.emitEmote(sleeping.obj.position.x, sleeping.obj.position.y, sleeping.obj.position.z, 'sleep');
      }
    }
    sunbeams.update(t, simHour, wxState.overcast, focusMode === 'campfire' || focusMode === 'onsen' || focusMode === 'book');
    if (activeCameraScript === 'water_pov' && waterPovBasePos && !focusMode && !followedDuck && !camTween) {
      if (camera.position.distanceTo(waterPovBasePos) < 0.25) {
        const bob = sampleWaterPovCameraBob(t);
        camera.position.set(waterPovBasePos.x + bob.dx, waterPovBasePos.y + bob.dy, waterPovBasePos.z);
      } else {
        waterPovBasePos = null;
      }
    }

    for (let i = 0; i < duckRoots.length; i++) {
      const d = duckRoots[i];
      if (!d.obj.visible) continue;

      const mood = quirksEngine.getDuckMood(d.id);
      const sqP = quirksEngine.getSqueezePressure(d.id);
      const poseFx = duckPoses.sample(d.id, t, d.phase);
      const isStickerLit =
        hoveredDuckEntry === d ||
        followedDuck === d ||
        heldDuckDrag?.entry === d ||
        sqP > 0;
      setDuckStickerHighlight(d.cartoonRig, isStickerLit, sqP);
      updateCartoonDuckRig(d.cartoonRig, {
        time: t,
        phase: d.phase,
        syncBlink: qTick.syncBlink,
        eyelidSquint: mood.eyelidSquint,
        squeezePressure: sqP,
        happyEyes: poseFx.happyEyes,
        sleepingEyes: poseFx.sleepingEyes,
      });

      let hopY = poseFx.yOffset;
      let squishX = (1.0 + sqP * 0.24) * poseFx.scaleX;
      let squishY = (1.0 - sqP * 0.34) * poseFx.scaleY;
      if (d.hopT > 0) {
        const isToss = d.hopT > 1.05;
        d.hopT = Math.max(0, d.hopT - dt * (isToss ? 1.85 : 2.4));
        const u = Math.min(1, d.hopT / (isToss ? 1.65 : 1.0));
        const h = Math.sin(u * Math.PI);
        hopY += h * (isToss ? 0.58 : 0.22);
        squishY *= 1.0 + h * 0.14;
        squishX *= 1.0 - h * 0.07;
      }

      if (d.kind === 'flamingo') {
        d.obj.position.y = d.basePos.y + Math.sin(t * 1.9 + d.phase) * 0.032 + hopY;
        d.obj.rotation.z = Math.sin(t * 1.5 + d.phase) * 0.06 + poseFx.rollOffset;
        d.obj.rotation.x = Math.cos(t * 1.3 + d.phase) * 0.04 + poseFx.pitchOffset;
        d.obj.scale.set(d.baseScale.x * squishX, d.baseScale.y * squishY, d.baseScale.z * squishX);
      } else if (d.physPose) {
        const pose = d.physPose;
        d.stage = pose.stage;
        const sq = Math.min(0.28, pose.squish || 0);
        const sx = squishX * (1 + sq * 0.45);
        const sy = squishY * (1 - sq * 0.42);
        if (d.launchT > 0 && d.launchT < 1) {
          d.launchT = Math.min(1, d.launchT + dt * 1.35);
          const e = 1 - Math.pow(1 - d.launchT, 2);
          const arcY = Math.sin(d.launchT * Math.PI) * 1.95;
          d.obj.position.set(
            THREE.MathUtils.lerp(d.launchFrom.x, pose.x, e),
            THREE.MathUtils.lerp(d.launchFrom.y, pose.y, e) + arcY,
            THREE.MathUtils.lerp(d.launchFrom.z, pose.z, e)
          );
          d.obj.rotation.y = pose.yaw + (1 - d.launchT) * Math.PI * 2;
          if (d.launchT >= 1) {
            d.launchT = 0;
            spawnWaterRipple(pose.x, pose.y, pose.z, 2.0);
          }
        } else {
          d.obj.position.set(pose.x, pose.y + hopY, pose.z);
          if ((qTick.stareActive || mood.stubborn) && (pose.stage === 'upper_pool' || pose.stage === 'grotto')) {
            d.obj.rotation.y = Math.atan2(camera.position.x - pose.x, camera.position.z - pose.z);
            d.obj.rotation.x = 0.04 + poseFx.pitchOffset;
            d.obj.rotation.z = poseFx.rollOffset;
          } else {
            d.obj.rotation.y = pose.yaw;
            d.obj.rotation.x = pose.pitch + poseFx.pitchOffset;
            d.obj.rotation.z = pose.roll + poseFx.rollOffset;
          }
        }
        d.obj.scale.set(d.baseScale.x * sx, d.baseScale.y * sy, d.baseScale.z * sx);
      }
    }
    const activeHatch = duckPoses.getActiveHatch();
    const hatchDuck = activeHatch ? findDuckById(activeHatch.duckId) : null;
    hatchEgg.update(Boolean(hatchDuck && hatchDuck.obj.visible), hatchDuck?.obj.position || null, activeHatch?.progress || 0);
    updateDuckHats(duckRoots, t);
  }
  const fishNow = sanctuaryGraph.getState().fishing;
  dramaVfx.update(dt, t, {
    duckEntries: duckRoots,
    fishingPhase: fishNow.phase,
    fishingTension: fishNow.reelTension,
    fishingProgress: fishNow.reelProgress,
    activeBait: fishNow.activeBait,
    focusMode,
    night: lastNight,
    weather: wxState,
  });

  // Smoothly carry OrbitControls target & camera along with the followed duck!
  if (followedDuck && !focusMode) {
    const curPos = followedDuck.obj.position;
    const dx = curPos.x - _prevFollowPos.x;
    const dy = curPos.y - _prevFollowPos.y;
    const dz = curPos.z - _prevFollowPos.z;
    controls.target.x += dx;
    controls.target.y += dy;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
    controls.target.lerp(curPos, 1 - Math.exp(-dt * 6));
    if (followDuckStage) {
      const lbl = i18n.t(`stage.${followedDuck.stage}`) || i18n.t('ui.sanctuaryPool');
      if (followDuckStage.textContent !== lbl) followDuckStage.textContent = lbl;
    }
  }
  cameraRig.frame(dt);
  controls.update();

  const inCampfire = focusMode === 'campfire';
  cfStoke = Math.max(0, cfStoke - dt * 0.42);
  cfPop = Math.max(0, cfPop - dt * 1.65);
  cfGustX *= Math.exp(-dt * 1.15);
  cfGustZ *= Math.exp(-dt * 1.15);

  fireVolumeMesh.updateMatrixWorld();
  _invFireMat.copy(fireVolumeMesh.matrixWorld).invert();
  _camLocal.copy(camera.position).applyMatrix4(_invFireMat);

  fireUniforms.uTime.value = t;
  fireUniforms.uFireSize.value = cfFireSize;
  fireUniforms.uStoke.value = cfStoke;
  fireUniforms.uPop.value = cfPop;
  fireUniforms.uGust.value.set(cfGustX, cfGustZ);
  fireUniforms.uCamLocal.value.copy(_camLocal);
  fireUniforms.uDetail.value = inCampfire ? 1.0 : 0.0;

  const flicker = 1.0 + 0.12 * Math.sin(t * 10.6) + 0.07 * Math.sin(t * 17.3 + 1.4);
  const fireGain = (0.70 + 0.42 * cfFireSize + 0.55 * cfStoke + 0.42 * cfPop) * flicker;
  const emberBreath = 0.88 + 0.16 * Math.sin(t * 1.9) + 0.50 * cfStoke;
  campfireCoreLight.intensity = (inCampfire ? 24.0 : 18.0) * fireGain;
  for (const eb of emberBreathingMats) {
    eb.mat.emissiveIntensity = eb.baseEmit * emberBreath;
  }

  sparkMesh.visible = inCampfire || camera.position.distanceToSquared(CAMPFIRE_WORLD) < 120;
  if (sparkMesh.visible) {
    const calmSpawnProb = (0.16 + 0.30 * cfFireSize + 0.7 * cfStoke) * dt * 60;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const sp = sparkPool[i];
      if (!sp.alive) {
        if (Math.random() < calmSpawnProb * 0.03) spawnSpark(sp, false);
        _m4.makeScale(0, 0, 0);
        sparkMesh.setMatrixAt(i, _m4);
        continue;
      }
      const tau = Math.max(0.32 * sp.dmm * sp.dmm, 0.025);
      const kDrag = 1.0 - Math.exp(-dt / tau);
      const relY = sp.p.y - CAMPFIRE_WORLD.y;
      const swirlA = t * 1.9 + sp.seed + relY * 3.8;
      const turb = 0.35 + 1.65 * Math.min(1, relY / 1.0);
      sp.v.x += (cfGustX * 1.6 + Math.cos(swirlA) * 0.85 * turb - sp.v.x) * kDrag;
      sp.v.y += ((1.55 + 0.85 * cfFireSize + 1.05 * cfStoke) / (1.0 + Math.max(0, relY - 0.85) * 1.25) - sp.v.y) * kDrag - 2.6 * dt * (sp.dmm < 0.4 ? 0.25 : 1.0);
      sp.v.z += (cfGustZ * 1.6 + Math.sin(swirlA * 1.13) * 0.85 * turb - sp.v.z) * kDrag;
      sp.p.addScaledVector(sp.v, dt);
      sp.age += dt;
      sp.tb -= dt;
      if (sp.tb <= 0) sp.T = 293 + (sp.T - 293) * Math.exp(-dt / (0.08 + 0.06 * sp.dmm));
      if (sp.T < 760 || relY < -0.05 || relY > 2.4 || sp.age > 3.6) {
        sp.alive = false;
        _m4.makeScale(0, 0, 0);
        sparkMesh.setMatrixAt(i, _m4);
        continue;
      }
      const spd = sp.v.length();
      _dir.copy(sp.v).divideScalar(Math.max(spd, 1e-4));
      _q.setFromUnitVectors(_up, _dir);
      const streakLen = Math.min(0.036, Math.max(0.007, spd * 0.012));
      const thick = 0.55 + 0.55 * sp.dmm;
      _sc.set(thick, streakLen, thick);
      _m4.compose(sp.p, _q, _sc);
      sparkMesh.setMatrixAt(i, _m4);

      const xT = THREE.MathUtils.clamp((sp.T - 760) / 560, 0, 1);
      const flick = 0.72 + 0.35 * Math.sin(t * 28 + sp.seed);
      _col.setRGB(
        Math.min(1, (0.88 + 0.32 * xT) * flick),
        Math.min(1, Math.pow(xT, 1.85) * 0.40 * flick),
        Math.min(1, Math.pow(Math.max(0, xT - 0.65) / 0.35, 2.4) * 0.14 * flick)
      );
      sparkMesh.setColorAt(i, _col);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }

  if (inCampfire && handSkewerGroup.visible) {
    const smoothK = 1 - Math.exp(-dt * 12);
    cfSmoothedNdc.x += (cfPointerNdc.x - cfSmoothedNdc.x) * smoothK;
    cfSmoothedNdc.y += (cfPointerNdc.y - cfSmoothedNdc.y) * smoothK;
    cfDepthSmooth += ((cfDipHeld ? 0.05 : 0.25) - cfDepthSmooth) * smoothK;
    cfSkewerSpin += (cfSkewerSpinTarget - cfSkewerSpin) * smoothK;

    camera.getWorldDirection(_camF);
    _camR.crossVectors(_camF, _up).normalize();
    _camU.crossVectors(_camR, _camF).normalize();

    const swayX = Math.sin(t * 2.1) * 0.005;
    const swayY = Math.cos(t * 1.7) * 0.005;
    _tipPos.copy(CAMPFIRE_WORLD)
      .addScaledVector(_camR, cfSmoothedNdc.x * 0.56 + swayX)
      .addScaledVector(_up, 0.24 + (cfSmoothedNdc.y * 0.5 + 0.5) * 0.44 + swayY)
      .addScaledVector(_camF, -cfDepthSmooth);

    _handlePos.copy(_tipPos)
      .addScaledVector(_camR, 0.44)
      .addScaledVector(_up, -0.25)
      .addScaledVector(_camF, -0.54);

    handSkewerGroup.position.copy(_handlePos);
    _dir.subVectors(_tipPos, _handlePos).normalize();
    _q.setFromUnitVectors(_up, _dir);
    handSkewerGroup.quaternion.copy(_q);
    skewerDuckHolder.rotation.y = cfSkewerSpin;
    handSkewerGroup.updateMatrixWorld(true);

    campfireHandFillLight.intensity = (2.9 + 1.0 * cfStoke) * flicker;

    let anyRoasting = false;
    for (const entry of skewerDuckEntries) {
      entry.root.getWorldPosition(_duckWorld);
      const dist = _duckWorld.distanceTo(FIRE_CORE_WORLD);
      const heatZone = THREE.MathUtils.clamp((0.62 - dist) / (0.62 - 0.14), 0, 1);
      if (heatZone > 0.02) {
        anyRoasting = true;
        const rate = (0.09 + 0.12 * cfStoke) * heatZone * heatZone;
        entry.toast = Math.min(1.0, entry.toast + rate * dt);
        updateDuckMaterialToast(entry, heatZone);
        if (dist < 0.20 && Math.random() < dt * 4.5) burstSparks(3);
      } else {
        updateDuckMaterialToast(entry, 0);
      }
    }
    if (anyRoasting && ++readoutTick % 8 === 0) updateRoastReadout();
  }

  if (sanctuaryBook) sanctuaryBook.update(dt);

  // Smooth Layer 4 cool investigator spotlight (#CBE8F5) crossfade when reading the 3D book
  const spotTarget = focusMode === 'book' ? 3.8 : 0.0;
  bookOverheadSpot.intensity += (spotTarget - bookOverheadSpot.intensity) * (1 - Math.exp(-dt * 7));
  if (focusMode !== 'campfire') {
    const deskTarget = (focusMode === 'book' ? 1.9 : 4.4) * sanctuaryBrightness;
    bookDeskLampLight.intensity += (deskTarget - bookDeskLampLight.intensity) * (1 - Math.exp(-dt * 6));
    const atelierTarget = (focusMode === 'atelier' ? 11.5 : 3.4) * sanctuaryBrightness;
    atelierLampLight.intensity += (atelierTarget - atelierLampLight.intensity) * (1 - Math.exp(-dt * 6));
  }

  camera.getWorldDirection(_camF);
  ambientAudio.listen(camera.position, _camF);

  if (shouldUseComposer()) {
    composer.render();
  } else {
    renderer.render(scene, camera);
    lastSceneDrawCalls = renderer.info.render.calls;
    lastSceneTriangles = renderer.info.render.triangles;
  }
}
requestAnimationFrame(animate);

window.addEventListener('pagehide', () => {
  logbookSync.flush(clock.getElapsedTime(), simHour, duckRoots);
});

let testSimClock = 0;

window.__sanctuary = {
  b2t,
  cameraRig,
  goPreset,
  applyCameraScript,
  triggerDuckPose,
  cameraScripts: MONOGRAPH_CAMERA_SCRIPTS,
  setCam(px, py, pz, tx, ty, tz, fov = 40) {
    camTween = null;
    camera.position.copy(b2t(px, py, pz));
    controls.target.copy(b2t(tx, ty, tz));
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.update();
  },
  enterFocusMode,
  exitFocusMode,
  togglePathTracer,
  get book() { return sanctuaryBook; },
  loop: sanctuaryLoop,
  releaseCustomWatercolorDuck,
  releaseRoastedHearthDuck,
  followCircuitDuck(idx = 0) {
    const riders = duckRoots.filter((d) => d.kind === 'circuit' && d.obj.visible);
    if (riders[idx]) startFollowDuck(riders[idx]);
    return followedDuck ? followedDuck.id : null;
  },
  stopFollowDuck,
  setSkewerDucks(arr) { skewerList = arr.slice(0, 4); rebuildHandheldSkewer(false); },
  addDuckToSkewer,
  resetFreshSkewer,
  setHandheldPose(nx, ny, dip = false, spin = 0) {
    cfPointerNdc.x = nx; cfPointerNdc.y = ny;
    cfSmoothedNdc.x = nx; cfSmoothedNdc.y = ny;
    cfDipHeld = dip; cfDepthSmooth = dip ? 0.05 : 0.25;
    cfSkewerSpin = spin; cfSkewerSpinTarget = spin;
  },
  setDuckToast: setAllSkewerToast,
  triggerStoke() { cfStoke = 0.9; burstSparks(48); },
  getCircuitDucks() {
    return duckRoots
      .filter((d) => d.kind === 'circuit')
      .map((d) => ({
        id: d.id,
        name: d.name,
        stage: d.stage,
        isSpecial: Boolean(d.isSpecial),
        pos: [+d.obj.position.x.toFixed(3), +d.obj.position.y.toFixed(3), +d.obj.position.z.toFixed(3)],
        scale: +d.obj.scale.x.toFixed(4),
        baseScale: +d.baseScale.x.toFixed(4),
      }));
  },
  paintWatercolorPlaygroundDemo() {
    const eng = initWatercolorEngine();
    eng.clear();
    wcRefVisible = true;
    eng.setReferenceOpacity(WC_REF_OPACITY_ATELIER);
    document.getElementById('btn-wc-ref')?.classList.add('active');
    let simT = 1000;
    const drawWave = (pigmentIdx, x0, y0, x1, y1, amp = 0.035, steps = 20) => {
      eng.setPigment(PALETTE[pigmentIdx].pigment);
      syncWcPigmentColor(PALETTE[pigmentIdx].hex);
      simT += 80;
      eng.pointerDownUv(x0, y0, 0.78, simT);
      eng.stepSync(2, 1 / 60);
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        simT += 36;
        eng.pointerMoveUv(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI * 2) * amp, 0.78, simT);
        eng.stepSync(2, 1 / 60);
      }
      eng.pointerUpUv();
      eng.stepSync(10, 1 / 60);
    };
    eng.setBrush(buildBrush(BRUSH_PRESETS.find((b) => b.id === 'mop') || BRUSH_PRESETS[0]));
    eng.setParams({ size: 0.56, water: 0.76, load: 0.62, flow: 0.42, bleed: 0.70, edge: 0.65, granulation: 0.55 });
    drawWave(3, 0.10, 0.82, 0.44, 0.85, 0.025, 16); // Quinacridone Rose
    drawWave(5, 0.28, 0.86, 0.62, 0.80, 0.025, 16); // French Ultramarine
    eng.stepSync(20, 1 / 60);
    // Leave a vivid Ultramarine tint active so the brush-stroke swatches showcase dynamic pigment coloring!
    const swatches = document.querySelectorAll('.wc-swatch');
    swatches[5]?.click();
  },
  setTimeHour,
  setEcoMode,
  setLanguage: (lang) => i18n.setLang(lang),
  getLanguage: () => i18n.getLang(),
  setAudioChannel: (ch, v) => { ambientAudio.setChannel(ch, v); syncAudioUi(); checkSecrets(); },
  getAudioState: () => ambientAudio.getState(),
  checkSecrets,
  getUnlockedSecrets: () => secretTracker.getUnlocked(),
  triggerWaterWave(x = 2.0, z = -1.5, radius = 2.8, strength = 1.8) {
    const pushed = sanctuaryPhysics.applyRadialWave(x, z, radius, strength);
    spawnWaterRipple(x, -0.12, z, 1.9);
    return pushed;
  },
  grabAndDropDuck(duckId, x = -0.84, z = 2.95, vx = 0, vz = 0) {
    const targetId = duckId || duckRoots.find((d) => d.physPose?.stage === 'upper_pool')?.id;
    if (!targetId || !sanctuaryPhysics.grabDuck(targetId)) return null;
    sanctuaryPhysics.moveGrabbedDuck(targetId, x, z);
    const rel = sanctuaryPhysics.releaseGrabbedDuck(targetId, vx, vz);
    sanctuaryGraph.recordEdge('hand->physics');
    if (rel?.launchedSlide) {
      sentDown.add(targetId);
      slideRides += 1;
      checkSecrets();
    }
    return rel;
  },
  stepPhysicsForTest(seconds = 3.0) {
    const steps = Math.max(1, Math.round(seconds * 60));
    let tNow = Math.max(clock.getElapsedTime(), testSimClock, logbookSync.getMaxObservedTime());
    for (let i = 0; i < steps; i++) {
      tNow += 1 / 60;
      const evs = sanctuaryPhysics.step(1 / 60, tNow, { night: lastNight });
      if (evs.length) processPhysicsEvents(evs, false);
      logbookSync.step(1 / 60, { simTime: tNow, simHour, duckEntries: duckRoots, physEvents: evs });
    }
    testSimClock = tNow;
    logbookSync.flush(tNow, simHour, duckRoots);
    return sanctuaryPhysics.getStats();
  },
  getHudCoverage() {
    if (photoMode) return 0;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    let covered = 0;
    for (const el of document.querySelectorAll('#companion-hud .companion-pill, #focus-exit-bar:not(.hidden), #follow-duck-ui:not(.hidden)')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) covered += r.width * r.height;
    }
    return +(covered / (vw * vh)).toFixed(4);
  },
  setWeather: setWeatherMode,
  getWeather: () => weatherSystem.getState(),
  setPhotoMode,
  tossFollowedDuck: () => tossDuck(followedDuck),
  dropYuzu: dropYuzuInPool,
  setBloomEnabled(on) { bloomEnabled = Boolean(on); return bloomEnabled; },
  resetFrameStats() { frameDtRing.length = 0; },
  getFrameStats() {
    if (!frameDtRing.length) return { samples: 0, p50Ms: 0, p95Ms: 0, fps: 0 };
    const sorted = [...frameDtRing].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 16.7;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || p50;
    return {
      samples: sorted.length,
      p50Ms: +p50.toFixed(2),
      p95Ms: +p95.toFixed(2),
      fps: +(1000 / Math.max(1, p50)).toFixed(1),
    };
  },
  graph: sanctuaryGraph,
  drama: dramaEngine,
  quirks: quirksEngine,
  crankValve: crankThermalValve,
  tiltDuckAccessory: tiltDuckAccessoryById,
  squeezeAndFireDuckJet,
  triggerCartoonCutin,
  triggerSubliminal: (key = 'quirk.subliminal1', sec = 0.05) => quirksEngine.triggerSubliminal(key, sec),
  scratchBookRedaction: (id) => sanctuaryBook?.scratchRedaction(id) ?? false,
  slamBookStamp: (side = 'right', u = 0.56, v = 0.72, kind = 'suanbo') => sanctuaryBook?.slamStampAt(side, u, v, kind) ?? null,
  renameDuck: renameDuckById,
  cycleDuckHat: cycleDuckHatById,
  selectBait: selectBaitAndSync,
  castFishing: () => handleFishingAction(false),
  stepFishingForTest(seconds = 5.5) {
    let last = { phase: sanctuaryGraph.getState().fishing.phase, event: null };
    const steps = Math.max(1, Math.round(seconds * 10));
    for (let i = 0; i < steps; i++) {
      last = sanctuaryGraph.stepFishing(0.1);
      if (last.event === 'bite') break;
    }
    syncFishingUi();
    return last;
  },
  reelFishing: (forceCatch = true, pump = 0.36) => handleFishingAction(forceCatch, pump),
  buyShellItem: buyShellItemAndFeedback,
  startFocusTimer: (min = 25) => { const r = sanctuaryGraph.startFocusTimer(min); syncCompanionExtrasUi(); return r; },
  completeFocusSession: () => {
    const res = sanctuaryGraph.completeFocusSession(duckRoots.map((d) => d.designId).filter(Boolean));
    handlePomodoroComplete(res);
    return res;
  },
  openCompanionDrawer: (open) => toggleCompanionDrawer(open),
  openTerminal: openOnsenTerminal,
  runTerminal: runTerminalAndShow,
  strumGuitar: strumCampfireGuitar,
  triggerArrivalNow() {
    const present = duckRoots.map((d) => d.designId).filter(Boolean);
    const { arrived } = sanctuaryGraph.triggerArrivalNow(present);
    if (arrived) spawnGraphDesignDuck(arrived.id, { launchSplash: true, startU: 0.14 });
    return arrived;
  },
  getState: () => ({
    ready: Boolean(window.__sanctuaryReady),
    coreReady: Boolean(window.__sanctuaryCoreReady),
    coreLoadMs: window.__sanctuaryCoreMs || 0,
    loadMs: window.__sanctuaryLoadMs || 0,
    chunksLoaded: [...chunksLoaded],
    chunkTimings: { ...chunkTimings },
    focusMode,
    followedDuck: followedDuck ? { id: followedDuck.id, name: followedDuck.name, stage: followedDuck.stage } : null,
    lastCampfireEnterMs,
    fogDensity: scene.fog ? scene.fog.density : null,
    programsCount: renderer.info.programs ? renderer.info.programs.length : null,
    staticSkewerVisible: staticCampfireSkewerObjs.some((o) => o.visible),
    ptActive,
    ptSamples,
    skewerList: [...skewerList],
    drawCalls: lastSceneDrawCalls || renderer.info.render.calls,
    triangles: lastSceneTriangles || renderer.info.render.triangles,
    duckCount: duckRoots.length,
    circuitDuckCount: duckRoots.filter((d) => d.kind === 'circuit').length,
    hatCount: duckRoots.filter((d) => Boolean(d.hatMesh)).length,
    uniqueDesignCount: new Set(duckRoots.map((d) => d.designId).filter(Boolean)).size,
    physicsStats: sanctuaryPhysics.getStats(),
    graphState: sanctuaryGraph.getState(),
    dramaState: dramaEngine.getState(),
    quirksState: quirksEngine.getState(),
    posesState: duckPoses.getState(),
    activeCameraScript,
    stylizedOutlineCount,
    classicMoleCount: duckRoots.filter((d) => Boolean(d.cartoonRig?.beautyMark)).length,
    logbookPagesFound: sharedLogbook.pages.filter((p) => p.found).length,
    logbookDesignsSeen: sharedLogbook.designs.filter((d) => d.seen).length,
    logbookHatsWorn: sharedLogbook.hats.filter((h) => h.worn).length,
    logbookStampsEarned: sharedLogbook.stamps.filter((s) => s.earned).length,
    logbookBestLap: sharedLogbook.records.bestLap,
    simHour: +simHour.toFixed(2),
    timeMode,
    ecoMode,
    photoMode,
    bloomActive: shouldUseComposer(),
    activeEnvKey,
    weather: weatherSystem.getState(),
    pixelRatio: renderer.getPixelRatio(),
    lang: i18n.getLang(),
    audio: ambientAudio.getState(),
    secretsUnlocked: secretTracker.getUnlocked().map((s) => s.id),
    customDuckCount: sanctuaryLoop.customDucks.length,
    hearthUnlocks: sanctuaryLoop.hearthUnlocks,
    bookState: sanctuaryBook ? sanctuaryBook.getState() : null,
    bookSpotIntensity: +bookOverheadSpot.intensity.toFixed(2),
  }),
};
