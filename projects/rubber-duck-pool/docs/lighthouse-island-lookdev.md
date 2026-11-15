# 등대섬 수집품 룩데브 기록

2026-11-15 · 상태: **독립적인 작업 중인 후보**. 실제 게임의 `diorama-fourth`를 교체하지 않았다. Blender 스튜디오 이미지는 게임 화면이 아니며, Unity 비교는 이번에 완료하지 못했다.

## 의도와 결과물

두 번째 선반의 `Lighthouse island`를 위해 산호색 줄무늬와 따뜻한 등불이 작은 크기에서도 구별되는 섬을 새로 만들었다. 아트 방향 문서의 따뜻한 미니어처 분위기를 따르되, 의자의 색을 그대로 복사하지 않았다.

- [Scenario 콘셉트](https://app.scenario.com/assets?openAssetId=asset_Xg6needNiDsvkfyP7vWPk5Qs&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ): 이전 정글섬 이미지를 분위기 참고로 사용해 GPT Image 2.6 Sunburst로 생성, 승인된 Default Project에서 **12 CU** 사용. 이 이미지는 디자인 참고이며 3D 모델이 아니다. [로컬 이미지](../assets/02_models/props/lighthouse-island-study/lighthouse-scenario-concept.png)
- [Blender 원본](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6.blend) · [고해상도 GLB](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6.glb) · [FBX](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6.fbx)
- [경량 GLB](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6-lod.glb) · [경량 FBX](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6-lod.fbx)
- [Blender 앞면](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6-blender.png) · [뒷면](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6-blender-back.png) · [경량 렌더](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v6-lod-blender.png)
- 재현 가능한 텍스처: [아이보리 도장](../assets/02_models/props/lighthouse-island-study/lighthouse-plaster-ivory.png), [산호색 도장](../assets/02_models/props/lighthouse-island-study/lighthouse-plaster-coral.png), [모래](../assets/02_models/props/lighthouse-island-study/lighthouse-sand.png), [어두운 돌](../assets/02_models/props/lighthouse-island-study/lighthouse-stone-dark.png), [밝은 돌](../assets/02_models/props/lighthouse-island-study/lighthouse-stone-light.png). 두 GLB에 모두 내장되어 있다.

## 작업과 검토 기록

1. 폴더 정리 후 기존 수집품 원본, 아트 방향과 현재 선반 목록이 남아 있는지 확인하고, 별도 폴더에서 다음 수집품인 등대섬을 선택했다. 기존 게임 파일을 덮어쓰지 않기 위해 독립 생성기로 작업했다.
2. Scenario로 디자인 기준을 만들고 Blender 5.3.0에서 탑, 띠, 등불, 난간, 섬과 바위를 모델링했다. [v1](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v1-blender.png)은 탑이 가늘고 지형이 단순했다.
3. [v2](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v2-blender.png)는 탑 하단을 넓히고 아치 문·창과 계단, 바위 및 물결을 추가했다. [v3](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v3-blender.png)는 물에 잘려 보이던 바위를 올리고 풀과 지붕 이음매를 추가했다. 바위 고리가 너무 규칙적이고 물이 좁아 보였다.
4. [v4](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v4-blender.png)는 물을 넓히고 도장 텍스처와 UV를 추가했다. 원본/GLB 검사에서 풀잎 앞뒤에 겹친 면이 제거되는 문제가 드러나, [v5](../assets/02_models/props/lighthouse-island-study/lighthouse-island-v5-blender.png)에서 풀잎을 얇고 닫힌 메시로 다시 만들었다. 작은 렌즈 띠와 불규칙한 바위를 추가했다.
5. v5의 첫 경량화는 바위가 각져 보이고 10,008삼각형으로 목표를 넘었다. 바위는 그대로 두고 매우 작은 렌즈 띠 둘을 생략하고 지지대·문 장식·계단의 베벨을 단순화해 7,512삼각형으로 줄였다.
6. v6에서 모래와 돌의 내장 텍스처·UV, 작은 자갈과 창살을 더하고 조명을 조정했다. v6 경량본도 같은 방식으로 다시 만들고 Blender에서 앞면을 비교했다. Blender MCP로는 v5 원본의 오브젝트 목록을 별도 확인했다.
7. Unity MCP에는 연결된 편집기가 없었다. 지정된 Unity 6000.6.8f1을 격리 프로젝트에서 실행했지만 라이선스 클라이언트의 IPC 연결이 반복 실패해 중단했다. 따라서 이 에셋의 Unity 렌더나 Unity 스크립트 컴파일은 **확인하지 못했다**. 다음 시도를 위한 `tools/render_lighthouse_island_unity.cs`는 남겼다.

## 검사 결과와 남은 한계

- Blender 원본: `LIGHTHOUSE_CHECK_OK objects=135 triangles=8500 height=1.51312`. 이 삼각형 수는 원본 메시 기준이며 베벨 등 평가된 모디파이어의 결과를 포함하지 않는다. 띠 재질 사용, 등대 주요 부품, 발광 재질과 바다 윗면 및 면적이 0인 면을 확인했다.
- 고해상도 GLB: **10,788삼각형, 11개 재질**. 원본의 평가된 삼각형 수를 재질별로 비교하고 전체 바운드가 맞는지 확인했다. 이는 노멀, 셰이딩이나 모든 좌표가 일치한다는 증거는 아니다.
- 경량 GLB: `LIGHTHOUSE_LOD_OK triangles=7732 max_bound_error=0.000000`. 8,000은 이 연구의 변환 전 목표일 뿐, 게임에서 성능을 보장하는 수치가 아니다. 탑의 1,020개 삼각형과 띠 재질 배치는 실제 좌표로 별도 비교했다: `LIGHTHOUSE_TOWER_LOD_OK triangles=1020`.
- 고해상도와 경량 GLB 모두 `LIGHTHOUSE_GLTF_OK`로 다섯 색상 이미지가 내장되고 해당 재질에 UV가 있는지 확인했다. UV 값의 시각적 정확도나 Unity·웹에서의 재현까지 증명하지는 않는다.
- 실패 확인: 구형 등대 원본에서 신규 부품 검사 실패, 텍스처가 없는 v5에서 지형 텍스처 검사 실패, 고해상도 모델을 경량 후보로 넣었을 때 예산 검사 실패, 다른 탑을 넣었을 때 탑 위치 검사 실패를 확인했다. v4의 겹친 풀잎도 Blender 메시 검사에서 실패했다.
- Blender MCP 연결은 동작했지만 애드온 프로토콜이 서버보다 한 버전 낮다는 경고가 있었다. Python 문법 검사는 통과했으며 `crapper`, `dryer`, `mutator` 실행 파일은 찾지 못했다.
- 현재 결과는 콘셉트보다 바위·모래·등불이 단순하고 가장자리가 규칙적이다. 유리 렌즈와 정교한 돌 표면도 더 필요하다. AAA 완성품으로 판정하지 않는다. Unity 재질·조명, 웹 변환기의 텍스처 샘플링과 투명도, 실제 게임 거리·시간대·모바일 성능은 미검증이다. 게임 코드를 변경하지 않아 전체 게임 테스트와 빌드도 실행하지 않았다.

## 재현

저장소 루트에서 실행한다. 같은 버전의 결과 파일은 덮어쓴다.

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
STUDY=projects/rubber-duck-pool/assets/02_models/props/lighthouse-island-study
TOOLS=projects/rubber-duck-pool/tools

python3 "$TOOLS/create_lighthouse_textures.py"
"$BLENDER" -b -t 6 --factory-startup --python-exit-code 1 --python "$TOOLS/create_lighthouse_island_study.py" -- 6
"$BLENDER" -b "$STUDY/lighthouse-island-v6.blend" -t 6 --python-exit-code 1 --python "$TOOLS/create_lighthouse_island_lod.py"
"$BLENDER" -b "$STUDY/lighthouse-island-v6.blend" -t 2 --python-exit-code 1 --python "$TOOLS/check_lighthouse_island_study.py"
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_jungle_export_geometry.py" -- "$STUDY/lighthouse-island-v6.blend" "$STUDY/lighthouse-island-v6.glb"
python3 "$TOOLS/check_lighthouse_gltf.py" "$STUDY/lighthouse-island-v6.glb" --terrain
python3 "$TOOLS/check_lighthouse_gltf.py" "$STUDY/lighthouse-island-v6-lod.glb" --terrain
python3 "$TOOLS/check_lighthouse_lod.py" "$STUDY/lighthouse-island-v6.glb" "$STUDY/lighthouse-island-v6-lod.glb"
"$BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python "$TOOLS/check_lighthouse_tower_lod.py" -- "$STUDY/lighthouse-island-v6.blend" "$STUDY/lighthouse-island-v6-lod.glb"
```

Unity 비교를 다시 시도할 때는 라이선스 연결을 먼저 복구하고, 지정 버전의 격리 프로젝트 `/private/tmp/rowboat-bottle-unity-6000.6.8f1`의 `Assets/Editor`에 비교 스크립트를, `Assets/`에 v6 FBX와 위 PNG 다섯 개를 복사한다. `LIGHTHOUSE_REVISION=6`, 존재하는 절대 경로의 `LIGHTHOUSE_OUTPUT_DIR`을 지정하고 `LighthouseIslandStudio.Render`를 호출한다. 경량 FBX는 `LIGHTHOUSE_LOD=1`을 추가한다. 이 스크립트는 아직 컴파일하거나 렌더링해 확인하지 않았다.
