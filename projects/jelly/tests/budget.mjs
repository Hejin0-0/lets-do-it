// A wall-clock limit, for the checks that keep a simulation cheap. CI runs on machines of unknown speed, so
// there a limit is four times as long: still a catch for a step that got ten times slower, never a flaky red.
export const budget = (ms) => (process.env.CI ? 4 : 1) * ms
