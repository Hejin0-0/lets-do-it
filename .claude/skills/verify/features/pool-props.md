# Pool props

The hourglass (its sand runs a minute, then it turns itself over) and the radio (its own tune) answer a click on them, and the panel's two buttons do the same.

## Sub-features

- click the hourglass: it turns over; click the radio: on, and a toast asks for Sound when it is off; `#glassBtn`, `#radioBtn`.

## How to get to it (user POV)

- Click the hourglass at the front right of the courtyard or the red radio by the pool.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-props.js)"`. The script clicks the canvas at `__pool.toPx(__pool.spots().radio)` and `.hourglass`. Proof: `radio: true`, `turning: true`, the toast text.

## Gotchas

- The sound itself is not verifiable headless (`--mute-audio`); the proof stops at the state and the toast.
