// Painted tin miniatures (DESIGN §9 "Miniatures", digest_3d-assets §b). Every model is one
// merged vertex-painted geometry (Geo) in metres, standing on y = 0, facing -z (north).
//
// SPEC (the review targets; features exaggerated x1.4 so they read at ~30 px):
//   rifle-br  khaki #8A7E58 tunic with a flared skirt, Brodie "soup bowl" helmet (brim 1.75x head
//             radius), wound puttees over ankle boots, 1908 webbing (belt, chest pouches, braces),
//             a stuffed pack with the groundsheet rolled on top, e-tool and scabbard; SMLE.
//   rifle-de  Marinekorps navy #2E3A52, Stahlhelm with the brow visor and the flared neck skirt +
//             side lugs, black jackboots, leather Y-straps and pouches, ribbed gas-mask canister
//             and bread bag at the hip; Gew98.
//   squads    one pose per base slot: the NCO pointing the way, a standing aim, a kneeling aim and
//             a man advancing with his rifle at the port (an outside review: "minimal pose variety
//             beyond 'standing group' vs 'crouched'").
//   stoss     navy storm troops in puttees: grenade sacks on the chest, stick grenades in the belt,
//             the rolled Zeltbahn slung shoulder-to-hip, carbine on the back; throwing, rushing,
//             crouching.
//   mg        Vickers (FAT longitudinally fluted jacket, low tripod, condenser can + hose) / MG08
//             (fat plain jacket on the Schlitten sled); ammo box + brass belt; a gunner sitting at
//             the grips, a kneeling loader and a spotter with binoculars.
//   fieldgun  the old build's gun18pdr proportions: 1.4 m spoked wheels, one shield plate with
//             the barrel port and sight window, recuperator ABOVE the barrel, tapered box trail and
//             spade; two crew.
//   tank      the old build's mk4 rhomboid (0.10 m long): track frames with plates, sponsons
//             with 6-pdrs, cab, roof silencer, unditching beam on rails, service brown + mud.
//   figures   0.050 m to the helmet top; bases 0.082 m bevelled lathe with painted groundwork;
//             rims brass + roundel (BR) / iron + cross (DE), emblem front AND back.
// Bodies are smooth tubes and lathes (limbs bend as one sleeve), not the rod-and-ball joints and
// boxes an outside review called "blocky torsos ... simple/low-poly under any zoom"; the triangles
// that bought the smoothness came out of the old joint spheres and puttee tori.
import * as THREE from 'three'
import type { Side } from '../../contract/types.ts'
import { box, cyl, extrude, Geo, hex, lathe, sphere } from './geo.ts'
import type { RGB } from './geo.ts'

type V = [number, number, number]
const v3 = (p: V): THREE.Vector3 => new THREE.Vector3(...p)

export const BASE_R = 0.041
export const BASE_H = 0.0062
export const FIG_H = 0.05

interface Kit {
  tunic: RGB; tunicDark: RGB; trousers: RGB; shin: RGB; boot: RGB; flesh: RGB; helmet: RGB
  webbing: RGB; leather: RGB; wood: RGB; steel: RGB; bright: RGB
}
// Paint for the table, not the archive: the British are a deeper olive khaki with pale blancoed
// webbing (the old sand khaki vanished on the sand hexes — "tan on tan" to an outside review), the
// Germans a clearer blue-grey so they hold their own on the dark polder and rear fields.
const K: Record<Side, Kit> = {
  BR: {
    tunic: hex('#6f683f'), tunicDark: hex('#57512f'), trousers: hex('#655e39'), shin: hex('#5a5236'), boot: hex('#3a2618'),
    flesh: hex('#c98763'), helmet: hex('#4b5034'), webbing: hex('#c6bd8e'), leather: hex('#5a3a22'), wood: hex('#7a4a28'),
    steel: hex('#34363a'), bright: hex('#c9ccd0'),
  },
  DE: {
    tunic: hex('#3f4c6a'), tunicDark: hex('#2c3650'), trousers: hex('#323d55'), shin: hex('#141312'), boot: hex('#141312'),
    flesh: hex('#c4845f'), helmet: hex('#5b6066'), webbing: hex('#2a2422'), leather: hex('#1f1a17'), wood: hex('#6e4424'),
    steel: hex('#34363a'), bright: hex('#c9ccd0'),
  },
}

// ---------------------------------------------------------------------------------------------
// The figure rig: joint positions per pose; limbs are tubes through the joints.
export interface Pose {
  pelvis: V; chest: V; head: V
  lElbow: V; lHand: V; rElbow: V; rHand: V
  lKnee: V; lFoot: V; rKnee: V; rFoot: V
  rifle?: [V, V] // butt, muzzle
  extra?: 'binoculars' | 'shell' | 'grenade' | 'stick' | 'belt' | 'point'
  headTilt?: number // helmet pitch; by default it follows the neck
}

