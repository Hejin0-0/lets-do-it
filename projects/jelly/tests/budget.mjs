// A wall-clock limit, for the checks that keep a simulation cheap. CI runs on machines of unknown speed, so
// there a limit is four times as long; locally it is twice as long, since node --test runs the test files side by
// side and a step's wall clock depends on what else is running. Still a catch for a step that got ten times slower,
// never a flaky red.
export const budget = (ms) => (process.env.CI ? 4 : 2) * ms
