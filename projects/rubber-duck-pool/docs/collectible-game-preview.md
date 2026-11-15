# 수집품 게임 적용 시험 기록

2026-11-15 · 상태: **독립 실험**. 여섯 수집품을 실제 게임에 교체하지 않았다. 병·물 렌더링 패치는 완성된 게임 패치가 아니다.

## 목표와 결과

의자에서 정한 차분한 휴양지 분위기에 맞춰 만든 병 속 노 젓는 배, 잠수함, 범선과 등대섬, 난파선 암초, 어촌섬을 웹 수영장 안에서 비교했다. 기존 수집품 변환 설정을 그대로 쓰면 새 모델은 기존보다 폭이 약 6.2~6.9배 커졌다. 시험본은 기존 모델의 폭과 위치를 기준으로 다시 맞췄다. 이는 부력이나 충돌이 검증됐다는 뜻은 아니다.

병 세 개는 물에 떠 있는 상태에 맞춰 스튜디오 받침을 제외하고 유리의 실루엣을 보강한 별도 GLB·FBX를 만들었다. 스튜디오 원본과 기존 전시용 LOD는 유지한다.

| 에셋 | 게임 시험 GLB | 새 Blender 렌더 | GLB 삼각형 |
| --- | --- | --- | ---: |
| 노 젓는 배 | [GLB](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-game-preview-v2.glb) | [렌더](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-game-preview-v2-blender.png) | 6,943 |
| 잠수함 | [GLB](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-game-preview-v2.glb) | [렌더](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-game-preview-v2-blender.png) | 7,936 |
| 범선 | [GLB](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-game-preview-v2.glb) | [렌더](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-game-preview-v2-blender.png) | 7,866 |

렌더는 Blender의 스튜디오 조명과 지오메트리를 보여준다. 받침을 감춰 병이 바닥 위에 떠 보이는 것은 전시용 장면을 재사용했기 때문이다. 같은 이름의 FBX도 각 폴더에 있다.

## 웹 실험과 남은 문제

- [가까운 범선](evidence/collectible-web-preview-reproduced-20261115.png) · [저녁 조명](evidence/collectible-web-preview-longship-v8-evening-20261115.png) · [기본 카메라](evidence/collectible-web-preview-normal-camera-20261115.png) · [두 병이 겹치는 시험](evidence/collectible-web-preview-overlap-close-20261115.png)
- [등대섬](evidence/collectible-web-preview-lighthouse-v3-20261115.png) · [난파선 암초](evidence/collectible-web-preview-shipwreck-v3-20261115.png) · [어촌섬](evidence/collectible-web-preview-village-v3-20261115.png)
- 기존 투명 병의 알파 투 커버리지는 가까이에서 격자처럼 보였다. 단순 알파 블렌딩은 수면 뒤로 병의 윗부분을 잃었다. 실험에서는 병을 수면 아래와 위로 나누어 그리고, 위쪽은 물을 그린 뒤에 합성해 이 두 현상을 일부 줄였다. 수면 경계 이음새와 반사 왜곡이 남고, 투명 물체의 깊이 정렬·피사계 심도·굴절은 해결하지 못했다. 화면상 겹침 시험에서는 병을 강제로 가까이 배치했으므로 실제 물리나 정렬 전반의 통과 근거가 아니다.
- 수영장 기본 카메라에서는 병 속 배가 매우 작아 잘 읽히지 않는다. 가까운 화면의 디버그 배치만 보고 최종 가독성을 판정해서는 안 된다.
- 기존 변환기는 glTF 재질을 그대로 렌더하지 않는다. 텍스처를 삼각형별 색으로 샘플링하고 재질 이름을 게임의 표면 종류에 매핑한다. 이 실험은 나무·물·돌 등의 매핑을 조정하고 텍스처 세분화 깊이를 제한했다. 세부 텍스처 손실과 거친 돌의 광택은 여전히 검토가 필요하다.
- 변환 후 시험본의 삼각형은 각각 노 젓는 배 7,186, 잠수함 7,936, 범선 7,866, 등대 7,732, 난파선 7,876, 어촌 6,570이다. 여섯 기존 모델의 17,340개에서 45,166개로 늘었다. 각 모델에 두 배치 항목이 있어 인덱스 기준으로 총 55,652개가 추가되지만, 이는 실제 표시량이나 FPS 측정치가 아니다. GPU·모바일 성능 측정이 필요하다.

Playwright에서는 WebGPU가 있는 로컬 브라우저에서 게임의 디버그 훅으로 수집품을 소환했다. 확대 화면은 시뮬레이션을 멈추고 위치와 카메라를 직접 지정했다. 기본 카메라 화면은 디버그 소환 후 시뮬레이션을 재개한 것이다. 실제 책 UI의 클릭·저장·복원, 일반 플레이 전체, 접근성, 모바일과 FPS는 검증하지 않았다. 브라우저 콘솔 오류는 관찰되지 않았다.

## 작업 및 검사 로그

