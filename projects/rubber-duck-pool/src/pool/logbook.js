// Collection state only: world and FX event batches are consumed once by the page each frame.
import { DESIGNS, HATS, MAX_DUCKS } from './ducks.js';
import { COLLECTIBLES } from './collectibles.js';
const KEY = 'rubber-duck-pool.book.v1', SAMPLE_SECONDS = .25, SAVE_SECONDS = 5;
// 180s, 40 ducks, seeds 3/5/7: 2 of 41 complete return-to-return circuits beat 30s.
export const FAST_LAP_SECONDS = 30;
const HAT_ENTRIES = HATS.flatMap((h, index) => h.id !== 'none' && !h.special ? [{ index, label: h.label }] : []);
const STAMPS = [
  ['first-slide', 'Down the flume', 'Watch a duck finish its first slide.'],
  ['all-designs', 'A dozen personalities', 'Meet all twelve duck designs.'],
  ['all-hats', 'Dressed for the island', 'See all seven ordinary hats worn.'],
  ['full-house', 'Pool party', 'Welcome forty ducks at once.'],
  ['ten-laps', 'Regular swimmer', 'Watch one duck complete ten laps.'],
  ['fast-lap', 'Lucky current', `Watch a duck finish a lap in under ${FAST_LAP_SECONDS} seconds.`],
  ['takeoff', 'Cleared for takeoff', 'Watch a flyer take to the air.'],
  ['lost-at-sea', 'Beyond the shore', 'Watch a duck venture out to sea.'],
  ['rescue', 'Welcome back', 'See a duck rescued from the sea.'],
  ['race-winner', 'First across', 'Cheer a duck winning a race.'],
  ['fireworks', 'Sky full of colour', 'Watch fireworks above the island.'],
  ['day-and-night', 'Around the sun', 'Stay for a whole cycle of day and night.'],
].map(([id, title, text]) => ({ id, title, text }));
const nonnegative = n => Number.isFinite(n) && n >= 0;
const count = n => Number.isSafeInteger(n) && n >= 0;
const lapTime = n => Number.isFinite(n) && n > 0;
const optionalTime = n => n === null || nonnegative(n);
const emptyPages = () => Object.fromEntries(COLLECTIBLES.map(({id}) => [id, null]));
const blank = () => ({ version: 2, pages: emptyPages(), designs: DESIGNS.map(() => null), hats: HAT_ENTRIES.map(() => false),
  stamps: STAMPS.map(() => null), records: { bestLap: null, mostLaps: 0, racesWon: 0 } });
function validArray(a, length, valid) { return Array.isArray(a) && a.length === length && a.every(valid); }
function validBook(b) {
  if (!b || (b.version !== 1 && b.version !== 2)) return false;
  if (b.version === 2 && (!b.pages || typeof b.pages !== 'object' || Array.isArray(b.pages) || !Object.values(b.pages).every(optionalTime) || Object.keys(b.pages).some(id => !COLLECTIBLES.some(item => item.id === id)))) return false;
  if (!validArray(b.designs, DESIGNS.length, optionalTime)) return false;
  if (!validArray(b.hats, HAT_ENTRIES.length, v => typeof v === 'boolean')) return false;
  if (!validArray(b.stamps, STAMPS.length, optionalTime)) return false;
  const r = b.records;
  return !!r && (r.bestLap === null || lapTime(r.bestLap)) && count(r.mostLaps) && count(r.racesWon);
}
function read(store) {
  try { const b = JSON.parse(store?.getItem(KEY) ?? 'null'); if (validBook(b)) return {
    version: 2, pages: b.version === 1 ? emptyPages() : { ...emptyPages(), ...b.pages }, designs: b.designs, hats: b.hats, stamps: b.stamps,
    records: { bestLap: b.records.bestLap, mostLaps: b.records.mostLaps, racesWon: b.records.racesWon },
  }; } catch { /* Storage may be disabled, full, or corrupt. */ }
  return blank();
}
const snapshot = (stamp, at) => ({ ...stamp, earned: at !== null, at });
/** store: Storage-like or null. Storage failures never escape; ducks and notices are per visit.
 * All getters return snapshots. records is an additional read-only snapshot for the book's record panel.
 * Call observe once per frame after the world and FX; pass their combined events exactly once.
 */
