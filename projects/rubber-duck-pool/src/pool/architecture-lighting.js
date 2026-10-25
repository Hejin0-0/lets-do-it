import {P} from './layout.js';
import {bowlHeight} from './map-kit.js';

// Origin-style submerged fixtures, separate from the courtyard's warm lanterns.
// [x, y, z, strength]; cool light is shared by the floor, props, ducks and water.
export const POOL_LIGHTS=[
  ...[-1.65,.10,1.85].flatMap(x=>[[x,P.LU-.14,P.MAIN[1]+.035,1.7],[x,P.LU-.14,P.MAIN[3]-.035,1.7]]),
  ...[-1.8,-.3].flatMap(z=>[[P.MAIN[0]+.035,P.LU-.14,z,1.5],[P.MAIN[2]-.035,P.LU-.14,z,1.5]]),
  ...[0,Math.PI/2,Math.PI,Math.PI*1.5].map(a=>[P.ROUND[0]+Math.cos(a)*.72,bowlHeight(.72)+.012,P.ROUND[1]+Math.sin(a)*.72,.7]),
];
