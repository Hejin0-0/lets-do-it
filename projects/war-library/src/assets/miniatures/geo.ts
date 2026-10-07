// Vertex-painted merged geometry for the miniatures, the terrain kit and the table tokens
// (digest_3d-assets §b "merged vertex-coloured meshes", §c "no flat colours"). A Geo collects
// primitive parts, each with its paint colour and an edge-wear weight, and bakes them into ONE
// non-indexed BufferGeometry with `position`, `normal`, `color` and `wear` attributes:
//   - colour gets +-5% seeded value noise per vertex (never a flat fill),
//   - `wear` is the part's wear allowance; wornEnamel() shows bare lead on its edges and speckle,
//   - an optional height AO darkens what sits low on the model (contact, cavities).
// Pure three (no DOM), so the node self-check can build and inspect every model.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type RGB = [number, number, number]
export const hex = (s: string): RGB => { const c = new THREE.Color(s); return [c.r, c.g, c.b] }

export interface PartOpts {
  wear?: number // 0..1 how much of this part's extremities show bare metal
  noise?: number // colour noise amplitude (default 0.05)
  flat?: boolean // flat-shade (hard-surface faces)
}

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(Math.round(x * 4096) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(y * 4096) + 0x165667b1, 0xc2b2ae35)
  h ^= Math.imul(Math.round(z * 4096) ^ 0x9e3779b9, 0x27d4eb2f)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

export class Geo {
  private readonly parts: THREE.BufferGeometry[] = []

  // Adds a part. `g` is consumed (transformed in place by `m` when given).
  add(g: THREE.BufferGeometry, color: RGB | string, o: PartOpts = {}, m?: THREE.Matrix4): this {
    let geo = g.index ? g.toNonIndexed() : g
    if (m) geo.applyMatrix4(m)
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k)
    if (o.flat || !geo.getAttribute('normal')) { geo.deleteAttribute('normal'); geo.computeVertexNormals() }
    geo = paint(geo, typeof color === 'string' ? hex(color) : color, o)
    this.parts.push(geo)
    return this
  }

  // Convenience placement: translate, then Euler rotate (XYZ radians), then scale.
  at(g: THREE.BufferGeometry, color: RGB | string, p: [number, number, number], r: [number, number, number] = [0, 0, 0],
    o: PartOpts = {}, s: [number, number, number] = [1, 1, 1]): this {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s))
    return this.add(g, color, o, m)
  }

  merge(other: Geo, m?: THREE.Matrix4): this {
    for (const p of other.parts) { const c = p.clone(); if (m) c.applyMatrix4(m); this.parts.push(c) }
    return this
  }

  get empty(): boolean { return this.parts.length === 0 }

  // Post-paint a pass over every part's own vertex colours (e.g. camouflage) before build().
  each(f: (part: THREE.BufferGeometry) => void): this {
    for (const p of this.parts) f(p)
    return this
  }

  // One geometry. `ao` darkens by height: y <= 0 gets (1 - ao), y >= aoHeight gets 1.
  build(ao = 0, aoHeight = 0.02): THREE.BufferGeometry {
    if (!this.parts.length) throw new Error('Geo.build: no parts')
    const g = mergeGeometries(this.parts, false)
    if (!g) throw new Error('Geo.build: mergeGeometries failed (attribute mismatch)')
    // A zero-area triangle gets a (0,0,0) normal and normalize(0) is NaN in the shader: one NaN
    // sample under 4x MSAA and the bloom blurred it over the whole frame (black at one commander pose)
    const nm = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < nm.count; i++) if (Math.hypot(nm.getX(i), nm.getY(i), nm.getZ(i)) < 1e-6) nm.setXYZ(i, 0, 1, 0)
    if (ao > 0) {
      const p = g.getAttribute('position') as THREE.BufferAttribute, c = g.getAttribute('color') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const t = Math.max(0, Math.min(1, p.getY(i) / aoHeight))
        const k = 1 - ao * (1 - t * t * (3 - 2 * t))
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k)
      }
    }
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

function paint(g: THREE.BufferGeometry, rgb: RGB, o: PartOpts): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const col = new Float32Array(p.count * 3), wear = new Float32Array(p.count)
  const amp = o.noise ?? 0.05
  for (let i = 0; i < p.count; i++) {
    const k = 1 + amp * (hash3(p.getX(i), p.getY(i), p.getZ(i)) * 2 - 1)
    for (let j = 0; j < 3; j++) col[i * 3 + j] = rgb[j] * k
    // the part's wear ALLOWANCE; where it actually shows (edges, high points) is decided per
    // pixel by wornEnamel() — per-vertex wear on coarse parts wore whole faces to lead
    wear[i] = o.wear ?? 0
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('wear', new THREE.BufferAttribute(wear, 1))
  return g
}

// ---------------------------------------------------------------------------------------------
// Primitive shapes, sized in metres, standing on y = 0 unless noted.

