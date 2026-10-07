// Overlays on the painted sheet (DESIGN §9 "Overlays"): every one pairs a PATTERN with an icon
// or outline, never colour alone, so they survive grayscale and colour blindness.
//   reach   gold dot lattice + gold region outline          path    gold ink ribbon, dots, arrowhead
//   own fan blue #3E6FA8 45deg hatching + solid outline     enemy fan  red #A8352C dashes + dashed outline
//   intents red cross-hatch + a wax glyph roundel (assault / fire / barrage / gas) + a "-n" damage tag
//   danger  a wash with an outline (hover only)             targets  red ring + crosshair ticks
//   hover   an ivory-gold inner rim                         cursor   gold corner brackets
// The hex patterns are drawn by the sheet's own shader (injected into the relief, trench and
// water materials) from a 13x18 flag texture, so they follow the relief exactly and cost no
// draw calls; the path ribbon and the glyph billboards are two more meshes.
import * as THREE from 'three'
import type { Overlay } from '../contract/render-api.ts'
import { COLS, ROWS } from '../contract/types.ts'
import type { GameState, HexId, Intent } from '../contract/types.ts'
import { DX, HEX, hexX, hexZ, N_HEX, neighbor, R } from './HexLayout.ts'
import { pieceSpot } from './features.ts'
import type { Surface } from './Pieces.ts'

const F = { reach: 1, path: 2, own: 4, enemy: 8, danger: 16, target: 32, hover: 64, cursor: 128 }
const KIND = { assault: 0, fire: 1, barrage: 2, gas: 3 } as const
const MAX_GLYPHS = 32 // billboards (2 per intent)

