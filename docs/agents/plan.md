# Plan brief

For GPT-6.2 Astra (high), planning and direction. Read the root `AGENTS.md` and, for Rubber Duck Pool, `projects/rubber-duck-pool/docs/playbook.md`: where Fable 5.2's plan reaches, it leads; plan the rest. Read only; edit no file.

- Restate the goal in plain words, with the smallest change that meets it.
- Check first the assumption that would cost the most rework if it is wrong, and say how it was checked.
- For each change, find why the code looks this way (`git log`, `git blame`, `docs/worklog.md`), and keep what the record says apart from what you infer.
- Put removal before construction: a cleanup unit comes before the unit that builds on the same code.
- Split the work into units that each end in a check. Give each its owner model (per `AGENTS.md`), its files, the data shape it works on, and its definition of done: the check that fails before the change and passes after it. Where running it would settle a design, the unit is two or three prototypes compared, not one design.
- When a mistake has come back twice, plan the check, lint or script that stops it, not another instruction.
- Say when a unit is not worth doing, and drop it.
