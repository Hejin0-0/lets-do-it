// The body of a jelly that can be cut: every piece (a region of the kernel's rest plane, its meshes
// and its embedding) lives in one tetrahedral world. It speaks the sim contract runJellyPage drives
// (page.js) and adds what the cutting tools need: picking and landing points, a piece's best-fit
// rigid frame, and swapping planned pieces in mid-motion.
//
// channels(mesh) -> [{ key, pts: Float32Array xyz, index?: Uint32Array (local), inst?: Float32Array
// (4 per instance) }] lists what rides inside a piece besides its surface, in a fixed order. Instanced
// seeds must come before the bubbles: the bubble shader reads its radii after the seeds' instances.

/** Rest normals of a triangle mesh (area-weighted). */
function vertexNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    n[a] += cx; n[a + 1] += cy; n[a + 2] += cz; n[b] += cx; n[b + 1] += cy; n[b + 2] += cz; n[c] += cx; n[c + 1] += cy; n[c + 2] += cz;
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/**
 * kernel: createSliceKernel(...) (sliceRegion, buildPiece); sim: tetSim(...) (createWorld, embed);
 * beforeStep?(dt): runs before every fixed step (a tool's choreography); maxSteps: per frame at most.
 */
export function createCutBody({ kernel, sim, channels, maxPieces = 14, beforeStep = null, grabRadius = 0.25, step = 1 / 60, maxSteps = 4 }) {
  const world = sim.createWorld();
  let pieces = [];   // { region, mesh, emb } — same order as world.pieces
  let acc = 0, rebuilt = false, pending = null;
  const View = { nv: 0, index: new Uint32Array(0), embIdx: new Uint32Array(0), embW: new Float32Array(0), surf: new Float32Array(0), prev: new Float32Array(0), nodes: new Float32Array(0) };

  /** Surface, then each channel's points, embedded in the piece's own tets (local indices). */
  function embedPiece(mesh) {
    const r = mesh.render.pos, ch = channels(mesh);
    let len = r.length;
    for (const c of ch) len += c.pts.length;
    const pts = new Float32Array(len);
    pts.set(r);
    for (let c = 0, o = r.length; c < ch.length; o += ch[c].pts.length, c++) pts.set(ch[c].pts, o);
    const e = sim.embed(mesh.sim.X, mesh.sim.tets, pts), n = pts.length / 3, idx = new Uint32Array(n * 4);
    for (let p = 0; p < n; p++) for (let c = 0; c < 4; c++) idx[4 * p + c] = mesh.sim.tets[4 * e.tet[p] + c];
    return { idx, w: e.w, restNrm: vertexNormals(r, mesh.render.index), ch };
  }
  function makePiece(region) {
    const mesh = kernel.buildPiece(region);
    return { region, mesh, emb: embedPiece(mesh) };
  }

  // ----- everything the renderer and the picker need, concatenated over all pieces -----
  function assemble() {
    const keys = pieces[0] ? pieces[0].emb.ch.map((c) => c.key) : [];
    const tot = keys.map(() => ({ pts: 0, tri: 0, inst: 0 }));
    let nv = 0, nTri = 0;
    for (const pc of pieces) {
      nv += pc.mesh.render.pos.length / 3; nTri += pc.mesh.render.index.length;
      pc.emb.ch.forEach((c, j) => { tot[j].pts += c.pts.length / 3; tot[j].tri += c.index ? c.index.length : 0; tot[j].inst += c.inst ? c.inst.length / 4 : 0; });
    }
    // layout: the render surface, then each channel's points over all pieces
    const ch = {};
    let base = nv, instBase = 0;
    keys.forEach((k, j) => {
      ch[k] = { base, count: tot[j].pts, index: tot[j].tri ? new Uint32Array(tot[j].tri) : null, instBase, instCount: tot[j].inst };
      base += tot[j].pts; instBase += tot[j].inst;
    });
    const np = base, idx = new Uint32Array(np * 4), w = new Float32Array(np * 4);
    const index = new Uint32Array(nTri), rest = new Float32Array(nv * 8), inst = new Float32Array(instBase * 4);
    const off = keys.map(() => ({ p: 0, t: 0, i: 0 }));
    let ov = 0, ot = 0;
    pieces.forEach((pc, k) => {
      const start = world.pieces[k].start, ms = pc.mesh, e = pc.emb, pv = ms.render.pos.length / 3;
      const put = (local, global) => {
        for (let c = 0; c < 4; c++) { idx[4 * global + c] = start + e.idx[4 * local + c]; w[4 * global + c] = e.w[4 * local + c]; }
      };
      for (let v = 0; v < pv; v++) {
        put(v, ov + v);
        rest.set([ms.render.pos[3 * v], ms.render.pos[3 * v + 1], ms.render.pos[3 * v + 2], 0, e.restNrm[3 * v], e.restNrm[3 * v + 1], e.restNrm[3 * v + 2], 0], 8 * (ov + v));
      }
      for (let t = 0; t < ms.render.index.length; t++) index[ot + t] = ov + ms.render.index[t];
      let local = pv;
      e.ch.forEach((c, j) => {
        const C = ch[keys[j]], o = off[j], n = c.pts.length / 3;
        for (let v = 0; v < n; v++) put(local + v, C.base + o.p + v);
        if (c.index) for (let t = 0; t < c.index.length; t++) C.index[o.t + t] = C.base + o.p + c.index[t];
        if (c.inst) inst.set(c.inst, 4 * (C.instBase + o.i));
        o.p += n; o.t += c.index ? c.index.length : 0; o.i += c.inst ? c.inst.length / 4 : 0; local += n;
      });
      ov += pv; ot += ms.render.index.length;
    });
    // vertex -> incident triangles (CSR) for the GPU normal pass
    const offsets = new Uint32Array(nv + 1);
    for (let t = 0; t < index.length; t++) offsets[index[t] + 1]++;
    for (let i = 0; i < nv; i++) offsets[i + 1] += offsets[i];
    const triangles = new Uint32Array(index.length), cur = offsets.slice(0, nv);
    for (let t = 0; t < index.length; t++) triangles[cur[index[t]]++] = (t / 3) | 0;

    View.nv = nv; View.index = index; View.embIdx = idx; View.embW = w;
    View.surf = new Float32Array(nv * 3);
    View.prev = new Float32Array(world.x);
    View.nodes = new Float32Array(world.n * 4);
    const B = ch.bubbles, S = ch.seeds && ch.seeds.instCount ? ch.seeds : null;
    return { n: world.n, np, nv, emb: { idx, w }, index, adjacency: { offsets, triangles }, rest, inst, ch, edges: world.edges,
      bubbleBase: B ? B.base : 0, bubbleCount: B ? B.instCount : 0, seedBase: S ? S.base : 0, seedCount: S ? S.instCount : 0 };
  }

  function resetSpecimen(drop) {
    world.grabEnd?.();
    pieces = [makePiece(kernel.sliceRegion())];
    world.setPieces(pieces.map((p) => ({ X: p.mesh.sim.X, tets: p.mesh.sim.tets })));
    if (drop) for (let i = 1; i < world.x.length; i += 3) world.x[i] += 0.35;
    pending = assemble(); rebuilt = false; acc = 0;
  }

  // ----- picking on the skinned surface (CPU), with a forgiving fallback to the nearest particle -----
  function skinSurface(x) {
    const s = View.surf, I = View.embIdx, W = View.embW;
    for (let p = 0; p < View.nv; p++) {
      let px = 0, py = 0, pz = 0;
      for (let k = 0; k < 4; k++) { const o = 3 * I[4 * p + k], wk = W[4 * p + k]; px += x[o] * wk; py += x[o + 1] * wk; pz += x[o + 2] * wk; }
      s[3 * p] = px; s[3 * p + 1] = py; s[3 * p + 2] = pz;
    }
    return s;
  }
  function pick(ro, rd, forgiving = true) {
    const sp = skinSurface(world.x), tri = View.index;
    let best = Infinity;
    for (let t = 0; t < tri.length; t += 3) {
      const a = 3 * tri[t], b = 3 * tri[t + 1], c = 3 * tri[t + 2];
      const e1x = sp[b] - sp[a], e1y = sp[b + 1] - sp[a + 1], e1z = sp[b + 2] - sp[a + 2];
      const e2x = sp[c] - sp[a], e2y = sp[c + 1] - sp[a + 1], e2z = sp[c + 2] - sp[a + 2];
      const px = rd[1] * e2z - rd[2] * e2y, py = rd[2] * e2x - rd[0] * e2z, pz = rd[0] * e2y - rd[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const id = 1 / det, tx = ro[0] - sp[a], ty = ro[1] - sp[a + 1], tz = ro[2] - sp[a + 2];
      const u = (tx * px + ty * py + tz * pz) * id;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (rd[0] * qx + rd[1] * qy + rd[2] * qz) * id;
      if (v < 0 || u + v > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (d > 0 && d < best) best = d;
    }
    if (best < Infinity) return [ro[0] + rd[0] * best, ro[1] + rd[1] * best, ro[2] + rd[2] * best];
    if (!forgiving) return null;
    // forgiving: the particle nearest the ray, if it passes within 0.18
    const x = world.x;
    let bi = -1, bd = 0.18 * 0.18;
    for (let i = 0; i < world.n; i++) {
      const dx = x[3 * i] - ro[0], dy = x[3 * i + 1] - ro[1], dz = x[3 * i + 2] - ro[2], t = dx * rd[0] + dy * rd[1] + dz * rd[2];
      if (t <= 0) continue;
      const d2 = dx * dx + dy * dy + dz * dz - t * t;
      if (d2 < bd) { bd = d2; bi = i; }
    }
    return bi < 0 ? null : [x[3 * bi], x[3 * bi + 1], x[3 * bi + 2]];
  }
  /** Where a ray lands: on the jelly if it hits it, else on the board. */
  function landing(ro, rd) {
    const j = pick(ro, rd, false);
    if (j) return { p: j, onJelly: true };
    const t = rd[1] < -1e-4 ? -ro[1] / rd[1] : 40;
    return { p: [ro[0] + rd[0] * t, 0, ro[2] + rd[2] * t], onJelly: false };
  }
  /** Highest particle within r of (x0, z0) in plan; 0 on the bare board. */
  function topNear(x0, z0, r) {
    const x = world.x;
    let top = 0;
    for (let i = 0; i < world.n; i++) { const dx = x[3 * i] - x0, dz = x[3 * i + 2] - z0; if (dx * dx + dz * dz < r * r && x[3 * i + 1] > top) top = x[3 * i + 1]; }
    return top;
  }
  function nearJelly(p, r) {
    const x = world.x;
    for (let i = 0; i < world.n; i++) { const dx = x[3 * i] - p[0], dz = x[3 * i + 2] - p[2]; if (dx * dx + dz * dz < r * r) return true; }
    return false;
  }

  // ----- best-fit rigid frame of a deformed piece: current ~ R (rest - cr) + cx -----
  function fitFrame(k) {
    const pc = world.pieces[k], x = world.x, r = world.rest, s = pc.start, n = pc.count;
    const cx = [0, 0, 0], cr = [0, 0, 0];
    for (let i = s; i < s + n; i++) for (let a = 0; a < 3; a++) { cx[a] += x[3 * i + a]; cr[a] += r[3 * i + a]; }
    for (let a = 0; a < 3; a++) { cx[a] /= n; cr[a] /= n; }
    const A = new Float64Array(9);   // A = sum (x - cx)(r - cr)^T, row-major
    for (let i = s; i < s + n; i++) {
      const p0 = x[3 * i] - cx[0], p1 = x[3 * i + 1] - cx[1], p2 = x[3 * i + 2] - cx[2];
      const q0 = r[3 * i] - cr[0], q1 = r[3 * i + 1] - cr[1], q2 = r[3 * i + 2] - cr[2];
      A[0] += p0 * q0; A[1] += p0 * q1; A[2] += p0 * q2; A[3] += p1 * q0; A[4] += p1 * q1; A[5] += p1 * q2; A[6] += p2 * q0; A[7] += p2 * q1; A[8] += p2 * q2;
    }
    // rotation part by the quaternion iteration of Müller et al. 2016
    let q = [0, 0, 0, 1];
    const R = new Float64Array(9);
    for (let it = 0; it < 40; it++) {
      const [qx, qy, qz, qw] = q;
      R[0] = 1 - 2 * (qy * qy + qz * qz); R[1] = 2 * (qx * qy - qz * qw); R[2] = 2 * (qx * qz + qy * qw);
      R[3] = 2 * (qx * qy + qz * qw); R[4] = 1 - 2 * (qx * qx + qz * qz); R[5] = 2 * (qy * qz - qx * qw);
      R[6] = 2 * (qx * qz - qy * qw); R[7] = 2 * (qy * qz + qx * qw); R[8] = 1 - 2 * (qx * qx + qy * qy);
      let ox = 0, oy = 0, oz = 0, den = 0;
      for (let c = 0; c < 3; c++) {
        const r0 = R[c], r1 = R[3 + c], r2 = R[6 + c], a0 = A[c], a1 = A[3 + c], a2 = A[6 + c];
        ox += r1 * a2 - r2 * a1; oy += r2 * a0 - r0 * a2; oz += r0 * a1 - r1 * a0; den += r0 * a0 + r1 * a1 + r2 * a2;
      }
      const s2 = 1 / (Math.abs(den) + 1e-9);
      ox *= s2; oy *= s2; oz *= s2;
      const wn = Math.hypot(ox, oy, oz);
      if (wn < 1e-9) break;
      const h = wn / 2, sh = Math.sin(h) / wn, dq = [ox * sh, oy * sh, oz * sh, Math.cos(h)];
      q = [dq[3] * q[0] + dq[0] * q[3] + dq[1] * q[2] - dq[2] * q[1], dq[3] * q[1] - dq[0] * q[2] + dq[1] * q[3] + dq[2] * q[0],
        dq[3] * q[2] + dq[0] * q[1] - dq[1] * q[0] + dq[2] * q[3], dq[3] * q[3] - dq[0] * q[0] - dq[1] * q[1] - dq[2] * q[2]];
      const l = Math.hypot(...q); q = q.map((v) => v / l);
    }
    return { R, cx, cr, up: [R[1], R[4], R[7]] };
  }
  const toRest = (f, p) => {   // world point -> rest point
    const d0 = p[0] - f.cx[0], d1 = p[1] - f.cx[1], d2 = p[2] - f.cx[2], R = f.R;
    return [R[0] * d0 + R[3] * d1 + R[6] * d2 + f.cr[0], R[1] * d0 + R[4] * d1 + R[7] * d2 + f.cr[1], R[2] * d0 + R[5] * d1 + R[8] * d2 + f.cr[2]];
  };
  const toWorld = (f, X, out) => {   // rest point -> world point
    const d0 = X[0] - f.cr[0], d1 = X[1] - f.cr[1], d2 = X[2] - f.cr[2], R = f.R;
    out[0] = R[0] * d0 + R[1] * d1 + R[2] * d2 + f.cx[0]; out[1] = R[3] * d0 + R[4] * d1 + R[5] * d2 + f.cx[1]; out[2] = R[6] * d0 + R[7] * d1 + R[8] * d2 + f.cx[2];
    return out;
  };

  /** Break-through: swap the planned pieces in (plan.crossed: indices out, plan.made: pieces in).
   *  Their particles inherit position and velocity from the jelly they were cut from. Returns the
   *  world indices of the new pieces, in plan order. */
  function swapIn(plan) {
    const list = [], next = [];
    pieces.forEach((pc, k) => { if (!plan.crossed.has(k)) { list.push({ keep: k }); next.push(pc); } });
    const first = next.length;
    for (const pc of plan.made) { list.push({ X: pc.mesh.sim.X, tets: pc.mesh.sim.tets }); next.push(pc); }
    world.replacePieces(list);
    pieces = next;
    rebuilt = true;
    return plan.made.map((_, i) => first + i);
  }

  // ----- the fixed 60 Hz step with an accumulator, interpolated for display -----
  function stepOnce() {
    View.prev.set(world.x);
    beforeStep?.(step);
    if (rebuilt) { rebuilt = false; pending = assemble(); }
    world.step(step);
  }
  const centre = [0, 0, 0];

  // ponytail: no pieces until the page's first reset(drop), so the slice is meshed once at boot
  return {
    world, kernel, DT: step, maxPieces,
    get n() { return world.n; },
    get pieces() { return pieces; },
    get grabbing() { return world.grabbing; },
    step: stepOnce,
    advance(dt, speed = 1) {
      acc = Math.min(acc + dt * speed, step * maxSteps);
      let k = 0;
      while (acc >= step && k < maxSteps) { stepOnce(); acc -= step; k++; }
      return k;
    },
    reset: resetSpecimen,
    /** New meshes for the renderer after a reset or a swap, once; null otherwise. */
    takeMeshes() { const m = pending; pending = null; return m; },
    pick, landing, topNear, nearJelly, fitFrame, toRest, toWorld, makePiece, swapIn,
    grabStart(p, fwd = [0, 0, -1]) { world.grabStart(p, { radius: grabRadius, axis: fwd.slice() }); },
    grabMove: (p) => world.grabMove(p), grabTwist: (a) => world.grabTwist(a), grabEnd: () => world.grabEnd(),
    setFirmness: (v) => world.setFirmness(v), setDamping: (v) => world.setDamping(v), nudge: (s) => world.nudge(s),
    stats: () => world.stats(),
    centroid() {
      const x = world.x, n = world.n;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += x[3 * i]; cy += x[3 * i + 1]; cz += x[3 * i + 2]; }
      centre[0] = cx / n; centre[1] = cy / n; centre[2] = cz / n;
      return centre;
    },
    renderNodes() {
      const x = world.x, p = View.prev, out = View.nodes, a = Math.min(1, acc / step);
      for (let i = 0; i < world.n; i++) {
        const o = 3 * i, q = 4 * i;
        out[q] = p[o] + (x[o] - p[o]) * a; out[q + 1] = p[o + 1] + (x[o + 1] - p[o + 1]) * a; out[q + 2] = p[o + 2] + (x[o + 2] - p[o + 2]) * a;
      }
      return out;
    },
  };
}
