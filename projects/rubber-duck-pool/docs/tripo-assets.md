# Tripo 3D 에셋 요청서

러버덕 풀 섬에 넣을 모델을 Tripo 3D로 직접 만들 때 쓰는 목록입니다. 프롬프트는 영어로 적었습니다(Tripo는 영어 프롬프트가 가장 잘 맞습니다). 받은 모델은 `tools/build_props.py`에서 가져와 크기를 맞추고 면 수를 줄여 `props.bin`에 넣습니다.

## 공통 규칙

- **방식:** Text to Model, 텍스처 켬(PBR). 결과가 마음에 들면 같은 시드로 스타일만 바꿔 다시 뽑아도 됩니다.
- **스타일:** 모든 프롬프트 끝에 아래 문장을 그대로 붙여 주세요. 섬 전체가 한 세트처럼 보이게 하는 문장입니다.

  ```
  stylized toy-like 3D game asset, soft rounded bevels, clean simple shapes, bright sunny Mediterranean resort palette, matte hand-painted colors, single object, centered, no ground plane, no background, no text, no logo
  ```
- **피할 것(Negative prompt 칸이 있으면):** `photorealistic, scanned, noisy texture, broken geometry, floating parts, text, logo, watermark, ground, base plate, multiple objects`
- **면 수(Face limit):** 표의 값으로 맞춰 주세요. 크게 뽑으셔도 제가 줄일 수 있지만, 처음부터 맞추면 모양이 덜 망가집니다.
- **저장:** GLB로 받아 `projects/rubber-duck-pool/models/island/<id>.glb`에 넣어 주세요(`<id>`는 표의 영문 이름). 방향과 크기는 제가 맞춥니다.
- **크기 감:** 이 섬은 1유닛이 약 2 m입니다. 표의 실제 크기는 사람 기준(m)입니다.

## A. 먼저 만들면 좋은 것 (눈에 가장 잘 띔)

| id | 무엇 | 실제 크기 | 면 수 | 놓일 곳 |
|---|---|---|---|---|
| `palm` | 휘어진 코코넛 야자수 | 높이 7–9 m | 6k | 담 뒤, 곶, 해변 (약 20그루) |
| `palm2` | 곧고 키 작은 야자수 | 높이 4–5 m | 5k | 화단, 해변 |
| `bougain` | 담 위로 늘어진 부겐빌레아 | 폭 2 m, 늘어짐 1.5 m | 4k | 좌측 담, 회랑 지붕 끝, 담 바깥면 (12곳) |
| `cabana` | 해변 카바나 | 2.5×2.5 m, 높이 2.8 m | 7k | 해변 오른쪽 |
| `boat` | 작은 나무 보트 | 길이 2.4 m | 4k | 잔교 끝 옆 (물에 뜸) |
| `daybed` | 야외 데이베드 소파 | 1.9×0.9 m | 4k | 회랑 아치 안 (4곳) |
| `hanglamp` | 매다는 놋쇠 랜턴 | 높이 0.5 m | 1.5k | 회랑 아치마다 (8곳) |

**`palm`**
```
a tall coconut palm tree with a gently curved leaning trunk made of stacked rounded rings, warm brown trunk getting slightly thinner toward the top, a crown of 10 long glossy feathery green fronds arching down in all directions, a small cluster of 4 round green coconuts under the crown, roots flaring slightly at the base
```

**`palm2`**
```
a short straight young palm tree, thick ringed trunk with a slight bulge at the base, a dense round crown of 8 shorter fan-shaped bright green fronds pointing up and out, no coconuts
```

**`bougain`**
```
a bougainvillea vine cascading over the top edge of a wall like a hanging curtain, dense clusters of bright magenta and hot pink papery flower bracts mixed with small dark green leaves, a flat back side so it can sit against a wall, uneven ragged bottom edge with a few trailing strands
```

**`cabana`**
```
a square beach cabana with four slim white wooden posts, a pitched canvas roof in teal and white stripes with a scalloped valance edge, white curtains tied back at each post, a low wooden platform with a thick teal mattress cushion and two white pillows inside
```

