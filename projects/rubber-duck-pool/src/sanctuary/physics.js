// Hydro Sanctuary duck physics: free 2D rigid-body floating on the two open basins (Upper Pool, Lower Grotto) and
// the closed hydro loop's rails (slide, intake channel, siphon lift, return tube) from circulation.js in between.
// Seeded and stepped by the caller (seed, dt, time), so the same run replays exactly.
//
// Open water is simulated in Blender plan coordinates (bx, by); poses go out in Three.js (x = bx, y = bz, z = -by).
import { sampleSanctuaryCircuit, CIRCUIT_STAGES, CIRCUIT_LAP_SECONDS } from './circulation.js';

const TAU = Math.PI * 2;
const G = 9.81;
const R = 0.22;
const MAX_SUBSTEP = 1 / 60 + 1e-9;
const MAX_SUBSTEPS = 8;
const BLEND_TAU = 0.35;
const COUNTED_IMPULSE = 0.02;
// Overlap removed per substep: two ducks dropped onto one spot (a launch onto a duck at the tube mouth) slide apart
// over a few frames instead of jumping 0.2 m in one.
const SEPARATION_RATE = 0.35;
const RECENT_COLLISIONS = 16;

// circulation.js keeps these private: UPPER_Z and GROTTO_Z, the still-water heights its rails start and end on.
const UPPER_WATER_Y = -0.145;
const GROTTO_WATER_Y = -2.22;

const stageU = (name) => CIRCUIT_STAGES.find((s) => s.name === name);
const SLIDE_U0 = stageU('slide').u0;
const SLIDE_U1 = stageU('slide').u1;
const LIFT_U0 = stageU('intake_channel').u0;
const SLIDE_GAP_U = 0.006;
const SLIDE_CROWD_U = 0.003;

const UPPER_BOX = { x0: -5.8, x1: 9.8, y0: -2.9, y1: 6.2 };
const GROTTO = { cx: 0.20, cy: -13.20, r: 3.55 };
const WEIR = { bx: -0.82, by: -2.55, r: 0.95 };
const INTAKE = { bx: 2.95, by: -13.20, halfWidth: 1.15 };

const UPPER_FLOATS = [
  { bx: 3.6, by: 2.2, r: 1.30 },   // flamingo
  { bx: 9.2, by: 4.1, r: 1.15 },   // palm island
  { bx: -1.8, by: 4.4, r: 0.75 },  // swim ring
  { bx: 1.6, by: -1.6, r: 0.75 },  // swim ring
  { bx: 7.6, by: -1.5, r: 0.55 },  // beach ball
];
const GROTTO_FLOATS = [{ bx: 0.2, by: -13.2, r: 1.45 }];

// The current lane the circuit's upper_pool rail follows, from the return-tube mouth to the slide weir lip.
const UPPER_LANE = [[7.40, 1.55], [7.05, 2.55], [5.65, 4.85], [1.30, 4.85], [-0.15, 2.25], [-0.32, -0.45], [-0.78, -2.45]];

const MODES = {
  circuit: { laneSpeed: 0.62, lanePull: 0.55, weirPull: 0.0, wander: 0.10 },
  roam: { laneSpeed: 0.22, lanePull: 0.08, weirPull: 0.30, wander: 0.22 },
};

const DRAG = 1.4;
const MAGNET_RANGE = 1.8;
const MAGNET_PULL = 0.6;
const CROWN_RANGE = 1.4;
const CROWN_PULL = 0.12;

const t = (mass, speedScale, buoyancy, trait) => ({ mass, speedScale, buoyancy, trait });
/** Per design: mass (kg-ish, against collisions and currents), speedScale (how hard it rides currents and slides),
 * buoyancy (bob amplitude) and the emergent trait it brings to the water. */
