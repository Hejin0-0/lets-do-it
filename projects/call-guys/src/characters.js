/**
 * Wobblers. Cosmetic only — every character shares one physics body, because
 * the course tuning and every fairness rule in `levels/validate.js` is derived
 * from a single set of numbers. Per-character stats would invalidate all of it.
 * `test.html` proves it: a seeded bot run is identical for all six.
 *
 * Palette constraint: every deck in the game is a light pastel (mint, lemon,
 * lavender, peach, sky, sea-green). So each body colour is deeper and more
 * saturated than anything it will ever stand on, and the six hues are spread
 * around the wheel so they never read as the same Wobbler at a glance.
 *
 * `bodyScale` is visual only. It stays within a few percent of 1 so the model
 * never disagrees noticeably with the fixed 0.42-unit collision radius.
 */
export const CHARACTERS = [
  {
    id: 'pip',
    name: 'Pip',
    body: 0x7b6cf6,
    belly: 0xfff3d6,
    visor: 0x37e0b0,
    limb: 0x5a4ed4,
    accessory: 'antenna',
    accessoryColor: 0xffd23f,
    bodyScale: 1,
  },
  {
    id: 'nib',
    name: 'Nib',
    body: 0xe0405f,
    belly: 0xfff0e2,
    visor: 0xffd23f,
    limb: 0xb32b46,
    accessory: 'crest',
    accessoryColor: 0xfff8ec,
    bodyScale: 0.97,
  },
  {
    id: 'tuck',
    name: 'Tuck',
    body: 0x0f9e90,
    belly: 0xfffbe8,
    visor: 0xffb26b,
    limb: 0x0a7a70,
    accessory: 'fin',
    accessoryColor: 0xff8fab,
    bodyScale: 1.03,
  },
  {
    id: 'bramble',
    name: 'Bramble',
    body: 0xd9661c,
    belly: 0xfff4e0,
    visor: 0x7fd4ff,
    limb: 0xa84a12,
    accessory: 'ears',
    accessoryColor: 0xfff8ec,
    bodyScale: 1,
  },
  {
    id: 'sprout',
    name: 'Sprout',
    body: 0x2f9440,
    belly: 0xf4ffe8,
    visor: 0xff8fab,
    limb: 0x217030,
    accessory: 'sprig',
    accessoryColor: 0xffd23f,
    bodyScale: 0.98,
  },
  {
    id: 'bloom',
    name: 'Bloom',
    body: 0xc23fa8,
    belly: 0xfff0f8,
    visor: 0x6fe3c4,
    limb: 0x942c80,
    accessory: 'halo',
    accessoryColor: 0xffd23f,
    bodyScale: 1.02,
  },
];

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

export function getCharacter(id) {
  const character = CHARACTERS.find((entry) => entry.id === id);
  if (!character) {
    throw new Error(
      `Unknown character "${id}". Known characters: ${CHARACTERS.map((c) => c.id).join(', ')}`
    );
  }
  return character;
}

/** Falls back to the default rather than throwing — a stale saved id is not fatal. */
export function getCharacterOrDefault(id) {
  return CHARACTERS.find((entry) => entry.id === id) ?? CHARACTERS[0];
}
