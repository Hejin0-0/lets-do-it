import { DESIGNS, HATS } from '../pool/ducks.js';

const DESIGN_INDEX = new Map(DESIGNS.map((d, idx) => [d.id, idx]));
const HAT_INDEX = new Map(HATS.map((h, idx) => [h.id, idx]));

export function createLogbookSync({ logbook }) {
  const perDuck = new Map();
  const worldProxy = {
    time: 0,
    day: { hour: 18 },
    ducks: [],
  };
  const pendingEvents = [];
  let accum = 0;
  let maxObservedTime = 0;

  function ensureStats(id) {
    let st = perDuck.get(id);
    if (!st) {
      st = {
        slides: 0,
        laps: 0,
        bestLap: null,
        lastSlideTime: null,
        seenLaps: 0,
      };
      perDuck.set(id, st);
    }
    return st;
  }

  function ingestEvents(physEvents, now) {
    if (!physEvents?.length) return;
    for (let i = 0; i < physEvents.length; i++) {
      const ev = physEvents[i];
      if (ev.type === 'slide') {
        const st = ensureStats(ev.id);
        const evTime = Number.isFinite(ev.time) ? ev.time : now;
        if (st.lastSlideTime !== null && evTime > st.lastSlideTime + 5.0) {
          const lapDur = evTime - st.lastSlideTime;
          st.bestLap = st.bestLap === null ? lapDur : Math.min(st.bestLap, lapDur);
          pendingEvents.push({ type: 'lap', time: lapDur });
        }
        st.lastSlideTime = evTime;
        st.slides += 1;
      }
    }
  }

  function syncNow(now, simHour, duckEntries) {
    if (!logbook) return;
    maxObservedTime = Math.max(maxObservedTime, Number.isFinite(now) ? now : 0);
    worldProxy.time = maxObservedTime;
    worldProxy.day.hour = Number.isFinite(simHour) ? ((simHour % 24) + 24) % 24 : 18;
    worldProxy.ducks.length = 0;

    for (let i = 0; i < duckEntries.length; i++) {
      const d = duckEntries[i];
      if (d.obj && d.obj.visible === false) continue;
      const colour = DESIGN_INDEX.get(d.designId);
      const hat = HAT_INDEX.get(d.hatId || 'none') ?? 0;
      const st = ensureStats(d.id);
      const physLaps = d.physPose?.lapCount || 0;
      if (physLaps > st.seenLaps) {
        st.laps = physLaps;
        if (st.bestLap === null && maxObservedTime > 5.0) {
          const approx = maxObservedTime / physLaps;
          st.bestLap = approx;
          pendingEvents.push({ type: 'lap', time: approx });
        }
        st.seenLaps = physLaps;
      }
      worldProxy.ducks.push({
        id: d.id,
        name: d.name || d.id,
        colour: colour ?? -1,
        hat,
        laps: st.laps,
        stats: {
          slides: st.slides,
          laps: st.laps,
          bestLap: st.bestLap,
          flights: 0,
          seaTrips: 0,
          rescued: 0,
        },
      });
    }

    const batch = pendingEvents.length ? pendingEvents.splice(0, pendingEvents.length) : [];
    logbook.observe(worldProxy, batch);
  }

  function step(dt, { simTime = 0, simHour = 18, duckEntries = [], physEvents = null } = {}) {
    ingestEvents(physEvents, simTime);
    accum += dt;
    if (accum < 0.5) return false;
    accum = 0;
    syncNow(simTime, simHour, duckEntries);
    return true;
  }

  function recordCollected(itemIds, simTime = 0, simHour = 18) {
    if (!logbook || !itemIds?.length) return;
    maxObservedTime = Math.max(maxObservedTime + 0.01, Number.isFinite(simTime) ? simTime : 0);
    worldProxy.time = maxObservedTime;
    worldProxy.day.hour = Number.isFinite(simHour) ? ((simHour % 24) + 24) % 24 : 18;
    logbook.observe(worldProxy, [{ type: 'collected', ids: itemIds }]);
    logbook.flush?.();
  }

  function flush(simTime = maxObservedTime, simHour = worldProxy.day.hour, duckEntries = null) {
    if (Array.isArray(duckEntries)) {
      syncNow(simTime, simHour, duckEntries);
    }
    logbook?.flush?.();
  }

  return {
    step,
    syncNow,
    recordCollected,
    flush,
    getMaxObservedTime: () => maxObservedTime,
  };
}