**`boat`**
```
a small wooden rowing boat, white painted hull with a teal stripe along the top edge, a varnished wooden rim and two wooden seats across the inside, two wooden oars resting inside the boat, a small rope coil at the bow
```

**`daybed`**
```
an outdoor daybed sofa with a whitewashed wooden frame and slatted back, one thick seat cushion in deep teal fabric, three plump pillows in white, mustard yellow and coral, short sturdy legs
```

**`hanglamp`**
```
a hanging lantern made of aged brass with a domed top and a loop for a chain, four frosted glass panels, a small candle-like bulb inside, a short chain on top
```
(유리 부분은 밤에 켜지도록 제가 'lamp' 재질로 바꿉니다.)

## B. 자연물 (섬을 채우는 것)

| id | 무엇 | 실제 크기 | 면 수 | 놓일 곳 |
|---|---|---|---|---|
| `hibiscus` | 빨간 히비스커스 관목 | 높이 1.2 m | 3k | 곶의 화단 |
| `oleander` | 분홍 협죽도 관목 | 높이 1.8 m | 3k | 곶, 담 앞 |
| `shrub` | 둥근 초록 관목(꽃 없음) | 높이 0.8 m | 2k | 여기저기 (많이 반복) |
| `fern` | 열대 고사리 | 높이 0.6 m | 1.5k | 담 아래, 그늘 |
| `agave` | 아가베 | 높이 0.7 m | 1k | 바위 둑, 곶 |
| `rocks` | 해변 바위 3종 세트 | 0.5–1.5 m | 각 800 | 바위 해안 (약 100개 반복) |
| `dunegrass` | 해변 풀 덤불 | 높이 0.5 m | 600 | 해변 (반복) |

**`hibiscus`**
```
a rounded hibiscus shrub, dense glossy dark green leaves, about twenty large open bright red hibiscus flowers with yellow centers scattered over the outside, compact bushy shape, slightly wider than tall
```

**`oleander`**
```
an oleander shrub with several upright stems, long narrow pointed dark green leaves, clusters of soft pink five-petal flowers at the tips of the stems, loose airy vase shape
```

**`shrub`**
```
a compact rounded garden shrub made of many small overlapping clumps of bright green leaves, slightly irregular natural silhouette, visible leaf clusters rather than a smooth ball, no flowers
```

**`fern`**
```
a tropical fern plant, about twelve long arching fronds with many small leaflets, fresh green, radiating from the center and drooping to the ground
```

**`agave`**
```
an agave plant, a rosette of thick fleshy pointed blue-green leaves with pale yellow edges and small tips, leaves fanning upward and outward
```

**`rocks`** (한 번에 세 개가 나오면 각각 따로 저장, 아니면 세 번 생성)
```
a set of three smooth sea-worn coastal boulders in pale warm limestone, rounded but irregular shapes with soft cracks and a few small pits, one large flat-topped boulder, one tall rounded boulder, one small low pebble-like rock
```

**`dunegrass`**
```
a tuft of beach dune grass, thin long blades in pale green and straw yellow, curving out and bending in the wind, a few seed heads on top
```

## C. 소품 (있으면 더 좋은 것)

| id | 무엇 | 실제 크기 | 면 수 | 놓일 곳 |
|---|---|---|---|---|
| `lounger` | 해변 선베드 | 길이 1.9 m | 2.5k | 해변 (색을 바꿔 반복) |
| `parasol` | 해변 파라솔 | 지름 2.2 m | 2k | 해변, 잔디 |
| `torch` | 대나무 티키 횃불 | 높이 1.6 m | 800 | 해변 |
| `postlamp` | 기둥 정원등 | 높이 1.4 m | 1.2k | 징검다리 길, 잔교 |
| `potplant` | 테라코타 화분과 레몬나무 | 높이 1.3 m | 3k | 회랑, 풀 둘레 |
| `driftwood` | 유목 | 길이 1.5 m | 600 | 해변 |
| `starfish` | 불가사리 | 폭 0.25 m | 400 | 해변 |
| `shell` | 소라 껍데기 | 0.15 m | 400 | 해변 |

