export type Rotation = 'follow' | 'fixed' | 'random';

export interface BrushPreset {
  id: string;
  name: string;
  hint: string;
  tip: (n: number, noise: Noise) => Float32Array;
  aspect: number;
  rotation: Rotation;
  angle: number;
  angleJitter: number;
  size: [number, number];
  pressureSize: number;
  speedThin: number;
  spacing: number;
  scatter: number;
  dabs: number;
  sizeJitter: number;
  water: number;
  load: number;
  flow: number;
  capacity: number;
  grain: number;
  wetRound: number;
}

export interface Brush extends Omit<BrushPreset, 'tip'> {
  tipSize: number;
  tipData: Uint8Array;
  tipMean: number;
}

export const TIP_SIZE = 160;
const DEG = Math.PI / 180;

export class Noise {
  private state: number;
  constructor(private seed: number) { this.state = seed | 0 || 1; }
  rnd(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  hash(ix: number, iy: number): number {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(this.seed, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  value(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = this.hash(ix, iy), b = this.hash(ix + 1, iy), c = this.hash(ix, iy + 1), d = this.hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  fbm(x: number, y: number, octaves = 4): number {
    let v = 0, amp = 0.5, sum = 0;
    for (let i = 0; i < octaves; i++) {
      v += amp * this.value(x, y); sum += amp;
      x = x * 2.03 + 17.1; y = y * 2.01 + 9.7; amp *= 0.5;
    }
    return v / sum;
  }
  worley(x: number, y: number): [number, number] {
    const ix = Math.floor(x), iy = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = cx + this.hash(cx, cy), py = cy + this.hash(cx + 71, cy + 13);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const soft = (r: number, hard: number) => 1 - smoothstep(hard, 1, r);

type TipFn = (u: number, v: number, r: number, ang: number) => number;
function tip(fn: TipFn): (n: number) => Float32Array {
  return n => {
    const out = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      const v = ((j + 0.5) / n) * 2 - 1;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n) * 2 - 1;
        out[j * n + i] = clamp01(fn(u, v, Math.hypot(u, v), Math.atan2(v, u)));
      }
    }
    return out;
  };
}

function hairs(segments: [number, number, number, number][], width: number, u: number, v: number) {
  let sum = 0;
  for (const [ax, ay, bx, by] of segments) {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = clamp01(((u - ax) * dx + (v - ay) * dy) / len2);
    const d = Math.hypot(u - ax - dx * t, v - ay - dy * t);
    sum += Math.exp(-(d * d) / (width * width));
  }
  return sum;
}

const BASE: Omit<BrushPreset, 'id' | 'name' | 'hint' | 'tip'> = {
  aspect: 1, rotation: 'fixed', angle: 0, angleJitter: 0,
  size: [0.014, 0.056], pressureSize: 1, speedThin: 0,
  spacing: 0.28, scatter: 0, dabs: 1, sizeJitter: 0,
  water: 1, load: 1, flow: 1, capacity: 1, grain: 0, wetRound: 0.6,
};
const define = (p: Partial<BrushPreset> & Pick<BrushPreset, 'id' | 'name' | 'hint' | 'tip'>): BrushPreset => ({ ...BASE, ...p });

export const BRUSH_PRESETS: BrushPreset[] = [
  define({
    id: 'round', name: 'Round', hint: 'Pointed round #8',
    tip: (n, N) => tip((u, v, r, ang) => {
      const rr = r * (1 + 0.08 * (N.fbm(ang * 0.8 + 3, r * 2.5) * 2 - 1));
      return soft(rr, 0.3) * (1 - 0.12 * N.fbm(u * 5, v * 5));
    })(n),
  }),
  define({
    id: 'detail', name: 'Detail', hint: 'Fine round #2',
    size: [0.003, 0.016], pressureSize: 0.9, water: 0.7, load: 1.15, capacity: 0.6, spacing: 0.26, wetRound: 0.8,
    tip: n => tip((_u, _v, r) => soft(r, 0.55))(n),
  }),
  define({
    id: 'flat', name: 'Flat', hint: 'Chisel flat brush',
    aspect: 0.26, rotation: 'fixed', angle: 40, angleJitter: 1.5,
    size: [0.022, 0.044], pressureSize: 1.4, spacing: 0.14, water: 0.8, wetRound: 0.25,
    tip: (n, N) => tip((u, v) => {
      const chisel = 0.06 * (N.fbm(v * 3 + 9, 2, 3) * 2 - 1);
      const ex = 1 - smoothstep(0.8, 0.98, Math.abs(u) + chisel);
      const ey = 1 - smoothstep(0.8, 1, Math.abs(v));
      const bristles = 1 - 0.4 * smoothstep(0.4, 0.75, N.fbm(u * 10, v * 0.7, 3));
      return ex * ey * bristles;
    })(n),
  }),
  define({
    id: 'hake', name: 'Hake', hint: 'Wide goat-hair wash',
    aspect: 0.2, rotation: 'follow', angle: 90, angleJitter: 2,
    size: [0.055, 0.09], pressureSize: 1.5, spacing: 0.1, water: 1.6, load: 0.75, flow: 1.2, capacity: 2.2, wetRound: 0.5,
    tip: (n, N) => tip((u, v) => {
      const ex = 1 - smoothstep(0.72, 1, Math.abs(u) + 0.1 * (N.fbm(v * 2 + 4, 1, 3) * 2 - 1));
      const ey = 1 - smoothstep(0.55, 1, Math.abs(v));
      const bristles = 1 - 0.65 * smoothstep(0.35, 0.7, N.fbm(u * 16, v * 0.9, 3));
      const gaps = smoothstep(0.25, 0.45, N.fbm(u * 7 + 20, v * 0.4, 2));
      return ex * ey * bristles * (0.4 + 0.6 * gaps);
    })(n),
  }),
  define({
    id: 'mop', name: 'Mop', hint: 'Squirrel mop for rich wet washes',
    size: [0.036, 0.088], pressureSize: 0.8, spacing: 0.24, water: 1.85, load: 0.85, flow: 1.35, capacity: 2.6, wetRound: 0.7,
    tip: (n, N) => tip((u, v, r, ang) => {
      const rr = r * (1 + 0.22 * (N.fbm(ang * 1.2, 1.7, 3) * 2 - 1));
      return Math.pow(soft(rr, 0.1), 1.3) * (1 - 0.25 * N.fbm(u * 3, v * 3));
    })(n),
  }),
  define({
    id: 'dry', name: 'Dry', hint: 'Dry brush skipping over paper tooth',
    aspect: 0.75, rotation: 'follow', angle: 0, angleJitter: 8,
    size: [0.015, 0.042], spacing: 0.12, water: 0.2, load: 1.1, capacity: 0.6, grain: 0.9, wetRound: 0,
    tip: (n, N) => tip((u, v, r) => {
      const holes = smoothstep(0.42, 0.62, N.fbm(u * 5.5, v * 5.5, 5));
      const streaks = 1 - 0.3 * N.fbm(u * 14, v * 1.2, 3);
      return soft(r, 0.2) * holes * streaks;
    })(n),
  }),
  define({
    id: 'fan', name: 'Fan', hint: 'Splayed hairs',
    aspect: 0.5, rotation: 'follow', angle: 90, angleJitter: 3,
    size: [0.022, 0.048], pressureSize: 1.2, spacing: 0.1, water: 0.3, load: 1.0, capacity: 0.8, grain: 0.5, wetRound: 0,
    tip: (n, N) => {
      const segs: [number, number, number, number][] = [];
      for (let i = 0; i < 13; i++) {
        const x = -0.95 + (1.9 * i) / 12 + (N.rnd() - 0.5) * 0.08;
        segs.push([x * 0.25, -1.3, x, 0.75 + N.rnd() * 0.25]);
      }
      return tip((u, v) => Math.min(1, hairs(segs, 0.045, u, v)) * (1 - smoothstep(0.85, 1, Math.abs(v))))(n);
    },
  }),
  define({
    id: 'sponge', name: 'Sponge', hint: 'Natural cellular sponge',
    rotation: 'random', size: [0.028, 0.056], pressureSize: 0.7, spacing: 0.55, scatter: 0.3, sizeJitter: 0.3,
    water: 0.5, load: 0.9, capacity: 1.2, grain: 0.45, wetRound: 0.1,
    tip: (n, N) => tip((u, v, r) => {
      const [f1, f2] = N.worley(u * 4.5, v * 4.5);
      return soft(r, 0.55) * smoothstep(0.03, 0.14, f2 - f1) * (0.55 + 0.45 * N.fbm(u * 7, v * 7, 3));
    })(n),
  }),
  define({
    id: 'spatter', name: 'Spatter', hint: 'Flicked droplets',
    rotation: 'random', size: [0.0035, 0.009], pressureSize: 0.8, spacing: 4.0, scatter: 10, dabs: 5, sizeJitter: 0.75,
    water: 1.3, load: 1.1, capacity: 1.5, wetRound: 0,
    tip: n => tip((_u, _v, r) => soft(r, 0.72))(n),
  }),
  define({
    id: 'sumi', name: 'Sumi', hint: 'Oriental calligraphic brush',
    size: [0.003, 0.058], pressureSize: 1.3, speedThin: 0.12, spacing: 0.22, water: 0.8, load: 1.3, capacity: 1.2, wetRound: 0.75,
    tip: (n, N) => tip((_u, _v, r, ang) => {
      const rr = r * (1 + 0.35 * (N.fbm(ang * 2.5 + r * 2, 1, 3) * 2 - 1));
      return Math.pow(soft(rr, 0.25), 1.5) * (1 - 0.3 * N.fbm(r * 8, ang * 3, 3));
    })(n),
  }),
];

const builtCache = new Map<string, Brush>();
export function buildBrush(preset: BrushPreset, seed = 7): Brush {
  const cached = builtCache.get(preset.id);
  if (cached) return cached;
  const { tip: source, ...rest } = preset;
  const tipSize = TIP_SIZE;
  const f = source(tipSize, new Noise(seed + hashString(preset.id)));
  const tipData = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) tipData[i] = Math.round(clamp01(f[i]) * 255);
  let sum = 0;
  for (let i = 0; i < tipData.length; i++) sum += tipData[i];
  const b: Brush = { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum / (255 * tipData.length)) };
  builtCache.set(preset.id, b);
  return b;
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export { DEG as DEGREES };
