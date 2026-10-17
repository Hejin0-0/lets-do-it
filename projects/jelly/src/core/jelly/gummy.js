// The cast-gummy material the bear and the pineapple jelly share: a smooth gel whose density
// drifts a little in rest space, Beer–Lambert through its thickness, soft scattering, thin places
// glowing from behind, Fresnel gloss. pal[0] = haze (the sugar's faint milkiness), pal[1] = glow.

export const helpers = /* wgsl */`
// The gel in REST space, so it travels and stretches with the body: sugar never sets perfectly
// evenly, so the density drifts a little, slowly, with no grain and no repeat.
fn gum(rp: vec3f) -> f32 {
  return vnoise(rp * 2.1 + 0.37) * 0.6 + vnoise(rp * 4.7 + 5.1) * 0.4;
}
fn clarityAt(rp: vec3f) -> f32 { return 0.94; }
`;

const TAILS = {
  // one restrained GGX highlight
  plain: `  let spec = env(R, 0.04) * fres + vec3f(1.0, 0.97, 0.92) * 1.6 * ggx(N, V, KEY, 0.08) * fres;
  return present(gel * (1.0 - fres) + spec, i.pos.xy);`,
  // a softer highlight and a delicate rim: the silhouette catches the strip lights behind, tinted a touch by the gel
  rim: `  let spec = env(R, 0.04) * fres + vec3f(1.0, 0.97, 0.92) * 1.3 * ggx(N, V, KEY, 0.09) * fres;
  // a delicate rim: the silhouette catches the strip lights behind, tinted a touch by the gel
  let rim = mix(vec3f(1.0, 0.97, 0.93), F.pal[1].rgb, 0.35) * pow(1.0 - NdV, 3.0) * (0.35 + 0.65 * clamp(dot(N, RIM) * 0.5 + 0.5, 0.0, 1.0)) * 0.2;
  return present(gel * (1.0 - fres) + spec + rim, i.pos.xy);`,
  // wet: fresh from the mould, a sharp bright highlight over a broad sheen, clearer reflections of the softboxes;
  // and, if F.prm[0].x > 0, a coat of sugar: crystals frost the gloss, and each catches the light on its own facet
  wet: `  let spec = env(R, 0.02) * fres * 1.2 + vec3f(1.0, 0.97, 0.92) * (2.2 * ggx(N, V, KEY, 0.05) + 0.6 * ggx(N, V, KEY, 0.18)) * fres;
  let rim = mix(vec3f(1.0, 0.97, 0.93), F.pal[1].rgb, 0.4) * pow(1.0 - NdV, 3.0) * (0.35 + 0.65 * clamp(dot(N, RIM) * 0.5 + 0.5, 0.0, 1.0)) * 0.26;
  let bare = gel * (1.0 - fres) + spec + rim;
  let sug = F.prm[0].x;
  if (sug <= 0.0) { return present(bare, i.pos.xy); }
  let cr = cells(i.rp * 55.0);
  let facet = normalize(N + (fract(sin(cr.z * vec3f(12.9898, 78.233, 37.719)) * 43758.5453) - 0.5) * 1.4);
  let sparkle = pow(max(dot(reflect(-V, facet), KEY), 0.0), 90.0) * 4.0 * smoothstep(0.02, 0.12, cr.y - cr.x);
  let frost = vec3f(0.93, 0.91, 0.87) * (wrap * 0.75 + amb * 0.7 + 0.08);
  return present(mix(bare, gel * 0.8 + frost * 0.32, sug * 0.7) + vec3f(1.0, 0.98, 0.95) * sparkle * sug, i.pos.xy);`,
};

/** fsJelly for a cast gummy; `look` is 'plain', 'rim' or 'wet'; frost: how much the view through it blurs with thickness. */
export const gummyMaterial = (look, { frost = 6.0 } = {}) => /* wgsl */`
@fragment fn fsJelly(i: JV) -> @location(0) vec4f {
  let Ng = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let dF = length(toCam);
  let V = toCam / dF;
  let px = vec2i(i.pos.xy);
  let sceneDist = textureLoad(texA, px, 0).a;
  let dB = textureLoad(texB, px, 0).r;
  let thick = clamp(min(dB, sceneDist) - dF, 0.004, 2.2);
  // a cast gummy: the surface is smooth, with only the softest wave from the mould
  let N = normalize(Ng + (vec3f(vnoise(i.rp * 7.0), vnoise(i.rp * 7.0 + 7.0), vnoise(i.rp * 7.0 + 13.0)) - 0.5) * 0.03);
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);

  // Refraction: follow the bent ray to its exit and look up what lies behind it.
  let Rd = refract(-V, N, 1.0 / 1.45);
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (0.8 + ${frost.toFixed(2)} * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;

  // Absorption along the ray (Beer-Lambert), with the density sampled half-way in, in rest space.
  let RdR = rotTo(Ng, normalize(i.rn), Rd);
  let dens = F.absorb.w * (0.88 + 0.24 * gum(i.rp + RdR * thick * 0.45));
  let sigma = F.absorb.rgb * dens;
  var trans = vec3f(0.0);
  for (var k = 0; k < 6; k++) {
    let a = f32(k) * 1.0472 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.45 + 0.11 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.004, 2.2));   // per tap, capped by the back face
  }
  trans /= 6.0;

  // Light inside: soft scattering, and thin (stretched) places glowing with light from behind.
  let wrap = clamp((dot(N, KEY) + 0.55) / 1.55, 0.0, 1.0);
  let amb = env(N, 1.0) * 0.55;
  let inLight = vec3f(1.0, 0.97, 0.92) * 1.45 * wrap + amb;
  let scat = F.scatter.rgb * (1.0 - exp(-thick * 4.0 * F.scatter.w)) * inLight * 0.12;
  let back = pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 2.0) + 0.6 * pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  let thinT = exp(-sigma * (thick * 0.6 + 0.015));
  let glow = F.pal[1].rgb * thinT * back * (0.35 + 1.6 * pow(1.0 - NdV, 2.0)) * 0.5;
  let haze = F.pal[0].rgb * inLight * 0.03 * (1.0 - exp(-thick * 3.0)) * exp(-sigma * thick * 0.25);
  let gel = trans + scat + glow + haze;

  // Wet gloss: Fresnel reflections of the softboxes and one restrained GGX highlight.
  let fres = 0.034 + 0.966 * pow(1.0 - NdV, 5.0);
${TAILS[look]}
}
`;
