// Floor props (DESIGN §9 Room): Turkey rug under the table, a globe on a turned stand, a reading
// slope with an open folio, gothic chairs (the empty German chair faces you across the table),
// two rolling ladders hooked on the brass rails, and the padlocked iron gate of the restricted
// stacks at the north end. Static parts go into the Batch; the rug and the globe carry their own
// textures (one draw call each).
import * as THREE from 'three'
import { rugTexture, globeTexture } from '../render/ProceduralTextures.ts'
import { roomMat } from '../render/MaterialLibrary.ts'
import { Batch, REGION, T, extrude, lancetPath, lancetShape, lathe } from './Kit.ts'
import type { Region } from './Kit.ts'
import { HALL, LOWER_FACE } from './Layout.ts'
import { createSeededRandom } from '@lid/random'

const WOOD = 0xa88a6c
const IRON = 0x5a5550

function boxAt(b: Batch, key: string, M: THREE.Matrix4, w: number, h: number, d: number, x: number, y: number, z: number,
  tint: THREE.ColorRepresentation, region: Region = REGION.other): void {
  b.add(key, new THREE.BoxGeometry(w, h, d).translate(x, y, z), M, tint, region)
}

// n books stacked on the floor, each a little turned: two boards, a spine and the page block
const LEATHER = [0x5a2018, 0x2a3a2a, 0x2c2a4a, 0x6a4a22, 0x3a1c14]
function bookStack(b: Batch, x: number, z: number, n: number, seed: number): void {
  const r = createSeededRandom(seed)
  let y = 0
  for (let i = 0; i < n; i++) {
    const w = 0.2 + r() * 0.09, d = 0.14 + r() * 0.06, h = 0.03 + r() * 0.03, col = LEATHER[Math.floor(r() * LEATHER.length)]
    const M = T(x + (r() - 0.5) * 0.03, y, z + (r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.7, 0)
    boxAt(b, 'leatherV', M, w, 0.004, d, 0, 0.002, 0, col)
    boxAt(b, 'leatherV', M, w, 0.004, d, 0, h - 0.002, 0, col)
    boxAt(b, 'leatherV', M, 0.008, h, d, -w / 2 + 0.004, h / 2, 0, col)
    boxAt(b, 'parchV', M, w - 0.012, h - 0.008, d - 0.008, 0.002, h / 2, 0, 0xe8dcc0)
    y += h
  }
}

/** Box from a to b (a beam/stile), `w` × `d` cross-section, rolled so `d` faces `side`. */
function beam(b: Batch, key: string, a: THREE.Vector3, c: THREE.Vector3, w: number, d: number, tint: THREE.ColorRepresentation): void {
  const dir = c.clone().sub(a)
  const len = dir.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  b.add(key, new THREE.BoxGeometry(w, len, d), m, tint, REGION.other)
}

export function chair(b: Batch, x: number, z: number, ry: number): void {
  const M = T(x, 0, z, 0, ry, 0)
  const sw = 0.52, sd = 0.48, sh = 0.46, bh = 1.3
  for (const [lx, lz] of [[-1, 1], [1, 1]]) boxAt(b, 'oakV', M, 0.055, sh, 0.055, lx * (sw / 2 - 0.03), sh / 2, lz * (sd / 2 - 0.03), WOOD)
  for (const lx of [-1, 1]) {
    boxAt(b, 'oakV', M, 0.06, bh, 0.06, lx * (sw / 2 - 0.03), bh / 2, -(sd / 2 - 0.03), WOOD)
    b.add('oakV', lathe([[0.03, 0], [0.03, 0.03], [0.018, 0.05], [0.028, 0.09], [0.01, 0.16], [0, 0.18]], 8), M.clone().multiply(T(lx * (sw / 2 - 0.03), bh, -(sd / 2 - 0.03))), WOOD, REGION.other)
  }
  boxAt(b, 'oakV', M, sw, 0.05, sd, 0, sh + 0.025, 0, WOOD)
  boxAt(b, 'leatherV', M, sw - 0.06, 0.045, sd - 0.06, 0, sh + 0.07, 0.01, 0x7a2a22)
  // stretchers
  boxAt(b, 'oakV', M, sw - 0.05, 0.04, 0.035, 0, 0.12, sd / 2 - 0.03, WOOD)
  boxAt(b, 'oakV', M, sw - 0.05, 0.04, 0.035, 0, 0.12, -(sd / 2 - 0.03), WOOD)
  for (const lx of [-1, 1]) boxAt(b, 'oakV', M, 0.035, 0.04, sd - 0.05, lx * (sw / 2 - 0.03), 0.16, 0, WOOD)
  // back: leather panel with brass nails, rails, pointed-arch cresting
  const bz = -(sd / 2 - 0.03)
  boxAt(b, 'leatherV', M, sw - 0.1, 0.5, 0.025, 0, sh + 0.42, bz + 0.005, 0x7a2a22)
  boxAt(b, 'oakV', M, sw - 0.06, 0.06, 0.045, 0, sh + 0.15, bz, WOOD)
  boxAt(b, 'oakV', M, sw - 0.06, 0.07, 0.045, 0, sh + 0.7, bz, WOOD)
  for (let i = 0; i < 9; i++) {
    const nx = -sw / 2 + 0.07 + (i * (sw - 0.14)) / 8
    for (const ny of [sh + 0.19, sh + 0.65]) b.add('brassV', new THREE.SphereGeometry(0.008, 6, 4).translate(nx, ny, bz + 0.02), M, 0xffffff, REGION.other)
  }
  const crest = lancetShape(sw - 0.1, 0.36, (sw - 0.1) * 0.8)
  crest.holes.push(lancetPath((sw - 0.1) * 0.55, 0.24, 0, 0.03, (sw - 0.1) * 0.44))
  b.add('oakV', extrude(crest, 0.03), M.clone().multiply(T(0, sh + 0.735, bz - 0.015)), WOOD, REGION.other)
}

function ladder(b: Batch, sx: number, z: number): void {
  const railX = sx * (LOWER_FACE - 0.07), railY = 2.78
  const lean = Math.tan((15 * Math.PI) / 180)
  const foot = sx * (LOWER_FACE - 0.07 - (railY + 0.05) * lean)
  for (const dz of [-0.22, 0.22]) {
    const a = new THREE.Vector3(foot, 0.05, z + dz), c = new THREE.Vector3(railX - sx * 0.03, railY + 0.08, z + dz)
    beam(b, 'oakV', a, c, 0.065, 0.05, WOOD)
    // hook over the rail, wheel at the foot
    b.box('brassV', railX - sx * 0.05, railY + 0.06, z + dz - 0.012, railX + sx * 0.04, railY + 0.085, z + dz + 0.012, 0xffffff, REGION.other)
    b.box('brassV', railX + sx * 0.03, railY - 0.03, z + dz - 0.012, railX + sx * 0.045, railY + 0.085, z + dz + 0.012, 0xffffff, REGION.other)
    b.add('brassV', new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), T(foot, 0.035, z + dz, Math.PI / 2, 0, 0), 0xffffff, REGION.other)
  }
  for (let y = 0.3; y < railY - 0.05; y += 0.28) {
    const x = foot + (sx * y) * lean
    b.add('oakV', new THREE.CylinderGeometry(0.017, 0.017, 0.44, 8), T(x, y, z, Math.PI / 2, 0, 0), WOOD, REGION.other)
  }
}