1. 아트 디렉션과 기존 6개 수집품의 모델·재질·변환 규칙을 확인해 새 에셋이 같은 세계와 게임 크기에 맞는지 점검했다.
2. 임시 사본에서 기존 변환기를 실행해 크기 증가와 물·나무·돌의 재질 분류를 발견했다. 원본 바이너리를 덮어쓰지 않도록 결과를 `/private/tmp`의 별도 웹 사본에만 기록했다.
3. 기존 경량 병을 물 위에 띄우면 받침이 따라붙는 문제가 있어 검사에서 먼저 실패시키고, 받침 없는 게임용 모델을 별도로 생성했다. 세 GLB의 재질, 분리된 유리 메시, 삼각형 수를 검사했다.
4. 범선 유리의 원본 정점 2,946개에서 경량 표면까지의 단방향 최근접 거리 95백분위는 기존 `0.001002`, 새 시험본 `0.000481` Blender 단위였다. 기준 `0.0008`에서 기존은 실패하고 새 시험본은 통과했다. 이 표본 검사는 전체 표면이나 셰이딩의 동등성을 보장하지 않는다. 돛은 원본의 삼각형·줄무늬 재질 568개가 유지됐다.
5. Blender 5.3.0에서 세 시험본을 다시 생성·렌더하고 GLB 검사를 통과했다. 별도 복사본에서 기본 전시용 생성도 실행했으며, 범선 LOD는 7,692삼각형·메시 2개·최대 경계 오차 `0.000357`로 기존 검사에 통과하고 전시용 받침도 유지했다.
6. WebGPU에서 기존 표현, 단순 블렌딩, 수면 위·아래 분리 순으로 비교했다. 낮·저녁과 반대쪽에서 확인하고, 저장된 준비·변환 스크립트로 새로운 임시 사본을 다시 만들어 범선 화면을 재현했다. 임시 경로 밖의 출력과 원본을 가리키는 심볼릭 링크는 거부하는지도 확인했다.
7. Blender MCP의 현재 연결은 끊겨 있었고, Unity MCP에서 연결된 에디터를 찾지 못했다. 이번 병 시험본의 Blender 생성과 렌더는 CLI로 수행했다. 이번 작업에서 Unity 렌더는 하지 않았다. 앞선 에셋별 Unity 비교 결과는 각 룩데브 문서를 참조한다.
8. 새 Python 도구는 문법을 확인하고, 준비 스크립트의 기존 대상·저장소 내부 대상 거부와 변환 스크립트의 바깥 파일 심볼릭 링크 거부를 확인했다. `crapper`, `dryer`, `mutator`는 이 환경의 실행 경로와 제공 도구에 없어 실행하지 못했다. 프로덕션 게임 코드를 적용하지 않아 전체 게임 테스트와 프로덕션 빌드는 실행하지 않았다.

Scenario의 기존 콘셉트를 기반으로 했으며, 앞선 생성 요청에서 사용 한도 오류가 나서 이번 작업에서는 추가 생성을 요청하지 않았다.

## 독립 시험 재현

이 시험은 `jelly-material-studies`의 런타임 소스 `fc77131cc9b97e9f3f6e696094d81e53122a7b43`과 이번에 저장한 에셋·도구가 함께 있는 작업 디렉터리에서 실행했다. 에셋 커밋이 있는 `main`과 이 런타임 브랜치는 다르므로, 다른 체크아웃에서 실행할 때는 필요한 파일과 패치 적용 가능성을 먼저 확인한다. 준비 스크립트는 원본 게임을 바꾸지 않고 `/private/tmp` 아래에 새 사본을 만든다. 같은 이름의 사본이 이미 있으면 중단한다.

```sh
TASK_REPO="$PWD"
TASK_TMP="/private/tmp/collectible-preview-example"
TASK_POOL="$TASK_TMP/projects/rubber-duck-pool"
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

python3 projects/rubber-duck-pool/tools/experiments/prepare_collectible_preview.py "$TASK_TMP"
"$BLENDER" -b --factory-startup --python-exit-code 1 \
  --python projects/rubber-duck-pool/tools/experiments/build_collectible_preview.py -- "$TASK_POOL"
cd "$TASK_POOL"
./node_modules/.bin/vite --config vite.config.mjs --host 127.0.0.1
```

준비 스크립트는 [실험 패치](../tools/experiments/collectible-glass-water-split.patch)를 복사본에만 적용한다. 변환기는 현재 체크아웃의 `export_lookdev_props.py`에서 쓰기 부분 이전의 함수만 사용하며, 경계가 바뀌면 중단한다. 기존 `lookdev.bin`과 `lookdev-shapes.js`는 건드리지 않는다. 이 절차는 프로덕션 빌드 절차가 아니다.

각 병을 다시 만들려면 원본 `.blend`를 연 상태에서 `tools/create_rowboat_bottle_lod.py -- --game-preview`를 Blender로 실행한다. 같은 이름의 게임 시험 GLB·FBX·렌더를 덮어쓰므로 필요한 파일은 먼저 보관한다. `tools/check_bottle_game_preview.py`와 `tools/check_bottle_glass_shape.py`는 각각 실제 GLB 구조와 원본 유리 표본 오차를 확인한다.
