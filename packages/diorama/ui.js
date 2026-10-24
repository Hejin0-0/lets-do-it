// The page every jelly-block diorama wears, like a print magazine: the masthead top left, a status pill top
// right, a frosted control panel on the right (a bottom sheet on a phone), "how to play" bottom left. Styles
// are scoped under the specimen's class; the classes are dio-* so the shell's own never reach in.
// Markup helpers for the panel's parts, and the wiring every panel shares.

/** The scoped styles. o: { paper, accent } */
export function dioramaCSS(S, { paper, accent }) {
  return `
.extra > .${S} { pointer-events: none; font: 400 14px/1.4 var(--sans); color: var(--ink); --paper: ${paper}; --ink: #241f1d; --ink-2: #5b544e; --ink-3: #958c84; --rule: #d5d0c8; --glass: rgba(247, 245, 241, .86); --accent: ${accent}; --button: #352b29; --button-h: #4a3c39; --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif; --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; --edge: clamp(20px, 3.2vw, 48px); --top: clamp(18px, 3.4vh, 40px); }
.${S} .overlay { position: fixed; inset: 0 0 var(--nav-h, 0px); pointer-events: none; }
.${S} .dio-eyebrow { font: 600 11px/1.2 var(--sans); letter-spacing: .18em; text-transform: uppercase; color: var(--ink-2); }
.${S} .mast { position: absolute; left: var(--edge); top: var(--top); max-width: 480px; }
.${S} .mast h1 { font-family: var(--serif); font-style: italic; font-weight: 400; font-size: clamp(56px, 8.4vw, 116px); line-height: .88; letter-spacing: -.02em; margin: .16em 0 0; }
.${S} .rule { width: 44px; height: 1px; background: var(--ink); margin: 20px 0 14px; }
.${S} .dio-caption { font: italic 17px/1.4 var(--serif); color: var(--ink-2); max-width: 300px; margin: 0; }
.${S} .dio-status { position: absolute; top: var(--top); right: var(--edge); pointer-events: auto; display: flex; align-items: center; gap: 9px; padding: 8px 13px; border: 1px solid var(--rule); border-radius: 999px; background: var(--glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); font: 600 10.5px/1 var(--sans); letter-spacing: .15em; text-transform: uppercase; color: var(--ink-2); }
.${S} .dot { width: 7px; height: 7px; border-radius: 50%; background: #3c9a5f; box-shadow: 0 0 0 3px rgba(60, 154, 95, .18); transition: background .2s, opacity .2s; }
.${S} .dio-status.paused .dot { background: #d39b2c; box-shadow: 0 0 0 3px rgba(211, 155, 44, .18); opacity: .55; }
.${S} .dio-status.off .dot { background: #c4473a; box-shadow: 0 0 0 3px rgba(196, 71, 58, .18); }
.${S} .dio-panel { position: absolute; right: var(--edge); top: calc(var(--top) + 48px); width: 268px; max-height: calc(100vh - var(--top) - 72px); overflow: auto; pointer-events: auto; background: var(--glass); -webkit-backdrop-filter: blur(16px) saturate(1.15); backdrop-filter: blur(16px) saturate(1.15); border: 1px solid var(--rule); border-radius: 14px; padding: 18px 18px 16px; }
.${S} .dio-panel section + section { border-top: 1px solid var(--rule); margin-top: 16px; padding-top: 15px; }
.${S} .dio-label { font: 600 10.5px/1 var(--sans); letter-spacing: .17em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 11px; }
.${S} button { font: inherit; color: inherit; }
.${S} .btn-dark { background: var(--button); color: #f7f5f1; border: 0; border-radius: 8px; padding: 11px 6px; font: 500 12.5px/1.1 var(--sans); cursor: pointer; transition: background .15s; }
.${S} .btn-dark:hover { background: var(--button-h); }
.${S} .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.${S} .meter { height: 2px; background: var(--rule); margin: 15px 0 11px; position: relative; overflow: hidden; }
.${S} .meter > span { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--accent); }
.${S} .tally { font: 12.5px/1.3 var(--sans); color: var(--ink-2); margin: 0; }
.${S} .tally b { font: 500 12.5px var(--mono); color: var(--ink); }
.${S} .dio-swatches { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.${S} .dio-swatch { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 11px 4px 9px; border: 1px solid var(--rule); border-radius: 10px; background: transparent; cursor: pointer; font: 12px/1 var(--sans); color: var(--ink-2); transition: border-color .15s, color .15s; }
.${S} .dio-swatch:hover { border-color: var(--ink-3); }
.${S} .dio-swatch[aria-pressed="true"] { border-color: var(--ink); color: var(--ink); }
.${S} .dio-swatch i { width: 22px; height: 22px; border-radius: 50%; display: block; box-shadow: inset 0 -2px 4px rgba(0, 0, 0, .16), 0 1px 2px rgba(0, 0, 0, .14); }
.${S} .sl { display: grid; grid-template-columns: 1fr auto; align-items: center; row-gap: 5px; margin: 0 0 13px; font: 13px/1.2 var(--sans); color: var(--ink); }
.${S} .sl:last-child { margin-bottom: 0; }
.${S} .sl output { font: 12px var(--mono); color: var(--ink-2); }
.${S} .sl input { grid-column: 1 / -1; }
.${S} input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 20px; background: transparent; margin: 0; cursor: pointer; }
.${S} input[type=range]::-webkit-slider-runnable-track { height: 1px; background: var(--ink-3); }
.${S} input[type=range]::-moz-range-track { height: 1px; background: var(--ink-3); }
.${S} input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--paper); border: 1px solid var(--ink); margin-top: -7.5px; box-shadow: 0 1px 3px rgba(0, 0, 0, .14); }
.${S} input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--paper); border: 1px solid var(--ink); }
.${S} .dio-row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.${S} .dio-row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.${S} .btn-line { background: transparent; border: 1px solid var(--ink-3); border-radius: 8px; padding: 9px 2px; font: 12px/1.1 var(--sans); color: var(--ink); cursor: pointer; transition: border-color .15s; }
.${S} .btn-line:hover { border-color: var(--ink); }
.${S} .dio-story { font: italic 14px/1.35 var(--serif); color: var(--ink); margin: 0 0 12px; min-height: 2.7em; }
.${S} .dio-story b { font: 600 10.5px/1 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); font-style: normal; margin-right: 6px; }
.${S} .dio-foot { position: absolute; left: var(--edge); bottom: clamp(18px, 3.4vh, 36px); max-width: 440px; }
.${S} .dio-foot .big { font: italic 22px/1.25 var(--serif); margin: 8px 0 6px; color: var(--ink); }
.${S} .dio-foot .small { font: 12px/1.5 var(--sans); color: var(--ink-2); margin: 0; }
.${S} .sheet-bar { display: none; }
.${S} :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 900px) {
  .extra > .${S} { --edge: 16px; --top: 14px; }
  .${S} .mast h1 { font-size: clamp(40px, 13vw, 58px); }
  .${S} .mast .dio-eyebrow { max-width: calc(100vw - 2 * var(--edge) - 160px); }   /* wraps clear of the status pill */
  .${S} .rule { margin: 12px 0 9px; }
  .${S} .dio-caption { font-size: 15px; max-width: 230px; }
  .${S} .dio-panel { left: 0; right: 0; bottom: 0; top: auto; width: auto; max-height: 62vh; padding: 0; overflow: hidden; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; border-width: 1px 0 0; transform: translateY(calc(100% - 54px - max(0px, env(safe-area-inset-bottom) - var(--nav-h, 0px)))); transition: transform .3s cubic-bezier(.2, .7, .2, 1); }
  .${S} .dio-panel.open { transform: none; }
  .${S} .sheet-bar { display: flex; align-items: center; justify-content: space-between; flex: 0 0 54px; height: 54px; width: 100%; padding: 0 20px; background: transparent; border: 0; font: 600 11px/1 var(--sans); letter-spacing: .17em; text-transform: uppercase; color: var(--ink); cursor: pointer; position: sticky; top: 0; }
  .${S} .grip { width: 36px; height: 4px; border-radius: 2px; background: var(--ink-3); }
  .${S} .panel-body { overflow: auto; padding: 2px 20px calc(20px + env(safe-area-inset-bottom)); }
  .${S} .dio-foot { left: 16px; right: 16px; max-width: none; bottom: calc(54px + 12px + env(safe-area-inset-bottom)); }
  .${S} .dio-foot .big { font-size: 18px; margin: 6px 0 4px; }
  .${S} .dio-foot .small { font-size: 11.5px; }
  .${S}.sheet-open .dio-caption, .${S}.sheet-open .dio-foot { display: none; }
}
@media (max-height: 500px) and (orientation: landscape) {
  .${S} .mast h1 { font-size: 34px; }
  .${S} .dio-caption, .${S} .dio-foot { display: none; }
}
@media (min-width: 901px) and (max-height: 760px) {
  .${S} .dio-foot .small { display: none; }
}`;
}

