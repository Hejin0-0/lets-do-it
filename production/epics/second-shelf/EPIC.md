# Epic: The Second Shelf

> **Status**: Complete
> **Layer**: Feature
> **GDD**: `design/game-brief.md`

## Goal

첫 도감 여섯 쪽을 다 채운 뒤에도 앉아 있을 이유가 남게 한다. 여섯을 다 찾으면 두 번째 선반(병 속 배 셋, 섬 셋)이 열리고, 그다음 방문부터 새 여섯이 같은 방식으로 떠온다.

## Scope

- Six new collectibles, each with its own model in the same family as the first six (Terra's Blender generator, then `npm run assets:lookdev`).
- The catalogue grows to two shelves. A visit picks only from the first shelf with a missing page, so the first book stays six pages until it is full (the user's 2026-11-01 decision holds for the first shelf).
- The book shows the second shelf's pages only once the first shelf is full; a line says the next shelf is open. Every found item can be summoned into the pool.
- No fail state, timer, score or currency. Visual design and phone stay on hold. Page text English.
- Provisional for the user: the six items, the reveal line and that the second shelf waits for the first.

## Build Order

1. Six new models (risk: they must read at game size and match the first six).
2. The second shelf in the catalogue, the visit pick, the book and summoning.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | [Six more models](story-001-six-more-models.md) | Visual/Feel | Complete | N/A (minimal — no ADRs) |
| 002 | [Open the second shelf](story-002-open-second-shelf.md) | Integration | Complete | N/A (minimal — no ADRs) |
