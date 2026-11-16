// The props you can see are solid to the ducks and to the pointer: a duck let go over the radio, the hourglass, a
// cooler or a chair's seat comes to rest on top of it (on it, not above it), one thrown hard at it from the side does not
// end inside it, a click on a duck beside a chair picks the duck, and a parasol's canopy hides what is under it from a
// click above but not what stands beside it. An open cooler's lid is clicked where it stands open, a duck on the
// hourglass does not hang in the air while it turns over, and the swan let go on a parasol stays on it.
// The props' sizes here are read off the drawn models (props.js placements, the meshes, scene.js's hourglass), not the
// solids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { A } from '@lid/diorama/parts.js';
import { P } from '../src/pool/layout.js';
import { COOLER_SITES, LID_OPEN } from '../src/pool/cooler-sites.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { createWorld } from '../src/pool/world.js';

const G = P.SIZE.glass;
/** A chair's canvas, read off its mesh straight down through its middle: [x along the chair (its front at -0.27), the
 * canvas's height] in the chair's units, which are the world's. */
const SLING = [[-0.27, 0.122], [-0.24, 0.123], [-0.21, 0.126], [-0.18, 0.13], [-0.15, 0.136], [-0.12, 0.145], [-0.09, 0.158],
  [-0.06, 0.174], [-0.03, 0.194], [0, 0.218], [0.03, 0.246], [0.06, 0.277], [0.09, 0.313], [0.12, 0.351], [0.15, 0.393]];
const sling = (x) => {
  const k = SLING.findIndex(([sx]) => sx > x);
  if (k <= 0) return k === 0 ? SLING[0][1] : -1;   // off its back (no canvas to rest on)
  const [[x0, y0], [x1, y1]] = [SLING[k - 1], SLING[k]];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
};
const ahead = (s) => [-Math.cos(s.yaw), Math.sin(s.yaw)];   // the way a chair faces: its -x
/** Each prop: where it stands (x, z), the ground under it, its top (at the duck's spot, where a duck dropped on its middle
 * rests), and a core well inside what is drawn, which no duck may end in (radius about its middle, from ground to top);
 * a chair's is its canvas, with open space under it: no duck may end more than 0.02 into it. */
const PROPS = [
  { name: 'radio', at: P.RADIO, y: P.TER, top: () => P.TER + 0.26, core: 0.06 },
  { name: 'hourglass', at: P.HOURGLASS, y: P.TER, top: () => P.TER + 0.5 * G, core: 0.2 },
  ...COOLER_SITES.map((s, i) => ({ name: `cooler ${i}`, at: [s.at[0], s.at[2]], y: s.at[1], top: () => s.at[1] + 0.206 * s.scale, core: 0.08 * s.scale })),
  // a chair's seat: where the canvas runs down from its back (0.08 ahead of the chair's foot); a duck rests on the
  // canvas wherever it stops, so the top is the canvas under it
  ...P.SEATS.map((s) => {
    const f = ahead(s), at = [s.at[0] + 0.08 * f[0], s.at[1] + 0.08 * f[1]], mx = (p) => -((p[0] - s.at[0]) * f[0] + (p[2] - s.at[1]) * f[1]);
    const top = (p = [at[0], 0, at[1]]) => s.y + sling(mx(p)), across = (p) => Math.abs((p[0] - s.at[0]) * f[1] - (p[2] - s.at[1]) * f[0]);
    return { name: s.label.toLowerCase(), at, y: s.y, top, seat: true,
      inside: (X, r) => mx(X) > -0.27 && mx(X) < 0.15 && across(X) < 0.17 && Math.abs(X[1] - top(X)) < r - 0.02 };
  }),
];
const lowest = (b) => Math.min(...b.x.map((X, i) => X[1] - b.r[i]));
/** A world with one duck in it, and that duck. */
const oneDuck = () => { const W = createWorld({ seed: 14, ducks: 1, arrivals: false }); return [W, W.ducks[0].body]; };
const carry = (W, b, p) => { W.hand.grab(b); W.hand.hold(b, p); };
const letGo = (W, b, p, s = 2) => { carry(W, b, p); W.hand.throw(b, [0, 0, 0]); b.w = [0, 0, 0]; W.step(120 * s); };