function gate(b: Batch, z: number): void {
  const x0 = -LOWER_FACE + 0.02, x1 = LOWER_FACE - 0.02
  const top = 2.25
  for (const y of [0.1, 0.95, 1.15, top]) b.box('ironV', x0, y - 0.02, z - 0.02, x1, y + 0.02, z + 0.02, IRON, REGION.other)
  for (let x = x0 + 0.06; x < x1; x += 0.11) {
    if (Math.abs(Math.abs(x) - 0.95) < 0.05) continue
    b.box('ironV', x - 0.009, 0.08, z - 0.009, x + 0.009, top + 0.2, z + 0.009, IRON, REGION.other)
    b.add('ironV', new THREE.ConeGeometry(0.022, 0.1, 4).translate(0, 0.05, 0), T(x, top + 0.2, z, 0, Math.PI / 4, 0), IRON, REGION.other)
    b.add('ironV', new THREE.TorusGeometry(0.045, 0.006, 4, 12), T(x + 0.055, 1.05, z), IRON, REGION.other)
  }
  for (const px of [-0.95, 0.95]) {
    b.box('ironV', px - 0.045, 0, z - 0.045, px + 0.045, 2.75, z + 0.045, IRON, REGION.other)
    b.add('brassV', new THREE.SphereGeometry(0.06, 12, 8), T(px, 2.8, z), 0xffffff, REGION.other)
  }
  b.box('ironV', -0.012, 0.08, z - 0.02, 0.012, top + 0.02, z + 0.02, IRON, REGION.other) // meeting stile
  // chain and padlock
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const g = new THREE.TorusGeometry(0.022, 0.006, 4, 8); g.scale(1, 1.5, 1)
    b.add('ironV', g, T(Math.cos(a) * 0.05, 1.3 + Math.sin(a) * 0.03, z + 0.04 + Math.sin(a) * 0.02, 0, (i % 2) * Math.PI / 2 + a, Math.PI / 2), 0x7a746e, REGION.other)
  }
  b.box('brassV', -0.04, 1.14, z + 0.06, 0.04, 1.23, z + 0.09, 0xffffff, REGION.other)
  b.add('ironV', new THREE.TorusGeometry(0.028, 0.006, 6, 12, Math.PI), T(0, 1.23, z + 0.075), 0x8a8480, REGION.other)
}

