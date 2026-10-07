import { phases } from '../phases'
import { usePhase } from '../PhaseProvider'

/** Bottom-right nudge to the next phase; wraps to the top on the last one. */
export function ScrollCTA() {
  const { phase, goTo } = usePhase()
  const last = phase === phases.length - 1
  return (
    <button type="button" className="cta" onClick={() => goTo(last ? 0 : phase + 1)}>
      {last ? 'Back to top' : `Scroll to Phase ${phase + 2}`}
      <span className="cta__arrow" aria-hidden="true">
        {last ? '↑' : '↓'}
      </span>
    </button>
  )
}

/** Bottom-left hint, first screen only. */
export function ScrollHint({ phase }: { phase: number }) {
  return (
    <p className="hint" data-on={phase === 0 || undefined} aria-hidden={phase !== 0}>
      <span className="hint__rule" aria-hidden="true" />
      Scroll to explore
    </p>
  )
}
