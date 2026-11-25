// Deterministic continuous 6-stage closed-loop hydro-circulation path for Hydro Sanctuary v4.
// Replaces disconnected scale-fade mini-loops so every duck on the slide physically swims in from
// the Upper Pool, splashes into the Lower Grotto, rides the Intake Channel, rises up the Siphon
// Tower, glides through the Overhead Glass Return Tube, and lands back in the Upper Pool without
// ever fading, teleporting, or respawning.
//
// Coordinates are authored in Blender Z-up (bx, by, bz) and converted to Three.js Y-up (bx, bz, -by).

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const b2t = (bx, by, bz) => [bx, bz, -by];

function evalCubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

function evalCatmullRom(pts, t) {
  const nSeg = pts.length - 1;
  const s = clamp(t, 0, 1) * nSeg;
  const i = Math.min(nSeg - 1, Math.floor(s));
  const u = s - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(nSeg, i + 2)];
  const u2 = u * u;
  const u3 = u2 * u;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (
      2 * p1[k] +
      (-p0[k] + p2[k]) * u +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3
    );
  }
  return out;
}

// Exact Blender centerline control points matching l04_hydro_loop.py & l01_estate_pools.py
const UPPER_Z = -0.145;
const GROTTO_Z = -2.22;
const GROTTO_CX = 0.20;
const GROTTO_CY = -13.20;
const SIPHON_X = 7.75;
const SIPHON_Y = -13.20;

const SLIDE_A = [
  b2t(-0.90, -3.46, 0.16),
  b2t(-0.94, -5.00, 0.16),
  b2t(-1.15, -6.65, 0.14),
  b2t(-1.65, -7.75, 0.00),
];
const SLIDE_B = [
  SLIDE_A[3],
  b2t(-2.65, -9.25, -0.52),
  b2t(-5.15, -10.65, -1.32),
  b2t(-2.75, -11.65, -1.78),
];

const TUBE_A = [
  b2t(7.75, -13.20, 4.72),
  b2t(7.75, -12.80, 6.89),
  b2t(7.75, -7.80, 6.09),
  b2t(7.65, -4.85, 4.39),
];
const TUBE_B = [
  TUBE_A[3],
  b2t(7.55, -2.25, 2.89),
  b2t(7.45, 0.55, 1.79),
  b2t(7.40, 1.55, 0.22),
];

// Upper Pool navigable current lane steering cleanly around Flamingo (3.6, 2.2), Palm Island (9.2, 4.1),
// Swim Rings (-1.8, 4.4) & (1.6, -1.6), Beach Ball (7.6, -1.5), and Noodles (-2.6, -1.2).
const UPPER_POOL_WAYPOINTS = [
  b2t(7.40, 1.55, 0.22),       // Exact Return Tube mouth exit
  b2t(7.05, 2.55, UPPER_Z),    // Splashdown in open east-central water
  b2t(5.65, 4.85, UPPER_Z),    // North of Flamingo, west of Palm Island
  b2t(1.30, 4.85, UPPER_Z),    // Clear north basin lane
  b2t(-0.15, 2.25, UPPER_Z),   // West-central open water
  b2t(-0.32, -0.45, UPPER_Z),  // Gliding south toward aqueduct intake
  b2t(-0.78, -2.45, -0.04),    // Entering copper slide weir lip
  b2t(-0.90, -3.46, 0.16),     // Exact SLIDE_A[0] handoff
];

// Lower Grotto landing point after slide drop -> exact spiral into East Intake Channel (3.65, -13.20)
const GROTTO_LAND_BX = -1.95;
const GROTTO_LAND_BY = -11.05;
const GROTTO_START_ANG = Math.atan2(GROTTO_LAND_BY - GROTTO_CY, GROTTO_LAND_BX - GROTTO_CX); // ~+2.362 rad
const GROTTO_START_R = Math.hypot(GROTTO_LAND_BX - GROTTO_CX, GROTTO_LAND_BY - GROTTO_CY);   // ~3.041 m
const GROTTO_END_R = 3.45; // (0.20 + 3.45, -13.20) = (3.65, -13.20) exact East Intake Channel entry!

// Normalized stage boundaries along u in [0, 1) (52-second full lap by default)
export const CIRCUIT_STAGES = [
  { name: 'upper_pool',     u0: 0.00, u1: 0.38 },
  { name: 'slide',          u0: 0.38, u1: 0.55 },
  { name: 'grotto',         u0: 0.55, u1: 0.72 },
  { name: 'intake_channel', u0: 0.72, u1: 0.80 },
  { name: 'siphon_lift',    u0: 0.80, u1: 0.89 },
  { name: 'return_tube',    u0: 0.89, u1: 1.00 },
];

export const CIRCUIT_LAP_SECONDS = 52.0;

