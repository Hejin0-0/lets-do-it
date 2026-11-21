# Unit brief: code

Appended to every code unit. Read the root `AGENTS.md` first ("Which model does what", "How we write code"); this adds the steps of a unit.

## Every code unit

1. Restate the unit in plain words: the goal, and the smallest change that meets it. If the brief and the code disagree, say so before you change anything.
2. Trace how the code you will touch runs now, and find why it looks this way (`git log -L`, `git blame`, `docs/worklog.md`). Do not delete or change code whose reason you have not found; report it instead.
3. A bug: reproduce it first where it shows (a node script, a drive). No repro, no fix; report what you tried.
4. Before the change, run your check on the old code and keep what it printed. It must fail there for the reason you predicted: quote the values that disagree, not the assertion.
5. Change one thing, check it, then the next.
6. Prove it: `node --test` on the files you touched, then the project's whole `node --test "tests/*.test.mjs"`; for a page, the verify skill's drives (`.claude/skills/verify/SKILL.md`). Never skip a test, add a sleep or retry until it passes.
7. Before you hand back, read your whole diff and delete what-comments, dead code, debug output and any layer only one caller uses.
8. Do not edit `docs/worklog.md` or any `improvements.md` (Sol records them). Run no git command that writes unless the brief says you commit.
9. Report as `AGENTS.md` says: goal, change, proof, basis, what is left.

## Main units (Opus, Neon)

- Name the data shape before the logic. Where state or branches scatter, put the domain in one structure: a table, a state machine, a typed model.
- A shared module (`packages/`) or a new API: write its usage from the caller's side first (a README or a usage block in your report) and build to it.
- A design that running it would settle: build two or three small prototypes and compare them before you choose.

## Side units (Terra, Hydrogen)

- The brief sets the scope. Stay in its files; a problem outside them goes in the report, not the diff.
- If the root cause is wider than the brief, stop and report it rather than patch the symptom.

## Blender units (Terra)

- Build the asset with a script (`tools/create_*.py`) and prove it with another (`tools/check_*.py`), as the existing tools do.
- Look at every render yourself before you report it.
- Working renders, `.blend1` backups and studies go outside the repo; only the final files the brief names go in it.