// ---------------------------------------------------------------------------------------------
// The GLSL: hex of a sheet point, then the patterns. Units are metres on the sheet.
const GLSL_OVERLAY = /* glsl */`
uniform sampler2D uOv;
uniform float uOvT;
varying vec2 vBXZ;
const float OV_R = ${R.toFixed(7)};
const float OV_DX = ${DX.toFixed(7)};
const float OV_HEX = ${HEX.toFixed(4)};
const float OV_W0 = ${(DX * (COLS - 1)).toFixed(7)};
const float OV_H0 = ${(HEX * (ROWS - 1) + HEX / 2).toFixed(7)};

// flat-top odd-q: returns (col,row) and the point relative to that hex centre
ivec2 ovHex(vec2 p, out vec2 loc) {
  vec2 q0 = p + vec2(OV_W0, OV_H0) * 0.5;
  float qf = (2.0 / 3.0) * q0.x / OV_R;
  float rf = (-q0.x / 3.0 + 0.57735027 * q0.y) / OV_R;
  float sf = -qf - rf;
  float q = floor(qf + 0.5), r = floor(rf + 0.5), s = floor(sf + 0.5);
  float dq = abs(q - qf), dr = abs(r - rf), ds = abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  int col = int(q);
  int odd = col & 1;
  int row = int(r) + (col - odd) / 2;
  loc = p - vec2(float(col) * OV_DX - OV_W0 * 0.5, float(row) * OV_HEX + (odd == 1 ? OV_HEX * 0.5 : 0.0) - OV_H0 * 0.5);
  return ivec2(col, row);
}
// distance from the local point to edge d (0 N, 1 NE, 2 SE, 3 S, 4 SW, 5 NW), >0 inside
float ovEdge(vec2 loc, int d) {
  float a = float(d) * 1.0471976;
  return OV_HEX * 0.5 - dot(loc, vec2(sin(a), -cos(a)));
}
float ovLine(float dist, float hw, float aa) { return 1.0 - smoothstep(hw - aa, hw + aa, abs(dist)); }
// outline band along every edge whose bit is set in mask
float ovOutline(vec2 loc, int mask, float hw, float inset, float aa) {
  float o = 0.0;
  for (int d = 0; d < 6; d++) {
    if ((mask & (1 << d)) == 0) continue;
    o = max(o, ovLine(ovEdge(loc, d) - inset, hw, aa));
  }
  return o;
}
// colours below are authored in sRGB (as picked); the sheet shades in linear
vec3 L(vec3 c) { return pow(c, vec3(2.2)); }
void ovOver(inout vec4 acc, vec3 c, float a) { acc.rgb = mix(acc.rgb, c, a); acc.a = acc.a + a * (1.0 - acc.a); }

vec4 ovColor(vec2 p, out float glow) {
  glow = 0.0;
  vec2 loc;
  ivec2 h = ovHex(p, loc);
  if (h.x < 0 || h.y < 0 || h.x >= ${COLS} || h.y >= ${ROWS}) return vec4(0.0);
  ivec4 A = ivec4(texelFetch(uOv, h, 0) * 255.0 + 0.5);
  ivec4 B = ivec4(texelFetch(uOv, ivec2(h.x, h.y + ${ROWS}), 0) * 255.0 + 0.5);
  int fl = A.r;
  if (fl == 0 && A.g == 0) return vec4(0.0);
  float aa = max(fwidth(p.x), fwidth(p.y)) * 0.75 + 1e-5;
  // patterns fade to their mean coverage when the texels get coarse (gallery zoom): no moire
  float fine = smoothstep(0.0045, 0.002, aa);
  float edge = 1e3;
  for (int d = 0; d < 6; d++) edge = min(edge, ovEdge(loc, d));
  vec4 acc = vec4(0.0);
  float pulse = 0.5 + 0.5 * sin(uOvT * 3.2);

  if ((fl & ${F.danger}) != 0) {
    ovOver(acc, L(vec3(0.55, 0.16, 0.1)), 0.3);
    ovOver(acc, L(vec3(0.5, 0.1, 0.06)), ovOutline(loc, B.b, 0.0011, 0.0022, aa) * 0.85);
  }
  if ((fl & ${F.own}) != 0) {
    vec3 blue = L(vec3(0.243, 0.435, 0.659));
    float u = (p.x + p.y) * 0.70710678;
    float hatch = ovLine(fract(u / 0.0085) - 0.5, 0.17, aa / 0.0085);
    // MG fans as a light wash: at 0.22 / 0.62 the overlapping fans across no-man's-land "made the
    // centre look dirty" to an outside review; the outlines still carry the edge.
    ovOver(acc, blue, mix(0.1, hatch * 0.36, fine));
    ovOver(acc, blue * 0.8, ovOutline(loc, B.r, 0.0012, 0.0018, aa) * 0.9);
  }
  if ((fl & ${F.enemy}) != 0) {
    vec3 red = L(vec3(0.659, 0.208, 0.173));
    // staggered dash rows at -30deg
    vec2 q = vec2(p.x * 0.8660254 + p.y * 0.5, -p.x * 0.5 + p.y * 0.8660254);
    float row = floor(q.y / 0.0075);
    vec2 f = vec2(fract(q.x / 0.013 + 0.5 * mod(row, 2.0)), fract(q.y / 0.0075));
    float dash = ovLine(f.y - 0.5, 0.16, aa / 0.0075) * (1.0 - smoothstep(0.52, 0.52 + aa / 0.013, f.x));
    ovOver(acc, red, mix(0.1, dash * 0.42, fine));
    // dashed outline
    float along = fract((loc.x * 0.5 - loc.y * 0.8660254 + loc.x * loc.y * 4.0) / 0.009);
    ovOver(acc, red * 0.85, ovOutline(loc, B.g, 0.0012, 0.0018, aa) * step(0.45, along) * 0.95);
  }
  if ((fl & ${F.reach}) != 0) {
    // Ink-rimmed gold dots, 5 mm across on a 14 mm lattice: the first cut (3.4 mm, no rim) was
    // about a pixel at the commander's 1.95 m and an outside review saw "no dots" on selection.
    vec3 gold = L(vec3(0.95, 0.7, 0.2));
    vec2 g = (fract(p / 0.014 + 0.5) - 0.5) * 0.014;
    float gl = length(g);
    float dotm = 1.0 - smoothstep(0.0025 - aa, 0.0025 + aa, gl);
    float rimm = (1.0 - smoothstep(0.0034 - aa, 0.0034 + aa, gl)) * (1.0 - dotm);
    ovOver(acc, gold, mix(0.2, 0.14, fine));
    ovOver(acc, L(vec3(0.24, 0.14, 0.05)), rimm * 0.8 * fine);
    ovOver(acc, gold, dotm * 0.95 * fine);
    float o = ovOutline(loc, A.b, 0.0014, 0.0026, aa);
    ovOver(acc, gold * 1.1, o);
    glow = max(glow, 0.55 * dotm * fine + 0.5 * o);
  }
  if ((fl & ${F.path}) != 0) {
    ovOver(acc, L(vec3(0.9, 0.66, 0.22)), 0.16);
  }
  if (A.g >= 128) {
    // intent: red cross-hatch, denser toward the centre, plus an inked rim
    vec3 ink = L(vec3(0.62, 0.1, 0.07));
    float d1 = ovLine(fract((p.x + p.y) * 0.70710678 / 0.0072) - 0.5, 0.15, aa / 0.0072);
    float d2 = ovLine(fract((p.x - p.y) * 0.70710678 / 0.0072) - 0.5, 0.15, aa / 0.0072);
    float x = max(d1, d2);
    ovOver(acc, ink, mix(0.4, x * 0.8, fine) * (0.85 + 0.15 * pulse));
    ovOver(acc, ink * 0.8, ovLine(edge - 0.0026, 0.0015, aa));
    glow = max(glow, 0.12 * x);
  }
  if ((fl & ${F.target}) != 0) {
    vec3 red = L(vec3(0.75, 0.14, 0.08));
    float r = length(loc);
    float ring = ovLine(r - 0.0445, 0.0012 + 0.0003 * pulse, aa);
    float ang = atan(loc.y, loc.x);
    float ticks = ovLine(fract(ang / 1.5707963 + 0.5) - 0.5, 0.06, 0.02) * step(0.0455, r) * step(r, 0.05 * 0.99) * step(0.0022, edge);
    ovOver(acc, red, max(ring, ticks) * 0.95);
    glow = max(glow, 0.35 * max(ring, ticks));
  }
  if ((fl & ${F.hover}) != 0) {
    vec3 ivory = L(vec3(1.0, 0.84, 0.5));
    float rim = 1.0 - smoothstep(0.0035 - aa, 0.0035 + aa, edge);
    ovOver(acc, ivory, 0.1 + rim * 0.75);
    glow = max(glow, 0.2 + 0.6 * rim);
  }
  if ((fl & ${F.cursor}) != 0) {
    // corner brackets: the outline only near the six vertices
    float nearV = 1e3;
    for (int k = 0; k < 6; k++) { float a = float(k) * 1.0471976; nearV = min(nearV, length(loc - vec2(cos(a), sin(a)) * OV_R)); }
    float br = ovLine(edge - 0.0022, 0.0013, aa) * (1.0 - smoothstep(0.013, 0.014, nearV));
    ovOver(acc, L(vec3(1.0, 0.76, 0.28)), br);
    glow = max(glow, br * (0.6 + 0.4 * pulse));
  }
  return acc;
}
`

