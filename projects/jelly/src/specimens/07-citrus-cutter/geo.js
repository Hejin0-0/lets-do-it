// The citrus slice on the cutting board: a half disc with two rounded corners, cut along its flat
// edge. Zest and pith ring it, four membranes fan out from the core and small air bubbles sit between them.
import { createSliceKernel } from '../../core/cut/kernel.js';

const PI = Math.PI;
export const T = 0.56;               // slab thickness (y)
export const R = 1.58;               // slice radius
export const ZC = -0.67;             // centre z / flat cut edge of the original slice
export const ZEST = 0.07, PITH = 0.12, CORE = 0.18;   // rind layers; membranes start this far from C
const CORNER = 0.12;                 // rounding radius of the slice's two in-plane corners
const RIND = ZEST + PITH;

function sliceSdf(x, z) {
  const rho = CORNER, Rp = R - rho, a = Math.sqrt(Rp * Rp - rho * rho);
  const w = z - ZC, len = Math.hypot(x, w), ax = Math.abs(x);
  const dCorner = Math.hypot(ax - a, w - rho);
  const dArc = w * Rp >= rho * len ? Math.abs(len - Rp) : dCorner;  // projection on the arc?
  const dSeg = ax <= a ? Math.abs(w - rho) : dCorner;                // projection on the flat?
  const d = Math.min(dArc, dSeg);
  return (len <= Rp && w >= rho ? -d : d) - rho;
}

export function createCitrus() {
  const K = createSliceKernel({
    T, ROUND: 0.07, MIN_AREA: 0.03, BEVEL: 0.05, FILLET_RINGS: 4, sliceSdf,
    GRID: Object.freeze({ h: 0.025, X0: -1.75, Z0: -0.80, NX: 140, NZ: 74, N: 140 * 74 }),
    inclusions: (field) => ({ membranes: buildMembranes(field), bubbles: pickBubbles(field) }),
  });
  const { sample, mulberry32 } = K;

  // Four radial membrane sheets, clipped to the piece (inset a little from its surface).
  function buildMembranes(field) {
    const pos = [], idx = [], r0 = CORE, r1 = R - RIND, inset = 0.02, ns = Math.ceil((r1 - r0) / 0.01);
    for (let k = 1; k <= 4; k++) {
      const c = Math.cos((k * PI) / 5), s = Math.sin((k * PI) / 5);
      const f = (r) => sample(field, c * r, ZC + s * r) + inset;
      const cross = (a, b) => {                  // bisection for the inset boundary
        const fa = f(a) < 0;
        for (let it = 0; it < 24; it++) { const m = (a + b) / 2; if ((f(m) < 0) === fa) a = m; else b = m; }
        return (a + b) / 2;
      };
      const sheet = (a, b) => {
        const len = b - a;
        if (len < 0.03) return;
        const m = Math.max(1, Math.round(len / 0.06)), first = pos.length / 3;
        for (let u = 0; u <= m; u++) {
          const r = a + (len * u) / m;
          for (let v = 0; v <= 4; v++) pos.push(c * r, 0.03 + ((T - 0.06) * v) / 4, ZC + s * r);
        }
        for (let u = 0; u < m; u++) {
          for (let v = 0; v < 4; v++) {
            const p0 = first + u * 5 + v, p1 = p0 + 5;
            idx.push(p0, p1, p1 + 1, p0, p1 + 1, p0 + 1);
          }
        }
      };
      let prevR = r0, prevIn = f(r0) < 0, start = prevIn ? r0 : -1;
      for (let m = 1; m <= ns; m++) {
        const r = r0 + ((r1 - r0) * m) / ns, isIn = f(r) < 0;
        if (isIn && !prevIn) start = cross(prevR, r);
        else if (!isIn && prevIn) { sheet(start, cross(prevR, r)); start = -1; }
        prevR = r; prevIn = isIn;
      }
      if (prevIn) sheet(start, r1);
    }
    return { pos: Float32Array.from(pos), index: Uint32Array.from(idx) };
  }

  // A fixed, deterministic set of small air bubbles in the flesh (x y z r), away from membranes.
  const BUBBLES = (() => {
    const rnd = mulberry32(0xC17305), out = [];
    while (out.length < 40) {
      const r = 0.006 + 0.01 * rnd(), th = (0.06 + 0.88 * rnd()) * PI, rr = CORE + 0.12 + (R - RIND - CORE - 0.22) * rnd();
      const y = 0.12 + (T - 0.24) * rnd(), seg = th / (PI / 5), off = Math.abs(seg - Math.round(seg)) * (PI / 5) * rr;
      if (off < r + 0.03) continue;
      out.push(rr * Math.cos(th), y, ZC + rr * Math.sin(th), r);
    }
    return Float32Array.from(out);
  })();
  function pickBubbles(field) {
    const out = [];
    for (let i = 0; i < BUBBLES.length; i += 4)
      if (sample(field, BUBBLES[i], BUBBLES[i + 2]) < -(BUBBLES[i + 3] + 0.03)) out.push(BUBBLES[i], BUBBLES[i + 1], BUBBLES[i + 2], BUBBLES[i + 3]);
    return Float32Array.from(out);
  }

  return K;
}

