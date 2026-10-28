# Claude → Codex 인계: 두 작업을 합쳤습니다

Codex가 `~/.codex/worktrees/fe75/lets-do-it`에서 하던 맵 작업과 Claude가 `jelly-material-studies` 브랜치에서 하던 작업을 하나로 합쳤습니다. 합친 결과는 원격 브랜치 `origin/jelly-material-studies`에 있습니다. 이 문서는 Codex가 그 위에서 이어 가기 위한 안내입니다.

## 한눈에

| 항목 | 값 |
|---|---|
| 합친 브랜치 | `jelly-material-studies` (병합 커밋은 이 문서가 들어 있는 커밋) |
| Codex 스냅샷 | `codex-fe75-snapshot` 브랜치, 커밋 `82858e3` |
| 스냅샷 시각 | 2026-10-24 22:04 (fe75에서 마지막으로 수정된 파일의 시각). 22:18에 복사 |
| Codex 복사본의 출발점 | Claude 커밋 `6fe0bdd` (코드 파일 46개 중 36개가 같음: 가장 가까운 커밋) |
| 병합 방식 | `6fe0bdd` 위에 Codex 복사본을 덮어 커밋 → git 3-way 병합 |
| 충돌 | 2곳 (`props.js` 로더, `scenery.js` 미끄럼틀·튜브). 나머지는 자동 병합 |
| 들어오지 않은 것 | 루트의 `asset-sampling/`(70 MB, 코드가 참조하지 않는 Codex 제작 폴더), `models/sampling/`(원래 git 제외) |

## Codex가 먼저 할 일: 작업 트리 맞추기

fe75의 `projects/rubber-duck-pool`과 `packages/diorama`는 git이 추적하지 않는 복사본입니다. 합친 브랜치를 체크아웃하면 같은 경로의 추적 파일과 부딪히므로, 복사본을 옆으로 옮긴 뒤 체크아웃하세요.

`jelly-material-studies`는 Claude의 작업 트리(`/Users/rels/Documents/github-repo/lets-do-it`)가 체크아웃하고 있어서, git은 같은 브랜치를 fe75에서 또 체크아웃하게 두지 않습니다. Codex는 같은 지점에서 **자기 브랜치 `codex/map`**을 만들어 일합니다(Claude 작업 트리를 detach하지 않습니다).

```bash
cd ~/.codex/worktrees/fe75/lets-do-it
git fetch origin
mkdir ../fe75-backup   # 이미 있으면 멈춥니다: 덮어쓰지 않게
mv projects/rubber-duck-pool ../fe75-backup/rubber-duck-pool
mv packages/diorama ../fe75-backup/diorama
git checkout -b codex/map origin/jelly-material-studies
```

22:04 이후에 고친 것이 있는지 확인합니다. 아래에서 `src`, `tests`, `tools`, `docs`에 차이가 나오면 그것이 이번 병합에 빠진 변경입니다(병합에서 의도적으로 바꾼 곳은 아래 "Codex 버전과 달라진 점"에 있습니다).

```bash
diff -rq ../fe75-backup/rubber-duck-pool projects/rubber-duck-pool -x node_modules -x dist -x models
```

원본 GLB와 의존성을 되돌립니다.

```bash
cp -R ../fe75-backup/rubber-duck-pool/models projects/rubber-duck-pool/
cd projects/rubber-duck-pool && npm ci && npm test && npm run build
```

## 충돌과 해결

| 파일 | 충돌 | 해결 |
|---|---|---|
| `src/pool/props.js` | Claude는 `props.bin`을 정점 20바이트로 압축해 읽게 바꿨고, Codex는 `props.bin`과 `sampling.bin`을 함께 읽는 `read()`를 만들었음 | Codex의 `read()` 구조를 살리고, 파일 크기로 형식을 판별해 **두 형식 다** 읽게 함(20바이트: 위치 float32×3, 법선 snorm8×3, kind u8, 색 sRGB u8×3, 패드 / 40바이트: float32×10). 지금 `props.bin`은 20바이트, `sampling.bin`은 40바이트 |
| `src/pool/scenery.js` | Claude는 절차형 미끄럼틀·튜브를 다듬었고(밤 네온 링, 크롬 다리), Codex는 둘을 `sampling.bin`의 Blender 모델로 바꿈 | **Codex 쪽 채택.** 밤에 빛나는 링은 Codex의 kind 16(LED 링)이 같은 역할을 함 |

## Codex 버전과 달라진 점 (꼭 알아 둘 것)

