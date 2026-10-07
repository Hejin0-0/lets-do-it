# Ink & Iron — 최종 개선 스펙: AAA급 역사 시뮬레이션

> 작성 2026-10-06. 실질 작업은 다음 세션. 이 문서는 **무엇을, 어떤 순서로, 어떤 스킬로, 무엇을 기준으로 끝낼지**를 고정한다.
> 근거: 블라인드 A/B 심사 22회(Sonnet 5 ×2, 순서 교차), 셀프플레이 게이트, 지정 스킬 3종 검토
> (`pstack-cursor`, `dream-loop`, `06-game-ai/threejs-game-skills` · `Claude-Code-Game-Studios`).

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 목표 | "해리포터 도서관 + 누구나 해보고 싶은 WW1 보드" → **실제 역사를 뼈대로 한 대체역사 캠페인을 가진 AAA급 역사 시뮬레이션** |
| 현재 위치 | 블라인드 A/B 절대 점수 **~76** (심사 기준 "아주 좋은 취미 프로젝트 = 70"). 최신 AE 빌드: 74/76 |
| 성공 기준 | ① 블라인드 A/B **≥ 85** ② AAA 시각 스코어카드 **Showcase**(평균 ≥ 2.7, 3점 6개+) ③ 셀프플레이 게이트 전부 녹색 또는 문서화된 편차 ④ 역사 서술 100% 출처 표기 |
| 방식 | pstack `architect`로 설계를 두 번 그리고(Design it twice) → `threejs-game-director`가 전문 스킬로 배분 → `dream-loop`으로 시각 목표 이미지에 수렴 → CCGS 에이전트로 역사·내러티브·밸런스 검토 → A/B 판정으로 채택 |
| 첫 단계 | §6.1 "세션 시작 체크리스트" 그대로 실행 |

---

## 1. 현재 상태 (Baseline)

### 1.1 점수 추이 (블라인드 A/B, 두 심사 평균)
| 단계 | 핵심 변경 | 결과 |
|---|---|---|
| P→R | 카메라 1.68 m, 검은 화면 NaN 버그, 피킹 레이마칭 | 69.5 → 75 |
| R→T | 러너 카펫, 예고 태그 우상단, yaw 프레이밍 | 72 → 75.5 |
| V→W | 도입부: 빛기둥, 홀 구도 9.2 m, 좌측 제목 페이지 | 71 → 76 |
| Y→Z | 사기 숫자 플레어, 태블릿 하단 배너 | 73.5 → 77 |
| AC→AD | **대체역사 캠페인**(브리핑·역사 대조·시간표) | 70 → **76.5** (H축 확신 5/5) |
| AD→AE | 제목 위계, 장 표시, 보고서 한 줄 | 73 → 75 |

> 해석: 미세 다듬기는 75~77에서 포화. **85+는 "구조적" 도약**(애니메이션·VFX·AI 교리·역사 레이어·씬 밀도)이 필요하다.

### 1.2 강점 (심사가 반복 인정)
- 고딕 도서관 홀(창·샹들리에·떠다니는 촛불·벽난로), 첫인상 G축 우세
- 디오라마 슬래브(단층 단면, 도로, 철도, 마을), 레드잉크 예고 체계, 예보 태그
- 대체역사 캠페인(실제 1917 vs 당신의 전쟁) — H축 결정적 우위

### 1.3 약점 (22회 심사 누적 지적 → 백로그 출처)
| 빈도 | 지적 | 백로그 |
|---|---|---|
| ★★★ | 보드가 "평평한 탁상" — 참호 깊이·모래주머니·무인지대 조명 부족 | V-03, V-04 |
| ★★★ | 적 턴 피드백이 "작은 −2 하나" — 무엇이 누구를 쳤는지 | V-06, U-04 |
| ★★★ | 말(미니어처)이 정적·작음, 모래색 지형에 묻힘 | V-05, V-07 |
| ★★ | 역사가 보고서에만 — 보드 위에서 보이지 않음 | H-05, H-06 |
| ★★ | 태블릿 하단 바 비좁음, 터치 타깃 | U-06 |
| ★★ | 예고 태그에 수치(기대 손실·엄폐·확률) 없음 | U-03 |
| ★★ | 테이블 나뭇결 모아레, 주변 테이블 공백 | V-08 |
| ★ | 방에 움직임(연기·불빛·카메라 푸시인) | V-09 |
| 셀프플레이 | S1 장군 사다리 66%(30–55), S2 무손실 승리(38%), S3 수동방어가 Veteran 격파 | S-01~S-04 |

