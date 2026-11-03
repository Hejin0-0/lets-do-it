# 양동이·삽 러버덕과 모래성 작업 기록

2026-11-03. 독립 스튜디오 에셋 연구이며 실제 웹 게임 장면에 적용한 결과는 아니다. [에셋 아트 디렉션](asset-art-direction.md)과 기존 [양동이 v13 기록](beach-pail-lookdev.md)을 따른다.

## 양동이와 삽의 기본 러버덕

게임의 기본 노란 러버덕과 같은 형상과 아틀라스를 사용했다. 양동이에는 네 마리, 삽 위에는 더 큰 한 마리를 놓았다. 모델과 모래, 삽의 표면을 광선으로 직접 확인해 바닥 높이를 결정한다. Blender 원본에는 4마리의 배치를 가려지지 않게 조정한 R3를, Unity에는 그 모델의 접지와 조명을 다시 조정한 R4를 사용했다.

| 독립 평가 | Sol | Luna | 반영한 주요 내용 |
| --- | --- | --- | --- |
| R1 Blender + Unity | 77 불합격 | 78 불합격 | 삽과 큰 오리가 잘리고 양동이 앞 오리가 가려짐 |
| R2 Blender + Unity | 82 불합격 | 86 합격 | 구도를 넓히고 모래를 올림. Unity 접지와 입체감 부족 |
| R3 Blender + Unity | 83 불합격 | 84 불합격 | 오리 간격을 벌림. Unity 조명을 낮추자 색이 지나치게 탁해짐 |
| R3 Blender + R4 Unity | **85 합격** | **85 합격** | Unity의 색과 화면용 접지 그림자를 다시 조정. 두 평가 모두 기준선에 간신히 도달 |

- 결과: [Blender](evidence/beach-pail-ducks-r3-blender.png), [Unity](evidence/beach-pail-ducks-r4-unity.png). 이전 렌더는 `evidence/beach-pail-ducks-r{1,2,3}-{blender,unity}.png`에 남겼다.
- Blender 5.2.2 LTS, Unity 6000.6.0f1 / Pipeline 0.9.1-exp.1. Blender MCP로 연결·장면을 확인하고 독립 Blender 프로세스에서 원본 복사본을 다뤘다. Unity MCP에서 개별 편집 도구가 노출되지 않아 연결된 별도 Unity 프로젝트에서 공식 Unity CLI와 Pipeline으로 컴파일·렌더했다. 열린 사용자의 Blender 장면은 덮어쓰지 않았다.
- Scenario `bx_audit`는 대표 오리 4개 부품에서 오류 없이 통과했으나, 부모에 적용하지 않은 균일 크기 변환 경고 4건을 남겼다. 완성 장면의 메시 34개는 평가된 삼각형 618,106개이며 곡선은 이 숫자에 포함하지 않는다. 렌더용 고해상도이며 게임용 최적화가 필요하다.
- Blender에서 수량, 큰 오리의 상대 크기, 게임 기본 아틀라스, 양동이 모래 및 삽 표면에 대한 접지를 검사했다. `PAIL_DUCKS_CHECK=PASS bucket=4 spade=1`.
- Unity의 바닥 그림자는 이 스튜디오 장면에서 별도 투명 그림자 면을 사용한다. 실제 게임 조명이나 실시간 그림자의 증거가 아니다. 두 평가자는 Unity의 약한 접촉 음영과 Blender보다 어두운 색·단순한 광택을 공통 한계로 지적했다.
- 원본 파일은 로컬의 `models/beach-pail-ducks-r3.blend`, `.fbx`, `.glb`; `models/`는 Git에서 제외된다. 원래 `beach-pail-v13.blend`를 보존한다. 재생성에는 로컬 v13 원본, `duck-02-mint.glb`의 공통 UV 형상, `duck-01-classic-albedo.png` 아틀라스가 필요하다. `tools/compose_beach_pail_ducks.py`의 인수 `3`으로 장면을 만들고, `tools/verify_beach_pail_ducks.py`, `tools/export_beach_pail_ducks.py`를 연 결과에 실행한다. Unity 스튜디오는 `tools/render_beach_pail_ducks_unity.cs`를 쓴다.

## 다음 소품: 모래성 초안

양동이·삽과 같은 해변의 이야기를 만들기 위해 작은 모래성을 시작했다. 중앙 성채와 네 탑, 파낸 아치 출입구, 민트색 천 깃발, 작은 조개를 따뜻한 모래 둔덕에 배치했다. 게임의 기존 모래성을 수정하지 않은 독립 초안이다.

- 순서: Blender에서 첫 모델과 렌더 → 원통과 바닥이 너무 균일해 보이는 문제를 줄이고 조개와 미세 입자를 추가 → 탑과 조개가 떠 보이는 문제를 수정 → Scenario의 빈 재질 슬롯과 조개 면 방향 경고를 수정 → Unity에서 FBX 재질 이름이 바뀌어 모래가 적용되지 않는 원인을 수정하고 재렌더.
- 결과: [Blender v4](evidence/sandcastle-atelier-v4-blender.png), [Unity v4](evidence/sandcastle-atelier-v4-unity.png). 첫 시도는 `evidence/sandcastle-atelier-v1-blender.png`, 두 번째는 `evidence/sandcastle-atelier-v2-blender.png`에 남겼다.
- 로컬 원본 `models/sandcastle-atelier-v4.blend`, Unity 비교용 FBX `models/sandcastle-atelier-v4.fbx`. `tools/create_sandcastle_lookdev.py`와 `tools/export_sandcastle_lookdev.py`로 생성한다. Unity는 `tools/render_sandcastle_unity.cs`와 `tools/SandcastleLookdevSand.shader`를 사용한다.
- Scenario `bx_audit`는 둔덕·중앙 성채·앞 탑·조개 대표 4개를 함께 검사해 통과(오류 0, 경고 0)했다. 전체 53개 메시를 평가한 삼각형 수는 36,346개다. Unity 스튜디오 설정은 컴파일 오류와 경고가 없었다.
- Unity의 모래는 Blender 노드를 그대로 옮긴 것이 아니라 월드 좌표 기반의 임시 셰이더로 근사했다. 바닥의 화면용 그림자 면도 별도로 놓았다. 아직 성벽이 지나치게 규칙적이고 두 렌더러의 질감이 다르다. 독립 평가, 게임 카메라·조명에서의 비교, 게임용 재질과 최적화는 후속 작업이다.

## 검증과 남은 범위

Python 제작 도구 문법 검사, Blender 배치 검사와 Scenario 대표 부품 검사, Unity 스튜디오 컴파일 및 이미지 점검을 수행했다. GitHub 전송 전 Rubber Duck Pool의 `npm test`는 122/122 통과(종료 코드 0), `npm run build`도 성공(종료 코드 0)했다. 이 스튜디오 에셋의 웹 장면 검증이나 모바일 실기기 성능 테스트, 저장소 전체 `npm run verify -- --build`는 실행하지 않았다. `crapper`, `dryer`, `mutator` 명령은 환경에서 찾을 수 없어 실행하지 못했다.