1. **큰 풀이 12% 넓어졌습니다.** `layout.js`의 `MAIN`이 `[-1.4, -1.3, 1.4, 0.45]`(계획 단위, ×K)입니다. 사용자가 origin 영상을 기준으로 요청했습니다. Codex의 `POOL`은 `MAIN`에서 계산되므로 물리는 자동으로 따라갑니다. 보이는 모델은 `npm run assets:map`으로 **다시 구웠습니다**(`map-layout.json`, `sampling.bin`, `sampling-shapes.js`, `sampling-manifest.json` 갱신, 수조 x 배율 0.676 → 0.757). 앞으로 `layout.js`를 바꾸면 `assets:map`을 다시 돌려 주세요.
2. **물살 고리가 넓어지고, 고리 안쪽 한가운데에 밀어내는 흐름을 넣었습니다.** 넓힌 풀에서 고리 안쪽 가운데의 정체선이 길어져, 오리 40마리 테스트에서 한 마리가 62.5초 멈췄습니다(기준 45초). `LOOP_MID`/`LOOP_HALF` 안에서 고리에서 먼 곳(`d > k(0.32)`)만 바깥으로 약하게(0.12) 밀어냅니다. 결과: 멈춤 최대 4.5–24초(시드 3, 5, 7), 물 출렁임 평균 0.021. 처음에 0.3으로 밀었을 때는 출렁임이 0.053으로 기준을 넘었습니다.
3. **`props.bin`은 20바이트 형식입니다.** `tools/build_props.py`가 그렇게 씁니다. `build_sampling.py`는 그대로 40바이트를 써도 됩니다(로더가 둘 다 읽음).
4. **재질 번호(kind):** 0–12는 Claude(11 벽화 물감, 12 흐르는 물), 13·14·16은 Codex(13 아크릴, 14 미끄럼틀 물, 16 LED). **15가 비어 있습니다.** 새 재질을 만들면 서로 겹치지 않게 이 표를 갱신해 주세요.
5. **엔진 `packages/diorama/parts.js`:** `MAT.NEON`을 추가했고, 부품 빛 함수가 `(lp, n, m)`(재질 번호 포함)을 받습니다. 절차형 튜브가 없어져서 풀에서는 지금 네온 재질을 쓰지 않습니다(남겨 둬도 무해). jelly는 이 함수를 쓰지 않습니다.
6. **`renderer.js`에 Claude가 `6fe0bdd` 뒤에 더한 것:** 부품 빛(`partsLight`), 기둥 업라이트(`uplight`), 수중등(풀 수면 높이로 판정, 흰 렌즈), 회벽 질감(kind 6), 노을(하늘 그라데이션, 금빛 빛무리, 구름), 체적 구름(`cumulus`, 하늘을 직접 그릴 때만), 밤에 비닐 튜브 보조광. 모두 자동 병합됐고 Codex 코드와 겹치지 않았습니다.
7. **페이지 문구를 영어로 바꿨습니다.** 저장소 규칙(CLAUDE.md: "Text on the page is English")에 따라 Codex의 조작 안내 패널(`조작 안내`, `전체 보기` 등)을 `Controls`, `Whole view` 등으로 옮겼습니다. 기능은 그대로입니다.
8. **테스트 두 개의 판정을 바꿨습니다(우연에 기대던 것).** "물이 잔잔함"은 마지막 한순간 → 마지막 1분 평균(< 0.05). "탭하면 뜀"은 고정값 0.08 → 그 디자인의 뛰는 높이의 80%. `tests/budget.mjs`의 로컬 배수는 2입니다(CI 4).
9. **확인 스크립트 `pool-props.js`:** Codex가 첫 카메라를 섬 전체 시점으로 바꾼 뒤, 라디오를 클릭하면 앞에 있는 풀 의자가 먼저 집혀 실패했습니다. 클릭 전에 위에서 내려다보도록 고쳤습니다.
10. **Claude 쪽 소품 경량화(인계서 첫 판에서 빠졌던 것):** `tools/props_floats.py` 튜브 링 분할 `(96,32)→(64,24)`(`f160e2b`), `tools/props_mural.py` 벽화 경량화(구 `(14,8)→(10,6)`, 윤곽 간격 `.002→.003`, 선 해상도 `2→1`, `d2df341`). 그래서 `props.bin`이 7.65 → 4.43 MB, `prop-shapes.js` 정점 131,847 → 118,134입니다. `docs/improvements.md`에는 Claude의 작업 기록이 더해졌습니다(Codex 내용은 그대로).
11. **증거 이미지:** `docs/evidence/*.png`와 `map-before.png`(합계 34 MB)를 webp(2 MB)로 바꾸고 `map-integration.md`의 링크를 고쳤습니다.