export interface Props { group: THREE.Group; globe: THREE.Mesh }

export function buildProps(b: Batch): Props {
  const group = new THREE.Group()
  group.name = 'props'
  // rug
  const rugMat = new THREE.MeshPhysicalMaterial({ map: rugTexture(), roughness: 0.93, sheen: 0.7, sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#b07a5a'), bumpMap: roomMat('leatherV').bumpMap, bumpScale: 0.4 })
  rugMat.map!.anisotropy = 8
  const rug = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.012, 3.0), rugMat)
  rug.position.set(0, 0.006, -0.1)
  rug.receiveShadow = true
  rug.name = 'rug'
  rug.userData.region = REGION.floor
  group.add(rug)
  // a runner up the aisle to the gate: past the table's far edge the commander's view was a strip
  // of bare flagstones (blind A/B: "the top third is bare floor and chair")
  const runner = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.01, 4.9), rugMat.clone())
  runner.material.map = rugTexture(57, 384, 1280)
  runner.material.map.anisotropy = 8
  runner.position.set(0, 0.005, -4.15)
  runner.receiveShadow = true
  runner.name = 'runner'
  runner.userData.region = REGION.floor
  group.add(runner)
  // globe on a turned stand
  const gx = -1.75, gz = -1.95
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const fx = gx + Math.cos(a) * 0.3, fz = gz + Math.sin(a) * 0.3
    b.add('oakV', lathe([[0.03, 0], [0.035, 0.05], [0.02, 0.1], [0.032, 0.3], [0.022, 0.5], [0.028, 0.66], [0.024, 0.7]], 8), T(fx, 0, fz), WOOD, REGION.other)
  }
  b.add('oakV', new THREE.TorusGeometry(0.36, 0.028, 6, 40), T(gx, 0.72, gz, Math.PI / 2, 0, 0), WOOD, REGION.other)
  b.add('oakV', new THREE.BoxGeometry(0.62, 0.035, 0.05).translate(0, 0.14, 0), T(gx, 0, gz, 0, Math.PI / 4, 0), WOOD, REGION.other)
  b.add('oakV', new THREE.BoxGeometry(0.62, 0.035, 0.05).translate(0, 0.14, 0), T(gx, 0, gz, 0, -Math.PI / 4, 0), WOOD, REGION.other)
  b.add('oakV', lathe([[0.04, 0], [0.03, 0.1], [0.045, 0.2], [0.02, 0.35], [0.012, 0.42]], 10), T(gx, 0.14, gz), WOOD, REGION.other)
  const tilt = (23.4 * Math.PI) / 180
  b.add('brassV', new THREE.TorusGeometry(0.325, 0.008, 6, 64), T(gx, 0.75, gz, 0, 0.6, tilt), 0xffffff, REGION.other)
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.32, envMapIntensity: 0.8 }))
  globe.position.set(gx, 0.75, gz)
  globe.rotation.set(0, 0.6, tilt, 'YXZ')
  globe.castShadow = true
  globe.receiveShadow = true
  globe.name = 'globe'
  group.add(globe)
  // reading slope with an open folio
  const rx = 1.8, rz = -2.05
  const R = T(rx, 0, rz, 0, -0.5, 0)
  boxAt(b, 'oakV', R, 0.5, 0.05, 0.08, 0, 0.025, 0, WOOD)
  boxAt(b, 'oakV', R, 0.08, 0.05, 0.46, 0, 0.025, 0, WOOD)
  b.add('oakV', lathe([[0.05, 0.04], [0.035, 0.12], [0.05, 0.3], [0.03, 0.55], [0.045, 0.8], [0.03, 0.95], [0.04, 1.0]], 10), R, WOOD, REGION.other)
  const desk = R.clone().multiply(T(0, 1.06, 0, 0.36, 0, 0))
  boxAt(b, 'oakV', desk, 0.66, 0.03, 0.46, 0, 0, 0, WOOD)
  boxAt(b, 'oakV', desk, 0.66, 0.05, 0.03, 0, 0.025, 0.23, WOOD)
  const book = desk.clone().multiply(T(0, 0.016, -0.01))
  boxAt(b, 'leatherV', book, 0.6, 0.012, 0.4, 0, 0.006, 0, 0x5a2018)
  for (const s of [-1, 1]) boxAt(b, 'parchV', book.clone().multiply(T(s * 0.14, 0.012, 0, 0, 0, -s * 0.05)), 0.27, 0.03, 0.37, 0, 0.015, 0, 0xf0e4c8)
  // chairs: the empty German chair across the table, and one at each end
  const zone = b.zone
  b.zone = 'table' // the chairs stand in the key light's cone: they cast every frame
  chair(b, 0, -1.3, 0)
  chair(b, -1.62, 0.15, Math.PI / 2)
  chair(b, 1.62, -0.05, -Math.PI / 2)
  b.zone = zone
  // rolling ladders on the brass rails
  ladder(b, -1, -4.35)
  ladder(b, 1, 2.1)
  gate(b, -7.0)
  // An outside review found "a backdrop, not a place": the floor an empty stone field, none of
  // the house's own signature. Reading tables flank the aisle to the war-table, two oil portraits
  // hang beside the outer lancets, and the library's owl keeps watch from the gate post.
  readingTable(b, -1.75, 1.9, 0)
  readingTable(b, 1.75, 1.95, 1)
  // books left where they were read: two by the runner in the strip above the table, two by the
  // end chairs for the turned seat (blind A/B: "books and props on the floor")
  bookStack(b, 0.98, -2.75, 5, 11)
  bookStack(b, -1.08, -3.25, 3, 12)
  bookStack(b, 2.02, -0.85, 4, 13)
  bookStack(b, -2.05, 0.9, 6, 14)
  group.add(portraits(b))
  owl(b, -0.95, 2.86, -7.0)
  return { group, globe }
}