/**
 * The page: o: { scope, paper, accent, no ('010'), title: [line1, line2], caption, sections: [html], howTo: { big, small }, css? (extra rules) }
 */
export function dioramaPage(o) {
  return /* html */`
<div class="${o.scope}">
<style>${dioramaCSS(o.scope, o)}${o.css || ''}</style>
<div class="overlay">
  <header class="mast" id="mast">
    <div class="dio-eyebrow">${o.eyebrow ?? `Material Studies / No.&nbsp;${o.no}`}</div>
    <h1>${o.title[0]}<br>${o.title[1]}</h1>
    <div class="rule"></div>
    <p class="dio-caption">${o.caption}</p>
  </header>
  <div class="dio-status" id="dio-status" role="status"><span class="dot" aria-hidden="true"></span><span id="statusText">WebGPU · Live</span></div>
  <aside class="dio-panel" id="dio-panel" aria-label="Controls">
    <button class="sheet-bar" id="sheetBar" aria-expanded="false" aria-controls="panelBody"><span>Controls</span><span class="grip" aria-hidden="true"></span></button>
    <div class="panel-body" id="panelBody">
${o.sections.map((s) => `      <section>${s}</section>`).join('\n')}
    </div>
  </aside>
  <footer class="dio-foot" id="dio-foot">
    <div class="dio-eyebrow">How to play</div>
    <p class="big">${o.howTo.big}</p>
    <p class="small">${o.howTo.small}</p>
  </footer>
</div>
</div>`;
}