## Codex의 대조 결과 (2026-10-25)

Codex가 이 문서를 읽고 읽기 전용으로 fe75와 병합 결과를 대조했습니다. **빠진 Codex 변경: 없음.** fe75와 스냅샷 `82858e3`의 차이는 이미지 변환과 문서 링크뿐이고, 22:04 이후 코드 변경은 없었습니다. 다른 파일은 모두 위의 설명과 맞았고, `packages/diorama`는 `parts.js`의 §5 변경만 다릅니다. 두 충돌 해결에서 오류는 발견하지 못했습니다. 남은 개선점 하나: `LOOP_MID`/`LOOP_HALF`가 고리 경로에서 계산되지 않는 수동 상수라, 고리 점을 바꾸면 함께 고쳐야 합니다(지금 오작동은 아님).

## 확인 결과 (병합 후)

- `npm run verify`(저장소 전체, jelly 포함): 종료 코드 0.
- 풀 테스트 파일 13개 모두 통과(Codex의 `map-assets`, `ride-intake`, `sound` 포함).
- 브라우저 확인 8개(`pool-ducks`, `props`, `seats`, `time`, `names`, `flyer`, `sea`, `tap`) 모두 통과.
- 스크린샷: `.verify/m-default.png`(첫 화면), `m-pool.png`(넓힌 풀), `m-sunset.png`, `m-night.png`. 1600×900에서 60 fps.

## 앞으로의 규칙 제안

- **파일 소유:** 맵 배치와 샘플 모델(`map-kit.js`, `navigation.js`, `layout.js`의 경로·배치, `world.js`, `tools/build_sampling.py`, `models/sampling`)은 Codex. 빛과 셰이더(`renderer.js`의 하늘·조명·재질 블록, `daylight.js`, `packages/diorama/post.js`)와 `tools/props_*.py` 소품은 Claude.
- **브랜치:** 공유 브랜치는 `jelly-material-studies`. Claude는 거기서, Codex는 `codex/map`에서 일합니다. Codex가 올릴 때는 `git pull --rebase origin jelly-material-studies` 뒤 테스트를 돌리고 `git push origin HEAD:jelly-material-studies`(빨리감기만). Claude도 작업 전에 `git pull`. 추적되지 않는 복사본으로 일하지 않으면 다음 병합은 일반 git 병합이 됩니다.
- **레이아웃을 바꾸면** `npm run assets:map`, **소품 모델을 바꾸면** `npm run assets:props`를 돌리고, 결과물(`*.bin`, `*-shapes.js`)을 함께 커밋합니다.
- 큰 산출물(미리보기 PNG, `.blend`, `.unitypackage`)은 `asset-sampling/`처럼 git 밖에 둡니다.

## 1차 협업 결과 (2026-10-25)

Codex의 1차 변경(벽화 전환, 고리 범위 계산, 커서, 시드 3개 테스트)은 Claude가 검토해 `1d2de8f`로 커밋했습니다. Codex 샌드박스가 공유 git 메타데이터(`.git/worktrees/fe75`)와 로컬 포트를 막아 Codex가 직접 커밋하거나 probe를 돌릴 수 없었기 때문입니다.

fe75의 커밋되지 않은 변경은 `1d2de8f`와 같습니다(`console.log` 한 줄만 빠짐). 다음 작업 전에 맞추세요.

```bash
cd ~/.codex/worktrees/fe75/lets-do-it
git stash push -m codex-round1 -- projects/rubber-duck-pool   # 같은 내용이 이미 커밋됨
git merge --ff-only origin/jelly-material-studies
```

다음 라운드부터: Codex는 코드와 테스트까지, 커밋·push와 브라우저 확인(probe)은 Claude가 맡습니다. Codex의 보고서 경로는 작업 트리 안(`.verify/`)으로 둡니다.

## 2·3차 협업 결과 (2026-10-25)

1차와 같이 Codex는 코드와 노드 테스트까지, Claude가 검토·커밋·브라우저 확인을 맡았습니다. Codex의 복사본은 매번 `git stash`(지우지 않음)로 보관하고 작업 트리를 공유 브랜치 머리로 빨리감기했습니다.