// A refectory reading table along the aisle: turned legs, a stretcher, stacked folios, an open
// book and a brass candlestick (the candle is wax, unlit: the chandelier lights the aisle).
function readingTable(b: Batch, x: number, z: number, seed: number): void {
  const M = T(x, 0, z, 0, Math.PI / 2, 0) // long axis along z
  const L = 1.6, W = 0.72, H = 0.76
  boxAt(b, 'oakV', M, L, 0.05, W, 0, H, 0, WOOD)
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.add('oakV', lathe([[0.04, 0], [0.032, 0.06], [0.045, 0.18], [0.026, 0.4], [0.045, 0.6], [0.032, 0.73]], 10),
      M.clone().multiply(T(lx * (L / 2 - 0.1), 0, lz * (W / 2 - 0.08))), WOOD, REGION.other)
  }
  boxAt(b, 'oakV', M, L - 0.2, 0.05, 0.05, 0, 0.14, 0, WOOD)
  const top = M.clone().multiply(T(0, H + 0.025, 0))
  // folio stacks, then an open book and a candlestick
  const colours = [0x5a2018, 0x2f4a32, 0x6b4a24, 0x283850, 0x7a2a22]
  for (let s = 0; s < 2; s++) {
    const sx = (s === 0 ? -0.5 : 0.48) + seed * 0.04
    let y = 0
    for (let i = 0; i < 4 - s; i++) {
      const t = 0.035 + ((i + seed) % 3) * 0.012, w = 0.34 - i * 0.02
      boxAt(b, 'leatherV', top.clone().multiply(T(sx, y + t / 2, 0.02 * ((i % 2) - 0.5), 0, 0.08 * (i - 1.5), 0)), w, t, 0.26, 0, 0, 0, colours[(i + s + seed) % colours.length])
      y += t
    }
  }
  const open = top.clone().multiply(T(0.02, 0.01, 0.06, 0, 0.2 * (seed - 0.5), 0))
  boxAt(b, 'leatherV', open, 0.46, 0.012, 0.32, 0, 0, 0, 0x4a1c14)
  for (const s of [-1, 1]) boxAt(b, 'parchV', open.clone().multiply(T(s * 0.11, 0.012, 0, 0, 0, -s * 0.06)), 0.21, 0.022, 0.3, 0, 0, 0, 0xf0e4c8)
  const cs = top.clone().multiply(T(-0.2, 0, -0.24))
  b.add('brassV', lathe([[0.05, 0], [0.04, 0.012], [0.012, 0.03], [0.016, 0.12], [0.03, 0.14], [0.012, 0.15]], 12), cs, 0xffffff, REGION.other)
  b.add('parchV', new THREE.CylinderGeometry(0.011, 0.012, 0.14, 8).translate(0, 0.22, 0), cs, 0xf4ecd8, REGION.other)
}