### 1.4 현재 수치
- 렌더: S1 120 draw calls / 663k tris, S2 120 / 751k (예산 ≤130 / ≤900k)
- 테스트: rules 33/33, e2e 5/5(봇 플레이테스트 포함), 피킹 117×3 (4개 해상도)
- 단일 파일 빌드 ~1.0 MB (`dist/war-library.html`)

---

## 2. 비전과 기둥 (Pillars)

1. **손에 쥐는 역사 (History you can hold)** — 모든 장은 실제 날짜·장소·부대에서 시작하고, 사실은 출처와 함께 말한다. 대체역사는 *플레이어의 결과*로만 갈라진다.
2. **마법의 작전 테이블 (The enchanted war-table)** — 주석 미니어처와 디오라마가 살아 움직인다. 도서관은 무대이자 기록 보관소.
3. **읽히는 깊이 (Readable depth)** — 레드잉크·사격 부채꼴·예보 태그로 모든 규칙이 보인다. 숨은 주사위 없음.
4. **기억하는 캠페인 (A campaign that remembers)** — 결과가 다음 전투의 조건·서사·지도를 바꾼다.
5. **장인정신의 마감 (Crafted finish)** — 60 fps, 접근성, 한국어/영어, 모바일까지.

---

## 3. 성공 기준 (Exit criteria — 측정 가능)

| # | 기준 | 측정 방법 |
|---|---|---|
| E1 | 블라인드 A/B 절대 점수 ≥ 85 (두 심사 평균) | 기존 하네스 `cap.sh`+`cap2.sh`(11장) + `ink-iron-ab-judge` 워크플로 |
| E2 | AAA 시각 스코어카드 Showcase | `threejs-aaa-graphics-builder/references/visual-scorecard.md` 10항목, 평균 ≥ 2.7, 3점 ≥ 6개, 자동 실패 0 |
| E3 | 캔버스 지표 | `inspect-threejs-canvas.mjs`: colorEntropy ≥ 3.0, edgeDensity ≥ 0.04, contrast ≥ 60 |
| E4 | 밸런스 | `npm run selfplay` 3개 시나리오 전 게이트 녹색 (또는 문서화된 편차 ≤ 1개/시나리오) |
| E5 | 역사 | 게임 내 사실 진술 100%가 `docs/history/FACTS.md`의 출처 행과 연결 |
| E6 | 성능 | 데스크톱 60 fps(1280×720), 모바일 30 fps; ≤130 draw calls; ≤900k tris |
| E7 | 품질 | rules·e2e 전부 통과 + 캠페인 e2e 추가, 시각 회귀(A/B 캡처) 무손실 |

---

## 4. 스킬·에이전트 매핑

### 4.1 pstack (`777-no-update/pstack-cursor`)
| 스킬 | 쓰는 곳 |
|---|---|
| `architect` | 대형 기능(AI 교리, 캠페인 메타, 애니메이션 시스템)마다: Ground → Sketch(**설계안 2개 이상**) → `design-red-flags.md` 검사 → 구현 |
| `interrogate` / `figure-it-out` | 착수 전 요구사항 심문, 불확실 지점 해소 |
| `principle-experience-first` | 모든 백로그 항목의 수용 기준은 "플레이어가 보고 느끼는 것"으로 작성 |
| `principle-model-the-domain` | 역사 도메인 모델(장·사건·부대·인물·출처) 설계 |
| `principle-sequence-verifiable-units` | §6 실행 순서 = 검증 가능한 단위의 연쇄 |
| `principle-prove-it-works` / `benchmark-checklist` | 매 단위 끝에 캡처·지표·테스트 증거 |
| `poteto-mode` → hillclimb 플레이북 | 점수/지표 단일 목표 등반(가설 → 전후 측정 → 채택) — A/B 루프와 동일 철학 |
| `technical-writing` | 코덱스·브리핑 문안, 문서 |

