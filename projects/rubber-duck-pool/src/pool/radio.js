// The radio's stations: each its own four bars, looping, made once from a fixed seed (no recordings). A walk over
// the station's scale above a bass on its four roots, in eighth notes. The radio turns through them, then off.

/** name, tempo (eighths at bpm / 2 a second), the bass's four roots and the scale the tune walks (semitones from
 * middle C), the seed, how often a step rests, the lead's and the bass's waves, how many eighths a bass note lasts,
 * and whether a hi-hat ticks on the off-beats. */
export const STATIONS = [
  { name: 'Lido FM', bpm: 112, roots: [0, -3, 5, 7], scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21], seed: 7, rest: 0.2, lead: 'square', bass: 'triangle', bassEvery: 2, hat: false },
  { name: 'Low Tide', bpm: 76, roots: [0, 5, -2, 3], scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22], seed: 23, rest: 0.35, lead: 'sine', bass: 'sine', bassEvery: 4, hat: false },
  { name: 'Surf Hour', bpm: 144, roots: [0, 0, 5, 7], scale: [0, 3, 5, 6, 7, 10, 12, 15, 17, 19], seed: 41, rest: 0.12, lead: 'sawtooth', bass: 'square', bassEvery: 1, hat: true },
];

/** A station's 32 eighths: the lead's semitone at each, or null for a rest (always one at the end of a bar). */
export function pattern(st) {
  let r = st.seed, dg = 4;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 32 }, (_, i) => {
    if (i % 8 === 7 || rnd() < st.rest) return null;
    dg = Math.max(0, Math.min(st.scale.length - 1, dg + [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)]));
    return st.scale[dg];
  });
}
