# Repository collaboration

- For Rubber Duck Pool environment and prop art, consult `projects/rubber-duck-pool/docs/asset-art-direction.md`. The deck chair is a visual reference, not a requirement to repeat its exact colors or details on every asset.
- When creating or updating a pull request, write a specific title and a meaningful description based on the final changes. Do not leave a branch name as the title or the description empty. Explain the user-visible problem or outcome, summarize the material changes, and report checks run and important limitations. Keep the title and description current if scope changes. Do not claim a check was run when it was not.
- Follow `.github/pull_request_template.md` when it applies, adapting the detail to the change. Creating a PR does not imply permission to merge it.

# Which model does what

The user set these on 2026-11-19. They replace the earlier GPT-only roles. Only the models below are used; GPT-6 Luna, GPT-6.1 Sol, GPT-6.2 Sol High and Gemini Argon are no longer used.

- **Planning and direction: GPT-6.2 Astra (high).** It decides what to do and in what order, splits a plan into units, and writes each unit's scope and definition of done. Check first the assumptions that would cause the most rework if they are wrong. For Rubber Duck Pool, the plan Claude Fable 5.2 wrote in `projects/rubber-duck-pool/docs/playbook.md` (sections 1-4 as Fable set them, commits `988f837`..`72a9f73`) leads wherever it reaches: that work is Fable-led and follows Fable's plan. Where Fable did not plan, follow Astra's plan and trust it. The status others added to the playbook later is a record, not plan.
- **Main implementation: Claude Opus 5.5 (max) and Gemini 4 Neon (high).** They write the large structure: features across several files, structural changes, and changes to shared `packages/`. Opus also directs: it checks diffs, runs `npm run verify`, lands, pushes and reports.
- **Side implementation: GPT-6.1 Terra (max) and Gemini 4 Hydrogen (extra).** Inside the structure the main implementers set, they write small-scope code: one-file cleanups, performance touch-ups and nearby fixes.
- **Assets: GPT-6.1 Terra (max).** 3D modeling and asset rendering in Blender.
- **Tests and records: GPT-6.2 Sol (medium).** It writes the test first, one that fails on the current code; the implementer then makes it pass. After the change it writes the entries in `docs/worklog.md` and the project's `improvements.md`.
- **Review: Opus and Neon review each other's code.** Neither reviews its own.
- **Flow:** Astra plans; Sol writes the failing test; Opus or Neon builds the structure, with Terra or Hydrogen on the side units; Sol records; the other main implementer reviews; Opus verifies, lands and pushes.
- **Delegating.** Name the model, and pass the materials, the question and the definition of done. Do not do the same work twice or delegate it again. If a named model cannot be used, say so and continue the work that can be done.