### 4.2 dream-loop (`00-inbox/dream-loop`)
- **목표 이미지 = 현재 스크린샷을 입력으로 한 "정제판"** 생성(새 디자인이 아니라 개선). 프롬프트에 "concept art" 금지, *실제 인게임 스크린샷*으로.
- 대상 3장: ① 제목 홀 ② 사령관 시점 전투 한복판(포격 순간) ③ 태블릿 세로.
- Plus 워크플로: 서브에이전트 패스 → 내가 검증(방향·스케일 오류 수정) → 스크린샷 → **3회** 후 사용자 리뷰.
- `.dream-loop/` 폴더 사용(gitignore).
- **선행조건: 이미지 생성 API**(예: fal — `references/fal.md`). 없으면 사용자가 목표 이미지 제공. → §7 결정 사항.

### 4.3 threejs-game-skills (`06-game-ai/threejs-game-skills`)
| 스킬 | 워크스트림 |
|---|---|
| `threejs-game-director` | 총괄 라우팅, `artifacts/game-progress.md` 유지 |
| `threejs-gameplay-systems` | 게임 감각(feel), 카메라 연출, 입력 |
| `threejs-aaa-graphics-builder` | 재질·조명·VFX·렌더 예산, **10항목 스코어카드** |
| `threejs-game-ui-designer` | HUD 위계, 반응형/터치 |
| `threejs-debug-profiler` | 프레임 예산, 모바일 |
| `threejs-qa-release` | 캔버스 인스펙터, 봇 플레이테스트, 릴리스 |
| `threejs-3d-generator` / `image-generator` / `audio-generator` | 자산 생성(키 있을 때만, `probe_asset_credentials.sh`로 확인) |

### 4.4 Claude-Code-Game-Studios (`06-game-ai/Claude-Code-Game-Studios/.claude`)
| 에이전트 | 역할 |
|---|---|
| `creative-director` | 기둥(§2) 수호, 범위 결정 |
| `narrative-director`, `writer`, `world-builder` | 캠페인 서사, 브리핑·편지·일지, 대체역사 분기 |
| `game-designer`, `systems-designer`, `economy-designer` | 캠페인 메타(보급·사기·연속 결과), 규칙 |
| `ai-programmer` | AI 교리 개편(S-01~04) |
| `level-designer` | 신규 장(시나리오) 지도·목표 |
| `art-director`, `technical-artist` | 아트 바이블, 재질·셰이더 |
| `audio-director`, `sound-designer` | 시대 음향, 음악 |
| `ux-designer`, `accessibility-specialist`, `localization-lead` | HUD·접근성·한국어 |
| `qa-lead`, `performance-analyst`, `producer` | 게이트·성능·일정 |

스킬: `brainstorm`, `map-systems`, `design-review`, `balance-check`, `art-bible`, `asset-spec`, `vertical-slice`, `create-epics`, `create-stories`, `sprint-plan`, `gate-check`, `playtest-report`, `team-narrative`, `team-polish`, `team-qa`, `localize`.

---

## 5. 백로그 (리스트업)

우선순위: **P0** 85점 도달에 필수 · **P1** AAA 품질 · **P2** 확장. 규모: S(≤반나절) M(1일) L(2일+).

### WS-H 역사·내러티브
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| H-01 | **사실 장부** `docs/history/FACTS.md`: 진술 1건 = 출처 1행(URL, 접근일). 게임 문구는 ID로 참조 | P0 | S | narrative-director, `technical-writing` | 게임 내 모든 사실 문장에 FACTS ID; 검증 안 된 문장 0 |
| H-02 | **캠페인 확장 1917→1918** (아래 연표 후보, 검증 후 확정) 3장 → 6~7장 | P1 | L | world-builder, level-designer, `architect` | 장마다 실제 사건·날짜·출처, 신규 시나리오 셀프플레이 게이트 통과 |
| H-03 | **분기 서사 엔진**: 결과 변수(교두보·Hush·수문·…) → 장별 조건·문구·지도 변화, 에필로그 8종+ | P0 | M | systems-designer, writer, `principle-model-the-domain` | 결과 조합별 에필로그가 다르고, 다음 장의 지도/병력이 바뀜 |
| H-04 | **역사 vs 당신의 전쟁 타임라인 화면**: 캠페인 종료 시 두 줄 연표 | P1 | M | ux-designer, writer | 실제 연표와 플레이어 연표가 나란히, 분기 지점 강조 |
| H-05 | **보드 위의 역사**: 장 시작 시 시대 지도/사진풍 카드가 테이블에 놓임, 라운드 시간표 유지 | P0 | M | art-director, `threejs-image-generator`(키 有) | 플레이 화면 캡처에서 역사 맥락이 보임(심사 H/G축) |
| H-06 | **편지·전보·일지** 서사 조각(가상 인물은 *가상* 표기): 라운드 사이 짧은 텍스트 | P1 | M | writer | 장당 3~5편, 실존 인물 왜곡 없음 |
| H-07 | **코덱스(포켓북 탭)**: 부대·장소·인물·용어, 출처 링크 | P1 | M | world-builder, ui-programmer | 20항목+, 출처 100% |
| H-08 | 역사 검수 게이트 `gate-check`: 신규 문구는 FACTS 대조 후 머지 | P0 | S | qa-lead | 자동 체크 스크립트(문구 ID ↔ FACTS) |

