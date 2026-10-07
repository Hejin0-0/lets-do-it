// The war-table's margin tokens (DESIGN §9 "Table", Worker-B list): morale candles on brass
// chambersticks, the 8-ring turn candle, 18-pdr rounds (one per shell), wax order pips, the
// brass hand bell, the wind vane, the rule-card easel, the inkpot and the quill. Each builder
// returns one vertex-painted Geo in metres, standing on y = 0 (the tabletop), in the batch whose
// material it is meant for: BRASS (mat brass), WAX (candle wax) or PAINT (worn enamel).
import * as THREE from 'three'
import { box, cyl, extrude, Geo, hex, lathe, rod, sphere } from './geo.ts'

export const CANDLE = { r: 0.0068, h: 0.074, seat: 0.0118, wick: 0.0045 } // seat = socket top
export const TURN = { r: 0.0165, seg: 0.0112, plate: 0.0062 }
export const CASING_H = 0.042

const WHITE = hex('#ffffff'), WICK = hex('#141110'), CHAR = hex('#050404')

// -------------------------------------------------------------------------------- WAX
// A dinner candle, burnt a little: tapered shaft, a melted cup at the top, runs of wax down the
// side, a black wick. Origin at its foot (it stands in a socket CANDLE.seat high).
export function candleGeo(): THREE.BufferGeometry {
  const { r, h, wick } = CANDLE
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [r, 0], [r * 0.97, h * 0.6], [r * 0.93, h - 0.002], [r * 0.99, h - 0.0005], [r * 0.7, h], [r * 0.45, h - 0.0016], [0.0001, h - 0.0018]], 12), WHITE, { noise: 0.03 })
  // wax runs: elongated beads over the lip, thinning downward
  for (const [a, len] of [[0.4, 0.019], [2.3, 0.011], [4.1, 0.027], [5.2, 0.008]] as [number, number][]) {
    const x = Math.cos(a) * r * 0.96, z = Math.sin(a) * r * 0.96
    g.add(rod([x, h - 0.0008, z], [x * 1.02, h - len, z * 1.02], 0.0011, 0.0006, 6), WHITE, { noise: 0.03 })
    g.add(sphere(0.0011, 6, 4).translate(x * 1.02, h - len, z * 1.02), WHITE, { noise: 0.03 })
  }
  g.add(rod([0, h - 0.0018, 0], [0.0004, h + wick * 0.7, 0], 0.00045, 0.00035, 5), WICK)
  g.add(sphere(0.0006, 5, 4).translate(0.0006, h + wick * 0.75, 0), CHAR)
  return g.build(0.1, h)
}

// One ring of the turn candle: a pillar slice with a scored, red-painted ring at its foot and
// its Roman round numeral scored in the side (the numeral faces the players, +z).
export function turnSegGeo(): THREE.BufferGeometry {
  const { r, seg } = TURN
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [r * 0.985, 0], [r, 0.0012], [r, seg], [0.0001, seg]], 18), WHITE, { noise: 0.025 })
  g.add(cyl(r + 0.0004, r + 0.0004, 0.0011, 18).translate(0, 0.0003, 0), hex('#9a2a1f'), { noise: 0.04 })
  return g.build()
}

// The candle's burning top: a dished melt pool, wax spilled over the rim, and the wick.
export function turnCapGeo(): THREE.BufferGeometry {
  const { r } = TURN
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [r * 1.01, 0], [r * 1.01, 0.0015], [r * 0.95, 0.0022], [r * 0.7, 0.0008], [0.0001, 0.0006]], 18), WHITE, { noise: 0.03 })
  for (const [a, len] of [[0.7, 0.012], [2.9, 0.007], [4.6, 0.018]] as [number, number][]) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    g.add(rod([x, 0.0016, z], [x * 1.03, -len, z * 1.03], 0.0017, 0.0009, 6), WHITE, { noise: 0.03 })
  }
  g.add(rod([0, 0.0006, 0], [0.0005, 0.0068, 0], 0.0006, 0.0004, 5), WICK)
  g.add(sphere(0.0008, 5, 4).translate(0.0006, 0.0068, 0), CHAR)
  return g.build()
}