/** What rides inside a citrus piece, in the order the renderer expects: membranes, then bubbles. */
export function citrusChannels(mesh) {
  const b = mesh.bubbles, nb = b.length / 4, bp = new Float32Array(nb * 3), bi = new Float32Array(nb * 4);
  for (let i = 0; i < nb; i++) { bp.set(b.subarray(4 * i, 4 * i + 3), 3 * i); bi[4 * i] = b[4 * i + 3]; }
  return [
    { key: 'membranes', pts: mesh.membranes.pos, index: mesh.membranes.index },
    { key: 'bubbles', pts: bp, inst: bi },
  ];
}

// ----- the citrus slice's look (WGSL). pal: zest light, zest dark, pith, membrane;
// prm[0] = (radius, centre z, zest width, pith width), prm[1] = (core radius, membrane width, thickness, -).
/** Rest-space zones (zest, pith, flesh, membranes, core) and the juice vesicles. */
export const CITRUS_HELPERS = /* wgsl */`
// What a rest-space point of the slice is made of. The zones depend only on the rest position, so
// every cut face shows the right structure. th runs 0..PI round the half-disc, r out from its centre.
struct Zones { zest: f32, pith: f32, flesh: f32, mem: f32, core: f32, r: f32, th: f32, depth: f32 };
fn zones(rp: vec3f) -> Zones {
  var z: Zones;
  let q = rp.xz - vec2f(0.0, F.prm[0].y);
  z.r = length(q);
  z.th = atan2(q.y, q.x);
  let wob = (vnoise(vec3f(z.th * 28.0, rp.y * 6.0, 0.3)) - 0.5) * 0.014 + (vnoise(vec3f(z.th * 90.0, rp.y * 15.0, 1.7)) - 0.5) * 0.005;
  z.depth = F.prm[0].x - z.r + wob;                  // in from the zest
  z.zest = 1.0 - smoothstep(F.prm[0].z - 0.005, F.prm[0].z + 0.005, z.depth);
  let pe = F.prm[0].z + F.prm[0].w + wob * 1.6;
  z.pith = (1.0 - smoothstep(pe - 0.014, pe + 0.01, z.depth)) * (1.0 - z.zest);
  let inner = max(0.0, 1.0 - z.zest - z.pith);
  z.core = (1.0 - smoothstep(F.prm[1].x - 0.035, F.prm[1].x + 0.02, z.r + wob)) * inner;
  let k = clamp(round(z.th / (PI / 5.0)), 1.0, 4.0);
  let dm = abs(z.th - k * PI / 5.0) * z.r;          // arc distance to the nearest membrane
  z.mem = (1.0 - smoothstep(F.prm[1].y * 0.5, F.prm[1].y * 0.5 + 0.012, dm)) * smoothstep(F.prm[1].x - 0.02, F.prm[1].x + 0.04, z.r) * (inner - z.core);
  z.flesh = max(0.0, inner - z.core - z.mem);
  return z;
}
// Juice vesicles: teardrop sacs elongated along the radius, narrowing toward the centre.
// x = wall (bright boundary), y = sac id (for tint), z = sac body (0 at the wall, 1 inside).
fn vesicles(rp: vec3f, r: f32, th: f32) -> vec3f {
  let p = vec3f(th * r * 26.0, r * 7.0, rp.y * 15.0);
  let c = cells(p);
  let along = fract(p.y);                            // position along the sac
  let taper = mix(0.55, 1.0, along);                 // pointed toward the centre
  let wall = 1.0 - smoothstep(0.02, 0.11 * taper, c.y - c.x);
  return vec3f(wall, c.z, smoothstep(0.0, 0.25, c.y - c.x));
}
`;
/** The gel: refracted, absorbing flesh with vesicles; milky pith and membranes; waxy zest. */
export const CITRUS_MATERIAL = /* wgsl */`
@fragment fn fsJelly(i: JV) -> @location(0) vec4f {
  let Ng = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let dF = length(toCam);
  let V = toCam / dF;
  let px = vec2i(i.pos.xy);
  let sceneDist = textureLoad(texA, px, 0).a;
  let dB = textureLoad(texB, px, 0).r;
  let thick = clamp(min(dB, sceneDist) - dF, 0.004, 1.6);
  let z = zones(i.rp);

  // Zest: oil-gland pores (small pits) and mottling perturb its normal and colour.
  let gl = cells(i.rp * vec3f(64.0, 64.0, 64.0));
  let pore = (1.0 - smoothstep(0.06, 0.2, gl.x)) * z.zest;
  let bump = (vec3f(vnoise(i.rp * 95.0), vnoise(i.rp * 95.0 + 7.0), vnoise(i.rp * 95.0 + 13.0)) - 0.5);
  let N = normalize(Ng + bump * (0.18 * z.zest + 0.04 * (1.0 - z.zest)) - Ng * pore * 0.25);
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);

  // Refraction: follow the bent ray to the exit point and look up what is behind it.
  let Rd = refract(-V, N, 1.0 / 1.40);
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (0.8 + 7.0 * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;

  // Internal structure in rest space, so it travels with the jelly: vesicles half-way along the ray.
  let RdR = rotTo(Ng, normalize(i.rn), Rd);
  let mid = i.rp + RdR * thick * 0.45;
  let qm = mid.xz - vec2f(0.0, F.prm[0].y);
  let ves = vesicles(mid, length(qm), atan2(qm.y, qm.x));
  let vesS = vesicles(i.rp, z.r, z.th);
  let grain = vnoise(mid * 19.0) * 0.6 + vnoise(mid * 53.0) * 0.4;
  let segDepth = smoothstep(0.0, 0.35, z.depth - F.prm[0].z - F.prm[0].w);
  let dens = F.absorb.w * (0.84 + 0.3 * grain) * (0.92 + 0.16 * ves.y) * mix(0.55, 1.0, segDepth);
  let sigma = F.absorb.rgb * dens;
  var trans = vec3f(0.0); var bg = vec3f(0.0);
  for (var k = 0; k < 6; k++) {
    let a = f32(k) * 1.0472 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.45 + 0.11 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.004, 1.6));   // per tap, capped by the back
    bg += s.rgb;
  }
  trans /= 6.0; bg /= 6.0;

  // Light inside the gel.
  let wrap = clamp((dot(N, KEY) + 0.55) / 1.55, 0.0, 1.0);
  let amb = env(N, 1.0) * 0.55;
  let inLight = vec3f(1.0, 0.97, 0.93) * 1.5 * wrap + amb;
  let sc = F.scatter.rgb;
  let scat = sc * (1.0 - exp(-thick * 5.0 * F.scatter.w)) * inLight * 0.16;
  let back = pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 2.0) + 0.6 * pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  let thinT = exp(-sigma * (thick * 0.6 + 0.015));
  let glow = sc * thinT * back * (0.35 + 1.6 * pow(1.0 - NdV, 2.0)) * 0.5;
  let walls = F.pal[3].rgb * inLight * (ves.x * 0.06 + vesS.x * 0.09) * exp(-sigma * thick * 0.3);
  let glint = pow(max(dot(reflect(-V, normalize(Ng + (vec3f(grain, ves.y, vesS.z) - 0.45) * 0.6)), KEY), 0.0), 48.0);
  let sparkle = vesS.z * (0.02 + 0.45 * glint) * sc * thinT.r;
  let flesh = trans + scat + glow + walls + sparkle;

  // Milky layers: pith, core and the membranes on the surface; mostly scattering, a little see-through.
  let milkT = exp(-vec3f(6.5, 5.6, 5.0) * thick);
  let pith = mix(F.pal[2].rgb * (inLight * 0.74 + amb * 0.5), bg * milkT * F.pal[2].rgb * 1.1, 0.18) + F.pal[2].rgb * thinT.g * back * 0.25;
  let memb = mix(F.pal[3].rgb * (inLight * 0.6 + amb * 0.45), flesh, 0.45);

  // Zest: waxy, glossy, mottled, with darker pores.
  let mott = vnoise(i.rp * vec3f(9.0, 9.0, 9.0)) * 0.6 + vnoise(i.rp * 31.0) * 0.4;
  var zestCol = mix(F.pal[0].rgb, F.pal[1].rgb, smoothstep(0.25, 0.8, mott));
  zestCol *= 1.0 - pore * 0.35;
  let zest = zestCol * (clamp(dot(N, KEY), 0.0, 1.0) * 1.2 * vec3f(1.0, 0.98, 0.95) + amb * 0.9) + zestCol * thinT.g * back * 0.18;

  let fres = 0.035 + 0.965 * pow(1.0 - NdV, 5.0);
  let fresZ = 0.045 + 0.955 * pow(1.0 - NdV, 5.0);
  let keyI = vec3f(1.0, 0.97, 0.93) * 2.2;
  let specGel = env(R, 0.04) * fres + keyI * ggx(N, V, KEY, 0.07) * fres;
  let specMilk = env(R, 0.12) * fres + keyI * ggx(N, V, KEY, 0.14) * fres;
  let specZest = (env(R, 0.22) * 0.9 + keyI * ggx(N, V, KEY, 0.3)) * fresZ * (1.0 - pore * 0.6);
  let cFlesh = flesh * (1.0 - fres) + specGel;
  let cPith = pith * (1.0 - fres) + specMilk;
  let cMem = memb * (1.0 - fres) + specMilk;
  let cZest = zest * (1.0 - fresZ) + specZest;
  let col = cFlesh * (z.flesh + z.core * 0.35) + cPith * (z.pith + z.core * 0.65) + cMem * z.mem + cZest * z.zest;
  return present(col, i.pos.xy);
}
fn clarityAt(rp: vec3f) -> f32 {
  let z = zones(rp);
  return 1.0 - (z.zest * 0.9 + (z.pith + z.core) * 0.55 + z.mem * 0.3);
}
`;
/** Thin milky membrane sheets inside the gel (skinnedPlugin, over the scene). */
export const CITRUS_MEMBRANES = /* wgsl */`
@fragment fn fsMem(i: MV) -> @location(0) vec4f {
  let n = normalize(cross(dpdx(i.wp), dpdy(i.wp)));
  let V = normalize(F.camPos.xyz - i.wp);
  let facing = abs(dot(n, V));
  let lit = F.pal[3].rgb * (0.55 + 0.6 * abs(dot(n, KEY))) + env(n, 1.0) * 0.08;
  return vec4f(lit, mix(0.62, 0.18, facing));
}
`;

/** Three varieties. absorb: Beer–Lambert coefficients per scene unit; they also tint the shadow. */
const variety = (absorb, scatter, palette) => ({ absorb, density: 1, scatter, palette, prm: [[R, ZC, ZEST, PITH], [0.13, 0.016, T, 0]] });
export const CITRUS_PRESETS = {
  orange: variety([0.32, 2.0, 7.2], [1.0, 0.48, 0.07], ['#ea842c', '#d2601a', '#f4e9d0', '#f8e8cc']),
  blood: variety([0.75, 7.0, 5.8], [0.92, 0.1, 0.09], ['#dc6a2e', '#b4421f', '#f2e0cd', '#f2d9cb']),
  lemon: variety([0.1, 0.34, 4.4], [1.0, 0.86, 0.22], ['#f0c92e', '#d3a414', '#f6efd5', '#fbf1d0']),
};
