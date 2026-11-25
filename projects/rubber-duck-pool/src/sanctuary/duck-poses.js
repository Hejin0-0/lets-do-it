export const MONOGRAPH_CAMERA_SCRIPTS = Object.freeze([
  { id: 'water_pov',  hour: 8.5,   fov: 42, pos: [4.6, -0.5, 0.32],   target: [1.8, 1.4, -0.05] },
  { id: 'isometric',  hour: 13.0,  fov: 28, pos: [-16.0, -34.0, 26.5], target: [0.0, -2.5, 0.4] },
  { id: 'study_pov',  hour: 17.75, fov: 50, pos: [-9.85, -4.45, 1.55], target: [1.5, -1.8, 0.35] },
  { id: 'nocturnal',  hour: 22.5,  fov: 45, pos: [6.8, -14.8, 2.2],    target: [0.8, 1.2, 0.9] },
]);

const CAMERA_BOB_CONFIG = Object.freeze({
  primaryPeriodSec: 2.8,
  primaryAmpM: 0.018,
  secondaryPeriodSec: 1.15,
  secondaryAmpM: 0.006,
  swayPeriodSec: 3.6,
  swayAmpM: 0.012,
});

function hashSeed(seed) {
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff;
}

export function sampleWaterPovCameraBob(timeSec, seed = 1922) {
  const phaseA = hashSeed(seed) * Math.PI * 2;
  const phaseB = hashSeed(seed + 17) * Math.PI * 2;
  const phaseC = hashSeed(seed + 43) * Math.PI * 2;
  const dy =
    Math.sin((timeSec / CAMERA_BOB_CONFIG.primaryPeriodSec) * Math.PI * 2 + phaseA) *
      CAMERA_BOB_CONFIG.primaryAmpM +
    Math.sin((timeSec / CAMERA_BOB_CONFIG.secondaryPeriodSec) * Math.PI * 2 + phaseB) *
      CAMERA_BOB_CONFIG.secondaryAmpM;
  const dx =
    Math.sin((timeSec / CAMERA_BOB_CONFIG.swayPeriodSec) * Math.PI * 2 + phaseC) *
    CAMERA_BOB_CONFIG.swayAmpM;
  return { dx, dy };
}

const IDLE_SAMPLE = Object.freeze({
  pose: 'idle',
  yOffset: 0,
  pitchOffset: 0,
  rollOffset: 0,
  scaleX: 1,
  scaleY: 1,
  eggProgress: 0,
  breathScale: 1,
  happyEyes: false,
  sleepingEyes: false,
  emitZzz: false,
});

const VALID_POSES = new Set(['hatch', 'dive', 'happy_splash', 'sleep']);

export function createDuckPoseController() {
  const active = new Map();

  function triggerPose(duckId, pose, durationSec = 1.5) {
    if (!duckId || !VALID_POSES.has(pose)) return false;
    active.set(duckId, {
      pose,
      duration: Math.max(0.15, Number(durationSec) || 1.5),
      elapsed: 0,
      stepped: false,
      zzzTimer: 0.65,
    });
    return true;
  }

  function clearPose(duckId) {
    return active.delete(duckId);
  }

  function step(dt) {
    const stepDt = Math.max(0, Math.min(0.25, Number(dt) || 0));
    const zzzDue = [];
    for (const [duckId, st] of active.entries()) {
      st.stepped = true;
      st.elapsed += stepDt;
      if (st.pose === 'sleep') {
        st.zzzTimer += stepDt;
        if (st.zzzTimer >= 1.35) {
          st.zzzTimer -= 1.35;
          zzzDue.push(duckId);
        }
      }
      if (st.elapsed >= st.duration) {
        active.delete(duckId);
      }
    }
    return zzzDue;
  }

  function sample(duckId, timeSec = 0, phase = 0) {
    const st = active.get(duckId);
    if (!st) return IDLE_SAMPLE;

    const elapsed = st.stepped ? st.elapsed : Math.max(0, timeSec);
    if (elapsed >= st.duration) return IDLE_SAMPLE;

    const u = Math.max(0, Math.min(1, elapsed / st.duration));
    const env = Math.sin(u * Math.PI);

    if (st.pose === 'hatch') {
      return {
        pose: 'hatch',
        yOffset: env * 0.12,
        pitchOffset: -0.10 * env,
        rollOffset: Math.sin(u * Math.PI * 4) * 0.14 * env,
        scaleX: 1 - env * 0.08,
        scaleY: 1 + env * 0.16,
        eggProgress: u,
        breathScale: 1,
        happyEyes: u > 0.55,
        sleepingEyes: false,
        emitZzz: false,
      };
    }

    if (st.pose === 'dive') {
      return {
        pose: 'dive',
        yOffset: -env * 0.14,
        pitchOffset: env * 1.42,
        rollOffset: Math.sin(elapsed * 9.0 + phase) * 0.08 * env,
        scaleX: 1 - env * 0.10,
        scaleY: 1 + env * 0.18,
        eggProgress: 0,
        breathScale: 1,
        happyEyes: false,
        sleepingEyes: false,
        emitZzz: false,
      };
    }

    if (st.pose === 'happy_splash') {
      return {
        pose: 'happy_splash',
        yOffset: env * 0.14,
        pitchOffset: -0.18 * env,
        rollOffset: Math.sin(elapsed * 24.0 + phase) * 0.24 * env,
        scaleX: 1 + env * 0.06,
        scaleY: 1 + env * 0.10,
        eggProgress: 0,
        breathScale: 1,
        happyEyes: true,
        sleepingEyes: false,
        emitZzz: false,
      };
    }

    // Sleep pose: exact 0.4 Hz rhythmic breathing squash-stretch (Monograph PLATE 03-A)
    const breath = Math.sin(timeSec * Math.PI * 2 * 0.4 + phase);
    const breathScale = 1 + breath * 0.045;
    return {
      pose: 'sleep',
      yOffset: -0.025,
      pitchOffset: 0.14 + breath * 0.03,
      rollOffset: Math.sin(timeSec * 0.7 + phase) * 0.03,
      scaleX: breathScale,
      scaleY: 1 / Math.sqrt(breathScale),
      eggProgress: 0,
      breathScale,
      happyEyes: false,
      sleepingEyes: true,
      emitZzz: true,
    };
  }

  function getActiveHatch() {
    for (const [duckId, st] of active.entries()) {
      if (st.pose === 'hatch') {
        return { duckId, progress: Math.max(0.01, Math.min(0.99, st.elapsed / st.duration)) };
      }
    }
    return null;
  }

  function getState() {
    const counts = { hatch: 0, dive: 0, happy_splash: 0, sleep: 0 };
    for (const st of active.values()) {
      if (counts[st.pose] !== undefined) counts[st.pose] += 1;
    }
    return { activeCount: active.size, counts };
  }

  return { triggerPose, clearPose, step, sample, getActiveHatch, getState };
}
