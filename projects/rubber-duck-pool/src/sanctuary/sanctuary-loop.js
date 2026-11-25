// Core Gameplay Loop persistence & rules for Hydro Sanctuary:
// 1. Custom Watercolor Ducks painted at the Atelier easel -> released into the pool & archived in the Book.
// 2. Campfire Roasting Tiers & Golden Marshmallow / Charred Hearth special duck unlocks -> releasable into the pool.
// Pure deterministic logic (zero Math.random / Date.now) for testability & scripts/check.mjs compliance.

export const SANCTUARY_LOOP_KEY = 'rubber-duck-pool.sanctuary.v1';
export const MAX_CUSTOM_DUCKS = 6;

export const ROAST_TIERS = {
  RAW: 'raw',
  TOASTY: 'toasty',
  GOLDEN: 'golden',
  CHARRED: 'charred',
};

export const SPECIAL_HEARTH_DUCKS = {
  golden_smore: {
    id: 'golden_smore',
    name: '골든 마시멜로 덕',
    latin: 'Anas Torrefacta Aurea',
    hex: '#d98a32',
    toastLevel: 0.68,
    desc: '이로리 화로에서 60~84% 골든 구간으로 완벽히 구워낸 노릇한 마시멜로 러버덕.',
  },
  charred_ember: {
    id: 'charred_ember',
    name: '숯불 바삭 덕',
    latin: 'Anas Carbonaria Focis',
    hex: '#4e2816',
    toastLevel: 0.92,
    desc: '장작불 바로 위에서 85% 이상 바삭하게 그을려 낸 스모키 화로 러버덕.',
  },
};

export function classifyRoastTier(avgToast) {
  const v = Number.isFinite(avgToast) ? Math.max(0, Math.min(1, avgToast)) : 0;
  if (v < 0.25) return ROAST_TIERS.RAW;
  if (v < 0.60) return ROAST_TIERS.TOASTY;
  if (v <= 0.84) return ROAST_TIERS.GOLDEN;
  return ROAST_TIERS.CHARRED;
}

export function hearthUnlockForToast(avgToast) {
  const tier = classifyRoastTier(avgToast);
  if (tier === ROAST_TIERS.GOLDEN) return 'golden_smore';
  if (tier === ROAST_TIERS.CHARRED) return 'charred_ember';
  return null;
}

function emptyState() {
  return {
    version: 1,
    nextSeq: 1,
    customDucks: [], // [{ id, seq, name, hex, dataUrl, createdAt }]
    hearthUnlocks: {
      golden_smore: null,
      charred_ember: null,
    },
    stats: {
      ducksPetted: 0,
      ridesTaken: 0,
      customCreated: 0,
      perfectRoasts: 0,
    },
  };
}

function isValidCustomDuck(d) {
  return (
    d && typeof d === 'object' &&
    typeof d.id === 'string' && d.id.length > 0 &&
    Number.isInteger(d.seq) && d.seq > 0 &&
    typeof d.name === 'string' && d.name.length > 0 &&
    typeof d.hex === 'string' &&
    typeof d.dataUrl === 'string' && d.dataUrl.startsWith('data:image/')
  );
}

function loadState(store) {
  if (!store) return emptyState();
  try {
    const raw = store.getItem(SANCTUARY_LOOP_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return emptyState();
    const base = emptyState();
    base.nextSeq = Number.isInteger(parsed.nextSeq) && parsed.nextSeq > 0 ? parsed.nextSeq : 1;
    if (Array.isArray(parsed.customDucks)) {
      base.customDucks = parsed.customDucks.filter(isValidCustomDuck).slice(0, MAX_CUSTOM_DUCKS);
    }
    if (parsed.hearthUnlocks && typeof parsed.hearthUnlocks === 'object') {
      for (const k of Object.keys(base.hearthUnlocks)) {
        const v = parsed.hearthUnlocks[k];
        base.hearthUnlocks[k] = Number.isFinite(v) ? v : null;
      }
    }
    if (parsed.stats && typeof parsed.stats === 'object') {
      for (const k of Object.keys(base.stats)) {
        const v = parsed.stats[k];
        if (Number.isInteger(v) && v >= 0) base.stats[k] = v;
      }
    }
    return base;
  } catch {
    return emptyState();
  }
}

export function createSanctuaryLoop(store = null) {
  const state = loadState(store);

  function save() {
    if (!store) return;
    try {
      store.setItem(SANCTUARY_LOOP_KEY, JSON.stringify(state));
    } catch { /* ignore quota / private browsing errors */ }
  }

  return {
    get customDucks() {
      return state.customDucks.map((d) => ({ ...d }));
    },
    get hearthUnlocks() {
      return { ...state.hearthUnlocks };
    },
    get stats() {
      return { ...state.stats };
    },

    /** Register a newly painted watercolor duck, persisting its thumbnail and capping archive size. */
    addCustomDuck({ dataUrl, hex = '#f2c138', name = null, timestamp = 0 }) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        throw new Error('Custom duck requires a valid image dataUrl');
      }
      const seq = state.nextSeq++;
      const entry = {
        id: `atelier-${seq}`,
        seq,
        name: name || `아틀리에 수채화 덕 #${seq}`,
        hex: typeof hex === 'string' && hex ? hex : '#f2c138',
        dataUrl,
        createdAt: Number.isFinite(timestamp) ? timestamp : 0,
      };
      state.customDucks.unshift(entry);
      if (state.customDucks.length > MAX_CUSTOM_DUCKS) {
        state.customDucks.length = MAX_CUSTOM_DUCKS;
      }
      state.stats.customCreated++;
      save();
      return { ...entry };
    },

    /** Observe skewer average roast level; unlocks golden_smore or charred_ember on first hit. */
    recordRoast(avgToast, timestamp = 0) {
      const unlockId = hearthUnlockForToast(avgToast);
      if (!unlockId) return { tier: classifyRoastTier(avgToast), newlyUnlocked: null };
      const already = state.hearthUnlocks[unlockId] !== null;
      if (!already) {
        state.hearthUnlocks[unlockId] = Number.isFinite(timestamp) ? timestamp : 0;
        if (unlockId === 'golden_smore') state.stats.perfectRoasts++;
        save();
      }
      return {
        tier: classifyRoastTier(avgToast),
        unlockId,
        newlyUnlocked: already ? null : SPECIAL_HEARTH_DUCKS[unlockId],
      };
    },

    recordPet() {
      state.stats.ducksPetted++;
      save();
      return state.stats.ducksPetted;
    },

    recordRide() {
      state.stats.ridesTaken++;
      save();
      return state.stats.ridesTaken;
    },
  };
}
