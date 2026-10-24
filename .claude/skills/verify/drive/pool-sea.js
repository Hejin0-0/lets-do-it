// The open sea's FFT against the sum it stands for: the GPU's surface for the first cascade (its height and its sideways
// displacement), read back, against the same waves summed one by one on the CPU (the spectrum's amplitudes) at texels
// across the patch, now and two seconds on (so the waves must also run the right way). Proof: the largest difference
// against the largest height.
(async () => {
  const P = window.__pool, { device } = P.renderer, o = P.ocean, { N, chop: CHOP } = o.spec, L = o.spec.L[0], GU = 9.81 / o.spec.M
  const f16 = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 2 ** -24 : s * (1 + m / 1024) * 2 ** (e - 15) }
  async function readBack() {
    const buf = device.createBuffer({ size: N * N * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), enc = device.createCommandEncoder()
    enc.copyTextureToBuffer({ texture: o.texture, mipLevel: 0, origin: [0, 0, 0] }, { buffer: buf, bytesPerRow: N * 8 }, [N, N, 1])
    device.queue.submit([enc.finish()])
    await buf.mapAsync(GPUMapMode.READ)
    const h = new Uint16Array(buf.getMappedRange().slice(0)); buf.unmap(); buf.destroy()
    return h
  }
  const waves = []   // cascade 0's waves: [kx, kz, w, re, im]
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = 4 * (y * N + x), a = o.spec.h0[i], b = o.spec.h0[i + 1]
    if (!a && !b) continue
    const kx = (x < N / 2 ? x : x - N) * (2 * Math.PI / L), kz = (y < N / 2 ? y : y - N) * (2 * Math.PI / L)
    waves.push([kx, kz, Math.sqrt(GU * Math.hypot(kx, kz)), a, b])
  }
  const cpu = (m, n, t) => {   // height and x displacement at the texel's point: the sum of 2 Re[h0 e^(i(k.x - wt))]
    let h = 0, dx = 0; const px = (m * L) / N, pz = (n * L) / N
    for (const [kx, kz, w, a, b] of waves) { const th = kx * px + kz * pz - w * t, c = Math.cos(th), s = Math.sin(th); h += 2 * (a * c - b * s); dx += CHOP * (kx / Math.hypot(kx, kz)) * 2 * (a * s + b * c) }
    return [h, dx]
  }
  P.pause(true)
  const out = []
  for (const k of [0, 1]) {
    if (k) P.step(240)
    P.render(1, 0)
    const t = P.world.time, tex = await readBack()
    let worst = 0, top = 0
    for (let q = 0; q < 24; q++) {
      const m = (q * 37 + 11) % N, n = (q * 91 + 5) % N, i = 4 * (n * N + m), [h, dx] = cpu(m, n, t)
      worst = Math.max(worst, Math.abs(f16(tex[i + 1]) - h), Math.abs(f16(tex[i]) - dx)); top = Math.max(top, Math.abs(h))
    }
    out.push({ t: +t.toFixed(2), waves: waves.length, top: +top.toFixed(4), worst: +worst.toExponential(2) })
  }
  if (!out.every((r) => r.top > 0.01 && r.worst < 0.01 * r.top)) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
