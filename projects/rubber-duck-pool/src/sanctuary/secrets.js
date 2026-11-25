// Four quiet secrets of the Hydro Sanctuary. Each unlocks one of the unexpected ducks when the player happens into
// its moment; nothing times out and nothing is lost. The caller passes the context and the time, so evaluation is
// pure and replays the same.
import { translate } from './i18n.js';

export const SECRETS_KEY = 'rubber-duck-pool.secrets.v1';

const isNight = (hour) => Number.isFinite(hour) && (hour >= 20 || hour < 5);

/** The context the conditions read: { hour, radioOn, goldenRoastUnlocked, customCreated, ducksPetted, ridesTaken,
 * slideRides, ecoMode, rainVol, hearthVol }. Names and hints live in i18n under secret.<id>. */
export const SANCTUARY_SECRETS = Object.freeze([
  { id: 'midnight_radio_roast', unlocks: '24-lantern', test: (c) => isNight(c.hour) && c.radioOn === true && c.goldenRoastUnlocked === true },
  { id: 'painter_quartet', unlocks: '17-bookbinder', test: (c) => c.customCreated >= 1 && c.ducksPetted >= 3 },
  { id: 'crown_court', unlocks: '13-teapot', test: (c) => c.ridesTaken >= 1 && c.slideRides >= 1 },
  { id: 'twilight_zen', unlocks: '19-moon', test: (c) => c.ecoMode === true && c.rainVol > 0.1 && c.hearthVol > 0.1 },
]);

function load(store) {
  const unlocked = {};
  try {
    const parsed = JSON.parse(store?.getItem(SECRETS_KEY) || 'null');
    if (parsed?.version === 1 && parsed.unlocked && typeof parsed.unlocked === 'object') {
      for (const s of SANCTUARY_SECRETS) if (Number.isFinite(parsed.unlocked[s.id])) unlocked[s.id] = parsed.unlocked[s.id];
    }
  } catch { /* unreadable or blocked storage: start with nothing found */ }
  return unlocked;
}

export function createSecretTracker(store = null) {
  const unlocked = load(store);
  const entry = (s) => ({ id: s.id, unlocks: s.unlocks, at: unlocked[s.id] });

  return {
    /** Unlock every secret whose moment the context shows; returns only the ones found now. */
    evaluate(context = {}, timestamp = 0) {
      const found = [];
      for (const s of SANCTUARY_SECRETS) {
        if (s.id in unlocked || !s.test(context)) continue;
        unlocked[s.id] = Number.isFinite(timestamp) ? timestamp : 0;
        found.push(entry(s));
      }
      if (found.length) {
        try { store?.setItem(SECRETS_KEY, JSON.stringify({ version: 1, unlocked })); } catch { /* storage full or blocked: kept for this visit */ }
      }
      return found;
    },
    getUnlocked: () => SANCTUARY_SECRETS.filter((s) => s.id in unlocked).map(entry),
    /** The hint for the first secret not yet found, or the all-found line. */
    getNextHint(lang = 'ko') {
      const next = SANCTUARY_SECRETS.find((s) => !(s.id in unlocked));
      return translate(lang, next ? `secret.${next.id}.hint` : 'secret.allFound');
    },
  };
}