export const box = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)
export const cyl = (rt: number, rb: number, h: number, seg = 12): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0)
export const sphere = (r: number, ws = 12, hs = 8): THREE.BufferGeometry => new THREE.SphereGeometry(r, ws, hs)
export const capsule = (r: number, len: number, seg = 8): THREE.BufferGeometry => new THREE.CapsuleGeometry(r, len, 3, seg)
// Lathe from a (radius, y) profile.
export const lathe = (pts: [number, number][], seg = 16): THREE.BufferGeometry =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
// A limb/bar between two points.
type P3 = THREE.Vector3Like | readonly number[]
const toV = (p: P3): THREE.Vector3 => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3((p as THREE.Vector3Like).x, (p as THREE.Vector3Like).y, (p as THREE.Vector3Like).z))
export function rod(a: P3, b: P3, r0: number, r1 = r0, seg = 8): THREE.BufferGeometry {
  const A = toV(a), B = toV(b)
  const len = A.distanceTo(B)
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1).translate(0, len / 2, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())
  g.applyQuaternion(q).translate(A.x, A.y, A.z)
  return g
}
// Extrude a 2-D outline (x, y) by depth along +z, centred on z = 0.
export function extrude(outline: [number, number][], depth: number, holes: [number, number][][] = [], bevel = 0): THREE.BufferGeometry {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 })
  return g.translate(0, 0, -depth / 2)
}
// Pointed (gothic) arch hole: jambs from the sill to the springing line, then two arcs of radius
// r > w/2 (each centred on the opposite springer: the two absarcs) meeting at the apex.
export function pointedArch(cx: number, sill: number, spring: number, w: number, r = w * 0.85, seg = 6): [number, number][] {
  const out: [number, number][] = [[cx - w / 2, sill], [cx - w / 2, spring]]
  const lc = cx - w / 2 + r, rc = cx + w / 2 - r
  for (let i = 1; i <= seg; i++) { const x = cx - w / 2 + (i / seg) * w / 2; out.push([x, spring + Math.sqrt(Math.max(0, r * r - (x - lc) ** 2))]) }
  for (let i = 1; i <= seg; i++) { const x = cx + (i / seg) * w / 2; out.push([x, spring + Math.sqrt(Math.max(0, r * r - (x - rc) ** 2))]) }
  out.push([cx + w / 2, sill])
  return out
}

// A worn-enamel material: the shared role, plus bare lead where the paint has rubbed off. Per
// pixel: the part's `wear` allowance x an edge term (how fast the normal turns across the pixel:
// hard edges, rims, knuckles) x a speckle noise fixed to the model. Worn spots take the lead
// colour, go metallic and a little glossier.
// `rim` > 0 adds a warm Fresnel rim (the chandelier catching the tin's silhouette) so a piece lifts
// off the painted sheet; an outside review found the pieces' "tin" flat against the board.
export function wornEnamel(base: THREE.Material, key: string, rim = 0): THREE.MeshStandardMaterial {
  const m = (base as THREE.MeshStandardMaterial).clone()
  m.vertexColors = true
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wear;\nvarying float vWear;\nvarying vec3 vWearP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWear = wear;\nvWearP = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vWear;
varying vec3 vWearP;
float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
// curvature = how far the normal turns per metre of surface (1/radius): rims, brims, box edges
// and knuckles are sharp (> ~1500/m); limbs (r 2 mm) and the tunic (r 6 mm) are not. Resolution
// independent, so the wear is the same at the commander's chair and in close-up.
float wEdge = 0.0;
#ifndef FLAT_SHADED
  float wCurv = length(fwidth(normalize(vNormal))) / max(1e-7, length(fwidth(vViewPosition)));
  wEdge = smoothstep(700.0, 2600.0, wCurv);
#endif
float wSpeck = wNoise(vWearP * 1400.0) * 0.65 + wNoise(vWearP * 4100.0) * 0.35;
float wv = vWear * smoothstep(0.45, 0.85, wEdge * (0.5 + 0.7 * wSpeck));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.59, 0.62), wv);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.34, wv);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = max(metalnessFactor, wv * 0.9);')
    if (rim > 0) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float wRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
totalEmissiveRadiance += vec3(1.0, 0.82, 0.58) * wRim * ${rim.toFixed(3)};`)
    }
  }
  m.customProgramCacheKey = () => 'worn-' + key + (rim > 0 ? '-rim' : '')
  m.name = 'worn-' + key
  return m
}

// Re-tint everything below yMax toward `c` (mud on tracks, damp at a wall foot), fading upward.
export function tintBelow(g: THREE.BufferGeometry, yMax: number, c: RGB, k: number): void {
  const p = g.getAttribute('position') as THREE.BufferAttribute, col = g.getAttribute('color') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, 1 - p.getY(i) / yMax)) * k * (0.7 + 0.3 * hash3(p.getX(i), 1, p.getZ(i)))
    col.setXYZ(i, col.getX(i) * (1 - t) + c[0] * t, col.getY(i) * (1 - t) + c[1] * t, col.getZ(i) * (1 - t) + c[2] * t)
  }
}