// ----- panel parts -----
export const ui = {
  label: (text) => `<h2 class="dio-label">${text}</h2>`,
  /** list: [{ id, label, grad: [light, mid, dark] }]; the first is pressed. */
  swatches: (aria, list) => `<div class="dio-swatches" role="group" aria-label="${aria}">${list.map((f, i) =>
    `<button class="dio-swatch" data-flavour="${f.id}" aria-pressed="${i === 0}"><i style="background: radial-gradient(circle at 35% 30%, ${f.grad[0]}, ${f.grad[1]} 55%, ${f.grad[2]})"></i>${f.label}</button>`).join('')}</div>`,
  slider: (id, label, min, max, value, out) => `<label class="sl"><span>${label}</span><output id="${id}Out" for="${id}">${out}</output><input type="range" id="${id}" min="${min}" max="${max}" value="${value}"></label>`,
  meter: (aria) => `<div class="meter" id="meter" role="meter" aria-label="${aria}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meterBar"></span></div>`,
  /** Dark buttons, two to a row: [[id, label], ...]. */
  dark: (list) => `<div class="row2">${list.map(([id, label]) => `<button class="btn-dark" id="${id}">${label}</button>`).join('')}</div>`,
  /** A row of outline buttons: [[id, label, pressed?], ...] (3 or 4 to a row). */
  line: (list) => `<div class="dio-row${list.length === 4 ? 4 : 3}">${list.map(([id, label, pr]) => `<button class="btn-line" id="${id}"${pr === undefined ? '' : ` aria-pressed="${pr}"`}>${label}</button>`).join('')}</div>`,
};

/** The wiring every panel shares. */
export function wirePanel(root, on, stage) {
  const $ = (id) => root.querySelector('#' + id);
  on($('sheetBar'), 'click', () => {
    const open = !$('dio-panel').classList.contains('open');
    $('dio-panel').classList.toggle('open', open);
    root.classList.toggle('sheet-open', open);
    $('sheetBar').setAttribute('aria-expanded', String(open));
  });
  return {
    $,
    setPaused(p) {
      const b = $('pause');
      if (b) { b.textContent = p ? 'Resume' : 'Pause'; b.setAttribute('aria-pressed', String(p)); }
      $('dio-status').classList.toggle('paused', p);
      $('statusText').textContent = p ? 'WebGPU · Paused' : 'WebGPU · Live';
    },
    /** fn(value, outputElement), now and on every input. */
    slider(id, fn) { const el = $(id), apply = () => fn(+el.value, $(id + 'Out')); on(el, 'input', apply); apply(); },
    swatches(fn) { for (const b of root.querySelectorAll('.dio-swatch')) on(b, 'click', () => fn(b.dataset.flavour)); },
    pressSwatch(name) { for (const b of root.querySelectorAll('.dio-swatch')) b.setAttribute('aria-pressed', String(b.dataset.flavour === name)); },
    meter(m) { $('meterBar').style.width = m + '%'; $('meter').setAttribute('aria-valuenow', String(m)); },
    /** The page blocks the camera keeps the diorama clear of. */
    obstacles: () => [$('mast'), $('dio-foot'), innerWidth > 900 ? $('dio-panel') : $('sheetBar'), $('dio-status'), stage.$('.panel')],
  };
}