// ------------------------------------------------------------------------------- BRASS
// Chamberstick: a dished saucer with a beaded rim, a socket with a drip-pan lip, a finger ring.
export function chamberstickGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [0.019, 0], [0.0215, 0.0012], [0.0222, 0.0034], [0.0206, 0.004], [0.019, 0.0024], [0.0105, 0.0019], [0.0086, 0.0028], [0.0078, 0.009], [0.0104, 0.0102], [0.0107, 0.0112], [0.0072, 0.0114], [0.0072, CANDLE.seat], [0.0001, CANDLE.seat]], 20), WHITE)
  g.add(new THREE.TorusGeometry(0.0021, 0.0007, 4, 10).rotateX(Math.PI / 2).translate(0.0228, 0.0033, 0), WHITE) // bead
  g.add(new THREE.TorusGeometry(0.0062, 0.0012, 5, 14).translate(0.026, 0.0045, 0), WHITE) // finger ring, upright
  return g.build()
}

// Pricket plate for the turn candle: a stepped round plate on three ball feet.
export function turnHolderGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[0.0001, 0.0022], [0.028, 0.0022], [0.03, 0.0034], [0.0296, 0.0052], [0.0272, 0.0056], [0.0265, 0.0044], [0.0185, 0.0045], [0.0182, TURN.plate], [0.0001, TURN.plate]], 32), WHITE)
  for (let i = 0; i < 3; i++) { const a = i * 2.0944 + 0.5; g.add(sphere(0.0028, 8, 6).translate(Math.cos(a) * 0.022, 0.0022, Math.sin(a) * 0.022), WHITE) }
  return g.build()
}

// An 18-pdr cartridge case: rimmed base, straight body, shoulder, neck (the shell sits in it).
export function casingGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [0.0086, 0], [0.0086, 0.0016], [0.0077, 0.0019], [0.0075, 0.03], [0.0062, 0.0345], [0.006, CASING_H], [0.0052, CASING_H], [0.0001, CASING_H - 0.002]], 20), WHITE)
  g.add(new THREE.TorusGeometry(0.0077, 0.00035, 4, 20).rotateX(Math.PI / 2).translate(0, 0.012, 0), WHITE) // crimp line
  return g.build()
}

// Brass hand bell: flared lip, waist, shoulder, crown; the wooden handle is in the paint batch.
export function bellGeo(): THREE.BufferGeometry {
  const g = new Geo()
  const outer: [number, number][] = [[0.0292, 0.0006], [0.0302, 0.0022], [0.0268, 0.006], [0.0214, 0.0145], [0.0188, 0.026], [0.0182, 0.034], [0.0156, 0.0405], [0.0096, 0.0445], [0.0048, 0.0462], [0.0001, 0.0465]]
  const inner: [number, number][] = [[0.0001, 0.041], [0.015, 0.035], [0.0164, 0.026], [0.0192, 0.0145], [0.0246, 0.0055], [0.0276, 0.0006]]
  // counter-clockwise profile (up the outside, down the inside, closed at the lip): lathe normals face out
  g.add(lathe([...outer, ...inner, outer[0]], 36), WHITE)
  g.add(cyl(0.0042, 0.0052, 0.004, 14).translate(0, 0.0455, 0), WHITE) // crown boss
  g.add(new THREE.TorusGeometry(0.0268, 0.0011, 5, 36).rotateX(Math.PI / 2).translate(0, 0.0072, 0), WHITE) // sound bow bead
  g.add(sphere(0.0048, 10, 8).translate(0, 0.012, 0), WHITE) // clapper, just visible under the lip
  return g.build()
}

// Wind vane: a round foot, a post and the compass cross; the arrow is its own instance.
export function vaneBaseGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[0.0001, 0], [0.018, 0], [0.019, 0.0018], [0.0165, 0.0034], [0.004, 0.0048], [0.0026, 0.007], [0.0022, 0.05], [0.0001, 0.05]], 24), WHITE)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2
    g.add(rod([0, 0.036, 0], [Math.sin(a) * 0.017, 0.036, -Math.cos(a) * 0.017], 0.0007, 0.0007, 5), WHITE)
    g.add(sphere(0.0015, 6, 4).translate(Math.sin(a) * 0.018, 0.036, -Math.cos(a) * 0.018), WHITE)
  }
  // "N" plate on the north arm
  g.add(box(0.005, 0.006, 0.0006).translate(0, 0.0385, -0.0196), WHITE)
  return g.build()
}

