const STORAGE_KEY = 'rubber-duck-sanctuary.quirks.v1';

export const TARGET_RESONANCE_TEMP = 38.4;
export const DEFAULT_WATER_TEMP = 37.6;

export const REDACTION_IDS = Object.freeze([
  'classic_mole',
  'cherry_beret',
  'daisy_pen',
  'temp_384',
]);

const TILT_STEPS = [0, 7, 14, 21, 28];
const TILT_NOTE_KEYS = [
  'quirk.tilt0',
  'quirk.tilt7',
  'quirk.tilt14',
  'quirk.tilt21',
  'quirk.tiltSlip',
];

function round1(v) {
  return Math.round(v * 10) / 10;
}

export function createQuirksEngine({ store = null } = {}) {
  let state = {
    waterTempC: DEFAULT_WATER_TEMP,
    resonanceCount: 0,
    unredacted: [],
    pageStamps: [],
    totalTilts: 0,
    totalJets: 0,
    totalGrudges: 0,
  };

  if (store) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.waterTempC === 'number' && Number.isFinite(parsed.waterTempC)) {
          state.waterTempC = Math.max(36.0, Math.min(41.0, round1(parsed.waterTempC)));
        }
        if (typeof parsed.resonanceCount === 'number') state.resonanceCount = parsed.resonanceCount;
        if (Array.isArray(parsed.unredacted)) state.unredacted = [...new Set(parsed.unredacted)];
        if (Array.isArray(parsed.pageStamps)) state.pageStamps = parsed.pageStamps.slice(-24);
        if (typeof parsed.totalTilts === 'number') state.totalTilts = parsed.totalTilts;
        if (typeof parsed.totalJets === 'number') state.totalJets = parsed.totalJets;
        if (typeof parsed.totalGrudges === 'number') state.totalGrudges = parsed.totalGrudges;
      }
    } catch { /* ignore corrupt persisted quirks state */ }
  }

  function persist() {
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore storage quota */ }
  }

  let stareRemainingSec = 0;
  let stareElapsedSec = 0;
  let hitStopSec = 0;
  let subliminalSec = 0;
  let subliminalTextKey = 'quirk.subliminal1';
  let valveClicks = 0;

  const tiltByDuck = new Map();
  const squeezeByDuck = new Map();
  const flingCountByDuck = new Map();
  const grudgeTimerByDuck = new Map();

  function triggerUncannyStare(durationSec = 2.2) {
    stareRemainingSec = Math.max(stareRemainingSec, durationSec);
    stareElapsedSec = 0;
  }

  function crankValve(dir = 1) {
    // Deliberately fussy mechanical brass valve: +0.2C clockwise, -0.1C counter-clockwise.
    const delta = dir >= 0 ? 0.2 : -0.1;
    valveClicks += 1;
    const prev = state.waterTempC;
    const next = round1(Math.max(36.0, Math.min(41.0, prev + delta)));
    state.waterTempC = next;
    const resonanceTriggered = next === TARGET_RESONANCE_TEMP && prev !== TARGET_RESONANCE_TEMP;
    if (resonanceTriggered) {
      state.resonanceCount += 1;
      triggerUncannyStare(2.2);
      triggerHitStop(0.05);
    }
    persist();
    return {
      waterTempC: next,
      delta,
      atTarget: next === TARGET_RESONANCE_TEMP,
      resonanceTriggered,
      clicks: valveClicks,
    };
  }

  function setWaterTemp(tempC) {
    const clamped = round1(Math.max(36.0, Math.min(41.0, Number(tempC) || DEFAULT_WATER_TEMP)));
    const prev = state.waterTempC;
    state.waterTempC = clamped;
    const resonanceTriggered = clamped === TARGET_RESONANCE_TEMP && prev !== TARGET_RESONANCE_TEMP;
    if (resonanceTriggered) {
      state.resonanceCount += 1;
      triggerUncannyStare(2.2);
      triggerHitStop(0.05);
    }
    persist();
    return { waterTempC: clamped, atTarget: clamped === TARGET_RESONANCE_TEMP, resonanceTriggered };
  }

  function tiltAccessory(duckId) {
    const curStep = tiltByDuck.get(duckId) || 0;
    const nextStep = curStep + 1;
    state.totalTilts += 1;
    if (nextStep >= TILT_STEPS.length - 1) {
      tiltByDuck.set(duckId, 0);
      persist();
      return { deg: 0, peakDeg: TILT_STEPS[TILT_STEPS.length - 1], slipped: true, noteKey: TILT_NOTE_KEYS[4] };
    }
    tiltByDuck.set(duckId, nextStep);
    persist();
    return {
      deg: TILT_STEPS[nextStep],
      peakDeg: TILT_STEPS[nextStep],
      slipped: false,
      noteKey: TILT_NOTE_KEYS[nextStep],
    };
  }

  function getAccessoryTiltDeg(duckId) {
    return TILT_STEPS[tiltByDuck.get(duckId) || 0] || 0;
  }

  function beginSqueeze(duckId) {
    if (!duckId) return;
    squeezeByDuck.set(duckId, { holding: true, pressure: 0.08 });
  }

  function getSqueezePressure(duckId) {
    return squeezeByDuck.get(duckId)?.pressure || 0;
  }

  function releaseSqueeze(duckId) {
    const rec = squeezeByDuck.get(duckId);
    squeezeByDuck.delete(duckId);
    const power = rec ? rec.pressure : 0;
    const firedJet = power >= 0.35;
    if (firedJet) {
      state.totalJets += 1;
      triggerHitStop(0.05);
      persist();
    }
    return { firedJet, power: +power.toFixed(3) };
  }

  function recordDuckFling(duckId) {
    if (!duckId) return { flings: 0, stubborn: false };
    const next = (flingCountByDuck.get(duckId) || 0) + 1;
    flingCountByDuck.set(duckId, next);
    if (next >= 3) {
      flingCountByDuck.set(duckId, 0);
      grudgeTimerByDuck.set(duckId, 8.5);
      state.totalGrudges += 1;
      persist();
      return { flings: next, stubborn: true, durationSec: 8.5 };
    }
    return { flings: next, stubborn: false, durationSec: 0 };
  }

  function getDuckMood(duckId) {
    const rem = grudgeTimerByDuck.get(duckId) || 0;
    const stubborn = rem > 0;
    return {
      stubborn,
      grudgeRemainingSec: +rem.toFixed(2),
      massMultiplier: stubborn ? 3.2 : 1.0,
      eyelidSquint: stubborn ? 0.68 : 0.0,
    };
  }

  function triggerHitStop(sec = 0.05) {
    hitStopSec = Math.max(hitStopSec, Math.min(0.12, Math.max(0.01, sec)));
  }

  function triggerSubliminal(textKey = 'quirk.subliminal1', sec = 0.05) {
    subliminalTextKey = textKey;
    subliminalSec = Math.max(subliminalSec, Math.min(0.12, Math.max(0.03, sec)));
  }

  function isRedacted(id) {
    return !state.unredacted.includes(id);
  }

  function scratchRedaction(id) {
    if (!id || state.unredacted.includes(id)) return false;
    state.unredacted.push(id);
    persist();
    return true;
  }

  function addPageStamp(spreadIdx, side, u, v, kind = 'suanbo') {
    const angleDeg = -18 + ((state.pageStamps.length * 13) % 33);
    const stamp = {
      spreadIdx,
      side: side === 'left' ? 'left' : 'right',
      u: Math.max(0.08, Math.min(0.92, Number(u) || 0.5)),
      v: Math.max(0.12, Math.min(0.88, Number(v) || 0.5)),
      kind,
      angleDeg,
    };
    state.pageStamps.push(stamp);
    if (state.pageStamps.length > 24) state.pageStamps.shift();
    triggerHitStop(0.05);
    persist();
    return stamp;
  }

  function getPageStamps(spreadIdx, side) {
    return state.pageStamps.filter((s) => s.spreadIdx === spreadIdx && s.side === side);
  }

  function step(dt) {
    const h = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (hitStopSec > 0) hitStopSec = Math.max(0, hitStopSec - h);
    if (subliminalSec > 0) subliminalSec = Math.max(0, subliminalSec - h);

    let syncBlink = false;
    if (stareRemainingSec > 0) {
      stareElapsedSec += h;
      stareRemainingSec = Math.max(0, stareRemainingSec - h);
      // Exact 0.05s (50ms) synchronized uncanny duck blink right in the middle of the stare!
      if (stareElapsedSec >= 0.92 && stareElapsedSec <= 0.97) {
        syncBlink = true;
      }
    }

    for (const [id, rec] of squeezeByDuck.entries()) {
      if (rec.holding) {
        rec.pressure = Math.min(1.0, rec.pressure + h * 0.85);
      } else {
        squeezeByDuck.delete(id);
      }
    }

    for (const [id, rem] of grudgeTimerByDuck.entries()) {
      const next = rem - h;
      if (next <= 0) grudgeTimerByDuck.delete(id);
      else grudgeTimerByDuck.set(id, next);
    }

    return {
      hitStopped: hitStopSec > 0,
      stareActive: stareRemainingSec > 0,
      syncBlink,
      subliminalActive: subliminalSec > 0,
      subliminalTextKey,
    };
  }

  function getState() {
    return {
      waterTempC: state.waterTempC,
      atResonanceTemp: state.waterTempC === TARGET_RESONANCE_TEMP,
      resonanceCount: state.resonanceCount,
      stareActive: stareRemainingSec > 0,
      stareRemainingSec: +stareRemainingSec.toFixed(2),
      hitStopped: hitStopSec > 0,
      subliminalActive: subliminalSec > 0,
      unredactedCount: state.unredacted.length,
      unredacted: [...state.unredacted],
      totalPageStamps: state.pageStamps.length,
      totalTilts: state.totalTilts,
      totalJets: state.totalJets,
      totalGrudges: state.totalGrudges,
    };
  }

  return {
    crankValve,
    setWaterTemp,
    triggerUncannyStare,
    tiltAccessory,
    getAccessoryTiltDeg,
    beginSqueeze,
    getSqueezePressure,
    releaseSqueeze,
    recordDuckFling,
    getDuckMood,
    triggerHitStop,
    isHitStopped: () => hitStopSec > 0,
    triggerSubliminal,
    isSubliminalActive: () => subliminalSec > 0,
    isRedacted,
    scratchRedaction,
    addPageStamp,
    getPageStamps,
    step,
    getState,
  };
}
