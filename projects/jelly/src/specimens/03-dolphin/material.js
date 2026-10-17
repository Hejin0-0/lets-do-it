// 03's look: two layers poured one after the other. The top is a clear coloured gel; where a ray bent
// through it reaches the cream layer below (a plane in the body's rest space), the cream shows through,
// tinted by the gel it crossed. The cream layer itself is dense and softly lit. The eyes are dark and
// glossy, set on the moulded bumps (on the surface only, so the far eye never shows through the head).
// pal[0] = the gel's faint haze, pal[1] = the glow of thin places, pal[2] = the cream.
import { DOLPHIN } from './sim.js';

const BASE = DOLPHIN.base.toFixed(3);
export const helpers = /* wgsl */`
fn gum(rp: vec3f) -> f32 { return vnoise(rp * 2.1 + 0.37) * 0.6 + vnoise(rp * 4.7 + 5.1) * 0.4; }
fn creamAt(rp: vec3f) -> f32 { return 1.0 - smoothstep(${BASE} - 0.008, ${BASE} + 0.008, rp.y); }
fn clarityAt(rp: vec3f) -> f32 { return 0.88; }
fn eyeAt(rp: vec3f) -> f32 {   // 1 on the dark of an eye, in rest space
  let e = vec3f(${DOLPHIN.eye.map((v) => v.toFixed(3)).join(', ')});
  let d = length(vec3f(rp.x, rp.y, abs(rp.z)) - e) - ${(DOLPHIN.eyeR + 0.004).toFixed(3)};
  return 1.0 - smoothstep(-0.006, 0.003, d);
}
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
  let N = normalize(Ng + (vec3f(vnoise(i.rp * 7.0), vnoise(i.rp * 7.0 + 7.0), vnoise(i.rp * 7.0 + 13.0)) - 0.5) * 0.025);
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);
  let cream = creamAt(i.rp);

  // the gel: follow the bent ray to its exit, or to the cream layer if it gets there first
  let Rd = refract(-V, N, 1.0 / 1.45);
  let RdR = rotTo(Ng, normalize(i.rn), Rd);
  let dens = F.absorb.w * (0.9 + 0.2 * gum(i.rp + RdR * thick * 0.45));
  let sigma = F.absorb.rgb * dens;
  let toCream = select(1.0e4, (i.rp.y - ${BASE}) / max(-RdR.y, 1.0e-3), RdR.y < -0.02 && i.rp.y > ${BASE});
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (0.8 + 3.0 * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  var trans = vec3f(0.0);
  for (var k = 0; k < 6; k++) {
    let a = f32(k) * 1.0472 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.45 + 0.11 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.004, 2.2));
  }
  trans /= 6.0;
  let wrap = clamp((dot(N, KEY) + 0.55) / 1.55, 0.0, 1.0);
  let amb = env(N, 1.0) * 0.55;
  let inLight = vec3f(1.0, 0.97, 0.92) * 1.45 * wrap + amb;
  // the cream under the gel, lit by light that came down through it
  let creamBelow = F.pal[2].rgb * (0.5 + 0.55 * wrap) * exp(-sigma * 0.22) * exp(-sigma * toCream);
  let behind = mix(trans, creamBelow, step(toCream, thick));
  let scat = F.scatter.rgb * (1.0 - exp(-thick * 4.0 * F.scatter.w)) * inLight * 0.1;
  let back = pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 2.0) + 0.6 * pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  let thinT = exp(-sigma * (thick * 0.6 + 0.015));
  let glow = F.pal[1].rgb * thinT * back * (0.35 + 1.6 * pow(1.0 - NdV, 2.0)) * 0.5;
  let haze = F.pal[0].rgb * inLight * 0.03 * (1.0 - exp(-thick * 3.0)) * exp(-sigma * thick * 0.25);
  let gel = behind + scat + glow + haze;

  // the cream layer: dense and soft, the faintest tint where the gel meets it
  let creamFace = F.pal[2].rgb * (wrap * 0.9 + env(N, 1.0) * 0.45 + 0.12);
  let eye = eyeAt(i.rp);
  let body = mix(mix(gel, creamFace, cream), vec3f(0.012, 0.014, 0.022) * (wrap + 0.3), eye);

  // wet gloss over both
  let fres = 0.034 + 0.966 * pow(1.0 - NdV, 5.0);
  let spec = env(R, 0.02) * fres * 1.15 + vec3f(1.0, 0.97, 0.92) * (2.2 * ggx(N, V, KEY, 0.05) + 0.6 * ggx(N, V, KEY, 0.18)) * fres;
  let rim = mix(vec3f(1.0, 0.97, 0.93), F.pal[1].rgb, 0.4) * pow(1.0 - NdV, 3.0) * (0.35 + 0.65 * clamp(dot(N, RIM) * 0.5 + 0.5, 0.0, 1.0)) * 0.24 * (1.0 - cream);
  return present(body * (1.0 - fres) + spec + rim, i.pos.xy);
}
`;
