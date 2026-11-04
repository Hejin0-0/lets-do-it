# Epic: One Seat, One Day

> **Status**: Ready
> **Layer**: Feature
> **GDD**: `design/game-brief.md`

## Goal

풀가의 의자에 앉아 시간과 지켜볼 것을 고르고, 바다를 떠도는 병 속 배와 사물 디오라마를 보트로 건져 도감의 페이지를 하나씩 채우는 조용한 관찰 게임.

## Scope

- Seated state and accessible menu for duck and hour, with a scene object and real words; stand up.
- Fixed list of bottle ships and object dioramas adrift; retrieve with the existing boat and fill one book page per item.
- Book view with empty and filled pages and page navigation; summon discovered items into the pool.
- No fail state. Existing island, pool, ducks, creatures, day/night and book persistence remain in use. Visual design is deferred, page text English, mobile after web.

## Build Order

1. Sit, seated state and stand; reserve the menu.
2. One bottle, boat retrieval and one filled page.
3. Book page view.
4. Duck and hour choice in the seated menu.
5. More collectibles and summoning into the pool.

Stories 001 and 004 divide feature 1 around the ordered menu shell; Story 001 includes feature 2 so the seated state has an exit. Stories 002 and 005 divide features 3–4 around the first-bottle proof. Story 006 separates summoning from the expanded list so each can be verified independently.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | [Sit and stand](story-001-sit-and-stand.md) | UI | Ready | N/A (minimal — no ADRs) |
| 002 | [Fetch the first bottle](story-002-first-bottle.md) | Integration | Ready | N/A (minimal — no ADRs) |
| 003 | [Browse the book pages](story-003-book-pages.md) | UI | Ready | N/A (minimal — no ADRs) |
| 004 | [Choose a duck and hour while seated](story-004-choose-duck-and-hour.md) | UI | Ready | N/A (minimal — no ADRs) |
| 005 | [Complete the fixed collectible list](story-005-collectible-list.md) | Integration | Ready | N/A (minimal — no ADRs) |
| 006 | [Summon a collected item into the pool](story-006-summon-into-pool.md) | Integration | Ready | N/A (minimal — no ADRs) |