**연표 후보 (H-02, 다음 세션에 출처 재검증 필수)**
| 날짜 | 사건 | 상태 |
|---|---|---|
| 1914-10-29 | 간제포트 수문 개방(헤라르트) — 이저 범람 | ✅ 검증 |
| 1917-06-20 | 영국군이 니우포르트 교두보 인수 | ✅ 검증 |
| 1917-07-10 | Strandfest(해병군단, 머스터드 가스 첫 사용) | ✅ 검증 |
| 1917-10-14 | Operation Hush 취소 | ✅ 검증 |
| 1915–18 | 딕스뮈더 '죽음의 참호(Dodengang)' 벨기에 진지 | ⚠ 재검증 |
| 1918-04-17 | 메르켐 전투(벨기에군 방어 성공) | ⚠ 재검증 |
| 1918-04-23 / 05-10 | 제브뤼헤·오스텐더 습격(해군) | ⚠ 재검증 |
| 1918-09-28 | 플랑드르 공세(벨기에 국왕 지휘 집단군) | ⚠ 재검증 |
| 1918-10-17 | 벨기에군 오스텐더 입성 | ✅ 검증 |

### WS-S 시뮬레이션·AI
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| S-01 | **공격 교리 AI**: 제압 사격 → 돌격(사격과 기동), 탄막 뒤 따라붙기. "원거리 포격만" 탈피 | P0 | L | ai-programmer, `architect`(2안 비교) | S2 bothBleed ≥ 0.9, ladderGeneral 30–55% 유지 |
| S-02 | **방어 교리 AI**: 접근로 사전 포격(레드잉크 길목 차단), 예비대 역습 | P0 | M | ai-programmer | S3 dodgerVeteran ≥ 0.4, 회피형 봇 무력화 |
| S-03 | 난이도 = 교리 품질(탐색 깊이만이 아님): Recruit/Veteran/General 행동 차이 문서화 | P1 | M | game-designer, `balance-check` | 사다리 게이트 3개 시나리오 녹색 |
| S-04 | **보급·HE 재보급**(메모 미완 항목), 캠페인 간 자원 이월 | P1 | M | economy-designer | 캠페인 보정이 ±1 이상의 의미 있는 선택을 만듦 |
| S-05 | 시야/관측(선택): 관측 밖 적은 위치만 추정 표시 | P2 | L | systems-designer | 규칙 테스트 + 레드잉크와 충돌 없음 |
| S-06 | 시간대·날씨가 사거리/관측에 영향(라운드 시간표와 연동) | P2 | M | systems-designer | 황혼 라운드 시야 감소가 예보 태그에 표시 |
| S-07 | 셀프플레이 게이트 확장: 캠페인 이월 조합별 승률 | P1 | S | qa-lead | 이월 극단값에서도 승률 15–85% |

