# 비치 타월 룩 개발 기록

## 상태

수영장 옆의 접힌 아이보리·코랄 타월과 말린 씨글라스 타월을 위한 **독립 룩 개발 시안**이다. 기존 임시 소품의 메시를 재사용하지 않았다. 현재 게임에 연결하지 않았으며, AA급 완성품이나 게임 배치 준비가 끝난 에셋으로 판정하지 않았다.

[컨셉](evidence/beach-towels-concept.png)은 기존 의자·양동이의 분위기를 참고해 ImageGen으로 만든 이미지다. 폼 시트보다 부드럽고 두툼한 테리 천, 노란 포인트와 간결한 줄무늬를 목표로 했다. Scenario의 로컬 Blender/Unity 작업·검사 가이드를 사용했다. Scenario 클라우드 생성 도구는 이 세션에서 제공되지 않았다.

## 반복과 독립 평가

각 점수는 같은 이미지를 독립적으로 본 두 평가자의 100점 만점 종합 점수이며, 합격 기준은 85점이다. Unity 이미지는 별도 스튜디오 장면이고 게임 스크린샷이 아니다.

| 단계 | 변경 이유와 결과 | Sol | Luna | 렌더 |
| --- | --- | ---: | ---: | --- |
| 1 | 기본 접힘·나선·팔레트. 판처럼 얇고 매끈함. | 62 | 62 | [Blender](evidence/beach-towels-r1-blender.png) · [Unity](evidence/beach-towels-r1-unity.png) |
| 2 | 실제 층 두께와 약한 요철 추가. 여전히 반듯하고 Unity는 거칠게 보임. | 71 | 83 | [Blender](evidence/beach-towels-r2-blender.png) · [Unity](evidence/beach-towels-r2-unity.png) |
| 3 | 접힘 방향을 바꾸고 롤의 튀어나온 끝을 아래로 이동. 형태는 나아졌지만 테리 조직은 약함. | 73 | 83 | [Blender](evidence/beach-towels-r3-blender.png) · [Unity](evidence/beach-towels-r3-unity.png) |
| 4 | 실제 테리 높이 맵과 압축을 추가. 맵이 특히 Unity에서 얼룩무늬처럼 보이는 퇴행 발생. | 70 | 79 | [Blender](evidence/beach-towels-r4-blender.png) · [Unity](evidence/beach-towels-r4-unity.png) |
| 5 | 맵을 더 촘촘하고 약하게, 접힌 모서리와 별도 마감선을 추가. 얼룩은 줄었지만 마감선이 기계적이라는 평가. | 72 | 84 | [Blender](evidence/beach-towels-r5-blender.png) · [Unity](evidence/beach-towels-r5-unity.png) |

이 시점에 Sol은 더 정돈된 3차, Luna는 표면 질감이 조금 더 보이는 5차를 선호했다. 둘 다 합격을 주지 않았고, 두 후보를 보존한 뒤 아래의 추가 실험을 진행했다.

## 추가 구조·재질 실험

단순히 평평하게 접힌 표면에 질감만 얹으면 폭신한 천으로 읽힐 것이라는 가정을 버렸다. 접힌 두 장과 말린 한 장, 세 물체 모두에서 형태가 뻣뻣해지는 같은 문제가 보였기 때문이다. 천의 교차 단면과 눌림, 말린 끝, 재질 UV를 별도로 바꿔 검토했다. 물리 시뮬레이션을 포함한 여러 형상 실험에서는 접힘이 찢어지거나 모서리가 판처럼 각져 후퇴했다.

