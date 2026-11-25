import type { Format, GL, Rect, Target } from './gl';

const TILE = 128;

class Pool {
  readonly atlas: Target[];
  readonly scratch: Target[];
  readonly cols: number;
  readonly free: number[] = [];

  constructor(g: GL, tiles: number, formats: Format[]) {
    const maxTex = g.gl.getParameter(g.gl.MAX_TEXTURE_SIZE) as number;
    this.cols = Math.min(tiles, Math.floor(maxTex / TILE));
    const rows = Math.ceil(tiles / this.cols);
    this.atlas = formats.map(f => g.target(this.cols * TILE, rows * TILE, [f], g.gl.NEAREST));
    this.scratch = formats.map(f => g.target(TILE, TILE, [f], g.gl.NEAREST));
    for (let i = tiles - 1; i >= 0; i--) this.free.push(i);
  }

  dispose(g: GL) { [...this.atlas, ...this.scratch].forEach(t => g.disposeTarget(t)); }
}

export type StepKind = 'stroke' | 'dry' | 'clear';
export interface StepInfo { kind: StepKind; label: string }

interface Step extends StepInfo {
  tiles: Map<number, number>[];
  meta: unknown;
}

interface Group { formats: Format[]; documents: number }

export class History {
  private pools!: Pool[];
  private tilesX!: number;
  private tilesY!: number;
  private steps: Step[] = [];
  private redoSteps: Step[] = [];
  private maxSteps = 32;
  private recording = false;

  constructor(private g: GL, private w: number, private h: number, private groups: Group[]) {
    this.allocate();
  }

  private allocate() {
    this.tilesX = Math.ceil(this.w / TILE);
    this.tilesY = Math.ceil(this.h / TILE);
    const tiles = this.tilesX * this.tilesY;
    this.pools = this.groups.map(gr => new Pool(this.g, Math.ceil(tiles * gr.documents), gr.formats));
  }

  get canUndo() { return this.steps.length > 0; }
  get canRedo() { return this.redoSteps.length > 0; }

  begin(info: StepInfo, meta: unknown) {
    this.clearRedo();
    this.steps.push({ ...info, tiles: this.pools.map(() => new Map()), meta });
    this.recording = true;
    while (this.steps.length > this.maxSteps) {
      const s = this.steps.shift();
      if (s) this.release(s);
    }
  }

  protect(p: number, rect: Rect, layers: WebGLFramebuffer[]) {
    const step = this.steps[this.steps.length - 1];
    if (!step) return;
    const pool = this.pools[p], saved = step.tiles[p];
    const tx0 = Math.max(0, Math.floor(rect.x0 / TILE)), tx1 = Math.min(this.tilesX - 1, Math.floor((rect.x1 - 1) / TILE));
    const ty0 = Math.max(0, Math.floor(rect.y0 / TILE)), ty1 = Math.min(this.tilesY - 1, Math.floor((rect.y1 - 1) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = ty * this.tilesX + tx;
        if (saved.has(id)) continue;
        const slot = this.recording ? this.allocSlot(pool) : pool.free.pop();
        if (slot === undefined) return;
        saved.set(id, slot);
        this.copyTile(pool, id, slot, layers);
      }
    }
  }

  undo(layers: WebGLFramebuffer[][][], metaNow: unknown) { return this.swap(this.steps, this.redoSteps, layers, metaNow); }
  redo(layers: WebGLFramebuffer[][][], metaNow: unknown) { return this.swap(this.redoSteps, this.steps, layers, metaNow); }

  private swap(from: Step[], to: Step[], layers: WebGLFramebuffer[][][], metaNow: unknown): { meta: unknown; rect: Rect | null; info: StepInfo } | null {
    const step = from.pop();
    if (!step) return null;
    this.recording = false;
    const info: StepInfo = { kind: step.kind, label: step.label };
    const back: Step = { ...info, tiles: step.tiles, meta: metaNow };
    let rect: Rect | null = null;
    step.tiles.forEach((saved, p) => {
      const pool = this.pools[p];
      for (const [id, slot] of saved) {
        const tx = id % this.tilesX, ty = Math.floor(id / this.tilesX);
        const w = Math.min(TILE, this.w - tx * TILE), h = Math.min(TILE, this.h - ty * TILE);
        const sx = (slot % pool.cols) * TILE, sy = Math.floor(slot / pool.cols) * TILE;
        layers[p].forEach((fbs, i) => {
          const atlas = pool.atlas[i].views[0], scratch = pool.scratch[i].views[0];
          this.g.blit(fbs[0], tx * TILE, ty * TILE, scratch, 0, 0, w, h);
          for (const fb of fbs) this.g.blit(atlas, sx, sy, fb, tx * TILE, ty * TILE, w, h);
          this.g.blit(scratch, 0, 0, atlas, sx, sy, w, h);
        });
        const r = { x0: tx * TILE, y0: ty * TILE, x1: tx * TILE + w, y1: ty * TILE + h };
        rect = rect ? { x0: Math.min(rect.x0, r.x0), y0: Math.min(rect.y0, r.y0), x1: Math.max(rect.x1, r.x1), y1: Math.max(rect.y1, r.y1) } : r;
      }
    });
    to.push(back);
    return { meta: step.meta, rect, info };
  }

  private allocSlot(pool: Pool): number | undefined {
    while (!pool.free.length) {
      if (this.steps.length > 1) this.release(this.steps.shift()!);
      else if (this.redoSteps.length) this.release(this.redoSteps.pop()!);
      else break;
    }
    return pool.free.pop();
  }

  dispose() { this.pools.forEach(p => p.dispose(this.g)); }

  private clearRedo() {
    for (const s of this.redoSteps) this.release(s);
    this.redoSteps = [];
  }

  private release(s: Step) {
    s.tiles.forEach((saved, p) => { for (const slot of saved.values()) this.pools[p].free.push(slot); });
  }

  private copyTile(pool: Pool, id: number, slot: number, layers: WebGLFramebuffer[]) {
    const tx = (id % this.tilesX) * TILE, ty = Math.floor(id / this.tilesX) * TILE;
    const sx = (slot % pool.cols) * TILE, sy = Math.floor(slot / pool.cols) * TILE;
    const w = Math.min(TILE, this.w - tx), h = Math.min(TILE, this.h - ty);
    layers.forEach((fb, i) => {
      const atlas = pool.atlas[i].views[0];
      this.g.blit(fb, tx, ty, atlas, sx, sy, w, h);
    });
  }
}
