export const HOURS = Object.freeze([
  Object.freeze({ id: 'dawn', label: 'Dawn', hour: 6 }),
  Object.freeze({ id: 'noon', label: 'Noon', hour: 12 }),
  Object.freeze({ id: 'dusk', label: 'Dusk', hour: 18 }),
  Object.freeze({ id: 'night', label: 'Night', hour: 23 }),
]);

export function clockText(hour) {
  const remainder = hour % 24, wrapped = remainder < 0 ? remainder + 24 : remainder;
  const minutes = Math.min(1439, Math.floor(wrapped * 60));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function duckOptions(ducks) {
  const names = new Set(ducks.map(d => d.name)), used = new Set();
  return ducks.map(d => {
    let label = d.name, n = 2;
    if (used.has(label)) {
      do { label = `${d.name} (${n++})`; } while (used.has(label) || names.has(label));
    }
    used.add(label);
    return { id: d.id, label };
  });
}

export function createDuckChoice() {
  let watched = null, notice = null;
  return {
    view(ducks, selected) {
      const live = ducks.includes(selected) ? selected : null;
      if (live) notice = null;
      else if (watched && !ducks.includes(watched)) notice = 'The duck you were watching has left.';
      watched = live;
      return { options: duckOptions(ducks), value: live ? live.id : null, notice };
    },
    forget() { watched = null; notice = null; },
  };
}

export function chooseDuck(world, id) {
  if (id === null) { world.selected = null; return true; }
  const duck = world.ducks.find(d => d.id === id);
  if (!duck) return false;
  world.selected = duck;
  return true;
}

export function chooseHour(world, hourId) {
  const preset = HOURS.find(p => p.id === hourId);
  if (!preset) return null;
  world.setHour(preset.hour);
  return world.day.hour;
}
