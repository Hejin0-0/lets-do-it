export const HOUR_STEP = 0.25;
export const HOUR_MAX = 24 - HOUR_STEP;

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

export function chooseHour(world, hour) {
  if (!Number.isFinite(hour)) return null;
  world.setHour(((hour % 24) + 24) % 24);
  return world.day.hour;
}

const GAZE_MIN_DIST = 0.01, GAZE_POLE_MARGIN = 1e-6;

/** Turn around a fixed world-space eye; cam's angles describe the direction from target to eye. */
export function gaze(cam, eye, at, k) {
  const d = eye.map((v, i) => v - at[i]), length = Math.hypot(...d), horizontal = Math.hypot(d[0], d[2]);
  const wantAz = horizontal ? Math.atan2(d[0], d[2]) : cam.az;
  const wantEl = length ? Math.atan2(d[1], horizontal) : cam.el;
  const limit = Math.PI / 2 - GAZE_POLE_MARGIN, elGoal = Math.max(-limit, Math.min(limit, wantEl));
  const turn = ((wantAz - cam.az + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const az = cam.az + k * turn, el = cam.el + k * (elGoal - cam.el);
  const dist = k === 0 ? cam.dist : Math.max(GAZE_MIN_DIST, cam.dist + k * (Math.max(GAZE_MIN_DIST, length) - cam.dist));
  const ce = Math.cos(el), dir = [ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)];
  return { az, el, dist, target: eye.map((v, i) => v - dist * dir[i]) };
}
