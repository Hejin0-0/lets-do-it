import { meshBuilder } from '../../core/cut/tools.js';

// ---------------------------------------------------------------------------
// The press: a kinematic round platen on a ram, two solid posts, and the stage's invisible walls, as one
// collider for the solver. The platen is a rounded disc (a distance field), so one push along its
// gradient makes it a ceiling (with friction) below, a shelf on top and a wall at its rim. Its contact
// load (the momentum it has to put into the jelly each substep) drives the pressure readout.
// ---------------------------------------------------------------------------
export const Press = (() => {
  const RAD = 1.05, TH = 0.16, ER = 0.04;   // platen radius, thickness, edge rounding
  const RAM = 0.24;                         // ram radius (a cylinder up from the platen)
  const POSTS = [[-1.72, 0], [1.72, 0]], POST_R = 0.12;
  const STAGE = { x: 3.1, zBack: -2.6, zFront: 1.85 };   // walls; the front edge keeps pieces off the controls
  const RP = 0.012, CAP = 0.02, MU = 0.6;
  const SPEED = 0.11;                       // descent speed while held (units/s), eased near the jelly

  function make(world, substeps) {
    const st = { y: 2.2, top: 2.2, vy: 0, target: 2.2, load: 0, touching: false, last: new Float32Array(0) };
    let acc = 0;
    const c = { d: 0, nx: 0, ny: 0, nz: 0 };
    // distance from a point to the rounded platen, and the outward direction there
    function platen(x, y, z) {
      const rh = Math.hypot(x, z), cy = st.y + TH / 2;
      const qx = rh - (RAD - ER), qy = Math.abs(y - cy) - (TH / 2 - ER);
      let gr, gy;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); c.d = l - ER; gr = qx / l; gy = qy / l; }
      else if (qx > qy) { c.d = qx - ER; gr = 1; gy = 0; }
      else { c.d = qy - ER; gr = 0; gy = 1; }
      const rx = rh > 1e-9 ? x / rh : 1, rz = rh > 1e-9 ? z / rh : 0;
      c.nx = gr * rx; c.ny = gy * (y >= cy ? 1 : -1); c.nz = gr * rz;
      return c;
    }
    let sumY = new Float64Array(0), cnt = new Uint32Array(0);
    function collider(P, V, n) {
      if (st.last.length !== P.length) st.last = new Float32Array(P);
      const mass = world.mass, pieceOf = world.piece, np = world.pieces.length;
      // each piece is wholly below or wholly above the platen (by its centroid), so none can straddle the steel
      if (cnt.length !== np) { sumY = new Float64Array(np); cnt = new Uint32Array(np); }
      sumY.fill(0); cnt.fill(0);
      for (let p = 0; p < n; p++) { sumY[pieceOf[p]] += P[3 * p + 1]; cnt[pieceOf[p]]++; }
      const mid = st.y + TH / 2;
      for (let i = 0, p = 0; p < n; i += 3, p++) {
        let x = P[i], y = P[i + 1], z = P[i + 2];
        world.pinY[p] &= 1;   // under the press only while it presses
        // the platen
        if (y > st.y - 0.1 && y < st.y + TH + 0.1 && x * x + z * z < (RAD + 0.1) ** 2) {
          const rh2 = x * x + z * z, k = pieceOf[p], below = sumY[k] < mid * cnt[k];
          if (rh2 < (RAD - ER) ** 2 && below && y > st.y - RP) {
            world.pinY[p] |= 2;
            // under the ceiling: whatever is below stays below, however hard the jelly pushes back
            // (a nearest-exit push would let it tunnel up through the steel); it holds what it presses
            // (friction), and the push is the load
            const push = y - (st.y - RP);
            y = st.y - RP;
            const lx = st.last[i], lz = st.last[i + 2];
            x = lx + (x - lx) * (1 - MU); z = lz + (z - lz) * (1 - MU);
            acc += mass[p] * push;
          } else if (rh2 < (RAD - ER) ** 2 && !below && y < st.y + TH + RP) {
            y = st.y + TH + RP;   // on the shelf: whatever lies on top stays on top
          } else {
            platen(x, y, z);   // the rounded rim
            if (c.d < RP) { const push = Math.min(CAP, RP - c.d); x += c.nx * push; y += c.ny * push; z += c.nz * push; }
          }
        }
        // the ram, above the platen
        if (y > st.y + TH) { const rh = Math.hypot(x, z); if (rh < RAM + RP) { const k = (RAM + RP) / (rh || 1e-9); x *= k; z *= k; } }
        // the posts
        for (const [px, pz] of POSTS) {
          const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
          if (d < POST_R + RP) { const k = (POST_R + RP) / (d || 1e-9); x = px + dx * k; z = pz + dz * k; }
        }
        // the stage's walls
        if (x < -STAGE.x) x = -STAGE.x; else if (x > STAGE.x) x = STAGE.x;
        if (z < STAGE.zBack) z = STAGE.zBack; else if (z > STAGE.zFront) z = STAGE.zFront;
        if (y > 5) y = 5;
        P[i] = x; P[i + 1] = y; P[i + 2] = z;
        st.last[i] = x; st.last[i + 1] = y; st.last[i + 2] = z;
      }
    }
    world.collider = collider;
    /** Move the platen and measure the load of the last step. dt: one sim step; jellyTop: highest jelly point. */
    function step(dt, holding, jellyTop) {
      const h = dt / substeps;
      const L = acc / (h * dt);   // sum m * push / h over the substeps, per second of this step
      acc = 0;
      st.load += (L - st.load) * 0.25;
      st.touching = L > 1e-3;
      if (holding) {
        const near = st.y - jellyTop;   // fast through the air, then a steady squeeze
        const v = SPEED * (near > 0.25 ? 6 : near > 0.04 ? 1.5 : 1);
        st.vy = -v;
        st.y = Math.max(0.03, st.y - v * dt);
        st.target = st.y;
      } else if (st.target > st.y + 1e-4) {   // raising
        st.vy = 1.1;
        st.y = Math.min(st.target, st.y + 1.1 * dt);
      } else st.vy = 0;
    }
    function raise(to) { st.target = to; }
    function reset(y) { st.y = st.target = st.top = y; st.vy = 0; st.load = 0; st.last = new Float32Array(0); acc = 0; }
    return { st, step, raise, reset };
  }
  return { make, RAD, TH, ER, RAM, POSTS, POST_R, STAGE };
})();