export const POSES: Record<string, Pose> = {
  // rifle squads, one per base slot (Pieces.layout)
  point: { // the NCO: left arm flung out toward the objective, rifle at the trail in the right hand;
    // the arm swings out to the side so it is not foreshortened to a fist from the chair
    pelvis: [0, 0.0225, 0], chest: [0, 0.0347, -0.0006], head: [-0.0008, 0.042, -0.0014],
    lElbow: [-0.0105, 0.0385, -0.006], lHand: [-0.015, 0.042, -0.013], rElbow: [0.0082, 0.0285, 0.001], rHand: [0.0088, 0.0212, -0.0012],
    lKnee: [-0.0034, 0.0122, -0.0035], lFoot: [-0.0038, 0.0014, -0.0055], rKnee: [0.0034, 0.012, 0.0018], rFoot: [0.004, 0.0014, 0.004],
    rifle: [[0.0086, 0.0232, 0.0125], [0.0092, 0.0188, -0.0225]], extra: 'point',
  },
  aim: { // standing aim: butt in the shoulder, cheek on the stock
    pelvis: [0, 0.0225, 0.0005], chest: [0, 0.0346, -0.0008], head: [0.0018, 0.0408, -0.0035], headTilt: 0.12,
    lElbow: [-0.0065, 0.0305, -0.01], lHand: [0.0026, 0.0357, -0.0161], rElbow: [0.0098, 0.032, -0.003], rHand: [0.0034, 0.0355, -0.0112],
    lKnee: [-0.0042, 0.012, -0.003], lFoot: [-0.0052, 0.0014, -0.0055], rKnee: [0.0042, 0.012, 0.003], rFoot: [0.0052, 0.0014, 0.0045],
    rifle: [[0.0042, 0.0352, -0.0042], [0, 0.0368, -0.0392]],
  },
  kneel: { // kneeling aim on the right knee, left elbow over the raised knee
    pelvis: [0, 0.0125, 0.003], chest: [0, 0.024, -0.003], head: [0.002, 0.03, -0.0065], headTilt: 0.12,
    lElbow: [-0.004, 0.0205, -0.011], lHand: [0.0031, 0.0255, -0.0173], rElbow: [0.0105, 0.0205, -0.0075], rHand: [0.0036, 0.0253, -0.0138],
    lKnee: [-0.0042, 0.0118, -0.0085], lFoot: [-0.0042, 0.0014, -0.0095], rKnee: [0.0042, 0.0024, 0.0035], rFoot: [0.0042, 0.0026, 0.0125],
    rifle: [[0.0044, 0.025, -0.0068], [0.0002, 0.0266, -0.0418]],
  },
  port: { // advancing, rifle at the port across the chest, muzzle up past the left shoulder
    pelvis: [0, 0.0222, 0.0005], chest: [0, 0.034, -0.0025], head: [0, 0.0413, -0.004],
    lElbow: [-0.0098, 0.031, -0.007], lHand: [-0.0039, 0.0385, -0.0095], rElbow: [0.0092, 0.0275, -0.001], rHand: [0.0027, 0.0263, -0.0077],
    lKnee: [-0.0032, 0.0122, -0.0058], lFoot: [-0.0034, 0.0014, -0.0082], rKnee: [0.0032, 0.0112, 0.003], rFoot: [0.0034, 0.0024, 0.0085],
    rifle: [[0.0058, 0.0205, -0.0068], [-0.0098, 0.0495, -0.0112]],
  },
  // crews (MG: the hands of `gunner` sit on the gun's spade grips, see buildMG)
  gunner: {
    pelvis: [0, 0.0052, 0.0045], chest: [0, 0.0168, -0.0005], head: [0, 0.0238, -0.0038], headTilt: 0.1,
    lElbow: [-0.0072, 0.0122, -0.0068], lHand: [-0.0026, 0.012, -0.0147], rElbow: [0.0072, 0.0122, -0.0068], rHand: [0.0026, 0.012, -0.0147],
    lKnee: [-0.008, 0.0095, -0.0065], lFoot: [-0.0095, 0.0016, -0.013], rKnee: [0.008, 0.0095, -0.0065], rFoot: [0.0095, 0.0016, -0.013],
  },
  loader: {
    pelvis: [0, 0.0115, 0.002], chest: [0, 0.0225, -0.0025], head: [0, 0.0298, -0.0048],
    lElbow: [-0.0066, 0.017, -0.006], lHand: [-0.0028, 0.0135, -0.012], rElbow: [0.0066, 0.017, -0.006], rHand: [0.0028, 0.0135, -0.012],
    lKnee: [-0.0042, 0.0105, -0.0078], lFoot: [-0.0042, 0.0014, -0.0085], rKnee: [0.0042, 0.0024, 0.0035], rFoot: [0.0042, 0.0024, 0.0118],
    extra: 'belt',
  },
  spotter: {
    pelvis: [0, 0.0125, 0.003], chest: [0, 0.0245, 0.0], head: [0, 0.032, -0.0015], headTilt: 0.05,
    lElbow: [-0.0082, 0.0225, -0.0045], lHand: [-0.0022, 0.0305, -0.0062], rElbow: [0.0082, 0.0225, -0.0045], rHand: [0.0022, 0.0305, -0.0062],
    lKnee: [-0.0042, 0.0115, -0.0085], lFoot: [-0.0042, 0.0014, -0.0095], rKnee: [0.0042, 0.0024, 0.0035], rFoot: [0.0042, 0.0024, 0.0125],
    extra: 'binoculars',
  },
  shell: {
    pelvis: [0, 0.0225, 0], chest: [0, 0.0345, -0.0008], head: [0, 0.0418, -0.0012],
    lElbow: [-0.0072, 0.0275, -0.002], lHand: [-0.0032, 0.0285, -0.0068], rElbow: [0.0072, 0.0275, -0.002], rHand: [0.0032, 0.0285, -0.0068],
    lKnee: [-0.0032, 0.012, -0.002], lFoot: [-0.0036, 0.0014, -0.003], rKnee: [0.0032, 0.012, 0.001], rFoot: [0.0036, 0.0014, 0.003],
    extra: 'shell',
  },
  // storm troops
  throw: { // lunging, stick grenade cocked behind the helmet, left arm out for the aim
    pelvis: [0, 0.0218, 0.0012], chest: [0, 0.0338, 0.0022], head: [-0.0004, 0.0412, 0], headTilt: 0.05,
    lElbow: [-0.0082, 0.033, -0.006], lHand: [-0.0075, 0.0372, -0.0125], rElbow: [0.0098, 0.0405, 0.0055], rHand: [0.0068, 0.0478, 0.0085],
    lKnee: [-0.0032, 0.012, -0.0058], lFoot: [-0.0034, 0.0014, -0.009], rKnee: [0.0034, 0.0118, 0.0028], rFoot: [0.0036, 0.0014, 0.0078],
    extra: 'grenade',
  },
  dash: { // bent double at a run, a stick grenade swinging in the right hand
    pelvis: [0, 0.02, 0.0015], chest: [0, 0.0305, -0.0055], head: [0, 0.0373, -0.0092], headTilt: 0.12,
    lElbow: [-0.008, 0.0262, -0.0092], lHand: [-0.0048, 0.0265, -0.0165], rElbow: [0.0086, 0.025, 0.001], rHand: [0.008, 0.019, 0.006],
    lKnee: [-0.0034, 0.0118, -0.0085], lFoot: [-0.0034, 0.0014, -0.0072], rKnee: [0.0034, 0.0092, 0.0045], rFoot: [0.0034, 0.003, 0.0118],
    extra: 'stick',
  },
  crouch: { // crouched rush, carbine held low at the hip
    pelvis: [0, 0.0185, 0.002], chest: [0, 0.0285, -0.0045], head: [0, 0.0352, -0.0075], headTilt: 0.12,
    lElbow: [-0.006, 0.0222, -0.0085], lHand: [0.0026, 0.0211, -0.0136], rElbow: [0.0088, 0.0225, 0], rHand: [0.0057, 0.0185, -0.0043],
    lKnee: [-0.0035, 0.0105, -0.0075], lFoot: [-0.0035, 0.0014, -0.0055], rKnee: [0.0035, 0.0085, 0.0035], rFoot: [0.0035, 0.0014, 0.0085],
    rifle: [[0.0075, 0.017, 0.001], [-0.0015, 0.0245, -0.0255]],
  },
}

// ---------------------------------------------------------------------------------------------
// Tubes: limbs, straps, hoses. One ring per point on the averaged tangent, carried by parallel
// transport (no twist) and mitred across each bend (the ring stretches by 1/cos of the half
// angle) so a bent knee or shoulder keeps its girth; round or flat caps. Indexed with smooth
// normals before Geo flattens it, so an arm shades as one sleeve.
type Cap = 'open' | 'flat' | 'round'
type Pt = V | THREE.Vector3
interface Ring { c: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; r: number; bend?: THREE.Vector3; k: number }

