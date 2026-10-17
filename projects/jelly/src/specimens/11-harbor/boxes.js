// Harbor Jelly — the containers: a ribbed steel box with door ends and darker corner posts, in ten liveries.
// The ship carries 6 bays × 4 rows × 2 tiers; the cranes swap boxes between her and the lanes under their
// backreaches (each crane its own lane, so they never cross). Behind, hundreds more stand in the terminal's
// stacks as still scenery. Each box that can move is a part of its own.
import { A, MAT } from '../../core/diorama/parts.js';
import { H } from './layout.js';

export const BOX = { L: 0.1, W: 0.042, H: 0.044 };
export const LIVERIES = ['#c4352b', '#2b5aa6', '#2e8a4c', '#e3a521', '#e6e1d6', '#6c4a8e', '#d4702a', '#3a3f46', '#3fa6b6', '#8c2c3c'];

/** One box, its origin at the middle of its floor, long along x, doors at −x. */
export function buildBox(B, livery) {
  const { L, W, H: h } = BOX, c = LIVERIES[livery];
  B.col(c).mat(MAT.RIBS).slab(-L / 2 + 0.003, 0.003, -W / 2, L / 2 - 0.003, h - 0.003, W / 2);
  B.col(c).mat(MAT.PAINT);
  B.slab(-L / 2, 0.003, -W / 2 + 0.003, -L / 2 + 0.003, h - 0.003, W / 2 - 0.003);   // the door end
  B.slab(L / 2 - 0.003, 0.003, -W / 2 + 0.003, L / 2, h - 0.003, W / 2 - 0.003);
  const dark = c.replace(/../g, (s, i) => (i ? Math.round(parseInt(s, 16) * 0.55).toString(16).padStart(2, '0') : s));
  B.col(dark).mat(MAT.PAINT);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.slab(sx * L / 2 - (sx > 0 ? 0.0045 : 0), 0, sz * W / 2 - (sz > 0 ? 0.0045 : 0), sx * L / 2 + (sx < 0 ? 0.0045 : 0), h, sz * W / 2 + (sz < 0 ? 0.0045 : 0));   // corner posts
  for (const y of [0, h - 0.004]) for (const sz of [-1, 1]) B.slab(-L / 2, y, sz * W / 2 - (sz > 0 ? 0.003 : 0), L / 2, y + 0.004, sz * W / 2 + (sz < 0 ? 0.003 : 0));   // top and bottom rails
  for (const dz of [-0.012, -0.005, 0.005, 0.012]) B.slab(-L / 2 - 0.0012, 0.006, dz - 0.0007, -L / 2, h - 0.006, dz + 0.0007);   // the door bars
}

// ----- the ship's slots (local to the ship: bow +x, waterline y = 0) -----
export const SHIP_BAYS = [-0.27, -0.165, -0.06, 0.045, 0.15, 0.255];
export const DECK_Y = 0.077;   // the hatch covers' top
/** The local position of a box's floor on the ship. */
export const shipSlot = (bay, row, tier) => [SHIP_BAYS[bay], DECK_Y + tier * (BOX.H + 0.001), (row - 1.5) * (BOX.W + 0.002)];

// ----- the lanes under the backreaches: crane A's on the west, crane B's on the east; stacks up to three -----
export const LANES = [[-2.32, -2.2, -2.08, -1.96, -1.84, -1.72], [-0.86, -0.74, -0.62, -0.5, -0.38, -0.26]];
export const LANE_MAX = 3;
export const laneSlot = (lane, s, tier) => [LANES[lane][s], H.DECK + tier * (BOX.H + 0.001), H.YZ];

/** The still stacks behind the lanes (into part 0); returns their footprints as solid boxes. */
export function buildStacks(B, rand) {
  const R = rand, solids = [];
  const z0 = H.STACKS[1] + 0.03, z1 = H.STACKS[0], rows = Math.floor((z1 - z0) / (BOX.W + 0.004));
  for (let x = -2.45; x + BOX.L < 0.32; x += BOX.L + 0.012) {
    if (Math.abs(x + 1.0) < 0.06) { x += 0.06; continue; }   // a roadway through the stacks
    let top = 0;
    for (let r = 0; r < rows; r++) {
      if (r === 3) continue;   // a lane between the blocks
      const n = 1 + Math.floor(R() * 4);
      top = Math.max(top, n);
      for (let t = 0; t < n; t++) B.at(A.t(x + BOX.L / 2, H.DECK + t * (BOX.H + 0.001), z0 + r * (BOX.W + 0.004) + BOX.W / 2), () => buildBox(B, Math.floor(R() * LIVERIES.length)));
    }
    solids.push([x, H.DECK, z0, x + BOX.L, H.DECK + top * BOX.H, z0 + rows * (BOX.W + 0.004)]);
  }
  return solids;
}

/** A moving box's livery, from its number (the scene and the world agree without sharing state). */
export const liveryOf = (id) => (id * 7 + (id >> 2) * 3) % LIVERIES.length;
/** The boxes that move: 48 on the ship (every slot full) and two to a lane slot. */
export function createBoxes() {
  const all = [];
  for (let b = 0; b < 6; b++) for (let r = 0; r < 4; r++) for (let t = 0; t < 2; t++) all.push({ at: 'ship', bay: b, row: r, tier: t });
  for (let l = 0; l < 2; l++) for (let s = 0; s < 6; s++) for (let t = 0; t < 2; t++) all.push({ at: 'lane', lane: l, s, tier: t });
  all.forEach((x, i) => { x.id = i; x.livery = liveryOf(i); x.init = { ...x }; });
  const K = {
    all,
    reset() { for (const x of all) Object.assign(x, x.init, { crane: -1 }); },
    onShip: (bay, row, tier) => all.find((x) => x.at === 'ship' && x.bay === bay && x.row === row && x.tier === tier),
    stack: (lane, s) => all.filter((x) => x.at === 'lane' && x.lane === lane && x.s === s).sort((a, b) => a.tier - b.tier),
  };
  K.reset();
  return K;
}
