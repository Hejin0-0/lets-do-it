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

Sol은 더 정돈된 3차, Luna는 표면 질감이 조금 더 보이는 5차를 선호했다. 둘 다 합격을 주지 않았으며, 두 번의 추가 실험도 핵심 재질 문제를 해결하지 못해 두 후보를 보존하고 반복을 중단했다. 남은 과제는 실제 루프 섬유의 크기와 방향, 자연스러운 압축·처짐, 납작한 봉제 띠, Blender와 Unity 간 색·재질 정합이다.

## 파일과 재현

- [편집 가능한 Blender 3차](../art-source/beach-towels/beach-towels-r3.blend), [편집 가능한 Blender 5차](../art-source/beach-towels/beach-towels-r5.blend). 5차의 높이 맵은 Blender 파일에 포함돼 있다.
- [Blender 생성 스크립트](../tools/create_beach_towels.py), [구성 검사](../tools/verify_beach_towels.py), [FBX 내보내기](../tools/export_beach_towels.py).
- [Unity 촬영 도구](../tools/render_beach_towels_unity.cs), [Unity 룩 개발 셰이더](../tools/TowelLookdev.shader). Unity에서는 별도로 세계 좌표 투영과 조명으로 재질을 근사한다. 바닥 그림자는 촬영용으로 별도 연출했다.
- 4·5차의 [테리 높이 맵](../art-source/textures/terry_cloth_disp_2k.jpg)은 [Poly Haven의 Terry Cloth](https://polyhaven.com/a/terry_cloth), Rico Cilliers와 colormass의 CC0 자료다. 원본 파일 MD5는 `193d07015ed427f223c323391962cfe4`다.

프로젝트 디렉터리에서 Blender 5.2.2 LTS로 다시 만드는 예:

```sh
cd projects/rubber-duck-pool
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 6 --python-exit-code 1 -P tools/create_beach_towels.py -- 5
/Applications/Blender.app/Contents/MacOS/Blender -b models/beach-towels-r5.blend --python-exit-code 1 -P tools/verify_beach_towels.py
/Applications/Blender.app/Contents/MacOS/Blender -b models/beach-towels-r5.blend --python-exit-code 1 -P tools/export_beach_towels.py
```

`models/`의 생성 파일은 Git에서 제외되므로, 위에 링크한 `art-source/`의 두 `.blend`와 스크립트를 보존한다. FBX는 현재 별도 Unity 촬영용이며 최적화된 게임 납품본이 아니다.

## 검증과 제한

- 모델 구성/크기 검사: 1차와 5차에서 통과. 검사 자체는 빈 Blender 장면에서 예상대로 실패하는 것을 먼저 확인했다.
- Scenario `bx_audit.deliverable(profile='render')`: 3차는 오류·경고 없이 통과했다. 수정자가 반영된 3개 주요 메시의 삼각형은 각각 168,130 / 168,118 / 133,466개, 합계 **469,714개**다. 5차도 오류 없이 통과했지만 마주 보는 면 8개와 이미지 맵용 UV 부재 3건을 경고했다. 수치는 마감선 곡선을 제외한다.
- 따라서 두 후보 모두 게임용 리토폴로지, UV와 텍스처 베이킹, 실제 Three.js 재질·성능·배치 검증이 필요하다. 5차의 UV 경고는 현재 Blender의 객체 좌표/Unity의 월드 좌표 투영이 작동한다는 사실과 별개로, 일반적인 텍스처 납품과 게임 엔진 이식에 남은 한계다.
- 독립 Unity 6000.6.0f1 프로젝트에서 1~5차를 렌더했고, 촬영 스크립트 컴파일은 오류·경고 0건이었다. Scenario Unity 이미지 점검은 3차·5차에서 오류 대신 밝기/채도 정보만 보고했다. 이 검사는 미술 품질, 게임 장면 또는 실제 기기 성능의 증명이 아니다.
- Blender MCP는 열려 있던 미저장 장면을 보존하기 위해 상태·렌더 확인에 사용했고, 모델 생성과 렌더는 별도 Blender 프로세스에서 수행했다. Unity는 연결된 Pipeline과 Unity CLI로 조작했다. 크래퍼·드라이어·뮤테이터 실행 파일은 이 환경에 없었다.

## 작업 로그

1. 기존 의자·양동이와 수영장 소품 목록을 살펴 타월을 골랐다. ImageGen 컨셉을 만들고 독립 Blender 파일에 새 메시를 구성했다.
2. 두 평가자의 공통 지적에 따라 두께·접힘 방향·나선 끝을 세 차례에 걸쳐 수정하며 Blender/Unity 렌더를 비교했다.
3. 표면 노이즈가 테리 천으로 보이지 않아 CC0 실제 높이 맵을 시험했다. 얼룩과 반복 패턴이 생겨 맵 강도와 크기를 줄이고 형태·마감선을 다시 조정했다.
4. 다섯 차례 렌더 결과와 평가를 보존하고, 더 이상의 표면 조절만으로는 개선이 정체됐다고 판단했다. 별도의 메시 검사, Unity 컴파일·이미지 검사와 재현 경로를 남겼다.
