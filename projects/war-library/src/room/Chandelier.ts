// Iron chandelier over the war-table (DESIGN §9): a 1.2 m wrought ring with twelve scrolled arms,
// drip pans, a turned central stem with a drop finial, three chains to a hook and one chain to
// the ridge. Its candles are part of the Candles instancing; the key spot sits among them.
import * as THREE from 'three'
import { Batch, REGION, T, lathe } from './Kit.ts'
import { CHANDELIER_Y, HALL } from './Layout.ts'

export const CHANDELIER_C = new THREE.Vector3(0, CHANDELIER_Y, -0.3)
const ARMS = 12
const R = 0.6
const IRON = 0x9a918a

function chain(b: Batch, a: THREE.Vector3, c: THREE.Vector3, step = 0.058): void {
  const d = c.clone().sub(a)
  const len = d.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  const n = Math.max(1, Math.floor(len / step))
  for (let i = 0; i < n; i++) {
    const g = new THREE.TorusGeometry(0.019, 0.0048, 4, 8)
    g.scale(1, 1.55, 1)
    g.rotateY((i % 2) * Math.PI / 2)
    const p = a.clone().addScaledVector(d, (i + 0.5) * (len / n))
    b.add('ironV', g, new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)), IRON, REGION.other)
  }
}

/** Returns the world positions of the candle sockets (top of each drip pan). */
/**
 * The chandelier's pool made visible: an open cone from under the ring to the war-table (the key
 * spot's own 1.15 m footprint), additive, soft at its silhouette and both ends. From the hall it
 * draws the eye down the room to the table (blind A/B: "the board is a tiny part of the frame;
 * add a light pool that draws the eye to it"); it fades out by the time the intro reaches the
 * chair, where it would only haze the board. ponytail: a shader cone, not volumetric light.
 */
export function lightShaft(tableY: number): THREE.Mesh {
  const top = CHANDELIER_Y - 0.12, bottom = tableY + 0.01, h = top - bottom
  const g = new THREE.CylinderGeometry(0.5, 1.15, h, 48, 1, true)
    .rotateX(-Math.atan2(-CHANDELIER_C.z, h)) // the ring hangs 0.3 m north of the table's centre
    .translate(0, bottom + h / 2, CHANDELIER_C.z / 2)
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffcf8a') }, uCenter: { value: new THREE.Vector3(0, tableY, 0) }, uBottom: { value: bottom }, uH: { value: h } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uCenter; uniform float uBottom; uniform float uH;
      varying vec3 vN; varying vec3 vW;
      void main() {
        float face = pow(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 2.0);
        float y = clamp((vW.y - uBottom) / uH, 0.0, 1.0);
        float ends = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.72, 1.0, y));
        float far = smoothstep(3.2, 6.0, distance(cameraPosition, uCenter));
        gl_FragColor = vec4(uColor, 0.13 * face * ends * far);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.name = 'chandelier:shaft'
  mesh.renderOrder = 5
  return mesh
}

export function buildChandelier(b: Batch): THREE.Vector3[] {
  const C = CHANDELIER_C
  const ring = new THREE.TorusGeometry(R, 0.022, 8, 72)
  b.add('ironV', ring, T(C.x, C.y, C.z, Math.PI / 2, 0, 0), IRON, REGION.other)
  b.add('ironV', new THREE.TorusGeometry(R * 0.72, 0.012, 6, 56), T(C.x, C.y - 0.1, C.z, Math.PI / 2, 0, 0), IRON, REGION.other)
  b.add('ironV', new THREE.TorusGeometry(R * 0.3, 0.014, 6, 32), T(C.x, C.y + 0.42, C.z, Math.PI / 2, 0, 0), IRON, REGION.other)
  // turned stem with boss and drop finial
  b.add('ironV', lathe([[0, -0.46], [0.012, -0.44], [0.035, -0.38], [0.02, -0.3], [0.055, -0.2], [0.075, -0.1], [0.05, 0.0],
    [0.02, 0.04], [0.02, 0.3], [0.04, 0.36], [0.03, 0.44], [0.012, 0.5], [0.012, 0.62], [0, 0.64]], 14), T(C.x, C.y, C.z), IRON, REGION.other)
  const sockets: THREE.Vector3[] = []
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const pts = [[0.05, -0.02], [0.2, -0.1], [0.36, -0.06], [0.48, 0.04], [R, 0.0]].map(([r, y]) =>
      new THREE.Vector3(C.x + dir.x * r, C.y + y, C.z + dir.z * r))
    b.add('ironV', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.0085, 5), null, IRON, REGION.other)
    // curl under the ring
    const curl: THREE.Vector3[] = []
    for (let k = 0; k <= 10; k++) {
      const u = (k / 10) * Math.PI * 1.6
      const rr = 0.05 * (1 - k / 14)
      curl.push(new THREE.Vector3(C.x + dir.x * (R - 0.06 + Math.sin(u) * rr), C.y - 0.02 - (1 - Math.cos(u)) * rr, C.z + dir.z * (R - 0.06 + Math.sin(u) * rr)))
    }
    b.add('ironV', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 12, 0.006, 4), null, IRON, REGION.other)
    // drip pan and socket
    const p = new THREE.Vector3(C.x + dir.x * R, C.y, C.z + dir.z * R)
    b.add('ironV', lathe([[0, 0.015], [0.03, 0.02], [0.045, 0.035], [0.042, 0.04], [0.016, 0.03], [0.016, 0.06], [0.013, 0.062], [0, 0.062]], 12),
      T(p.x, p.y, p.z), IRON, REGION.other)
    sockets.push(new THREE.Vector3(p.x, p.y + 0.06, p.z))
    // crown spikes on the upper ring
    if (i % 2 === 0) {
      const s = new THREE.Vector3(C.x + dir.x * R * 0.3, C.y + 0.42, C.z + dir.z * R * 0.3)
      b.add('ironV', new THREE.ConeGeometry(0.012, 0.14, 5).translate(0, 0.07, 0), T(s.x, s.y, s.z), IRON, REGION.other)
    }
  }
  // chains: three from the ring to a hook, one from the hook to the ridge beam
  const hook = new THREE.Vector3(C.x, C.y + 1.35, C.z)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6
    chain(b, new THREE.Vector3(C.x + Math.cos(a) * R, C.y + 0.02, C.z + Math.sin(a) * R), hook)
  }
  b.add('ironV', new THREE.TorusGeometry(0.05, 0.01, 6, 16), T(hook.x, hook.y + 0.03, hook.z), IRON, REGION.other)
  chain(b, hook.clone().add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(C.x, HALL.ridge - 0.3, C.z))
  return sockets
}