### WS-V 비주얼 (dream-loop + 스코어카드)
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| V-01 | **스코어카드 기준선**: 10항목 전/후 점수 + 캔버스 지표 | P0 | S | `threejs-aaa-graphics-builder`, `threejs-qa-release` | 표 1장(현재 추정 평균 ~2.0) |
| V-02 | **dream-loop 목표 이미지 3장**(제목 홀·포격 순간·태블릿) 생성 → 3회 루프 | P0 | L | `dream-loop` Plus, `threejs-image-generator` | 목표 대비 차이 리포트, 사용자 리뷰 |
| V-03 | **참호 디오라마 심화**: 깊이 있는 참호(단면 보이는 벽체), 모래주머니, 방어벽, 대피호 입구 | P0 | L | technical-artist, `threejs-3d-generator` | 사령관 시점에서 참호가 "파인 것"으로 읽힘 (심사 ★★★) |
| V-04 | **무인지대 조명·질감**: 진흙 물웅덩이 반사, 조명탄(야간 라운드), 연막 | P0 | M | `threejs-aaa-graphics-builder` | Lighting/World 항목 3점 |
| V-05 | **미니어처 애니메이션**: 대기 흔들림, 행군, 사격 반동, 사상자 쓰러짐, 깃발 | P0 | L | `threejs-3d-generator`, gameplay-programmer | 정지 캡처에서도 자세 다양성; 영상에서 동작 |
| V-06 | **전투 VFX 개편**: 포탄 낙하 궤적→섬광→흙기둥→잔해, 기관총 예광 스트림, 가스 체적 구름 | P0 | M | `threejs-aaa-graphics-builder` | VFX 항목 3점, 4-bell 캡처에서 "명확한 타격" |
| V-07 | 말 가독성: 진영 실루엣 차별, 림라이트·받침 대비(지형 위 분리) | P1 | S | art-director | 모래톱 위 영국군 식별 (심사 ★★★) |
| V-08 | 테이블 재질: 나뭇결 모아레 해소(밉맵/이방성/주파수), 소품 2~3종 추가 | P1 | S | technical-artist | 6-yawed 캡처 줄무늬 지적 0 |
| V-09 | **방의 생동감**: 연기·먼지·벽난로 빛 일렁임, 제목 화면 미세 카메라 드리프트 | P1 | M | `threejs-gameplay-systems` | 제목 캡처 G축 개선 |
| V-10 | **시네마틱 연출**: 돌격·점령 시 카메라 컷, 사진 모드 | P2 | M | `threejs-gameplay-systems` | 연출 중 입력 차단 없음, 감소 모션 준수 |
| V-11 | 아트 바이블 `art-bible`: 팔레트·재질 역할·조명 규칙 문서화 | P1 | S | art-director | 신규 자산이 바이블 준수 |

### WS-U UX/UI·접근성·현지화
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| U-01 | **디자인 시스템**: 종이·황동·밀랍 컴포넌트 정리, 위계 규칙 | P1 | M | `threejs-game-ui-designer`, `design-system` | HUD 컴포넌트 단일 소스 |
| U-02 | **한국어 현지화**(i18n 프레임) + 영어 | P0 | M | localization-lead, `localize` | 전 문구 키화, 한국어 100%, 폰트 확인 |
| U-03 | 예보 태그에 수치(기대 손실·엄폐·확률 막대) | P1 | S | ux-designer | 3-forecast 캡처 지적 해소 |
| U-04 | **적 턴 로그**: 행동별 하이라이트 + 접이식 전투 로그 | P0 | M | ux-designer | 4-bell 캡처에서 "누가 무엇을" 명확 |
| U-05 | 저장/불러오기(전투 중), 캠페인 슬롯 3개 | P1 | M | systems-designer | 새로고침 후 정확히 복원(e2e) |
| U-06 | **태블릿/모바일 레이아웃**: 터치 타깃 ≥ 44px, 하단 바 재배치, 세로 HUD | P1 | M | ux-designer, accessibility-specialist | 7-tablet 지적 0 |
| U-07 | 접근성: 색각 이상 팔레트, 글자 크기, 스크린리더 요약, 키보드 100% | P1 | M | accessibility-specialist | WCAG AA 대비, 키보드 전 기능 |
| U-08 | 온보딩 확장: 캠페인 1장 = 튜토리얼 통합 | P1 | S | game-designer | 첫 플레이어가 도움 없이 1장 완료(봇 시뮬) |

### WS-A 오디오
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| A-01 | 시대 음향: 원근 포성, 호루라기, 기관총, 빗소리, 종 | P1 | M | sound-designer, `threejs-audio-generator` | 이벤트별 고유 큐, 렌더 보이스 검증 |
| A-02 | 음악: 장별 테마(생성 배경음 확장), 긴장도 레이어 | P2 | M | audio-director | 적 턴/위기 레이어 전환 |
| A-03 | 믹싱·덕킹, 음소거/볼륨 슬라이더 | P1 | S | audio-director | 대사/효과 충돌 없음 |