function tube(pts: Pt[], radii: number | number[], seg = 8, caps: [Cap, Cap] = ['open', 'open']): THREE.BufferGeometry {
  const P = pts.map((p) => (p instanceof THREE.Vector3 ? p.clone() : v3(p))), n = P.length
  if (n < 2) throw new Error('tube: needs at least two points')
  const T = P.map((_, i) => P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize())
  const N = new THREE.Vector3().crossVectors(T[0], Math.abs(T[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
  const rings: Ring[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0) N.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]))
    N.addScaledVector(T[i], -N.dot(T[i])).normalize()
    const ring: Ring = { c: P[i], t: T[i], n: N.clone(), r: typeof radii === 'number' ? radii : radii[i], k: 1 }
    if (i > 0 && i < n - 1) {
      const a = P[i].clone().sub(P[i - 1]).normalize(), b = P[i + 1].clone().sub(P[i]).normalize()
      const d = b.clone().sub(a)
      d.addScaledVector(T[i], -d.dot(T[i]))
      if (d.lengthSq() > 1e-12) { ring.bend = d.normalize(); ring.k = 1 / Math.max(0.62, Math.sqrt((1 + a.dot(b)) / 2)) }
    }
    rings.push(ring)
  }
  const pos: number[] = [], idx: number[] = []
  const put = (g: Ring): number => {
    const first = pos.length / 3, b = new THREE.Vector3().crossVectors(g.t, g.n), o = new THREE.Vector3()
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2
      o.copy(g.n).multiplyScalar(Math.cos(a) * g.r).addScaledVector(b, Math.sin(a) * g.r)
      if (g.bend) o.addScaledVector(g.bend, o.dot(g.bend) * (g.k - 1))
      pos.push(g.c.x + o.x, g.c.y + o.y, g.c.z + o.z)
    }
    return first
  }
  const strip = (a: number, b: number): void => {
    for (let j = 0; j < seg; j++) { const j1 = (j + 1) % seg; idx.push(a + j, a + j1, b + j, a + j1, b + j1, b + j) }
  }
  const apex = (p: THREE.Vector3): number => { pos.push(p.x, p.y, p.z); return pos.length / 3 - 1 }
  const fan = (r: number, tip: number, out: boolean): void => {
    for (let j = 0; j < seg; j++) { const j1 = (j + 1) % seg; if (out) idx.push(r + j, r + j1, tip); else idx.push(r + j1, r + j, tip) }
  }
  const g0 = rings[0], gn = rings[n - 1]
  let prev: number
  if (caps[0] === 'round') {
    const mid = put({ ...g0, c: g0.c.clone().addScaledVector(g0.t, -g0.r * 0.6), r: g0.r * 0.8, bend: undefined, k: 1 })
    fan(mid, apex(g0.c.clone().addScaledVector(g0.t, -g0.r * 0.95)), false)
    prev = put(g0)
    strip(mid, prev)
  } else {
    prev = put(g0)
    if (caps[0] === 'flat') { const tip = apex(g0.c); fan(put(g0), tip, false) }
  }
  for (let i = 1; i < n; i++) { const cur = put(rings[i]); strip(prev, cur); prev = cur }
  if (caps[1] === 'round') {
    const mid = put({ ...gn, c: gn.c.clone().addScaledVector(gn.t, gn.r * 0.6), r: gn.r * 0.8, bend: undefined, k: 1 })
    strip(prev, mid)
    fan(mid, apex(gn.c.clone().addScaledVector(gn.t, gn.r * 0.95)), true)
  } else if (caps[1] === 'flat') {
    const tip = apex(gn.c)
    fan(put(gn), tip, true)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// A box with its z-running edges chamfered (packs, bags, ammo boxes), centred on the origin: the
// octagon reads as stuffed canvas where a plain box read as a crate.
function slab(w: number, h: number, d: number, c = Math.min(w, h) * 0.22): THREE.BufferGeometry {
  const x = w / 2, y = h / 2
  return extrude([[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]], d)
}

// A flat strip (ammo belt, sling) from a to b: width across, thickness t.
function band(a: V, b: V, w: number, t: number): THREE.BufferGeometry {
  const A = v3(a), B = v3(b), len = A.distanceTo(B)
  return new THREE.BoxGeometry(t, len, w).translate(0, len / 2, 0)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())).translate(A.x, A.y, A.z)
}

// Boot side profile (z, y) about the ankle: heel, instep, toe cap; extruded across the foot.
const BOOT: [number, number][] = [[0.0022, -0.0026], [0.0024, -0.0008], [0.0012, 0.0004], [-0.001, 0.0004], [-0.0032, -0.0011], [-0.005, -0.0014], [-0.0055, -0.0021], [-0.0051, -0.0026]]
// the extrude's outline x becomes -z after the quarter turn, its depth becomes the foot's width
const bootGeo = (): THREE.BufferGeometry => extrude(BOOT.map(([z, y]) => [-z, y] as [number, number]), 0.0033).rotateY(Math.PI / 2)

const DEPTH = 0.74 // the tunic lathe's front-to-back flattening

function brodie(g: Geo, c: RGB, head: THREE.Vector3, tilt: number): void {
  // the flat "soup bowl": wide brim disc + shallow dome, brim 1.75x the head radius. The profile
  // runs underside -> brim -> crown: a lathe faces outward only when it climbs, and the old
  // crown-first order turned the dome inside out (from the chair it read as a dark bowl of hair).
  const m = new THREE.Matrix4().compose(head.clone().add(new THREE.Vector3(0, 0.0022, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)), new THREE.Vector3(1, 1, 1))
  g.add(lathe([[0.00001, 0], [0.0044, -0.0002], [0.0075, 0.0], [0.0074, 0.0006], [0.0046, 0.0009], [0.0041, 0.0028], [0.0026, 0.0044], [0.00001, 0.0048]], 16), c, { wear: 0.9, noise: 0.03 }, m)
}

function stahlhelm(g: Geo, c: RGB, head: THREE.Vector3, tilt: number): void {
  // coal-scuttle, built as a shell over (azimuth, row) rather than a deformed lathe: the old
  // lathe pulled its front skirt up into a flat sheet that read as a grey blade across the face.
  // Front: the dome stops at the brow and a short visor juts out; sides drop over the ears with
  // a flare; the back drops lowest and flares widest over the neck. Rows: dome x5, skirt edge,
  // lip, then back in under the shell so the underside is never see-through.
  const S = 18, R = 0.0051, rows = 8
  const pos: number[] = [], idx: number[] = []
  for (let j = 0; j < S; j++) {
    const th = (j / S) * Math.PI * 2, dx = Math.sin(th), dz = -Math.cos(th)
    const f = Math.max(0, Math.cos(th)), b = Math.max(0, -Math.cos(th))
    const phiE = THREE.MathUtils.degToRad(100 - 30 * f ** 1.5 + 2 * b)
    const ring: [number, number][] = []
    for (const t of [0.08, 0.32, 0.56, 0.8, 1]) ring.push([R * Math.sin(phiE * t), R * Math.cos(phiE * t)])
    const [er, ey] = ring[4]
    const fl = 0.0009 + 0.0006 * f + 0.0009 * b, dl = 0.0021 - 0.0019 * f + 0.0006 * b
    ring.push([er + fl, ey - dl], [er + fl - 0.0005, ey - dl + 0.0003], [er * 0.86, ey + 0.0004])
    for (const [r, y] of ring) pos.push(dx * r, y, dz * r)
  }
  const top = pos.length / 3
  pos.push(0, R, 0)
  for (let j = 0; j < S; j++) {
    const a = j * rows, b = ((j + 1) % S) * rows
    idx.push(top, b, a)
    for (let i = 0; i < rows - 1; i++) idx.push(a + i, b + i, a + i + 1, b + i, b + i + 1, a + i + 1)
  }
  const shell = new THREE.BufferGeometry()
  shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  shell.setIndex(idx)
  shell.computeVertexNormals()
  const m = new THREE.Matrix4().compose(head.clone().add(new THREE.Vector3(0, 0.0006, 0.0003)), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)), new THREE.Vector3(1, 1, 1.08))
  g.add(shell, c, { wear: 0.9, noise: 0.03 }, m)
  for (const s of [-1, 1]) g.add(cyl(0.0008, 0.0008, 0.0014, 6).rotateZ(Math.PI / 2).translate(s * 0.0046, 0.0026, 0), c, { wear: 1 }, m)
}

// Rifle along butt -> muzzle, 2x real thickness. The stock is ONE extruded side profile (butt,
// wrist, magazine for the SMLE, full-length fore-end), so the rifle has a rifle's outline instead
// of the old plank + pipe.
function rifle(g: Geo, k: Kit, butt: THREE.Vector3, muzzle: THREE.Vector3, bayonet: boolean, mag: boolean): void {
  const dir = muzzle.clone().sub(butt), L = dir.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize())
  const m = new THREE.Matrix4().compose(butt, q, new THREE.Vector3(1, 1, 1))
  // (distance from the butt, height); the extrude's x becomes -z after the quarter turn
  const under: [number, number][] = mag ? [[0.016, -0.0011], [0.0157, -0.0029], [0.0131, -0.0029], [0.0127, -0.0014]] : [[0.0135, -0.0013]]
  const prof: [number, number][] = [[0, 0.0006], [0.0095, 0.0001], [0.0125, 0.0005], [L * 0.8, 0.0004], [L * 0.82, -0.0003], [L * 0.8, -0.0011], ...under, [0.0093, -0.0015], [0, -0.0034]]
  g.add(extrude(prof, 0.0018).rotateY(Math.PI / 2), k.wood, { noise: 0.06, wear: 0.3 }, m)
  g.add(new THREE.CylinderGeometry(0.00058, 0.00058, L * 0.3, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0.0001, -L * 0.85), k.steel, { wear: 0.6 }, m)
  g.add(box(0.0014, 0.0008, 0.0008).translate(0.0012, 0.0002, -0.0122), k.steel, { wear: 0.8 }, m) // bolt handle
  if (bayonet) g.add(new THREE.ConeGeometry(0.0006, 0.011, 4).rotateX(-Math.PI / 2).translate(0, 0.0001, -L - 0.0055), k.bright, { wear: 1, noise: 0.02 }, m)
}

