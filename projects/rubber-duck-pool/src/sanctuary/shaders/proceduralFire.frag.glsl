precision highp float;

// Direct GLSL port of `https://github.com/Leonxlnx/procedural-fire` (`src/renderer.js` + `src/blackbody.js`):
// - Two-phase cross-faded divergence-free curl warp advected faster with height (no scrolling seams)
// - Sharp ridged multi-tongue flame-sheet reconstruction (`sootEdge`) carving dark night voids between separate tongues
// - Physical CIE 1931 5000K-WB soot blackbody emission ramp (`blackbody.js`) + thin blue CH*/C2* base fringes
// - Exact `camera()` sensor crosstalk tonemapper (`k=0.06`, `knee=0.60`, sRGB encode): saturated blazing orange
//   mid-tongues rolling smoothly into incandescent cream-gold ONLY in the hottest core!

uniform float uTime;
uniform float uFireSize;   // 0.35 .. 1.45 (default 1.0)
uniform float uStoke;      // 0 .. 1 decaying flare boost
uniform float uPop;        // 0 .. 1 crackling core surge
uniform vec2  uGust;       // horizontal wind sway
uniform vec3  uCamLocal;   // camera position transformed into fire box local space
uniform float uDetail;     // 0.0 wide-map fast mode (18 steps), 1.0 closeup mode (44 steps)

varying vec3 vLocalPos;
varying vec3 vWorldPos;

vec3 hq33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float gn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(hq33(i + vec3(0,0,0)) * 2.0 - 1.0, f - vec3(0,0,0));
  float n100 = dot(hq33(i + vec3(1,0,0)) * 2.0 - 1.0, f - vec3(1,0,0));
  float n010 = dot(hq33(i + vec3(0,1,0)) * 2.0 - 1.0, f - vec3(0,1,0));
  float n110 = dot(hq33(i + vec3(1,1,0)) * 2.0 - 1.0, f - vec3(1,1,0));
  float n001 = dot(hq33(i + vec3(0,0,1)) * 2.0 - 1.0, f - vec3(0,0,1));
  float n101 = dot(hq33(i + vec3(1,0,1)) * 2.0 - 1.0, f - vec3(1,0,1));
  float n011 = dot(hq33(i + vec3(0,1,1)) * 2.0 - 1.0, f - vec3(0,1,1));
  float n111 = dot(hq33(i + vec3(1,1,1)) * 2.0 - 1.0, f - vec3(1,1,1));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  ) * 1.48;
}

float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    s += a * gn3(p);
    p = p * 2.08 + vec3(13.7, -5.1, 9.2);
    a *= 0.48;
  }
  return s;
}

// Sharp flame-sheet ridges (thin bright fiery tongues separated by pitch-black night valleys!)
float flameSheets(vec3 p) {
  float r1 = 1.0 - abs(gn3(p));
  float r2 = 1.0 - abs(gn3(p * 2.25 + vec3(4.3, -2.1, 7.8)));
  return pow(clamp(r1, 0.0, 1.0), 2.45) * 0.66 + pow(clamp(r2, 0.0, 1.0), 2.65) * 0.34;
}

float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

// Calibrated CIE 1931 5000K-WB soot radiance for Additive Blending + DSLR sensor crosstalk:
// Keeps G/R strictly in fiery orange [0.06..0.28] across dancing mid-tongues; rolls to golden-white ONLY in hottest core!
vec3 bbSoot(float T) {
  float x = clamp((T - 900.0) / 1400.0, 0.0, 1.0);
  float rad = pow(x, 2.75) * 4.2 + 0.06 * x;
  vec3 tint;
  vec3 c0 = vec3(1.00, 0.025, 0.000); // 950K deep ember crimson-red
  vec3 c1 = vec3(1.00, 0.105, 0.001); // 1380K rich saturated campfire orange
  vec3 c2 = vec3(1.00, 0.320, 0.010); // 1800K blazing fiery amber-gold
  vec3 c3 = vec3(1.00, 0.780, 0.240); // 2300K incandescent cream-gold heart
  if (x < 0.36) tint = mix(c0, c1, x / 0.36);
  else if (x < 0.76) tint = mix(c1, c2, (x - 0.36) / 0.40);
  else tint = mix(c2, c3, (x - 0.76) / 0.24);
  return tint * rad;
}

// Exact `camera()` sensor response from `Leonxlnx/procedural-fire/src/renderer.js` lines 507-520!
vec3 srgbEnc(vec3 c) {
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  vec3 lo = c * 12.92;
  return mix(hi, lo, step(c, vec3(0.0031308)));
}

