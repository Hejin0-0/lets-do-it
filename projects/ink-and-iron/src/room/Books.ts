// Every book in the room is ONE InstancedMesh (DESIGN §9: >= 6,000 books, one draw call).
// Fill rules per shelf (old SPINE shelf rules, re-derived): ~9% gaps with the next volume leaning
// into the gap until it touches its neighbour, ~15% of volumes in flat stacks, runs of matched
// sets, uneven push-in depth. Spines come from a 16-row atlas (leather value, gilt mask,
// roughness) selected per instance; gilt is metal. Capacity overflow THROWS (house rule).
import * as THREE from 'three'
import type { ShelfRun, Tier } from './Bookcases.ts'
import { REGION } from './Kit.ts'
import { SPINE_ROWS, spineAtlas } from '../render/ProceduralTextures.ts'
import { createSeededRandom } from '@lid/random'

export const BOOK_CAP = 10000
export const BOOK_MIN = 6000

// old build's SPINE (oxblood, regimental green, buff, calf, tan, blue-grey, ochre) + four darker
// bindings so the shelves are not one mid-value band. [r,g,b, weight], sRGB.
const SPINE: [number, number, number, number][] = [
  [0.638, 0.276, 0.222, 3], [0.33, 0.452, 0.346, 2], [0.66, 0.582, 0.442, 1.5], [0.436, 0.376, 0.322, 2],
  [0.586, 0.412, 0.226, 2], [0.404, 0.452, 0.53, 1.5], [0.598, 0.472, 0.244, 1.5],
  [0.16, 0.12, 0.1, 2], [0.36, 0.1, 0.08, 2.5], [0.12, 0.17, 0.27, 1.5], [0.15, 0.24, 0.15, 1.5],
]
const W_SUM = SPINE.reduce((s, c) => s + c[3], 0)
const VELLUM: [number, number, number] = [0.8, 0.72, 0.56]

const SIZE: Record<Tier, { t: [number, number]; h: [number, number]; d: [number, number] }> = {
  lower: { t: [0.022, 0.066], h: [0.18, 0.32], d: [0.15, 0.25] },
  press: { t: [0.022, 0.066], h: [0.18, 0.32], d: [0.15, 0.25] },
  north: { t: [0.022, 0.066], h: [0.18, 0.32], d: [0.15, 0.25] },
  upper: { t: [0.03, 0.085], h: [0.24, 0.4], d: [0.18, 0.3] },
}

function bookGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], buv: number[] = [], face: number[] = []
  const quad = (p: number[][], f: number, uv: (q: number[]) => [number, number]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); buv.push(...uv(p[i])); face.push(f) }
  }
  const h = 0.5
  quad([[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], 0, (q) => [q[1] + h, q[0] + h]) // spine
  quad([[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]], 1, (q) => [q[0] + h, q[2] + h]) // head (pages)
  quad([[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]], 1, (q) => [q[0] + h, q[2] + h]) // tail
  quad([[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]], 2, (q) => [q[2] + h, q[1] + h]) // boards
  quad([[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]], 2, (q) => [q[2] + h, q[1] + h])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aBuv', new THREE.Float32BufferAttribute(buv, 2))
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1))
  g.computeVertexNormals()
  return g
}

interface Plan { m: THREE.Matrix4[]; c: THREE.Color[]; row: number[] }