export function buildFigure(side: Side, pose: Pose, opts: { stoss?: boolean; noRifle?: boolean } = {}): Geo {
  const k = K[side], g = new Geo()
  const P = (p: V): THREE.Vector3 => v3(p)
  const pelvis = P(pose.pelvis), chest = P(pose.chest), head = P(pose.head)
  const up = chest.clone().sub(pelvis).normalize()
  const tilt = pose.headTilt ?? Math.atan2(-(head.z - chest.z), head.y - chest.y) * 0.8
  const tq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
  const one = new THREE.Vector3(1, 1, 1)
  // torso frame (x across, y up the spine, z to the back), unflattened, for kit that keeps its shape
  const at = (p: THREE.Vector3, r?: THREE.Euler): THREE.Matrix4 => new THREE.Matrix4().compose(p, r ? tq.clone().multiply(new THREE.Quaternion().setFromEuler(r)) : tq, one)
  const B = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).applyQuaternion(tq).add(pelvis)

  // --- tunic: one lathe up the spine (flared skirt, belted waist, chest, rounded shoulders,
  // stand collar), flattened front-to-back; the kit is placed on its surface
  const H = chest.distanceTo(pelvis) + 0.0045, YB = 0.007 // chest and belt heights on the lathe
  const prof: [number, number][] = [[0.0001, 0], [0.006, 0], [0.0064, 0.0007], [0.0059, 0.0032], [0.0053, 0.006], [0.0053, 0.008],
    [0.0056, H - 0.0055], [0.0062, H - 0.0022], [0.0063, H - 0.0004], [0.0053, H + 0.0012], [0.003, H + 0.0021], [0.0019, H + 0.0024], [0.0001, H + 0.0025]]
  const tm = new THREE.Matrix4().compose(pelvis.clone().addScaledVector(up, -0.0045), tq, new THREE.Vector3(1, 1, DEPTH))
  g.add(lathe(prof, 14), k.tunic, { wear: 0.35 }, tm)
  const rAt = (y: number): number => {
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-9, y1 - y0) }
    return 0
  }
  // a point `off` proud of the tunic at lathe height y, across-offset x, front (sz -1) or back (+1)
  const onBody = (x: number, y: number, sz: number, off = 0): THREE.Vector3 => {
    const r = rAt(y)
    return new THREE.Vector3(x, y, sz * (Math.sqrt(Math.max(0, r * r - x * x)) + off / DEPTH)).applyMatrix4(tm)
  }
  // the top of the shoulder slope at across-offset x (where a strap goes over)
  const overShoulder = (x: number): THREE.Vector3 => {
    let y = H
    for (let i = prof.length - 1; i > 0; i--) {
      const [r1, y1] = prof[i], [r0, y0] = prof[i - 1]
      if (r0 >= Math.abs(x) && r1 <= Math.abs(x)) { y = y0 + (y1 - y0) * (r0 - Math.abs(x)) / Math.max(1e-9, r0 - r1); break }
    }
    return new THREE.Vector3(x, y + 0.0004, 0).applyMatrix4(tm)
  }

  // --- legs: thigh and knee as one tube; puttees (wound, ridged) or jackboots below ---------
  const puttees = side === 'BR' || opts.stoss === true // storm troops ran in puttees and ankle boots
  for (const s of [-1, 1] as const) {
    const hipIn = B(s * 0.0025, 0.0015, 0), hip = pelvis.clone().add(new THREE.Vector3(s * 0.0031, -0.0014, 0))
    const knee = P(s < 0 ? pose.lKnee : pose.rKnee), foot = P(s < 0 ? pose.lFoot : pose.rFoot)
    const ankle = foot.clone().add(new THREE.Vector3(0, 0.0012, 0))
    const kneeLow = knee.clone().lerp(ankle, 0.14)
    g.add(tube([hipIn, hip, knee, kneeLow], [0.0032, 0.0035, 0.0029, 0.0027], 8), k.trousers, { wear: 0.3 })
    if (puttees) {
      const rr = [0.0028, 0.0025, 0.0026, 0.0023, 0.0024, 0.0021]
      g.add(tube(rr.map((_, i) => kneeLow.clone().lerp(ankle, i / (rr.length - 1))), rr, 7), opts.stoss ? hex('#4b4e46') : k.shin, { wear: 0.3 })
    } else {
      // jackboots: tall, flared at the top, glossy black
      g.add(tube([ankle, ankle.clone().lerp(knee, 0.5), knee.clone().lerp(ankle, 0.1)], [0.0023, 0.0026, 0.0031], 8, ['open', 'flat']), k.boot, { wear: 0.5, noise: 0.02 })
    }
    // the foot follows a shin that swings back: heel up on a stride, toes down when kneeling
    const d = ankle.clone().sub(kneeLow).normalize()
    const pitch = Math.min(1.35, Math.max(0, Math.atan2(d.z, -d.y) - 0.3))
    g.add(bootGeo(), puttees ? k.boot : k.boot, { wear: 0.6 }, new THREE.Matrix4().compose(ankle, new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, 0, 0)), one))
  }

  // --- belt, webbing, pouches ------------------------------------------------------------------
  g.add(new THREE.CylinderGeometry(rAt(YB) + 0.0003, rAt(YB) + 0.0003, 0.0015, 14, 1, true).translate(0, YB, 0), k.webbing, { wear: 0.4 }, tm)
  g.add(box(0.0017, 0.0015, 0.0006).translate(0, -0.00075, 0), side === 'BR' ? hex('#8a7a4a') : hex('#8d9196'), { wear: 0.9 }, at(onBody(0, YB, -1, 0.0004)))
  // a button placket from belt to collar (the chair sees the Germans from the front)
  for (let i = 0; i < 4; i++) {
    const p = onBody(0, YB + 0.0032 + (H - YB - 0.0026) * i / 3, -1, 0.0002)
    g.add(new THREE.OctahedronGeometry(0.00045, 0).translate(p.x, p.y, p.z), side === 'BR' ? hex('#b08a3a') : hex('#8d9196'), { wear: 0.9, noise: 0.02 })
  }
  const strap = (pts: THREE.Vector3[], c: RGB): void => { g.add(tube(pts, 0.00055, 4), c, { wear: 0.3 }) }
  if (side === 'BR') {
    // 1908 pattern: a five-pocket pouch block each side of the buckle, braces over the shoulders
    for (const s of [-1, 1]) {
      g.add(box(0.0032, 0.0036, 0.0018).translate(0, -0.0018, 0), k.webbing, { wear: 0.7 }, at(onBody(s * 0.003, YB + 0.0028, -1, 0.001)))
      strap([onBody(s * 0.0031, YB + 0.0044, -1, 0.0003), onBody(s * 0.0034, H - 0.0022, -1, 0.0004), overShoulder(s * 0.0036), onBody(s * 0.0031, H - 0.0024, 1, 0.0004)], k.webbing)
    }
  } else {
    // leather: three-pocket M1909 pouches on the belt, Y-straps meeting at the small of the back
    for (const s of [-1, 1]) {
      g.add(box(0.0044, 0.0026, 0.0019).translate(0, -0.0013, 0), k.leather, { wear: 0.7 }, at(onBody(s * 0.0033, YB + 0.0002, -1, 0.001)))
      strap([onBody(s * 0.0034, YB + 0.0016, -1, 0.0003), onBody(s * 0.0035, H - 0.0022, -1, 0.0004), overShoulder(s * 0.0036), onBody(s * 0.0028, H - 0.003, 1, 0.0004), onBody(s * 0.0006, YB + 0.003, 1, 0.0005)], k.leather)
    }
  }

  // --- kit on the back and hips --------------------------------------------------------------
  if (side === 'BR') {
    // stuffed pack high on the back with the mess tin on its flap (the chair sees the British
    // from behind, so this is their silhouette)
    const pk = onBody(0, H - 0.0056, 1, 0.0021)
    g.add(slab(0.0078, 0.0074, 0.004), k.webbing, { wear: 0.6, noise: 0.07 }, at(pk))
    g.add(box(0.0034, 0.0024, 0.0009).translate(0, -0.0006, 0.0022), hex('#77704f'), { wear: 0.8 }, at(pk))
    // e-tool head in its carrier at the small of the back; water bottle on the right hip; the
    // bayonet scabbard hanging down the left with the e-tool helve strapped to it (1908 pattern)
    g.add(box(0.0036, 0.004, 0.0012).translate(0, -0.002, 0), k.webbing, { wear: 0.6 }, at(onBody(0.0006, YB - 0.0016, 1, 0.0007)))
    g.add(cyl(0.0014, 0.0014, 0.0034, 7).translate(0, -0.0034, 0), hex('#6d6a4a'), { wear: 0.5 }, at(onBody(0.0047, YB - 0.0006, 1, 0.0014)))
    const hang = at(onBody(-0.0046, YB, 1, 0.0008), new THREE.Euler(0.3, 0, 0.12))
    g.add(box(0.001, 0.0092, 0.0013).translate(0, -0.0046, 0), k.leather, { wear: 0.6 }, hang)
    g.add(box(0.0011, 0.0068, 0.001).translate(0.0012, -0.0036, 0.0004), k.wood, { wear: 0.4 }, hang)
  } else if (!opts.stoss) {
    // ribbed gas-mask canister slung across the small of the back (it stuck out past the arms
    // at the shoulder blades, a hump from the chair)
    const can = new THREE.Matrix4().compose(onBody(-0.0008, YB + 0.0028, 1, 0.0022), tq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 - 0.25))), one)
    g.add(lathe([[0.0001, -0.0032], [0.0021, -0.0032], [0.0022, -0.0018], [0.0018, -0.0015], [0.0022, -0.0012], [0.0022, 0.0008], [0.0018, 0.0011], [0.0022, 0.0014], [0.0022, 0.003], [0.0001, 0.0032]], 10), hex('#6d7563'), { wear: 0.8 }, can)
  }
  if (side === 'DE') {
    // bread bag on the right hip, spade in its leather carrier on the left
    g.add(slab(0.0048, 0.0042, 0.0024), hex('#5d5a48'), { wear: 0.4 }, at(onBody(0.0042, YB - 0.0028, 1, 0.0013), new THREE.Euler(0, -0.5, 0)))
    g.add(box(0.0034, 0.0042, 0.001).translate(0, -0.0021, 0), k.leather, { wear: 0.7 }, at(onBody(-0.0044, YB - 0.0004, 1, 0.0006), new THREE.Euler(0, 0.6, 0)))
  }
  if (opts.stoss) {
    // grenade sacks on the chest from a neck strap, stick grenades pushed through the belt
    for (const s of [-1, 1]) {
      g.add(new THREE.SphereGeometry(1, 6, 4).scale(0.0028, 0.0034, 0.002), hex('#b3a582'), { noise: 0.1, wear: 0.2 }, at(onBody(s * 0.003, H - 0.0072, -1, 0.0019)))
      const hd = onBody(s * 0.0046, YB + 0.0022, -1, 0.0017), hl = onBody(s * 0.0052, YB - 0.0056, -1, 0.0013)
      const dir = hd.clone().sub(hl).normalize()
      g.add(tube([hl, hd], 0.00055, 4), k.wood)
      g.add(tube([hd, hd.clone().addScaledVector(dir, 0.0036)], 0.0017, 7, ['flat', 'flat']), hex('#4d5245'), { wear: 0.8 })
    }
    strap([onBody(-0.003, H - 0.0045, -1, 0.0003), overShoulder(-0.0022), onBody(0, H + 0.0006, 1, 0.0006), overShoulder(0.0022), onBody(0.003, H - 0.0045, -1, 0.0003)], hex('#8a7d5c'))
    // the Sturmgepäck: Zeltbahn rolled into a horseshoe from the left shoulder to the right hip,
    // hugging the tunic all round (points pushed out to the surface), the storm-troop outline
    const u = new THREE.Vector3(-0.55, 0.83, 0).normalize(), c0 = new THREE.Vector3(0, H - 0.003, 0), roll: THREE.Vector3[] = []
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * Math.PI * 2
      const p = c0.clone().addScaledVector(u, Math.cos(t) * 0.0095).add(new THREE.Vector3(0, 0, Math.sin(t) * 0.006))
      const q = Math.hypot(p.x, p.z), want = rAt(p.y) + 0.0015
      if (q < want) { p.x *= want / q; p.z *= want / q }
      roll.push(p.applyMatrix4(tm))
    }
    g.add(tube(roll, 0.0015, 6), hex('#5f5c48'), { noise: 0.08, wear: 0.2 })
    if (!pose.rifle) rifle(g, k, B(0.0048, -0.0005, 0.0064), B(-0.005, 0.0225, 0.0062), false, false) // carbine slung
  }

  // --- arms: one sleeve from inside the shoulder, round over the deltoid, to a cuff; a hand -----
  for (const s of [-1, 1] as const) {
    const sh = chest.clone().add(new THREE.Vector3(s * 0.0059, 0.0012, 0))
    const shIn = chest.clone().add(new THREE.Vector3(s * 0.003, 0.0016, 0))
    const el = P(s < 0 ? pose.lElbow : pose.rElbow), ha = P(s < 0 ? pose.lHand : pose.rHand)
    const wr = el.clone().lerp(ha, 0.8), dir = ha.clone().sub(el).normalize()
    g.add(tube([shIn, sh, el, wr], [0.0025, 0.0027, 0.0021, 0.0019], 8, ['open', 'flat']), k.tunic, { wear: 0.3 })
    g.add(tube([wr.clone().addScaledVector(dir, -0.0004), ha, ha.clone().addScaledVector(dir, 0.0006)], [0.0013, 0.0016, 0.0014], 6, ['open', 'round']), k.flesh, { noise: 0.03 })
  }

  // --- neck, head, face, helmet ----------------------------------------------------------------
  g.add(tube([chest.clone().add(new THREE.Vector3(0, 0.0016, 0)), head], [0.0018, 0.0017], 6), k.flesh)
  g.add(sphere(0.0041, 12, 8).translate(head.x, head.y, head.z), k.flesh, { noise: 0.03 })
  // cropped hair on the back and sides (from the commander's chair the British are seen from
  // behind: an all-flesh head read as a bald face)
  g.add(new THREE.SphereGeometry(0.00425, 10, 6, -0.25, Math.PI + 0.5, 0, Math.PI * 0.6).translate(head.x, head.y, head.z), side === 'BR' ? hex('#3b2616') : hex('#2b211a'), { noise: 0.06 })
  g.add(sphere(0.0009, 5, 3).translate(head.x, head.y - 0.0004, head.z - 0.0041), k.flesh) // nose
  for (const s of [-1, 1]) g.add(sphere(0.001, 5, 3).scale(0.5, 1, 0.8).translate(head.x + s * 0.0041, head.y - 0.0003, head.z + 0.0002), k.flesh, { noise: 0.03 }) // ears
  // painted eyes and brows (the dots a tin-soldier painter puts in with one bristle)
  for (const s of [-1, 1]) {
    g.add(sphere(0.00055, 4, 3).translate(head.x + s * 0.0015, head.y + 0.0006, head.z - 0.0036), hex('#1b1410'), { noise: 0 })
    g.add(box(0.0016, 0.0004, 0.0006).translate(head.x + s * 0.0015, head.y + 0.0012, head.z - 0.0036), hex('#3a2418'), { noise: 0 })
  }
  if (side === 'BR') g.add(box(0.0026, 0.0006, 0.0008).translate(head.x, head.y - 0.0013, head.z - 0.0039), hex('#4a2c1a'), { noise: 0 }) // moustache
  if (side === 'BR') brodie(g, k.helmet, head, tilt)
  else stahlhelm(g, k.helmet, head, tilt)

  // --- weapon / extra ------------------------------------------------------------------------
  if (pose.rifle && !opts.noRifle) rifle(g, k, P(pose.rifle[0]), P(pose.rifle[1]), !opts.stoss, side === 'BR')
  const stick = (from: THREE.Vector3, to: THREE.Vector3): void => {
    g.add(tube([from, to], 0.0006, 5), k.wood)
    g.add(tube([to, to.clone().addScaledVector(to.clone().sub(from).normalize(), 0.0042)], 0.0019, 8, ['flat', 'flat']), hex('#4d5245'), { wear: 0.8 })
  }
  switch (pose.extra) {
    case 'binoculars': {
      const c = P(pose.lHand).lerp(P(pose.rHand), 0.5).add(new THREE.Vector3(0, 0.0002, -0.0006))
      for (const s of [-1, 1]) g.add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.004, 7).rotateX(Math.PI / 2).translate(c.x + s * 0.0014, c.y, c.z), hex('#1e1c1a'), { wear: 0.8 })
      break
    }
    case 'shell': {
      const c = P(pose.lHand).lerp(P(pose.rHand), 0.5)
      g.add(new THREE.CylinderGeometry(0.0021, 0.0021, 0.0092, 8).rotateZ(Math.PI / 2).translate(c.x, c.y, c.z - 0.0008), hex('#c9a04e'), { wear: 0.9, noise: 0.03 })
      g.add(new THREE.ConeGeometry(0.0021, 0.0042, 8).rotateZ(-Math.PI / 2).translate(c.x + 0.0067, c.y, c.z - 0.0008), hex('#6a6e58'))
      break
    }
    case 'grenade': { // cocked behind the helmet: handle through the fist, head up and back
      const h = P(pose.rHand)
      stick(h.clone().add(new THREE.Vector3(0, -0.0035, -0.001)), h.clone().add(new THREE.Vector3(0, 0.005, 0.0028)))
      break
    }
    case 'stick': { // swinging low behind the runner
      const h = P(pose.rHand)
      stick(h.clone().add(new THREE.Vector3(0, 0.0025, -0.001)), h.clone().add(new THREE.Vector3(0, -0.0055, 0.003)))
      break
    }
    case 'point': { // the index finger out along the arm
      const h = P(pose.lHand), dir = h.clone().sub(P(pose.lElbow)).normalize()
      g.add(tube([h.clone().addScaledVector(dir, 0.0008), h.clone().addScaledVector(dir, 0.0034)], [0.0005, 0.00045], 4, ['open', 'round']), k.flesh)
      break
    }
    case 'belt': {
      const c = P(pose.lHand).lerp(P(pose.rHand), 0.5)
      g.add(box(0.0072, 0.0012, 0.0026).translate(c.x, c.y - 0.0008, c.z), hex('#b08a3a'), { wear: 0.7 })
      break
    }
    default: break
  }
  return g
}

