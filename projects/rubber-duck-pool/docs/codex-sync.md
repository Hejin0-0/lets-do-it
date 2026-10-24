# Codex와 함께 작업하기: 인계 메모

Claude(이 브랜치 `jelly-material-studies`)와 Codex(`~/.codex/worktrees/fe75/lets-do-it`의 복사본)가 같은 프로젝트를 동시에 고치고 있습니다. 나중에 합칠 때 길잡이로 남깁니다.

## 기준점

Codex의 `projects/rubber-duck-pool`과 `packages/diorama` 복사본은 이 브랜치의 커밋 `6fe0bdd`(origin 대비 비주얼 1차) 시점의 것입니다. 근거: 그 커밋에서 들어간 수중등 코드(`poolWall`)는 있고, 다음 커밋 `f007385`의 `partsLight`·`uplight`는 없습니다. Codex 복사본은 git으로 추적되지 않는 파일들이라 git 병합이 되지 않습니다.

`6fe0bdd` 이후 이 브랜치의 변경 전부:

```bash
git diff 6fe0bdd HEAD -- projects/rubber-duck-pool packages/diorama
```

## `6fe0bdd` 이후 이 브랜치의 변경

| 커밋 | 파일 | 무엇 |
|---|---|---|
| `f007385` | `packages/diorama/parts.js` | `MAT.NEON`(18) 추가. 부품 빛 함수 형식이 `(lp, n)` → `(lp, n, m)`(재질 번호). jelly는 빛 함수를 쓰지 않음 |
| `f007385` | `src/pool/renderer.js` | `partsLight(lp, n, m)`: 램프 빛 + 밤에 네온 링. 낮은 해의 금빛 빛무리, 해 쪽 구름 가장자리 |
| `f007385` | `src/pool/scenery.js` | 튜브 링 재질 `MAT.GLOSS` → `MAT.NEON` |
| `f007385` | `src/pool/props.js`, `tools/props_mood.py` | 기둥 발치 업라이트(`uplight`, LIGHT 표), 풀 옆 야자수 셋 |
| `f160e2b` | `src/pool/renderer.js` | 수중등 판정을 풀 수면 높이(LU/LL)로(벽 칸은 물 격자에서 젖지 않아 늘 꺼져 있던 버그), 흰 렌즈. 회벽 질감(kind 6). 노을 구름 |
| `f160e2b` | `tools/build_props.py`, `src/pool/props.js` | **`props.bin` 형식 변경**: 정점 40바이트(실수 10개) → 20바이트(위치 float32×3, 법선 snorm8×3, 재질 u8, 색 sRGB u8×3, 패드). `loadProps()`가 풀어서 예전과 같은 10실수 배열로 만듦 |
| `f160e2b` | `tools/props_floats.py` | 튜브 링 해상도 낮춤 |
| 이번 커밋 | `src/pool/renderer.js` | 밤에 비닐 튜브가 제 색을 유지(풀빛·램프 보조광), 노을 구름을 짙게 |

## 합칠 때 주의

- **`props.bin` 형식:** Codex 쪽 `props.js`(옛 40바이트 로더)와 이 브랜치의 `props.bin`(20바이트)을 섞으면 로드에서 오류가 납니다("does not match prop-shapes.js"). 로더와 `props.bin`, `prop-shapes.js`는 같은 쪽 것을 함께 쓰거나, Codex의 `sampling.bin` 변환기도 같은 20바이트 형식으로 맞추면 됩니다.
- **엔진 `parts.js`:** 두 쪽 다 고쳤습니다. 이 브랜치의 변경은 위 세 줄(재질, 거칠기 조건, 빛 함수 호출)뿐입니다.
- **겹치는 파일:** `renderer.js`, `props.js`, `scenery.js`, `index.js`, `layout.js`, `world.js`. 이 브랜치의 `renderer.js` 변경은 모두 셰이더 안의 작은 블록이라 손으로 옮기기 쉽습니다.

## 앞으로의 규칙 제안

- 한 파일은 한쪽만 고칩니다. 맵 배치와 샘플 GLB(`map-kit.js`, `layout.js`, `world.js`, `sampling`)는 Codex, 빛과 셰이더(`renderer.js`의 하늘·조명·재질 블록, `daylight.js`)는 Claude.
- 합치기 전에 Codex 복사본을 이 브랜치 최신으로 다시 맞추거나, 이 문서의 표대로 옮깁니다.