| 단계 | 확인한 것 | 독립 평가 |
| --- | --- | --- |
| 13~15 | 실제 테리 법선·거칠기 맵을 사용하고, 테두리 면의 0 면적 UV를 수정했다. 14차에서 줄무늬 재질이 사라지는 회귀를 발견해 15차에서 수정했다. | 13차 Blender: Sol 65, Luna 69. [15차 Blender](evidence/beach-towels-r15-blender.png) |
| 16~19 | 실제 U자 실 고리를 Blender 지오메트리 노드로 표면에 배치하고 밀도와 크기를 바꿨다. 19차의 넓은 끝단 재질이 플라스틱 캡처럼 보여 제외했다. | 17차 Blender: Sol 79, Luna 74. 19차 Blender: Sol 76, Luna 77. [17차](evidence/beach-towels-r17-blender.png) · [19차](evidence/beach-towels-r19-blender.png) |
| 20~23 | 끝단의 테리 표면을 복원하고 폭이 좁은 띠만 남겼다. 롤을 아래 타월의 실제 메시 접촉에 맞췄다. | 23차 Blender: Sol 80, Luna 78. 22차 Unity: Sol 70, Luna 68. 두 평가자 모두 불합격. [Blender](evidence/beach-towels-r23-blender.png) · [Unity](evidence/beach-towels-r22-unity.png) |
| 24~25 | 두 타월에 넓은 눌림을 주고 더 큰 실 고리를 비교했다. Unity 법선 강도도 키웠으나 고리가 아니라 거친 범프로 읽히는 부작용이 있었다. | 25차 Blender: Sol 81, Luna 79. 24차 Unity: Sol 71, Luna 67. 두 평가자 모두 불합격. [Blender](evidence/beach-towels-r25-blender.png) · [Unity](evidence/beach-towels-r24-unity.png) |
| 27~30 | 한 장의 천을 두 방향으로 접어 앞면과 측면의 U자 리턴을 만들었다. 첫 시도는 모서리 메시가 찢어졌고, 수정 후에도 교차점이 찝혔다. | 30차 Blender: Sol 84, Luna 82. 29차 Unity: 두 명 모두 76. [Blender](evidence/beach-towels-r30-blender.png) · [Unity](evidence/beach-towels-r29-unity.png) |
| 31~33 | 한 방향으로 접힌 층을 다른 접힘의 법선 방향으로 배치해 모서리 교차를 해결했다. 롤에 약한 비대칭과 접촉 압축을 주고 고리 섬유를 다시 렌더했다. | 33차 Blender: Sol 85, Luna 83. 32차 Unity: 두 명 모두 78. Blender에서도 두 평가자의 동시 합격에는 미달. [Blender](evidence/beach-towels-r33-final.png) · [확대](evidence/beach-towels-r33-detail.png) · [Unity](evidence/beach-towels-r32-unity.png) |
| 34~37 | Unity에 실제 U자 섬유를 추가했다. 전면 519,215개는 점노이즈로 퇴행했고, 윤곽 7,318개 실험은 노이즈를 줄였지만 재질을 충분히 개선하지 못했다. | 37차 Unity: Sol 79, Luna 75. 두 명 모두 불합격. [전면 실험](evidence/beach-towels-r36-unity.png) · [윤곽 실험](evidence/beach-towels-r37-unity.png) |

점수는 각 평가자의 별도 시각 평가이며 85점이 합격 기준이다. 33차 Blender와 37차 Unity의 종합 평가는 Sol 82, Luna 79로 둘 다 불합격이다. 이 정지 이미지 평가는 게임 플레이 중 품질이나 성능을 보증하지 않는다.

Blender의 실제 고리는 렌더 전용 인스턴스로, Unity FBX에는 포함되지 않는다. Unity 32차는 같은 CC0 스캔의 법선·거칠기 맵을 사용하고, 37차는 촬영 카메라 윤곽에만 별도의 고리 인스턴스를 추가한다. 어느 쪽도 Blender의 섬유와 동일하다고 볼 수 없다. Sol은 37차, Luna는 더 깨끗한 32차를 선호해 두 결과를 보존했다. 두 렌더 모두 게임 장면이 아닌 독립 스튜디오다.