// ---------------------------------------------------------------------------------------------
// Bases. The groundwork top (painted earth, flock tufts, pebbles) is enamel; the rim band and its
// emblems are separate so they can take brass (BR) / iron (DE).

export function buildBaseTop(side: Side, r = BASE_R, stretch = 1): Geo {
  const g = new Geo()
  // The groundwork is the side's colour as much as earth: warm khaki for the British, a cold
  // field-grey-blue for the Germans — two outside reviews could not tell the sides apart at a glance.
  const earth = side === 'BR' ? hex('#86744a') : hex('#4b5866')
  // bevelled lathe: foot, rounded shoulder, flat top (the rim band wraps the side)
  g.add(lathe([[0.0001, 0], [r, 0], [r, BASE_H - 0.0016], [r - 0.0008, BASE_H - 0.0004], [r - 0.002, BASE_H], [0.0001, BASE_H]], 32), earth, { noise: 0.08 }, new THREE.Matrix4().makeScale(1, 1, stretch))
  // flock tufts and pebbles on the groundwork (seeded by index)
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39996, rr = (0.25 + 0.72 * ((i * 0.618) % 1)) * (r - 0.006)
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr * stretch
    if (i % 3 === 0) g.add(new THREE.DodecahedronGeometry(0.0011 + (i % 5) * 0.00018, 0).translate(x, BASE_H + 0.0004, z), hex('#8c8472'), { noise: 0.1 })
    else g.add(new THREE.ConeGeometry(0.0016, 0.0022 + (i % 4) * 0.0004, 5).translate(x, BASE_H + 0.001, z), side === 'BR' ? hex('#6f7a3c') : hex('#5d6a44'), { noise: 0.12 })
  }
  return g
}

