import { useCallback } from 'react'
import { allPins, type Pin } from '../phases'

/**
 * Registry of pin nodes, written to by the R3F render loop.
 * ponytail: a module Map beats threading refs through context for a page that
 * has exactly one diorama. If a second scene ever appears, make it a context.
 */
export const pinNodes = new Map<string, HTMLElement>()

type Sel = { selected: string | null; onSelect: (id: string | null) => void }

/** Absolutely-positioned pins, projected onto the canvas box by PinProjector. */
export function PinLayer({ phase, selected, onSelect }: { phase: number } & Sel) {
  return (
    <div className="pins">
      {allPins.map((pin) => (
        <PinMark
          key={pin.id}
          pin={pin}
          active={pin.phase === phase}
          selected={selected === pin.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function PinMark({
  pin,
  active,
  selected,
  onSelect,
}: {
  pin: Pin
  active: boolean
  selected: boolean
} & Pick<Sel, 'onSelect'>) {
  const register = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) pinNodes.set(pin.id, el)
      else pinNodes.delete(pin.id)
    },
    [pin.id],
  )

  return (
    <div
      ref={register}
      className="pin"
      data-side={pin.side}
      data-on={active || undefined}
      data-sel={selected || undefined}
      inert={!active}
    >
      <button
        type="button"
        className="pin__btn"
        aria-pressed={selected}
        onClick={() => onSelect(selected ? null : pin.id)}
      >
        <span className="pin__dot" aria-hidden="true" />
        <span className="pin__leader" aria-hidden="true" />
        <span className="pin__label">{pin.label}</span>
      </button>
    </div>
  )
}

/** Mobile replacement for the pins: same labels, tappable, no overlap. */
export function Legend({ pins, selected, onSelect }: { pins: Pin[] } & Sel) {
  return (
    <ul className="legend">
      {pins.map((pin, i) => (
        <li key={pin.id}>
          <button
            type="button"
            className="legend__item"
            aria-pressed={selected === pin.id}
            onClick={() => onSelect(selected === pin.id ? null : pin.id)}
          >
            <span className="legend__num">{String(i + 1).padStart(2, '0')}</span>
            <span>{pin.label}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
