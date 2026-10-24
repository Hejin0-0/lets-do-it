// ---------------------------------------------------------------------------
// Fracture: plan how a jelly bursts, in its rest shape, ahead of time.
//
// Seeds -> 3D Voronoi cells (convex: one half-space per other seed; seeds at slightly different heights
// tilt the walls). A few big cells per fruit, and on some of them a cluster of chip seeds at the far rim,
// which notch that corner off as small chips. Tets go to the cell holding their centroid; tiny islands
// and too-small chunks merge into the neighbour they share most nodes with; every chunk gets its own
// copy of its nodes. The render skin is clipped against each cell's half-spaces and every face between
// two different chunks is closed by a flat cap: the jelly's cross-section in that plane, clipped to the
// cell's face polygon. Everything is in rest space, so the materials show the inside on the caps.
// ---------------------------------------------------------------------------
export const Fracture = (() => {

  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Seeds for one burst. pts: render positions (rest), T: thickness, rnd: random, inside(x, z, margin). */
  function makeSeeds(pts, T, rnd, inside) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < pts.length; i += 3) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 2]); z1 = Math.max(z1, pts[i + 2]); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ext = Math.max(x1 - x0, z1 - z0) / 2;
    const nBig = 5 + Math.floor(rnd() * 3), big = [], minD = ext * 0.62;
    for (let tries = 0; big.length < nBig && tries < 4000; tries++) {
      const x = x0 + (x1 - x0) * rnd(), z = z0 + (z1 - z0) * rnd();
      if (!inside(x, z, 0.12)) continue;
      const dmin = big.reduce((m, s) => Math.min(m, Math.hypot(s[0] - x, s[2] - z)), Infinity);
      if (dmin < minD * (1 - tries / 5000)) continue;
      big.push([x, T * (0.5 + (rnd() - 0.5) * 0.3), z]);   // a little height jitter tilts the walls slightly (never toward flat)
    }
    // chips: on 3-4 big cells, 2-4 seeds clustered where the cell reaches farthest from the middle
    const chips = [];
    const order = big.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, Math.min(big.length, 3 + Math.floor(rnd() * 2)));
    for (const bi of order) {
      const s = big[bi];
      let far = null, fd = -1;
      for (let i = 0; i < pts.length; i += 3) {   // the render point farthest from the middle among those in this cell
        const dn = Math.hypot(pts[i] - s[0], pts[i + 2] - s[2]), dc = Math.hypot(pts[i] - cx, pts[i + 2] - cz);
        let nearest = true;
        for (const o of big) if (Math.hypot(pts[i] - o[0], pts[i + 2] - o[2]) < dn - 1e-9) { nearest = false; break; }
        if (nearest && dc > fd) { fd = dc; far = [pts[i], pts[i + 2]]; }
      }
      if (!far) continue;
      const k = 2 + Math.floor(rnd() * 3), dx = far[0] - cx, dz = far[1] - cz, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
      for (let c = 0; c < k; c++) {
        const along = (c - (k - 1) / 2) * 0.19 + (rnd() - 0.5) * 0.05, inward = 0.1 + rnd() * 0.08;
        chips.push([far[0] - ux * inward - uz * along, T * (0.5 + (rnd() - 0.5) * 0.12), far[1] - uz * inward + ux * along]);
      }
    }
    return { seeds: big.concat(chips), nBig: big.length };
  }

  // Half-spaces of cell i: n . x <= d, one per other seed (the bisector), with j the seed across.
  function cellPlanes(seeds, i) {
    const s = seeds[i], out = [];
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const t = seeds[j], n = [t[0] - s[0], t[1] - s[1], t[2] - s[2]], l = Math.hypot(...n);
      n[0] /= l; n[1] /= l; n[2] /= l;
      const m = [(s[0] + t[0]) / 2, (s[1] + t[1]) / 2, (s[2] + t[2]) / 2];
      out.push({ n, d: n[0] * m[0] + n[1] * m[1] + n[2] * m[2], j });
    }
    return out;
  }
  const nearestSeed = (seeds, x, y, z) => {
    let b = 0, bd = Infinity;
    for (let i = 0; i < seeds.length; i++) { const s = seeds[i], d = (s[0] - x) ** 2 + (s[1] - y) ** 2 + (s[2] - z) ** 2; if (d < bd) { bd = d; b = i; } }
    return b;
  };

  // Sutherland-Hodgman: keep the part of polygon P (arrays [x, y, z, ...attrs]) with n.x <= d.
  function clipPoly(P, n, d) {
    const out = [];
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length];
      const da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] - d, db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2] - d;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push(a.map((v, q) => v + (b[q] - v) * t)); }
    }
    return out;
  }

  /**
   * Plan a burst. mesh: { render: { pos, index, nrm }, sim: { X, tets }, bubbles }, T: slab thickness,
   * inside(x, z, margin): the outline test for seeding. Returns chunks: [{ X, tets, pos, nrm, index, chip,
   * bubbles }] with rest-space render data (caps carry their plane normal; the skin, the fruit's normals).
   */
  function plan(mesh, T, inside, seed) {
    const rnd = mulberry32(seed >>> 0);
    const P = mesh.render.pos, I = mesh.render.index, nrm = mesh.render.nrm, X = mesh.sim.X, TT = mesh.sim.tets;
    const { seeds, nBig } = makeSeeds(P, T, rnd, inside);
    const S = seeds.length, nt = TT.length / 4, ntri = I.length / 3;

    // ----- tets to cells, islands merged, chunks numbered -----
    const cellOf = new Int32Array(nt);
    for (let t = 0; t < nt; t++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 4; k++) { const v = 3 * TT[4 * t + k]; x += X[v]; y += X[v + 1]; z += X[v + 2]; }
      cellOf[t] = nearestSeed(seeds, x / 4, y / 4, z / 4);
    }
    const nodeTets = Array.from({ length: X.length / 3 }, () => []);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 4; k++) nodeTets[TT[4 * t + k]].push(t);
    const chunkOf = new Int32Array(S).map((_, i) => i);   // cell -> chunk (cells merge into chunks)
    const finalOf = (c) => { while (chunkOf[c] !== c) c = chunkOf[c]; return c; };
    const cc = (t) => finalOf(cellOf[t]);
    for (let pass = 0; pass < 4; pass++) {
      // components of each chunk's tets (sharing a node); islands and too-small chunks go to the neighbour they touch most
      const comp = new Int32Array(nt).fill(-1), parts = [];
      for (let t0 = 0; t0 < nt; t0++) {
        if (comp[t0] >= 0) continue;
        const id = parts.length, c0 = cc(t0), stack = [t0], members = [];
        comp[t0] = id;
        while (stack.length) {
          const t = stack.pop(); members.push(t);
          for (let k = 0; k < 4; k++) for (const u of nodeTets[TT[4 * t + k]]) if (comp[u] < 0 && cc(u) === c0) { comp[u] = id; stack.push(u); }
        }
        parts.push({ id, chunk: c0, members });
      }
      const main = new Map();
      for (const s of parts) if (!main.has(s.chunk) || main.get(s.chunk).members.length < s.members.length) main.set(s.chunk, s);
      let changed = false;
      for (const s of parts) {
        const isMain = main.get(s.chunk) === s;
        if (isMain && s.members.length >= 6) continue;   // a chunk needs a few tets to be a body
        const votes = new Map();
        for (const t of s.members) for (let k = 0; k < 4; k++) for (const u of nodeTets[TT[4 * t + k]]) { const c = cc(u); if (c !== s.chunk) votes.set(c, (votes.get(c) || 0) + 1); }
        let to = -1, bv = 0;
        for (const [c, v] of votes) if (v > bv) { bv = v; to = c; }
        if (to < 0) continue;
        if (isMain) chunkOf[s.chunk] = to;            // the whole chunk is too small: its cells join the neighbour
        else for (const t of s.members) cellOf[t] = to;   // an island: its tets move over
        changed = true;
      }
      if (!changed) break;
    }
    const roots = [...new Set(Array.from({ length: nt }, (_, t) => cc(t)))];
    const chunkIndex = new Map(roots.map((r, k) => [r, k]));
    const chunks = roots.map((r) => ({ tets: [], chip: r >= nBig, posA: [], idxA: [], nrmA: [], bubbles: [] }));
    for (let t = 0; t < nt; t++) chunks[chunkIndex.get(cc(t))].tets.push(t);

    // ----- per chunk: its own copy of its nodes -----
    for (const ch of chunks) {
      const map = new Map(), Xc = [], tl = new Uint32Array(4 * ch.tets.length);
      ch.tets.forEach((t, q) => { for (let k = 0; k < 4; k++) { const v = TT[4 * t + k]; if (!map.has(v)) { map.set(v, Xc.length / 3); Xc.push(X[3 * v], X[3 * v + 1], X[3 * v + 2]); } tl[4 * q + k] = map.get(v); } });
      ch.X = Float32Array.from(Xc); ch.tetsOut = tl;
    }

    // ----- render: clip the skin per cell, cap every face between two different chunks -----
    const side = new Float64Array(P.length / 3);
    for (let ci = 0; ci < S; ci++) {
      const k = chunkIndex.get(finalOf(ci));
      if (k === undefined) continue;   // a cell whose tets all went elsewhere has no render either (rare: a sliver)
      const ch = chunks[k], planes = cellPlanes(seeds, ci);
      // skin
      for (let t = 0; t < ntri; t++) {
        let poly = [0, 1, 2].map((q) => { const v = I[3 * t + q]; return [P[3 * v], P[3 * v + 1], P[3 * v + 2], nrm[3 * v], nrm[3 * v + 1], nrm[3 * v + 2]]; });
        for (const pl of planes) {
          let allIn = true;
          for (const p of poly) if (pl.n[0] * p[0] + pl.n[1] * p[1] + pl.n[2] * p[2] > pl.d) { allIn = false; break; }
          if (allIn) continue;
          poly = clipPoly(poly, pl.n, pl.d);
          if (poly.length < 3) break;
        }
        if (poly.length < 3) continue;
        const base = ch.posA.length / 3;
        for (const p of poly) { ch.posA.push(p[0], p[1], p[2]); ch.nrmA.push(p[3], p[4], p[5]); }
        for (let q = 1; q + 1 < poly.length; q++) ch.idxA.push(base, base + q, base + q + 1);
      }
      // caps
      for (const pl of planes) {
        if (finalOf(pl.j) === finalOf(ci)) continue;   // the same chunk on both sides: no face there
        const n = pl.n, d = pl.d;
        const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        let u = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
        const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        const o = [n[0] * d, n[1] * d, n[2] * d];
        // the cell's face polygon: a big square in the plane, clipped by the cell's other planes
        let face = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s1, s2]) => [o[0] + (u[0] * s1 + w[0] * s2) * 9, o[1] + (u[1] * s1 + w[1] * s2) * 9, o[2] + (u[2] * s1 + w[2] * s2) * 9]);
        for (const q of planes) if (q !== pl) { face = clipPoly(face, q.n, q.d); if (face.length < 3) break; }
        if (face.length < 3) continue;
        // section of the closed skin by the plane: one segment per crossing triangle, chained into loops by shared edges
        for (let v = 0; v < side.length; v++) side[v] = n[0] * P[3 * v] + n[1] * P[3 * v + 1] + n[2] * P[3 * v + 2] - d;
        const seg = new Map(), pt = new Map();
        const cross = (va, vb) => {
          const key = va < vb ? va * 1e7 + vb : vb * 1e7 + va;
          if (!pt.has(key)) { const t = side[va] / (side[va] - side[vb]); pt.set(key, [0, 1, 2].map((q) => P[3 * va + q] + (P[3 * vb + q] - P[3 * va + q]) * t)); }
          return key;
        };
        for (let t = 0; t < ntri; t++) {
          const v = [I[3 * t], I[3 * t + 1], I[3 * t + 2]], sd = v.map((q) => side[q] >= 0);
          if (sd[0] === sd[1] && sd[1] === sd[2]) continue;
          const ks = [];
          for (let q = 0; q < 3; q++) if (sd[q] !== sd[(q + 1) % 3]) ks.push(cross(v[q], v[(q + 1) % 3]));
          if (ks.length !== 2) continue;
          for (const [p, q2] of [[ks[0], ks[1]], [ks[1], ks[0]]]) { if (!seg.has(p)) seg.set(p, []); seg.get(p).push(q2); }
        }
        const used = new Set(), loops = [];
        for (const start of seg.keys()) {
          if (used.has(start)) continue;
          const loop = [start]; used.add(start);
          let prev = -1, cur = start;
          for (let guard = 0; guard < 100000; guard++) {
            const next = (seg.get(cur) || []).find((q) => q !== prev && !used.has(q));
            if (next === undefined) break;
            loop.push(next); used.add(next); prev = cur; cur = next;
          }
          if (loop.length >= 3) loops.push(loop.map((key) => pt.get(key)));
        }
        if (!loops.length) continue;
        // clip each section loop by the face polygon (convex), then fan it out, facing +n (out of this cell)
        const to2 = (p) => [(p[0] - o[0]) * u[0] + (p[1] - o[1]) * u[1] + (p[2] - o[2]) * u[2], (p[0] - o[0]) * w[0] + (p[1] - o[1]) * w[1] + (p[2] - o[2]) * w[2]];
        const F2 = face.map(to2);
        let fa = 0; for (let q = 0; q < F2.length; q++) { const r = F2[(q + 1) % F2.length]; fa += F2[q][0] * r[1] - r[0] * F2[q][1]; }
        for (const L of loops) {
          let poly = L.map(to2);
          for (let e = 0; e < F2.length && poly.length >= 3; e++) {
            const A = F2[e], Bp = F2[(e + 1) % F2.length];
            const ex = Bp[0] - A[0], ez = Bp[1] - A[1], nn = fa > 0 ? [ez, -ex] : [-ez, ex], nd = nn[0] * A[0] + nn[1] * A[1];
            const out = [];
            for (let k2 = 0; k2 < poly.length; k2++) {
              const p = poly[k2], q = poly[(k2 + 1) % poly.length];
              const dp = nn[0] * p[0] + nn[1] * p[1] - nd, dq = nn[0] * q[0] + nn[1] * q[1] - nd;
              if (dp <= 0) out.push(p);
              if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
            }
            poly = out;
          }
          if (poly.length < 3) continue;
          let area = 0, gx = 0, gz = 0;
          for (let q = 0; q < poly.length; q++) { const r = poly[(q + 1) % poly.length]; area += poly[q][0] * r[1] - r[0] * poly[q][1]; gx += poly[q][0]; gz += poly[q][1]; }
          if (Math.abs(area) < 1e-6) continue;
          gx /= poly.length; gz /= poly.length;
          const ccw = area > 0;   // (u, w, n) is right-handed, so CCW in (u, w) faces +n
          const base = ch.posA.length / 3;
          const put = (q) => { ch.posA.push(o[0] + u[0] * q[0] + w[0] * q[1], o[1] + u[1] * q[0] + w[1] * q[1], o[2] + u[2] * q[0] + w[2] * q[1]); ch.nrmA.push(n[0], n[1], n[2]); };
          put([gx, gz]);
          for (const q of poly) put(q);
          for (let q = 0; q < poly.length; q++) {
            const b = base + 1 + q, c = base + 1 + ((q + 1) % poly.length);
            if (ccw) ch.idxA.push(base, b, c); else ch.idxA.push(base, c, b);
          }
        }
      }
    }
    // weld each chunk's vertices by position and normal (cells of one chunk meet without a seam; caps keep their crease)
    for (const ch of chunks) {
      const r5 = (v) => Math.round(v * 1e5), r2 = (v) => Math.round(v * 50);
      const map = new Map(), n0 = ch.posA.length / 3, remap = new Int32Array(n0), pos = [], nr = [];
      for (let i = 0; i < n0; i++) {
        const k2 = `${r5(ch.posA[3 * i])},${r5(ch.posA[3 * i + 1])},${r5(ch.posA[3 * i + 2])},${r2(ch.nrmA[3 * i])},${r2(ch.nrmA[3 * i + 1])},${r2(ch.nrmA[3 * i + 2])}`;
        if (!map.has(k2)) { map.set(k2, pos.length / 3); pos.push(ch.posA[3 * i], ch.posA[3 * i + 1], ch.posA[3 * i + 2]); nr.push(ch.nrmA[3 * i], ch.nrmA[3 * i + 1], ch.nrmA[3 * i + 2]); }
        remap[i] = map.get(k2);
      }
      const idx = [];
      for (let t = 0; t < ch.idxA.length; t += 3) {
        const a2 = remap[ch.idxA[t]], b = remap[ch.idxA[t + 1]], c = remap[ch.idxA[t + 2]];
        if (a2 !== b && b !== c && a2 !== c) idx.push(a2, b, c);
      }
      ch.pos = Float32Array.from(pos); ch.nrm = Float32Array.from(nr); ch.index = Uint32Array.from(idx);
    }
    // bubbles go with the chunk whose cell holds them
    const Bb = mesh.bubbles || new Float32Array(0);
    for (let i = 0; i < Bb.length; i += 4) { const k = chunkIndex.get(finalOf(nearestSeed(seeds, Bb[i], Bb[i + 1], Bb[i + 2]))); if (k !== undefined) chunks[k].bubbles.push(Bb[i], Bb[i + 1], Bb[i + 2], Bb[i + 3]); }
    return chunks.filter((c) => c.index.length > 0).map((c) => ({
      X: c.X, tets: c.tetsOut, pos: c.pos, nrm: c.nrm, index: c.index, chip: c.chip, bubbles: Float32Array.from(c.bubbles),
    }));
  }

  /** Area-weighted vertex normals of a triangle mesh. */
  function vertexNormals(pos, idx) {
    const n = new Float32Array(pos.length);
    for (let t = 0; t < idx.length; t += 3) {
      const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      n[a] += cx; n[a + 1] += cy; n[a + 2] += cz; n[b] += cx; n[b + 1] += cy; n[b + 2] += cz; n[c] += cx; n[c + 1] += cy; n[c + 2] += cz;
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return n;
  }

  return { plan, vertexNormals, mulberry32 };
})();
