// The curtain between two jellies. The next jelly's colour rises up the screen like jelly setting in a
// mould, its edge wobbling and settling as it fills; its number and name wait in the middle while a drop
// fills with the loading progress; when the jelly has drawn its first frame the curtain lifts off the top.
const RISE_MS = 400, LIFT_MS = 480, MIN_CARD_MS = 320, WAVE = 26;   // the card stays at least MIN_CARD_MS, to be read
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// A hidden tab gets no animation frames: every wait here also ends on a timer, so a jelly still loads
// (and the curtain still lifts) while the page is in the background.
const frame = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 40); });
const STAGES = [[0.3, 'Fetching the jelly'], [0.55, 'Pouring'], [0.999, 'Setting'], [Infinity, 'Set']];

/** Dark ink on a light colour, paper-white on a dark one. */
function inkFor(hex) {
  const lin = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.42 ? '#2a221b' : '#fffaf2';
}

export function createLoader(root, reduced) {
  const $ = (s) => root.querySelector(s);
  const el = $('#loader'), svg = $('#loader-sea'), path = $('#loader-path');
  const no = $('#loader-no'), title = $('#loader-title'), caption = $('#loader-caption'), fill = $('#loader-fill'), state = $('#loader-state');
  let W = 1, H = 1, shown = 0, target = 0, creepTo = 0, cardAt = 0, covered = false, ticking = false;

  // The coloured field between a wavy top edge and a wavy bottom edge.
  function draw(top, bottom, amp, phase) {
    const n = 32, wave = (x, base) => base + amp * (0.65 * Math.sin(phase + (x / W) * 7.2) + 0.35 * Math.sin(phase * 1.7 - (x / W) * 12.5));
    let d = `M0 ${wave(0, top)}`;
    for (let k = 1; k <= n; k++) d += ` L${(W * k) / n} ${wave((W * k) / n, top)}`;
    for (let k = n; k >= 0; k--) d += ` L${(W * k) / n} ${wave((W * k) / n, bottom)}`;
    path.setAttribute('d', d + ' Z');
  }
  const fit = () => { W = innerWidth || 1; H = innerHeight || 1; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); };
  const tween = (ms, fn) => new Promise((res) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; fn(1, performance.now() / 1000); res(); };
    const step = (now) => {
      if (done) return;
      const t = (now - t0) / ms;
      if (t >= 1) { finish(); return; }
      fn(t, now / 1000); requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, ms + 60);
  });

  // the drop and the words follow the progress smoothly
  const paint = () => {
    fill.style.height = `${(shown * 100).toFixed(1)}%`;
    state.textContent = `${STAGES.find(([to]) => shown < to)[1]} · ${Math.round(shown * 100)}%`;
  };
  function tick() {
    if (!covered) { ticking = false; return; }
    if (creepTo > target) target += (creepTo - target) * 0.012;   // no news from the jelly: it is still setting
    shown += (target - shown) * 0.3;
    if (target - shown < 0.002) shown = target;
    paint();
    requestAnimationFrame(tick);
  }

  return {
    /** Cover the page in the colour of the jelly coming in (entry: { id, name, tint }). */
    async cover(entry, total, { instant = false } = {}) {
      el.style.setProperty('--tint', entry.tint);
      el.style.setProperty('--loader-ink', inkFor(entry.tint));
      no.innerHTML = `${entry.id}<small>/ ${String(total).padStart(2, '0')}</small>`;
      title.textContent = entry.name;
      caption.textContent = '';
      shown = target = creepTo = 0;
      paint();
      if (covered) return;   // already covered: a quick second click only changes the words
      covered = true;
      if (!ticking) { ticking = true; requestAnimationFrame(tick); }
      fit();
      el.hidden = false;
      if (instant || reduced.matches) { draw(-WAVE, H + WAVE, 0, 0); el.dataset.card = 'on'; cardAt = performance.now(); return; }
      el.dataset.card = 'off';
      await tween(RISE_MS, (t, s) => draw(H + WAVE - easeOut(t) * (H + 2.5 * WAVE), H + WAVE, WAVE * (1 - 0.7 * t), s * 5));
      el.dataset.card = 'on'; cardAt = performance.now();
    },
    /** The specimen's own words, once its module is in. */
    detail(meta) { caption.textContent = meta.caption?.[0] || ''; },
    progress(p) { target = Math.max(target, p); creepTo = Math.max(creepTo, target); },
    creep(to) { creepTo = to; },
    /** Lift the curtain once the jelly is live and has drawn a frame. */
    async reveal() {
      this.progress(1);
      await frame(); await frame();   // the jelly's first frame is on the canvas
      const wait = MIN_CARD_MS - (performance.now() - cardAt);
      if (wait > 0 && !reduced.matches) await new Promise((r) => setTimeout(r, wait));
      for (const until = performance.now() + 250; shown < 0.995 && performance.now() < until;) await frame();
      shown = 1; paint();
      el.dataset.card = 'off';
      if (!reduced.matches) {
        await new Promise((r) => setTimeout(r, 80));
        fit();
        await tween(LIFT_MS, (t, s) => draw(-WAVE, H + WAVE - easeInOut(t) * (H + 2.5 * WAVE), WAVE * Math.sin(Math.PI * t), s * 5));
      }
      el.hidden = true;
      covered = false;
    },
  };
}
