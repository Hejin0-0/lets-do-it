// North lancets (DESIGN §9 Room): leaded moonlit glass with Y-tracery, sills and hood moulds;
// additive moon shafts shaped like each lancet, travelling along the moon's direction; and 1,500
// pixel-sized dust motes spawned ONLY inside the shafts (never world-sized flares).
import * as THREE from 'three'
import { leadedGlass } from '../render/ProceduralTextures.ts'
import { Batch, REGION, T, archPts, archRise, lancetShape, ribAlong } from './Kit.ts'
import { HALL, LANCETS, MOON_DIR } from './Layout.ts'
import { createSeededRandom } from '../utils/random.ts'

export const MOTES = 1500

export interface Windows {
  group: THREE.Group
  update(t: number): void
  setPixelRatio(dpr: number): void
}

const STONE = 0xd4c6b2

export function buildWindows(b: Batch): Windows {
  const group = new THREE.Group()
  group.name = 'windows'
  const zIn = HALL.zN // inner face of the north wall
  const dir = new THREE.Vector3(...MOON_DIR).normalize()
  // the three lancets are the same size: one glass texture serves all of them (texture budget)
  const glassMat = new THREE.MeshBasicMaterial({ map: leadedGlass(300, LANCETS[0].w, LANCETS[0].h), color: new THREE.Color(1.25, 1.35, 1.6) })
  for (let i = 0; i < LANCETS.length; i++) {
    const l = LANCETS[i]
    // glass
    const shape = lancetShape(l.w, l.h)
    const g = new THREE.ShapeGeometry(shape, 12)
    const uv = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) + l.w / 2) / l.w, p.getY(k) / l.h)
    const glass = new THREE.Mesh(g, glassMat)
    if (i === 1) glass.scale.x = -1 // mirror the centre light so the three are not identical
    glass.position.set(l.x, l.y, zIn - 0.32)
    glass.name = 'lancet:' + i
    glass.castShadow = false
    glass.receiveShadow = false
    group.add(glass)
    // stone: sill, Y-tracery (two sub-arches and a mullion), hood mould on the inner face
    b.box('ashlarV', l.x - l.w / 2 - 0.12, l.y - 0.14, zIn - 0.1, l.x + l.w / 2 + 0.12, l.y, zIn + 0.08, STONE, REGION.other)
    const spring = l.h - archRise(l.w)
    b.box('ashlarV', l.x - 0.035, l.y, zIn - 0.38, l.x + 0.035, l.y + spring + 0.1, zIn - 0.26, STONE, REGION.other)
    for (const s of [-1, 1]) {
      const sub = archPts(l.w / 2, spring, l.w / 2, 10).map((v) => new THREE.Vector2(l.x + s * l.w / 4 + v.x, l.y + v.y))
      b.add('ashlarV', ribAlong(sub, 0.06, 0.12), T(0, 0, zIn - 0.38), STONE, REGION.other)
    }
    const hood = archPts(l.w + 0.16, spring + l.y, l.w + 0.16, 14).map((v) => new THREE.Vector2(l.x + v.x, v.y))
    hood.unshift(new THREE.Vector2(l.x - l.w / 2 - 0.08, l.y + spring - 0.3))
    hood.push(new THREE.Vector2(l.x + l.w / 2 + 0.08, l.y + spring - 0.3))
    b.add('ashlarV', ribAlong(hood, 0.1, 0.1), T(0, 0, zIn), STONE, REGION.other)
    // saddle-bar shadows come from the texture; the reveal is the wall's hole
  }

  // --- moon shafts ---------------------------------------------------------------------------
  const pos: number[] = [], ts: number[] = []
  for (const l of LANCETS) {
    const outline = lancetShape(l.w * 0.96, l.h * 0.98).getPoints(10)
    const L = (l.y + l.h) / -dir.y + 0.6
    for (let k = 0; k < outline.length; k++) {
      const a = outline[k], c = outline[(k + 1) % outline.length]
      const A = new THREE.Vector3(l.x + a.x, l.y + a.y, zIn), C = new THREE.Vector3(l.x + c.x, l.y + c.y, zIn)
      const A1 = A.clone().addScaledVector(dir, L), C1 = C.clone().addScaledVector(dir, L)
      for (const [v, t] of [[A, 0], [C, 0], [C1, 1], [A, 0], [C1, 1], [A1, 1]] as [THREE.Vector3, number][]) { pos.push(v.x, v.y, v.z); ts.push(t) }
    }
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  sg.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1))
  sg.computeVertexNormals()
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0.05, 0.065, 0.1) } },
    vertexShader: /* glsl */`
      attribute float aT;
      varying float vT; varying vec3 vN; varying vec3 vW;
      void main() {
        vT = aT; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vT; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float a = pow(abs(dot(normalize(vN), V)), 1.6);
        a *= smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.35, 1.0, vT));
        a *= smoothstep(0.05, 1.6, vW.y);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const shafts = new THREE.Mesh(sg, shaftMat)
  shafts.name = 'moon-shafts'
  shafts.renderOrder = 2
  group.add(shafts)

  // --- dust motes, inside the shafts only ----------------------------------------------------
  const rng = createSeededRandom(1917)
  const mp = new Float32Array(MOTES * 3), seeds = new Float32Array(MOTES)
  const areas = LANCETS.map((l) => l.w * l.h)
  const tot = areas.reduce((a, c) => a + c, 0)
  const polys = LANCETS.map((l) => lancetShape(l.w - 0.24, l.h - 0.24).getPoints(8))
  let n = 0, guard = 0
  while (n < MOTES) {
    if (++guard > MOTES * 50) throw new Error('Windows: mote sampling failed')
    let w = rng() * tot, i = 0
    while (w > areas[i]) { w -= areas[i]; i++ }
    const l = LANCETS[i]
    const px = (rng() - 0.5) * l.w, py = rng() * l.h
    if (!inside(polys[i], px, py - 0.12)) continue
    const L = (l.y + l.h) / -dir.y
    const t = 0.06 + rng() * 0.62
    const v = new THREE.Vector3(l.x + px, l.y + py, zIn).addScaledVector(dir, t * L)
    if (v.y < 0.25) continue
    mp.set([v.x, v.y, v.z], n * 3)
    seeds[n] = rng()
    n++
  }
  const pg = new THREE.BufferGeometry()
  pg.setAttribute('position', new THREE.BufferAttribute(mp, 3))
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 2 }, uColor: { value: new THREE.Color(0.75, 0.85, 1.1) } },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uPx;
      varying float vA;
      void main() {
        float s = aSeed * 6.2831;
        vec3 p = position + vec3(sin(uTime * 0.11 + s) * 0.05, sin(uTime * 0.07 + s * 1.7) * 0.06, cos(uTime * 0.09 + s * 2.3) * 0.05);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (0.8 + fract(aSeed * 13.7) * 0.9);
        float tw = 0.5 + 0.5 * sin(uTime * (0.6 + fract(aSeed * 7.3)) + s * 5.0);
        vA = (0.3 + 0.7 * tw * tw) * clamp(7.0 / -mv.z, 0.3, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = 1.0 - dot(d, d) * 4.0;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(uColor * a * vA, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(pg, moteMat)
  motes.name = 'dust-motes'
  motes.frustumCulled = false
  group.add(motes)

  return {
    group,
    update(t) { moteMat.uniforms.uTime.value = t },
    setPixelRatio(dpr) { moteMat.uniforms.uPx.value = 1.8 * dpr },
  }
}

function inside(poly: THREE.Vector2[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}
