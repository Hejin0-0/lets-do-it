// Embedded GPU Fluid & Spectral Watercolor Engine adapted directly from `msurguy/watercolor-playground`
// Runs on a dedicated offscreen WebGL2 canvas bound directly onto the 3D Atelier easel canvas!
// Automatically sleeps when paint is dry (0ms GPU cost when idle).

import { BRUSH_PRESETS, buildBrush, type Brush } from './brushes';
import { GL, type DoubleTarget, type Format, type Program, type Rect, type Target } from './gl';
import { History } from './history';
import { DEFAULT_PAPER, linearRGB, type PaperPreset } from './papers';
import * as S from './shaders';
import { pigmentFromHex, type Pigment } from './spectral';

export type Tool = 'brush' | 'water' | 'pen' | 'lift';

export interface Params {
  size: number;
  water: number;
  load: number;
  flow: number;
  bleed: number;
  dry: number;
  edge: number;
  granulation: number;
}

export const DEFAULT_PARAMS: Params = {
  size: 0.52, water: 0.65, load: 0.55, flow: 0.50, bleed: 0.55, dry: 0.38, edge: 0.55, granulation: 0.48,
};

interface Sample { x: number; y: number; p: number; t: number }
interface Stroke {
  tool: Tool;
  started: boolean;
  ending: boolean;
  x: number; y: number;
  cx: number; cy: number;
  pr: number;
  t: number;
  speed: number;
  simPressure: number;
  carry: number;
  travelled: number;
  moved: boolean;
  dx: number; dy: number;
  angle: number;
}

const DEG = Math.PI / 180;
const HALF_FLOAT_RG: Format = { internal: WebGL2RenderingContext.RG16F, format: WebGL2RenderingContext.RG, type: WebGL2RenderingContext.HALF_FLOAT };
const HALF_FLOAT_R: Format = { internal: WebGL2RenderingContext.R16F, format: WebGL2RenderingContext.RED, type: WebGL2RenderingContext.HALF_FLOAT };
const HALF_FLOAT_RGBA: Format = { internal: WebGL2RenderingContext.RGBA16F, format: WebGL2RenderingContext.RGBA, type: WebGL2RenderingContext.HALF_FLOAT };
const RGBA8: Format = { internal: WebGL2RenderingContext.RGBA8, format: WebGL2RenderingContext.RGBA, type: WebGL2RenderingContext.UNSIGNED_BYTE };

const SIM_BASE = 160;
const PRESSURE_ITERATIONS = 14;
const FIX_DURATION = 1.1;
const WET_THRESHOLD = 0.004;
const MASK_BLOCK = 16;
const MASK_EVERY = 10;
const MASK_MARGIN = MASK_BLOCK + 8;
const PROTECT_MARGIN = 22;
const PAPER_UNITS = 1000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const union = (a: Rect | null, b: Rect): Rect =>
  a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b };

export class WatercolorCanvasEngine {
  readonly canvas: HTMLCanvasElement;
  params: Params = { ...DEFAULT_PARAMS };
  tool: Tool = 'brush';
  pigment: Pigment = pigmentFromHex('#f6d409');
  brush: Brush = buildBrush(BRUSH_PRESETS[0]);

  private gl: WebGL2RenderingContext;
  private g: GL;
  private programs: Record<string, Program>;
  private dw: number;
  private dh: number;
  private tipTextures = new Map<string, WebGLTexture>();
  private paperPreset: PaperPreset = DEFAULT_PAPER;
  private paperSeed = 0.37;
  private paperStrength = 1.0;
  private refTex: WebGLTexture | null = null;
  private refOpacity = 0.0;

  private velocity!: DoubleTarget;
  private pressure!: DoubleTarget;
  private divergence!: Target;
  private curl!: Target;
  private ink!: DoubleTarget;
  private fixed!: Target;
  private wet!: DoubleTarget;
  private paper!: Target;
  private wetMask!: Target;
  private maskPixels = new Uint8Array(0);
  private maskCounter = 0;
  private history!: History;

