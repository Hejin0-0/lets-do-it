// 04's look: a set custard is translucent and milky: light goes in, scatters, and comes back golden;
// the plate and the specks inside show through its thinner edges, softened. The caramel is a glassy film
// over it (its colour from the sauce in pal[2]), thickest and reddest on top, running down in a few drips,
// and pooled on the plate. Everything is placed in rest space, so the sauce and specks move with the custard.
// pal[0] = pale custard at its edges, pal[1] = deep custard in its middle, pal[2] = the sauce, pal[3] = the specks.
import { PUD } from './sim.js';

const H = PUD.H.toFixed(3);
const SAUCE = /* wgsl */`
// How much caramel covers a rest-space point: a layer on top, and drips of different lengths and widths.
fn sauceAt(rp: vec3f) -> f32 {
  let r = length(rp.xz);
  let th = atan2(rp.z, rp.x);
  var drip = 0.0;
  for (var k = 0; k < 9; k++) {
    let fk = f32(k);
    let a = fk * 0.6981 + 0.37 * sin(fk * 2.3);
    let w = 0.07 + 0.06 * fract(sin(fk * 12.9898) * 43758.5);
    let len = 0.1 + 0.42 * fract(sin(fk * 78.233) * 12345.6789);
    var dth = abs(th - a);
    dth = min(dth, 6.28318 - dth);
    let along = dth * max(r, 0.3) / w;
    drip = max(drip, len * exp(-along * along) * (1.0 + 0.25 * sin(rp.y * 9.0 + fk)));
  }
  let line = ${H} - 0.07 - drip;
  return smoothstep(line - 0.012, line + 0.012, rp.y);
}
`;

export const helpers = SAUCE + /* wgsl */`
fn clarityAt(rp: vec3f) -> f32 { return 0.5; }   // custard lets half the light through, warm
`;

export const material = /* wgsl */`
@fragment fn fsJelly(i: JV) -> @location(0) vec4f {
  let Ng = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let dF = length(toCam);
  let V = toCam / dF;
  let px = vec2i(i.pos.xy);
  let sceneDist = textureLoad(texA, px, 0).a;
  let dB = textureLoad(texB, px, 0).r;
  let thick = clamp(min(dB, sceneDist) - dF, 0.004, 2.2);
  let sc = sauceAt(i.rp);
  // a smooth set custard: the faintest ripple from the steam, a few tiny pits low on the side
  let pit = cells(i.rp * 26.0);
  let pits = (1.0 - smoothstep(0.0, 0.05, pit.x)) * step(0.82, fract(pit.z * 7.3)) * (1.0 - sc) * smoothstep(0.5, 0.1, i.rp.y);
  let N = normalize(Ng + (vec3f(vnoise(i.rp * 9.0), vnoise(i.rp * 9.0 + 7.0), vnoise(i.rp * 9.0 + 13.0)) - 0.5) * 0.025);
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);

  // custard: what lies behind (the plate, the specks), softened and tinted on its way through
  let Rd = refract(-V, N, 1.0 / 1.42);
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (1.2 + 5.0 * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  let sigma = F.absorb.rgb * F.absorb.w;
  var trans = vec3f(0.0);
  for (var k = 0; k < 6; k++) {
    let a = f32(k) * 1.0472 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.45 + 0.11 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.004, 2.2));
  }
  trans /= 6.0;
  // and the light scattered inside it: pale at the thin edge, deep gold where it is thick
  let wrap = clamp((dot(N, KEY) + 0.55) / 1.55, 0.0, 1.0);
  let inLight = vec3f(1.0, 0.97, 0.92) * 1.3 * wrap + env(N, 1.0) * 0.55;
  let depth = 1.0 - exp(-thick * 2.4);
  let milk = mix(F.pal[0].rgb, F.pal[1].rgb, smoothstep(0.1, 0.95, depth));
  let back = pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 2.0) + 0.5 * pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  let glow = F.pal[1].rgb * exp(-sigma * thick * 0.5) * back * (0.3 + 1.3 * pow(1.0 - NdV, 2.0)) * 0.45;
  var custard = trans * (1.0 - 0.7 * depth) + milk * (inLight * 0.75 + 0.3) * (0.28 + 0.62 * depth) + glow;
  // a speck (or anything else) inside: close under the surface it shows clearly, deeper down the custard hides it
  let s0 = textureSampleLevel(texA, samp, uv, 0.0);
  let inside = s0.a - dF;
  let near = select(0.0, exp(-inside * 7.0), s0.a < dB - 0.01 && inside > 0.0);
  custard = mix(custard, s0.rgb * exp(-sigma * inside) + milk * inLight * 0.08, near * 0.9);
  custard *= 1.0 - pits * 0.3;

  // caramel: a glassy film the custard shows through, amber where thin, red-brown where it pools on top
  let film = (0.05 + 0.07 * smoothstep(${(PUD.H - 0.2).toFixed(3)}, ${H}, i.rp.y)) / max(NdV, 0.25);
  let sauceAbs = -log(max(F.pal[2].rgb, vec3f(0.02)));
  let through = exp(-sauceAbs * film * 4.2);
  let caramel = custard * through + F.pal[2].rgb * (inLight * 0.6 + 0.2) * 0.35 * (1.0 - through);
  let col = mix(custard, caramel, sc);
  let rough = mix(0.12, 0.03, sc);
  let f0 = mix(0.03, 0.045, sc);
  let fres = f0 + (1.0 - f0) * pow(1.0 - NdV, 5.0);
  let spec = env(R, rough) * fres * mix(0.8, 1.25, sc) + vec3f(1.0, 0.97, 0.92) * ggx(N, V, KEY, rough) * fres * mix(1.4, 2.4, sc);
  return present(col * (1.0 - fres) + spec, i.pos.xy);
}
`;

