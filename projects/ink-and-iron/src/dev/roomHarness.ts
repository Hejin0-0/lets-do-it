// Room isolation page (Worker-C): `?room&view=overview|gallery|table|shelves|window|fire`.
// Renders the room alone with a flat parchment placeholder where the map goes, at a fixed clock
// (deterministic captures), then publishes window.__THREE_INFO__ and sets window.__ready.
// Options: &t=<s> clock, &anim=1 keep animating, &lamp=0, &post=0, &reduced=1, &quality=mobile,
// &regions=1 (flat region-ID render), &measure=1 (in-page gates: brightness order, lamp A/B,
// S-01 pixel metrics), &cam=x,y,z,tx,ty,tz,fov.
import * as THREE from 'three'
import { createRenderer } from '../core/Renderer.ts'
import { createBus } from '../contract/bus.ts'
import { TABLE_TOP_Y } from '../contract/render-api.ts'
import type { Quality } from '../contract/render-api.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { REGION } from '../room/Kit.ts'
import { createRoomView } from '../room/RoomView.ts'
import type { RoomViewC } from '../room/RoomView.ts'
import { LAMP } from '../room/WarTable.ts'

type Pose = [number, number, number, number, number, number, number]

// commander / gallery poses copied from src/systems/CameraRig.ts (pitch, dist, fov, target)
function orbit(pitch: number, dist: number, fov: number, ty: number, tz: number): Pose {
  const p = THREE.MathUtils.degToRad(pitch)
  const t = [0, TABLE_TOP_Y + ty, tz]
  return [t[0], t[1] + dist * Math.sin(p), t[2] + dist * Math.cos(p), t[0], t[1], t[2], fov]
}
const VIEWS: Record<string, Pose> = {
  overview: [0.35, 2.05, 5.6, 0, 2.55, -4.5, 58],
  gallery: orbit(34, 4.1, 40, 0.35, 0),
  table: orbit(45, 1.55, 36, 0, 0.02),
  close: orbit(52, 0.95, 36, 0, 0.05),
  shelves: [-2.35, 1.75, -0.6, -4.3, 1.9, -2.3, 50],
  window: [0.3, 1.5, -0.2, 0, 5.4, -9, 55],
  fire: [2.2, 1.35, 2.0, 4.8, 0.9, -0.3, 52],
  gate: [0.2, 1.7, -2.4, 0, 1.4, -8.5, 55],
}

const REGION_SHADER = {
  vertexShader: /* glsl */`
    attribute float aRegion;
    varying float vR; varying vec3 vW;
    void main() {
      vR = aRegion;
      vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      vec4 w = modelMatrix * p; vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform float uRegion; uniform vec2 uLamp;
    varying float vR; varying vec3 vW;
    void main() {
      float r = max(floor(vR + 0.5), uRegion);
      if (r == 2.0 && distance(vW.xz, uLamp) < 0.3) r = 6.0;
      gl_FragColor = vec4(vec3(r * 40.0 / 255.0), 1.0);
    }`,
}

interface Info { [k: string]: unknown }

function readback(r: THREE.WebGLRenderer): { data: Uint8Array; w: number; h: number } {
  const gl = r.getContext()
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const data = new Uint8Array(w * h * 4)
  r.setRenderTarget(null)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data)
  return { data, w, h }
}

const luma = (d: Uint8Array, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]

