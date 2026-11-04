import { P } from './layout.js';
import { isleH } from './island.js';

export const COOLER_SITES = [
  ...P.SEATS.map(s => ({ at: [s.side[0], s.y, s.side[1]], yaw: s.yaw + Math.PI / 2, scale: 1 })),
  { at: [-1.45, isleH(-1.45, 5.90), 5.90], yaw: 0, scale: .8 },
];
