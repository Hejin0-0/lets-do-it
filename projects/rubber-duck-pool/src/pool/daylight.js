// The time of day: from the hour, where the light comes from (the sun by day, the moon by night), its colour, the
// sky's, the haze's and the sea's colours, how far into night it is, the exposure and the pools' glow. Colours are
// keyed through the day and blended between keys; a pure function of the hour, so the day replays exactly.
import { srgbToLinear as lin } from '@lid/diorama/math.js';

/** hour, sky (overhead), haze (the horizon), sea, shallows, how far into night (0..1), exposure. */
const KEYS = [
  [0, '#0a1430', '#1a2648', '#05152a', '#0c3448', 1, 1.3],
  [4.8, '#0e1a3c', '#2a3058', '#06182e', '#0e3a50', 1, 1.3],
  [5.6, '#2a3a78', '#8a6a90', '#0e2c52', '#1e5a78', 0.6, 1.2],
  [6.3, '#5a7cc4', '#f4b48c', '#1a4e80', '#2a8ea8', 0.08, 1.05],
  [8, '#3f86cc', '#d4e6ee', '#0b5a8c', '#2ab0be', 0, 1],
  [16.2, '#3f86cc', '#d4e6ee', '#0b5a8c', '#2ab0be', 0, 1],
  [17.4, '#4570b4', '#f4bc84', '#14507e', '#2aa0b0', 0.03, 1.02],
  [18, '#3e4a8c', '#f8a24e', '#1a3a68', '#2a7898', 0.2, 1.08],
  [18.9, '#1c2258', '#8a5a52', '#0a2244', '#14506a', 0.75, 1.2],
  [20, '#0a1430', '#1a2648', '#05152a', '#0c3448', 1, 1.3],
  [24, '#0a1430', '#1a2648', '#05152a', '#0c3448', 1, 1.3],
].map(([h, ...k]) => [h, ...k.slice(0, 4).map(lin), k[4], k[5]]);

/** The look (post.js) keyed the same way: hour, exposure (stops over the key's), contrast, saturation, white balance,
 * the shadows' and the highlights' tints, bloom, its threshold, vignette. Day is crisp and a touch warm; the low sun
 * warms the lights and cools the shade; night is blue, its shadows bluer, and only what glows blooms. */
const LOOKS = [
  [0, -0.7, 1.06, 0.75, [0.9, 0.97, 1.12], [0.82, 0.94, 1.18], [1, 1, 1], 0.32, 0.55, 0.42],
  [4.8, -0.7, 1.06, 0.75, [0.9, 0.97, 1.12], [0.82, 0.94, 1.18], [1, 1, 1], 0.32, 0.55, 0.42],
  [6.3, 0, 1.06, 0.95, [1.04, 0.98, 0.95], [0.9, 0.96, 1.12], [1.08, 0.98, 0.9], 0.2, 0.85, 0.3],
  [8, 0, 1.06, 1, [1.02, 1, 0.97], [0.95, 0.99, 1.06], [1.03, 1, 0.96], 0.1, 1, 0.24],
  [16.2, 0, 1.06, 1, [1.02, 1, 0.97], [0.95, 0.99, 1.06], [1.03, 1, 0.96], 0.1, 1, 0.24],
  [17.4, 0, 1.1, 1.04, [1.04, 1, 0.92], [0.9, 0.95, 1.08], [1.08, 1, 0.86], 0.22, 0.85, 0.3],
  [18.9, -0.4, 1.08, 0.92, [1, 0.97, 1], [0.86, 0.92, 1.1], [1.06, 0.98, 0.92], 0.28, 0.65, 0.36],
  [20, -0.7, 1.06, 0.75, [0.9, 0.97, 1.12], [0.82, 0.94, 1.18], [1, 1, 1], 0.32, 0.55, 0.42],
  [24, -0.7, 1.06, 0.75, [0.9, 0.97, 1.12], [0.82, 0.94, 1.18], [1, 1, 1], 0.32, 0.55, 0.42],
];
const EXPOSURE = 1.6;   // the filmic curve's mid grey sits lower than the plain composite's: this brings it level
const lerp = (a, b, t) => (Array.isArray(a) ? mix(a, b, t) : a + (b - a) * t);

const NOON = (() => { const d = [-0.35, 0.82, 0.45], l = Math.hypot(...d); return d.map((v) => v / l); })();
const NOON_EL = Math.asin(NOON[1]), NOON_AZ = Math.atan2(NOON[2], NOON[0]);
const SUN_TINT = [1, 1, 1], DAWN_TINT = [1, 0.72, 0.42], MOON_TINT = [0.11, 0.13, 0.22];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** A body's direction across the sky: rising at rise, highest 6 hours later at elevation pk, setting 12 hours after rising. */
function arc(hour, rise, pk) {
  const t = (hour - rise) / 12, el = pk * Math.sin(Math.PI * t), az = NOON_AZ + (t - 0.5) * 2.8;
  return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
}

/** hour (0 to 24) -> { dir, tint, sky, haze, sea, shallow, night, exposure, glow, lst, look }. dir and tint are the light that
 * casts the shadows: the sun while it is up, the moon once the sun is well down; lst is the sidereal time (radians), an
 * autumn night's (1.9 h at midnight): the stars turn once with the day; look: the finishing pass's (LOOKS). */
export function daylight(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = ss(0, 1, (h - a[0]) / (b[0] - a[0]));
  const [sky, haze, sea, shallow] = [1, 2, 3, 4].map((k) => mix(a[k], b[k], t));
  const night = a[5] + (b[5] - a[5]) * t, exposure = a[6] + (b[6] - a[6]) * t;
  const sun = arc(h, 6, NOON_EL), moon = arc((h + 12) % 24, 6, 0.7);
  const sunK = ss(-0.02, 0.16, sun[1]), moonK = ss(-0.02, 0.18, moon[1]) * night;
  const low = 1 - ss(0.1, 0.45, sun[1]);   // a low sun is warm
  const useSun = sunK >= moonK * 0.4;
  const dir = useSun ? sun : moon, tint = useSun ? mix(SUN_TINT, DAWN_TINT, low).map((v) => v * sunK) : MOON_TINT.map((v) => v * moonK);
  const glow = mix([0.08, 0.3, 0.42], [0.04, 0.28, 0.46], night);   // the pools' lights come on at night
  const lst = (((h + 1.9) % 24) / 24) * Math.PI * 2;
  let j = 0; while (j < LOOKS.length - 2 && LOOKS[j + 1][0] <= h) j++;
  const la = LOOKS[j], lb = LOOKS[j + 1], [ev, contrast, saturation, white, shadows, highlights, bloom, threshold, vignette] = la.slice(1).map((v, k) => lerp(v, lb[k + 1], ss(0, 1, (h - la[0]) / (lb[0] - la[0]))));
  const look = { exposure: exposure * EXPOSURE * 2 ** ev, contrast, saturation, white, shadows, highlights, bloom, threshold, vignette, ao: 0.85, grain: 0.035 };
  return { dir, tint, sky, haze, sea, shallow, night, exposure, glow, lst, look };
}
