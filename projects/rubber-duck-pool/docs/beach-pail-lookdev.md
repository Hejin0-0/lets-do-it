# 모래 양동이와 삽: 룩 개발 기록

기준: 2026-11-02, v10. 컨셉은 [원본 이미지](evidence/beach-pail-concept.png)다. 양동이와 삽을 별도의 소품으로 개발한 상태이며 게임에는 적용하지 않았다.

## 이번 방향

- 산호색 양동이는 안쪽 벽과 말린 입구가 있는 입체 구조로 만들고, 아래쪽의 세 줄 물결은 몸체에 파인 홈으로 표현한다.
- 아이보리 손잡이는 둥근 봉 대신 폭이 있는 부드러운 띠다. 삽은 모서리가 둥근 민트색의 오목한 날, 날과 이어지는 목, 나무 손잡이의 실제 관통 구멍으로 구성했다.
- 양동이 안의 완만한 모래 더미, 바닥에 붙은 모래와 삽 위에 흩어진 모래를 형상으로 만들었다. 목재 색상은 UV에 베이크해 Blender 원본에 포함하고 GLB에도 넣었다.

## 확인 이미지

- [Blender 전체 렌더](evidence/beach-pail-v10.png)
- [Blender 삽과 나무 손잡이 접사](evidence/beach-pail-v10-detail.png)
- [Unity 별도 스튜디오 렌더](evidence/beach-pail-v10-unity.png)

v5에서는 양동이 비율과 손잡이를 새로 만들었지만 삽의 모서리가 솟고 조명이 과했다. v6에서 삽을 곡면으로 재구성했고, v7–v9에서 색과 모래 분포, 접지와 목재 UV를 수정했다. v10에서는 하이라이트를 조정하고 목재 이미지를 Blender 파일에 포함했으며 접사를 추가했다.

## 원본과 제작 방법

- Blender 5.2.2 LTS, Cycles. 재생성 스크립트: `tools/create_beach_pail_v10.py`.
- 로컬 산출물: `models/beach-pail-v10.blend`, `.glb`, `.fbx`, `beach-pail-v10-wood.png`. `models/`는 Git에서 제외된다. Blender 파일에는 나무 이미지가 포함되어 있고 GLB에도 이미지가 내장된다.
- Unity 6000.6.0f1의 별도 Built-in 렌더 스튜디오에서 FBX와 베이크된 목재 이미지를 사용했다. `tools/render_beach_pail_unity_v10.cs`가 임시 단색 재질, 조명, 부드러운 접지 그림자를 만든다. 이는 게임 장면이나 게임 렌더러가 아니다.
- Blender MCP로 모델 제작과 이미지를 확인했다. Unity MCP는 편집기를 찾지 못해 Unity 편집기의 배치 모드로 임포트·렌더했다.

## 검증과 남은 점

- Blender에서 목재 구멍 중심으로 광선을 통과시키면 통과하고, 구멍 옆 목재를 향하면 부딪힌다. 모델 최저점은 `z = 0`이다.
- GLB를 별도 Blender 세션에 다시 불러와 메시 14개, 이미지 1개, 최저점 0을 확인했다. **136,636 triangles**로, 시각 개발용 원본이다. 게임 적용 전에는 형태와 모래 표현을 유지하는 최적화가 필요하다.
- Unity FBX 임포트와 스튜디오 렌더가 완료됐다. Blender의 절차적 미세 범프는 Unity 임시 재질에 전달하지 않았다. Unity의 조명·그림자와 Blender 렌더가 다르게 보인다.
- 렌더에서 모래 알갱이는 원본보다 다소 각지고, 몸체와 삽의 재질은 더 섬세하게 다듬을 여지가 있다. 게임 내 크기·실제 화면·성능·기기별 결과는 아직 검증하지 않았다.

## 2026-11-03: v11–v12 조정

