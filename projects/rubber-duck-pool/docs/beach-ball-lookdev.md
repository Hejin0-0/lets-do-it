# 비치볼 룩 개발 기록

상태: **독립 시안, 검수 기준 미달**. 게임에는 아직 연결하지 않았다. 여섯 차례 Blender/Unity 렌더를 비교했고, 마지막 두 차례는 두 검수자 모두 개선이 정체됐다고 판단했다. v6을 기본 보존안으로 두되 v5도 함께 남긴다. 의자와 다른 소품에 어울리는 부드러운 해변 분위기를 목표로 했지만, 아직 완성품이나 AAA 품질로 승인된 에셋은 아니다.

## 결과물

- 콘셉트: [beach-ball-concept.png](evidence/beach-ball-concept.png). 기존 의자 이미지를 참고하여 내장 ImageGen으로 따뜻한 아이보리·민트·코랄 패널, 노란 주입구, 얇은 용착선과 비닐 광택을 제안했다. Scenario 이미지 생성 결과는 아니다.
- Blender 최종 시안: [beach-ball-v6-blender.png](evidence/beach-ball-v6-blender.png), 편집 원본 [beach-ball-v6.blend](../art-source/beach-ball/beach-ball-v6.blend).
- Unity 최종 시안: [beach-ball-v6-unity.png](evidence/beach-ball-v6-unity.png). 실제 **Unity 6000.6.8f1**의 별도 스튜디오 프로젝트에서 렌더했다. 바닥 접촉 그림자는 스튜디오용으로 별도 연출했다.
- 전달용 모델: [beach-ball-v6.glb](../art-source/beach-ball/beach-ball-v6.glb), [노멀 맵](../art-source/beach-ball/beach-ball-normal.png). GLB에는 맵이 내장되어 있다. 이전 Blender 원본과 각 단계 렌더도 같은 폴더에 남겼다.

공 중심을 원점에 두고, 게임의 현재 비치볼 물리 반경 0.165를 기준으로 만들었다. 편집 원본의 본체 반경은 0.16355–0.16660이다. Unity 렌더는 별도의 조명·반사 환경을 사용하므로 게임 속 조명이나 동작의 증거가 아니다.

## 검수와 남은 문제

| 비교 | Sol: Blender / Unity | Luna: Blender / Unity |
| --- | --- | --- |
| v3 Blender / v2 Unity | 75 / 64 | 68 / 64 |
| v4 | 78 / 73 | 71 / 74 |
| v5 | 77 / 72 | 72 / 75 |
| v6 | 79 / 74 | 72 / 75 |

합격선은 각 85점이다. Sol은 v6의 과한 함몰이 줄었다며 v6을, Luna는 v5와 v6의 차이가 작다며 v5 보존을 권했다. 두 사람 모두 목표 미달과 정체에 동의했다. 용착선이 아직 가늘고 패널 조립감이 약하며, 밸브가 투명한 주입구보다 단추처럼 보인다. Unity는 Blender보다 하부가 어둡고 재질 반사가 다르다. 이후에는 작은 숫자 조정보다 실제 용착 띠와 밸브 구조를 다시 모델링하고 재질을 맞추는 편이 낫다.

GLB는 **36,036 triangles / 14 meshes / 약 952 KiB**의 룩 개발용 파일이다. 작은 웹 소품으로 사용하기 전에 폴리곤 수, 재질 수, 모바일 성능과 실제 화면 크기에서의 가독성을 다시 검토해야 한다. 브라우저 렌더, 게임 물리, 상호작용, FPS는 테스트하지 않았다. 현재 게임에서는 같은 `ball` 모델 이름이 수집품 자리에도 쓰이므로, 게임에 연결할 때 그 경로까지 함께 확인해야 한다.

## 검증과 재현

- Blender 5.2.2 LTS에서 본체 폐합·면 방향·크기·색상 면 수·UV·내장 1024×1024 노멀 맵 검사 통과. 본체는 5,966 vertices / 11,928 triangles다.
- 초기 v1에서는 용착 띠와 밸브 누락으로 같은 검사가 예상대로 실패했다.
- GLB의 헤더, 포함된 모델과 텍스처, 노멀 맵을 쓰는 메시의 UV를 확인했다. 확인 도중 UV가 없는 아랫면에 맵이 연결된 문제를 발견해 수정했다.
- Unity 6000.6.8f1에서 FBX와 노멀 맵을 불러와 렌더했다. Unity는 별도 임시 프로젝트를 사용했다.
- Python 제작·검증 스크립트 문법 검사 통과. 별도의 빈 임시 폴더에서 v1 제작 스크립트도 재현했다.

Blender 실행 파일을 `BLENDER`라 할 때, 원본과 GLB 검사는 다음과 같다.

```sh
"$BLENDER" -b art-source/beach-ball/beach-ball-v6.blend --python-exit-code 1 --python tools/verify_beach_ball_lookdev.py
"$BLENDER" -b art-source/beach-ball/beach-ball-v6.blend --python-exit-code 1 --python tools/export_beach_ball_lookdev.py
python3 tools/verify_beach_ball_glb.py art-source/beach-ball/beach-ball-v6.glb
```

위 명령은 `projects/rubber-duck-pool`에서 실행한다. Unity용 FBX는 로컬 `models/`에 생성되며 이 폴더는 Git에서 제외된다. Unity 스튜디오 조립 코드는 [render_beach_ball_unity.cs](../tools/render_beach_ball_unity.cs)다.

## 작업 기록

1. 기존 에셋과 아트 방향, 공의 물리 반경을 확인해 의자·아이스박스·타월과 어울리는 비치볼을 선택했다.
2. 로컬 Scenario와 Blender 관련 스킬, `mcp-for-blender`, `blender-skills` 지침을 검토했다. Scenario 클라우드 생성 도구는 이 세션에 노출되지 않아 호출하지 못했고, 콘셉트는 내장 ImageGen으로 만들었다.
3. Blender MCP로 v1 원본을 만들고, 패널 색과 용착선·밸브·비닐 표면을 v2–v6으로 개선했다. 각 단계는 실제 Blender에서 렌더했다.
4. 요청한 새 Unity 에디터로 기존 스튜디오의 복사본을 열고 각 버전을 렌더했다. Unity MCP 연결 확인 도구는 응답했지만 편집 도구 목록이 노출되지 않아, 같은 에디터에 연결된 Unity CLI/Pipeline을 사용했다. 이전 6000.6.0f1 프로젝트는 업그레이드하지 않았다.
5. 두 독립 검수자의 지적을 반영해 주입구 구조, 용착 띠, 노멀 맵과 조명을 수정했다. v5의 과한 함몰은 v6에서 줄였다.
6. 원본과 GLB를 검사하고 UV가 없는 아랫면의 잘못된 노멀 맵 연결을 고쳤다. 최종 결과는 품질 한계를 표시한 독립 시안으로 보존한다.