/** scripts/inspect-threejs-canvas.mjs computePixelMetrics, on a readback (row order is irrelevant). */
function pixelMetrics(img: { data: Uint8Array; w: number; h: number }) {
  const sx = Math.max(1, Math.floor(img.w / 160)), sy = Math.max(1, Math.floor(img.h / 90))
  const cols = Math.floor(img.w / sx), rows = Math.floor(img.h / sy)
  const lum: number[] = []
  const buckets = new Map<string, number>()
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const o = ((gy * sy) * img.w + gx * sx) * 4
    lum.push(luma(img.data, o))
    const k = `${img.data[o] >> 4},${img.data[o + 1] >> 4},${img.data[o + 2] >> 4}`
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  const s = [...lum].sort((a, b) => a - b)
  let ent = 0, dom = 0
  for (const c of buckets.values()) { const p = c / lum.length; ent -= p * Math.log2(p); dom = Math.max(dom, c) }
  let edges = 0, checked = 0
  for (let gy = 0; gy < rows - 1; gy++) for (let gx = 0; gx < cols - 1; gx++) {
    const i = gy * cols + gx
    if (Math.max(Math.abs(lum[i] - lum[i + 1]), Math.abs(lum[i] - lum[i + cols])) > 12) edges++
    checked++
  }
  const r1 = (x: number) => Math.round(x * 100) / 100
  return {
    contrast: r1(s[Math.floor(s.length * 0.95)] - s[Math.floor(s.length * 0.05)]), p5: r1(s[Math.floor(s.length * 0.05)]),
    p95: r1(s[Math.floor(s.length * 0.95)]), entropy: r1(ent), dominant: r1(dom / lum.length), edgeDensity: r1(edges / checked),
    mean: r1(s.reduce((a, b) => a + b, 0) / s.length),
  }
}

function regionMeans(beauty: Uint8Array, ids: Uint8Array): Record<string, { mean: number; px: number }> {
  const names = ['other', 'board', 'margin', 'floor', 'shelves', 'ceiling', 'lampMargin']
  const sum = new Float64Array(7), n = new Float64Array(7)
  for (let i = 0; i < ids.length; i += 4) {
    const v = ids[i] / 40, r = Math.round(v)
    if (Math.abs(v - r) > 0.12 || r > 6) continue
    sum[r] += luma(beauty, i); n[r]++
  }
  const out: Record<string, { mean: number; px: number }> = {}
  for (let k = 0; k < 7; k++) out[names[k]] = { mean: Math.round((n[k] ? sum[k] / n[k] : 0) * 10) / 10, px: n[k] }
  return out
}