export class Overlays {
  readonly group = new THREE.Group()
  private readonly data = new Uint8Array(COLS * ROWS * 2 * 4)
  private readonly tex: THREE.DataTexture
  private readonly uniforms = { uOv: { value: null as THREE.Texture | null }, uOvT: { value: 0 } }
  private readonly attached = new WeakSet<THREE.Material>()
  private readonly intents = new Map<number, Intent>()
  private last: Overlay | null = null
  private state: GameState | null = null
  private surface: Surface = () => 0
  private pathKey = ''
  private readonly path: THREE.Mesh
  private readonly pathMat: THREE.ShaderMaterial
  private readonly glyphs: THREE.Mesh
  private readonly glyphGeo: THREE.InstancedBufferGeometry
  private readonly gOff: THREE.InstancedBufferAttribute
  private readonly gCell: THREE.InstancedBufferAttribute
  private readonly gSize: THREE.InstancedBufferAttribute

  constructor() {
    this.group.name = 'overlays'
    this.tex = new THREE.DataTexture(this.data, COLS, ROWS * 2, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter
    this.tex.needsUpdate = true
    this.uniforms.uOv.value = this.tex

    // path: one ribbon mesh, dashes flow toward the destination
    this.pathMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float aDist; attribute float aAcross; varying float vD; varying float vA;
        void main(){ vD = aDist; vA = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        varying float vD; varying float vA; uniform float uT;
        void main(){
          vec3 gold = vec3(0.9, 0.48, 0.09);   // linear; ~#F2B650 on screen
          vec3 ink = vec3(0.05, 0.028, 0.012);
          float edge = 1.0 - smoothstep(0.7, 1.0, abs(vA));        // soft ink edge
          vec3 c = gold; float a = 0.95;
          if (vD >= 0.0) {
            // gold dashes flowing toward the destination over a dark ink line
            float dash = step(0.36, fract(vD / 0.014 - uT * 1.4));
            c = mix(ink, gold, dash);
            a = mix(0.7, 0.95, dash) * edge;
          }
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
    })
    this.path = new THREE.Mesh(new THREE.BufferGeometry(), this.pathMat)
    this.path.name = 'overlay-path'
    this.path.renderOrder = 3
    this.path.frustumCulled = false
    this.path.visible = false
    this.group.add(this.path)

    // glyph billboards: roundels and damage tags from one atlas
    const quad = new THREE.PlaneGeometry(1, 1)
    this.glyphGeo = new THREE.InstancedBufferGeometry()
    this.glyphGeo.index = quad.index
    this.glyphGeo.setAttribute('position', quad.getAttribute('position'))
    this.glyphGeo.setAttribute('uv', quad.getAttribute('uv'))
    this.gOff = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GLYPHS * 3), 3)
    this.gCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GLYPHS * 2), 2)
    this.gSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GLYPHS * 2), 2)
    this.glyphGeo.setAttribute('aOff', this.gOff)
    this.glyphGeo.setAttribute('aCell', this.gCell)
    this.glyphGeo.setAttribute('aSize', this.gSize)
    this.glyphGeo.instanceCount = 0
    const atlas = new THREE.CanvasTexture(glyphAtlas())
    atlas.colorSpace = THREE.SRGBColorSpace
    atlas.anisotropy = 4
    const gm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: atlas }, uT: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec3 aOff; attribute vec2 aCell; attribute vec2 aSize; varying vec2 vUv; uniform float uT;
        void main(){
          vUv = (uv + aCell) / 4.0;
          vec4 mv = modelViewMatrix * vec4(aOff + vec3(0.0, 0.0015 * sin(uT * 2.0 + aOff.x * 40.0), 0.0), 1.0);
          mv.xy += position.xy * aSize;                 // camera-facing
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; varying vec2 vUv;
        void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < 0.02) discard; gl_FragColor = c;
          #include <colorspace_fragment>
        }`,
    })
    this.glyphs = new THREE.Mesh(this.glyphGeo, gm)
    this.glyphs.name = 'overlay-glyphs'
    this.glyphs.frustumCulled = false
    this.glyphs.renderOrder = 8
    this.group.add(this.glyphs)
  }

  // Inject the pattern pass into the sheet materials (relief + trenches + water). Idempotent.
  attach(materials: THREE.Material[]): void {
    for (const m of materials) {
      if (this.attached.has(m)) continue
      this.attached.add(m)
      const prev = m.onBeforeCompile
      m.onBeforeCompile = (sh, r) => {
        prev.call(m, sh, r)
        sh.uniforms.uOv = this.uniforms.uOv
        sh.uniforms.uOvT = this.uniforms.uOvT
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vBXZ;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBXZ = position.xz;')
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' + GLSL_OVERLAY)
          .replace('#include <map_fragment>', '#include <map_fragment>\nfloat ovGlow; vec4 ovC = ovColor(vBXZ, ovGlow);\ndiffuseColor.rgb = mix(diffuseColor.rgb, ovC.rgb, ovC.a);')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5, ovC.a * 0.7);')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ovC.rgb * ovGlow * 0.55;')
      }
      const key = m.customProgramCacheKey.bind(m)
      m.customProgramCacheKey = () => key() + '|board-overlay'
      m.needsUpdate = true
    }
  }

  // ------------------------------------------------------------------------------------------
  set(o: Overlay, s: GameState | null, surface: Surface): void {
    this.last = o
    this.state = s
    this.surface = surface
    this.intents.clear()
    for (const i of o.intents) this.intents.set(i.id, i)
    this.redraw()
  }

  addIntent(i: Intent): void { this.intents.set(i.id, i); this.redraw() }
  removeIntent(id: number): void { if (this.intents.delete(id)) this.redraw() }

  clearAll(): void {
    this.last = null
    this.intents.clear()
    this.redraw()
  }

  private redraw(): void {
    const o = this.last
    const d = this.data
    d.fill(0)
    for (let i = 3; i < d.length; i += 4) d[i] = 255
    const human = this.state?.human ?? 'BR'
    const flag = (hs: Iterable<HexId>, bit: number): Set<HexId> => {
      const set = new Set<HexId>()
      for (const h of hs) if (h >= 0 && h < N_HEX) { d[h * 4] |= bit; set.add(h) }
      return set
    }
    // edge masks: which of a set's hexes border the outside (row block 2)
    const edges = (set: Set<HexId>, ch: number, second: boolean): void => {
      for (const h of set) {
        let m = 0
        for (let k = 0; k < 6; k++) { const n = neighbor(h, k); if (n === null || !set.has(n)) m |= 1 << k }
        d[(second ? N_HEX + h : h) * 4 + ch] = m
      }
    }
    if (o) {
      edges(flag(o.reach, F.reach), 2, false)
      flag(o.path, F.path)
      const own = new Set<HexId>(), enemy = new Set<HexId>()
      for (const f of o.fans) for (const h of f.hexes) (f.side === human ? own : enemy).add(h)
      edges(flag(own, F.own), 0, true)
      edges(flag(enemy, F.enemy), 1, true)
      edges(flag(o.danger, F.danger), 2, true)
      flag(o.targets, F.target)
      if (o.hover !== null) flag([o.hover], F.hover)
      if (o.cursor !== null) flag([o.cursor], F.cursor)
    }
    for (const it of this.intents.values()) {
      const g = d[it.target * 4 + 1]
      const dmg = Math.max(g & 15, Math.min(15, it.dmg))
      d[it.target * 4 + 1] = 0x80 | (g >= 128 ? g & 0x70 : KIND[it.kind] << 4) | dmg
    }
    this.tex.needsUpdate = true
    this.buildPath(o?.path ?? [])
    this.buildGlyphs()
  }

  // ------------------------------------------------------------------------------------------
  private occupied(h: HexId): boolean {
    return !!this.state?.units.some((u) => u.hex === h && u.str > 0)
  }

  private groundAt(h: HexId): THREE.Vector3 {
    const [x, z] = this.state ? pieceSpot(h, this.state.terrain) : [hexX(h), hexZ(h)]
    return new THREE.Vector3(x, this.surface(x, z), z)
  }

  private buildPath(path: HexId[]): void {
    const key = path.join(',')
    if (key === this.pathKey) return
    this.pathKey = key
    this.path.geometry.dispose()
    if (path.length < 2) { this.path.visible = false; this.path.geometry = new THREE.BufferGeometry(); return }
    const lift = 0.0028
    const ctrl = path.map((h) => { const p = this.groundAt(h); return new THREE.Vector3(p.x, 0, p.z) })
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5)
    const N = (path.length - 1) * 14
    const pos: number[] = [], dist: number[] = [], across: number[] = []
    const W = 0.005
    const pts = curve.getSpacedPoints(N)
    // stop the ribbon short of the destination so the arrowhead owns the tip
    const total = curve.getLength(), stopAt = total - 0.022
    let run = 0
    const push = (p: THREE.Vector3, dd: number, ac: number): void => {
      pos.push(p.x, this.surface(p.x, p.z) + lift, p.z); dist.push(dd); across.push(ac)
    }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1]
      const seg = a.distanceTo(b)
      if (run + seg > stopAt) break
      const t = b.clone().sub(a).normalize(), n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(W)
      const a0 = a.clone().add(n), a1 = a.clone().sub(n), b0 = b.clone().add(n), b1 = b.clone().sub(n)
      push(a0, run, 1); push(a1, run, -1); push(b1, run + seg, -1)
      push(a0, run, 1); push(b1, run + seg, -1); push(b0, run + seg, 1)
      run += seg
    }
    // arrowhead
    const end = pts[N], back = curve.getPointAt(Math.max(0, stopAt / total))
    const t = end.clone().sub(back).normalize(), n = new THREE.Vector3(-t.z, 0, t.x)
    const base = end.clone().addScaledVector(t, -0.022)
    for (const p of [base.clone().addScaledVector(n, 0.011), end.clone().addScaledVector(t, -0.004), base.clone().addScaledVector(n, -0.011)]) push(p, -1, 0)
    // step dots on every hex passed through
    for (let i = 1; i < path.length - 1; i++) {
      const c = ctrl[i]
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2, r = 0.0052
        push(c, -1, 0)
        push(new THREE.Vector3(c.x + Math.cos(a1) * r, 0, c.z + Math.sin(a1) * r), -1, 0)
        push(new THREE.Vector3(c.x + Math.cos(a0) * r, 0, c.z + Math.sin(a0) * r), -1, 0)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1))
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1))
    this.path.geometry = g
    this.path.visible = true
  }

  // Per intent: a wax roundel with the attack's glyph and a parchment "-n" tag, floating over the
  // hex (above the heads when a piece stands there, so the soldiers never hide the warning).
  private buildGlyphs(): void {
    let n = 0
    const add = (p: THREE.Vector3, cell: number, w: number, h: number): void => {
      if (n >= MAX_GLYPHS) throw new Error(`Overlays: more than ${MAX_GLYPHS} glyph billboards`)
      this.gOff.setXYZ(n, p.x, p.y, p.z)
      this.gCell.setXY(n, cell % 4, 3 - Math.floor(cell / 4))
      this.gSize.setXY(n, w, h)
      n++
    }
    const seen = new Set<HexId>()
    for (const it of this.intents.values()) {
      if (seen.has(it.target)) continue
      seen.add(it.target)
      const all = [...this.intents.values()].filter((x) => x.target === it.target)
      const dmg = Math.min(9, Math.max(...all.map((x) => x.dmg)))
      const g = this.groundAt(it.target)
      const y = g.y + (this.occupied(it.target) ? 0.082 : 0.03)
      const p = new THREE.Vector3(hexX(it.target) - 0.008, y, hexZ(it.target) - 0.004)
      add(p, KIND[it.kind], 0.034, 0.034)
      add(p.clone().add(new THREE.Vector3(0.029, -0.005, 0)), 4 + dmg, 0.03, 0.02)
    }
    this.gOff.needsUpdate = this.gCell.needsUpdate = this.gSize.needsUpdate = true
    this.glyphGeo.instanceCount = n
  }

  update(t: number): void {
    this.uniforms.uOvT.value = t
    this.pathMat.uniforms.uT.value = t
    ;(this.glyphs.material as THREE.ShaderMaterial).uniforms.uT.value = t
  }
}

// 4x4 atlas, 64 px cells: 0 assault, 1 fire, 2 barrage, 3 gas (red wax roundels with an ivory
// glyph), 4..13 damage tags "-0".."-9" (parchment with red ink).
function glyphAtlas(): HTMLCanvasElement {
  const C = 128, c = document.createElement('canvas')
  c.width = c.height = C * 4
  const g = c.getContext('2d')
  if (!g) throw new Error('2d canvas unavailable')
  const cell = (i: number): [number, number] => [(i % 4) * C, Math.floor(i / 4) * C]
  for (let i = 0; i < 4; i++) {
    const [x, y] = cell(i), cx = x + C / 2, cy = y + C / 2
    // wax blob with a squeezed-out rim
    g.fillStyle = '#5e140e'
    g.beginPath()
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, r = 58 + 3 * Math.sin(a * 5 + i) + 2 * Math.sin(a * 11); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
    g.fill()
    const grd = g.createRadialGradient(cx - 14, cy - 16, 6, cx, cy, 54)
    grd.addColorStop(0, '#d0493a'); grd.addColorStop(0.6, '#9c2219'); grd.addColorStop(1, '#6e1710')
    g.fillStyle = grd
    g.beginPath(); g.arc(cx, cy, 50, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(40,6,4,0.7)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 43, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = '#f6e7c8'; g.fillStyle = '#f6e7c8'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'
    g.save(); g.translate(cx, cy)
    if (i === 0) {
      // assault: two crossed bayonets
      for (const s of [-1, 1]) {
        g.save(); g.rotate(s * Math.PI / 4)
        g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -22); g.stroke()
        g.beginPath(); g.moveTo(-7, -18); g.lineTo(0, -36); g.lineTo(7, -18); g.closePath(); g.fill()
        g.beginPath(); g.moveTo(-9, 14); g.lineTo(9, 14); g.stroke()
        g.restore()
      }
    } else if (i === 1) {
      // fire: crosshair
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.stroke()
      for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2); g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 36); g.stroke(); g.restore() }
      g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill()
    } else if (i === 2) {
      // barrage: a shell burst star
      g.beginPath()
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = k % 2 ? 14 : 36; g.lineTo(Math.cos(a) * r, Math.sin(a) * r) }
      g.closePath(); g.fill()
      g.fillStyle = '#9c2219'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill()
    } else {
      // gas: a respirator (goggles + canister) — reads as "gas" without words
      g.beginPath(); g.ellipse(0, 2, 30, 24, 0, 0, Math.PI * 2); g.stroke()
      g.fillStyle = '#f6e7c8'
      for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 12, -4, 8, 0, Math.PI * 2); g.fill() }
      g.beginPath(); g.rect(-7, 16, 14, 18); g.fill()
    }
    g.restore()
  }
  for (let dmg = 0; dmg <= 9; dmg++) {
    const [x, y] = cell(4 + dmg), cx = x + C / 2, cy = y + C / 2
    g.fillStyle = '#efe2c2'
    g.strokeStyle = '#5e140e'; g.lineWidth = 5
    g.beginPath(); g.roundRect(x + 6, y + 22, C - 12, C - 44, 14); g.fill(); g.stroke()
    g.fillStyle = '#8e1c14'; g.font = 'bold 70px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(`−${dmg}`, cx, cy + 4)
  }
  return c
}
