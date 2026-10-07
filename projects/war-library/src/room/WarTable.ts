// The war-table (DESIGN §9 Table, Worker-C items): oak 2.4 × 1.6 × 0.9 m with cup-and-cover lathe
// legs, a carved blind-arcade apron, stretchers and a brass-bound edge. The central 1.20 × 1.00 m
// is a map well 3 mm below the top (flat, clear; Worker-B's map covers it so the two surfaces never
// z-fight); nothing on the top rises more than 1.2 cm. A banker's lamp on the near-left margin
// holds a REAL PointLight (see LightingRig).
import * as THREE from 'three'
import { TABLE_TOP_Y } from '../contract/render-api.ts'
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { Batch, REGION, T, extrude, lancetPath, lathe } from './Kit.ts'

export const TABLE = { w: 2.4, d: 1.6, top: TABLE_TOP_Y, slab: 0.055 }
export const MAP_WELL = { w: 1.2, d: 1.0, depth: 0.003 }
/**
 * Banker's lamp: base on the near-left margin, outboard of the map (its 0.5 m light range ends
 * before the map's edge, 0.38 m inboard of the base). The bulb sits in the shade.
 */
export const LAMP = { x: -1.1, z: 0.62 }
export const LAMP_BULB = new THREE.Vector3(LAMP.x, TABLE_TOP_Y + 0.33, LAMP.z)

const OAK = 0xc09c78
const OAK_DARK = 0x8c6e52

function roundRect(w: number, d: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape()
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}

const LEG: [number, number][] = [
  [0.07, 0], [0.07, 0.02], [0.055, 0.035], [0.05, 0.06], [0.062, 0.08], [0.045, 0.11], [0.04, 0.16],
  [0.058, 0.2], [0.085, 0.27], [0.098, 0.34], [0.094, 0.39], [0.075, 0.42], [0.098, 0.44], [0.09, 0.5],
  [0.066, 0.55], [0.045, 0.58], [0.052, 0.6], [0.05, 0.62], [0.001, 0.62],
]

export interface WarTable { group: THREE.Group; lampShade: THREE.Mesh }