export function planBooks(runs: ShelfRun[], seed = 5): Plan {
  const rng = createSeededRandom(seed)
  const R = (a: number, b: number) => a + (b - a) * rng()
  const plan: Plan = { m: [], c: [], row: [] }
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3()
  const colour = (): [THREE.Color, number] => {
    const row = Math.floor(rng() * SPINE_ROWS)
    let base: [number, number, number]
    if (row % 4 === 3) base = VELLUM
    else {
      let w = rng() * W_SUM, i = 0
      while (w > SPINE[i][3]) { w -= SPINE[i][3]; i++ }
      base = [SPINE[i][0], SPINE[i][1], SPINE[i][2]]
    }
    const k = 0.92 + rng() * 0.16
    const c = new THREE.Color().setRGB(base[0] * k * R(0.97, 1.03), base[1] * k * R(0.97, 1.03), base[2] * k * R(0.97, 1.03), THREE.SRGBColorSpace)
    // The fraction carries one of four mirrorings of the row (64 spine designs, not 16): an outside
    // review read the 16 gilt patterns lining up along a shelf as a tiled texture.
    return [c, row + Math.floor(rng() * 4) * 0.25]
  }
  const push = (M: THREE.Matrix4, c: THREE.Color, row: number) => {
    if (plan.m.length >= BOOK_CAP) throw new Error(`Books: capacity ${BOOK_CAP} exceeded — raise BOOK_CAP or thin the fill rules`)
    plan.m.push(M); plan.c.push(c); plan.row.push(row)
  }
  const local = (x: number, y: number, z: number, rz: number, ry: number, sx: number, sy: number, sz: number) => {
    e.set(0, ry, rz, 'YXZ'); q.setFromEuler(e)
    return new THREE.Matrix4().compose(v.set(x, y, z), q, s.set(sx, sy, sz))
  }
  for (const run of runs) {
    const sz = SIZE[run.tier]
    let x = 0.004 + rng() * 0.02
    let lean = 0
    let set = 0, setC = new THREE.Color(), setRow = 0, setH = 0, setT = 0
    for (;;) {
      const r = rng()
      if (set === 0 && lean === 0 && x > 0.06 && r < 0.09) { // a volume taken out: the next one leans in
        const g = R(0.035, 0.09)
        x += g; lean = g
        continue
      }
      if (set === 0 && lean === 0 && r < 0.14) { // a flat stack
        const n = 2 + Math.floor(rng() * 4)
        let y = 0, wMax = 0
        const hs = Array.from({ length: n }, () => R(sz.h[0], Math.min(sz.h[1], 0.34))).sort((a, b) => b - a)
        if (x + hs[0] + 0.01 > run.len) break
        for (const hb of hs) {
          const tb = R(sz.t[0], sz.t[1]) * 0.9, db = Math.min(run.depth - 0.03, R(sz.d[0], sz.d[1]) + 0.02)
          if (y + tb > run.clear - 0.02) break
          const [c, row] = colour()
          const jx = R(-0.012, 0.012)
          const M = run.m.clone().multiply(local(x + hs[0] / 2 + jx, y + tb / 2, run.depth - 0.012 - db / 2 - R(0, 0.02), Math.PI / 2, R(-0.07, 0.07), tb, hb, db))
          push(M, c, row)
          y += tb; wMax = Math.max(wMax, hb)
        }
        x += wMax + R(0.004, 0.02)
        continue
      }
      if (set === 0 && rng() < 0.22) { // a matched set
        set = 3 + Math.floor(rng() * 7)
        ;[setC, setRow] = colour()
        setH = R(sz.h[0], sz.h[1]); setT = R(sz.t[0], sz.t[1])
      }
      let h: number, t: number, c: THREE.Color, row: number
      if (set > 0) { h = setH; t = setT * R(0.92, 1.08); c = setC; row = setRow; set-- } else { h = R(sz.h[0], sz.h[1]); t = R(sz.t[0], sz.t[1]); [c, row] = colour() }
      h = Math.min(h, run.clear - 0.012)
      const d = Math.min(run.depth - 0.03, R(sz.d[0], sz.d[1]))
      const inset = 0.008 + rng() * 0.018 + (rng() < 0.08 ? 0.04 : 0)
      const zc = run.depth - inset - d / 2
      if (lean > 0) {
        const th = Math.asin(Math.min(0.9, lean / h))
        if (x + t * Math.cos(th) > run.len - 0.004) break
        // pivot on the bottom-left arris, top falls left until it touches the neighbour
        const P = new THREE.Matrix4().makeTranslation(x, 0, zc)
          .multiply(new THREE.Matrix4().makeRotationZ(th))
          .multiply(local(t / 2, h / 2, 0, 0, 0, t, h, d))
        push(run.m.clone().multiply(P), c, row)
        x += t * Math.cos(th) + 0.001
        lean = 0
        continue
      }
      if (x + t > run.len - 0.004) break
      push(run.m.clone().multiply(local(x + t / 2, h / 2, zc, R(-0.006, 0.006), R(-0.025, 0.025), t, h, d)), c, row)
      x += t + rng() * 0.0022
    }
  }
  return plan
}

export function createBooks(runs: ShelfRun[], seed = 5): THREE.InstancedMesh {
  const plan = planBooks(runs, seed)
  const n = plan.m.length
  if (n < BOOK_MIN) throw new Error(`Books: only ${n} volumes planned, need >= ${BOOK_MIN}`)
  const geo = bookGeometry()
  const row = new THREE.InstancedBufferAttribute(new Float32Array(plan.row), 1)
  geo.setAttribute('aRow', row)
  const atlas = spineAtlas()
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, envMapIntensity: 0.9 })
  m.name = 'books'
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpine = { value: atlas }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aBuv;\nattribute float aFace;\nattribute float aRow;\nvarying vec2 vBuv;\nvarying float vFace;\nvarying float vRow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuv = aBuv; vFace = aFace; vRow = aRow;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSpine;\nvarying vec2 vBuv;\nvarying float vFace;\nvarying float vRow;')
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        float bkGilt = 0.0, bkRough = 0.66;
        if (vFace < 0.5) {
          float bkRow = floor(vRow + 0.05), bkVar = floor((vRow - bkRow) * 4.0 + 0.5);
          vec2 bkUv = vec2(mix(vBuv.x, 1.0 - vBuv.x, step(1.5, bkVar)), mix(vBuv.y, 1.0 - vBuv.y, mod(bkVar, 2.0)));
          vec4 sp = texture2D(uSpine, vec2(bkUv.x, (bkRow + 0.04 + bkUv.y * 0.92) / ${SPINE_ROWS.toFixed(1)}));
          diffuseColor.rgb *= sp.r * 1.25;
          bkGilt = sp.g;
          bkRough = 0.5 + (sp.b - 0.5) * 0.6;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.42, 0.16), bkGilt);
        } else if (vFace < 1.5) {
          float board = step(vBuv.x, 0.07) + step(0.93, vBuv.x) + step(0.95, vBuv.y);
          vec3 page = vec3(0.62, 0.53, 0.38) * (0.86 + 0.14 * sin(vBuv.x * 160.0));
          diffuseColor.rgb = mix(page, diffuseColor.rgb * 0.8, clamp(board, 0.0, 1.0));
          bkRough = 0.85;
        } else {
          diffuseColor.rgb *= 0.78;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(bkRough, 0.3, bkGilt);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = bkGilt * 0.95;')
  }
  m.customProgramCacheKey = () => 'books-atlas-v2'
  const mesh = new THREE.InstancedMesh(geo, m, n)
  mesh.name = 'books'
  for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, plan.m[i]); mesh.setColorAt(i, plan.c[i]) }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.userData.region = REGION.shelves
  return mesh
}