### WS-P 성능·기술·QA
| ID | 항목 | P | 규모 | 스킬·에이전트 | 수용 기준 |
|---|---|---|---|---|---|
| P-01 | 성능 예산 재측정 + 모바일 프로파일 | P0 | S | `threejs-debug-profiler`, performance-analyst | §3 E6 |
| P-02 | 캠페인 e2e(시작→승/패→다음 장→에필로그) | P0 | S | qa-lead | e2e 추가 1건 통과 |
| P-03 | 시각 회귀: A/B 하네스 스크립트화(`cap.sh`/`cap2.sh` 저장소 편입) | P1 | S | `threejs-qa-release` | 원커맨드 캡처 |
| P-04 | 최종 정밀 심사(deep audit) — **푸시 직전 1회** | P0 | M | qa-lead, `gate-check` | 메모의 약속대로 |
| P-05 | 자산 파이프라인(생성 자산의 압축·LOD·라이선스 기록) | P2 | M | technical-artist | 빌드 크기·라이선스 표 |

---

## 6. 실행 순서 (검증 가능한 단위의 연쇄)

### 6.1 세션 시작 체크리스트 (다음 시간 첫 30분)
1. 메모 `war-library-cycle7-resume` 읽기 → 최신 스냅샷 확인(`~/.claude/wip-backups/war-library-20261006-1600.tgz`).
2. `npm run build && npm run test:rules && npx playwright test --project=desktop-chrome` → 녹색 확인.
3. `bash threejs-game-director/scripts/probe_asset_credentials.sh` → 이미지/3D/오디오 생성 키 유무 → V-02·V-03·V-05 경로 결정.
4. **V-01 기준선 스코어카드** + A/B 11장 캡처(현 빌드 = 기준).
5. 사용자 결정 §7 확인.

### 6.2 마일스톤
| 마일스톤 | 범위 | 게이트(통과 조건) |
|---|---|---|
| **M0 기준선** | V-01, P-01, H-01, P-03 | 스코어카드·지표·사실장부 존재 |
| **M1 버티컬 슬라이스: 1장 Strandfest를 AAA로** | V-02(목표 이미지) → V-03·V-04·V-05·V-06 (1장 지도 한정), U-04, H-05 | 1장 캡처 A/B ≥ 82, 스코어카드 평균 ≥ 2.5 |
| **M2 시뮬레이션 깊이** | S-01·S-02(`architect` 2안), S-03, S-07 | 셀프플레이 전 게이트 녹색 |
| **M3 캠페인 확장** | H-02·H-03·H-04·H-06·H-07, S-04 | 6장+, 에필로그 8종+, FACTS 100% |
| **M4 마감** | U-01·U-02·U-03·U-05~08, A-01·A-03, V-07~V-11 | 접근성·한국어·태블릿 지적 0 |
| **M5 릴리스** | P-02, P-04(deep audit), 저장소 정리 후 커밋/푸시 | E1~E7 전부 |

각 단위 = **변경 → 빌드 → rules/e2e → 캡처 → A/B(또는 스코어카드) → 채택/되돌림** (hillclimb). 효과 없는 변경은 되돌리고 메모에 기록(이번 세션의 이동 탄막 상한·받침 외곽선처럼).

### 6.3 토큰 운용
- A/B 1회 ≈ 19~21만 서브에이전트 토큰 → **마일스톤 끝에만** 실행, 중간은 스코어카드·캔버스 지표(저비용).
- dream-loop는 루프 3회 단위로 끊고 사용자 리뷰.
- 셀프플레이는 로컬 실행(토큰 거의 없음) — AI 작업은 이걸로 측정.

---

## 7. 리스크 · 사전 준비 · 결정 필요