function sampleRawPos(uRaw) {
  const u = ((uRaw % 1) + 1) % 1;

  // 1. Upper Pool splashdown & current drift -> slide intake weir
  if (u < 0.38) {
    const s = u / 0.38;
    return { pos: evalCatmullRom(UPPER_POOL_WAYPOINTS, s), stage: 'upper_pool', s };
  }

  // 2. Burnished Copper Aqueduct Slide + splashdown arc into Lower Grotto
  if (u < 0.55) {
    const s = (u - 0.38) / 0.17;
    if (s < 0.88) {
      const k = s / 0.88;
      // Gentle gravity acceleration along the flume
      const e = 0.35 * k + 0.65 * k * k;
      const pos = e < 0.35
        ? evalCubic(SLIDE_A[0], SLIDE_A[1], SLIDE_A[2], SLIDE_A[3], e / 0.35)
        : evalCubic(SLIDE_B[0], SLIDE_B[1], SLIDE_B[2], SLIDE_B[3], (e - 0.35) / 0.65);
      return { pos, stage: 'slide', s };
    }
    const drop = (s - 0.88) / 0.12;
    const pStart = SLIDE_B[3];
    const pEnd = b2t(GROTTO_LAND_BX, GROTTO_LAND_BY, GROTTO_Z);
    const arcY = Math.sin(drop * Math.PI) * 0.14;
    return {
      pos: [
        lerp(pStart[0], pEnd[0], drop),
        lerp(pStart[1], pEnd[1], drop) + arcY,
        lerp(pStart[2], pEnd[2], drop),
      ],
      stage: 'slide',
      s,
    };
  }

  // 3. Lower Whirlpool Grotto orbit (stays outside Aqua Swim Ring at r=2.13m, arrives at exact angle 0 -> (3.65, -13.20))
  if (u < 0.72) {
    const s = (u - 0.55) / 0.17;
    const ang = lerp(GROTTO_START_ANG, -TAU, s);
    const rad = lerp(GROTTO_START_R, GROTTO_END_R, s);
    const bx = GROTTO_CX + Math.cos(ang) * rad;
    const by = GROTTO_CY + Math.sin(ang) * rad;
    return { pos: b2t(bx, by, GROTTO_Z), stage: 'grotto', s };
  }

  // 4. Open East Intake Water Channel -> directly beneath the Siphon Bell mouth
  if (u < 0.80) {
    const s = (u - 0.72) / 0.08;
    const bx = lerp(GROTTO_CX + GROTTO_END_R, SIPHON_X, s);
    const by = GROTTO_CY + Math.sin(s * Math.PI * 2.0) * 0.10;
    return { pos: b2t(bx, by, GROTTO_Z), stage: 'intake_channel', s };
  }

  // 5. Bubbling Glass Siphon Vortex Lift (r=0 at start & end -> exact zero-gap handoff into TUBE_A[0])
  if (u < 0.89) {
    const s = (u - 0.80) / 0.09;
    const ang = s * TAU * 2.5;
    const rad = 0.14 * Math.sin(s * Math.PI);
    const bx = SIPHON_X + Math.cos(ang) * rad;
    const by = SIPHON_Y + Math.sin(ang) * rad;
    const bz = lerp(GROTTO_Z, 4.72, s);
    return { pos: b2t(bx, by, bz), stage: 'siphon_lift', s };
  }

  // 6. Overhead Clear Glass Return Tube -> exact Return Tube mouth (7.40, 1.55, 0.22)
  const s = (u - 0.89) / 0.11;
  const pos = s < 0.5
    ? evalCubic(TUBE_A[0], TUBE_A[1], TUBE_A[2], TUBE_A[3], s * 2.0)
    : evalCubic(TUBE_B[0], TUBE_B[1], TUBE_B[2], TUBE_B[3], (s - 0.5) * 2.0);
  return { pos, stage: 'return_tube', s };
}

/**
 * Sample a continuously circulating duck pose along the unified closed loop.
 * Scale is always 1.0 (never shrinks, teleports, or pops in).
 */
export function sampleSanctuaryCircuit(uRaw, time = 0, phase = 0) {
  const u = ((uRaw % 1) + 1) % 1;
  const du = 0.0025;
  const cur = sampleRawPos(u);
  const nxt = sampleRawPos(u + du);

  const tx = nxt.pos[0] - cur.pos[0];
  const ty = nxt.pos[1] - cur.pos[1];
  const tz = nxt.pos[2] - cur.pos[2];
  const tLen = Math.hypot(tx, ty, tz) || 1;
  const dx = tx / tLen;
  const dy = ty / tLen;
  const dz = tz / tLen;

  let x = cur.pos[0];
  let y = cur.pos[1];
  let z = cur.pos[2];

  // Subtle buoyancy bob ONLY when floating on open water (zero bob inside glass tube / slide bed)
  const onWater = cur.stage === 'upper_pool' || cur.stage === 'grotto' || cur.stage === 'intake_channel';
  if (onWater) {
    const waterBlend = cur.stage === 'upper_pool'
      ? Math.min(1, cur.s / 0.08, (1 - cur.s) / 0.08)
      : 1.0;
    y += Math.sin(time * 2.2 + x * 0.6 + z * 0.5 + phase) * 0.026 * waterBlend;
  }

  const yaw = cur.stage === 'siphon_lift'
    ? -cur.s * TAU * 2.5 + Math.PI * 0.5
    : Math.atan2(dx, dz);

  const pitch = cur.stage === 'siphon_lift'
    ? -0.24
    : cur.stage === 'slide' || cur.stage === 'return_tube'
      ? -Math.asin(clamp(dy, -0.82, 0.82)) * 0.78
      : Math.cos(time * 2.1 + phase) * 0.045;

  const roll = cur.stage === 'slide'
    ? Math.sin(cur.s * TAU) * 0.20
    : cur.stage === 'return_tube'
      ? Math.sin(time * 2.8 + phase) * 0.14
      : cur.stage === 'siphon_lift'
        ? 0.14
        : Math.sin(time * 1.8 + phase) * 0.055;

  return { x, y, z, yaw, pitch, roll, scale: 1.0, stage: cur.stage };
}
