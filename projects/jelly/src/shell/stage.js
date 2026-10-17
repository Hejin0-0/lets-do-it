// The page around the jelly: masthead, status pill, panel frame, foot, notes, toast and the
// fallback card. A specimen supplies its words and markup (meta, panel, foot, notes); the stage
// puts them in place and offers the services every specimen used to rebuild for itself.

const WHY = {
  'no-webgpu': (n) => `This browser does not offer WebGPU (navigator.gpu is missing), so the ${n} cannot be simulated and lit here.`,
  'no-adapter': () => 'WebGPU is present, but no compatible GPU adapter was offered: the GPU may be blocklisted, hardware acceleration switched off, or the page running headless.',
  shader: () => 'The WGSL shaders failed to compile on this GPU. The compiler said:',
  pipeline: () => 'The GPU rejected one of the render pipelines:',
  lost: () => 'The GPU device was lost and could not be recovered.',
};

export function createStage(root = document) {
  const $ = (s) => root.querySelector(s);
  const el = {
    stage: $('#stage'), canvas: $('#gl'), status: $('#status'), statusText: $('#status-text'),
    eyebrow: $('#eyebrow'), title: $('#title'), caption: $('#caption'), panelTitle: $('#panel-title'),
    controls: $('#controls'), foot: $('#foot'), notes: $('#notes-body'), extra: $('#extra'), toast: $('#toast'),
    fallback: $('#fallback'), fallbackTitle: $('#fallback-title'), fallbackWhy: $('#fallback-why'), fallbackReason: $('#fallback-reason'),
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer = 0, meta = null;

  const span = (lines) => lines.map((t) => `<span>${t}</span>`).join('');

  return {
    el, $, reduced,
    get canvas() { return el.canvas; },

    /** Put a specimen's words and markup on the page; its controls stay disabled until it is live. */
    present(mod) {
      meta = mod.meta;
      document.title = `${meta.name} — Material Studies`;
      document.documentElement.style.setProperty('--paper', meta.paper);
      document.documentElement.style.removeProperty('--accent');   // a specimen may tint its controls
      el.stage.dataset.specimen = meta.id;
      el.stage.dataset.layout = meta.layout || 'study';   // 'custom': the specimen draws its own page in #extra
      el.eyebrow.textContent = meta.eyebrow;
      el.title.innerHTML = span(meta.title);
      el.caption.innerHTML = span(meta.caption);
      el.panelTitle.innerHTML = 'The Specimen' + (meta.badge ? ` ${meta.badge}` : meta.fig ? ` <span>· ${meta.fig}</span>` : '');
      el.canvas.setAttribute('aria-label', meta.aria);
      el.controls.innerHTML = mod.panel;
      el.controls.disabled = true;
      el.foot.innerHTML = mod.foot;
      el.notes.innerHTML = mod.notes || '';
      el.notes.parentElement.hidden = !mod.notes;
      el.extra.innerHTML = mod.extra || '';
      el.fallback.hidden = true;
      el.canvas.style.cursor = '';
      el.canvas.style.visibility = '';
    },
    enable() { el.controls.disabled = false; },

    status(state, text) { el.status.dataset.state = state; el.statusText.textContent = text; },
    toast(msg) {
      el.toast.textContent = msg;
      el.toast.dataset.show = 'true';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.toast.dataset.show = 'false'; }, 2300);
    },
    /** Explain why nothing is drawn. Missing WebGPU is expected, not an error in the console. */
    fail(e) {
      if (e.code === 'no-webgpu' || e.code === 'no-adapter') console.info(`${meta?.name ?? 'Jelly'}:`, e.message);
      else console.error(e);
      const noun = meta?.noun ?? 'jelly';
      this.status('error', e.code === 'no-webgpu' || e.code === 'no-adapter' ? 'WebGPU · Unavailable' : 'WebGPU · Error');
      el.fallbackTitle.textContent = `This ${noun} needs WebGPU.`;
      el.fallbackWhy.textContent = (WHY[e.code] || (() => 'Something went wrong while starting the renderer:'))(noun);
      el.fallbackReason.textContent = e.message || String(e);
      el.fallback.hidden = false;
      el.canvas.style.visibility = 'hidden';   // not the last frame of the jelly before
      el.controls.disabled = true;
    },
  };
}
