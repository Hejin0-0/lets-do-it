import { writeFileSync } from 'node:fs';
import { P } from '../src/pool/layout.js';
import { JETTY } from '../src/pool/island.js';
import { BOWL_KIT } from '../src/pool/map-kit.js';
import { POOL_LIGHTS } from '../src/pool/architecture-lighting.js';
const sample = (path, step) => { const n=Math.ceil(path.len/step);return Array.from({length:n+1},(_,i)=>path.at(path.len*i/n)); };
// Sampled once for Blender; runtime geometry and motion both use these same layout paths.
const layout = {pool:P.POOL, mouth:P.MOUTH, main:P.MAIN, bowl:{at:[P.ROUND[0],BOWL_KIT.base,P.ROUND[1]],scale:BOWL_KIT.scale},
  slide:sample(P.slide,.012), tube:sample(P.tube,.035), tubeRadius:P.TUBE_R, pump:P.PUMP, poolLights:POOL_LIGHTS,
  supports:sample(P.tube,.5).filter(p=>P.roundD(p[0],p[2])>.15&&!P.inMain(p[0],p[2])).map(p=>[...p,P.terrainH(p[0],p[2])]), jetty:JETTY};
layout.slideSupports=sample(P.slide,.5).map(p=>[...p,P.terrainH(p[0],p[2])]);
writeFileSync(new URL('./map-layout.json',import.meta.url),JSON.stringify(layout,null,2)+'\n');