export function buildWarTable(b: Batch): WarTable {
  const group = new THREE.Group()
  group.name = 'war-table'
  const { w, d, top, slab } = TABLE
  const y0 = top - slab
  // top slab with the map well cut out, then the well floor 3 mm down
  const ts = roundRect(w, d, 0.05)
  ts.holes.push(new THREE.Path(roundRect(MAP_WELL.w, MAP_WELL.d, 0.004).getPoints(4).reverse()))
  // extrude spans z ∈ [−bevel, depth + bevel]; Rx(90°) maps z → −y, so the top face lands on `top`
  b.add('oakV', extrude(ts, slab - 0.008, 0.004), T(0, top - 0.004, 0, Math.PI / 2, 0, 0), OAK, REGION.margin)
  b.box('oakV', -MAP_WELL.w / 2 - 0.01, y0, -MAP_WELL.d / 2 - 0.01, MAP_WELL.w / 2 + 0.01, top - MAP_WELL.depth, MAP_WELL.d / 2 + 0.01, 0xb09070, REGION.board)
  // brass band on the edge and a brass fillet round the map well (1 mm proud)
  const band = roundRect(w + 0.016, d + 0.016, 0.058)
  band.holes.push(new THREE.Path(roundRect(w - 0.004, d - 0.004, 0.048).getPoints(6).reverse()))
  b.add('brassV', extrude(band, 0.03), T(0, top + 0.001, 0, Math.PI / 2, 0, 0), 0xffffff, REGION.margin)
  const fil = roundRect(MAP_WELL.w + 0.05, MAP_WELL.d + 0.05, 0.012)
  fil.holes.push(new THREE.Path(roundRect(MAP_WELL.w + 0.03, MAP_WELL.d + 0.03, 0.008).getPoints(6).reverse()))
  b.add('brassV', extrude(fil, 0.004), T(0, top + 0.001, 0, Math.PI / 2, 0, 0), 0xffffff, REGION.margin)
  // brass corner plates
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cs = new THREE.Shape()
    cs.moveTo(0, 0); cs.lineTo(0.16, 0); cs.quadraticCurveTo(0.05, 0.05, 0, 0.16); cs.closePath()
    b.add('brassV', extrude(cs, 0.0025), T(sx * (w / 2 - 0.012), top + 0.0025, sz * (d / 2 - 0.012), Math.PI / 2, 0, 0).multiply(new THREE.Matrix4().makeScale(-sx, -sz, 1)), 0xffffff, REGION.margin)
  }
  // apron: blind pointed arcade on a sunk backing, bead mouldings above and below
  const ay0 = 0.66, ah = y0 - ay0, inset = 0.11
  const apron = (len: number, M: THREE.Matrix4) => {
    const s = new THREE.Shape()
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, ah); s.lineTo(-len / 2, ah); s.closePath()
    const n = Math.floor((len - 0.12) / 0.13)
    for (let i = 0; i < n; i++) s.holes.push(lancetPath(0.085, 0.11, -((n - 1) * 0.13) / 2 + i * 0.13, 0.04, 0.07))
    b.add('oakV', extrude(s, 0.025), M, OAK, REGION.other)
    b.add('oakV', new THREE.BoxGeometry(len, ah - 0.02, 0.02).translate(0, ah / 2, -0.012), M, OAK_DARK, REGION.other)
    b.add('oakV', new THREE.CylinderGeometry(0.012, 0.012, len, 8).rotateZ(Math.PI / 2).translate(0, ah - 0.012, 0.03), M, OAK, REGION.other)
    b.add('oakV', new THREE.CylinderGeometry(0.01, 0.01, len, 8).rotateZ(Math.PI / 2).translate(0, 0.012, 0.028), M, OAK, REGION.other)
  }
  const lx = w / 2 - inset, lz = d / 2 - inset
  apron(2 * lx, T(0, ay0, lz))
  apron(2 * lx, T(0, ay0, -lz, 0, Math.PI, 0))
  apron(2 * lz, T(lx, ay0, 0, 0, Math.PI / 2, 0))
  apron(2 * lz, T(-lx, ay0, 0, 0, -Math.PI / 2, 0))
  // legs: square blocks top and bottom, cup-and-cover turning between
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (lx - 0.02), z = sz * (lz - 0.02)
    b.box('oakV', x - 0.065, 0, z - 0.065, x + 0.065, 0.1, z + 0.065, OAK_DARK, REGION.other)
    b.add('oakV', lathe(LEG, 16), T(x, 0.1, z, 0, 0, 0, 1, (ay0 - 0.2) / 0.62, 1), OAK, REGION.other)
    b.box('oakV', x - 0.06, ay0 - 0.1, z - 0.06, x + 0.06, y0, z + 0.06, OAK, REGION.other)
  }
  // stretchers: H-frame near the floor
  for (const sz of [-1, 1]) b.box('oakV', -lx, 0.03, sz * (lz - 0.02) - 0.03, lx, 0.1, sz * (lz - 0.02) + 0.03, OAK_DARK, REGION.other)
  b.box('oakV', -0.03, 0.04, -lz, 0.03, 0.1, lz, OAK_DARK, REGION.other)

  // banker's lamp: turned brass base and stem, a yoke holding a green cased-glass trough shade
  // (closed ends, rolled lip) glowing inside, and a bead pull-chain hanging from the shade's lip.
  // Lamp parts are REGION.other: the harness's lamp gate measures the margin round it, not it.
  const L = T(LAMP.x, top, LAMP.z)
  const LR = REGION.other
  b.add('brassV', lathe([[0.001, 0], [0.085, 0], [0.088, 0.008], [0.08, 0.018], [0.05, 0.03], [0.03, 0.05], [0.014, 0.06], [0.001, 0.062]], 24), L, 0xffffff, LR)
  b.add('brassV', lathe([[0.009, 0], [0.009, 0.2], [0.013, 0.21], [0.013, 0.225], [0.008, 0.235], [0.008, 0.25], [0.001, 0.25]], 10), T(LAMP.x, top + 0.055, LAMP.z), 0xffffff, LR)
  const SY = 0.335 // shade axis height above the top
  b.add('brassV', new THREE.BoxGeometry(0.012, 0.012, 0.012).translate(0, 0.3, 0), L, 0xffffff, LR)
  b.add('brassV', new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6).rotateZ(Math.PI / 2).translate(0, 0.305, 0), L, 0xffffff, LR)
  for (const sx of [-1, 1]) b.add('brassV', new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6).translate(sx * 0.12, 0.322, 0), L, 0xffffff, LR)
  // shade cross-section (y-z plane): a semi-ellipse, 0.15 deep and 0.07 tall, with a rolled lip
  const RZ = 0.075, RY = 0.07, TH = 0.004, SL = 0.25
  const outer: THREE.Vector2[] = [], inner: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI
    outer.push(new THREE.Vector2(Math.cos(a) * (RZ + 0.004 * Math.sin(a) ** 8), Math.sin(a) * RY))
    inner.push(new THREE.Vector2(Math.cos(a) * (RZ - TH), Math.sin(a) * (RY - TH)))
  }
  const crescent = new THREE.Shape([...outer, ...inner.reverse()])
  const cap = new THREE.Shape(outer)
  // shape x → world z (toward the player), shape y → up, extrude along world x
  const toLamp = (g: THREE.BufferGeometry, x: number) => g.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(x, SY - 0.02, 0))
  const shadeParts = [toLamp(extrude(crescent, SL), SL / 2)]
  for (const sx of [-1, 1]) shadeParts.push(toLamp(new THREE.ExtrudeGeometry(cap, { depth: 0.004, bevelEnabled: false, curveSegments: 16 }), sx * (SL / 2 + (sx > 0 ? 0.004 : 0))))
  const merged = mergeGeometries(shadeParts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g }), false)
  if (!merged) throw new Error('WarTable: shade merge failed')
  const shadeGeo = toCreasedNormals(merged, 0.6) // smooth glass, crisp lip
  const shadeOut = new THREE.MeshPhysicalMaterial({ color: 0x155c32, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12,
    emissive: 0x0c4a20, emissiveIntensity: 0.45 })
  const shade = new THREE.Mesh(shadeGeo, shadeOut)
  shade.name = 'lamp:shade'
  shade.applyMatrix4(L)
  shade.castShadow = true
  // brass rim along the lip and round the end plates
  const lip = new THREE.CylinderGeometry(0.003, 0.003, SL + 0.008, 6).rotateZ(Math.PI / 2)
  for (const sz of [-1, 1]) b.add('brassV', lip.clone().translate(0, SY - 0.02, sz * (RZ + 0.002)), L, 0xffffff, LR)
  // the glowing inside: seen from below and in the gallery view (HDR, feeds bloom)
  const glowGeo = new THREE.CylinderGeometry(RZ - TH - 0.001, RZ - TH - 0.001, SL - 0.002, 16, 1, true, 0, Math.PI)
  glowGeo.rotateZ(Math.PI / 2).scale(1, (RY - TH) / (RZ - TH), 1).translate(0, SY - 0.02, 0)
  const inner2 = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.3), side: THREE.BackSide }))
  inner2.applyMatrix4(L)
  inner2.name = 'lamp:glow'
  group.add(shade, inner2)
  // pull chain: touching beads from the front lip, ending in a brass acorn
  const pull = new THREE.Vector3(0.07, SY - 0.022, RZ - 0.006)
  for (let i = 0; i < 7; i++) b.add('brassV', new THREE.SphereGeometry(0.0032, 6, 4).translate(pull.x, pull.y - 0.004 - i * 0.0064, pull.z), L, 0xffffff, LR)
  b.add('brassV', lathe([[0.001, 0], [0.006, 0.006], [0.007, 0.012], [0.004, 0.02], [0.001, 0.022]], 8), T(0, 0, 0, Math.PI, 0, 0).premultiply(L.clone().multiply(T(pull.x, pull.y - 0.049, pull.z))), 0xffffff, LR)
  // A war-table at work, on the two margins the commander sees nearest: dispatches under a wax
  // seal and a brass compass to the west (in front of the inkpot), a leather map case and a pair
  // of dividers to the east (outboard of the British candle ranks, the case beside the bell). A blind A/B found "the table
  // edges mostly empty wood; add dispatch and map-case props". Static, in the room's batches.
  const P = REGION.other
  const sheets: [number, number, number, number][] = [[0, 0, 0.32, 0xf0e4c8], [0.012, -0.008, -0.06, 0xe6d6b0], [-0.006, 0.01, 0.18, 0xf4ead2]]
  sheets.forEach(([dx, dz, ry, tint], i) =>
    b.add('parchV', new THREE.BoxGeometry(0.205, 0.0014, 0.15), T(-0.86 + dx, top + 0.0007 + i * 0.0015, 0.36 + dz, 0, ry, 0), tint, P))
  b.add('leatherV', new THREE.CylinderGeometry(0.014, 0.015, 0.004, 16), T(-0.81, top + 0.0062, 0.4), 0x8e1a12, P)
  b.add('brassV', lathe([[0.001, 0], [0.036, 0], [0.038, 0.004], [0.037, 0.012], [0.033, 0.013], [0.001, 0.013]], 24), T(-0.71, top, 0.47), 0xffffff, P)
  b.add('parchV', new THREE.CylinderGeometry(0.031, 0.031, 0.001, 24), T(-0.71, top + 0.0135, 0.47), 0xf2e8cc, P)
  b.add('ironV', new THREE.BoxGeometry(0.004, 0.002, 0.05), T(-0.71, top + 0.0145, 0.47, 0, 0.5, 0), 0x2a1a14, P)
  const yaw = 0.12, ax = Math.sin(yaw), az = Math.cos(yaw)
  b.add('leatherV', new THREE.CylinderGeometry(0.034, 0.034, 0.32, 20).rotateX(Math.PI / 2).rotateY(yaw), T(0.98, top + 0.034, -0.17), 0x5a3a22, P)
  for (const s of [-1, 1]) {
    b.add('brassV', new THREE.CylinderGeometry(0.037, 0.037, 0.02, 20).rotateX(Math.PI / 2).rotateY(yaw), T(0.98 + s * 0.15 * ax, top + 0.034, -0.17 + s * 0.15 * az), 0xffffff, P)
    b.add('brassV', new THREE.BoxGeometry(0.004, 0.003, 0.13).translate(0, 0, 0.065), T(0.89, top + 0.0015, 0.7, 0, -2.3 + s * 0.08, 0), 0xffffff, P)
  }
  b.add('brassV', new THREE.CylinderGeometry(0.008, 0.008, 0.005, 12), T(0.89, top + 0.003, 0.7), 0xffffff, P)

  return { group, lampShade: shade }
}