export function createLogbook(store) {
  let data = read(store), met = new Map(), fresh = [], dirty = false, newlyEarned = false;
  let sampledAt = -Infinity, savedAt = -Infinity, previousTime = null, previousHour = null, watchedHours = 0;
  let raceWinners = new Set();
  function earn(id, now) {
    const i = STAMPS.findIndex(s => s.id === id);
    if (data.stamps[i] !== null) return;
    data.stamps[i] = now; fresh.push(snapshot(STAMPS[i], now)); dirty = newlyEarned = true;
  }
  function design(index, now) {
    if (!Number.isInteger(index) || index < 0 || index >= DESIGNS.length || data.designs[index] !== null) return;
    data.designs[index] = now; dirty = true;
  }
  function recordLap(time, now) {
    if (!lapTime(time)) return;
    if (data.records.bestLap === null || time < data.records.bestLap) { data.records.bestLap = time; dirty = true; }
    if (time < FAST_LAP_SECONDS) earn('fast-lap', now);
  }
  function stats(d, now) {
    const s = d.stats;
    if (!s) return;
    for (const [field, stamp] of [['slides','first-slide'],['flights','takeoff'],['seaTrips','lost-at-sea'],['rescued','rescue']]) {
      if (s[field] > 0) earn(stamp, now);
    }
    if (s.laps >= 10) earn('ten-laps', now);
    if (s.laps > data.records.mostLaps) { data.records.mostLaps = s.laps; dirty = true; }
    recordLap(s.bestLap, now);
  }
  function sample(world, now) {
    const ducks = world.ducks;
    for (const row of met.values()) row.here = false;
    for (const d of ducks) {
      design(d.colour, now);
      const hat = HAT_ENTRIES.findIndex(h => h.index === d.hat);
      if (hat >= 0 && !data.hats[hat]) { data.hats[hat] = true; dirty = true; }
      const s = d.stats;
      met.set(d.id, { id: d.id, name: d.name, colour: d.colour, hat: d.hat,
        laps: s?.laps ?? d.laps ?? 0, bestLap: s?.bestLap ?? null, slides: s?.slides ?? 0,
        flights: s?.flights ?? 0, rescued: s?.rescued ?? 0, wins: met.get(d.id)?.wins ?? 0, here: true });
      stats(d, now);
    }
    while (met.size > MAX_DUCKS) met.delete(met.keys().next().value);
    if (ducks.length >= MAX_DUCKS) earn('full-house', now);
    sampledAt = now;
  }
  function winner(result, now) {
    if (result.place !== 1 || !lapTime(result.time) || raceWinners.has(result.id)) return;
    raceWinners.add(result.id); data.records.racesWon++; dirty = true;
    const row = met.get(result.id); if (row) row.wins++;
    earn('race-winner', now);
  }
  function event(e, now) {
    switch (e.type) {
      case 'collected': for (const id of e.ids) if (Object.hasOwn(data.pages,id) && data.pages[id] === null) { data.pages[id] = now; dirty = newlyEarned = true; } break;
      case 'arrive': case 'voice': design(e.colour, now); break;
      case 'lap': recordLap(e.time, now); break;
      case 'takeoff': earn('takeoff', now); break;
      case 'escaped': earn('lost-at-sea', now); break;
      case 'rescued': if (e.ids.length) earn('rescue', now); break;
      case 'raceStart': raceWinners.clear(); break;
      case 'raceFinish': winner(e, now); break;
      case 'raceEnd': for (const result of e.results) winner(result, now); break;
      case 'launch': case 'burst': earn('fireworks', now); break;
    }
  }
  function watchDay(hour, now) {
    if (previousHour !== null && previousTime !== null) {
      const delta = (hour - previousHour + 24) % 24, elapsed = now - previousTime;
      // Reject clock scrubbing or unobserved large jumps; normal clock advances .04 hours/second.
      if (delta <= 1 && delta <= elapsed / 10 + 1e-8) watchedHours += delta;
      else watchedHours = 0;
      if (watchedHours >= 24 - 1e-8) earn('day-and-night', now);
    }
    previousHour = hour; previousTime = now;
  }
  function save(now) {
    if (!dirty || (!newlyEarned && now - savedAt < SAVE_SECONDS)) return;
    savedAt = now;
    try { store?.setItem(KEY, JSON.stringify(data)); dirty = false; } catch { /* Retry on the next save interval. */ }
    newlyEarned = false;
  }
  return {
    observe(world, events = []) {
      const now = world.time;
      if (previousTime !== null && now < previousTime) {
        met.clear(); raceWinners.clear(); sampledAt = savedAt = -Infinity; previousHour = null; watchedHours = 0;
      }
      if (now - sampledAt >= SAMPLE_SECONDS) sample(world, now);
      for (const e of events) event(e, now);
      if (data.designs.every(t => t !== null)) earn('all-designs', now);
      if (data.hats.every(Boolean)) earn('all-hats', now);
      watchDay(world.day.hour, now); save(now);
    },
    get complete() { return COLLECTIBLES.length > 0 && COLLECTIBLES.every(({id}) => data.pages[id] !== null); },
    get pages() { return COLLECTIBLES.map(({id,kind}) => ({id,kind,found:data.pages[id] !== null,at:data.pages[id]})); },
    found(id) { return Object.hasOwn(data.pages,id) && data.pages[id] !== null; },
    get designs() { return DESIGNS.map((d, index) => ({ index, label: d.label, seen: data.designs[index] !== null, first: data.designs[index] })); },
    get hats() { return HAT_ENTRIES.map((h, i) => ({ ...h, worn: data.hats[i] })); },
    get ducks() { return Array.from(met.values(), d => ({ ...d })).reverse(); },
    get stamps() { return STAMPS.map((s, i) => snapshot(s, data.stamps[i])); },
    get records() { return { ...data.records }; },
    get fresh() { return fresh.map(s => ({ ...s })); },
    take() { fresh = []; },
    reset() {
      data = blank(); met.clear(); fresh = []; raceWinners.clear(); dirty = newlyEarned = false;
      sampledAt = savedAt = -Infinity; previousTime = previousHour = null; watchedHours = 0;
      try { store?.removeItem(KEY); } catch { /* The in-memory book is still cleared. */ }
    },
  };
}