// The side's badge on the rim, front and back: a plaque built in the xy plane with its thickness
// toward +z (outward), then turned to face out of the base on each side.
export function emblem(side: Side, r = BASE_R, stretch = 1): Geo {
  const g = new Geo()
  const disc = (rad: number, z: number): THREE.BufferGeometry => new THREE.CylinderGeometry(rad, rad, 0.0005, 20).rotateX(Math.PI / 2).translate(0, 0, z)
  const cross = (w: number, l: number, z: number): THREE.BufferGeometry => {
    const pts: [number, number][] = []
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a)
      for (const [x, y] of [[w * 0.35, 0.0], [w, l], [-w, l], [-w * 0.35, 0]] as [number, number][]) pts.push([x * ca - y * sa, x * sa + y * ca])
    }
    return extrude(pts, 0.0005).translate(0, 0, z)
  }
  for (const zs of [-1, 1]) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(0, BASE_H * 0.5, zs * (r * stretch + 0.0009)),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), zs < 0 ? Math.PI : 0), new THREE.Vector3(1, 1, 1))
    if (side === 'BR') {
      // RFC roundel: blue ring, white ring, red centre, each standing proud of the last
      g.add(disc(0.0029, 0.00025), hex('#23407a'), { noise: 0.02, wear: 0.3 }, M)
      g.add(disc(0.00195, 0.00045), hex('#ece6d8'), { noise: 0.02 }, M)
      g.add(disc(0.00105, 0.00065), hex('#b02a20'), { noise: 0.02 }, M)
    } else {
      // iron cross: a white-edged black cross pattee
      g.add(cross(0.0019, 0.0031, 0.00025), hex('#ece6d8'), { noise: 0.02, wear: 0.3 }, M)
      g.add(cross(0.0013, 0.0025, 0.00055), hex('#141313'), { noise: 0.02 }, M)
    }
  }
  return g
}

// Rim band (single colour, the metal material supplies the look).
export function buildRim(r = BASE_R, stretch = 1): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[r + 0.0003, 0.0003], [r + 0.0011, 0.0009], [r + 0.0011, BASE_H - 0.0019], [r + 0.0003, BASE_H - 0.0011], [r - 0.0002, BASE_H - 0.0011], [r - 0.0002, 0.0003]], 36), '#ffffff', { noise: 0.04 }, new THREE.Matrix4().makeScale(1, 1, stretch))
  return g.build()
}

// ---------------------------------------------------------------------------------------------
// Machine guns. The read from the commander's chair is a FAT jacket on splayed legs: an outside
// review told rifle, MG and gun apart "mainly by base icon/colour", so the jacket is ~9 mm across
// once Pieces scales the gun x1.45, the Vickers stands on a low tripod with its condenser can and
// hose, the MG08 on its sled, and a brass belt runs from the ammo box. The bore axis and the
// spade grips (+z 0.0078) are shared: POSES.gunner's hands sit on them.

