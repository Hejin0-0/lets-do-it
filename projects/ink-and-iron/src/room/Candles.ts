// Floating candles (DESIGN §9 Room): 120 instanced wax candles drifting by sin(t·0.5+φ)·0.03 over
// the aisle, plus the chandelier's candles, each with an instanced camera-facing HDR flame + halo
// (the flames feed bloom). One draw call for wax, one for flames. dip() dims them (barrage).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createSeededRandom } from '@lid/random'
import { HALL, PRESS_IN, PRESS_Z } from './Layout.ts'

export const FLOATING = 120
/** DESIGN §13 performance cut: 60 floating candles on mobile. */
export const MOBILE_FLOATING = 60

export interface Candles {
  group: THREE.Group
  wax: THREE.InstancedMesh
  flames: THREE.InstancedMesh
  /** centroids of the north and south halves of the cloud (for the two candle lights) */
  clusters: [THREE.Vector3, THREE.Vector3]
  update(t: number, dip: number): void
}

/** Wax stick, 1 m tall in local y (instances scale y to the candle's height): ~100 triangles. */
function waxGeometry(): THREE.BufferGeometry {
  const r = 0.0125
  // a flat foot, a melted rim and a dished top
  const lathe = new THREE.LatheGeometry([
    [0.0001, 0], [r * 0.96, 0], [r, 0.9], [r * 0.95, 0.968], [r * 0.5, 0.962], [0.0001, 0.955],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 9)
  const parts: THREE.BufferGeometry[] = [lathe]
  for (const [a, y, l] of [[0.4, 0.86, 0.08], [2.6, 0.8, 0.14]]) {
    const d = new THREE.CapsuleGeometry(0.0032, l, 1, 4)
    d.translate(Math.cos(a) * r * 0.98, y, Math.sin(a) * r * 0.98)
    d.deleteAttribute('uv')
    parts.push(d)
  }
  lathe.deleteAttribute('uv')
  const g = mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p), false)
  if (!g) throw new Error('Candles: wax merge failed')
  // glow ramp: brighter toward the lit top (fake light bleeding through the wax)
  const pos = g.attributes.position, glow = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(Math.min(1, Math.max(0, pos.getY(i))), 3)
    glow[i * 3] = 0.72 + 0.5 * k; glow[i * 3 + 1] = 0.66 + 0.36 * k; glow[i * 3 + 2] = 0.55 + 0.2 * k
  }
  g.setAttribute('color', new THREE.BufferAttribute(glow, 3))
  return g
}