// The arrow, pointing -z (north) at yaw 0: a barbed head, a shaft and a split fletching tail.
export function vaneArrowGeo(): THREE.BufferGeometry {
  const g = new Geo()
  const head: [number, number][] = [[0, -0.024], [0.0055, -0.0165], [0.0018, -0.017], [0.0018, 0.012], [0.0068, 0.0205], [0.0068, 0.026], [0, 0.0195], [-0.0068, 0.026], [-0.0068, 0.0205], [-0.0018, 0.012], [-0.0018, -0.017], [-0.0055, -0.0165]]
  // outline in (x, z) -> extrude along y (thin plate standing on edge would vanish from above;
  // the vane is a horizontal plate so the players read its heading from the commander's chair)
  g.add(extrude(head.map(([x, z]) => [x, -z]), 0.0012).rotateX(-Math.PI / 2).translate(0, 0.053, 0), WHITE)
  g.add(sphere(0.0028, 8, 6).translate(0, 0.053, 0), WHITE)
  return g.build()
}

// A light brass easel for the rule card: two splayed front legs, a back prop and a ledge.
export function easelGeo(tilt: number, w: number): THREE.BufferGeometry {
  const g = new Geo()
  const h = 0.11, top: [number, number, number] = [0, Math.cos(tilt) * h, -Math.sin(tilt) * h]
  for (const s of [-1, 1]) g.add(rod([s * w * 0.42, 0, 0.004], [s * w * 0.3, top[1], top[2] + 0.004], 0.0011, 0.0009, 6), WHITE)
  g.add(rod([0, top[1] * 0.8, top[2] * 0.8], [0, 0, -0.07], 0.0011, 0.0011, 6), WHITE)
  g.add(box(w * 0.96, 0.0016, 0.007).translate(0, 0.006, 0.0045), WHITE) // ledge
  g.add(box(w * 0.96, 0.0045, 0.0012).translate(0, 0.0068, 0.0081), WHITE) // lip
  return g.build()
}

// -------------------------------------------------------------------------------- PAINT
// The projectile an 18-pdr casing carries: olive-drab HE shell, copper driving band, brass fuze.
export function shellHeadGeo(): THREE.BufferGeometry {
  const g = new Geo()
  const y0 = CASING_H - 0.004
  g.add(lathe([[0.0001, y0], [0.0059, y0], [0.0059, y0 + 0.012], [0.0052, y0 + 0.018], [0.0036, y0 + 0.0222], [0.0026, y0 + 0.0232], [0.0001, y0 + 0.0232]], 18), hex('#5a5f3c'), { noise: 0.04, wear: 0.4 })
  g.add(cyl(0.0063, 0.0063, 0.0022, 18).translate(0, y0 + 0.0028, 0), hex('#b0653a'), { wear: 0.6 })
  g.add(lathe([[0.0001, y0 + 0.0222], [0.0027, y0 + 0.0222], [0.0022, y0 + 0.0262], [0.0009, y0 + 0.0282], [0.0001, y0 + 0.0284]], 14), hex('#b8913f'), { wear: 0.9 })
  g.add(box(0.0058, 0.0012, 0.0008).translate(0, y0 + 0.0075, 0.0058), hex('#e6d9b8'), { noise: 0.02 }) // stencil band
  return g.build()
}

// An order pip: a sealing-wax disc stamped with a crowned "O" (orders), squeezed out unevenly.
// Face-down (spent) it shows the plain, flatter back.
export function pipGeo(): THREE.BufferGeometry {
  const g = new Geo()
  const wax = hex('#8e1d15'), lip = hex('#a4291e')
  const blob = new THREE.LatheGeometry([[0.0001, 0], [0.0118, 0], [0.013, 0.0014], [0.0124, 0.0032], [0.0108, 0.0042], [0.0001, 0.0044]].map(([r, y]) => new THREE.Vector2(r, y)), 24)
  const p = blob.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.09 * Math.sin(a * 5 + 2) + 0.05 * Math.sin(a * 9)
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k)
  }
  g.add(blob, wax, { noise: 0.05 })
  g.add(new THREE.TorusGeometry(0.0062, 0.0011, 6, 22).rotateX(Math.PI / 2).translate(0, 0.0045, 0), lip, { noise: 0.03 })
  // crown: three points over the ring
  for (const x of [-0.0035, 0, 0.0035]) g.add(new THREE.ConeGeometry(0.0011, 0.0035, 4).rotateX(-Math.PI / 2).translate(x, 0.0048, -0.0072 - (x === 0 ? 0.0012 : 0)), lip, { noise: 0.03 })
  g.add(box(0.0092, 0.0012, 0.0016).translate(0, 0.0042, -0.0072), lip, { noise: 0.03 })
  return g.build()
}

