// Rubber Duck Pool — the host: the WebGPU device and canvas, the frame loop, the test hook, and the card shown
// when there is no WebGPU. The pool itself (src/pool) is a module: mount(ctx) -> { unmount() }.
import './style.css';
import { Loop } from '@lid/loop';
import * as pool from './pool/index.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#gl'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
const stage = { el: { extra: $('#extra') }, reduced };

function fail(why, e) {   // nothing is drawn rather than a lesser imitation
  $('#fallback-why').textContent = why;
  $('#fallback-reason').textContent = e ? e.message || String(e) : '';
  $('#fallback').hidden = false;
  canvas.style.visibility = 'hidden';
  if (e) console.error(e);
}

async function start() {
  document.title = pool.meta.name;
  stage.el.extra.innerHTML = pool.extra;
  if (!navigator.gpu) return fail('This browser does not offer WebGPU (navigator.gpu is missing).');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return fail('WebGPU is present, but no compatible GPU adapter was offered.');
  const device = await adapter.requestDevice();
  device.lost.then((info) => { if (info.reason !== 'destroyed') fail('The GPU device was lost.', new Error(info.message)); });
  const context = canvas.getContext('webgpu'), format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const controller = new AbortController(), loops = [];
  controller.signal.addEventListener('abort', () => loops.forEach((l) => l.stop()));
  await pool.mount({
    canvas, gpu: { device, context, format }, signal: controller.signal, stage,
    /** Run tick(dt, t) every frame (dt clamped to 0.1 s). */
    frames(tick) { const l = new Loop(tick, () => {}, 0.1); loops.push(l); l.start(); return l; },
    hook(api) { window.__pool = api; },
  });
}
start().catch((e) => fail('Something went wrong while starting the renderer:', e));
