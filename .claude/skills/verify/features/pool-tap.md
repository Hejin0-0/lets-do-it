# Pool tap

Each of the twelve designs answers a tap in its own way (src/pool/ducks.js DESIGNS: voice, fx, hop): it hops and
spins, says something in its own synthesised voice (sound.js: a squeak, bubbles, a boing, a trill, a zap, a moo, a
kiss, a twinkle, a roar, a chime, a fanfare, a rainbow glissando) and throws off a burst of its own shapes (fx.js and
the renderer's fx layer: drops, bubbles, hearts, stars, petals, bolts, in its colours). No two ducks sound alike:
each speaks at its own pitch and pace, some with a wobble (sound.js `voiceOf(id)`), and as it arrives calls three
notes of its own on a wave of its own before its design's voice. A press that moves is still a pick-up and throw;
held, a float or the swan loses its air (flat in four seconds, hissing) and fills again in 45 once let go. The
first press on the page wakes the sound.

## Sub-features

- a quick press (under 300 ms, under 6 px of travel) on a duck: `world.hand.tap`; the hook's `tap(i)` does the same; `fx()` counts the sprites in the air.

## How to get to it (user POV)

- Click or touch a duck and let go at once.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-tap.js)"`. The script frames the first duck, presses and lets go on it, then drags it. Proof: `burst` above 0 and the duck `picked`; then `held` and `moved` over 0.05.

## Gotchas

- The sound itself is not verifiable headless; the node tests check the voice event (its design's voice, its duck's id), that twelve ducks have twelve voices, and that a burst is gone within three seconds.
- For a look at all twelve bursts, line the ducks up (their colour 0 to 11), pause, tap each by the hook and render a few frames: `.verify/fx-lineup.png`.