export function buildMG(side: Side): Geo {
  const g = new Geo()
  const steel = hex('#3b3d40'), dark = hex('#26272a'), brass = hex('#b08a3a'), grip = hex('#5a3a22')
  const y = 0.0076
  const along = (geo: THREE.BufferGeometry, z: number): THREE.BufferGeometry => geo.rotateX(-Math.PI / 2).translate(0, y, z) // lathe +y -> -z
  const collar = (z: number, r: number): void => { g.add(new THREE.CylinderGeometry(r, r, 0.0016, 14).rotateX(Math.PI / 2).translate(0, y, z), dark, { wear: 0.9 }) }
  // receiver, top cover, feed block on the right, spade grips
  g.add(box(0.0068, 0.0068, 0.0102).translate(0, y - 0.0034, 0.001), steel, { wear: 0.9 })
  g.add(box(0.007, 0.0008, 0.0104).translate(0, y + 0.0032, 0.001), dark, { wear: 0.9 })
  g.add(box(0.0026, 0.0028, 0.0032).translate(0.0046, y - 0.0018, -0.0008), dark, { wear: 0.8 })
  for (const s of [-1, 1]) g.add(tube([[s * 0.002, y - 0.0012, 0.0068], [s * 0.002, y + 0.0004, 0.0078], [s * 0.002, y + 0.0024, 0.008]], 0.0007, 5, ['round', 'round']), grip, { wear: 0.5 })
  g.add(box(0.0036, 0.0007, 0.0007).translate(0, y + 0.0005, 0.0074), dark)
  // ammo box on the ground to the right (the loader's side) and the brass belt up into the feed
  g.add(slab(0.0048, 0.0044, 0.0072, 0.0007).translate(0.01, 0.0022, 0.0016), side === 'BR' ? hex('#55603c') : hex('#4a4f44'), { wear: 0.6 })
  g.add(band([0.0092, 0.0044, 0.0012], [0.0058, y - 0.0012, -0.0008], 0.0026, 0.0007), brass, { wear: 0.5 })
  if (side === 'BR') {
    // Vickers: the longitudinally fluted jacket (alternate columns pushed in and out, flat-shaded:
    // smooth normals averaged every rib away and it read as a plain pipe)
    const jl = 0.0225
    const jacket = new THREE.CylinderGeometry(0.0043, 0.0043, jl, 20, 1, true)
    const jp = jacket.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < jp.count; i++) { const f = (i % 21) % 2 ? 0.92 : 1.05; jp.setX(i, jp.getX(i) * f); jp.setZ(i, jp.getZ(i) * f) }
    g.add(jacket.rotateX(Math.PI / 2).translate(0, y, -0.004 - jl / 2), steel, { wear: 0.7, flat: true })
    collar(-0.0042, 0.0048); collar(-0.004 - jl, 0.0048)
    g.add(along(lathe([[0.0001, 0], [0.0027, 0], [0.0027, 0.001], [0.0016, 0.0046], [0.0011, 0.005], [0.0001, 0.005]], 12), -0.0048 - jl), dark, { wear: 0.6 }) // muzzle cone
    // low tripod: crosshead, two splayed front legs, the long rear leg between the gunner's knees
    g.add(cyl(0.0021, 0.0025, 0.0022, 10).translate(0, y - 0.0056, 0.0012), dark, { wear: 0.8 })
    for (const [fx, fz] of [[-0.0112, -0.0092], [0.0112, -0.0092], [0, 0.0178]] as [number, number][]) {
      g.add(tube([[0, y - 0.0048, 0.0012], [fx, 0.0005, fz]], [0.0009, 0.0007], 6), dark, { wear: 0.7 })
      g.add(box(0.0024, 0.0005, 0.0024).translate(fx, 0, fz), dark, { wear: 0.8 })
    }
    // condenser can on the ground and the hose from under the jacket's muzzle end
    g.add(cyl(0.0022, 0.0024, 0.0058, 10).translate(-0.0118, 0, -0.012), hex('#4f5a3a'), { wear: 0.7 })
    g.add(tube([[0, y - 0.004, -0.0205], [-0.003, 0.003, -0.0195], [-0.0085, 0.0062, -0.015], [-0.0112, 0.006, -0.0126]], 0.0007, 6), hex('#2a2622'), { wear: 0.2 })
  } else {
    // MG08: a fat plain jacket with a filler cap and the long muzzle booster
    const jl = 0.0205
    g.add(new THREE.CylinderGeometry(0.0042, 0.0042, jl, 16, 1, true).rotateX(Math.PI / 2).translate(0, y, -0.004 - jl / 2), steel, { wear: 0.7 })
    collar(-0.0042, 0.0046); collar(-0.004 - jl, 0.0046)
    g.add(cyl(0.0012, 0.0012, 0.0014, 8).translate(0, y + 0.0038, -0.008), dark, { wear: 0.9 })
    g.add(along(lathe([[0.0001, 0], [0.0021, 0], [0.0021, 0.0032], [0.0015, 0.004], [0.0015, 0.0058], [0.0001, 0.0058]], 12), -0.0048 - jl), dark, { wear: 0.6 })
    // the Schlitten: two runners curled up at the front, crossbars, four legs up to the cradle
    for (const s of [-1, 1]) {
      g.add(tube([[s * 0.0078, 0.0009, 0.0205], [s * 0.0078, 0.0009, -0.008], [s * 0.0078, 0.0024, -0.0128], [s * 0.0074, 0.0046, -0.014]], 0.0009, 6, ['round', 'round']), dark, { wear: 0.8 })
      g.add(tube([[s * 0.0078, 0.0012, -0.006], [s * 0.0024, y - 0.0046, -0.0012]], 0.0008, 5), dark, { wear: 0.6 })
      g.add(tube([[s * 0.0078, 0.0012, 0.011], [s * 0.0024, y - 0.0046, 0.004]], 0.0008, 5), dark, { wear: 0.6 })
    }
    for (const z of [-0.0075, 0.019]) g.add(box(0.016, 0.001, 0.0014).translate(0, 0.0006, z), dark, { wear: 0.8 })
    g.add(box(0.0056, 0.0016, 0.009).translate(0, y - 0.005, 0.0012), dark, { wear: 0.8 }) // cradle
  }
  return g
}

