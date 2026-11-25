// Deterministic Atmospheric Weather System for Hydro Sanctuary.
// Pure seeded/numeric transitions (zero Math.random / Date.now for seeded-sim compliance).

export const WEATHER_MODES = Object.freeze(['clear', 'petals', 'mist', 'rain']);
export const WEATHER_STORAGE_KEY = 'rubber-duck-pool.weather.v1';

const TARGETS = Object.freeze({
  clear:  { rain: 0.0, mist: 0.0, petals: 0.0, overcast: 0.0,  fogDensity: 0.0,    wind: 0.25 },
  petals: { rain: 0.0, mist: 0.1, petals: 1.0, overcast: 0.08, fogDensity: 0.0025, wind: 0.62 },
  mist:   { rain: 0.0, mist: 1.0, petals: 0.15, overcast: 0.48, fogDensity: 0.0115, wind: 0.30 },
  rain:   { rain: 1.0, mist: 0.45, petals: 0.0, overcast: 0.72, fogDensity: 0.0085, wind: 0.78 },
});

function loadSavedMode(store) {
  if (!store) return 'clear';
  try {
    const raw = store.getItem(WEATHER_STORAGE_KEY);
    return WEATHER_MODES.includes(raw) ? raw : 'clear';
  } catch {
    return 'clear';
  }
}

export function createWeatherSystem({ store = null, initialMode = null } = {}) {
  let mode = WEATHER_MODES.includes(initialMode) ? initialMode : loadSavedMode(store);
  let manualLock = false;
  const cur = { ...TARGETS[mode] };

  function save() {
    if (!store) return;
    try {
      store.setItem(WEATHER_STORAGE_KEY, mode);
    } catch { /* ignore private storage restrictions */ }
  }

  function setMode(nextMode, { manual = true, immediate = false } = {}) {
    if (!WEATHER_MODES.includes(nextMode)) return mode;
    mode = nextMode;
    if (manual) manualLock = true;
    if (immediate) Object.assign(cur, TARGETS[mode]);
    save();
    return mode;
  }

  function cycleMode() {
    const idx = WEATHER_MODES.indexOf(mode);
    return setMode(WEATHER_MODES[(idx + 1) % WEATHER_MODES.length], { manual: true });
  }

  function syncFromRainAudio(rainVol) {
    if (manualLock) return mode;
    const v = Number(rainVol) || 0;
    if (v >= 0.38 && mode !== 'rain') {
      mode = 'rain';
      save();
    } else if (v < 0.12 && mode === 'rain') {
      mode = 'clear';
      save();
    }
    return mode;
  }

  function step(dt) {
    if (!(dt > 0)) return getState();
    const tgt = TARGETS[mode];
    const k = 1 - Math.exp(-dt * 2.4);
    for (const key of Object.keys(cur)) {
      cur[key] += (tgt[key] - cur[key]) * k;
    }
    return getState();
  }

  function getState() {
    return {
      mode,
      rain: +cur.rain.toFixed(4),
      mist: +cur.mist.toFixed(4),
      petals: +cur.petals.toFixed(4),
      overcast: +cur.overcast.toFixed(4),
      fogDensity: +cur.fogDensity.toFixed(5),
      wind: +cur.wind.toFixed(4),
    };
  }

  return {
    getMode: () => mode,
    setMode,
    cycleMode,
    syncFromRainAudio,
    step,
    getState,
  };
}
