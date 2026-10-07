import { useEffect, useState } from 'react'
import { PhaseProvider, usePhase } from './PhaseProvider'
import { phases } from './phases'
import { TopBar } from './components/TopBar'
import { Diorama } from './components/Diorama'
import { PinLayer } from './components/Annotations'
import { CaptionPanel } from './components/CaptionPanel'
import { ScrollCTA, ScrollHint } from './components/ScrollChrome'

export function App() {
  return (
    <PhaseProvider>
      <Shell />
    </PhaseProvider>
  )
}

function Shell() {
  const { phase, sections } = usePhase()
  const [selected, setSelected] = useState<string | null>(null)

  // A pin selected in one phase means nothing in the next.
  useEffect(() => setSelected(null), [phase])

  return (
    <>
      <a className="skip" href="#story">
        Skip to phase detail
      </a>

      <TopBar />

      <div className="stage" id="top">
        <Diorama />
        <PinLayer phase={phase} selected={selected} onSelect={setSelected} />
      </div>

      <main id="story" tabIndex={-1}>
        <div className="hero" data-on={phase === 0 || undefined} inert={phase !== 0}>
          <p className="eyebrow">Site 04 — Permian Basin, TX</p>
          <h1 className="hero__title">
            Powered land,
            <br />
            built as one project.
          </h1>
          <p className="hero__sub">
            460 MW of behind-the-meter generation and 1.2 million sq ft of data hall, delivered on a
            single schedule by a single team.
          </p>
        </div>

        <CaptionPanel phase={phase} selected={selected} onSelect={setSelected} />

        {/* Pure scroll length — the timeline the phase controller reads. */}
        <div className="story" aria-hidden="true">
          {phases.map((p, i) => (
            <div
              key={p.id}
              className="story__step"
              ref={(el) => {
                sections.current[i] = el
              }}
            />
          ))}
        </div>
      </main>

      <ScrollHint phase={phase} />
      <ScrollCTA />
    </>
  )
}
