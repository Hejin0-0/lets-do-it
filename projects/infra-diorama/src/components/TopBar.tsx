import { useEffect, useId, useState } from 'react'
import { phases } from '../phases'
import { usePhase } from '../PhaseProvider'

export function TopBar() {
  const { phase, goTo } = usePhase()
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <header className="bar">
        <a className="bar__mark" href="#top">
          Meridian
          <span className="bar__markDot" aria-hidden="true" />
        </a>

        <nav className="bar__right" aria-label="Site">
          <p className="pill" aria-live="polite">
            <span className="pill__num">{phase + 1}</span>
            <span className="pill__sep" aria-hidden="true">
              ·
            </span>
            {phases[phase].short}
          </p>
          <button type="button" className="bar__link" onClick={() => setOpen(true)}>
            What is behind-the-meter?
          </button>
          <button
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="u-sr">{open ? 'Close menu' : 'Open menu'}</span>
            <span className="burger__ln" aria-hidden="true" />
            <span className="burger__ln" aria-hidden="true" />
          </button>
        </nav>
      </header>

      <div className="menu" id={menuId} data-open={open || undefined} inert={!open}>
        <div className="menu__inner">
          <div>
            <p className="eyebrow">Jump to phase</p>
            <ol className="menu__phases">
              {phases.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="menu__phase"
                    aria-current={i === phase ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false)
                      goTo(i)
                    }}
                  >
                    <span className="menu__phaseNum">{String(i + 1).padStart(2, '0')}</span>
                    {p.short}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="menu__note">
            <p className="eyebrow">What is behind-the-meter?</p>
            <p>
              Generation sited on the same parcel as the load and connected on the customer side of
              the utility meter. Power reaches the halls without waiting in the interconnection
              queue — which is why the energy plant and the buildings are built as one project, on
              one schedule.
            </p>
          </div>
        </div>
        {/* Mouse convenience only — Escape and the hamburger are the real controls. */}
        <div className="menu__scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      </div>
    </>
  )
}
