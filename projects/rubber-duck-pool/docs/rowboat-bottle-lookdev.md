# 병 속 노 젓는 배: 룩데브 기록

2026-11-15 · 상태: **독립 룩데브와 게임용 경량 후보**. 기존 게임 수집품은 교체하지 않았다. Blender 스튜디오와 별도 Unity 프로젝트의 이미지는 실제 게임 화면이 아니다.

## 방향과 산출물

의자의 따뜻한 목재와 청록·아이보리 색감에 맞춰, 맑은 유리병 안에 열린 목선과 바다를 넣었다. 선체 안쪽에는 곡선 늑골, 세 개의 가로 좌석과 바닥판이 있고 두 노와 작은 황동 랜턴을 얹었다. 병은 목재 받침에 놓인다. 이는 기존 범선 병의 병·받침을 재사용하는 새로운 수집품 연구이며, 러버덕 자체의 형태는 바꾸지 않았다.

- [Scenario 콘셉트](https://app.scenario.com/assets?openAssetId=asset_todZNMMzZeRm4ghEHqb76Hp8&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ): GPT Image 2.6 Sunburst, Default Project, 13 CU. 이미지는 형태와 재질의 참고이고 아래 파일은 Blender에서 제작한 별도의 3D 결과다. 콘셉트는 초기 모델 작업 이후 추가 비교 자료로 생성했다.
- [편집 가능한 Blender 원본](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9.blend) · [고해상도 GLB](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9.glb) · [FBX](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9.fbx)
- [경량 GLB](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-lod.glb) · [경량 FBX](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-lod.fbx)
- [Blender 최종 렌더](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-blender.png) · [유리를 숨긴 내부](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-cutaway.png) · [Unity 비교 렌더](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-unity.png)
- [경량 Blender 비교](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-lod-blender.png) · [경량 Unity 비교](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v9-lod-unity.png) · [Scenario 참고 이미지](../assets/02_models/props/rowboat-bottle-study/rowboat-scenario-concept.png)

목재 이미지 두 장은 GLB에 내장되어 있으며 FBX 내보내기에도 포함했다. Unity 비교 스크립트는 이를 별도 PNG에서 명시적으로 불러온다. 최종 산출물과 비교에 필요한 주요 렌더만 버전 관리하고 나머지 중간 산출물은 로컬에 그대로 두었다. v1–v5의 GLB는 평가된 모디파이어가 포함되지 않은 초기 산출물이므로 최종 모델로 사용하지 않는다. v7의 지나친 베벨은 면적이 0인 삼각형을 만들었고 v8에서 수정했다.

## 작업과 개선 기록

1. 정리 후 파일의 존재와 Git 상태를 확인하고, 이전 수집품·다른 작업의 미커밋 파일을 보존했다. 아트 디렉션과 기존 병 연구를 확인하여 수집품 크기와 시각 언어를 정했다.
2. **v1:** 병·받침 안에 열린 선체, 좌석, 노와 랜턴을 만들고 첫 Blender 및 Unity 비교를 했다. 내부 부품 누락과 병 밖 돌출을 잡기 위한 검사를 추가했다. [Blender](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v1-blender.png)
3. **v2:** 선체 비율을 조정하고 늑골·선체 이음매와 물을 보강했다. **v3:** 배를 늘리고 선체 곡선, 노, 랜턴과 세부 금속 부품을 조정했다. [v3 Blender](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v3-blender.png)
4. **v4:** 시점을 높여 열린 내부가 잘 보이게 하고 병 유리·랜턴·빛을 손봤다. **v5:** 물결과 도장판의 색 차이를 다듬었다. [v5 Blender](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v5-blender.png)
5. **v6:** GLB 내보내기에 평가된 모디파이어를 포함해 Blender와 내보낸 모델의 차이를 수정했다. **v7:** 편집 원본은 부품을 유지하면서 내보낼 때 불투명 부품과 유리를 두 메시로 합쳤다. [v7 Blender](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v7-blender.png)
6. 별도의 선택적 디시메이션으로 경량 후보를 만들고 원본·Unity와 실루엣을 비교했다. 유리·노·랜턴은 남기고 작은 고정핀 등은 경량 버전에서 생략했다.
7. **v8:** 실제 삼각형 위치까지 원본과 GLB를 비교하는 검사를 보강하고, 얇은 부품의 베벨 폭을 제한해 면적이 0인 삼각형을 제거했다. [v8 Blender](../assets/02_models/props/rowboat-bottle-study/rowboat-bottle-v8-blender.png)
8. **v9:** 단색처럼 보이는 내부 목재에 UV와 절제된 나뭇결 이미지를 추가했다. 고해상도와 경량 모델을 다시 내보내고 Blender·Unity에서 재렌더링했다. 진행 중 발견한 불일치·예산 초과·누락 텍스처를 먼저 실패시키는 검사로 확인한 뒤 수정했다.
9. 결과와 재현 방법, 실제 확인한 범위 및 남은 검증을 이 문서에 기록했다. `crapper`, `dryer`, `mutator` 실행 도구는 현재 환경에서 찾지 못해 실행하지 않았다.

## 검증 결과

- Blender **5.3.0**: 원본 선체는 닫힌 메시이며 양의 부피가 있고, 배의 평가된 꼭짓점이 병의 근사 내부 경계를 넘지 않는지 검사했다. `ROWBOAT_CHECK_OK objects=76 triangles=12232 hull_volume=0.002170`. 여기의 삼각형은 병·받침을 제외한 배 부품의 수다.
- 최종 원본과 GLB: 월드 좌표에서 재질별 삼각형을 0.0001 단위 정밀도로 비교하고 면적이 0인 삼각형, 바운드, 재질, 스튜디오 오브젝트 유출을 검사했다. `ROWBOAT_EXPORT_OK triangles=29120 meshes=2 materials=17 max_bound_error=0.00000000`. 이 검사는 노멀이나 셰이더·시각적 일치를 증명하지 않는다.
- 경량 GLB: `ROWBOAT_LOD_OK triangles=6769 meshes=2 max_bound_error=0.000357`. 기존 수집품 변환기의 사전 세분화 목표 8,000 삼각형 이하다. 최종 웹 변환 후 삼각형 수와 성능은 측정하지 않았다.
- 두 GLB 모두 목재 재질의 이미지가 내장되고 UV가 존재하는지 검사했다. UV 데이터에 서로 다른 좌표가 있는지도 별도로 확인했다. Blender 원본의 절차적 범프가 GLB에 동일하게 전달된다는 뜻은 아니다.
- Unity **6000.6.8f1**의 일회용 Built-in Render Pipeline 프로젝트에서 최종 FBX와 경량 FBX를 각각 렌더링했다. 두 파일 모두 Unity Renderer 2개로 읽혔다. 17개 재질/서브메시가 있으므로 Renderer 2개가 드로콜 2개라는 뜻은 아니며 실제 배칭은 측정하지 않았다.
- Blender MCP의 격리된 세션을 사용해 장면을 점검했고, Unity MCP에 사용할 수 있는 편집기 연결이 없어 지정된 Unity Editor를 CLI로 직접 실행했다. Unity의 유리는 룩데브용 간이 투명 셰이더라 Blender 유리와 물리적으로 같지 않다.
- Python 스크립트 문법 검사 통과. 실제 웹 게임 적용, 웹 렌더러의 텍스처·투명도, 여러 시간대와 게임 카메라, 모바일 및 FPS 검증은 하지 않았다. 게임 코드 변경이 없어 전체 게임 테스트와 빌드도 이번에는 실행하지 않았다.

## 재현

저장소 루트에서 실행한다. Blender 생성기는 기존 범선 연구의 `sailboat-bottle-v9.blend`와 `tools/bottle_collection_water.py`를 읽고 이 연구 디렉터리에 같은 이름의 결과를 다시 쓴다. 원본과 경량 생성을 다시 돌릴 때는 그 결과 파일이 덮어써진다.

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
STUDY=projects/rubber-duck-pool/assets/02_models/props/rowboat-bottle-study
TOOLS=projects/rubber-duck-pool/tools

"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/create_rowboat_bottle_study.py" -- 9
"$BLENDER" -b "$STUDY/rowboat-bottle-v9.blend" -t 6 --python-exit-code 1 --python "$TOOLS/create_rowboat_bottle_lod.py"
"$BLENDER" -b "$STUDY/rowboat-bottle-v9.blend" -t 6 --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_study.py"
"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_export.py" -- "$STUDY/rowboat-bottle-v9.blend" "$STUDY/rowboat-bottle-v9.glb"
"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_lod.py" -- "$STUDY/rowboat-bottle-v9.glb" "$STUDY/rowboat-bottle-v9-lod.glb"
python3 "$TOOLS/check_rowboat_gltf_textures.py" "$STUDY/rowboat-bottle-v9.glb" "$STUDY/rowboat-bottle-v9-lod.glb"
```

Unity 비교는 일회용 `/private/tmp/rowboat-bottle-unity-6000.6.8f1` 프로젝트에서 `tools/render_rowboat_bottle_unity.cs`와 `tools/rowboat_preview_glass.shader`를 사용했다. FBX 및 두 목재 PNG를 프로젝트 `Assets/`에 복사하고 `ROWBOAT_REVISION=9`, `ROWBOAT_OUTPUT_DIR`을 지정해 `RowboatBottleStudio.Render`를 호출한다. 경량 비교에는 `ROWBOAT_LOD=1`을 더한다. 스크립트는 해당 버전·일회용 프로젝트만 허용한다.

## 게임 적용 전 남은 일

게임의 변환기는 이미지 텍스처를 직접 사용하는 대신 삼각형 색으로 샘플링하므로 세부 나뭇결과 최종 삼각형 수를 실제 변환 결과로 확인해야 한다. 투명 병, 물과 내부의 정렬을 WebGPU에서 확인하고, 기존 두 번째 선반 수집품과 교체할지 결정한 뒤 실제 카메라와 주변 오브젝트에서 크기·가독성·성능을 검증한다. 스튜디오 이미지와 삼각형 예산만으로 AAA 완성도나 게임 적용 준비를 판정하지 않는다.
