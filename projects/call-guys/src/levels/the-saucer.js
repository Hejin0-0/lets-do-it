import { PALETTE } from '../palette.js';

/**
 * "The Saucer" — a round arena of dissolving tiles for Tilt Out.
 *
 * Five concentric rings on a uniform 1.885-unit arc pitch, tiles 1.6 across,
 * so the gaps are ~0.28 and the whole floor walks as one surface until it
 * starts disappearing. There is nothing to jump here; the challenge is where
 * you choose to stand.
 *
 * The rim collapses inward on a schedule and anything you stand on lights its
 * own fuse, so neither running nor waiting is a strategy on its own. The two
 * inner rings never collapse on their own — they are the endgame, seven tiles
 * with 1.8 seconds of life each once touched, and the last few seconds are
 * spent hopping between them.
 */

const TILE_HW = 0.8;
// Long enough to read the warning and pick a way out. At 1.8 an optimal run
// finished with two tiles of the sixty-one left standing, which is a fine
// photo finish and no margin at all for anyone playing it for the first time.
const FUSE = 2.1;
const RINGS = [
  { count: 1, radius: 0, color: PALETTE.finishDeck },
  { count: 6, radius: 1.8, color: PALETTE.finishDeck },
  { count: 12, radius: 3.6, color: PALETTE.runway },
  { count: 18, radius: 5.4, color: PALETTE.movingDeck },
  { count: 24, radius: 7.2, color: PALETTE.bumperDeck },
];

/** When each ring lights itself, rim first. The two inner rings never do. */
const AUTO_FUSE_AT = [Infinity, Infinity, 13, 9.5, 6];

function saucerTiles() {
  const tiles = [];
  RINGS.forEach((ring, r) => {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2;
      tiles.push({
        x: Math.sin(angle) * ring.radius,
        z: Math.cos(angle) * ring.radius,
        y: 0,
        hw: TILE_HW,
        hd: TILE_HW,
        ring: r,
        color: ring.color,
        fuse: FUSE,
        autoFuseAt: AUTO_FUSE_AT[r],
      });
    }
  });
  return tiles;
}

export const theSaucer = {
  id: 'the-saucer',
  name: 'The Saucer',
  mode: 'tilt-out',
  modes: ['tilt-out'],
  // An arena has no direction of progress, so the gap-budget rule has nothing
  // to measure. Reachability still applies and still runs.
  progressAxis: 'none',

  // High and fixed. The choice here is *where to stand*, which needs a read on
  // the whole floor, so the camera sits well above it. And the bearing stays
  // put: on a symmetric arena a camera that swings with you removes the only
  // landmarks there are.
  camera: { distance: 12, height: 13.5, lookHeight: 0.5 },

  // Start out on the third ring: near enough to the rim to feel the collapse
  // coming, far enough in that the first ring to go is not underfoot.
  spawn: { x: 0, y: 0.05, z: 5.4 },

  decks: [],
  tiles: saucerTiles(),
  obstacles: [],
  checkpoints: [],

  decor: {
    clouds: { count: 14, zMod: 30, zOffset: -15 },
    balloons: { count: 12, zMod: 26, zOffset: -13 },
  },
};
