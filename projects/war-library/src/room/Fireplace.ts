// Stone fireplace in the east wall (DESIGN §9 Room): chimney breast with a four-centred (Tudor)
// arch, moulded surround, mantel on corbels, carved overmantel shield, hearth, iron firedogs,
// ember-cracked logs and a live fire of crossed noise-flame cards (HDR, feeds bloom).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { fbm } from '../render/ProceduralTextures.ts'
import { Batch, REGION, T, archPts, archRise, extrude, ribAlong } from './Kit.ts'
import { FIRE_HALF, FIRE_Z, GALLERY_Y, HALL } from './Layout.ts'

export interface Fire {
  group: THREE.Group
  light: THREE.Vector3
  update(t: number): void
}

const W = 2 * FIRE_HALF
const OPEN_W = 1.5, JAMB = 0.78, APEX = 1.22
const STONE = 0xd8c8b4

/** Opening outline (jambs + flattened pointed head), centred on x = cx, inset by `ins`. */
function opening(cx: number, ins: number): THREE.Vector2[] {
  const w = OPEN_W - 2 * ins
  const k = (APEX - ins - JAMB) / archRise(w, w * 0.7)
  const pts = [new THREE.Vector2(cx - w / 2, 0)]
  for (const p of archPts(w, 0, w * 0.7, 12)) pts.push(new THREE.Vector2(cx + p.x, JAMB + p.y * k))
  pts.push(new THREE.Vector2(cx + w / 2, 0))
  return pts
}

function emberTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 128
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  const img = ctx.createImageData(256, 128)
  const n = fbm(907, 8, 4, 4), m = fbm(911, 3, 2, 2)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = y / 128
    const crack = Math.pow(1 - Math.abs(n(u, v) - 0.5) * 2, 10)
    const g = crack * (0.35 + 0.65 * m(u, v))
    const i = (y * 256 + x) * 4
    img.data[i] = Math.min(255, g * 300); img.data[i + 1] = g * 120; img.data[i + 2] = g * 30; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function buildFireplace(b: Batch): Fire {
  const group = new THREE.Group()
  group.name = 'fireplace'
  // local frame: x along the wall (world +z), y up, z out of the wall (world −x)
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0))
    .setPosition(HALL.x, 0, FIRE_Z - FIRE_HALF)
  const L = (m: THREE.Matrix4) => M.clone().multiply(m)
  const cx = W / 2
  const H = GALLERY_Y - 0.33
  // breast with the opening, and the firebox back behind it
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.lineTo(W, 0); s.lineTo(W, H); s.lineTo(0, H); s.closePath()
  const hole = new THREE.Path(opening(cx, 0).reverse())
  s.holes.push(hole)
  b.add('ashlarV', extrude(s, 0.55), L(T(0, 0, 0.5)), STONE, REGION.other)
  b.add('ashlarV', new THREE.BoxGeometry(W, H, 0.5).translate(cx, H / 2, 0.25), M, 0x3a322c, REGION.other)
  // soot liner just inside the tunnel, moulded surround on the face
  b.add('ashlarV', ribAlong(opening(cx, 0.012), 0.02, 0.5), L(T(0, 0, 0.52)), 0x3c342e, REGION.other)
  b.add('ashlarV', ribAlong(opening(cx, -0.07), 0.12, 0.06), L(T(0, 0, 1.05)), 0xe6d8c4, REGION.other)
  // mantel, frieze, corbels
  b.add('ashlarV', new THREE.BoxGeometry(W + 0.24, 0.12, 0.34).translate(cx, 1.72, 1.17), M, 0xe2d4c0, REGION.other)
  b.add('ashlarV', new THREE.BoxGeometry(W - 0.1, 0.22, 0.12).translate(cx, 1.55, 1.1), M, 0xd0c0ac, REGION.other)
  for (const x of [0.16, W - 0.16]) b.add('ashlarV', new THREE.BoxGeometry(0.16, 0.34, 0.22).translate(x, 1.49, 1.14), M, 0xdccdb8, REGION.other)
  // overmantel: raised panel, carved shield with a cross, flanking blind lancets
  b.add('ashlarV', new THREE.BoxGeometry(W - 0.6, 1.0, 0.04).translate(cx, 2.42, 1.07), M, 0xcfbfaa, REGION.other)
  const sh = new THREE.Shape()
  sh.moveTo(-0.26, 0.32); sh.lineTo(0.26, 0.32); sh.lineTo(0.26, 0.02)
  sh.quadraticCurveTo(0.24, -0.28, 0, -0.42); sh.quadraticCurveTo(-0.24, -0.28, -0.26, 0.02); sh.closePath()
  // The shield is painted (oxblood field, gilt cross) so it reads as heraldry; the two blind
  // lancets that flanked it were bare stone outlines that an outside review saw as "a stray
  // floating arch and cross" beside the bookcase, and are gone.
  b.add('ashlarV', extrude(sh, 0.04, 0.012), L(T(cx, 2.5, 1.09)), 0x7a2a22, REGION.other)
  b.add('ashlarV', new THREE.BoxGeometry(0.07, 0.6, 0.03).translate(cx, 2.46, 1.14), M, 0xc9a24a, REGION.other)
  b.add('ashlarV', new THREE.BoxGeometry(0.42, 0.07, 0.03).translate(cx, 2.58, 1.14), M, 0xc9a24a, REGION.other)
  // hearth
  b.add('ashlarV', new THREE.BoxGeometry(W - 0.2, 0.06, 1.3).translate(cx, 0.03, 1.15), M, 0x8a7c6e, REGION.floor)
  // firedogs
  for (const x of [cx - 0.42, cx + 0.42]) {
    b.add('ironV', new THREE.BoxGeometry(0.04, 0.42, 0.04).translate(x, 0.27, 1.0), M, 0x6a6460, REGION.other)
    b.add('ironV', new THREE.SphereGeometry(0.045, 12, 8).translate(x, 0.52, 1.0), M, 0x8a7a60, REGION.other)
    b.add('ironV', new THREE.BoxGeometry(0.16, 0.03, 0.05).translate(x, 0.075, 1.0), M, 0x6a6460, REGION.other)
    b.add('ironV', new THREE.BoxGeometry(0.03, 0.03, 0.5).translate(x, 0.17, 0.76), M, 0x6a6460, REGION.other)
  }
  // logs and coal bed (one mesh, ember-cracked emissive)
  const logs: THREE.BufferGeometry[] = []
  const log = (r: number, len: number, x: number, y: number, z: number, ry: number, rz: number) => {
    const g = new THREE.CylinderGeometry(r, r * 1.08, len, 14, 1)
    g.applyMatrix4(T(x, y, z, 0, ry, Math.PI / 2 + rz))
    logs.push(g)
  }
  log(0.075, 1.1, cx, 0.24, 0.8, 0.08, 0)
  log(0.085, 1.0, cx + 0.05, 0.25, 0.62, -0.1, 0.02)
  log(0.06, 0.9, cx - 0.1, 0.37, 0.7, 0.35, -0.08)
  const bed = new THREE.CylinderGeometry(0.5, 0.56, 0.08, 18)
  bed.scale(1.2, 1, 0.5); bed.translate(cx, 0.1, 0.74)
  logs.push(bed)
  const lg = mergeGeometries(logs.map((g) => g.toNonIndexed()), false)
  if (!lg) throw new Error('Fireplace: log merge failed')
  lg.applyMatrix4(M)
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 0.95, emissive: 0xff6420, emissiveMap: emberTexture(), emissiveIntensity: 2.6 })
  const logMesh = new THREE.Mesh(lg, emberMat)
  logMesh.name = 'fire:logs'
  logMesh.receiveShadow = true
  group.add(logMesh)
  // flame cards
  const cards: THREE.BufferGeometry[] = []
  for (let k = 0; k < 6; k++) {
    const g = new THREE.PlaneGeometry(0.5 - k * 0.03, 0.72 - (k % 3) * 0.1, 1, 1)
    g.translate(0, (0.72 - (k % 3) * 0.1) / 2, 0)
    g.applyMatrix4(T(cx + (k - 2.5) * 0.08, 0.16, 0.72 + ((k % 2) - 0.5) * 0.08, 0, (k * Math.PI) / 6 + 0.2, 0))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(k / 6), 1))
    cards.push(g)
  }
  const fg = mergeGeometries(cards, false)
  if (!fg) throw new Error('Fireplace: flame merge failed')
  fg.applyMatrix4(M)
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uI: { value: 3.2 } },
    vertexShader: /* glsl */`
      attribute float aPhase; varying vec2 vUv; varying float vP;
      void main() { vUv = uv; vP = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uI; varying vec2 vUv; varying float vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float t = uTime * 1.7 + vP * 17.0;
        float q = n(vec2(vUv.x * 4.0 + vP * 9.0, vUv.y * 3.0 - t)) * 0.6 + n(vec2(vUv.x * 9.0, vUv.y * 7.0 - t * 1.9)) * 0.4;
        float x = (vUv.x - 0.5) * 2.0;
        float w = mix(0.95, 0.08, pow(vUv.y, 0.8));
        float s = 1.0 - abs(x + (q - 0.5) * 0.5 * vUv.y) / w + (q - 0.5) * 0.7;
        float body = smoothstep(0.0, 0.45, s) * (1.0 - smoothstep(0.35, 1.0, vUv.y + (q - 0.5) * 0.45));
        body *= smoothstep(0.0, 0.1, vUv.y);
        vec3 col = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.62, 0.2), smoothstep(0.15, 0.8, body));
        col = mix(col, vec3(1.0, 0.9, 0.65), smoothstep(0.7, 1.0, body) * (1.0 - vUv.y));
        gl_FragColor = vec4(col * body * uI, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const flames = new THREE.Mesh(fg, flameMat)
  flames.name = 'fire:flames'
  flames.renderOrder = 3
  group.add(flames)
  const light = new THREE.Vector3(cx, 0.55, 0.95).applyMatrix4(M)
  return {
    group, light,
    update(t) {
      flameMat.uniforms.uTime.value = t
      emberMat.emissiveIntensity = 2.3 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 3.7 + 1)
    },
  }
}
