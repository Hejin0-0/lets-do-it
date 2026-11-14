// Collection state only: world and FX event batches are consumed once by the page each frame.
import { DESIGNS, HATS, MAX_DUCKS } from './ducks.js';
import { COLLECTIBLES, openShelf } from './collectibles.js';
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
const validDate = n => Number.isInteger(n) && Math.abs(n) <= 8640000000000000;
const validPage = p => p === null || (p && typeof p === 'object' && !Array.isArray(p) && nonnegative(p.at) && (p.date === null || validDate(p.date)));
const emptyPages = () => Object.fromEntries(COLLECTIBLES.map(({id}) => [id, null]));
const blank = () => ({ version: 3, pages: emptyPages(), pool: [], designs: DESIGNS.map(() => null), hats: HAT_ENTRIES.map(() => false),
  stamps: STAMPS.map(() => null), records: { bestLap: null, mostLaps: 0, racesWon: 0 } });
function validArray(a, length, valid) { return Array.isArray(a) && a.length === length && a.every(valid); }
function validBook(b) {
  if (!b || (b.version !== 1 && b.version !== 2 && b.version !== 3)) return false;
  // a page id no longer in the list is an older list, not corruption: it is dropped on reading, and the rest kept
  if (b.version >= 2 && (!b.pages || typeof b.pages !== 'object' || Array.isArray(b.pages) || !COLLECTIBLES.every(({id}) => b.pages[id] === undefined || (b.version === 2 ? optionalTime(b.pages[id]) : validPage(b.pages[id]))))) return false;
  if (!validArray(b.designs, DESIGNS.length, optionalTime)) return false;
  if (!validArray(b.hats, HAT_ENTRIES.length, v => typeof v === 'boolean')) return false;
  if (!validArray(b.stamps, STAMPS.length, optionalTime)) return false;
  const r = b.records;
  return !!r && (r.bestLap === null || lapTime(r.bestLap)) && count(r.mostLaps) && count(r.racesWon);
}
/** The stored book as this version keeps it, and whether it was written as one (an older book has no pool); null when
 * there is none, it is corrupt, or storage fails. */
function read(store) {
  try { const b = JSON.parse(store?.getItem(KEY) ?? 'null'); if (validBook(b)) return { current: b.version === 3, book: {
    version: 3, pages: b.version === 1 ? emptyPages() : Object.fromEntries(COLLECTIBLES.map(({id}) => [id, b.pages[id] == null ? null : b.version === 2 ? { at: b.pages[id], date: null } : { at: b.pages[id].at, date: b.pages[id].date }])),
    // what was left in the pool (an older book has none): only pages found, each once; anything else in it is dropped
    pool: b.version === 3 && Array.isArray(b.pool) ? [...new Set(b.pool)].filter(id => typeof id === 'string' && b.pages[id] != null && COLLECTIBLES.some(c => c.id === id)) : [],
    designs: b.designs, hats: b.hats, stamps: b.stamps,
    records: { bestLap: b.records.bestLap, mostLaps: b.records.mostLaps, racesWon: b.records.racesWon },
  } }; } catch { /* Storage may be disabled, full, or corrupt. */ }
  return null;
}
/** One change to a book. The live book takes each as it happens; on saving, the ones not yet written are played again
 * onto the stored book, which another tab may have written since. */
function apply(b, [kind, a, at, date]) {
  switch (kind) {
    case 'page': if (b.pages[a] === null) b.pages[a] = { at, date }; break;
    case 'summon': if (b.pages[a] && !b.pool.includes(a)) b.pool.push(a); break;
    case 'sendBack': if (b.pool.includes(a)) b.pool.splice(b.pool.indexOf(a), 1); break;
    case 'design': b.designs[a] ??= at; break;
    case 'hat': b.hats[a] = true; break;
    case 'stamp': b.stamps[a] ??= at; break;
    case 'bestLap': if (b.records.bestLap === null || a < b.records.bestLap) b.records.bestLap = a; break;
    case 'mostLaps': b.records.mostLaps = Math.max(b.records.mostLaps, a); break;
    case 'raceWon': b.records.racesWon++; break;
  }
}
const snapshot = (stamp, at) => ({ ...stamp, earned: at !== null, at });
/** store: Storage-like or null. Storage failures never escape; ducks are per visit.
 * All getters return snapshots. records is an additional read-only snapshot for the book's record panel.
 * Call observe once per frame after the world and FX with their combined events; an event passed again is not taken twice.
 */