for (const q of PROPS) test(`a duck let go over the ${q.name} comes to rest on top of it`, () => {
  const [W, b] = oneDuck();
  letGo(W, b, [q.at[0], q.top() + 0.5, q.at[1]], 3);
  const off = Math.hypot(b.p[0] - q.at[0], b.p[2] - q.at[1]), top = q.top(b.p), e = q.seat ? 0.02 : 0.03;
  assert.ok(Math.abs(lowest(b) - top) < e && off < 0.3, `its lowest point ${lowest(b).toFixed(3)} (top ${top.toFixed(3)} under it), ${off.toFixed(3)} off the middle`);
  assert.ok(Math.hypot(...b.v) < 0.05, `still moving at ${Math.hypot(...b.v).toFixed(3)}`);
});

test('a duck let go over either end of the radio rests on it (it is as wide as drawn)', () => {
  const ux = Math.cos(0.4), uz = -Math.sin(0.4);   // the radio's length, as props.js turns it
  for (const k of [-0.15, 0.15]) {
    const [W, b] = oneDuck();
    letGo(W, b, [P.RADIO[0] + k * ux, P.TER + 0.6, P.RADIO[1] + k * uz], 3);
    assert.ok(Math.abs(lowest(b) - (P.TER + 0.26)) < 0.03, `at ${k}: its lowest point ${lowest(b).toFixed(3)}`);
  }
});

for (const q of PROPS) test(`a duck thrown hard at the ${q.name} from the side does not end inside it`, () => {
  for (const a of [0, 1.7, 3.6]) {
    const [W, b] = oneDuck(), top = q.top(), h = Math.min(top, q.y + 0.25) - 0.08;
    carry(W, b, [q.at[0] + 0.7 * Math.cos(a), Math.max(h, q.y + 0.12), q.at[1] + 0.7 * Math.sin(a)]);
    W.hand.throw(b, [-6 * Math.cos(a), 0.3, -6 * Math.sin(a)]);
    let inside = 0;
    for (let k = 0; k < 120 * 2; k++) {
      W.step(1);
      if (b.x.some((X, i) => (q.inside ? q.inside(X, b.r[i]) : Math.hypot(X[0] - q.at[0], X[2] - q.at[1]) < q.core && X[1] > q.y && X[1] < top))) inside++;
    }
    assert.ok(inside === 0, `thrown from ${a}: inside it for ${inside} ticks, ended at ${b.p.map((v) => v.toFixed(2))}`);
  }
});

test('a click on a duck beside a chair picks the duck, not the chair', () => {
  for (const s of P.SEATS) {
    const [W, b] = oneDuck(), side = [Math.sin(s.yaw), Math.cos(s.yaw)];   // across the chair, square to the way it faces
    letGo(W, b, [s.at[0] + side[0] * 0.45, s.y + 0.3, s.at[1] + side[1] * 0.45]);
    const hit = W.pick([b.p[0], b.p[1] + 2, b.p[2]], [0, -1, 0]);
    assert.equal(hit?.body, b, `${s.label}: picked ${hit?.kind}`);
  }
});

const lawnParasol = PLACEMENTS.find((p) => p.model === 'parasol' && p.at[1] === P.LAWN);

test("a duck under a parasol's canopy is not picked through the canopy from above, but is from the side", () => {
  const [x, y, z] = lawnParasol.at, [W, b] = oneDuck();
  letGo(W, b, [x + 0.3, y + 0.15, z]);
  assert.ok(Math.hypot(b.p[0] - x, b.p[2] - z) < 0.4, 'the duck stays under the canopy');
  assert.notEqual(W.pick([b.p[0], y + 3, b.p[2]], [0, -1, 0])?.body, b, 'picked through the canopy');
  assert.equal(W.pick([b.p[0], b.p[1], b.p[2] + 2], [0, 0, -1])?.body, b, 'not picked from the side');   // from the front (the ball lies off to the right)
});

