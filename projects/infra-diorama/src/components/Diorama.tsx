import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState, usePhase } from '../PhaseProvider'
import { phases, allPins } from '../phases'
import { DioramaModel } from './DioramaModel'
import { pinNodes } from './Annotations'

export function Diorama() {
  const { phase } = usePhase()
  const model = useRef<THREE.Group>(null)
  const terrain = useRef<THREE.Group>(null)

  return (
    <div className="stage__canvas" role="img" aria-label={phases[phase].alt}>
      <Canvas
        shadows
        orthographic
        camera={{ position: [15, 12, 15], zoom: 44, near: -60, far: 140 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <CameraRig />
        <Lights />

        <group ref={terrain}>
          {/* No receiveShadow: the plane runs far outside the shadow frustum and
              would show the clamped border as hard black wedges. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
            <planeGeometry args={[110, 110]} />
            <meshStandardMaterial color="#0f1114" roughness={1} metalness={0} />
          </mesh>
        </group>

        <group ref={model}>
          <DioramaModel />
        </group>

        <ParallaxRig model={model} terrain={terrain} />
        <PinProjector target={model} />
      </Canvas>

      {/* Tilt-shift + vignette. Cheaper and steadier than a real DOF pass on a
          fixed ortho camera, and it survives on GPUs that hate postprocessing. */}
      <div className="stage__dof" aria-hidden="true" />
      <div className="stage__vignette" aria-hidden="true" />
    </div>
  )
}

function CameraRig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const mobile = size.width < 860
    cam.zoom = Math.min(size.width / (mobile ? 25 : 43), size.height / (mobile ? 17 : 24))

    // Slide the view centre toward screen-right so the model sits left of
    // centre and the caption column keeps clear ground. `right` is the camera's
    // horizontal axis for this fixed isometric.
    const shift = mobile ? 0 : 2.4
    const right = new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(shift)
    cam.position.set(15 + right.x, 12, 15 + right.z)
    cam.lookAt(right.x, 1.3, right.z)
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function Lights() {
  const key = useRef<THREE.DirectionalLight>(null)

  // Set imperatively: three caches the shadow camera's projection matrix, so
  // shadow-camera-* props that change without an explicit update silently keep
  // the old frustum — and anything outside it samples the clamped border and
  // renders solid black. ±17 clears the pad diagonal in light space.
  useEffect(() => {
    const cam = key.current?.shadow.camera
    if (!cam) return
    cam.left = -17
    cam.right = 17
    cam.top = 17
    cam.bottom = -17
    cam.near = 0.5
    cam.far = 62
    cam.updateProjectionMatrix()
  }, [])
  return (
    <>
      <hemisphereLight args={['#3d4450', '#08090a', 0.55]} />
      <ambientLight intensity={0.22} color="#8fa2bd" />
      {/* warm studio key, soft-edged */}
      <directionalLight
        ref={key}
        position={[10, 15, 7]}
        intensity={2.75}
        color="#ffeddb"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* cool rim so the model separates from the near-black canvas */}
      <directionalLight position={[-12, 7, -10]} intensity={1.25} color="#8fabd6" />
      <directionalLight position={[-4, 2, 12]} intensity={0.3} color="#ffd0a0" />
    </>
  )
}

function ParallaxRig({
  model,
  terrain,
}: {
  model: React.RefObject<THREE.Group | null>
  terrain: React.RefObject<THREE.Group | null>
}) {
  useFrame(() => {
    const t = scrollState.reduced ? 0 : scrollState.progress
    if (model.current) {
      model.current.rotation.y = -0.05 + t * 0.3
      model.current.position.set(t * -0.5, t * 0.45, 0)
    }
    if (terrain.current) terrain.current.position.set(t * -0.14, t * 0.12, 0)
  })
  return null
}

const v = new THREE.Vector3()

/**
 * Drives the DOM annotation pins from the 3D scene. Writes CSS custom
 * properties straight onto the nodes — putting projected coordinates through
 * React state would re-render the tree 60×/s for no reason.
 */
function PinProjector({ target }: { target: React.RefObject<THREE.Group | null> }) {
  useFrame(({ camera, size }) => {
    const g = target.current
    if (!g) return
    for (const pin of allPins) {
      const el = pinNodes.get(pin.id)
      if (!el) continue
      v.set(...pin.anchor).applyMatrix4(g.matrixWorld).project(camera)
      el.style.setProperty('--x', `${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px`)
      el.style.setProperty('--y', `${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px`)
    }
  })
  return null
}
