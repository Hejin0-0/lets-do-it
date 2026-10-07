// __TITLE__ — a starting scene wired to the shared packages: @lid/loop runs update/render,
// @lid/random seeds anything procedural (same seed, same world), @lid/storage keeps settings.
import * as THREE from 'three'
import { Loop } from '@lid/loop'
import { createSeededRandom } from '@lid/random'
import { readStored, writeStored } from '@lid/storage'

const SEED_KEY = '__SLUG__:seed'
const seed = readStored(SEED_KEY, (t) => (t ? Number(t) : 1), 1)
writeStored(SEED_KEY, String(seed))
const random = createSeededRandom(seed)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.append(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
camera.position.set(0, 3, 8)
camera.lookAt(0, 0, 0)
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2))

const cubes = Array.from({ length: 12 }, () => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(random(), 0.6, 0.55) }),
  )
  mesh.position.set((random() - 0.5) * 8, (random() - 0.5) * 3, (random() - 0.5) * 4)
  scene.add(mesh)
  return mesh
})

function resize(): void {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

const loop = new Loop(
  (dt) => { for (const c of cubes) c.rotation.y += dt },
  () => renderer.render(scene, camera),
)
loop.start()
