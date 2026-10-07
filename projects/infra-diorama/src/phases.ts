/**
 * Single source of truth for the scroll timeline.
 *
 * `pins[].anchor` are model-space coordinates. They are projected to screen
 * space through the diorama group's world matrix every frame, so they stay
 * glued to the geometry through parallax/rotation — and they keep working
 * unchanged if the procedural model is swapped for a glTF built on the same
 * axes (see DioramaModel.tsx).
 */

export type Pin = {
  id: string
  label: string
  anchor: [number, number, number]
  /** Which way the leader line elbows out, so labels stay clear of the model. */
  side: 'left' | 'right'
}

export type Phase = {
  id: string
  /** Shown in the sticky phase pill, e.g. "3 · Construction". */
  short: string
  title: string
  caption: string
  /** Read by screen readers as the description of the 3D scene. */
  alt: string
  pins: Pin[]
}

export const phases: Phase[] = [
  {
    id: 'site',
    short: 'Site Prep',
    title: 'Bare graded lot',
    caption:
      'Secure the parcel, complete mass grading, and hold queue position. Everything downstream is priced off decisions made on empty ground.',
    alt: 'Isometric scale model of a bare graded industrial lot: a flat earth pad with perimeter berms, a gravel access road, survey stakes and a single excavator.',
    pins: [
      { id: 'grading', label: 'Site Grading', anchor: [-1.2, 0.5, 2.4], side: 'right' },
      { id: 'queue', label: 'Interconnection Study', anchor: [-5.6, 0.6, -0.5], side: 'left' },
    ],
  },
  {
    id: 'foundations',
    short: 'Foundations',
    title: 'Foundations and delivery',
    caption:
      'Coordinate interconnection, track timelines, and manage delivery of major equipment. Long-lead transformers land before the slabs cure.',
    alt: 'The same site with poured concrete foundation slabs, pier caps, a laydown yard of crates and skid-mounted transformers, and delivery trucks on the access road.',
    pins: [
      { id: 'delivery', label: 'Equipment Delivery', anchor: [3.4, 1.5, 5.4], side: 'right' },
      { id: 'pours', label: 'Foundation Pours', anchor: [-2.0, 0.5, -1.5], side: 'left' },
    ],
  },
  {
    id: 'construction',
    short: 'Construction',
    title: 'Steel goes vertical',
    caption:
      'Two data halls rise at once. Crane sequencing, trade stacking and shell completion run against a single live schedule.',
    alt: 'Structural steel frames for two long data halls stand on the slabs, flanked by two tower cranes and a staging area.',
    pins: [
      { id: 'halls', label: 'Data Hall Construction', anchor: [-2.0, 4.0, -1.5], side: 'left' },
      { id: 'cranes', label: 'Crane Sequencing', anchor: [4.0, 8.2, -6.6], side: 'right' },
    ],
  },
  {
    id: 'enclosure',
    short: 'Enclosure',
    title: 'Enclosed and energised',
    caption:
      'Buildings are clad and the energy backbone lands — substation, gas lateral and thermal plant brought to mechanical completion.',
    alt: 'The data halls are now clad volumes with rooftop cooling units, beside an energised substation, a pipe rack and two vertical gas tanks.',
    pins: [
      { id: 'envelope', label: 'Building Enclosure', anchor: [4.0, 3.5, -1.5], side: 'right' },
      { id: 'gas', label: 'Natural Gas Infrastructure', anchor: [-6.2, 3.6, 6.7], side: 'left' },
      { id: 'sub', label: 'Substation Energisation', anchor: [-5.7, 1.9, 0.8], side: 'left' },
    ],
  },
  {
    id: 'operational',
    short: 'Operational',
    title: 'Operational facility',
    caption:
      'Commissioned and handed over. Continuous telemetry across power, water and thermal systems from the first megawatt.',
    alt: 'The finished campus: clad and lit data halls, a filled water reservoir, two exhaust stacks, parking and perimeter lighting.',
    pins: [
      { id: 'water', label: 'Water Reservoir', anchor: [3.5, 0.4, 5.4], side: 'right' },
      { id: 'stacks', label: 'Exhaust Stacks', anchor: [6.9, 7.0, -2.1], side: 'right' },
      { id: 'handover', label: 'Operational Handover', anchor: [-2.0, 3.6, -1.5], side: 'left' },
    ],
  },
]

export const allPins = phases.flatMap((p, i) => p.pins.map((pin) => ({ ...pin, phase: i })))