test("a duck beside a parasol, seen past the canopy's sloping top, is picked", () => {
  const [W, b] = oneDuck(), eye = [-5.668, 3.94, 4.568];   // over the lawn, looking down past the canopy's edge
  letGo(W, b, [-3.9, 1.3, 2.8]);
  const d = b.p.map((v, i) => v - eye[i]), n = Math.hypot(...d);
  assert.equal(W.pick(eye, d.map((v) => v / n))?.body, b, `the duck at ${b.p.map((v) => v.toFixed(2))}`);
});

/** A cooler's open lid: its middle and the way its top faces, from the drawn lid (its middle at y 0.185) turned up. */
const openLid = (s) => {
  const M = A.mul(A.t(...s.at), A.ry(s.yaw), A.s(s.scale), LID_OPEN), c = A.apply(M, [0, 0.185, 0]), up = A.apply(M, [0, 0.285, 0]);
  const n = up.map((v, k) => v - c[k]), l = Math.hypot(...n);
  return [c, n.map((v) => v / l)];
};

test("an open cooler's lid is clicked where it stands open, on every cooler", () => {
  const W = createWorld({ seed: 14, ducks: 0, arrivals: false });
  COOLER_SITES.forEach((s, i) => {
    W.coolers.toggle(i);
    assert.ok(W.coolers.isOpen(i));
    const [c, n] = openLid(s), o = c.map((v, k) => v + n[k] * 1.5);
    const hit = W.pick(o, n.map((v) => -v));
    assert.equal(hit?.kind, 'cooler', `cooler ${i}: picked ${hit?.kind}`);
    assert.equal(hit.cooler, i);
  });
});

test("a duck thrown at an open cooler's lid bounces off it, on every cooler", () => {
  COOLER_SITES.forEach((s, i) => {
    const [W, b] = oneDuck(), [c, n] = openLid(s);
    W.coolers.toggle(i);
    carry(W, b, c.map((v, k) => v + n[k] * 0.3));
    W.hand.throw(b, n.map((v) => -v * 4));
    let worst = 9;
    for (let k = 0; k < 240; k++) { W.step(1); worst = Math.min(worst, (b.p[0] - c[0]) * n[0] + (b.p[1] - c[1]) * n[1] + (b.p[2] - c[2]) * n[2]); }
    assert.ok(worst > 0.05, `cooler ${i}: went ${(-worst).toFixed(3)} through the lid`);
  });
});

test('a duck asleep on a shut cooler lid drops when the lid is opened, on every cooler', () => {
  COOLER_SITES.forEach((s, i) => {
    const [W, b] = oneDuck(), top = s.at[1] + 0.206 * s.scale;
    letGo(W, b, [s.at[0], top + 0.5, s.at[2]], 3);
    assert.ok(b.sleep && Math.abs(lowest(b) - top) < 0.01, `cooler ${i}: it rests on the lid first`);
    W.coolers.toggle(i);
    W.step(120);
    assert.ok(lowest(b) < top - 0.01, `cooler ${i}: it hangs at ${lowest(b).toFixed(3)} where the lid was (${top.toFixed(3)})`);
  });
});

test('a duck left on a chair stays where it was put, not creeping down the canvas', () => {
  for (const s of P.SEATS) {
    const [W, b] = oneDuck(), f = ahead(s);
    letGo(W, b, [s.at[0] + 0.08 * f[0], s.y + 0.6, s.at[1] + 0.08 * f[1]], 3);
    const p = [...b.p];
    W.step(120 * 20);
    const moved = Math.hypot(b.p[0] - p[0], b.p[1] - p[1], b.p[2] - p[2]);
    assert.ok(moved < 0.01, `${s.label}: moved ${moved.toFixed(3)} in 20 s`);
  }
});