// Field gun, the old build's gun18pdr proportions: its spec is in 0.25 m lattice units
// (5.1 m trail to muzzle, wheels r 0.70); scale 0.0147 m/m, then exaggerated where it identifies.
export function buildFieldGun(side: Side): Geo {
  const g = new Geo()
  const s = 0.0147
  const paint = side === 'BR' ? hex('#4d5540') : hex('#5d625c'), dark = hex('#2c2e2a'), wood = hex('#7a5230')
  const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, wear = 0.7): void => {
    g.at(box((x1 - x0) * s, (y1 - y0) * s, (z1 - z0) * s), c, [((x0 + x1) / 2) * s, y0 * s, -((z0 + z1) / 2) * s], [0, 0, 0], { wear })
  }
  const S = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [x * s, y * s])
  // shield: one plate, cropped top corners, with the barrel port and the sight window cut through
  // (was two stacked boxes), leaning back a little
  const port: [number, number][] = []
  for (let i = 0; i < 10; i++) port.push([Math.cos(i / 10 * Math.PI * 2) * 0.3, 1.02 + Math.sin(i / 10 * Math.PI * 2) * 0.3])
  const shield = extrude(S([[-0.82, 0.52], [0.82, 0.52], [0.82, 1.62], [0.6, 1.86], [-0.6, 1.86], [-0.82, 1.62]]), 0.09 * s,
    [S(port), S([[-0.66, 1.26], [-0.44, 1.26], [-0.44, 1.46], [-0.66, 1.46]])])
  g.add(shield.rotateX(0.1).translate(0, 0, -0.35 * s), paint, { wear: 0.8 })
  B(-0.55, 0.25, 0.25, 0.55, 0.55, 0.45, paint) // apron
  B(-0.3, 0.85, 0.0, 0.3, 1.3, 0.5, dark) // breech ring
  // barrel: a lathe with the muzzle swell and a dark bore (was a plain cylinder)
  const r = 1.3 * s
  g.add(lathe([[0.0001, 0], [0.3 * r, 0], [0.3 * r, 0.3 * s], [0.25 * r, 0.42 * s], [0.23 * r, 1.9 * s], [0.27 * r, 1.98 * s], [0.27 * r, 2.1 * s], [0.13 * r, 2.1 * s], [0.13 * r, 2.02 * s], [0.0001, 2.02 * s]], 12)
    .rotateX(-Math.PI / 2).translate(0, 1.02 * s, -0.5 * s), dark, { wear: 0.8 })
  g.add(new THREE.CylinderGeometry(0.2 * r, 0.2 * r, 1.25 * s, 10).rotateX(Math.PI / 2).translate(0, 1.33 * s, -1.08 * s), paint, { wear: 0.8 }) // recuperator ABOVE
  B(-0.2, 0.72, 0.4, 0.2, 0.86, 1.75, dark) // cradle under the barrel
  // box trail tapering from the axle down to the spade (side profile; the extrude's x becomes -z)
  g.add(extrude(S([[0.25, 0.58], [0.25, 0.95], [-0.4, 0.9], [-2.38, 0.48], [-2.55, 0.42], [-2.55, 0.16], [-2.38, 0.14], [-0.4, 0.55]]), 0.46 * s).rotateY(Math.PI / 2), paint, { wear: 0.7 })
  B(-0.4, 0.0, -2.55, 0.4, 0.5, -2.25, dark) // spade
  B(-0.2, 0.45, -2.62, 0.2, 0.65, -2.1, wood) // handspike, through the trail eye (the trail now tapers down to it)
  B(0.3, 0.0, -1.85, 0.8, 0.47, -1.1, wood) // ammunition box, on the ground
  B(-0.68, 1.28, 0.02, -0.43, 1.78, 0.27, dark) // dial sight
  // wheels: rim + 12 spokes + hub, exaggerated 1.15
  for (const sx of [-1, 1]) {
    const wr = 0.7 * s * 1.15, cx = sx * 0.9 * s, cy = wr
    const wm = new THREE.Matrix4().makeTranslation(cx, cy, 0)
    g.add(new THREE.TorusGeometry(wr - 0.0009, 0.0011, 5, 22).rotateY(Math.PI / 2), wood, { wear: 0.5 }, wm)
    g.add(new THREE.TorusGeometry(wr - 0.0002, 0.0005, 4, 22).rotateY(Math.PI / 2), dark, { wear: 1 }, wm) // iron tyre
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6
      g.add(tube([[0, 0, 0], [0, Math.sin(a) * (wr - 0.001), Math.cos(a) * (wr - 0.001)]], [0.00045, 0.00035], 4), wood, {}, wm)
    }
    g.add(new THREE.CylinderGeometry(0.0018, 0.0018, 0.004, 8).rotateZ(Math.PI / 2), dark, { wear: 0.8 }, wm)
  }
  g.add(new THREE.CylinderGeometry(0.0008, 0.0008, 1.8 * s, 6).rotateZ(Math.PI / 2).translate(0, 0.7 * s * 1.15, 0), dark) // axle
  return g
}

// Mark IV male, the old build's mk4 rhomboid (lattice units, 8.06 long), scaled to 0.10 m.
export function buildTank(): Geo {
  const g = new Geo()
  const s = 0.1 / 8.06
  const brown = hex('#5b4b33'), deck = hex('#8a7650'), mud = hex('#3f3224'), steel = hex('#3a3a36'), timber = hex('#6e4a2a'), soot = hex('#1d1b19'), ensign = hex('#b03a2e')
  const rh: [number, number][] = [[-4.03, 0.3], [-3.1, 1.55], [-1.2, 2.34], [1.6, 2.49], [3.35, 2.1], [4.03, 1.05], [4.03, 0.28], [2.4, 0.0], [-2.4, 0.0]]
  // model x (length) -> world -z (forward); frames at |z| 1.04..1.56 -> world x
  const toW = new THREE.Matrix4().makeRotationY(Math.PI / 2) // model +x -> world -z
  const frame = (z0: number, z1: number): void => {
    const geo = extrude(rh.map(([x, y]) => [x * s, y * s]), (z1 - z0) * s * 1.1, [], 0.0006)
    geo.translate(0, 0, ((z0 + z1) / 2) * s)
    g.add(geo, brown, { wear: 0.8 }, toW)
  }
  frame(1.04, 1.56); frame(-1.56, -1.04)
  // track plates around each frame outline (the rhomboid reads as a track)
  const per: [number, number][] = []
  for (let i = 0; i < rh.length; i++) {
    const a = rh[i], b = rh[(i + 1) % rh.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 0.42))
    for (let k = 0; k < n; k++) per.push([a[0] + (b[0] - a[0]) * (k + 0.5) / n, a[1] + (b[1] - a[1]) * (k + 0.5) / n])
  }
  for (const zc of [1.3, -1.3]) for (let i = 0; i < per.length; i++) {
    const [x, y] = per[i], nx = per[(i + 1) % per.length][0] - per[(i + per.length - 1) % per.length][0], ny = per[(i + 1) % per.length][1] - per[(i + per.length - 1) % per.length][1]
    const ang = Math.atan2(ny, nx)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x * s, y * s, zc * s), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(1, 1, 1))
    g.add(box(0.3 * s, 0.14 * s, 0.62 * s).translate(0, -0.07 * s, 0), y < 1.2 ? mud : steel, { wear: 0.9 }, new THREE.Matrix4().multiplyMatrices(toW, m))
  }
  const Bm = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, wear = 0.7): void => {
    g.add(box((x1 - x0) * s, (y1 - y0) * s, (z1 - z0) * s).translate(((x0 + x1) / 2) * s, y0 * s, ((z0 + z1) / 2) * s), c, { wear }, toW)
  }
  // The hull deck rides level with the track tops, a lighter khaki than the tracks: from the
  // commander's chair, behind and above, the old low hull between two high tracks (with rails
  // and a mid-length beam across them) read "as a ladder or hatch" to an outside review.
  Bm(-3.6, 0.55, -1.04, 3.9, 2.46, 1.04, deck) // hull
  Bm(2.0, 2.46, -0.72, 3.6, 3.1, 0.82, deck) // cab
  Bm(2.62, 2.62, -0.76, 3.58, 2.78, -0.7, soot) // vision slit
  Bm(-3.75, 2.62, -1.6, -3.15, 3.0, 1.6, timber, 0.4) // unditching beam, carried at the tail
  for (const z of [-1.56, 1.04]) Bm(3.62, 1.2, z, 4.0, 1.75, z + 0.52, ensign, 0.3) // red-white horns
  for (const z of [-1.9, 1.3]) { Bm(-0.2, 0.85, z, 1.7, 1.9, z + 0.6, brown); Bm(-0.2, 1.55, z, 1.7, 1.66, z + 0.6, steel) } // sponsons
  for (const z of [-1.62, 1.62]) g.add(new THREE.CylinderGeometry(0.2 * s, 0.22 * s, 2.3 * s, 8).rotateZ(Math.PI / 2).translate(1.5 * s, 1.2 * s, z * s * 1.06), steel, { wear: 0.8 }, toW) // 6-pdrs
  g.add(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 2.6 * s, 8).rotateZ(Math.PI / 2).translate(-0.6 * s, 2.66 * s, 0), soot, { wear: 0.5 }, toW) // roof silencer
  Bm(3.58, 2.12, -0.3, 3.76, 2.38, 0.3, soot) // hull MG port
  return g
}

// Tank strength pips: brass studs on the base's rear edge (4 = full)
export function pipGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(new THREE.SphereGeometry(0.0022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { noise: 0.03 })
  return g.build()
}

export function contactShadowTexture(): THREE.Texture {
  const N = 64, data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2)
    const a = Math.max(0, 1 - r) ** 1.6
    const o = (y * N + x) * 4
    data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = a * 255
  }
  const t = new THREE.DataTexture(data, N, N)
  t.needsUpdate = true
  return t
}