// Two oils in gilt frames on the north wall, between the outer lancets and the stacks: a bewhiskered
// founder and a dark polder landscape with a windmill. One canvas texture, one draw call; the
// frames go into the batch.
function portraits(b: Batch): THREE.Mesh {
  const z = HALL.zN + 0.06, y = 4.45, w = 0.82, h = 1.04
  const xs = [-3.62, 3.62]
  const pos: number[] = [], uv: number[] = []
  xs.forEach((x, i) => {
    const u0 = i * 0.5, u1 = u0 + 0.5
    const q = [[x - w / 2, y - h / 2, u0, 0], [x + w / 2, y - h / 2, u1, 0], [x + w / 2, y + h / 2, u1, 1], [x - w / 2, y + h / 2, u0, 1]]
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], z); uv.push(q[k][2], q[k][3]) }
    // the gilt frame: four bars and a darker raised inner lip
    const f = 0.075
    b.box('brassV', x - w / 2 - f, y - h / 2 - f, z - 0.03, x + w / 2 + f, y - h / 2, z + 0.03, 0xd9b25a, REGION.other)
    b.box('brassV', x - w / 2 - f, y + h / 2, z - 0.03, x + w / 2 + f, y + h / 2 + f, z + 0.03, 0xd9b25a, REGION.other)
    b.box('brassV', x - w / 2 - f, y - h / 2, z - 0.03, x - w / 2, y + h / 2, z + 0.03, 0xd9b25a, REGION.other)
    b.box('brassV', x + w / 2, y - h / 2, z - 0.03, x + w / 2 + f, y + h / 2, z + 0.03, 0xd9b25a, REGION.other)
    b.box('brassV', x - w / 2, y - h / 2, z + 0.004, x + w / 2, y - h / 2 + 0.015, z + 0.02, 0x8a6a2a, REGION.other)
    b.box('brassV', x - w / 2, y + h / 2 - 0.015, z + 0.004, x + w / 2, y + h / 2, z + 0.02, 0x8a6a2a, REGION.other)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paintings(), roughness: 0.48, metalness: 0, envMapIntensity: 0.5 }))
  m.name = 'portraits'
  m.userData.region = REGION.other
  return m
}