test('a duck on the hourglass does not sink into the glass while it is lifted and turned', () => {
  const [W, b] = oneDuck();
  letGo(W, b, [P.HOURGLASS[0], P.TER + 0.5 * G + 0.4, P.HOURGLASS[1]]);
  W.turnGlass();
  let deepest = -9;
  while (W.glass.turn) {
    W.step(1);
    // while the duck is over the glass: how far its lowest point is under the drawn glass's highest point (as below)
    const g = W.glass, e = g.turn * g.turn * (3 - 2 * g.turn), uy = Math.abs(Math.cos(Math.PI * e));
    const top = P.TER + G * (0.25 + 0.06 * Math.sin(Math.PI * g.turn) + 0.25 * uy + 0.13 * Math.sqrt(1 - uy * uy));
    if (Math.hypot(b.p[0] - P.HOURGLASS[0], b.p[2] - P.HOURGLASS[1]) < 0.12) deepest = Math.max(deepest, top - lowest(b));
  }
  // 0.21 with the glass lifted as drawn; 0.29 if its shape is not lifted
  assert.ok(deepest > 0 && deepest < 0.25, `at deepest ${deepest.toFixed(3)} under the glass's top`);
});

test('a duck on the hourglass does not hang in the air while it turns over', () => {
  const [W, b] = oneDuck();
  letGo(W, b, [P.HOURGLASS[0], P.TER + 0.5 * G + 0.4, P.HOURGLASS[1]]);
  assert.ok(Math.abs(lowest(b) - (P.TER + 0.5 * G)) < 0.03, 'it rests on the glass first');
  W.turnGlass();
  let worst = -1;
  while (W.glass.turn) {
    W.step(1);
    // the drawn glass's highest point (scene.js's pose: 0.13 round, 0.5 tall about its neck, lifted, turned over)
    const g = W.glass, e = g.turn * g.turn * (3 - 2 * g.turn), uy = Math.abs(Math.cos(Math.PI * e));
    const top = P.TER + G * (0.25 + 0.06 * Math.sin(Math.PI * g.turn) + 0.25 * uy + 0.13 * Math.sqrt(1 - uy * uy));
    worst = Math.max(worst, lowest(b) - top);
  }
  assert.ok(worst < 0.04, `at worst ${worst.toFixed(3)} above the glass`);
});

test('the swan let go on a parasol stays on it, not dropped to the ground under it', () => {
  const W = createWorld({ seed: 14, ducks: 0, arrivals: false }), s = W.swan, [x, y, z] = lawnParasol.at;
  W.hand.grab(s);
  for (let k = 0; k < 30; k++) { W.hand.hold(s, [x + 0.03, y + 1.6, z]); W.step(1); }
  W.hand.throw(s, [0, 0, 0]); s.w = [0, 0, 0];
  let drop = 0;
  for (let k = 0, h = s.p[1]; k < 120 * 3; k++, h = s.p[1]) { W.step(1); drop = Math.max(drop, h - s.p[1]); }
  assert.ok(drop < 0.15, `fell ${drop.toFixed(3)} in one tick`);
});

test('each prop the player can use is picked where it is drawn, from above and from the side', () => {
  const W = createWorld({ seed: 14, ducks: 0, arrivals: false });
  const want = [['glass', P.HOURGLASS, P.TER + 0.5 * G], ['radio', P.RADIO, P.TER + 0.2],
    ...COOLER_SITES.map((s, i) => ['cooler', [s.at[0], s.at[2]], s.at[1] + 0.15 * s.scale, i]),
    ...P.SEATS.map((s, i) => ['seat', s.at, s.y + 0.2, i])];
  for (const [kind, [x, z], y, i] of want) {
    for (const [o, d] of [[[x, y + 2, z], [0, -1, 0]], [[x, y - 0.08, z + 2], [0, 0, -1]]]) {   // from above, from the front
      const hit = W.pick(o, d);
      assert.equal(hit?.kind, kind, `${kind} ${i ?? ''} from ${o.map((v) => v.toFixed(1))}`);
      if (i !== undefined) assert.equal(hit.seat ?? hit.cooler, i);
    }
  }
});
