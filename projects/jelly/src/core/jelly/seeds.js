// The teardrop seed the melons share (05, 06): its mesh, and the shader that draws one per
// instance (with instancedPlugin) riding on three skinned anchors.
const PI = Math.PI;
export const SEED_LEN = 0.095;   // teardrop length at scale 1

/** Teardrop seed: pointed end toward +x, flat (y is the thin side). vtx = position + normal. */
export function seedMesh() {
  const nu = 20, nt = 14, P = [-SEED_LEN / 2, 0, 0], I = [];   // vertex 0: the round end's pole
  for (let j = 1; j < nt; j++) {
    const t = j / nt, a = t * PI, x = -Math.cos(a) * SEED_LEN / 2, rho = Math.sin(a) * (1 - 0.5 * t * t);
    for (let i = 0; i < nu; i++) { const b = (i / nu) * 2 * PI; P.push(x, Math.sin(b) * rho * 0.013, Math.cos(b) * rho * 0.028); }
  }
  const tip = P.length / 3, ring = (j, i) => 1 + (j - 1) * nu + (i % nu);
  P.push(SEED_LEN / 2, 0, 0);
  for (let i = 0; i < nu; i++) I.push(0, ring(1, i + 1), ring(1, i), tip, ring(nt - 1, i), ring(nt - 1, i + 1));
  for (let j = 1; j < nt - 1; j++) for (let i = 0; i < nu; i++) I.push(ring(j, i), ring(j, i + 1), ring(j + 1, i + 1), ring(j, i), ring(j + 1, i + 1), ring(j + 1, i));
  const nv = P.length / 3, nrm = new Float64Array(3 * nv);
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v + k] += n[k];
  }
  let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  const flip = vol < 0 ? -1 : 1;   // wind outward
  if (flip < 0) for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q; }
  const vtx = new Float32Array(6 * nv);
  for (let v = 0; v < nv; v++) {
    const n = [nrm[3 * v] * flip, nrm[3 * v + 1] * flip, nrm[3 * v + 2] * flip], l = Math.hypot(...n) || 1;
    vtx.set([P[3 * v], P[3 * v + 1], P[3 * v + 2], n[0] / l, n[1] / l, n[2] / l], 6 * v);
  }
  return { vtx, index: Uint16Array.from(I) };
}

/** Glossy teardrop seeds (with instancedPlugin): each rides on three skinned anchors from F.bases.z
 *  (centre, along, across) and stretches a little with the gel; inst: (scale, tint). Colour: pal[3]. */
export const SEEDS_WGSL = /* wgsl */`
// ---------- seeds: little glossy teardrops inside the gel, drawn into the scene so the jelly refracts them ----------
struct SV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) @interpolate(flat) id: u32, @location(3) lx: f32 };
@vertex fn vsSeed(@location(0) lp: vec3f, @location(1) ln: vec3f, @builtin(instance_index) ii: u32) -> SV {
  var o: SV;
  let b = u32(F.bases.z) + 3u * ii;     // three skinned anchors: centre, centre + long axis, centre - flat axis
  let p0 = skinPos[b].xyz;
  let ex = skinPos[b + 1u].xyz - p0;
  let lx = max(length(ex), 1e-5);
  let X = ex / lx;
  var Y = p0 - skinPos[b + 2u].xyz;
  Y = normalize(Y - X * dot(Y, X) + vec3f(0.0, 1e-6, 0.0));
  let Z = cross(X, Y);
  let st = clamp(lx / 0.04, 0.85, 1.2);   // seeds stretch a little with the gel, but stay seeds
  let sc = inst[ii].x;
  let wp = p0 + (X * lp.x * st + Y * lp.y + Z * lp.z) * sc;
  o.pos = F.viewProj * vec4f(wp, 1.0);
  o.wp = wp; o.n = normalize(X * ln.x / st + Y * ln.y + Z * ln.z); o.id = ii; o.lx = lp.x / 0.0475;
  return o;
}
@fragment fn fsSeed(i: SV) -> @location(0) vec4f {
  let N = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let d = length(toCam);
  let V = toCam / d;
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let v = inst[i.id].y;
  var base = F.pal[3].rgb * (0.75 + 0.5 * v) + vec3f(0.05, 0.03, 0.015) * smoothstep(0.2, 1.0, i.lx);
  base += vec3f(0.06, 0.04, 0.025) * pow(1.0 - NdV, 2.0);
  let diff = base * (clamp(dot(N, KEY), 0.0, 1.0) * 1.2 + env(N, 1.0) * 0.6);
  let fr = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  let spec = pow(max(dot(N, normalize(KEY + V)), 0.0), 160.0) * 2.2 + pow(max(dot(N, normalize(RIM + V)), 0.0), 90.0) * 0.8;
  return vec4f(diff * (1.0 - fr) + env(reflect(-V, N), 0.3) * fr * 0.45 + vec3f(spec), d);
}
`;