export const DUCK_TRAITS = {
  '01-classic': t(1.0, 1.0, 1.0, 'standard'),
  '02-mint': t(0.95, 1.0, 1.05, 'standard'),
  '03-cherry': t(0.9, 1.05, 1.1, 'bouncy'),
  '04-daisy': t(0.95, 1.0, 1.05, 'standard'),
  '05-lightning': t(0.9, 1.22, 0.95, 'fast'),
  '06-cow': t(1.35, 0.92, 0.85, 'standard'),
  '07-heart': t(0.95, 1.0, 1.05, 'standard'),
  '08-stars': t(1.0, 1.0, 1.0, 'nocturnal'),
  '09-tiger': t(1.1, 1.22, 0.95, 'fast'),
  '10-lavender': t(0.95, 1.0, 1.05, 'standard'),
  '11-crown': t(1.15, 0.95, 0.95, 'crown'),
  '12-prism': t(1.0, 1.0, 1.0, 'standard'),
  '13-teapot': t(1.3, 0.9, 0.85, 'hearth'),
  '14-terrarium': t(1.25, 0.9, 0.9, 'standard'),
  '15-citrus': t(0.9, 1.05, 1.15, 'bouncy'),
  '16-cloud': t(0.8, 1.22, 1.2, 'fast'),
  '17-bookbinder': t(1.1, 0.95, 0.95, 'standard'),
  '18-ramen': t(1.2, 0.95, 0.9, 'hearth'),
  '19-moon': t(0.85, 1.0, 1.15, 'nocturnal'),
  '20-radio': t(1.2, 0.95, 0.9, 'standard'),
  '21-magnet': t(1.25, 0.95, 0.9, 'magnet'),
  '22-snow-globe': t(1.3, 0.9, 0.85, 'nocturnal'),
  '23-mosaic': t(1.1, 1.0, 0.95, 'standard'),
  '24-lantern': t(1.0, 1.0, 1.0, 'nocturnal'),
  golden_smore: t(1.05, 1.0, 1.0, 'hearth'),
  charred_ember: t(1.15, 0.95, 0.95, 'hearth'),
  custom: t(1.0, 1.0, 1.0, 'standard'),
};
const RESTITUTION = { bouncy: 0.95 };
const BASE_RESTITUTION = 0.8;
const WALL_RESTITUTION = 0.45;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const wrapAngle = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const wrapU = (u) => ((u % 1) + 1) % 1;
const stageOfU = (u) => (CIRCUIT_STAGES.find((s) => u >= s.u0 && u < s.u1) || CIRCUIT_STAGES[CIRCUIT_STAGES.length - 1]).name;
const isFreeStage = (name) => name === 'upper_pool' || name === 'grotto';

/** Nearest point on the upper current lane to (px, py), with the lane's direction there. */
function nearestOnLane(px, py, out) {
  let best = Infinity;
  for (let i = 0; i < UPPER_LANE.length - 1; i++) {
    const [ax, ay] = UPPER_LANE[i];
    const [bx, by] = UPPER_LANE[i + 1];
    const sx = bx - ax, sy = by - ay;
    const len2 = sx * sx + sy * sy;
    const k = Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy) / len2));
    const qx = ax + sx * k, qy = ay + sy * k;
    const d2 = (px - qx) ** 2 + (py - qy) ** 2;
    if (d2 < best) {
      best = d2;
      const len = Math.sqrt(len2);
      out.qx = qx; out.qy = qy; out.tx = sx / len; out.ty = sy / len;
    }
  }
  return out;
}

/**
 * Create the sanctuary's duck simulation.
 * mode 'circuit': ducks follow the current lane to the slide weir; 'roam': they wander the Upper Pool and only drift
 * toward the weir. Either way every duck that reaches the weir rides the whole loop back.
 */
