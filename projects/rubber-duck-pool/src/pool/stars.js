// The night sky: the bright stars of a dozen constellations (right ascension in hours and minutes, declination in
// degrees, magnitude) and the lines of their figures, over a faint scatter of round stars, as WGSL for the backdrop.
// The sky turns with the hour about its pole, 35° up in the north (the courtyard's back, -z).
const CONSTELLATIONS = {
  'Ursa Major': { stars: [[11, 3.7, 61.75, 1.8], [11, 1.8, 56.38, 2.4], [11, 53.8, 53.69, 2.4], [12, 15.4, 57.03, 3.3], [12, 54.0, 55.96, 1.8], [13, 23.9, 54.93, 2.2], [13, 47.5, 49.31, 1.9]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  'Ursa Minor': { stars: [[2, 31.8, 89.26, 2.0], [17, 32.2, 86.59, 4.4], [16, 46.0, 82.04, 4.2], [15, 44.1, 77.79, 4.3], [16, 17.5, 75.76, 5.0], [15, 20.7, 71.83, 3.0], [14, 50.7, 74.16, 2.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  Cassiopeia: { stars: [[0, 9.2, 59.15, 2.3], [0, 40.5, 56.54, 2.2], [0, 56.7, 60.72, 2.4], [1, 25.8, 60.24, 2.7], [1, 54.4, 63.67, 3.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  Pegasus: { stars: [[23, 4.8, 15.21, 2.5], [23, 3.8, 28.08, 2.4], [0, 8.4, 29.09, 2.1], [0, 13.2, 15.18, 2.8], [22, 41.5, 10.83, 3.4], [22, 10.0, 6.2, 3.5], [21, 44.2, 9.88, 2.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5], [5, 6]] },
  Andromeda: { stars: [[0, 8.4, 29.09, 2.1], [0, 39.3, 30.86, 3.3], [1, 9.7, 35.62, 2.1], [2, 3.9, 42.33, 2.1]], lines: [[0, 1], [1, 2], [2, 3]] },
  Cygnus: { stars: [[20, 41.4, 45.28, 1.25], [20, 22.2, 40.26, 2.2], [20, 46.2, 33.97, 2.5], [19, 45.0, 45.13, 2.9], [19, 30.7, 27.96, 3.1]], lines: [[0, 1], [1, 4], [3, 1], [1, 2]] },
  Lyra: { stars: [[18, 36.9, 38.78, 0.0], [18, 44.8, 37.6, 4.3], [18, 50.1, 33.36, 3.5], [18, 59.0, 32.69, 3.3], [18, 54.5, 36.9, 4.3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]] },
  Aquila: { stars: [[19, 50.8, 8.87, 0.8], [19, 46.3, 10.61, 2.7], [19, 55.3, 6.41, 3.7]], lines: [[1, 0], [0, 2]] },
  Scorpius: { stars: [[16, 5.4, -19.81, 2.6], [16, 0.3, -22.62, 2.3], [15, 58.9, -26.11, 2.9], [16, 21.2, -25.59, 2.9], [16, 29.4, -26.43, 1.0], [16, 35.9, -28.22, 2.8],
    [16, 50.2, -34.29, 2.3], [16, 51.9, -38.05, 3.0], [16, 54.6, -42.36, 3.6], [17, 12.2, -43.24, 3.3], [17, 37.3, -43.0, 1.9], [17, 47.6, -40.13, 3.0], [17, 42.5, -39.03, 2.4], [17, 33.6, -37.1, 1.6]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]] },
  Leo: { stars: [[10, 8.4, 11.97, 1.4], [10, 7.3, 16.76, 3.5], [10, 20.0, 19.84, 2.0], [10, 16.7, 23.42, 3.4], [9, 52.8, 26.0, 3.9], [9, 45.9, 23.77, 3.0], [11, 49.1, 14.57, 2.1], [11, 14.1, 20.52, 2.6], [11, 14.2, 15.43, 3.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 7], [7, 6], [6, 8], [8, 0]] },
  Orion: { stars: [[5, 55.2, 7.41, 0.5], [5, 25.1, 6.35, 1.6], [5, 40.8, -1.94, 1.8], [5, 36.2, -1.2, 1.7], [5, 32.0, -0.3, 2.2], [5, 47.8, -9.67, 2.1], [5, 14.5, -8.2, 0.1], [5, 35.1, 9.93, 3.4]],
    lines: [[7, 0], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  Taurus: { stars: [[4, 35.9, 16.51, 0.9], [4, 28.6, 19.18, 3.5], [4, 19.8, 15.63, 3.6], [4, 22.9, 17.54, 3.8], [5, 26.3, 28.61, 1.7], [5, 37.6, 21.14, 3.0], [3, 47.5, 24.11, 2.9]],
    lines: [[2, 3], [3, 1], [1, 4], [2, 0], [0, 5]] },
  Bootes: { stars: [[14, 15.7, 19.18, 0.0]], lines: [] },
};

/** The stars ([x, y, z, magnitude]: unit vectors, x toward right ascension 0, z the pole) and the figures' lines
 * (pairs of indices into them). */
export function constellations() {
  const stars = [], lines = [];
  for (const c of Object.values(CONSTELLATIONS)) {
    const at = stars.length;
    for (const [h, m, dec, mag] of c.stars) {
      const ra = ((h + m / 60) / 24) * Math.PI * 2, d = (dec * Math.PI) / 180;
      stars.push([Math.cos(d) * Math.cos(ra), Math.cos(d) * Math.sin(ra), Math.sin(d), mag]);
    }
    for (const [a, b] of c.lines) lines.push([at + a, at + b]);
  }
  return { stars, lines };
}

const f = (v) => v.toFixed(5);
/** WGSL: starSky(rd, lst, t), the stars' light along the world direction rd at local sidereal time lst (radians);
 * t twinkles them. Needs hash21. */
export function starsWGSL() {
  const { stars, lines } = constellations();
  return /* wgsl */ `
const LAT: f32 = 0.6109;   // 35° north
const CSTARS: array<vec4f, ${stars.length}> = array<vec4f, ${stars.length}>(${stars.map((s) => `vec4f(${s.map(f).join(', ')})`).join(', ')});
const CLINES: array<vec2u, ${lines.length}> = array<vec2u, ${lines.length}>(${lines.map(([a, b]) => `vec2u(${a}u, ${b}u)`).join(', ')});
// a world direction in the sky's own frame at sidereal time lst: north is -z, west -x
fn skyFrame(rd: vec3f, lst: f32) -> vec3f {
  let xh = dot(rd, vec3f(0.0, cos(LAT), sin(LAT)));   // the equator due south
  let yh = -rd.x;                                     // the equator due west
  let zh = dot(rd, vec3f(0.0, sin(LAT), -cos(LAT)));  // the pole
  return vec3f(cos(lst) * xh + sin(lst) * yh, sin(lst) * xh - cos(lst) * yh, zh);
}
fn starSky(rd: vec3f, lst: f32, t: f32) -> vec3f {
  let d = skyFrame(rd, lst);
  var c = vec3f(0.0);
  // the faint scatter: a star in some cells of a grid through the sky, drawn only in its own cell (no half stars)
  let g = d * 110.0;
  let cell = floor(g);
  let h = hash21(cell.xy + cell.z * 17.31);
  if (h > 0.93) {
    let sp = normalize(cell + 0.5 + (vec3f(hash21(cell.xy + 3.1), hash21(cell.yz + 7.7), hash21(cell.zx + 1.3)) - 0.5) * 0.9);
    if (all(floor(sp * 110.0) == cell)) {
      let br = (h - 0.93) / 0.07;
      c += vec3f(0.85, 0.9, 1.0) * smoothstep(0.0011 + 0.0007 * br, 0.0, length(sp - d)) * (0.12 + 0.55 * br * br) * (0.7 + 0.3 * sin(t * 2.7 + h * 70.0));
    }
  }
  // the constellations' stars, by their magnitudes, a soft glow round the bright ones
  for (var i = 0u; i < ${stars.length}u; i++) {
    let s = CSTARS[i];
    let a = length(s.xyz - d);
    let br = clamp(1.0 - s.w / 5.0, 0.12, 1.0);
    c += vec3f(1.0, 0.96, 0.88) * (smoothstep(0.0014 + 0.0022 * br, 0.0, a) * (0.6 + 1.6 * br) + 0.25 * br * smoothstep(0.012 * br, 0.0, a));
  }
  // the figures: faint lines along the arcs between their stars, stopping short of each star
  for (var i = 0u; i < ${lines.length}u; i++) {
    let a = CSTARS[CLINES[i].x].xyz;
    let b = CSTARS[CLINES[i].y].xyz;
    let ab = dot(a, b);
    let da = dot(d, a);
    let db = dot(d, b);
    if (da > ab && db > ab && max(da, db) < 0.99994) {
      c += vec3f(0.55, 0.68, 0.95) * smoothstep(0.0012, 0.0, abs(dot(d, normalize(cross(a, b))))) * 0.2;
    }
  }
  return c;
}
`;
}
