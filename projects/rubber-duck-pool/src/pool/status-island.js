// A per-page status model. Time is supplied by the caller, independently of world time.
import { nameOf } from './ducks.js';

const STAMP_SECONDS = 3, WIN_SECONDS = 5, STAMP_LIMIT = 3;
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function raceItem(race) {
  const rows = race.results.map(r => ({ place: r.place, name: nameOf(r.id), time: r.time }))
    .sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity));
  const leader = rows.find(r => r.place === 1);
  return { key: 'race', kind: 'race', title: `Race ${clock(race.t)}`,
    detail: leader ? `${leader.name} leads` : `${race.ids.length} racing`, rows };
}
function boatItem(world) {
  if (world.boat.state !== 'moored') {
    const n = world.boat.aboard.length;
    return { key: 'boat', kind: 'boat', title: 'The boat is out',
      detail: n ? `${n} ${n === 1 ? 'duck' : 'ducks'} aboard` : 'on its way' };
  }
  let n = 0;
  for (const duck of world.ducks) if (duck.state === 'sea') n++;
  return n ? { key: 'sea', kind: 'sea', title: `${n} ${n === 1 ? 'duck' : 'ducks'} at sea`, action: 'sendBoat' } : null;
}
function winnerItem(race, key) {
  const winner = race.results.find(r => r.place === 1);
  return winner ? { key, kind: 'notice', title: `${nameOf(winner.id)} wins`, detail: clock(winner.time) }
    : { key, kind: 'notice', title: 'No one finished' };
}

export function createIsland() {
  let current = null, deadline = 0, serial = 0, lastRace = null, lastEnd = null, items = [];
  const queue = [];
  function addStamp(stamp) {
    const individual = queue.filter(n => n.type === 'stamp').length + (current?.type === 'stamp' ? 1 : 0);
    if (individual < STAMP_LIMIT && !queue.some(n => n.type === 'overflow')) {
      queue.push({ type: 'stamp', item: { key: `stamp:${stamp.id}:${++serial}`, kind: 'notice', title: 'Stamp earned', detail: stamp.title } });
    } else {
      let overflow = queue.find(n => n.type === 'overflow');
      if (!overflow) { overflow = { type: 'overflow', count: 0, item: { key: `stamps:${++serial}`, kind: 'notice', title: 'Stamp earned' } }; queue.push(overflow); }
      overflow.count++;
      overflow.item.detail = `+${overflow.count} more ${overflow.count === 1 ? 'stamp' : 'stamps'}`;
    }
  }
  function advance(now) {
    if (current && now >= deadline) current = null;
    if (!current && queue.length) { current = queue.shift(); deadline = now + (current.type === 'winner' ? WIN_SECONDS : STAMP_SECONDS); }
  }
  return {
    update(world, { fresh = [], now }) {
      const race = world.race;
      if (!race.running && race.endedAt != null && (race !== lastRace || race.endedAt !== lastEnd)) {
        lastRace = race; lastEnd = race.endedAt;
        queue.unshift({ type: 'winner', item: winnerItem(race, `winner:${++serial}`) });   // next, ahead of stamps: it answers the race just ended
      }
      for (const stamp of fresh) addStamp(stamp);
      advance(now);
      items = [];
      if (current) items.push(current.item);
      if (race.running && items.length < 2) items.push(raceItem(race));
      if (items.length < 2) { const boat = boatItem(world); if (boat) items.push(boat); }
    },
    get items() { return items.map(item => ({ ...item, ...(item.rows ? { rows: item.rows.map(row => ({ ...row })) } : {}) })); },
  };
}