- **2차, 생물(`critters.js`, 테스트 7개):** `0cc21ab`에 들어감. Claude가 바꾼 것: 크기(갈매기 0.42, 나비 0.1, 반딧불 0.05; 처음 값은 첫 화면에서 몇 픽셀), `GULL_RINGS`(셋은 첫 화면에서 보이는 바다 위 [0, 8], [-8.5, 1.5], [2, -8.8], 둘은 Codex의 넓은 고리). Codex의 테스트는 그대로 통과.
- **3차, 새 소품 배치(`props.js`, `props-place.test.mjs` 테스트 7개):** 모래성과 양동이(아래쪽 해변), 서핑보드(카바나 뒤, 바다 쪽), 아이스박스(노란 선베드 옆, 코랄), 누들 바구니와 수건(큰 풀 오른쪽 석재 바닥, 의자 옆). 브라우저에서 확인함(`.verify/place-sheet.jpg`).
- **다음:** 사용자 요청으로 풀·미끄럼틀 물을 minamo(MIT, three.js WebGPU + WGSL) 방식으로 바꿉니다. 물 셰이더는 Claude의 영역(`renderer.js`)입니다.

## 4차 협업: 패널과 터치 입력 검토 (2026-10-26)

Claude가 만든 패널(`panel.js`)과 두 손가락 이동을 Codex가 검토하고 고쳤습니다(테스트 18개: `navigation.test.mjs`, `panel.test.mjs`).
- 고친 것: 두 손가락 이동의 배율 누적 오차(시작 중심·목표·배율에 고정), 남는 손가락 기록, 시각 표시가 15분 단위로 늦던 것, 키보드로 오리를 고를 수 없던 것('Pick a duck' 선택 상자), 카드를 닫을 때 사라지던 포커스와 Esc, 휴대폰에서 도움말과 카드의 겹침, 카드 높이(dvh, 안전 여백), 사라진 오리에 카드 버튼이 적용되던 것.
- Codex가 Claude에게 넘긴 엔진 세 가지는 Claude가 고침(`packages/diorama/view.js`): 집기는 터치 손가락만 정확히 둘일 때(세 번째 손가락이면 멈춤), 줌 범위 옵션(`minDist`, `maxDist`; 풀은 휠과 같은 1.8–42), 포인터 캡처를 잃으면 정리.

## 5차 협업: 놀거리(Terra)와 도감(Astra) (2026-10-27)

사용자가 "Codex의 Astra 뿐만 아니라 GPT-6.1 Terra High 도 적극 활용해"라고 해서 두 Codex에 동시에 맡겼습니다(각자 worktree, 서로 계약으로만 연결).
- Terra(`gpt-6.1-terra`, high, `codex/map`): 시뮬레이션. 오리마다 `d.stats`(슬라이드·펌프·랩·최고 랩·비행·바다·구조), 레이스(`W.startRace(ids)`, 2–4마리를 슬라이드 입구에 나란히, 펌프를 거친 다음 슬라이드 진입이 완주, 600초 제한), 구조선(`W.sendBoat()`, 바다에 떨어진 비행 오리를 가까운 순으로 해안 밖으로만 돌아 태워 와서 풀에 넣음, `rescue.js`). 이벤트 `lap`, `takeoff`, `escaped`, `rescued`, `raceStart`, `raceFinish`, `raceEnd`. 테스트 56개.
  - 시드 3·5·7의 레이스: 첫 완주 134–192초, 마지막 완주 295–348초, 시드 3의 한 마리는 끝내 완주 못 함(물살만으로는 모두의 완주를 보장하지 않음).
- Astra(`gpt-6-astra`, `codex/book`): 도감 데이터 `logbook.js`. 디자인 12종의 처음 본 때, 일반 모자 7종, 이번 방문에 만난 오리(최대 40), 도장 12개, 기록(최고 랩, 한 오리의 최다 랩, 우승 수). `localStorage` 키 하나(`rubber-duck-pool.book.v1`, 버전 검사, 깨진 값은 무시), 5초마다와 새 도장 때 저장. 도장 "Lucky current"의 30초는 실제 세계를 시드 3·5·7로 돌려 정함(운 좋은 오리만). 테스트 20개.
- Claude: 두 작업을 합치고 화면에 올림. Astra의 실제 세계 테스트가 Terra 이전의 `d.laps`로 랩을 셌던 것을 `d.stats.lastLap`으로 고침. 레이스가 끝난 때(`W.race.endedAt`)를 더함(결과판을 8초 뒤 내리려고).

## 6차 협업: Apple식 UI 재설계 (Terra, 2026-10-28)