export async function run(canvas: HTMLCanvasElement, q: URLSearchParams): Promise<void> {
  const quality: Quality = q.get('quality') === 'mobile' ? 'mobile' : 'desktop'
  const renderer = createRenderer(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, quality === 'mobile' ? 1.5 : 2)
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, w / h, 0.05, 80)
  const room = createRoomView(createBus()) as RoomViewC
  room.build(scene, renderer, quality)
  room.resize(w, h, dpr)
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(1.155, 0.95), mat('parchment'))
  ph.rotation.x = -Math.PI / 2
  ph.position.y = 0.0005
  ph.receiveShadow = true
  ph.name = 'map-placeholder'
  ph.userData.region = REGION.board
  room.tableTop.add(ph)

  const view = q.get('view') ?? 'overview'
  const custom = q.get('cam')?.split(',').map(Number)
  const pose = (custom && custom.length === 7 ? custom : VIEWS[view]) as Pose | undefined
  if (!pose) throw new Error(`roomHarness: unknown view "${view}"`)
  camera.position.set(pose[0], pose[1], pose[2])
  camera.fov = pose[6]
  camera.updateProjectionMatrix()
  camera.lookAt(pose[3], pose[4], pose[5])

  let t = Number(q.get('t') ?? 2.5)
  if (q.get('reduced') === '1') room.setReducedMotion(true)
  const rig = room.debug.rig
  if (q.get('lamp') === '0' && rig) rig.lamp.intensity = 0
  if (q.get('post') === '0' && room.debug.pipe) room.debug.pipe.post = false
  // &off=key,moon,fire,lamp,candles,hemi: diagnostics (which light makes which pool)
  const off = new Set((q.get('off') ?? '').split(','))
  if (rig) {
    for (const [name, l] of [['key', rig.key], ['moon', rig.moon], ['fire', rig.fire], ['hemi', rig.hemi]] as const) if (l && off.has(name)) l.visible = false
    if (off.has('lamp')) rig.lamp.visible = false
    if (off.has('candles')) for (const c of rig.candles) c.visible = false
  }
  if (off.has('env')) scene.environmentIntensity = 0
  // &linear=1: no tone mapping, no post: a pixel at >= 237 (sRGB) is at or over the bloom threshold
  if (q.get('linear') === '1') {
    if (room.debug.pipe) room.debug.pipe.post = false
    renderer.toneMapping = THREE.NoToneMapping
  }
  const frame = () => { room.update(1 / 60, t); room.render(scene, camera) }
  for (let i = 0; i < 3; i++) frame()
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  frame()
  const info = renderer.info
  const out: Info = {
    view, quality, dpr, t,
    frame: { calls: info.render.calls, triangles: info.render.triangles, points: info.render.points },
    memory: { geometries: info.memory.geometries, textures: info.memory.textures },
    programs: info.programs?.length ?? 0,
    books: room.debug.books?.count ?? 0,
    candles: room.debug.candles?.wax.count ?? 0,
    lights: scene.children.filter((o) => (o as THREE.Light).isLight).map((l) => l.name || l.type),
    shadowed: scene.children.filter((o) => (o as THREE.Light).isLight && o.castShadow).length,
  }
  const tris: Record<string, number> = {}
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const g = m.geometry
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3
    tris[o.name || o.type] = Math.round(n * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1))
  })
  out.meshTriangles = tris
  // scene pass alone (no shadow maps, no post): the room's own draw calls
  {
    const pipe = room.debug.pipe
    const post = pipe?.post ?? false
    if (pipe) pipe.post = false
    renderer.shadowMap.autoUpdate = false
    room.render(scene, camera)
    out.scenePass = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
    renderer.shadowMap.autoUpdate = true
    if (pipe) pipe.post = post
  }
  if (q.get('measure') === '1' || q.get('regions') === '1') {
    room.render(scene, camera)
    const beautyOn = readback(renderer)
    out.pixels = pixelMetrics(beautyOn)
    let beautyOff = beautyOn
    if (rig) {
      const k = rig.lamp.intensity
      rig.lamp.intensity = 0
      room.render(scene, camera)
      beautyOff = readback(renderer)
      rig.lamp.intensity = k
    }
    // region IDs: swap every material for a flat ID shader, hide additive/emissive cards
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []
    const hidden: THREE.Object3D[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if ((o as THREE.Points).isPoints) { hidden.push(o); return }
      if (!m.isMesh) return
      const mm = m.material as THREE.Material
      if (mm.blending === THREE.AdditiveBlending || (mm as THREE.MeshBasicMaterial).isMeshBasicMaterial) { hidden.push(o); return }
      swapped.push([m, m.material])
      m.material = new THREE.ShaderMaterial({ ...REGION_SHADER, uniforms: { uRegion: { value: m.userData.region ?? 0 }, uLamp: { value: new THREE.Vector2(LAMP.x, LAMP.z) } } })
    })
    for (const o of hidden) o.visible = false
    const pipe = room.debug.pipe
    const post = pipe?.post ?? false
    if (pipe) pipe.post = false
    const tm = renderer.toneMapping
    renderer.toneMapping = THREE.NoToneMapping
    const bg = scene.background
    scene.background = null
    renderer.setClearColor(0x000000, 1)
    room.render(scene, camera)
    const ids = readback(renderer)
    const on = regionMeans(beautyOn.data, ids.data), off = regionMeans(beautyOff.data, ids.data)
    out.regions = on
    out.lamp = { on: on.lampMargin.mean, off: off.lampMargin.mean, ratio: Math.round((on.lampMargin.mean / Math.max(0.01, off.lampMargin.mean)) * 100) / 100, px: on.lampMargin.px }
    const order = ['board', 'margin', 'floor', 'shelves', 'ceiling'].filter((k) => on[k].px > 50)
    out.order = order.map((k) => `${k}:${on[k].mean}`).join(' > ')
    out.orderHolds = order.every((k, i) => i === 0 || on[order[i - 1]].mean > on[k].mean)
    if (q.get('regions') !== '1') {
      for (const [m, mm] of swapped) { (m.material as THREE.Material).dispose(); m.material = mm }
      for (const o of hidden) o.visible = true
      if (pipe) pipe.post = post
      renderer.toneMapping = tm
      scene.background = bg
    }
  }
  ;(window as unknown as { __THREE_INFO__: Info }).__THREE_INFO__ = out
  const anim = q.get('anim') === '1'
  const regions = q.get('regions') === '1'
  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (anim) t += dt
    if (regions) renderer.render(scene, camera)
    else { room.update(anim ? dt : 0, t); room.render(scene, camera) }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  ;(window as unknown as { __ready: boolean }).__ready = true
}