/** The specks in the custard: tiny flakes, each on one skinned point, always facing the camera. */
export const SPECKS_WGSL = /* wgsl */`
struct SpV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) uv: vec2f, @location(2) @interpolate(flat) id: u32 };
@vertex fn vsSpeck(@location(0) lp: vec3f, @location(1) ln: vec3f, @builtin(instance_index) ii: u32) -> SpV {
  var o: SpV;
  let q = inst[ii];   // size, shade, turn
  let c = skinPos[u32(F.bases.z) + ii].xyz;
  let l = vec2f(lp.x * 2.4, lp.y);   // a seed, not a dot
  let r = vec2f(l.x * cos(q.z) - l.y * sin(q.z), l.x * sin(q.z) + l.y * cos(q.z));
  let wp = c + (F.camRight.xyz * r.x + F.camUp.xyz * r.y) * q.x;
  o.pos = F.viewProj * vec4f(wp, 1.0); o.wp = wp; o.uv = lp.xy; o.id = ii;
  return o;
}
@fragment fn fsSpeck(i: SpV) -> @location(0) vec4f {
  let e = dot(i.uv, i.uv);
  if (e > 1.0) { discard; }
  let shade = 0.7 + 0.6 * inst[i.id].y;
  return vec4f(F.pal[3].rgb * shade * (0.6 + 0.4 * (1.0 - e)), length(F.camPos.xyz - i.wp));
}
`;

/** One quad, drawn once per speck. */
export const SPECK_QUAD = { vtx: new Float32Array([-1, -1, 0, 0, 0, 1, 1, -1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, -1, 1, 0, 0, 0, 1]), index: new Uint16Array([0, 1, 2, 0, 2, 3]) };

/** The caramel that ran off and pooled round the base on the plate (plateDecal body). */
export const POOL = /* wgsl */`
  let r = length(P.xz);
  let th = atan2(P.z, P.x);
  let edge = ${(PUD.Rb + 0.1).toFixed(3)} + 0.09 * sin(th * 3.0 + 0.6) + 0.06 * sin(th * 7.0 + 2.1) + 0.035 * sin(th * 13.0);
  let cover = 1.0 - smoothstep(edge - 0.02, edge + 0.02, r);
  let depth = clamp((edge - r) * 6.0, 0.0, 1.0);
  return vec4f(F.pal[2].rgb * mix(1.15, 0.55, depth), cover);
`;
