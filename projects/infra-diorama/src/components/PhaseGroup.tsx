import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../PhaseProvider'

/**
 * The one piece of phase logic the model needs.
 *
 * Wrap anything in `<PhaseGroup from={3} to={4}>` and it grows out of the
 * ground when phase 3 arrives and sinks away after phase 4. `from`/`to` are
 * 1-indexed to match the phase numbers in the UI.
 *
 * This is the seam for real assets: swapping DioramaModel for a glTF means
 * wrapping its nodes in these same groups. The scroll controller never changes.
 */
export function PhaseGroup({
  from,
  to = 99,
  mode = 'rise',
  children,
}: {
  from: number
  to?: number
  /** 'rise' builds up out of the pad; 'fade' is for flat things like water. */
  mode?: 'rise' | 'fade'
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null!)
  const p = useRef(0)
  const mats = useRef<THREE.Material[] | null>(null)

  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return

    const n = scrollState.phase + 1
    const target = n >= from && n <= to ? 1 : 0
    const prev = p.current

    // lambda 6.2 ≈ 95% in 480ms, settled by ~750ms — the eased window we want.
    p.current = scrollState.reduced ? target : THREE.MathUtils.damp(p.current, target, 6.2, dt)
    if (Math.abs(p.current - target) < 0.002) p.current = target
    if (p.current === prev) return

    const e = p.current
    g.visible = e > 0.004
    if (!g.visible) return

    const s = 1 - (1 - e) * (1 - e)
    if (mode === 'rise') {
      g.scale.set(1, Math.max(0.0001, s), 1)
      g.position.y = (s - 1) * 0.12
    } else {
      g.scale.setScalar(0.96 + 0.04 * s)
    }

    if (!mats.current) {
      const found: THREE.Material[] = []
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m) found.push(...(Array.isArray(m) ? m : [m]))
      })
      mats.current = found
    }
    for (const m of mats.current) m.opacity = e
  })

  return (
    <group ref={ref} visible={false}>
      {children}
    </group>
  )
}
