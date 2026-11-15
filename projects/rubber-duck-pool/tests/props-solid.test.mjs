// The props you can see are solid to the ducks and to the pointer: a duck let go over the radio, the hourglass, a
// cooler or a chair's seat comes to rest on top of it, one thrown hard at it from the side does not end inside it, a
// click on a duck beside a chair picks the duck, and a parasol's canopy hides what is under it from a click above.
// The props' sizes here are read off the drawn models (props.js placements, scenery.js's hourglass), not the solids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { P } from '../src/pool/layout.js';
import { COOLER_SITES } from '../src/pool/cooler-sites.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { createWorld } from '../src/pool/world.js';

const G = P.SIZE.glass;
/** Each prop: where it stands (x, z), the ground under it, its top (where a duck dropped on its middle rests), and a
 * core well inside what is drawn, which no duck may end in (radius about its middle, from ground to top). */
const PROPS = [
  { name: 'radio', at: P.RADIO, y: P.TER, top: P.TER + 0.25, core: 0.06 },
  { name: 'hourglass', at: P.HOURGLASS, y: P.TER, top: P.TER + 0.5 * G - 0.02, core: 0.2 },
  ...COOLER_SITES.map((s, i) => ({ name: `cooler ${i}`, at: [s.at[0], s.at[2]], y: s.at[1], top: s.at[1] + 0.18 * s.scale, core: 0.08 * s.scale })),
  // a chair's seat: its middle a little forward of the chair's foot (its back leans over the rest), the way it faces
  ...P.SEATS.map((s) => ({ name: s.label.toLowerCase(), at: [s.at[0] - 0.08 * Math.cos(s.yaw), s.at[1] + 0.08 * Math.sin(s.yaw)], y: s.y, top: s.y + 0.24, core: 0.12 })),
];
const lowest = (b) => Math.min(...b.x.map((X, i) => X[1] - b.r[i]));
/** A world with one duck in it, and that duck. */
const oneDuck = () => { const W = createWorld({ seed: 14, ducks: 1, arrivals: false }); return [W, W.ducks[0].body]; };
const carry = (W, b, p) => { W.hand.grab(b); W.hand.hold(b, p); };

for (const q of PROPS) test(`a duck let go over the ${q.name} comes to rest on top of it`, () => {
  const [W, b] = oneDuck();
  carry(W, b, [q.at[0], q.top + 0.5, q.at[1]]);
  W.hand.throw(b, [0, 0, 0]); b.w = [0, 0, 0];
  W.step(120 * 3);
  const off = Math.hypot(b.p[0] - q.at[0], b.p[2] - q.at[1]);
  assert.ok(lowest(b) > q.top - 0.03 && off < 0.3, `its lowest point ${lowest(b).toFixed(3)} (top ${q.top.toFixed(3)}), ${off.toFixed(3)} off the middle`);
  assert.ok(Math.hypot(...b.v) < 0.05, `still moving at ${Math.hypot(...b.v).toFixed(3)}`);
});

for (const q of PROPS) test(`a duck thrown hard at the ${q.name} from the side does not end inside it`, () => {
  for (const a of [0, 1.7, 3.6]) {
    const [W, b] = oneDuck(), h = Math.min(q.top, q.y + 0.25) - 0.08;
    carry(W, b, [q.at[0] + 0.7 * Math.cos(a), Math.max(h, q.y + 0.12), q.at[1] + 0.7 * Math.sin(a)]);
    W.hand.throw(b, [-6 * Math.cos(a), 0.3, -6 * Math.sin(a)]);
    let inside = 0;
    for (let k = 0; k < 120 * 2; k++) {
      W.step(1);
      if (b.x.some((X) => Math.hypot(X[0] - q.at[0], X[2] - q.at[1]) < q.core && X[1] > q.y && X[1] < q.top)) inside++;
    }
    assert.ok(inside === 0, `thrown from ${a}: inside it for ${inside} ticks, ended at ${b.p.map((v) => v.toFixed(2))}`);
  }
});

test('a click on a duck beside a chair picks the duck, not the chair', () => {
  for (const s of P.SEATS) {
    const [W, b] = oneDuck(), side = [Math.sin(s.yaw), Math.cos(s.yaw)];   // across the chair, square to the way it faces
    carry(W, b, [s.at[0] + side[0] * 0.45, s.y + 0.3, s.at[1] + side[1] * 0.45]);
    W.hand.throw(b, [0, 0, 0]); b.w = [0, 0, 0];
    W.step(120 * 2);
    const hit = W.pick([b.p[0], b.p[1] + 2, b.p[2]], [0, -1, 0]);
    assert.equal(hit?.body, b, `${s.label}: picked ${hit?.kind}`);
  }
});

test("a duck under a parasol's canopy is not picked through the canopy from above, but is from the side", () => {
  const parasol = PLACEMENTS.find((p) => p.model === 'parasol' && p.at[1] === P.LAWN), [x, y, z] = parasol.at;
  const [W, b] = oneDuck();
  carry(W, b, [x + 0.3, y + 0.15, z]);
  W.hand.throw(b, [0, 0, 0]); b.w = [0, 0, 0];
  W.step(120 * 2);
  assert.ok(Math.hypot(b.p[0] - x, b.p[2] - z) < 0.4, 'the duck stays under the canopy');
  assert.notEqual(W.pick([b.p[0], y + 3, b.p[2]], [0, -1, 0])?.body, b, 'picked through the canopy');
  assert.equal(W.pick([b.p[0], b.p[1], b.p[2] + 2], [0, 0, -1])?.body, b, 'not picked from the side');   // from the front (the ball lies off to the right)
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