사용자가 UI가 번잡하다며 emilkowalski_skills의 apple-design 스킬을 토대로 다시 만들고 "Codex 6.1-Terra High와 같이 움직여"라고 해서 둘로 나눴습니다.
- 1라운드, 동시 진행: Terra(`gpt-6.1-terra`, high)가 상단 상태 캡슐의 모델(`status-island.js`, 순수 모듈, 테스트 6개)을 만들고, 그동안 Claude는 화면(유리 툴바, 팝오버, 카드, 책 탭, 어두운 유리)을 만들었습니다. 레이스 표시, 우승 알림(5초), 바다에 남은 오리와 "Send the boat", 나가 있는 배, 도장 알림(3초, 넷째부터는 "+n more stamps"로 합침), 최대 두 줄.
  - Claude의 지시서가 이름을 `island.js`로 적었는데 그 이름은 이미 섬 지형 모듈이었습니다. Terra는 지형 모듈에서 다시 내보내는 길을 택했고, Claude는 그 연결을 빼고 `status-island.js`에서 바로 가져오게 했습니다.
  - Claude가 고친 것: 우승 알림이 먼저 받은 도장("First across") 뒤에 줄을 서서 늦게 나왔습니다. 경주가 끝난 데 대한 답이라 큐의 맨 앞으로(`unshift`).
- 2라운드, 검토: Terra가 Claude의 `panel.js`를 두 스킬과 실제 사용 방식(마우스, 키보드만, 화면 낭독기, 터치, 빨리 눌렀다 바꾸는 사람)에 비춰 고쳤습니다(패널 테스트 22개, 전체 90개).
  - 툴바의 화살표·Home/End 이동(Tab 정지점 하나), 책 탭의 화살표와 탭·패널 연결, 키보드로 연 팝오버 안으로 포커스, 표면을 바꾸거나 바깥을 눌렀을 때 숨은 곳에 남던 포커스, 책이 새로 채워질 때 사라지던 포커스, 고른 오리가 떠난 직후 카드 화살표가 다른 오리를 고르던 것, 섬 버튼이 사라질 때의 포커스, 대기 중인 툴팁이 열린 표면 위에 뜨던 것, 책이 열린 동안 툴바가 숨던 것, 레이스 버튼이 토글처럼 읽히던 것(`aria-pressed` 대신 이름: "Race in progress, restart race"), 휴대폰에서 아이콘만 남는 Race·Book의 이름.
  - Claude가 Terra 판에 다시 얹은 것: 섬 항목의 종류를 클래스 대신 `data-kind`로(`.race`가 툴바 버튼과 섬 캡슐을 둘 다 가리켰음), 레이스 중 버튼의 색은 `data-running`으로.

## 7차 협업: Y2K를 입힌 새 디자인의 대비 검사 (Terra, 2026-10-28)

사용자가 새 디자인(Apple식 구조)과 Y2K 샘플을 합치자고 해서, Claude가 구조와 유리는 그대로 두고 색·모양만 Y2K로 바꿨습니다. 분홍과 라임을 반투명 유리 위에 올리면 글자가 읽히는지가 가장 위험해서 Terra에게 대비 검사를 맡겼습니다.
- Terra(`gpt-6.1-terra`, high): `tests/contrast.test.mjs`. `style.css`의 `:root`와 `.pool.dark` 토큰을 직접 읽고, 글자 → 바탕(fill) → 유리 → 장면 순으로 합성해 WCAG 대비를 잽니다. 장면은 페이지의 실제 색에서 최악의 경우를 골랐습니다(낮: 모래, 포말, 바다, 잔디. 밤: 밤하늘, 램프에 비친 모래). 기준은 글자 4.5:1, 가장자리 선 3:1.
  - 처음 팔레트는 20개 중 10개가 실패했습니다. Terra가 토큰 값만 고쳤습니다: 보조 글자의 진하기(낮 .68→.72, 밤 .68→.8), 빨간 글자(낮 `#c8402f`→`#922f23`).
- Claude가 바꾼 것 두 가지:
  - Terra는 그림자도 3:1로 검사해서, 바다와 흰 포말 둘 다에 3:1이 되는 단색이 없다는 이유로 실패를 남겼습니다. WCAG 1.4.11이 요구하는 것은 표면의 경계가 보이는 것이고, 1px 선이 이미 그 일을 합니다(낮 9.8:1, 밤 3.8:1). 그림자는 장식이라 검사에서 뺐습니다. 밤 그림자도 Terra의 회색(`#777777`) 대신 원래의 검정으로 되돌렸습니다.
  - 밤 빨간 글자로 Terra가 고른 `#ffc4bd`는 주 버튼 분홍(`#ffc5c3`)과 거의 같은 색이라, "Take it out"이 주 동작처럼 보였습니다. 밤 유리를 조금 덜 투명하게(.74→.86) 하고 산호빨강 `#ff9a8c`로 바꿔 모든 쌍을 통과시켰습니다.