export function buildCandles(fixed: THREE.Vector3[], floating = FLOATING, seed = 42): Candles {
  const rng = createSeededRandom(seed)
  const pts: THREE.Vector3[] = []
  const heights: number[] = []
  let guard = 0
  while (pts.length < floating) {
    if (++guard > 100000) throw new Error(`Candles: could not place ${floating} candles`)
    const p = new THREE.Vector3((rng() * 2 - 1) * 3.7, 2.45 + rng() * 2.9, HALL.zN + 1.0 + rng() * (HALL.zS - HALL.zN - 2.4))
    if (Math.hypot(p.x, p.z + 0.3) < 1.25 && p.y < 4.4) continue // chandelier
    if (Math.abs(p.x) > PRESS_IN - 0.2 && p.y < 3.05 && PRESS_Z.some((z) => Math.abs(z - p.z) < 0.6)) continue
    if (pts.some((q) => q.distanceToSquared(p) < 0.5 * 0.5 * (FLOATING / floating))) continue
    pts.push(p)
    heights.push(0.13 + rng() * 0.13)
  }
  const n = floating + fixed.length
  const phase = new Float32Array(n)
  for (let i = 0; i < n; i++) phase[i] = rng() * Math.PI * 2
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.55, vertexColors: true, emissive: 0x6a3a14, emissiveIntensity: 0.55 })
  waxMat.name = 'candle-wax'
  // emissive follows the vertex glow ramp so the lit tip glows and the foot stays dark
  waxMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(0.75, 1.2, vColor.r) * 2.5;')
  }
  waxMat.customProgramCacheKey = () => 'candle-wax-v1'
  const wax = new THREE.InstancedMesh(waxGeometry(), waxMat, n)
  wax.name = 'candles:wax'
  wax.castShadow = false
  wax.receiveShadow = false

  const fg = new THREE.PlaneGeometry(1, 1)
  fg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDip: { value: 0 }, uQuad: { value: 0.34 } },
    vertexShader: /* glsl */`
      attribute float aPhase;
      uniform float uTime, uQuad;
      varying vec2 vUv; varying float vFl; varying float vPh;
      void main() {
        vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 p = c + right * position.x * uQuad + vec3(0.0, position.y * uQuad, 0.0);
        vUv = uv; vPh = aPhase;
        vFl = 0.86 + 0.08 * sin(uTime * 9.1 + aPhase * 5.0) + 0.06 * sin(uTime * 15.3 + aPhase * 11.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uDip, uQuad, uTime;
      varying vec2 vUv; varying float vFl; varying float vPh;
      void main() {
        vec2 q = (vUv - 0.5) * uQuad;                      // metres from the wick top
        q.x += sin(uTime * 3.1 + vPh * 7.0) * 0.0015 * max(q.y, 0.0) * 30.0;
        float sz = vFl * (1.0 - 0.35 * uDip);
        vec2 f = vec2(q.x / (0.0078 * sz), (q.y - 0.022 * sz) / (0.026 * sz));
        float taper = 1.0 - 0.6 * clamp(f.y, 0.0, 1.0);
        float r = length(vec2(f.x / max(taper, 0.2), f.y));
        float flame = smoothstep(1.0, 0.35, r);
        float core = smoothstep(0.55, 0.0, length(vec2(f.x * 1.3, f.y + 0.25)));
        vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.6), core);
        col = mix(col, vec3(0.3, 0.45, 1.0), smoothstep(-0.55, -0.95, f.y) * 0.6);
        float halo = exp(-dot(q, q) / (0.045 * 0.045)) * 0.18 + exp(-dot(q, q) / (0.012 * 0.012)) * 0.35;
        float k = 1.0 - 0.75 * uDip;
        gl_FragColor = vec4((col * flame * 4.2 + vec3(1.0, 0.6, 0.28) * halo) * k, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const flames = new THREE.InstancedMesh(fg, flameMat, n)
  flames.name = 'candles:flames'
  flames.frustumCulled = false
  flames.renderOrder = 4

  const base: THREE.Vector3[] = [...pts, ...fixed]
  const hs = [...heights, ...fixed.map(() => 0.16)]
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
  const place = (t: number) => {
    for (let i = 0; i < n; i++) {
      const b = base[i]
      const y = b.y + (i < floating ? Math.sin(t * 0.5 + phase[i]) * 0.03 : 0)
      wax.setMatrixAt(i, m.compose(v.set(b.x, y, b.z), q, s.set(1, hs[i], 1)))
      flames.setMatrixAt(i, m.makeTranslation(b.x, y + hs[i] * 0.955, b.z))
    }
    wax.instanceMatrix.needsUpdate = true
    flames.instanceMatrix.needsUpdate = true
  }
  place(0)
  wax.computeBoundingSphere()
  const group = new THREE.Group()
  group.name = 'candles'
  group.add(wax, flames)
  const north = pts.filter((p) => p.z < -1.5), south = pts.filter((p) => p.z >= -1.5)
  const avg = (a: THREE.Vector3[]) => a.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, a.length))
  return {
    group, wax, flames, clusters: [avg(north), avg(south)],
    update(t, dip) {
      place(t)
      flameMat.uniforms.uTime.value = t
      flameMat.uniforms.uDip.value = dip
      waxMat.emissiveIntensity = 0.55 * (1 - 0.7 * dip)
    },
  }
}