  private active: Rect | null = null;
  private painted: Rect | null = null;
  private rngState = 0x9e3779b9;
  private rand(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private everPainted: Rect | null = null;
  private dirty: Rect | null = null;
  private dirtyAll = true;
  private lastWet = -Infinity;
  private wetPeak = 0;
  private minAwakeUntil = 0;
  private fixTimer = 0;
  private flowSpeed = 0;
  private growCarry = 0;
  private brushNow = { x: 0, y: 0, r: 0 };
  private lastDir: [number, number] = [1, 0];
  private lastAngle = 0;

  private stroke: Stroke | null = null;
  private queue: Sample[] = [];
  private raf = 0;
  private lastFrame = 0;
  private onRender?: () => void;

  constructor(width = 800, height = 600, onRender?: () => void) {
    this.dw = width;
    this.dh = height;
    this.onRender = onRender;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable for WatercolorEngine');
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
      throw new Error('EXT_color_buffer_float unavailable');
    }
    this.gl = gl;
    this.g = new GL(gl);
    gl.disable(gl.BLEND);

    this.programs = {
      splat: this.g.program(S.splatFS),
      stamp: this.g.program(S.stampFS),
      advectVelocity: this.g.program(S.advectVelocityFS),
      divergence: this.g.program(S.divergenceFS),
      pressure: this.g.program(S.pressureFS),
      gradient: this.g.program(S.gradientSubtractFS),
      curl: this.g.program(S.curlFS),
      vorticity: this.g.program(S.vorticityFS),
      scale: this.g.program(S.scaleFS),
      advectWet: this.g.program(S.advectWetFS),
      wetMask: this.g.program(S.wetMaskFS),
      advectInk: this.g.program(S.advectInkFS),
      settle: this.g.program(S.settleFS),
      bleach: this.g.program(S.bleachFS),
      lift: this.g.program(S.liftFS),
      paperField: this.g.program(S.paperFieldFS),
      paperLight: this.g.program(S.paperLightFS),
      display: this.g.program(S.displayFS),
    };

    const ar = this.dw / this.dh;
    const simW = Math.round(SIM_BASE * ar), simH = SIM_BASE;
    this.velocity = this.g.double(simW, simH, [HALF_FLOAT_RG], gl.LINEAR);
    this.pressure = this.g.double(simW, simH, [HALF_FLOAT_R], gl.NEAREST);
    this.divergence = this.g.target(simW, simH, [HALF_FLOAT_R], gl.NEAREST);
    this.curl = this.g.target(simW, simH, [HALF_FLOAT_R], gl.NEAREST);
    this.ink = this.g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
    this.fixed = this.g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
    this.wet = this.g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    this.paper = this.g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
    this.wetMask = this.g.target(Math.ceil(this.dw / MASK_BLOCK), Math.ceil(this.dh / MASK_BLOCK), [RGBA8], gl.NEAREST);
    this.maskPixels = new Uint8Array(this.wetMask.w * this.wetMask.h * 4);
    this.history = new History(this.g, this.dw, this.dh, [
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R], documents: 2 },
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 },
    ]);

    this.drawPaper();
    this.render();
  }

  /* ------------------------------------------------------------- Public API */

  setTool(t: Tool) { this.tool = t; }
  setPigment(p: Pigment) { this.pigment = p; }
  setBrush(b: Brush) {
    this.brush = b;
    this.lastAngle = b.rotation === 'fixed' ? b.angle * DEG : b.rotation === 'follow' ? Math.atan2(this.lastDir[1], this.lastDir[0]) + b.angle * DEG : 0;
  }
  setParams(p: Partial<Params>) { Object.assign(this.params, p); }
  setPaper(p: PaperPreset) {
    if (p === this.paperPreset) return;
    this.paperPreset = p;
    this.drawPaper();
    this.dirtyAll = true;
    this.schedule();
  }

  setReferenceImage(img: HTMLImageElement | HTMLCanvasElement | null, opacity = 0.85) {
    const { gl } = this;
    if (this.refTex) { gl.deleteTexture(this.refTex); this.refTex = null; }
    if (img) {
      const tex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.refTex = tex;
      this.refOpacity = opacity;
    } else {
      this.refOpacity = 0;
    }
    this.dirtyAll = true;
    this.render();
  }

  setReferenceOpacity(v: number) {
    this.refOpacity = clamp(v, 0, 1);
    this.dirtyAll = true;
    this.render();
  }
  get referenceOpacity() { return this.refOpacity; }

  /** Direct 3D-UV pointer input (u: 0..1 left-to-right, v: 0..1 bottom-to-top) */
  pointerDownUv(u: number, v: number, pressure = -1, timeMs?: number) {
    if (this.stroke) this.stroke.ending = true;
    const now = timeMs ?? performance.now();
    this.stroke = {
      tool: this.tool, started: false, ending: false,
      x: 0, y: 0, cx: 0, cy: 0, pr: 0, t: now, speed: 0, simPressure: 0.55, carry: 0, travelled: 0, moved: false,
      dx: this.lastDir[0], dy: this.lastDir[1], angle: this.lastAngle,
    };
    this.history.begin({ kind: 'stroke', label: this.tool }, this.currentMeta());
    this.queue.push({ x: clamp(u, 0, 1), y: clamp(v, 0, 1), p: pressure, t: now });
    this.schedule();
  }

  pointerMoveUv(u: number, v: number, pressure = -1, timeMs?: number) {
    if (!this.stroke) return;
    this.queue.push({ x: clamp(u, 0, 1), y: clamp(v, 0, 1), p: pressure, t: timeMs ?? performance.now() });
    this.schedule();
  }

  pointerUpUv() {
    if (!this.stroke) return;
    this.stroke.ending = true;
    this.schedule();
  }

  /** Step simulation synchronously (used for instant demo washes / automated verification) */
  stepSync(frames = 24, dt = 1 / 60) {
    for (let i = 0; i < frames; i++) {
      this.brushNow.r = 0;
      this.processInput(dt);
      if (this.active) this.step(dt);
    }
    this.dirtyAll = true;
    this.render();
  }

  fix() {
    if (!this.painted || this.fixTimer > 0) return;
    this.history.begin({ kind: 'dry', label: 'Dry' }, this.currentMeta());
    this.history.protect(1, this.painted, this.fixed.views);
    this.fixTimer = FIX_DURATION;
    this.touch(this.painted);
    this.schedule();
  }

  clear() {
    this.stroke = null;
    this.queue = [];
    if (!this.everPainted) return;
    this.history.begin({ kind: 'clear', label: 'Clear' }, this.currentMeta());
    this.history.protect(0, this.everPainted, this.snapshotLayers());
    this.history.protect(1, this.everPainted, this.fixed.views);
    for (const t of [this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write,
      this.divergence, this.curl, this.ink.read, this.ink.write, this.fixed, this.wet.read, this.wet.write]) {
      this.g.clearTarget(t);
    }
    this.active = null;
    this.painted = null;
    this.everPainted = null;
    this.dirty = null;
    this.dirtyAll = true;
    this.lastWet = -Infinity;
    this.wetPeak = 0;
    this.fixTimer = 0;
    this.flowSpeed = 0;
    this.render();
  }

  undo() { if (this.history.canUndo) this.travel('undo'); }
  redo() { if (this.history.canRedo) this.travel('redo'); }

  private travel(dir: 'undo' | 'redo') {
    this.stroke = null;
    this.queue = [];
    this.fixTimer = 0;
    const metaNow = this.currentMeta();
    this.sleep();
    const layers = [
      [[this.ink.read.views[0], this.ink.write.views[0]], [this.ink.read.views[1], this.ink.write.views[1]], [this.wet.read.views[0], this.wet.write.views[0]]],
      [[this.fixed.views[0]], [this.fixed.views[1]]],
    ];
    const res = dir === 'undo' ? this.history.undo(layers, metaNow) : this.history.redo(layers, metaNow);
    if (!res) return;
    const meta = res.meta as ReturnType<WatercolorCanvasEngine['currentMeta']>;
    const now = performance.now();
    this.lastWet = now - meta.wetAgo;
    this.wetPeak = meta.wetPeak;
    this.active = meta.active ? { ...meta.active } : null;
    if (res.rect) {
      this.dirty = union(this.dirty, res.rect);
      this.painted = union(this.painted, res.rect);
      this.everPainted = union(this.everPainted, res.rect);
    }
    this.dirtyAll = true;
    this.render();
    if (this.active) this.schedule();
  }

  private currentMeta() {
    return {
      wetAgo: performance.now() - this.lastWet,
      wetPeak: this.wetPeak,
      active: this.active ? { ...this.active } : null,
      painted: this.painted ? { ...this.painted } : null,
    };
  }

  /* --------------------------------------------------------------- Internals */

  private drawPaper() {
    const { gl, g } = this;
    const scale = PAPER_UNITS / this.dh;
    const field = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA], gl.NEAREST);
    const f = this.programs.paperField;
    f.bind();
    gl.uniform2f(f.u.uRes, this.dw, this.dh);
    gl.uniform2f(f.u.uOffset, 0, 0);
    gl.uniform1f(f.u.uScale, scale);
    gl.uniform1f(f.u.uSeed, this.paperSeed);
    gl.uniform1i(f.u.uKind, this.paperPreset.kind);
    g.draw(field);
    const l = this.programs.paperLight;
    l.bind();
    gl.uniform1i(l.u.uField, g.bindTex(0, field.tex[0]));
    gl.uniform2f(l.u.uTexel, 1 / this.dw, 1 / this.dh);
    gl.uniform1f(l.u.uBump, (this.paperPreset.bump * 1.4) / scale);
    g.draw(this.paper);
    g.disposeTarget(field);
  }

  private tipTexture(b: Brush): WebGLTexture {
    let t = this.tipTextures.get(b.id);
    if (t) return t;
    const { gl } = this;
    t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, b.tipSize, b.tipSize, 0, gl.RED, gl.UNSIGNED_BYTE, b.tipData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tipTextures.set(b.id, t);
    return t;
  }

  private sizeMult() { return Math.pow(3, (this.params.size - 0.5) * 2); }
  private brushRadius(pr: number, speed: number) {
    const b = this.brush;
    const t = Math.pow(clamp(pr, 0, 1), b.pressureSize);
    return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult() * 0.85;
  }
  private radius(tool: Tool, pr: number, speed: number) {
    const m = this.sizeMult();
    switch (tool) {
      case 'pen': return (0.002 + 0.0046 * pr) * clamp(1.12 - speed * 0.3, 0.55, 1.12) * m;
      case 'brush': return this.brushRadius(pr, speed);
      case 'water': return this.brushRadius(pr, speed) * 1.3 * (1 + Math.min(speed, 2.5) * 0.12);
      case 'lift': return (0.015 + 0.032 * pr) * m;
    }
  }
  private brushAngle(s: Stroke) {
    const b = this.brush;
    let a = b.rotation === 'random' ? this.rand() * Math.PI * 2
      : b.rotation === 'follow' ? Math.atan2(s.dy, s.dx) + b.angle * DEG
      : b.angle * DEG;
    if (b.angleJitter) a += (this.rand() - 0.5) * 2 * b.angleJitter * DEG;
    s.angle = a;
    if (b.rotation !== 'random') this.lastAngle = a;
    return a;
  }
  private pressureOf(s: Stroke, p: number) { return p >= 0 ? p : s.simPressure; }
  private spacingFrac(tool: Tool) {
    const b = this.brush;
    return tool === 'brush' || tool === 'water' ? b.spacing * Math.sqrt(b.aspect) : 0.45;
  }

  private processInput(dt: number) {
    const s = this.stroke;
    if (!s) return;
    s.moved = false;
    const aspect = this.dw / this.dh;
    for (const q of this.queue) {
      if (!s.started) {
        s.started = true;
        s.x = s.cx = q.x; s.y = s.cy = q.y; s.t = q.t;
        s.pr = this.pressureOf(s, q.p);
        this.stamp(s, q.x, q.y, s.pr, 0, 0, 1);
        continue;
      }
      const sdt = Math.max(q.t - s.t, 14) / 1000;
      s.t = q.t;
      const nx = s.cx + (q.x - s.cx) * 0.55, ny = s.cy + (q.y - s.cy) * 0.55;
      const len = Math.hypot((nx - s.cx) * aspect, ny - s.cy);
      s.speed += (len / sdt - s.speed) * (1 - Math.exp(-sdt * 10));
      const target = clamp(1.15 - s.speed * 0.9, 0.16, 1);
      s.simPressure += (target - s.simPressure) * (1 - Math.exp(-sdt * 6));
      const pr = this.pressureOf(s, q.p);
      const vx = (nx - s.cx) / sdt, vy = (ny - s.cy) / sdt;
      this.trace(s, s.cx, s.cy, (s.cx + nx) / 2, (s.cy + ny) / 2, pr, vx, vy);
      s.cx = nx; s.cy = ny;
      if (len > 0) s.moved = true;
    }
    this.queue = [];
    if (s.started && (!s.moved || s.ending) && (s.x !== s.cx || s.y !== s.cy)) {
      this.trace(s, s.cx, s.cy, s.cx, s.cy, s.pr, 0, 0);
    }
    if (!s.moved && s.started && !s.ending) {
      this.stamp(s, s.x, s.y, this.pressureOf(s, -1), 0, 0, 0, dt);
    }
    if (s.ending) this.stroke = null;
  }

  private trace(s: Stroke, qx: number, qy: number, ex: number, ey: number, pr: number, vx: number, vy: number) {
    const aspect = this.dw / this.dh;
    const x0 = s.x, y0 = s.y, pr0 = s.pr;
    const approx = Math.hypot((qx - x0) * aspect, qy - y0) + Math.hypot((ex - qx) * aspect, ey - qy);
    if (approx < 1e-7) return;
    const fine = this.radius(s.tool, Math.max(pr0, pr), s.speed) * this.spacingFrac(s.tool);
    const n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const u = i / n, w = 1 - u;
      const cx = w * w * x0 + 2 * w * u * qx + u * u * ex;
      const cy = w * w * y0 + 2 * w * u * qy + u * u * ey;
      const dx = (cx - px) * aspect, dy = cy - py;
      const len = Math.hypot(dx, dy);
      const p = pr0 + (pr - pr0) * u;
      if (len > 1e-5) {
        const kd = 1 - Math.exp(-len / (this.radius(s.tool, p, s.speed) * 1.5 + 1e-4));
        s.dx += (dx / len - s.dx) * kd; s.dy += (dy / len - s.dy) * kd;
        const m = Math.hypot(s.dx, s.dy) || 1;
        s.dx /= m; s.dy /= m;
        this.lastDir = [s.dx, s.dy];
      }
      const spacing = this.radius(s.tool, p, s.speed) * this.spacingFrac(s.tool);
      let pos = 0;
      while (len - pos >= spacing - s.carry) {
        pos += spacing - s.carry;
        s.carry = 0;
        const t = pos / len;
        this.stamp(s, px + (cx - px) * t, py + (cy - py) * t, p, vx, vy, 1);
      }
      s.carry += len - pos;
      s.travelled += len;
      px = cx; py = cy;
    }
    s.x = ex; s.y = ey; s.pr = pr;
  }

  private stamp(s: Stroke, x: number, y: number, pr: number, vx: number, vy: number, moving: number, dt = 0) {
    const P = this.params;
    const r = this.radius(s.tool, pr, s.speed);
    const dwell = moving ? 1 : dt * 8;
    switch (s.tool) {
      case 'brush': {
        const b = this.brush;
        const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((1.5 + 3 * P.water) * b.capacity));
        const dryness = clamp(b.grain + (1 - b.grain) * clamp((0.5 - reservoir) * 2.5, 0, 1) * 0.6, 0, 1);
        const grainThr = 0.74 - 0.45 * pr - 0.05 * P.water;
        const conc = 0.16 * Math.exp(P.load * 2.8) * reservoir * (0.6 + 0.4 * pr) * b.load;
        const norm = clamp(Math.sqrt(0.5 / b.tipMean), 0.7, 2.2);
        const amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell;
        const wet = (0.25 + 0.75 * P.water) * (0.7 + 0.3 * pr) * b.water * (0.4 + 0.6 * reservoir);
        const c = this.pigment.coeffs;
        const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];
        const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 1.6];
        this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
          this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
          this.brushWet(dx, dy, dr * (1 + 0.12 * b.wetRound), angle, wet, b.wetRound, dryness, grainThr);
        });
        if (moving) this.splatVelocity(x, y, r * 1.2, vx, vy, (15 + P.flow * 95) * 0.25 * b.flow);
        break;
      }
      case 'water': {
        const b = this.brush;
        const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((3 + 4 * P.water) * b.capacity));
        const amp = (0.35 + 0.65 * P.water) * (0.5 + 0.5 * pr) * clamp(b.water, 0.6, 1.5) * (0.7 + 0.3 * reservoir);
        const dryness = b.grain * 0.7;
        const grainThr = 0.55 - 0.3 * pr;
        this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
          this.brushWet(dx, dy, dr, angle, amp, Math.max(b.wetRound, 0.3), dryness, grainThr);
        });
        this.brushNow = { x, y, r };
        if (moving) this.splatVelocity(x, y, r * 1.15, vx, vy, (15 + P.flow * 95) * b.flow);
        else {
          const a = this.rand() * Math.PI * 2, m = (6 + 26 * P.flow) * pr;
          this.splatVelocityRaw(x, y, r * 0.9, Math.cos(a) * m, Math.sin(a) * m);
        }
        break;
      }
      case 'pen': {
        const dens = (0.9 + 1.6 * pr) * clamp(1.25 - s.speed * 0.45, 0.6, 1.25) * (0.5 + P.load);
        const amount = dens * 0.5 / 1.8 * dwell;
        const c = this.pigment.coeffs;
        this.splatInk(x, y, r, [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount],
          [c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 3], 2);
        this.splatWet(x, y, r * 2.6, 0.13, 1);
        break;
      }
      case 'lift': {
        this.lift(x, y, r, Math.min(0.9, 0.24 * dwell));
        break;
      }
    }
  }

  private eachDab(s: Stroke, x: number, y: number, r: number, fn: (x: number, y: number, r: number, angle: number) => void) {
    const b = this.brush;
    const aspect = this.dw / this.dh;
    for (let i = 0; i < b.dabs; i++) {
      let dx = x, dy = y, dr = r;
      if (b.scatter > 0) {
        const a = this.rand() * Math.PI * 2, m = Math.sqrt(this.rand()) * b.scatter * r;
        dx += (Math.cos(a) * m) / aspect; dy += Math.sin(a) * m;
      }
      if (b.sizeJitter > 0) dr *= clamp(1 + (this.rand() * 2 - 1) * b.sizeJitter, 0.15, 2);
      fn(dx, dy, dr, this.brushAngle(s));
    }
  }

  private drawStamp(t: Target, x: number, y: number, r: number, angle: number, c0: number[], c1: number[], round: number, grain: number, grainThr: number) {
    const { gl, g } = this;
    const b = this.brush;
    const p = this.programs.stamp;
    p.bind();
    gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
    gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
    gl.uniform1f(p.u.uAspect, t.w / t.h);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uTipAspect, b.aspect);
    gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
    gl.uniform1f(p.u.uRound, round);
    gl.uniform1f(p.u.uGrain, grain);
    gl.uniform1f(p.u.uGrainThr, grainThr);
    gl.uniform4fv(p.u.uColor0, c0);
    gl.uniform4fv(p.u.uColor1, c1);
    g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
  }

  private brushInk(x: number, y: number, r: number, angle: number, c0: number[], c1: number[], grain: number, grainThr: number) {
    const { gl } = this;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawStamp(this.ink.read, x, y, r, angle, c0, c1, 0, grain, grainThr);
    gl.disable(gl.BLEND);
  }

  private brushWet(x: number, y: number, r: number, angle: number, amount: number, round: number, grain: number, grainThr: number) {
    const { gl } = this;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.drawStamp(this.wet.read, x, y, r, angle, [amount, 0, 0, 0], [0, 0, 0, 0], round, grain, grainThr);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
    this.lastWet = performance.now();
  }

  private stampRect(x: number, y: number, r: number, w: number, h: number, extent: number): Rect {
    const e = Math.ceil(r * extent * h) + 2;
    const cx = Math.round(x * w), cy = Math.round(y * h);
    return { x0: clamp(cx - e, 0, w), y0: clamp(cy - e, 0, h), x1: clamp(cx + e, 0, w), y1: clamp(cy + e, 0, h) };
  }

  private touch(rect: Rect, wake = true, save = true) {
    if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
    const next = union(this.active, rect);
    if (save) {
      const m = PROTECT_MARGIN;
      this.history.protect(0, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.snapshotLayers());
    }
    this.active = next;
    this.painted = union(this.painted, rect);
    this.everPainted = union(this.everPainted, rect);
    this.dirty = union(this.dirty, rect);
    if (wake) this.minAwakeUntil = Math.max(this.minAwakeUntil, performance.now() + 250);
  }

  private snapshotLayers() {
    return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0]];
  }

  private drawSplat(t: Target, x: number, y: number, r: number, c0: number[], c1: number[], hardness: number, extent: number) {
    const { gl, g } = this;
    const p = this.programs.splat;
    p.bind();
    gl.uniform1f(p.u.uAspect, t.w / t.h);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uHardness, hardness);
    gl.uniform4fv(p.u.uColor0, c0);
    gl.uniform4fv(p.u.uColor1, c1);
    g.draw(t, this.stampRect(x, y, r, t.w, t.h, extent));
  }

  private splatInk(x: number, y: number, r: number, c0: number[], c1: number[], hardness: number) {
    const { gl } = this;
    const extent = hardness > 1.4 ? 2.2 : 3.2;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawSplat(this.ink.read, x, y, r, c0, c1, hardness, extent);
    gl.disable(gl.BLEND);
  }

  private splatWet(x: number, y: number, r: number, amount: number, hardness: number) {
    const { gl } = this;
    const extent = hardness > 1.4 ? 2.2 : 3.2;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.drawSplat(this.wet.read, x, y, r, [amount, 0, 0, 0], [0, 0, 0, 0], hardness, extent);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
    this.lastWet = performance.now();
  }

  private splatVelocity(x: number, y: number, r: number, vx: number, vy: number, force: number) {
    let fx = vx * force, fy = vy * force;
    const m = Math.hypot(fx, fy), vmax = 65;
    if (m > vmax) { fx *= vmax / m; fy *= vmax / m; }
    this.flowSpeed = Math.max(this.flowSpeed, Math.min(m, vmax));
    this.splatVelocityRaw(x, y, r, fx, fy);
  }

  private splatVelocityRaw(x: number, y: number, r: number, fx: number, fy: number) {
    const { gl } = this;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawSplat(this.velocity.read, x, y, r, [fx, fy, 0, 0], [0, 0, 0, 0], 1, 3);
    gl.disable(gl.BLEND);
  }

  private lift(x: number, y: number, r: number, amount: number) {
    const { gl, g } = this;
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
    this.touch(rect);
    const p = this.programs.lift;
    p.bind();
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    gl.uniform1f(p.u.uAmount, amount);
    g.draw(this.ink.read, rect);
    gl.uniform1f(p.u.uAmount, amount * 0.8);
    g.draw(this.wet.read, rect);
    gl.disable(gl.BLEND);
  }

  private dryTau() { return this.fixTimer > 0 ? 0.25 : 2 + (1 - this.params.dry) * 16; }
  private wetDecay() { return Math.exp(-(performance.now() - this.lastWet) / 1000 / this.dryTau()); }
  private wetUntil() {
    if (this.wetPeak <= WET_THRESHOLD) return this.lastWet;
    return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1000;
  }

  private step(dt: number) {
    const { gl, g, programs: P } = this;
    const fixing = this.fixTimer > 0;
    if (fixing) {
      this.fixTimer -= dt;
      if (this.fixTimer <= 0) {
        this.wetPeak = 0;
        this.minAwakeUntil = 0;
        this.painted = null;
      }
    }
    const vel = this.velocity;
    const simTexel = [1 / vel.w, 1 / vel.h];
    const texel = [1 / this.dw, 1 / this.dh];
    const flow = this.params.flow;
    const rect = this.active!;

    P.advectVelocity.bind();
    gl.uniform1i(P.advectVelocity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.advectVelocity.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
    gl.uniform2fv(P.advectVelocity.u.uTexel, simTexel);
    gl.uniform1f(P.advectVelocity.u.uDt, dt);
    gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3.0 - flow * 2.4)) * (fixing ? Math.exp(-dt * 7) : 1));
    g.draw(vel.write); vel.swap();

    P.curl.bind();
    gl.uniform1i(P.curl.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform2fv(P.curl.u.uTexel, simTexel);
    g.draw(this.curl);

    P.vorticity.bind();
    gl.uniform1i(P.vorticity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.vorticity.u.uCurl, g.bindTex(1, this.curl.tex[0]));
    gl.uniform2fv(P.vorticity.u.uTexel, simTexel);
    gl.uniform1f(P.vorticity.u.uCurlAmount, 4 + flow * 22);
    gl.uniform1f(P.vorticity.u.uDt, dt);
    g.draw(vel.write); vel.swap();

    P.divergence.bind();
    gl.uniform1i(P.divergence.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform2fv(P.divergence.u.uTexel, simTexel);
    g.draw(this.divergence);

    P.scale.bind();
    gl.uniform1i(P.scale.u.uTex, g.bindTex(0, this.pressure.read.tex[0]));
    gl.uniform1f(P.scale.u.uValue, 0.8);
    g.draw(this.pressure.write); this.pressure.swap();

    P.pressure.bind();
    gl.uniform1i(P.pressure.u.uDivergence, g.bindTex(1, this.divergence.tex[0]));
    gl.uniform2fv(P.pressure.u.uTexel, simTexel);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(P.pressure.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
      g.draw(this.pressure.write); this.pressure.swap();
    }

    P.gradient.bind();
    gl.uniform1i(P.gradient.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
    gl.uniform1i(P.gradient.u.uVelocity, g.bindTex(1, vel.read.tex[0]));
    gl.uniform2fv(P.gradient.u.uTexel, simTexel);
    g.draw(vel.write); vel.swap();

    P.advectWet.bind();
    gl.uniform1i(P.advectWet.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.advectWet.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
    gl.uniform2fv(P.advectWet.u.uSimTexel, simTexel);
    gl.uniform2fv(P.advectWet.u.uTexel, texel);
    gl.uniform1f(P.advectWet.u.uDt, dt);
    gl.uniform1f(P.advectWet.u.uDecay, Math.exp(-dt / this.dryTau()));
    gl.uniform1f(P.advectWet.u.uSpread, 0.12);
    g.draw(this.wet.write, rect); this.wet.swap();

    const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
    if (fixing) {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      P.bleach.bind();
      gl.uniform1i(P.bleach.u.uInkB, g.bindTex(0, this.ink.read.tex[1]));
      gl.uniform1f(P.bleach.u.uSettle, settle);
      g.draw(this.fixed, rect);
      gl.blendFunc(gl.ONE, gl.ONE);
      P.settle.bind();
      gl.uniform1i(P.settle.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
      gl.uniform1i(P.settle.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
      gl.uniform1f(P.settle.u.uSettle, settle);
      g.draw(this.fixed, rect);
      gl.disable(gl.BLEND);
    }

    const p = P.advectInk;
    p.bind();
    gl.uniform1i(p.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(p.u.uInkA, g.bindTex(1, this.ink.read.tex[0]));
    gl.uniform1i(p.u.uInkB, g.bindTex(2, this.ink.read.tex[1]));
    gl.uniform1i(p.u.uWet, g.bindTex(3, this.wet.read.tex[0]));
    gl.uniform2fv(p.u.uSimTexel, simTexel);
    gl.uniform2fv(p.u.uTexel, texel);
    gl.uniform1f(p.u.uDt, dt);
    gl.uniform1f(p.u.uBleed, this.params.bleed);
    gl.uniform1f(p.u.uEdge, this.params.edge * 1.4);
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform1f(p.u.uKeep, 1 - settle);
    gl.uniform3f(p.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
    g.draw(this.ink.write, rect); this.ink.swap();

    this.dirty = union(this.dirty, rect);
  }

  private trimActive() {
    const a = this.active;
    if (!a) return;
    const { gl, g } = this;
    const m = this.wetMask;
    const p = this.programs.wetMask;
    p.bind();
    gl.uniform1i(p.u.uWet, g.bindTex(0, this.wet.read.tex[0]));
    gl.uniform2f(p.u.uBlock, 1 / m.w, 1 / m.h);
    gl.uniform1f(p.u.uThreshold, WET_THRESHOLD);
    g.draw(m);
    gl.bindFramebuffer(gl.FRAMEBUFFER, m.fbo);
    gl.readPixels(0, 0, m.w, m.h, gl.RGBA, gl.UNSIGNED_BYTE, this.maskPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    const px = this.maskPixels;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!px[(y * m.w + x) * 4]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    let next: Rect | null = null;
    if (x1 >= 0) {
      const wet = {
        x0: Math.max(0, x0 * MASK_BLOCK - MASK_MARGIN), y0: Math.max(0, y0 * MASK_BLOCK - MASK_MARGIN),
        x1: Math.min(this.dw, (x1 + 1) * MASK_BLOCK + MASK_MARGIN), y1: Math.min(this.dh, (y1 + 1) * MASK_BLOCK + MASK_MARGIN),
      };
      const r = { x0: Math.max(a.x0, wet.x0), y0: Math.max(a.y0, wet.y0), x1: Math.min(a.x1, wet.x1), y1: Math.min(a.y1, wet.y1) };
      if (r.x1 > r.x0 && r.y1 > r.y0) next = r;
    }
    if (next && next.x0 === a.x0 && next.y0 === a.y0 && next.x1 === a.x1 && next.y1 === a.y1) return;
    const w = a.x1 - a.x0, h = a.y1 - a.y0;
    for (const d of [this.ink, this.wet])
      d.read.views.forEach((v, i) => g.blit(v, a.x0, a.y0, d.write.views[i], a.x0, a.y0, w, h));
    if (next) this.active = next; else this.sleep();
  }

  private sleep() {
    const rect = this.active;
    if (rect) {
      const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
      for (const d of [this.ink, this.wet])
        d.read.views.forEach((v, i) => this.g.blit(v, rect.x0, rect.y0, d.write.views[i], rect.x0, rect.y0, w, h));
    }
    for (const d of [this.velocity, this.pressure]) { this.g.clearTarget(d.read); this.g.clearTarget(d.write); }
    this.active = null;
    this.wetPeak = 0;
    this.flowSpeed = 0;
  }

  private render() {
    if (!this.dirtyAll && !this.dirty) return;
    const { gl, g } = this;
    const p = this.programs.display;
    p.bind();
    gl.uniform1i(p.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
    gl.uniform1i(p.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
    gl.uniform1i(p.u.uFixedA, g.bindTex(2, this.fixed.tex[0]));
    gl.uniform1i(p.u.uFixedB, g.bindTex(3, this.fixed.tex[1]));
    gl.uniform1i(p.u.uWet, g.bindTex(4, this.wet.read.tex[0]));
    gl.uniform1i(p.u.uPaper, g.bindTex(5, this.paper.tex[0]));
    gl.uniform1i(p.u.uRef, g.bindTex(6, this.refTex ?? this.paper.tex[0]));
    gl.uniform2f(p.u.uTexel, 1 / this.dw, 1 / this.dh);
    gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.58);
    gl.uniform1f(p.u.uEdgeDarken, 0.85);
    gl.uniform1f(p.u.uRefOpacity, this.refTex ? this.refOpacity : 0.0);
    gl.uniform3fv(p.u.uPaperTint, linearRGB(this.paperPreset.tint));
    gl.uniform3fv(p.u.uFleckTint, linearRGB(this.paperPreset.fleck));
    gl.uniform1f(p.u.uMottle, this.paperPreset.mottle);
    gl.uniform1f(p.u.uTexture, this.paperStrength);
    g.draw(null, this.dirtyAll ? null : this.dirty, [this.dw, this.dh]);
    this.dirty = null;
    this.dirtyAll = false;
    this.onRender?.();
  }

  private schedule() {
    if (!this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = clamp((now - this.lastFrame) / 1000, 1 / 240, 1 / 30);
    this.lastFrame = now;
    this.brushNow.r = 0;
    this.processInput(dt);

    const awake = this.active !== null &&
      (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
    if (awake) {
      this.flowSpeed *= Math.exp(-dt * (3.0 - this.params.flow * 2.4));
      this.growCarry += 0.4 + Math.min(3, 0.15 * this.flowSpeed * dt * (this.dw / this.velocity.w));
      const grow = Math.floor(this.growCarry);
      if (grow > 0) {
        this.growCarry -= grow;
        const a = this.active!;
        this.touch({ x0: Math.max(0, a.x0 - grow), y0: Math.max(0, a.y0 - grow), x1: Math.min(this.dw, a.x1 + grow), y1: Math.min(this.dh, a.y1 + grow) }, false, false);
      }
      this.step(dt);
      if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY) { this.maskCounter = 0; this.trimActive(); }
    }
    this.render();
    if (!awake && this.active) this.sleep();
    if (awake || this.stroke) this.schedule();
  };
}