| 구분 | 내용 | 제안 |
|---|---|---|
| **결정** | 이미지/3D/오디오 생성 API 키 (dream-loop·자산 생성의 선행조건) | 키 제공 시 V-02/V-03/V-05 생성 경로, 없으면 절차적 + 사용자 제공 레퍼런스 |
| **결정** | 캠페인 범위: 1917만(3장) vs 1917–1918(6~7장) | 1918 확장 권장(서사 완결: 오스텐더 해방까지) |
| **결정** | 한국어 현지화 우선순위 | P0 권장(사용자 언어) |
| **결정** | 사진풍 역사 자료 사용: 퍼블릭 도메인 사진 vs 생성 이미지 | 퍼블릭 도메인(IWM 등 라이선스 확인) 우선, 생성 이미지는 "재현" 표기 |
| 리스크 | AI 교리 개편이 기존 밸런스를 흔듦 | `architect` 2안 + 셀프플레이 게이트로 채택 판단, 시나리오별 롤백 |
| 리스크 | 역사 왜곡·오류 | H-01/H-08 게이트, 실존 인물 대사 창작 금지(가상 인물 표기) |
| 리스크 | 성능(애니메이션·VFX 추가) | 인스턴싱·배칭 유지, 예산 초과 시 기록된 트레이드오프 |
| 리스크 | 단일 파일 빌드 크기(자산 추가) | 자산 예산(≤ 5 MB) 설정, 압축 텍스처 |
| 제약 | 커밋 금지(저장소 정리 완료 전), deep audit는 푸시 직전 1회 | 메모 규칙 유지 |

---

## 부록 A. 심사 하네스
- 캡처: `cap.sh LABEL`(표준 8장) + `cap2.sh LABEL campaign|plain`(포켓북·보고서·라운드 배너 3장)
- 판정: 워크플로 `ink-iron-ab-judge`(11캡처·8축 A–H, Sonnet 5 ×2 순서 교차)
- 기록: 메모 `war-library-cycle7-resume`에 라운드별 결과·되돌린 시도

## 부록 B. 출처 (검증된 사실)
- Operation Hush — https://en.wikipedia.org/wiki/Operation_Hush
- Operations on the Belgian Coast — https://www.longlongtrail.co.uk/battles/battles-of-the-western-front-in-france-and-flanders/operation-hush-including-the-battle-of-the-dunes/
- The Operation Strandfest, July 1917 (IWM) — https://www.iwm.org.uk/collections/item/object/205289190
- Hendrik Geeraert — https://en.wikipedia.org/wiki/Hendrik_Geeraert
- Ganzepoot — https://en.wikipedia.org/wiki/Ganzepoot
- Ostend liberated 17 Oct 1918 — https://www.tumblr.com/today-in-wwi/179213839185/belgians-liberate-bruges-and-zeebrugge

---

## 부록 C. 진행 현황 (2026-10-07 세션 종료 시점)

| ID | 상태 | 비고 |
|---|---|---|
| H-01 사실 장부 | ✅ | `docs/history/FACTS.md` F01–F11, 출처 링크 |
| H-08 역사 게이트 | ✅ | `tests/rules/facts.test.ts` (장별 facts ID ↔ 장부) |
| H-03 분기 에필로그 | ✅ (8종) | `CAMPAIGN.ending(won[])` — 승패 조합별 |
| H-04 두 연표 화면 | ✅ | 에필로그 표 (`Briefing.timeline`) |
| H-05 보드 위의 역사 | ✅ | 지도 파란 연필(S1 실제 독일군 선 / S2 Hush 미실행 공격 / S3 1914 범람지) + 전령 카드 한 줄 설명, 보고서 라운드별 시간 줄 |
| P-02 캠페인 e2e | ✅ | `tests/e2e/campaign.spec.ts` (e2e 6/6) |
| V-06 전투 VFX | ◑ | 화구 스프라이트 + 흙덩이 40개 + 섬광; 기관총 예광 스트림·가스 체적은 남음 |
| V-03 참호 깊이 | ◑ | 17 mm + 그늘진 바닥 도색; 대피호 입구·방어벽 디테일은 남음 |
| V-05 미니어처 생동감 | ◑ | 인물별 무게중심 흔들림(감소 모션 존중); 행군·사격 반동은 남음 |
| E3 캔버스 지표 | ✅ | entropy 6.9 / edge 0.49 / contrast 174 (페이지 내 동일 공식 측정) |
| S-01~S-03 AI 교리 | ✗ | Veteran 탐색 노브는 시나리오 간 게이트를 맞바꿈(기록) → 시나리오별 교리 필요 |
| V-02 dream-loop | ⏸ | 이미지 생성 키 없음(Tripo/Gemini/ElevenLabs MISSING) |
| U-02 한국어 | ⏸ | §7 결정 대기 |

A/B (Sonnet 5 ×2 순서 교차): AF>AE (76/74 ×2) → **AG>AF (77/69, 76/70)** → AH≈AG (74/72 · 77/75, 무승부) → 무승부 지적 2건(한 줄 메모 문구, 보고서 뒤 남은 배너) 수정 완료.
