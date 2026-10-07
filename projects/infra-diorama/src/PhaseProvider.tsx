import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { phases } from './phases'

gsap.registerPlugin(ScrollTrigger)

/**
 * Continuous scroll values live outside React on purpose: the render loop reads
 * them 60×/s and re-rendering the tree at that rate would be pointless churn.
 * The discrete `phase` is mirrored here too so useFrame can read it without a
 * subscription. Module singleton — one diorama per page.
 * ponytail: a store library buys nothing over this until there are two scenes.
 */
export const scrollState = { phase: 0, progress: 0, reduced: false }

type PhaseApi = {
  phase: number
  /** Filled in by the scroll sections; read once ScrollTrigger is set up. */
  sections: React.RefObject<(HTMLElement | null)[]>
  goTo: (index: number) => void
  reducedMotion: boolean
}

const Ctx = createContext<PhaseApi | null>(null)

export function usePhase() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePhase must be used inside <PhaseProvider>')
  return ctx
}

export function PhaseProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState(0)
  const sections = useRef<(HTMLElement | null)[]>([])
  const lenis = useRef<Lenis | null>(null)

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    scrollState.reduced = reducedMotion
    let cleanupLenis: (() => void) | undefined

    // Reduced motion: native scroll only. No inertia, no smoothing.
    if (!reducedMotion) {
      const l = new Lenis({ duration: 1.1, wheelMultiplier: 0.9 })
      lenis.current = l
      l.on('scroll', ScrollTrigger.update)
      const raf = (time: number) => l.raf(time * 1000)
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)
      cleanupLenis = () => {
        gsap.ticker.remove(raf)
        l.destroy()
        lenis.current = null
      }
    }

    // Child refs are committed before this parent effect runs.
    const triggers = phases.flatMap((_, i) => {
      const el = sections.current[i]
      if (!el) return []
      return ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return
          scrollState.phase = i
          setPhase(i)
        },
      })
    })

    triggers.push(
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          scrollState.progress = self.progress
        },
      }),
    )

    ScrollTrigger.refresh()

    return () => {
      triggers.forEach((t) => t.kill())
      cleanupLenis?.()
    }
  }, [reducedMotion])

  const goTo = useCallback(
    (index: number) => {
      const el = sections.current[index]
      if (!el) return
      if (lenis.current) lenis.current.scrollTo(el, { offset: 2 })
      else el.scrollIntoView({ behavior: 'auto', block: 'start' })
    },
    [],
  )

  const value = useMemo(
    () => ({ phase, sections, goTo, reducedMotion }),
    [phase, goTo, reducedMotion],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