// Turned wooden handle for the bell.
export function bellHandleGeo(): THREE.BufferGeometry {
  const g = new Geo()
  g.add(lathe([[0.0001, 0.0462], [0.0036, 0.0462], [0.0032, 0.05], [0.0048, 0.054], [0.0028, 0.06], [0.0036, 0.074], [0.0062, 0.084], [0.0056, 0.091], [0.003, 0.094], [0.0001, 0.0945]], 18), hex('#3e2518'), { noise: 0.06, wear: 0.35 })
  return g.build()
}

// Square cut-glass inkwell (dark bottle glass, ink inside) with a brass hinged cap, and a quill
// standing in it. Origin at the inkwell's foot.
export function inkpotGeo(): THREE.BufferGeometry {
  const g = new Geo()
  const glass = hex('#18231f'), brassC = hex('#b8913f'), ink = hex('#07080c')
  const body = new THREE.BoxGeometry(0.036, 0.024, 0.036, 1, 1, 1).translate(0, 0.012, 0)
  g.add(body, glass, { noise: 0.03, flat: true })
  g.add(lathe([[0.0001, 0.024], [0.016, 0.024], [0.0172, 0.026], [0.0165, 0.0275], [0.0001, 0.0275]], 4).rotateY(Math.PI / 4), glass, { flat: true })
  g.add(cyl(0.0082, 0.0086, 0.0045, 18).translate(0, 0.027, 0), brassC, { wear: 0.8 }) // collar
  g.add(cyl(0.0064, 0.0064, 0.0006, 18).translate(0, 0.0314, 0), ink, { noise: 0 })
  // the open cap, thrown back on its hinge
  g.add(lathe([[0.0001, 0], [0.009, 0], [0.0092, 0.0012], [0.0076, 0.0035], [0.0001, 0.0035]], 18), brassC, { wear: 0.9 },
    new THREE.Matrix4().compose(new THREE.Vector3(0, 0.0345, -0.0165), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.9, 0, 0)), new THREE.Vector3(1, 1, 1)))
  // quill: shaft from the ink up and back; a curved vane of barbs either side
  const nib = new THREE.Vector3(0.001, 0.029, 0.001), tip = new THREE.Vector3(0.05, 0.19, 0.055)
  g.add(rod(nib, tip, 0.0012, 0.0006, 6), hex('#e8dcc2'), { noise: 0.03 })
  const dir = tip.clone().sub(nib), L = dir.length()
  dir.normalize()
  const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), flat = dir.clone().cross(side).normalize()
  for (const s of [-1, 1]) {
    const pts: [number, number][] = []
    for (let i = 0; i <= 14; i++) {
      const t = 0.3 + 0.7 * (i / 14), w = Math.sin(Math.PI * Math.min(1, (t - 0.3) / 0.68)) * (s > 0 ? 0.0105 : 0.0068)
      pts.push([t * L, w + (i % 2 ? 0.0008 : 0)]) // saw-toothed edge: barbs
    }
    const outline: [number, number][] = [[0.3 * L, 0], ...pts, [L, 0]]
    const m = new THREE.Matrix4().makeBasis(dir, side.clone().multiplyScalar(s), flat).setPosition(nib)
    g.add(extrude(outline, 0.0005), s > 0 ? hex('#efe7d6') : hex('#d7ccb6'), { noise: 0.05 }, m)
  }
  // grey-barred tip
  g.add(sphere(0.0022, 6, 4).translate(tip.x, tip.y, tip.z), hex('#6d6a66'))
  return g.build(0.15, 0.03)
}
