import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const tokens = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(block, `Missing ${selector} token block`);
  return Object.fromEntries([...block[1].matchAll(/(--pool-[\w-]+)\s*:\s*([^;]+)\s*;?/g)].map((m) => [m[1], m[2].trim()]));
};
const day = tokens(':root');
const night = { ...day, ...tokens('.pool.dark') };

function color(value) {
  const hex = value.match(/^#([\da-f]{6})$/i);
  if (hex) return [...hex[1].matchAll(/../g)].map((m) => parseInt(m[0], 16) / 255).concat(1);
  const rgb = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
  assert.ok(rgb, `Unsupported color: ${value}`);
  const c = rgb.slice(1, 4).map(Number).map((n) => n / 255);
  const a = rgb[4] === undefined ? 1 : Number(rgb[4]);
  assert.ok(c.every((n) => n >= 0 && n <= 1) && a >= 0 && a <= 1, `Invalid color: ${value}`);
  return [...c, a];
}
const over = (fg, bg) => fg.slice(0, 3).map((n, i) => n * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const luminance = (c) => c.slice(0, 3).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y); return (hi + 0.05) / (lo + 0.05); };

// Nominal sRGB scene samples, not a simulation of blur, lighting, exposure or bloom.
// Sand and grass: PAINT; sea and sky: daylight.js keys; foam: renderer.js whitecap albedo.
// Night sand uses unshaded PAINT sand as a conservative bright lamp-lit approximation.
const scenes = {
  day: { sand: '#ecd6a4', foam: '#edf2f5', sea: '#0b5a8c', grass: '#4a8a30' },
  night: { sky: '#0e1a3c', 'lamp-lit sand': '#ecd6a4' },
};
const pairs = [
  ['ink on glass', 'ink', null, 4.5], ['ink-2 on glass', 'ink-2', null, 4.5],
  ['ink-2 on fill', 'ink-2', 'fill', 4.5], ['on-ink on on', 'on-ink', 'on', 4.5],
  ['on-duck on duck', 'on-duck', 'duck', 4.5], ['danger on glass', 'danger', null, 4.5],
  ['danger on fill', 'danger', 'fill', 4.5], ['ink on white', 'ink', 'white', 4.5],
  ['edge on glass', 'edge', null, 3],   // WCAG 1.4.11: the line marks each surface's edge; the hard shadow under it is decoration
];
for (const [mode, palette] of Object.entries({ day, night })) {
  for (const [label, foreground, fill, minimum] of pairs) {
    test(`${mode}: ${label}`, () => {
      const raw = palette[`--pool-${foreground}`];
      const fg = color(raw);
      let worst = { ratio: Infinity, name: '' };
      for (const [name, value] of Object.entries(scenes[mode])) {
        const scene = color(value);
        const glass = over(color(palette['--pool-glass']), scene);
        const background = fill ? over(color(palette[`--pool-${fill}`]), glass) : glass;
        const ratio = contrast(over(fg, background), background);
        if (ratio < worst.ratio) worst = { ratio, name };
      }
      if (process.env.CONTRAST_REPORT) console.log(`${mode} | ${label} | ${worst.name} | ${worst.ratio.toFixed(3)}`);
      assert.ok(worst.ratio >= minimum, `${label} over ${mode} ${worst.name}: ${worst.ratio.toFixed(2)}:1, needs ${minimum}:1`);
    });
  }
}