function paintings(): THREE.CanvasTexture {
  const W = 512, H = 640, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('Props: no 2D context for the portraits')
  const half = W / 2
  // 1: the founder — umber ground, black coat, white stock, a lit face with side-whiskers
  let gr = g.createRadialGradient(half * 0.5, H * 0.35, 10, half * 0.5, H * 0.45, H * 0.7)
  gr.addColorStop(0, '#6a4a2a'); gr.addColorStop(1, '#1a120b')
  g.fillStyle = gr; g.fillRect(0, 0, half, H)
  g.fillStyle = '#0f0c0a'
  g.beginPath(); g.moveTo(half * 0.08, H); g.quadraticCurveTo(half * 0.12, H * 0.58, half * 0.5, H * 0.55)
  g.quadraticCurveTo(half * 0.88, H * 0.58, half * 0.92, H); g.fill()
  g.fillStyle = '#e8e0cc'; g.beginPath(); g.moveTo(half * 0.4, H * 0.56); g.lineTo(half * 0.6, H * 0.56); g.lineTo(half * 0.5, H * 0.7); g.fill()
  gr = g.createRadialGradient(half * 0.46, H * 0.36, 6, half * 0.5, H * 0.4, half * 0.32)
  gr.addColorStop(0, '#f0c8a0'); gr.addColorStop(0.7, '#b07a52'); gr.addColorStop(1, '#5a3a22')
  g.fillStyle = gr; g.beginPath(); g.ellipse(half * 0.5, H * 0.4, half * 0.2, H * 0.14, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#d8d0c0' // grey side-whiskers
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(half * (0.5 + s * 0.17), H * 0.46, half * 0.07, H * 0.07, s * 0.3, 0, Math.PI * 2); g.fill() }
  g.fillStyle = '#2a1a10'
  for (const s of [-1, 1]) { g.beginPath(); g.arc(half * (0.5 + s * 0.08), H * 0.38, 4, 0, Math.PI * 2); g.fill() }
  g.strokeStyle = '#6a3a24'; g.lineWidth = 3; g.beginPath(); g.moveTo(half * 0.45, H * 0.47); g.lineTo(half * 0.55, H * 0.47); g.stroke()
  // 2: the polder at dusk — low horizon, a windmill, a row of poplars, a sky going to ochre
  gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, '#2c3a4a'); gr.addColorStop(0.55, '#c8a060'); gr.addColorStop(0.62, '#4a5a3a'); gr.addColorStop(1, '#1e2414')
  g.fillStyle = gr; g.fillRect(half, 0, half, H)
  g.fillStyle = '#1a1a14'
  const mx = half * 1.62, my = H * 0.6
  g.beginPath(); g.moveTo(mx - 18, my); g.lineTo(mx - 10, my - 90); g.lineTo(mx + 10, my - 90); g.lineTo(mx + 18, my); g.fill()
  g.strokeStyle = '#1a1a14'; g.lineWidth = 6
  for (let k = 0; k < 4; k++) { const a = 0.5 + k * Math.PI / 2; g.beginPath(); g.moveTo(mx, my - 88); g.lineTo(mx + Math.cos(a) * 70, my - 88 + Math.sin(a) * 70); g.stroke() }
  for (let k = 0; k < 7; k++) { const px = half * 1.1 + k * 22; g.beginPath(); g.ellipse(px, my - 30, 6, 34, 0, 0, Math.PI * 2); g.fill() }
  // varnish: a warm glaze and craquelure over both
  g.fillStyle = 'rgba(160, 110, 40, 0.16)'; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(20, 12, 4, 0.22)'; g.lineWidth = 1
  for (let k = 0; k < 160; k++) {
    let x = (k * 97) % W, yy = (k * 61) % H
    g.beginPath(); g.moveTo(x, yy)
    for (let s = 0; s < 4; s++) { x += ((k * 13 + s * 7) % 21) - 10; yy += ((k * 17 + s * 11) % 21) - 10; g.lineTo(x, yy) }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// The library's owl on the gate post: tawny body, pale facial disc, amber eyes, ear tufts.
function owl(b: Batch, x: number, y: number, z: number): void {
  const M = T(x, y, z, 0, 0.25, 0)
  b.add('leatherV', lathe([[0.001, 0], [0.07, 0.02], [0.09, 0.09], [0.085, 0.16], [0.06, 0.21], [0.001, 0.22]], 12), M, 0x8a6a48, REGION.other)
  b.add('leatherV', new THREE.SphereGeometry(0.075, 12, 10).translate(0, 0.27, 0), M, 0x7a5a3a, REGION.other)
  b.add('parchV', new THREE.CircleGeometry(0.06, 16).translate(0, 0.27, 0.07), M, 0xdcc8a4, REGION.other)
  for (const s of [-1, 1]) {
    b.add('brassV', new THREE.SphereGeometry(0.017, 10, 8).translate(s * 0.028, 0.282, 0.071), M, 0xffb030, REGION.other)
    b.add('ironV', new THREE.SphereGeometry(0.008, 6, 4).translate(s * 0.028, 0.282, 0.086), M, 0x111111, REGION.other)
    b.add('leatherV', new THREE.ConeGeometry(0.018, 0.06, 5).translate(s * 0.045, 0.35, 0.01), M.clone().multiply(T(0, 0, 0, 0, 0, -s * 0.3)), 0x6a4a2a, REGION.other)
    b.add('leatherV', new THREE.SphereGeometry(0.05, 8, 6).scale(0.5, 1.4, 1).translate(s * 0.075, 0.11, 0), M, 0x6a4a30, REGION.other) // folded wings
  }
  b.add('ironV', new THREE.ConeGeometry(0.01, 0.03, 5).rotateX(Math.PI / 2 + 0.5).translate(0, 0.262, 0.085), M, 0x3a3020, REGION.other)
}
