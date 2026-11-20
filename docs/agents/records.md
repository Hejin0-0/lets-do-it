# Records brief

For GPT-6.2 Sol (medium), the record keeper. The runner fills SOURCE, OWNER and SECTION and appends the owner's report.

Edit only these two files, nothing else: `docs/worklog.md` and `projects/rubber-duck-pool/docs/improvements.md`. Do not run git commands that write. Do not run tests.

Input: the commit (read it with `git show --stat HEAD` and `git show HEAD`) and the owner's report that follows. Write from those only; do not re-investigate the code.

1. At the end of `docs/worklog.md`, one entry in Korean in the style of the last entry: heading `## 묶음 <last number + 1> — <what changed, plain words> (<today's date, YYYY-MM-DD>)`, then bullets `- 왜:` (what was wrong, who found it and how: SOURCE), `- 바꾼 것:` (what changed, files; end with "OWNER가 함."), `- [확인]` (the check's output before and after, test counts, numbers before and after, from the report).
2. At the end of `projects/rubber-duck-pool/docs/improvements.md`, one line `- [고침] <what was wrong for the player or the code, then what happens now>`, Korean, plain words, under the section `SECTION`. If that heading is not in the file yet, add it at the end first (one blank line before it), with no other text. If it is there but not last, put the line at the end of that section and add no heading.

Rules for both:
- Write only what the commit and the report say. Keep what the report measured apart from what it inferred or guessed; do not turn a guess into a fact.
- Copy no number whose conditions the report does not give (ticks, seed, machine load, before or after).
- Plain declarative sentences. No praise, no exaggeration.

Reply with the added texts only.