export function createLogbook(store, { now: clock } = {}) {
  let data = read(store)?.book ?? blank(), pending = [], met = new Map(), newlyEarned = false;
  const seen = new WeakSet();   // events already taken: a hidden page hands some over before the frame that brings them
  const change = (op) => { apply(data, op); pending.push(op); };
  let sampledAt = -Infinity, savedAt = -Infinity, previousTime = null, previousHour = null, watchedHours = 0;
  let raceWinners = new Set();
  function earn(id, now) {
    const i = STAMPS.findIndex(s => s.id === id);
    if (data.stamps[i] !== null) return;
    change(['stamp', i, now]); newlyEarned = true;
  }
  function design(index, now) {
    if (!Number.isInteger(index) || index < 0 || index >= DESIGNS.length || data.designs[index] !== null) return;
    change(['design', index, now]);
  }
  function recordLap(time, now) {
    if (!lapTime(time)) return;
    if (data.records.bestLap === null || time < data.records.bestLap) change(['bestLap', time]);
    if (time < FAST_LAP_SECONDS) earn('fast-lap', now);
  }
  function stats(d, now) {
    const s = d.stats;
    if (!s) return;
    for (const [field, stamp] of [['slides','first-slide'],['flights','takeoff'],['seaTrips','lost-at-sea'],['rescued','rescue']]) {
      if (s[field] > 0) earn(stamp, now);
    }
    if (s.laps >= 10) earn('ten-laps', now);
    if (s.laps > data.records.mostLaps) change(['mostLaps', s.laps]);
    recordLap(s.bestLap, now);
  }
  function sample(world, now) {
    const ducks = world.ducks;
    for (const row of met.values()) row.here = false;
    for (const d of ducks) {
      design(d.colour, now);
      const hat = HAT_ENTRIES.findIndex(h => h.index === d.hat);
      if (hat >= 0 && !data.hats[hat]) change(['hat', hat]);
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
    raceWinners.add(result.id); change(['raceWon']);
    const row = met.get(result.id); if (row) row.wins++;
    earn('race-winner', now);
  }
  function event(e, now) {
    switch (e.type) {
      case 'collected': for (const id of e.ids) if (Object.hasOwn(data.pages,id) && data.pages[id] === null) { const date = clock?.(); change(['page', id, now, validDate(date) ? date : null]); newlyEarned = true; } break;
      // in the pool from its summon until Send it back (an item a gull is taking when the page closes is gone); saved at
      // once, and kept even where this tab's book already says so: another tab may have changed the pool since
      case 'summoned': case 'sendBack': if (Object.hasOwn(data.pages, e.id)) { change([e.type === 'summoned' ? 'summon' : 'sendBack', e.id]); newlyEarned = true; } break;
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
      // Reject clock scrubbing or unobserved large jumps; normal clock advances 24/1800 hours/second.
      if (delta <= 1 && delta <= elapsed / 10 + 1e-8) watchedHours += delta;
      else watchedHours = 0;
      if (watchedHours >= 24 - 1e-8) earn('day-and-night', now);
    }
    previousHour = hour; previousTime = now;
  }
  function rebased() {
    const stored = read(store);
    if (!stored?.current) return null;
    for (const op of pending) apply(stored.book, op);
    return stored.book;
  }
  // Another tab may have written the book since this one read it: what is stored is the base, and this tab's own changes
  // since its last write go on top, in order. A missing, corrupt or older book is replaced by this tab's. The live book
  // becomes what was written only once the write has gone through.
  function save(now, force = false) {
    if (!pending.length || (!force && !newlyEarned && now - savedAt < SAVE_SECONDS)) return;
    savedAt = now;
    try {
      const next = rebased() ?? structuredClone(data);
      store?.setItem(KEY, JSON.stringify(next));
      data = next; pending = [];
    } catch { /* Retry on the next save interval. */ }
    newlyEarned = false;
  }
  return {
    observe(world, events = []) {
      const now = world.time;
      if (previousTime !== null && now < previousTime) {
        met.clear(); raceWinners.clear(); sampledAt = savedAt = -Infinity; previousHour = null; watchedHours = 0;
      }
      if (now - sampledAt >= SAMPLE_SECONDS) sample(world, now);
      for (const e of events) if (!seen.has(e)) { seen.add(e); event(e, now); }
      if (data.designs.every(t => t !== null)) earn('all-designs', now);
      if (data.hats.every(Boolean)) earn('all-hats', now);
      watchDay(world.day.hour, now); save(now);
    },
    /** Write what the book holds now, not waiting out the five seconds: the page is closing or going out of sight. */
    flush() { save(previousTime ?? -Infinity, true); },
    get complete() { return COLLECTIBLES.length > 0 && COLLECTIBLES.every(({id}) => data.pages[id] !== null); },
    get pages() {
      const open = openShelf(id => data.pages[id] !== null);
      return COLLECTIBLES.filter(({shelf}) => shelf <= open).map(({id,kind,shelf}) => ({id,kind,shelf,found:data.pages[id] !== null,at:data.pages[id]?.at ?? null,date:data.pages[id]?.date ?? null}));
    },
    /** The ids left in the pool, in the order they were summoned, for the page to summon again on the next visit. */
    get inPool() { return data.pool.slice(); },
    found(id) { return Object.hasOwn(data.pages,id) && data.pages[id] !== null; },
    get designs() { return DESIGNS.map((d, index) => ({ index, label: d.label, seen: data.designs[index] !== null, first: data.designs[index] })); },
    get hats() { return HAT_ENTRIES.map((h, i) => ({ ...h, worn: data.hats[i] })); },
    get ducks() { return Array.from(met.values(), d => ({ ...d })).reverse(); },
    get stamps() { return STAMPS.map((s, i) => snapshot(s, data.stamps[i])); },
    get records() { return { ...data.records }; },
    startVisit() {
      data = rebased() ?? data;
      met.clear(); raceWinners.clear();
      sampledAt = savedAt = -Infinity; previousTime = previousHour = null; watchedHours = 0;
    },
  };
}