- v11에서 삽 날의 곡선을 둥근 사각형에 가깝게 바꾸고, 모래 입자를 각 표면의 기울기에 맞춰 놓았다. 양동이 옆면의 입자도 표면을 향하게 했으며, 모래 더미의 색 변화와 목재 결의 대비를 조절했다. 몸체 물결 홈도 조금 더 얇게 조정했다.
- v11 렌더에서는 알갱이가 지나치게 작아 더미가 매끄럽게 보였다. v12에서 입자 크기와 모래 표면의 범프를 다시 조절해 가독성을 높였다.
- 결과: [v12 Blender 전체](evidence/beach-pail-v12.png), [삽 접사](evidence/beach-pail-v12-detail.png), [Unity 스튜디오](evidence/beach-pail-v12-unity.png). Blender 재생성은 `tools/create_beach_pail_v12.py`, Unity 스튜디오는 `tools/render_beach_pail_unity_v11.cs`를 사용했다.
- 두 MCP 연결이 응답하지 않아 Blender 5.2.2와 Unity 6000.6.0f1을 각각 별도 배치 세션으로 실행했다. Unity는 임시 재질과 인위적인 접지 그림자를 사용하는 독립 스튜디오다. Blender의 절차적 모래 색과 범프는 Unity에 그대로 전달되지 않는다.
- v12 GLB를 별도 Blender 프로세스에서 재임포트하여 메시 14개, 내장 이미지 1개, 최저점 z=0, **182,734 triangles**를 확인했다. Unity에서도 FBX 임포트, 목재 텍스처 연결과 렌더 완료를 확인했다.
- 여전히 컨셉과 완전히 같지는 않다. 확대하면 삽의 모래가 미세한 점처럼 보이며, Unity의 조명과 그림자는 Blender와 차이가 있다. 이 버전은 시각 개발 원본이며, 삼각형 수가 높아 게임 적용 전에 최적화와 실제 게임 화면·성능 확인이 필요하다.

## 2026-11-03: v13 — Blender / Unity 비교와 재조정

- 기준 이미지는 그대로 두고, Blender MCP로 v12 장면의 사본을 가져와 삽 가장자리를 최대 8mm 올리고 민트색 플라스틱과 나뭇결을 조정했다. 손잡이 목재 색은 다시 베이크하여 Blender 파일과 GLB에 포함했다. 원본 Blender 장면은 남겨 두었다.
- 별도 Unity 스튜디오에서 FBX와 목재 텍스처를 불러와 형태와 재질을 비교했다. 삽 안의 모래가 작게 보이므로 입자 분포를 넓혔고, 접사에서 덩어리처럼 보인 연속된 모래 면은 제거했다. Blender에서 개별 입자와 곡면의 접촉을 다시 조정해 최종 렌더했다.
- 결과: [Blender 전체](evidence/beach-pail-v13-blender.png), [Blender 삽 접사](evidence/beach-pail-v13-detail.png), [Unity 스튜디오](evidence/beach-pail-v13-unity.png). 모델 파일은 로컬 `models/beach-pail-v13.blend`, `.glb`, `.fbx`와 `beach-pail-v13-wood.png`이며 `models/`는 Git에서 제외된다.
- 재현 순서: v12 장면의 복사본을 `Pail | v13 lookdev`로 준비하고 `tools/refine_beach_pail_v13.py` → `tools/finish_beach_pail_v13.py` → `tools/polish_beach_pail_v13.py` → `tools/export_beach_pail_v13.py`를 실행한다. `tools/render_beach_pail_unity_v13.cs`는 별도 Unity 스튜디오용이고, `tools/render_beach_pail_blender_v13.py`는 Blender 접사와 최종 전체 렌더용이다. 각 단계는 진행 상태를 장면에 기록한다.
- Unity MCP는 편집기 연결 상태를 확인했지만 작업 도구 목록이 갱신되지 않았다. 따라서 격리된 Unity 6000.6.0f1 프로젝트의 로컬 Pipeline에서 스튜디오 스크립트를 실행했다. Unity 렌더는 임시 재질과 인위적인 접지 그림자를 사용하며 Blender 재질 전체를 재현하지 않는다.
- [Scenario Blender 제작 가이드](https://github.com/scenario-labs/skills/blob/main/skills/dcc/blender/scenario-blender-expert/SKILL.md)와 [조명 가이드](https://github.com/scenario-labs/skills/blob/main/skills/dcc/blender/scenario-blender-lighting-rendering/SKILL.md)를 참고해 장면 사본, 여러 시점 검토, 넓은 조명과 렌더 비교를 적용했다. 저장소 복제는 403으로 실패해 Scenario 도구 자체는 설치하거나 실행하지 않았다.
- 검증: Unity에서 렌더러 15개와 목재 텍스처 연결을 확인했다. GLB를 Blender의 임시 빈 장면에 다시 불러와 메시 15개, 이미지 1개, 최저점 z=0, **202,734 triangles**를 확인했고 임시 장면은 제거했다. Python 스크립트 구문 검사도 통과했다.
- 남은 점: 이 수치는 게임용으로 최적화한 모델이 아니라 시각 개발 원본이다. Unity와 Blender의 표면·그림자는 다르고, 실제 게임 화면과 성능은 검증하지 않았다.