**`lounger`**
```
a beach sun lounger with a white painted aluminum frame, an adjustable raised backrest, a thin flat cushion in plain solid color, two small wheels at the back legs
```
(쿠션은 흰색 또는 회색으로 만들어 주세요. 색은 제가 놓을 때마다 바꿉니다.)

**`parasol`**
```
a beach parasol umbrella with eight canvas panels alternating white and one solid color, a scalloped edge, a thin white wooden pole, a small round knob on top
```
(색 칸은 흰색 또는 연회색으로 만들어 주세요. 색은 제가 바꿉니다.)

**`torch`**
```
a bamboo tiki torch, a tall thin bamboo pole with two binding rings, a woven wicker cup at the top holding a small oil canister, a short stylized orange flame on top
```

**`postlamp`**
```
a garden post lantern, a slim dark green metal post on a small square base, a square lantern on top with four frosted glass panels and a small pointed roof
```

**`potplant`**
```
a large terracotta pot with a rolled rim and a simple band pattern, holding a small lemon tree with a round crown of glossy green leaves and about ten yellow lemons
```

**`driftwood`**
```
a piece of bleached driftwood, a smooth weathered pale grey branch with two short forks and a twisted knot, worn soft by the sea
```

**`starfish`**
```
a five-armed starfish, bright coral orange, small raised bumps along the top of each arm, slightly curled arm tips
```

**`shell`**
```
a spiral conch seashell, cream and peach colored with soft brown bands, glossy pink opening
```

## D. 풀하우스 안 (선택)

지금 풀하우스는 Blender로 만든 속이 빈 건물입니다(바닥 약 2.8×4 m, 벽 높이 2.6 m, 문은 앞쪽 +x, 둥근 창 넷). **건물 자체는 Tripo로 만들지 않기를 권합니다.** Tripo는 속이 꽉 찬 덩어리를 만들어서 문과 창으로 안을 들여다볼 수 없습니다. 껍데기는 Blender로 두고, 안에 들어갈 물건만 Tripo로 만들면 됩니다. 안이 보이려면 문을 열어 두거나 앞면을 큰 유리문으로 바꿔야 하는데, 이건 제가 Blender 쪽에서 하겠습니다.

들어가면 좋은 물건(구역별, 각 면 수 1–3k):

**수영장 관리 구역 (뒷벽)**
- `pumpunit` 풀 여과기와 펌프: `a compact swimming pool filter and pump unit, a round blue filter tank with a pressure gauge on top, a small white pump motor beside it, short grey pipes connecting them`
- `poolnet` 뜰채와 솔이 걸린 벽걸이: `a wall rack holding a long-handled pool skimmer net and a pool brush with blue bristles, white handles`
- `chemicals` 약품 통 선반: `a small wooden shelf with three plastic pool chemical tubs in white, blue and yellow, and a water testing kit`

**수건과 갈아입기 구역 (왼쪽 벽)**
- `towelshelf` 수건 선반: `an open whitewashed wooden shelf with neatly rolled beach towels in teal, coral, yellow and white stripes`
- `bench` 벤치와 슬리퍼: `a simple wooden changing bench with slatted seat, two pairs of colorful flip-flops underneath`
- `lockers` 사물함: `a row of three tall narrow wooden lockers painted pale teal, with vent slots and small brass handles`
- `hooks` 벽걸이 고리와 비치백·모자: `a row of wall hooks holding a straw sun hat, a striped beach bag and a white bathrobe`

**간식 바 구역 (오른쪽 벽)**
- `minifridge` 레트로 미니 냉장고: `a small retro mini fridge in mint green with rounded corners and a chrome handle`
- `barcart` 음료 카트: `a small rattan bar cart with a pitcher of lemonade, glasses, a bowl of lemons and two coconut cups with paper straws`
- `cooler` 아이스박스: `a blue and white beach cooler box with a hinged lid and a carry handle`

