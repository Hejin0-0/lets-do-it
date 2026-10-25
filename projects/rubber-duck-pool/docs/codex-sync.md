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