추가한 법선·거칠기 맵은 [Poly Haven Terry Cloth](https://polyhaven.com/a/terry_cloth)의 CC0 자료다. 원본 MD5는 각각 `3bc86d8b716890255c36ae677871ae42`, `154d391feac507d293ee65e313450108`다. 두 맵을 비색상 데이터로 취급하고 Blender 파일에 포함했다.

## 파일과 재현

- [편집 가능한 Blender 3차](../art-source/beach-towels/beach-towels-r3.blend), [편집 가능한 Blender 5차](../art-source/beach-towels/beach-towels-r5.blend). 5차의 높이 맵은 Blender 파일에 포함돼 있다.
- [Blender 생성 스크립트](../tools/create_beach_towels.py), [구성 검사](../tools/verify_beach_towels.py), [FBX 내보내기](../tools/export_beach_towels.py).
- [Unity 촬영 도구](../tools/render_beach_towels_unity.cs), [Unity 룩 개발 셰이더](../tools/TowelLookdev.shader). Unity에서는 별도로 세계 좌표 투영과 조명으로 재질을 근사한다. 바닥 그림자는 촬영용으로 별도 연출했다.
- 추가 작업의 편집 가능한 [Blender 33차](../art-source/beach-towels/beach-towels-r33.blend), [접힘](../tools/refold_towel_crosswise.py), [롤](../tools/refine_towel_roll.py), [테리 고리](../tools/add_towel_terry_loops.py), [구성 검사](../tools/verify_towel_refinement.py)와 [Blender 촬영 도구](../tools/render_towel_final.py). 33차에는 스캔 맵이 포함돼 있다.
- 추가 [Unity 촬영 도구](../tools/render_towel_scan_unity.cs), [스캔 셰이더](../tools/TowelTerryScan.shader), [섬유 셰이더](../tools/TowelFiber.shader). 카메라에 따른 섬유 인스턴스는 독립 촬영용 실험이며 게임의 LOD나 성능 최적화 구현이 아니다.
- 4·5차의 [테리 높이 맵](../art-source/textures/terry_cloth_disp_2k.jpg)은 [Poly Haven의 Terry Cloth](https://polyhaven.com/a/terry_cloth), Rico Cilliers와 colormass의 CC0 자료다. 원본 파일 MD5는 `193d07015ed427f223c323391962cfe4`다.

프로젝트 디렉터리에서 Blender 5.2.2 LTS로 다시 만드는 예:

```sh
cd projects/rubber-duck-pool
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 6 --python-exit-code 1 -P tools/create_beach_towels.py -- 5
/Applications/Blender.app/Contents/MacOS/Blender -b models/beach-towels-r5.blend --python-exit-code 1 -P tools/verify_beach_towels.py
/Applications/Blender.app/Contents/MacOS/Blender -b models/beach-towels-r5.blend --python-exit-code 1 -P tools/export_beach_towels.py
```

`models/`의 생성 파일은 Git에서 제외되므로, 위에 링크한 `art-source/`의 `.blend` 파일과 스크립트를 보존한다. FBX는 현재 별도 Unity 촬영용이며 최적화된 게임 납품본이 아니다.

추가 33차는 저장된 Blender 원본에서 검사·내보내기·렌더할 수 있다. 중간 버전들은 이 저장소에 포함하지 않았으므로, 아래는 3차부터 33차까지의 전체 생성 과정을 재현하는 명령이 아니다.

```sh
cd projects/rubber-duck-pool
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
"$BLENDER" -b art-source/beach-towels/beach-towels-r33.blend --python-exit-code 1 -P tools/verify_towel_refinement.py
"$BLENDER" -b art-source/beach-towels/beach-towels-r33.blend --python-exit-code 1 -P tools/export_towel_refinement.py
"$BLENDER" -b art-source/beach-towels/beach-towels-r33.blend --python-exit-code 1 -P tools/render_towel_final.py
```

## 검증과 제한

- 모델 구성/크기 검사: 1차와 5차에서 통과. 검사 자체는 빈 Blender 장면에서 예상대로 실패하는 것을 먼저 확인했다.
- Scenario `bx_audit.deliverable(profile='render')`: 3차는 오류·경고 없이 통과했다. 수정자가 반영된 3개 주요 메시의 삼각형은 각각 168,130 / 168,118 / 133,466개, 합계 **469,714개**다. 5차도 오류 없이 통과했지만 마주 보는 면 8개와 이미지 맵용 UV 부재 3건을 경고했다. 수치는 마감선 곡선을 제외한다.
- 따라서 두 후보 모두 게임용 리토폴로지, UV와 텍스처 베이킹, 실제 Three.js 재질·성능·배치 검증이 필요하다. 5차의 UV 경고는 현재 Blender의 객체 좌표/Unity의 월드 좌표 투영이 작동한다는 사실과 별개로, 일반적인 텍스처 납품과 게임 엔진 이식에 남은 한계다.
- 독립 Unity 6000.6.0f1 프로젝트에서 1~5차를 렌더했고, 촬영 스크립트 컴파일은 오류·경고 0건이었다. Scenario Unity 이미지 점검은 3차·5차에서 오류 대신 밝기/채도 정보만 보고했다. 이 검사는 미술 품질, 게임 장면 또는 실제 기기 성능의 증명이 아니다.
- Blender MCP는 열려 있던 미저장 장면을 보존하기 위해 상태·접촉 검사에 사용했고, 모델 생성과 렌더는 별도 Blender 프로세스에서 수행했다. Unity는 연결된 Pipeline과 Unity CLI로 조작했다. 크래퍼·드라이어·뮤테이터 실행 파일은 이 환경에 없었다.
- 33차 Blender 검사: 세 메시 **489,986개 삼각형**, 유효 면에서 0 면적 UV 0개, 법선·거칠기 맵 포함 및 줄무늬 재질 확인. 롤과 산호 타월 사이의 9개 표본 간격은 **0.192~0.212mm**였다. 빈 장면은 예상대로 검사에 실패했다. 이 수치는 자체 교차 전체나 실물 섬유 품질을 증명하지 않는다.
- 33차 Blender와 32·37차 Unity는 각각 실제로 렌더했다. Unity 스튜디오 코드는 엄격 컴파일에서 오류·경고가 없었다. Unity CLI/Pipeline을 사용했으며, 이 세션의 Unity MCP에는 에디터 조작 도구가 노출되지 않았다. Scenario 클라우드 생성 도구도 연결되지 않아 로컬 Scenario 가이드만 사용했다.
- 새 메시와 실고리는 게임용 예산으로 최적화하지 않았다. Unity 37차의 7,318개는 촬영 각도에 따른 임시 인스턴스다. 실제 게임 통합, 저사양 성능, 애니메이션·실기기 검증은 하지 않았다.

## 작업 로그

1. 기존 의자·양동이와 수영장 소품 목록을 살펴 타월을 골랐다. ImageGen 컨셉을 만들고 독립 Blender 파일에 새 메시를 구성했다.
2. 두 평가자의 공통 지적에 따라 두께·접힘 방향·나선 끝을 세 차례에 걸쳐 수정하며 Blender/Unity 렌더를 비교했다.
3. 표면 노이즈가 테리 천으로 보이지 않아 CC0 실제 높이 맵을 시험했다. 얼룩과 반복 패턴이 생겨 맵 강도와 크기를 줄이고 형태·마감선을 다시 조정했다.
4. 다섯 차례 렌더 결과와 평가를 보존하고, 더 이상의 표면 조절만으로는 개선이 정체됐다고 판단했다. 별도의 메시 검사, Unity 컴파일·이미지 검사와 재현 경로를 남겼다.
5. Scenario와 Blender 가이드를 확인하고 CC0 테리 법선·거칠기 스캔, UV 보정, 실제 메시 접촉과 렌더 전용 실 고리를 시험했다. 반복 평가에서 캡·얼룩·과한 요철 등 퇴행을 발견해 비교본과 함께 남겼다.
6. 단일 시트의 이중 접힘을 새로 만들었다. 교차점의 수학적 특이점과 찝힘을 수정하고 롤을 접촉면에 재배치했다. Blender와 Unity로 렌더한 뒤 두 평가자가 각각 검수했다.
7. Unity 고리 전면 배치와 윤곽 배치를 비교했다. 둘 다 동시 합격에 이르지 못해 Blender 33차와 Unity 32·37차를 시안으로 보존하고, 확대 렌더·검사·남은 과제를 기록했다.
