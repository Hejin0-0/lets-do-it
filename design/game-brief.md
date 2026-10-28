# Game Brief: One Seat, One Day

<!-- The one-page brief (Claude Code Game Studios, rigor: minimal): the whole design doc at this tier.
     Game: projects/rubber-duck-pool. Written 2026-10-28 from /brainstorm with the user; Terra (Codex) surveyed
     the game first (what exists, how sitting works, how a seated UI could be built). Page text is English. -->

**One-sentence pitch:** 풀가의 의자에 앉아 시간과 지켜볼 것을 고르고, 바다를 떠도는 병 속 배와 사물 디오라마를 보트로 건져 도감의 페이지를 하나씩 채우는 조용한 관찰 게임.

## Core loop
- 의자에 앉아 지켜볼 러버덕과 시간을 고른다.
- 풍경과 풀을 지켜보고, 떠 있는 오리를 마우스로 잡아 장난친다.
- 가끔 바다에 병 속 배(Bottle Ship)나 사물 디오라마가 떠오면 보트를 보내 건져 온다.
- 건진 것이 도감의 빈 페이지를 채우고, 일어나 집으로 돌아간다.

## Player goal & fail state — what "working" looks like
- **목표:** 도감의 페이지를 모두 채운다. 페이지 수와 수집품 수가 같은 정해진 목록이라, "새 발견"은 곧 "빈 페이지 하나가 채워짐"이다.
- **실패:** 없다. 한 번의 방문은 새 페이지 하나가 채워지면 완성된 느낌이다. 건지지 못한 병은 다음에 다시 떠온다.

## MVP — what must exist to be the game
1. 앉은 상태와 앉으면 뜨는 메뉴(지켜볼 오리, 시간). 의자 옆 물건 하나와 실제 글자 몇 단어로 만든다(낭독기, 키보드, 터치가 쓰는 진짜 요소).
2. 일어서기.
3. 바다를 떠도는 병 속 배와 사물 디오라마. 정해진 목록이다.
4. 보트를 보내 건지면 도감 페이지가 채워진다. 보트는 기존(`rescue.js`), 대상과 기록은 신규.
5. 도감 뷰: 페이지 넘기기, 빈 페이지와 채운 페이지. 데이터는 기존 `logbook.js`, 화면은 신규.
6. 도감 품목을 풀장에 소환.

그대로 쓰는 기존 기능: 섬, 풀, 오리 순환, 오리 잡기와 던지기, 생물, 낮밤, 도감 저장.

## Out of scope — not building this
- 실패, 타이머, 강제 퀘스트, 점수 경쟁, 화폐, 멀티플레이, 새 지역.
- 레이스와 오리 꾸미기 화면. 로직(`world.js`)은 남지만 이번 메뉴에는 넣지 않는다.
- 보이는 디자인(색, 글꼴, 모양)은 보류한다. 휴대폰은 웹 다음이고, 소리는 사용자 자료로 나중에 바꾼다.

## Build order
1. 앉기, 앉은 상태, 일어서기. 모든 것의 틀이고, 메뉴는 자리만 잡아 둔다.
2. 병 하나가 떠오고, 보트로 건져, 도감 한 페이지가 채워진다. 가장 불확실한 핵심 재미라 먼저 증명한다.
3. 도감 뷰(페이지).
4. 앉은 메뉴에서 지켜볼 오리와 시간 고르기.
5. 수집품 여러 종 채우기와 풀장 소환.

---
**Who it's for / what they feel:** 압박 없이 몇 분 풀가에 앉아 있고 싶은 사람. 느긋함과 작은 호기심.

**Art & audio direction:** 보류(사용자 결정 대기). 소리는 사용자 자료로 교체 예정.

**Reference game:** Neko Atsume. 찾아온 것을 기다렸다가 도감에 모으는 부분만 가져온다. 보여 주는 방식은 사용자가 보여 준 타이틀 화면의 생각, 곧 장면 속 물건 하나와 그 옆의 몇 단어만 가져온다(이름, 글꼴, 그림, 문구는 가져오지 않음).