/** The press, modelled: fixed parts (materials 0..4) and the moving platen + ram (10..14). */
export function pressMesh() {
  const B = meshBuilder();
  const box = (x0, x1, y0, y1, z0, z1, m) => {
    const f = (pts, n) => B.grid(2, 2, false, (r, c) => { const p = pts[r][c]; return [p[0], p[1], p[2], n[0], n[1], n[2], m, p[0]]; });
    f([[[x0, y0, z1], [x1, y0, z1]], [[x0, y1, z1], [x1, y1, z1]]], [0, 0, 1]);
    f([[[x1, y0, z0], [x0, y0, z0]], [[x1, y1, z0], [x0, y1, z0]]], [0, 0, -1]);
    f([[[x1, y0, z1], [x1, y0, z0]], [[x1, y1, z1], [x1, y1, z0]]], [1, 0, 0]);
    f([[[x0, y0, z0], [x0, y0, z1]], [[x0, y1, z0], [x0, y1, z1]]], [-1, 0, 0]);
    f([[[x0, y1, z1], [x1, y1, z1]], [[x0, y1, z0], [x1, y1, z0]]], [0, 1, 0]);
    f([[[x0, y0, z0], [x1, y0, z0]], [[x0, y0, z1], [x1, y0, z1]]], [0, -1, 0]);
  };
  const cyl = (cx, cz, r, y0, y1, m, ns = 48) => {
    B.grid(2, ns, true, (row, k) => { const a = (k / ns) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a); return [cx + r * c, row ? y1 : y0, cz + r * s, c, 0, s, m, a]; });
    const ring = (y) => Array.from({ length: ns }, (_, k) => { const a = (k / ns) * 2 * Math.PI; return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]; });
    B.cap(ring(y1), [cx, y1, cz], [0, 1, 0], m, (p) => p[0]);
    B.cap(ring(y0), [cx, y0, cz], [0, -1, 0], m, (p) => p[0]);
  };
  for (const [px, pz] of Press.POSTS) {
    cyl(px, pz, Press.POST_R, 0, 3.9, 2);            // chrome posts
    cyl(px, pz, Press.POST_R + 0.07, 0, 0.07, 4);    // their foot collars
    cyl(px, pz, Press.POST_R + 0.06, 3.48, 3.55, 4); // and nuts under the beam
  }
  box(-2.06, 2.06, 3.55, 3.95, -0.32, 0.32, 3);      // the yellow crossbeam
  cyl(0, 0, 0.36, 1.95, 3.55, 3);                    // the hydraulic cylinder
  cyl(0, 0, 0.4, 1.9, 1.98, 4);                      // its collar
  // moving: the brushed platen with stepped edges, and the chrome ram (modelled with the platen's bottom at y = 0)
  cyl(0, 0, Press.RAD, 0.025, Press.TH - 0.025, 10, 96);
  cyl(0, 0, Press.RAD - 0.02, 0, 0.025, 10, 96);
  cyl(0, 0, Press.RAD - 0.02, Press.TH - 0.025, Press.TH, 10, 96);
  cyl(0, 0, Press.RAM, Press.TH, Press.TH + 1.95, 12);
  return B.done();
}