export function createSanctuaryPhysics({ seed = 4201, mode = 'circuit' } = {}) {
  if (!MODES[mode]) throw new Error(`Unknown mode '${mode}'. Use 'circuit' or 'roam'.`);
  const rng = mulberry32(seed);
  const tune = MODES[mode];
  const agents = [];
  const outs = [];
  const events = [];
  const lane = { qx: 0, qy: 0, tx: 0, ty: 0 };
  const stats = { collisionCount: 0, overtakeCount: 0, slideEntries: 0, splashCount: 0, lapsCompleted: 0, recentCollisions: [] };

  function placeFree(a, stage, bx, by, vbx, vby) {
    a.stage = stage; a.bx = bx; a.by = by; a.vbx = vbx; a.vby = vby; a.tStage = 0;
  }

  function placeRail(a, u) {
    a.stage = 'rail'; a.u = u; a.tStage = 0;
  }

  function addDuck({ id, designId = '01-classic', name = '', hex = '#ffd84a', hat = 0, initialStage, u, x, z } = {}) {
    if (id === undefined || id === null) throw new Error('addDuck needs an id.');
    if (agents.some((a) => a.id === id)) throw new Error(`Duck '${id}' is already in the water. removeDuck it first.`);
    const traits = DUCK_TRAITS[designId] || DUCK_TRAITS.custom;
    const a = {
      id, designId, name, hex, hat, ...traits,
      restitution: RESTITUTION[traits.trait] ?? BASE_RESTITUTION,
      stage: 'upper_pool', u: 0, bx: 0, by: 0, vbx: 0, vby: 0, tStage: 0,
      heading: 0, hopY: 0, hopV: 0, squish: 0, rollKick: 0, crownBy: null, held: false,
      wander: rng() * TAU, phase: rng() * TAU, lapCount: 0,
      blendPending: false, hasOut: false, off: [0, 0, 0, 0, 0, 0], lastX: 0, lastY: 0, lastZ: 0,
      out: {
        id, designId, name, hex, hat, x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, scale: 1,
        stage: 'upper_pool', hopY: 0, squish: 0, trait: traits.trait, emitSteam: traits.trait === 'hearth', glowStrength: 0, lapCount: 0,
      },
    };
    const freeStage = initialStage === 'upper_pool' || initialStage === 'grotto' || initialStage === undefined;
    if (freeStage && Number.isFinite(x) && Number.isFinite(z)) {
      const inGrotto = initialStage === 'grotto' || (initialStage === undefined && Math.hypot(x - GROTTO.cx, -z - GROTTO.cy) < GROTTO.r);
      placeFree(a, inGrotto ? 'grotto' : 'upper_pool', x, -z, 0, 0);
    } else {
      const range = initialStage ? stageU(initialStage) : stageU('upper_pool');
      if (!range) throw new Error(`Unknown stage '${initialStage}'. Use one of ${CIRCUIT_STAGES.map((s) => s.name).join(', ')}.`);
      const uu = Number.isFinite(u) ? wrapU(u) : range.u0 + rng() * (range.u1 - range.u0);
      const stage = stageOfU(uu);
      if (isFreeStage(stage)) {
        const p = sampleSanctuaryCircuit(uu, 0, 0);
        placeFree(a, stage, p.x, -p.z, 0, 0);
        a.heading = p.yaw;
      } else {
        placeRail(a, uu);
      }
    }
    agents.push(a);
    outs.push(a.out);
    writePose(a, 0, 0, 0);
    return a.out;
  }

  function removeDuck(id) {
    const i = agents.findIndex((a) => a.id === id);
    if (i < 0) return false;
    agents.splice(i, 1);
    outs.splice(i, 1);
    return true;
  }

  function applyImpulse(id, vx, vz, hop = 0.25) {
    const a = agents.find((d) => d.id === id);
    if (!a || a.stage === 'rail') return false;
    a.vbx += vx / a.mass;
    a.vby -= vz / a.mass;
    if (hop > 0 && a.hopY <= 1e-3) a.hopV = Math.max(a.hopV, Math.sqrt(2 * G * hop));
    a.squish = Math.max(a.squish, 0.18);
    return true;
  }

  function radialWave(bx, by, radius, strength) {
    let n = 0;
    for (const a of agents) {
      if (a.stage === 'rail') continue;
      const dx = a.bx - bx, dy = a.by - by;
      const d = Math.hypot(dx, dy);
      if (d >= radius) continue;
      const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
      const f = strength * (1 - d / radius);
      a.vbx += (nx * f) / a.mass;
      a.vby += (ny * f) / a.mass;
      if (a.hopY <= 1e-3) a.hopV = Math.max(a.hopV, f * 0.6);
      n++;
    }
    return n;
  }

  const applyRadialWave = (x, z, radius, strength) => radialWave(x, -z, radius, strength);

  function grabDuck(id) {
    const a = agents.find((d) => d.id === id);
    if (!a || a.stage === 'rail') return false;
    a.held = true;
    a.vbx = 0;
    a.vby = 0;
    a.hopY = 0.34;
    a.hopV = 0;
    a.squish = 0.16;
    return true;
  }

  function moveGrabbedDuck(id, x, z) {
    const a = agents.find((d) => d.id === id);
    if (!a || !a.held) return false;
    const bx = Number.isFinite(x) ? x : a.bx;
    const by = Number.isFinite(z) ? -z : a.by;
    const dx = bx - a.bx;
    const dz = (-by) - (-a.by);
    if (Math.hypot(dx, dz) > 0.01) {
      a.heading = Math.atan2(dx, dz);
    }
    a.bx = bx;
    a.by = by;
    if (a.stage === 'upper_pool') {
      const nearWeir = Math.hypot(a.bx - WEIR.bx, a.by - (-3.0)) < 1.35;
      if (!nearWeir) constrain(a);
    } else {
      constrain(a);
    }
    a.vbx = 0;
    a.vby = 0;
    a.hopY = 0.34;
    return true;
  }

  function releaseGrabbedDuck(id, vx = 0, vz = 0) {
    const a = agents.find((d) => d.id === id);
    if (!a || !a.held) return { ok: false, launchedSlide: false, x: 0, z: 0 };
    a.held = false;
    if (a.stage === 'upper_pool' && Math.hypot(a.bx - WEIR.bx, a.by - (-3.0)) < 1.35) {
      placeRail(a, SLIDE_U0 + 1e-6);
      a.hopY = 0;
      a.hopV = 0;
      a.squish = 0.22;
      a.blendPending = true;
      stats.slideEntries++;
      return { ok: true, launchedSlide: true, x: a.bx, z: -a.by };
    }
    constrain(a);
    const spd = Math.hypot(vx, vz);
    const cap = spd > 4.5 ? 4.5 / spd : 1.0;
    a.vbx = (Number.isFinite(vx) ? vx : 0) * cap;
    a.vby = -(Number.isFinite(vz) ? vz : 0) * cap;
    if (spd > 0.12) a.heading = Math.atan2(a.vbx, -a.vby);
    a.hopV = -0.35;
    a.squish = 0.24;
    radialWave(a.bx, a.by, 1.35, 0.65);
    return { ok: true, launchedSlide: false, x: a.bx, z: -a.by };
  }

  function cancelGrab(id) {
    const a = agents.find((d) => d.id === id);
    if (!a || !a.held) return false;
    a.held = false;
    constrain(a);
    a.vbx = 0;
    a.vby = 0;
    a.hopY = 0.04;
    a.hopV = 0;
    return true;
  }

  function steerAround(a, floats, cx, cy, acc) {
    for (const o of floats) {
      const dx = a.bx - o.bx, dy = a.by - o.by;
      const d = Math.hypot(dx, dy) || 1e-6;
      const rr = o.r + R;
      if (d > rr + 0.9) continue;
      const nx = dx / d, ny = dy / d;
      const s = Math.min(1.5, 1 - (d - rr) / 0.9);
      let tx = -ny, ty = nx;
      if (tx * cx + ty * cy < 0) { tx = -tx; ty = -ty; }
      acc.x += nx * 1.6 * s * s + tx * 0.8 * s;
      acc.y += ny * 1.6 * s * s + ty * 0.8 * s;
    }
  }

  const acc = { x: 0, y: 0 };

  function waterForces(a, h) {
    acc.x = 0; acc.y = 0;
    let cx, cy;
    if (a.stage === 'upper_pool') {
      nearestOnLane(a.bx, a.by, lane);
      let px = (lane.qx - a.bx) * tune.lanePull, py = (lane.qy - a.by) * tune.lanePull;
      const pl = Math.hypot(px, py);
      if (pl > 0.5) { px *= 0.5 / pl; py *= 0.5 / pl; }
      cx = (lane.tx * tune.laneSpeed + px) * a.speedScale;
      cy = (lane.ty * tune.laneSpeed + py) * a.speedScale;
      if (tune.weirPull > 0) {
        const wx = WEIR.bx - a.bx, wy = WEIR.by - a.by;
        const wd = Math.hypot(wx, wy) || 1e-6;
        const k = tune.weirPull * Math.max(0.15, 1 - wd / 6);
        cx += (wx / wd) * k; cy += (wy / wd) * k;
      }
      const wallZone = 0.5;
      const lx = a.bx - (UPPER_BOX.x0 + R), hx = UPPER_BOX.x1 - R - a.bx;
      const ly = a.by - (UPPER_BOX.y0 + R), hy = UPPER_BOX.y1 - R - a.by;
      if (lx < wallZone) acc.x += 1.2 * (1 - lx / wallZone);
      if (hx < wallZone) acc.x -= 1.2 * (1 - hx / wallZone);
      if (ly < wallZone) acc.y += 1.2 * (1 - ly / wallZone);
      if (hy < wallZone) acc.y -= 1.2 * (1 - hy / wallZone);
      steerAround(a, UPPER_FLOATS, cx, cy, acc);
    } else {
      // The grotto's whirlpool turns clockwise (the circuit's grotto rail runs to decreasing angle) and slowly
      // widens each duck's orbit until it reaches the East Intake.
      const rx = a.bx - GROTTO.cx, ry = a.by - GROTTO.cy;
      const r = Math.hypot(rx, ry) || 1e-6;
      const targetR = 2.0 + 1.4 * Math.min(1, a.tStage / 14);
      const swirl = 1.25 * a.speedScale;
      const radial = (targetR - r) * 1.5;
      cx = (ry / r) * swirl + (rx / r) * radial;
      cy = (-rx / r) * swirl + (ry / r) * radial;
      steerAround(a, GROTTO_FLOATS, cx, cy, acc);
    }
    a.wander += (rng() - 0.5) * 3 * h;
    acc.x += Math.cos(a.wander) * tune.wander + ((cx - a.vbx) * DRAG) / a.mass;
    acc.y += Math.sin(a.wander) * tune.wander + ((cy - a.vby) * DRAG) / a.mass;
  }

  function traitForces(h) {
    for (const a of agents) a.crownBy = null;
    for (const m of agents) {
      if (m.stage === 'rail' || (m.trait !== 'magnet' && m.trait !== 'crown')) continue;
      const range = m.trait === 'magnet' ? MAGNET_RANGE : CROWN_RANGE;
      const pull = m.trait === 'magnet' ? MAGNET_PULL : CROWN_PULL;
      for (const a of agents) {
        if (a === m || a.stage !== m.stage || a.held) continue;
        const dx = m.bx - a.bx, dy = m.by - a.by;
        const d = Math.hypot(dx, dy);
        if (d >= range || d < 1e-6) continue;
        const f = pull * (1 - d / range) * h;
        a.vbx += (dx / d) * f;
        a.vby += (dy / d) * f;
        if (m.trait === 'crown') a.crownBy = m;
      }
    }
  }

  function collide(h, t) {
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.stage === 'rail' || a.held) continue;
      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j];
        if (b.stage === 'rail' || b.held) continue;
        let dx = b.bx - a.bx, dy = b.by - a.by;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-9) { dx /= d; dy /= d; } else { dx = 1; dy = 0; }
        const overlap = (2 * R - d) * SEPARATION_RATE;
        const msum = a.mass + b.mass;
        a.bx -= dx * overlap * (b.mass / msum); a.by -= dy * overlap * (b.mass / msum);
        b.bx += dx * overlap * (a.mass / msum); b.by += dy * overlap * (a.mass / msum);
        const vn = (b.vbx - a.vbx) * dx + (b.vby - a.vby) * dy;
        if (vn >= 0) continue;
        const e = (a.restitution + b.restitution) * 0.5;
        const J = (-(1 + e) * vn) / (1 / a.mass + 1 / b.mass);
        a.vbx -= (J * dx) / a.mass; a.vby -= (J * dy) / a.mass;
        b.vbx += (J * dx) / b.mass; b.vby += (J * dy) / b.mass;
        if (J < COUNTED_IMPULSE) continue;
        for (const q of [a, b]) {
          q.squish = Math.max(q.squish, Math.min(0.3, J * 0.4));
          if (q.trait === 'bouncy' && q.hopY <= 1e-3) q.hopV = Math.max(q.hopV, Math.min(2.2, J * 3));
        }
        stats.collisionCount++;
        const ev = { type: 'collision', a: a.id, b: b.id, impulse: J, x: (a.bx + b.bx) * 0.5, z: -(a.by + b.by) * 0.5, time: t };
        events.push(ev);
        stats.recentCollisions.push(ev);
        if (stats.recentCollisions.length > RECENT_COLLISIONS) stats.recentCollisions.shift();
      }
    }
  }

  function pushOut(a, floats) {
    for (const o of floats) {
      const dx = a.bx - o.bx, dy = a.by - o.by;
      const d = Math.hypot(dx, dy);
      const rr = o.r + R;
      if (d >= rr) continue;
      const nx = d > 1e-9 ? dx / d : 1, ny = d > 1e-9 ? dy / d : 0;
      a.bx = o.bx + nx * rr; a.by = o.by + ny * rr;
      const vn = a.vbx * nx + a.vby * ny;
      if (vn < 0) { a.vbx -= (1 + WALL_RESTITUTION) * vn * nx; a.vby -= (1 + WALL_RESTITUTION) * vn * ny; }
    }
  }

  function constrain(a) {
    if (a.stage === 'upper_pool') {
      pushOut(a, UPPER_FLOATS);
      if (a.bx < UPPER_BOX.x0 + R) { a.bx = UPPER_BOX.x0 + R; if (a.vbx < 0) a.vbx *= -WALL_RESTITUTION; }
      if (a.bx > UPPER_BOX.x1 - R) { a.bx = UPPER_BOX.x1 - R; if (a.vbx > 0) a.vbx *= -WALL_RESTITUTION; }
      if (a.by < UPPER_BOX.y0 + R) { a.by = UPPER_BOX.y0 + R; if (a.vby < 0) a.vby *= -WALL_RESTITUTION; }
      if (a.by > UPPER_BOX.y1 - R) { a.by = UPPER_BOX.y1 - R; if (a.vby > 0) a.vby *= -WALL_RESTITUTION; }
    } else {
      pushOut(a, GROTTO_FLOATS);
      const rx = a.bx - GROTTO.cx, ry = a.by - GROTTO.cy;
      const r = Math.hypot(rx, ry);
      const lim = GROTTO.r - R;
      if (r > lim) {
        const nx = rx / r, ny = ry / r;
        a.bx = GROTTO.cx + nx * lim; a.by = GROTTO.cy + ny * lim;
        const vn = a.vbx * nx + a.vby * ny;
        if (vn > 0) { a.vbx -= (1 + WALL_RESTITUTION) * vn * nx; a.vby -= (1 + WALL_RESTITUTION) * vn * ny; }
      }
    }
  }

  function slideGateOpen() {
    for (const b of agents) if (b.stage === 'rail' && b.u >= SLIDE_U0 && b.u < SLIDE_U0 + SLIDE_GAP_U) return false;
    return true;
  }

  function railVelocity(u, speedScale) {
    const du = 0.003;
    const p = sampleSanctuaryCircuit(u, 0, 0);
    const q = sampleSanctuaryCircuit(u - du, 0, 0);
    const dt = (du * CIRCUIT_LAP_SECONDS) / speedScale;
    return { x: p.x, y: p.y, z: p.z, vx: (p.x - q.x) / dt, vy: (p.y - q.y) / dt, vz: (p.z - q.z) / dt };
  }

  function transitions(t) {
    for (const a of agents) {
      if (a.held) continue;
      if (a.stage === 'upper_pool' && Math.hypot(a.bx - WEIR.bx, a.by - WEIR.by) < WEIR.r && slideGateOpen()) {
        placeRail(a, SLIDE_U0 + 1e-6);
        a.blendPending = true;
        stats.slideEntries++;
        events.push({ type: 'slide', id: a.id, x: a.bx, z: -a.by, time: t });
      } else if (a.stage === 'grotto' && a.bx > INTAKE.bx && Math.abs(a.by - INTAKE.by) < INTAKE.halfWidth) {
        placeRail(a, LIFT_U0);
        a.blendPending = true;
      }
    }
  }

  function advanceRails(h, t) {
    for (const a of agents) {
      if (a.stage !== 'rail') continue;
      const before = a.u;
      a.u += (h * a.speedScale) / CIRCUIT_LAP_SECONDS;
      if (before < SLIDE_U1 && a.u >= SLIDE_U1) {
        const v = railVelocity(SLIDE_U1 - 1e-6, a.speedScale);
        placeFree(a, 'grotto', v.x, -v.z, v.vx, -v.vz);
        a.heading = Math.atan2(v.vx, v.vz);
        a.squish = 0.3;
        a.blendPending = true;
        stats.splashCount++;
        radialWave(a.bx, a.by, 1.0, 0.6);
        events.push({ type: 'splash', id: a.id, x: v.x, z: v.z, strength: Math.hypot(v.vx, v.vz), time: t });
      } else if (a.u >= 1) {
        const v = railVelocity(1 - 1e-6, a.speedScale);
        placeFree(a, 'upper_pool', v.x, -v.z, v.vx, -v.vz);
        a.heading = Math.atan2(v.vx, v.vz);
        a.hopY = Math.max(0, v.y - UPPER_WATER_Y);
        a.hopV = v.vy;
        a.blendPending = true;
        a.lapCount++;
        stats.lapsCompleted++;
        stats.splashCount++;
        radialWave(a.bx, a.by, 1.3, 0.9);
        events.push({ type: 'launch', id: a.id, x: v.x, z: v.z, strength: Math.hypot(v.vx, v.vz), time: t });
      }
    }
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.stage !== 'rail' || a.u < SLIDE_U0 || a.u >= SLIDE_U1) continue;
      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j];
        if (b.stage !== 'rail' || b.u < SLIDE_U0 || b.u >= SLIDE_U1) continue;
        const gap = a.u - b.u;
        if (Math.abs(gap) >= SLIDE_CROWD_U) continue;
        const prevGap = gap - (h * (a.speedScale - b.speedScale)) / CIRCUIT_LAP_SECONDS;
        a.rollKick = gap > 0 ? -0.22 : 0.22;
        b.rollKick = -a.rollKick;
        a.squish = Math.max(a.squish, 0.1);
        b.squish = Math.max(b.squish, 0.1);
        if (Math.sign(prevGap) !== Math.sign(gap) && prevGap !== 0) {
          stats.overtakeCount++;
          const [passer, passed] = gap > 0 ? [a, b] : [b, a];
          events.push({ type: 'overtake', id: passer.id, passed: passed.id, time: t });
        }
      }
    }
  }

  function substep(h, t) {
    traitForces(h);
    for (const a of agents) {
      if (a.stage === 'rail' || a.held) continue;
      waterForces(a, h);
      a.vbx += acc.x * h;
      a.vby += acc.y * h;
      a.bx += a.vbx * h;
      a.by += a.vby * h;
      a.tStage += h;
    }
    collide(h, t);
    for (const a of agents) if (a.stage !== 'rail' && !a.held) constrain(a);
    transitions(t);
    advanceRails(h, t);
    for (const a of agents) {
      if (!a.held && (a.hopY > 0 || a.hopV > 0)) {
        a.hopV -= G * h;
        a.hopY += a.hopV * h;
        if (a.hopY <= 0) {
          if (a.hopV < -0.4) a.squish = Math.max(a.squish, Math.min(0.35, -a.hopV * 0.1));
          a.hopY = 0;
          a.hopV = 0;
        }
      }
      a.squish *= Math.exp(-h * 7);
      a.rollKick *= Math.exp(-h * 3);
    }
  }

  function writePose(a, dt, time, night) {
    const o = a.out;
    let x, y, z, yaw, pitch, roll, stage;
    if (a.stage === 'rail') {
      const p = sampleSanctuaryCircuit(a.u, time, a.phase);
      x = p.x; y = p.y; z = p.z; yaw = p.yaw; pitch = p.pitch; roll = p.roll + a.rollKick;
      stage = stageOfU(wrapU(a.u));
      a.heading = yaw;
    } else {
      const waterY = a.stage === 'upper_pool' ? UPPER_WATER_Y : GROTTO_WATER_Y;
      const vx = a.vbx, vz = -a.vby;
      let target = Math.hypot(vx, vz) > 0.05 ? Math.atan2(vx, vz) : a.heading;
      let crownBob = 0;
      if (a.crownBy) {
        target = Math.atan2(a.crownBy.bx - a.bx, -(a.crownBy.by - a.by));
        crownBob = 0.02 * Math.sin(time * 5 + a.phase);
      }
      const turn = wrapAngle(target - a.heading);
      const maxTurn = 4 * dt;
      a.heading = wrapAngle(a.heading + Math.max(-maxTurn, Math.min(maxTurn, turn)));
      x = a.bx; z = -a.by;
      y = waterY + Math.sin(time * 2.2 + x * 0.6 + z * 0.5 + a.phase) * 0.026 * a.buoyancy + a.hopY + crownBob;
      yaw = a.heading;
      pitch = Math.cos(time * 2.1 + a.phase) * 0.045 - a.squish * 0.3;
      roll = Math.sin(time * 1.8 + a.phase) * 0.055 + a.rollKick;
      stage = a.stage;
    }
    const off = a.off;
    if (a.blendPending && a.hasOut) {
      off[0] = o.x - x; off[1] = o.y - y; off[2] = o.z - z;
      off[3] = wrapAngle(o.yaw - yaw); off[4] = o.pitch - pitch; off[5] = o.roll - roll;
    }
    a.blendPending = false;
    const k = Math.exp(-dt / BLEND_TAU);
    for (let i = 0; i < 6; i++) off[i] *= k;
    x += off[0]; y += off[1]; z += off[2]; yaw += off[3]; pitch += off[4]; roll += off[5];

    if (a.stage === 'rail') {
      o.vx = a.hasOut && dt > 0 ? (x - o.x) / dt : 0;
      o.vz = a.hasOut && dt > 0 ? (z - o.z) / dt : 0;
    } else {
      o.vx = a.vbx;
      o.vz = -a.vby;
    }
    o.x = x; o.y = y; o.z = z; o.yaw = yaw; o.pitch = pitch; o.roll = roll;
    o.stage = stage;
    o.hopY = a.hopY;
    o.squish = a.squish;
    o.glowStrength = a.trait === 'nocturnal' ? night : 0;
    o.lapCount = a.lapCount;
    a.hasOut = true;
  }

  /**
   * Advance by dt seconds to `time` (the clock the bob and sway read). Returns this step's events, reused next step:
   * { type: 'collision', a, b, impulse, x, z } | { type: 'splash' | 'launch', id, x, z, strength } |
   * { type: 'slide', id, x, z } | { type: 'overtake', id, passed }.
   */
  function step(dt, time, { night = 0 } = {}) {
    events.length = 0;
    if (!(dt > 0)) return events;
    const n = Math.min(MAX_SUBSTEPS, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / n;
    for (let i = 1; i <= n; i++) substep(h, time - dt + h * i);
    for (const a of agents) writePose(a, dt, time, night);
    return events;
  }

  return {
    addDuck,
    removeDuck,
    applyImpulse,
    applyRadialWave,
    grabDuck,
    moveGrabbedDuck,
    releaseGrabbedDuck,
    cancelGrab,
    step,
    /** The ducks' poses, live: step() updates these objects in place. */
    getDucks: () => outs,
    getStats: () => ({ ...stats, ducks: agents.length, recentCollisions: stats.recentCollisions.slice() }),
  };
}