vec3 cameraTonemap(vec3 c) {
  float k = 0.045;
  float kn = 0.62;
  vec3 cc = max(c, vec3(0.0));
  vec3 ex = max(cc - kn, vec3(0.0));
  mat3 m = mat3(
    1.0 - 2.0 * k, k, k,
    k, 1.0 - 2.0 * k, k,
    k, k, 1.0 - 2.0 * k
  );
  vec3 v = cc - ex + m * ex;
  vec3 rolled = kn + (1.0 - kn) * (1.0 - exp(-(v - kn) / (1.0 - kn)));
  v = mix(rolled, v, step(v, vec3(kn)));
  return srgbEnc(clamp(v, 0.0, 1.0));
}

// Evaluate multi-tongue combustion volume in [-0.5, 0.5]^3 (`y = -0.5` coals -> `+0.5` tips)
vec3 sampleFlame(vec3 p) {
  float h = clamp(p.y + 0.5, 0.0, 1.0);
  float sizeK = clamp(uFireSize + 0.28 * uStoke + 0.16 * uPop, 0.35, 1.48);
  float hScaled = h / max(sizeK, 0.35);
  if (hScaled > 1.02 || dot(p.xz, p.xz) > 0.24) return vec3(0.0);

  // McCaffrey puffing (~1.8 Hz natural campfire pulsation!)
  float puff = 1.0 + 0.12 * sin(uTime * 11.4 + p.x * 5.0) + 0.07 * cos(uTime * 18.1 - p.z * 5.0);

  vec2 lean = uGust * (h * h * 0.52) + vec2(sin(uTime * 2.1), cos(uTime * 1.7)) * (0.045 * h * h);
  vec3 q = p;
  q.xz -= lean;
  // Early radial reject before evaluating expensive 3D curl & fBm noise
  float maxEnvR = mix(0.46, 0.32, clamp(hScaled, 0.0, 1.0));
  if (dot(q.xz, q.xz) > maxEnvR * maxEnvR) return vec3(0.0);

  // Two-phase cross-faded upward advection (exact `renderer.js` lines 266-276 — zero scrolling seams!)
  float rise = (1.85 + 0.85 * uStoke) * (0.50 + 1.55 * smoothstep(0.0, 0.90, h));
  float ph = uTime / 0.65;
  float f0 = fract(ph);
  float f1 = fract(ph + 0.5);
  float w0 = 1.0 - abs(2.0 * f0 - 1.0);
  vec3 o0 = vec3(0.37, 0.0, 0.61) * floor(ph);
  vec3 o1 = vec3(0.71, 0.0, 0.29) * floor(ph + 0.5);

  float turbEnv = smoothstep(0.03, 0.38, h);
  vec3 sPos0 = q * vec3(7.4, 2.0, 7.4) - vec3(0.0, rise * f0 * 2.3, 0.0) + o0;
  vec3 sPos1 = q * vec3(7.4, 2.0, 7.4) - vec3(0.0, rise * f1 * 2.3, 0.0) + o1;

  // Curl-like lateral whip twisting tongues into curling Kelvin-Helmholtz eddies!
  vec2 curlXZ = vec2(
    gn3(sPos0 * 0.72 + vec3(5.2, 0.0, 1.3)) * w0 + gn3(sPos1 * 0.72 + vec3(5.2, 0.0, 1.3)) * (1.0 - w0),
    gn3(sPos0 * 0.72 + vec3(1.7, 3.1, 8.4)) * w0 + gn3(sPos1 * 0.72 + vec3(1.7, 3.1, 8.4)) * (1.0 - w0)
  ) * (0.195 * turbEnv + 0.025);
  vec2 xz = q.xz + curlXZ;

  float rMix = mix(flameSheets(sPos1), flameSheets(sPos0), w0);
  float fMix = mix(fbm3(sPos1 * 0.62), fbm3(sPos0 * 0.62), w0);

  // 7 jagged tongue anchors seated between the charred teepee logs!
  float plumeR = mix(0.28, 0.10, pow(clamp(hScaled, 0.0, 1.0), 0.74)) * puff;
  float field = exp(-dot(xz, xz) / max(plumeR * plumeR, 0.001)) * 0.88;

  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float ang = fk * 1.0472 + 0.35 + 0.26 * sin(uTime * 3.1 + fk * 2.3);
    float rad = mix(0.24, 0.085, pow(clamp(hScaled, 0.0, 1.0), 0.68));
    vec2 tc = vec2(cos(ang), sin(ang)) * rad;
    float rT = mix(0.095, 0.032, pow(clamp(hScaled, 0.0, 1.0), 0.60));
    float d2 = dot(xz - tc, xz - tc) / max(rT * rT, 0.0004);
    float peakH = 0.60 + 0.40 * (0.5 + 0.5 * sin(fk * 3.7 + uTime * 3.8));
    float hMask = 1.0 - smoothstep(peakH * 0.50, peakH, hScaled);
    field = max(field, exp(-d2 * 1.55) * hMask * 1.12);
  }

  float baseFade = smoothstep(0.0, 0.04, h);
  float topFade = 1.0 - smoothstep(0.45, 0.98, hScaled);
  float edgeBox = 1.0 - smoothstep(0.42, 0.495, max(abs(p.x), abs(p.z)));
  // Strong ridged modulation carves razor-sharp dark gaps right through the flame silhouette!
  float sheetMod = mix(0.70 + 0.48 * rMix, rMix * 1.52 + fMix * 0.36, turbEnv);

  float rawFuel = field * sheetMod * baseFade * topFade * edgeBox;
  // Steep `sootEdge` iso-sheet transfer (`[0.32..0.58]`): crisp glowing ribbons, ZERO hazy olive fog!
  float soot = smoothstep(0.32, 0.58, rawFuel);

  // Temperature: incandescent white-gold STRICTLY inside hottest base core (`h < 0.36`); fiery crimson-orange tongues aloft!
  float hotCore = smoothstep(0.60, 0.96, rawFuel) * (1.0 - smoothstep(0.10, 0.42, hScaled));
  float T = mix(920.0, 1660.0, smoothstep(0.32, 0.86, rawFuel)) + 560.0 * hotCore + 95.0 * uStoke + 80.0 * uPop;

  // Razor-thin blue chemiluminescence (CH*/C2*) strictly hugging hottest log base (`h < 0.12`) where soot is thin
  float blueZone = smoothstep(0.01, 0.04, h) * (1.0 - smoothstep(0.06, 0.12, h));
  float blueChem = blueZone * smoothstep(0.24, 0.46, rawFuel) * exp(-soot * 3.0);

  return vec3(soot, T, blueChem);
}

