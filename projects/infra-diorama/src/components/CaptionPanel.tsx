import { phases } from '../phases'
import { Legend } from './Annotations'

/**
 * Every caption stays in the DOM in reading order and cross-fades — real text,
 * indexable, and never baked into an image. Inactive ones are inert so they
 * are skipped by the tab order and by screen readers.
 */
export function CaptionPanel({
  phase,
  selected,
  onSelect,
}: {
  phase: number
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="caption">
      {phases.map((p, i) => (
        <article key={p.id} className="caption__card" data-on={i === phase || undefined} inert={i !== phase}>
          <p className="eyebrow">
            Phase {String(i + 1).padStart(2, '0')}
            <span className="eyebrow__dim"> / {String(phases.length).padStart(2, '0')}</span>
          </p>
          <h2 className="caption__title">{p.title}</h2>
          <p className="caption__body">{p.caption}</p>
          <Legend pins={p.pins} selected={selected} onSelect={onSelect} />
        </article>
      ))}
    </div>
  )
}
