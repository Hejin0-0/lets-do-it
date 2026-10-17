// One jelly at a time: the switcher loads a specimen module, mounts it on the shared canvas and
// device, and unmounts it (listeners, loop, GPU memory) before the next one comes in.
//
// Specimen module contract:
//   export const meta   = { id, name, noun, eyebrow, title: [a, b], caption: [...], fig, paper, aria }
//   export const panel, foot, notes, extra?    // markup for the stage's frames
//   export async function mount(ctx) -> { unmount() }
//   ctx = { canvas, gpu: { device, context, format }, signal, stage, frames(tick), hook(api) }
// The device in ctx is a resource scope: whatever the specimen creates through it is released after unmount.
import { Loop } from '@lid/loop';
import { acquireGPU, gpuError, resourceScope } from '../core/gpu.js';
import { createLoader } from './loader.js';

export function createSwitcher(stage, entries) {
  const $ = stage.$, loader = createLoader(document, stage.reduced);
  const prev = $('#sw-prev'), next = $('#sw-next'), count = $('#sw-count'), name = $('#sw-name');
  let gpu = null, index = -1, current = null, wanted = -1, running = false, recoveries = 0;

  const wrap = (i) => (i + entries.length) % entries.length;
  const byHash = () => entries.findIndex((e) => `#${e.id}` === location.hash);

  async function device() {
    if (gpu) return gpu;
    gpu = await acquireGPU(stage.canvas);
    const mine = gpu;
    mine.device.lost.then((info) => {
      if (info.reason === 'destroyed' || gpu !== mine) return;
      gpu = null;
      if (++recoveries > 2) { unmount(); stage.fail(gpuError('lost', `Device lost three times (${info.message || info.reason}).`)); return; }
      stage.status('boot', 'WebGPU · Recovering');
      const i = index; index = -1; show(i);
    });
    return gpu;
  }

  function unmount() {
    if (!current) return;
    const c = current; current = null;
    c.controller.abort();
    try { c.instance?.unmount?.(); } finally { c.scope.release(); }
    window.__jelly = { id: null };
  }

  async function mount(i) {
    const entry = entries[i], mod = await entry.load();
    loader.detail(mod.meta); loader.progress(0.35);
    stage.present(mod);
    stage.status('boot', 'WebGPU · Starting');
    const g = await device();
    loader.progress(0.5); loader.creep(0.92);   // meshing and shader compiles give no news until they are done
    const controller = new AbortController(), scope = resourceScope(g.device);
    const loops = [];
    controller.signal.addEventListener('abort', () => loops.forEach((l) => l.stop()));
    current = { controller, scope, instance: null };
    const ctx = {
      canvas: stage.canvas, gpu: { device: scope, context: g.context, format: g.format }, signal: controller.signal, stage,
      /** Run tick(dt, t) every frame (dt clamped to 0.1 s) until the specimen is unmounted. */
      frames(tick) { const l = new Loop(tick, () => {}, 0.1); loops.push(l); l.start(); return l; },
      hook(api) { window.__jelly = { id: entry.id, ...api }; },
    };
    current.instance = await mod.mount(ctx);
    stage.enable();
    stage.status('live', 'WebGPU · Live');
  }

  /** Show entry i: the curtain rises in its colour, the old jelly goes, the new one comes in under it,
   *  the curtain lifts. Clicks during a switch keep only the last target (the curtain stays down). */
  async function show(i) {
    wanted = wrap(i);
    if (running) return;
    running = true;
    try {
      while (wanted !== index) {
        const target = wanted;
        const covering = loader.cover(entries[target], entries.length, { instant: index < 0 });
        entries[target].load().catch(() => {});   // fetch while the curtain rises
        await covering;
        unmount();
        index = target;
        label(target);
        if (location.hash !== `#${entries[target].id}`) history.replaceState(null, '', `#${entries[target].id}`);
        try { await mount(target); } catch (e) { unmount(); stage.fail(e); }
        if (wanted !== index) continue;
        await loader.reveal();
        entries[wrap(target + 1)].load().catch(() => {});   // warm the next one
      }
    } finally { running = false; }
  }

  function label(i) {
    const e = entries[i], n = entries[wrap(i + 1)], p = entries[wrap(i - 1)];
    count.textContent = e.id;
    name.textContent = e.name;
    next.setAttribute('aria-label', `Next jelly: ${n.id} ${n.name}`); next.title = `${n.id} · ${n.name}`;
    prev.setAttribute('aria-label', `Previous jelly: ${p.id} ${p.name}`); prev.title = `${p.id} · ${p.name}`;
  }

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  addEventListener('hashchange', () => { const i = byHash(); if (i >= 0) show(i); });

  return {
    start() { const i = byHash(); return show(i >= 0 ? i : 0); },
    show, get index() { return index; }, get current() { return current; },
  };
}