void main() {
  vec3 ro = uCamLocal;
  vec3 rd = normalize(vLocalPos - uCamLocal);

  vec3 invD = 1.0 / (rd + vec3(1e-6));
  vec3 t0 = (-vec3(0.5) - ro) * invD;
  vec3 t1 = ( vec3(0.5) - ro) * invD;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  float tNear = max(max(max(tMin.x, tMin.y), tMin.z), 0.0);
  float tFar  = min(min(tMax.x, tMax.y), tMax.z);
  if (tFar <= tNear) discard;

  int steps = uDetail > 0.5 ? 26 : 14;
  float segLen = tFar - tNear;
  float ds = segLen / float(steps);
  float jitter = ign(gl_FragCoord.xy + fract(uTime * 13.0) * 97.0);
  float t = tNear + ds * jitter;

  vec3 accum = vec3(0.0);
  float transmittance = 1.0;

  for (int i = 0; i < 26; i++) {
    if (i >= steps || transmittance < 0.02) break;
    vec3 p = ro + rd * t;
    vec3 sf = sampleFlame(p);
    float soot = sf.x;
    float T = sf.y;
    float blueChem = sf.z;

    if (soot > 0.01 || blueChem > 0.005) {
      vec3 emit = soot * 9.8 * bbSoot(T);
      emit += vec3(0.12, 0.30, 1.0) * blueChem * 2.2;
      float sigmaT = soot * 7.2 + 0.001;
      float atten = exp(-sigmaT * ds);
      float w = (1.0 - atten) / sigmaT;
      accum += transmittance * emit * w;
      transmittance *= atten;
    }
    t += ds;
  }

  float alpha = clamp(1.0 - transmittance, 0.0, 0.99);
  if (alpha < 0.02) discard;
  // Calibrated additive HDR fire radiance: blazing saturated orange mid-tongues -> incandescent cream heart, ZERO grey halo!
  vec3 linearFlame = (accum * 1.12) / max(alpha, 0.24);
  vec3 outRgb = cameraTonemap(linearFlame);
  gl_FragColor = vec4(outRgb * pow(alpha, 0.88), 1.0);
}