**오리 테마 소품 (이 섬만의 것)**
- `duckbasket` 여분 오리 바구니: `a woven wicker basket overflowing with small yellow rubber ducks`
- `trophyshelf` 오리 트로피 선반: `a wall shelf with three small golden rubber duck trophies on wooden bases`
- `lostfound` 분실물 상자: `a wooden crate with a painted duck silhouette on the front, holding a lost swim ring, a pair of goggles and a rubber duck`
- `lifebuoy` 벽의 구명튜브: `a classic ring lifebuoy in red and white segments with a rope around it, hanging flat on a wall`

**분위기 (천장과 바닥)**
- `ceilingfan` 천장 선풍기: `a ceiling fan with four woven rattan blades and a white body`
- `rug` 줄무늬 러그: `a flat rectangular woven rug with teal and white stripes and short fringes`
- `pendant` 매다는 등(밤에 창으로 보임): `a woven rattan pendant lamp, round, with a warm bulb inside`
- `clock` 벽시계: `a round wall clock with a white face and a teal frame`

이 중 창과 문으로 실제 보이는 것은 앞쪽과 창 쪽뿐입니다. 먼저 `towelshelf`, `minifridge`, `duckbasket`, `lifebuoy`, `pendant`, `rug` 여섯 개만 만들어도 충분합니다.

## E. 예약: 오리 벽화 (사용자가 Tripo로 다시 만들 것, 2026-10-25)

지금은 카툰 벽화(`tools/props_mural.py`)를 그대로 씁니다. 나중에 Tripo로 만든 벽화와 바꿀 때 `window.__pool.mural(...)` 전환 기능으로 나란히 비교합니다.

**크기와 자리.** 왼쪽 담의 안쪽 면에 붙습니다. 길이 약 15 m(7.5유닛)이고, 높이는 바닥에서 둥근 창 아래까지 약 1.2 m(0.6유닛)입니다. 창은 다섯 개이고 아랫부분이 1.2–1.9 m 높이에 있어, 창 사이 벽에는 해와 구름만 들어갈 자리가 있습니다. Tripo는 아주 긴 물체를 잘 만들지 못하므로 다섯 조각으로 나눠 주세요.

| id | 무엇 | 실제 크기 | 면 수 |
|---|---|---|---|
| `mural_left` | 물결 띠 왼쪽 조각 | 5 × 1.2 m, 두께 15 cm | 8k |
| `mural_mid` | 물결 띠 가운데 조각 | 5 × 1.2 m, 두께 15 cm | 8k |
| `mural_right` | 물결 띠 오른쪽 조각 | 5 × 1.2 m, 두께 15 cm | 8k |
| `mural_sun` | 웃는 해 | 지름 0.6 m, 두께 10 cm | 2k |
| `mural_cloud` | 뭉게구름 (두 번 씀) | 0.9 × 0.45 m, 두께 8 cm | 1.5k |

**물결 띠 프롬프트** (세 조각 모두 아래 문장 뒤에 조각마다 다른 끝 문장을 붙입니다):

```
a long horizontal bas-relief wall panel, flat back, raised rounded relief: rolling ocean waves in layered blues with curling white foam crests, cute yellow rubber ducks riding the waves, fish, sea turtles, starfish and green seaweed below the waterline, all shapes extruded 5 to 15 cm from the panel with soft bevelled edges
```

- 왼쪽: `, a duck on an orange surfboard at the left end, a big curling wave`
- 가운데: `, three ducks in a row, a sea turtle and two fish under them`
- 오른쪽: `, two ducks and a small island with two palm trees at the right end`

**해:** `a smiling cartoon sun, rounded triangular rays, raised relief medallion with a flat back, soft bevels, warm yellow and orange`

**구름:** `a puffy cartoon cloud, raised relief with a flat back, soft bevels, white with pale blue shading`

끝에는 공통 스타일 문장을 붙입니다. 저장 위치는 `projects/rubber-duck-pool/models/island/<id>.glb`입니다.
