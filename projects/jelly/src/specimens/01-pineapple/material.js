// 01's look: a clear set jelly (the cast-gummy material, thinned right down) and the pineapple pieces
// inside it, each riding on three skinned anchors and drawn into the scene so the gel refracts them.
import { helpers as gelHelpers, gummyMaterial } from '../../core/jelly/gummy.js';
import { CARRY_WGSL } from '../../core/jelly/plugins.js';
import { TIDBIT, ANCHOR } from './sim.js';

export const helpers = gelHelpers;
export const material = gummyMaterial('wet', { frost: 1.6 });   // a set jelly is clear: the fruit shows sharp

const RC = ((TIDBIT.ri + TIDBIT.ro) / 2).toFixed(4);
export const PIECES_WGSL = CARRY_WGSL + /* wgsl */`
// ---------- pineapple pieces ----------
struct CV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) lp: vec3f, @location(3) @interpolate(flat) id: u32 };
@vertex fn vsPiece(@location(0) lp: vec3f, @location(1) ln: vec3f, @builtin(instance_index) ii: u32) -> CV {
  var o: CV;
  let c = carried(ii, lp, ln, ${ANCHOR.toFixed(3)}, vec2f(0.8, 1.25));   // the fruit gives a little with the gel
  o.pos = F.viewProj * vec4f(c.wp, 1.0);
  o.wp = c.wp; o.n = c.n; o.lp = lp; o.id = ii;
  return o;
}
@fragment fn fsPiece(i: CV) -> @location(0) vec4f {
  let N = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let d = length(toCam);
  let V = toCam / d;
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  // pineapple flesh: pale toward the core, a deeper gold toward the rind, fibres running out from the core
  let rho = i.lp.z + ${RC};
  let phi = atan2(i.lp.x, rho);
  let t = clamp((rho - ${TIDBIT.ri.toFixed(3)}) / ${(TIDBIT.ro - TIDBIT.ri).toFixed(3)}, 0.0, 1.0);
  let v = inst[i.id].y;
  var base = mix(vec3f(0.98, 0.86, 0.4), vec3f(0.97, 0.58, 0.05), t * t * (0.85 + 0.3 * v));
  let fib = vnoise(vec3f(phi * 70.0, rho * 22.0, i.lp.y * 30.0)) * 0.6 + vnoise(vec3f(phi * 160.0, rho * 50.0, i.lp.y * 60.0)) * 0.4;
  let cell = cells(vec3f(phi * 28.0, rho * 16.0, i.lp.y * 26.0));
  base *= 0.86 + 0.22 * fib - 0.12 * (1.0 - smoothstep(0.02, 0.09, cell.y - cell.x));
  // juicy and a little translucent: wrapped light, the glow of the gel all round it, light from behind
  let wrap = clamp((dot(N, KEY) + 0.6) / 1.6, 0.0, 1.0);
  let through = pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 2.0) * 0.4;
  let diff = base * (wrap * 1.0 + env(N, 1.0) * 0.5 + 0.32 + through);
  let fr = 0.035 + 0.965 * pow(1.0 - NdV, 5.0);
  let spec = vec3f(1.0, 0.97, 0.92) * 1.6 * ggx(N, V, KEY, 0.12) + env(reflect(-V, N), 0.15) * fr * 0.6;
  return vec4f(diff * (1.0 - fr) + spec, d);
}
`;
