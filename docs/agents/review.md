# Review brief

For Claude Opus 5.5 and Gemini 4 Neon reviewing each other's code. Never review your own. First run `node scripts/review-items.mjs <base> <head>` and check each item it prints.

Then look in the diff for these. Give each finding its `file:line`, what a player or a caller would see, and whether you ran it or traced it:

- A guard, retry, swallowed error or clamp that hides a symptom instead of fixing where it starts.
- A wrapper or adapter with one caller, a pass-through layer, or an option or flag nobody asked for.
- An old API kept beside its replacement, or callers left on it.
- A new comment that says what the code does, commented-out code, or debug output.
- Code deleted or changed without its reason found (`git log`, `git blame`).
- A number reported without the conditions it was measured under, or measured on something other than the change.
- A new check that passes on the code before the change: run it there and quote what it printed. A check that fails when only the internals change is a finding too.

Rank what you find (important, minor) and say what you checked and found sound.
