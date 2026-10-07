// Room layout in real metres (DESIGN §9 Room). Table centre at the origin, floor at y = 0,
// +x east, +z south (toward the commander's chair), north wall with the lancets at z = −9.
export const HALL = { x: 5.5, zN: -9, zS: 7, wallTop: 7.8, ridge: 10.5 }
/** Lower tier face (both long walls), upper tier face, gallery floor level. */
export const LOWER_FACE = 4.2
export const UPPER_FACE = 5.1
export const GALLERY_Y = 3.4
/** Where the long-wall stacks stop at the south end (the door bay lies beyond). */
export const STACK_S = 5.8
/** Freestanding presses: centre lines in z, running from the lower tier face to |x| = PRESS_IN. */
export const PRESS_Z = [-5.7, -3.0, 3.1]
export const PRESS_IN = 2.3
export const PRESS_HALF = 0.33
/** Fireplace on the east wall, centred at z = FIRE_Z, the stacks broken for ±FIRE_HALF. */
export const FIRE_Z = -0.2
export const FIRE_HALF = 1.4
/** Chandelier ring height (the key light's source) over the table. */
export const CHANDELIER_Y = 3.05
/** North lancets: centre x, sill y, width, height. */
export const LANCETS = [
  { x: -2.3, y: 3.3, w: 1.5, h: 5.5 },
  { x: 0, y: 3.7, w: 1.5, h: 5.5 },
  { x: 2.3, y: 3.3, w: 1.5, h: 5.5 },
]
/** Moonlight travels along this direction (from the north, 46° up). */
export const MOON_DIR: [number, number, number] = [0.16, -1.0, 0.95]
