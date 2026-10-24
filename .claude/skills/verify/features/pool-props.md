# Pool props

The hourglass (its sand runs a minute, then it turns itself over) and the radio answer a click on them. Each click on the radio turns its dial: Lido FM, Low Tide, Surf Hour, off (src/pool/radio.js).

## Sub-features

- click the hourglass: it turns over; click the radio: the next station (`state().station`). It plays only with sound on, the hook's `sound(true)` until the page has controls.

## How to get to it (user POV)

- Click the hourglass at the front right of the courtyard or the red radio by the pool.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-props.js)"`. The script clicks the canvas at `__pool.toPx(__pool.spots().radio)` and `.hourglass`. Proof: `dial` reads Lido FM, Low Tide, Surf Hour, off; `turning: true`.

## Gotchas

- The sound itself is not verifiable headless (`--mute-audio`); the proof stops at the state.
