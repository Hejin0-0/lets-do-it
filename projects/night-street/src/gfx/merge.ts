import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Accumulates transformed primitives into one geometry.
 *
 * The performance budget for this scene is 30+ FPS on a mid-range GPU, and the
 * thing that actually threatens it is not triangles — a 4060 will eat two
 * million without noticing — it is draw calls. A street with 22 buildings, 112
 * props and 26 cars built the obvious way is several thousand `Mesh` objects
 * and dies on the CPU submitting them.
 *
 * So geometry is grouped by *material* rather than by object, baked once at
 * load, and submitted as a handful of calls. Per-object variation that would
 * normally need a material comes through the vertex colour attribute instead,
 * which is why `add` takes a colour.
 *
 * The cost of this is that nothing built through here can move independently.
 * Everything on this street is nailed down, so that is free. The cars needed
 * their own arrangement, and the lamps' cone meshes are transparent and cannot
 * be batched with opaque geometry anyway.
 */
export class Batch {
  private parts: BufferGeometry[] = []
  private tri = 0

  /**
   * `geo` is cloned, so the caller keeps ownership of shared prototypes and
   * can hand the same BoxGeometry in a hundred times.
   *
   * `uv` multiplies the source UVs, which is how texture density is kept
   * constant across differently-sized geometry. Merged parts all share one
   * material, so the material's `repeat` cannot do it: a 20 m wall and a 11 m
   * wall would get the same number of brick courses and the bricks would be
   * visibly different sizes on adjacent buildings.
   */
  add(
    geo: BufferGeometry,
    matrix: Matrix4,
    color?: Color,
    /**
     * `[scaleX, scaleY]`, or `[scaleX, scaleY, offsetX, offsetY]` to address one
     * cell of a texture atlas. The offset form is what lets several hundred
     * windows share two draw calls and still show different rooms behind them.
     */
    uv?: [number, number] | [number, number, number, number],
    /**
     * Optional vertical darkening ramp, in *world* Y: vertices at or below
     * `y0` get `color * scale`, vertices at or above `y1` get `color`.
     *
     * This exists because the one piece of facade weathering that matters most
     * — buildings being dirtier at street level — is low-frequency over fifteen
     * metres, and a tiling texture cannot express it. Painted into the sheet it
     * repeats at the tile pitch and reads as a grid of blotches. Here it is a
     * function of where the vertex actually is.
     */
    gradient?: { y0: number; y1: number; scale: number },
  ): void {
    let g = geo.clone().applyMatrix4(matrix)

    // Normalise index mode. Primitives are indexed; ExtrudeGeometry and
    // ShapeGeometry are not, and mergeGeometries refuses a mixed set. Rather
    // than tracking which is which at every call site, everything goes
    // non-indexed. For a box that is 24 vertices to 36 — cheap next to the
    // alternative, which is a merge that fails only once a car is added.
    if (g.index) {
      const flat = g.toNonIndexed()
      g.dispose()
      g = flat
    }

    if (uv) {
      const a = g.attributes.uv
      const ox = uv[2] ?? 0
      const oy = uv[3] ?? 0
      for (let i = 0; i < a.count; i++) {
        a.setXY(i, a.getX(i) * uv[0] + ox, a.getY(i) * uv[1] + oy)
      }
      a.needsUpdate = true
    }

    // mergeGeometries requires an identical attribute set across every part.
    // Anything a primitive brought along that we are not using has to go, or
    // one stray attribute silently fails the whole merge.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        g.deleteAttribute(name)
      }
    }
    const n = g.attributes.position.count
    const c = color ?? WHITE
    const arr = new Float32Array(n * 3)
    const pos = g.attributes.position
    for (let i = 0; i < n; i++) {
      let k = 1
      if (gradient) {
        const t = Math.max(0, Math.min(1, (pos.getY(i) - gradient.y0) / (gradient.y1 - gradient.y0)))
        k = gradient.scale + (1 - gradient.scale) * (t * t * (3 - 2 * t))
      }
      arr[i * 3] = c.r * k
      arr[i * 3 + 1] = c.g * k
      arr[i * 3 + 2] = c.b * k
    }
    g.setAttribute('color', new Float32BufferAttribute(arr, 3))

    // Normals must be transformed too, and applyMatrix4 has already done it —
    // but a negative-determinant matrix (a mirrored prop) flips the winding and
    // leaves the geometry inside-out. Catch it here rather than wondering later
    // why one side of the street has no shadows.
    if (matrix.determinant() < 0) {
      throw new Error('mirrored transform would invert winding; rotate instead of scaling by -1')
    }

    this.parts.push(g)
    this.tri += (g.index ? g.index.count : n) / 3
  }

  get triangles(): number {
    return this.tri
  }

  get parts_(): number {
    return this.parts.length
  }

  /** Returns null when nothing was added, so callers can skip empty groups. */
  build(material: Material, opts: { cast?: boolean; receive?: boolean } = {}): Mesh | null {
    if (this.parts.length === 0) return null
    const merged = mergeGeometries(this.parts, false)
    if (!merged) {
      throw new Error('geometry merge failed — mismatched attributes or index mode')
    }
    for (const p of this.parts) p.dispose()
    this.parts.length = 0

    const mesh = new Mesh(merged, material)
    mesh.castShadow = opts.cast ?? false
    mesh.receiveShadow = opts.receive ?? false
    // Everything in a batch spans the whole street, so per-object frustum
    // culling can only ever produce a false negative here.
    mesh.frustumCulled = false
    return mesh
  }
}

const WHITE = new Color(1, 1, 1)
