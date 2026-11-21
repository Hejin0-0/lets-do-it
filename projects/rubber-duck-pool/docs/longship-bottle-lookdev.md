# 병 속 바이킹선: 룩데브 기록

2026-11-15 · 상태: **독립 룩데브와 게임용 경량 후보**. 현재 게임의 수집품은 교체하지 않았다. 스튜디오 렌더는 실제 게임 화면이 아니다.

## 방향과 산출물

두 번째 선반의 `Longship in a bottle`을 새로 연구했다. 같은 병·물·나무 받침을 쓰는 노 젓는 배 및 잠수함과 함께 놓였을 때 구별되도록, 끝이 높게 말린 목선과 아이보리·산호색 줄무늬 돛, 양옆의 둥근 방패를 중심으로 만들었다.

- [Scenario 콘셉트](https://app.scenario.com/assets?openAssetId=asset_gHyXjwbZ72QyZJziZDeRXxF9&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ): GPT Image 2.6 Sunburst, Default Project, 10 CU. 앞선 잠수함 콘셉트를 병의 분위기 참고로 사용했다. 이미지는 3D 모델이 아니라 형태와 색을 위한 시각 자료다.
- [Blender 편집 원본](../assets/02_models/props/longship-bottle-study/longship-bottle-v5.blend) · [고해상도 GLB](../assets/02_models/props/longship-bottle-study/longship-bottle-v5.glb) · [고해상도 FBX](../assets/02_models/props/longship-bottle-study/longship-bottle-v5.fbx)
- [경량 GLB](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-lod.glb) · [경량 FBX](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-lod.fbx)
- [Blender 최종 렌더](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-blender.png) · [유리를 숨긴 내부](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-cutaway.png) · [Unity 비교](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-unity.png)
- [경량 Blender 비교](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-lod-blender.png) · [경량 Unity 비교](../assets/02_models/props/longship-bottle-study/longship-bottle-v5-lod-unity.png) · [Scenario 이미지](../assets/02_models/props/longship-bottle-study/longship-scenario-concept.png)

선체의 나뭇결 [이미지](../assets/02_models/props/longship-bottle-study/longship-wood.png)는 GLB에 내장되며 Unity 비교기는 별도 PNG를 읽는다. Blender 돛의 미세 범프는 절차적 재질로, GLB에 같은 모습으로 전달되는 것을 확인하지 않았다. 최종 모델과 비교 렌더만 버전 관리하고 다른 중간 결과는 로컬에 남겨두었다.

## 작업과 개선 기록

1. 정리된 폴더에서 아트 디렉션과 현재 선반의 수집품 목록을 확인한 뒤, 기존 파일이나 게임 코드를 건드리지 않는 독립 연구로 대상을 정했다. Scenario에서 하나의 콘셉트를 만들었다.
2. **v1:** 열린 선체, 돛대·줄무늬 돛, 방패와 말린 양 끝을 모델링했다. Blender와 Unity로 확인한 결과 선체 양 끝이 낮고 재질이 단순했다. [v1](../assets/02_models/props/longship-bottle-study/longship-bottle-v1-blender.png)
3. **v2:** 선체 양 끝의 곡선을 높이고 널빤지 이음매, 늑골, 방패 테두리와 돛 연결줄을 추가했다. 이음매가 없는 v1이 검사에서 실패한 뒤 v2가 통과했다. [v2](../assets/02_models/props/longship-bottle-study/longship-bottle-v2-blender.png)
4. **v3:** 한쪽이 벌어져 보이던 선체 끝을 좁히고 말린 장식을 곡선으로 다시 만들었다. 노와 나뭇결 이미지를 넣고 Blender와 Unity에서 확인했다. [v3](../assets/02_models/props/longship-bottle-study/longship-bottle-v3-blender.png)
5. **v4:** 분리되어 보이던 작은 장식을 없애고 돛 아래의 곡선, 가장자리와 돛대에 묶은 끈을 추가했다. **v5:** 창백하던 목재를 따뜻하게 조정하고 돛의 미세 표면을 보강했다. Unity 스튜디오의 조명도 별도로 조정했다. [v4](../assets/02_models/props/longship-bottle-study/longship-bottle-v4-blender.png)
6. 경량 후보는 처음에 8,882삼각형으로 목표를 넘었다. 장식 단순화 후 예산에는 들어왔지만 돛 줄무늬가 지그재그로 깨졌다. 돛 메시와 재질 배치를 보존하도록 수정하고 재렌더링했다. 방패의 지나치게 각진 테두리는 경량 모델에서 생략했다. 고해상도 모델의 테두리, 돛 바느질과 묶은 끈은 유지된다.
7. 깨진 이전 경량본에서 돛 검사 실패를 확인한 뒤, 최종 경량본이 통과하는지 확인했다. Blender MCP로 격리된 장면의 원본 오브젝트도 점검했다. `crapper`, `dryer`, `mutator`는 실행 도구를 찾지 못했다.

## 확인한 결과와 한계

- Blender **5.3.0** 원본: `LONGSHIP_CHECK_OK objects=97 triangles=23604 hull_volume=0.001986`. 선체가 닫힌 메시이고 양의 부피가 있으며, 배 부품이 병의 근사 내부 경계를 넘지 않는지 검사했다. 삼각형 수는 배 부품만의 수다.
- 원본과 고해상도 GLB: `LONGSHIP_EXPORT_OK triangles=40492 meshes=2 materials=13 max_bound_error=0.00000000`. 재질별 월드 좌표 삼각형, 바운드, 면적이 0인 삼각형, 재질과 스튜디오 오브젝트 유출을 확인했다. 반올림 경계 차이는 실제 좌표 오차 0.000001 이하로 추가 비교한다. 노멀과 셰이더가 시각적으로 동일하다는 뜻은 아니다.
- 경량 GLB: `LONGSHIP_LOD_OK triangles=7692 meshes=2 max_bound_error=0.000357`. 기존 변환기의 사전 세분화 목표 8,000삼각형 이하다. `LONGSHIP_SAIL_LOD_OK triangles=568`은 원본 돛의 삼각형과 줄무늬 재질 배치가 경량 GLB에 유지되는지 확인한다. 과거 경량본은 같은 검사에서 `missing=512 of 568`로 실패했다.
- 고해상도와 경량 GLB에서 선체 나뭇결 이미지가 내장되고 UV가 있는지 확인했다. 경량본은 방패 테두리와 돛의 작은 바느질·묶음끈을 생략한다.
- Unity **6000.6.8f1**의 일회용 Built-in Render Pipeline 프로젝트에서 고해상도와 경량 FBX를 각각 렌더링했다. Renderer 2개는 드로콜 2개라는 뜻이 아니다. Unity MCP에 연결된 편집기가 없어 지정된 Editor를 CLI로 사용했고, 병 유리에는 실제 게임과 다른 간이 비교 셰이더를 썼다.
- Python 스크립트 문법 검사는 통과했다. 실제 웹 게임 적용, WebGPU의 투명도·텍스처, 게임 카메라와 시간대, 모바일 및 FPS는 확인하지 않았다. 게임 코드를 변경하지 않아 전체 게임 테스트와 빌드도 실행하지 않았다. 콘셉트에 비해 목재·돛·방패가 단순하며, 이 결과를 AAA 완성이나 게임 적용 준비로 판정하지 않는다.

## 재현

저장소 루트에서 실행한다. 생성기는 기존 범선의 `sailboat-bottle-v9.blend`와 `tools/bottle_collection_water.py`를 읽는다. 다시 생성하면 같은 이름의 모델과 렌더를 덮어쓴다.

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
STUDY=projects/rubber-duck-pool/assets/02_models/props/longship-bottle-study
TOOLS=projects/rubber-duck-pool/tools

"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/create_longship_bottle_study.py" -- 5
"$BLENDER" -b "$STUDY/longship-bottle-v5.blend" -t 6 --python-exit-code 1 --python "$TOOLS/create_rowboat_bottle_lod.py"
"$BLENDER" -b "$STUDY/longship-bottle-v5.blend" -t 2 --python-exit-code 1 --python "$TOOLS/check_longship_bottle_study.py"
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_export.py" -- "$STUDY/longship-bottle-v5.blend" "$STUDY/longship-bottle-v5.glb" Longship
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_lod.py" -- "$STUDY/longship-bottle-v5.glb" "$STUDY/longship-bottle-v5-lod.glb" Longship
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_longship_sail_lod.py" -- "$STUDY/longship-bottle-v5.blend" "$STUDY/longship-bottle-v5-lod.glb"
python3 "$TOOLS/check_rowboat_gltf_textures.py" --subject Longship "$STUDY/longship-bottle-v5.glb" "$STUDY/longship-bottle-v5-lod.glb"
```

Unity 비교는 `/private/tmp/rowboat-bottle-unity-6000.6.8f1` 일회용 프로젝트에서 `tools/render_longship_bottle_unity.cs`와 `tools/rowboat_preview_glass.shader`를 사용했다. FBX와 목재 PNG를 프로젝트 `Assets/`에 복사하고 `LONGSHIP_REVISION=5`, 절대 경로의 `LONGSHIP_OUTPUT_DIR`을 지정해 `LongshipBottleStudio.Render`를 호출한다. 경량 모델은 `LONGSHIP_LOD=1`을 추가한다.

## 게임 적용 전 남은 일

웹 변환기의 텍스처 샘플링과 투명 병·물의 정렬, 변환 후 삼각형 수와 실제 게임 시점에서의 가독성·성능을 확인해야 한다. 특히 경량 방패와 돛의 크기가 실제 화면에서 충분히 읽히는지 비교한 뒤 기존 수집품 교체 여부를 결정한다.
