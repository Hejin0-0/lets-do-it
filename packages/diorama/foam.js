// Foam on a diorama's water: wakes, white water, churn. A field over the sea's cells that takes deposits and
// fades, packed to a byte per cell for the renderer's foam texture.
/** A foam field over the sea's cells: deposits, decay, and a byte per cell for the GPU. */
export function createFoam(N, half) {
  const F = new Float32Array(N * N), out = new Uint8Array(N * N), dx = (2 * half) / N;
  return {
    F,
    add(x, z, amount, r) {
      const i0 = Math.max(0, Math.floor((x - r + half) / dx)), i1 = Math.min(N - 1, Math.floor((x + r + half) / dx));
      const j0 = Math.max(0, Math.floor((z - r + half) / dx)), j1 = Math.min(N - 1, Math.floor((z + r + half) / dx));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = -half + (i + 0.5) * dx - x, pz = -half + (j + 0.5) * dx - z, w = 1 - (px * px + pz * pz) / (r * r);
        if (w > 0) F[j * N + i] = Math.min(1, F[j * N + i] + amount * w);
      }
    },
    step(dt) { const k = Math.exp(-0.55 * dt); for (let c = 0; c < F.length; c++) F[c] *= k; },
    pack() { for (let c = 0; c < F.length; c++) out[c] = F[c] * 255; return out; },
    clear() { F.fill(0); },
  };
}
