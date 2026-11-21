# 병 속 잠수함: 룩데브 기록

2026-11-15 · 상태: **독립 룩데브와 게임용 경량 후보**. 실제 수집품이나 게임 장면은 교체하지 않았다. Blender와 Unity의 스튜디오 이미지는 게임 화면이 아니다.

## 방향과 산출물

두 번째 선반의 병 속 잠수함을 새로 연구했다. 앞서 만든 노 젓는 배와 병·물·목재 받침을 공유하되, 둥근 청록 선체, 황동 테두리의 창 세 쌍, 잠망경, 꼬리날개와 프로펠러로 실루엣을 구분했다. 얇은 아이보리 띠와 산호색 선은 가까이에서 발견할 수 있는 정도로 두었다. 이 콘셉트는 의자의 차분한 목재와 수영장 소품의 밝은 색감에 맞춘 것이다.

- [Scenario 콘셉트](https://app.scenario.com/assets?openAssetId=asset_3rzoWAmD6ALkQCTbDfdZo3vU&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ): GPT Image 2.6 Sunburst, Default Project, 13 CU. 이미지는 형태와 색의 참고이며 아래 결과는 Blender에서 별도로 모델링했다.
- [Blender 편집 원본](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6.blend) · [고해상도 GLB](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6.glb) · [고해상도 FBX](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6.fbx)
- [경량 GLB](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-lod.glb) · [경량 FBX](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-lod.fbx)
- [Blender 최종 렌더](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-blender.png) · [유리를 숨긴 내부](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-cutaway.png) · [Unity 비교 렌더](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-unity.png)
- [경량 Blender 비교](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-lod-blender.png) · [경량 Unity 비교](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v6-lod-unity.png) · [Scenario 참고 이미지](../assets/02_models/props/submarine-bottle-study/submarine-scenario-concept.png)

선체 에나멜 이미지는 두 GLB에 내장되어 있다. Unity 비교기는 별도 [PNG](../assets/02_models/props/submarine-bottle-study/submarine-enamel.png)를 불러온다. 최종 3D 파일과 비교에 필요한 중간 렌더만 버전 관리했고 그 외의 중간 결과는 로컬에 그대로 두었다.

## 작업과 개선 기록

1. 폴더 정리 후 기존 에셋의 파일과 Git 상태를 확인하고 다른 미커밋 작업은 보존했다. 아트 디렉션, 기존 선반과 병 모델을 살펴 다음 대상을 잠수함으로 정했다.
2. Scenario에서 콘셉트를 생성했다. **v1**에서 둥근 선체와 창, 탑, 잠망경, 꼬리날개, 프로펠러를 만들고 Blender와 Unity에서 첫 렌더를 비교했다. [v1 Blender](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v1-blender.png)
3. **v2**는 창을 키우고 날개, 띠와 나사를 조정했다. **v3**은 창틀을 두께가 있는 고리로 바꾸고 선체 띠가 창을 관통하지 않도록 나눴으며 탑을 위쪽으로 좁혔다. [v3 Blender](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v3-blender.png)
4. **v4**는 눈에 보이는 리벳과 선체 이음매를 추가하고 물의 높이를 조정했다. 원본 모델을 경량 예산 검사에 넣었을 때 실패하는지 먼저 확인한 뒤 선택적으로 단순화했다. [v4 Blender](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v4-blender.png)
5. **v5**는 결정적으로 생성한 UV 에나멜 텍스처와 더 볼록한 창을 넣었다. 누락 텍스처 검사에서 텍스처가 없는 이전 모델이 실패하는 것을 확인했지만, Blender 렌더의 선체가 너무 어둡게 보이는 회귀가 있었다. [v5 Blender](../assets/02_models/props/submarine-bottle-study/submarine-bottle-v5-blender.png)
6. **v6**은 이미지의 sRGB 인코딩과 창의 하이라이트를 수정하고 Blender와 Unity를 다시 렌더링했다. 경량화 과정에서 병목과 코르크 주변의 어두운 뭉침을 보고 유리 곡면의 보존량을 높이고 작은 장식을 더 줄여 다시 비교했다. 최종 경량 모델에서는 창의 작은 반짝임과 리벳이 생략된다.
7. 검사에서 내보내기 반올림 경계 차이를 확인해 실제 좌표 오차를 추가 비교하도록 수정했다. 반대로 꼭짓점을 0.01만큼 움직인 변조 GLB는 검사에서 실패했다. 원본·경량 모델과 Unity 결과를 재확인하고 이 기록을 남겼다. `crapper`, `dryer`, `mutator`는 실행 도구를 찾지 못했다.

## 확인한 결과와 한계

- Blender **5.3.0** 원본: `SUBMARINE_CHECK_OK objects=103 triangles=35388 hull_volume=0.024061`. 잠수함 선체가 닫힌 메시이고 양의 부피가 있으며, 잠수함의 평가된 꼭짓점이 병의 근사 내부 경계를 넘지 않는지 검사했다. 이 삼각형 수는 병과 받침을 제외한 잠수함 부품 기준이다.
- 원본과 고해상도 GLB: `SUBMARINE_EXPORT_OK triangles=52276 meshes=2 materials=13 max_bound_error=0.00000000`. 재질별 월드 좌표 삼각형을 0.0001 단위로 비교하고 반올림 경계 차이는 실제 좌표 차이 0.000001 이하로 확인했다. 면적이 0인 삼각형, 바운드, 재질, 스튜디오 오브젝트 유출도 확인했다. 노멀이나 셰이더가 시각적으로 일치한다는 증거는 아니다.
- 경량 GLB: `SUBMARINE_LOD_OK triangles=7880 meshes=2 max_bound_error=0.000357`. 기존 수집품 변환기의 사전 세분화 목표인 8,000삼각형 이하다. 이것은 웹 변환 후의 삼각형 수나 FPS가 아니다.
- 고해상도와 경량 GLB의 선체 재질에 이미지와 UV가 있는지 확인했다. 이미지가 실제 게임 변환기에서 같은 색·디테일로 표현되는지는 검증하지 않았다.
- Unity **6000.6.8f1**, 일회용 Built-in Render Pipeline 프로젝트에서 두 FBX를 렌더링했고 각각 Renderer 2개로 읽혔다. 재질과 서브메시가 여러 개이므로 이것을 드로콜 2개로 해석하면 안 된다. 실제 배칭은 측정하지 않았다.
- Blender MCP로 격리된 Blender 세션을 점검했다. Unity MCP는 연결된 편집기가 없어 지정된 Editor를 CLI로 실행했다. Unity의 유리는 비교용 간이 셰이더이며 Blender의 굴절 유리나 게임용 셰이더와 같지 않다. LOD는 작은 하이라이트와 리벳을 생략한다.
- Python 스크립트 문법 검사 통과. 실제 웹 게임 적용, WebGPU 투명도와 텍스처, 게임 카메라·시간대, 모바일 기기 및 성능은 확인하지 않았다. 게임 코드를 수정하지 않아 전체 게임 테스트와 빌드도 실행하지 않았다. 이 스튜디오 결과만으로 AAA 완성도나 게임 적용 준비를 판정하지 않는다.

## 재현

저장소 루트에서 실행한다. 생성기는 기존 `sailboat-bottle-v9.blend`와 `tools/bottle_collection_water.py`를 읽는다. 원본이나 경량 생성을 다시 실행하면 같은 이름의 결과 파일을 덮어쓴다.

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
STUDY=projects/rubber-duck-pool/assets/02_models/props/submarine-bottle-study
TOOLS=projects/rubber-duck-pool/tools

"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/create_submarine_bottle_study.py" -- 6
"$BLENDER" -b "$STUDY/submarine-bottle-v6.blend" -t 6 --python-exit-code 1 --python "$TOOLS/create_rowboat_bottle_lod.py"
"$BLENDER" -b "$STUDY/submarine-bottle-v6.blend" -t 2 --python-exit-code 1 --python "$TOOLS/check_submarine_bottle_study.py"
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_export.py" -- "$STUDY/submarine-bottle-v6.blend" "$STUDY/submarine-bottle-v6.glb" Submarine
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_rowboat_bottle_lod.py" -- "$STUDY/submarine-bottle-v6.glb" "$STUDY/submarine-bottle-v6-lod.glb" Submarine
python3 "$TOOLS/check_rowboat_gltf_textures.py" --subject Submarine "$STUDY/submarine-bottle-v6.glb" "$STUDY/submarine-bottle-v6-lod.glb"
```

Unity 비교는 `/private/tmp/rowboat-bottle-unity-6000.6.8f1`의 일회용 프로젝트에서 `tools/render_submarine_bottle_unity.cs`와 `tools/rowboat_preview_glass.shader`를 사용했다. FBX와 에나멜 PNG를 프로젝트 `Assets/`에 복사하고 `SUBMARINE_REVISION=6`, 절대 경로의 `SUBMARINE_OUTPUT_DIR`을 지정해 `SubmarineBottleStudio.Render`를 호출한다. 경량 비교에는 `SUBMARINE_LOD=1`을 더한다. 스크립트는 지정된 Unity 버전과 일회용 프로젝트만 허용한다.

## 게임 적용 전 남은 일

웹 변환기는 이미지 텍스처를 삼각형 색으로 샘플링하므로 실제 변환 결과에서 에나멜 색과 최종 삼각형 수를 확인해야 한다. 병 유리·물·내부의 투명 정렬을 WebGPU에서 점검하고, 기존 선반 수집품과 교체할지 결정한 후 게임 시점과 주변 오브젝트에서 가독성 및 성능을 검증한다.
