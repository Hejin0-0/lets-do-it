// Diegetic 3D Field-Log Collector's Book for Hydro Sanctuary.
// Renders dynamic ruled-journal pages, multiply-blended monochrome duck sketches,
// botanical fern ink, crimson CONFIDENTIAL stamp, circular archive seal, physical
// 3D Post-it sticky note, and 4 physical edge tabs directly onto Blender-exported
// GLB meshes with 4-key Shape Key morph-target page turning.
// Syncs live with rubber-duck-pool's persistent logbook (`rubber-duck-pool.book.v2`)
// and sanctuary gameplay state (`sanctuary-loop.js`).

import * as THREE from 'three';
import { DESIGNS } from '../pool/ducks.js';
import { COLLECTIBLES, KIND_LABELS } from '../pool/collectibles.js';
import { createLogbook } from '../pool/logbook.js';
import { SPECIAL_HEARTH_DUCKS } from './sanctuary-loop.js';
import { translate } from './i18n.js';
import { SANCTUARY_SECRETS } from './secrets.js';

const PAGE_W = 1024;
const PAGE_H = 1280;
const POSTIT_SIZE = 512;
const FLIP_DURATION_SEC = 0.56;

export const BOOK_TAB_DEFS = [
  { id: 'ducks',        label: '러버덕', sub: 'DUCKS',  i18nKey: 'book.tabs.catalog' },
  { id: 'atelier',      label: '내작품', sub: 'WORK',   i18nKey: 'book.tabs.atelier' },
  { id: 'collectibles', label: '표류물', sub: 'SEA',    i18nKey: 'book.tabs.sea' },
  { id: 'stamps',       label: '스탬프', sub: 'SEALS',  i18nKey: 'book.tabs.secrets' },
];

const UNEXPECTED_DUCK_SPECS = DESIGNS.slice(12).map((d, idx) => ({
  designIdx: 12 + idx,
  id: d.id,
  code: `No. ${String(13 + idx).padStart(2, '0')}`,
  hex: d.fx?.colours?.[0] || '#f2c138',
}));

const CUE_LABELS = {
  ko: {
    prev: '이전',
    next: '다음',
    secretHeading: '비밀 메모:',
    traitPrefix: '○ 개체 특징:',
    habitatPrefix: '○ 서식지:',
    enTrait: null,
  },
  en: {
    prev: 'Prev',
    next: 'Next',
    secretHeading: 'Field Clue:',
    traitPrefix: '○ Trait:',
    habitatPrefix: '○ Habitat:',
    traitByIdx: [
      'Active above 38°C · 0.38m reference specimen',
      'Emerald surface camouflage · glass return tube regular',
      'Prefers whirlpool current · hearth skewer favorite',
      'Onsen tatami desk mascot · calm upper pool floater',
      'Fast swimmer along the east intake & siphon bell',
      'Steady buoyant drifter · bubble-lift observer',
      'Bright silhouette passing the upper glass arch tube',
      'Constellation pattern glowing softly after dusk',
      'High-speed cornering down the copper spiral slide',
      'Blends with fern shadows in the lower grotto',
      'Golden crown guardian of the hinoki yuzu bath',
      'Refracts conservatory skylight across the emerald pool',
    ],
    habitatByIdx: [
      'Upper Conservatory Emerald Pool',
      'North Basin · Upper Conservatory',
      'Lower Whirlpool Fern Grotto',
      'Onsen Study · Upper Pool',
      'East Intake Channel · Glass Siphon',
      'Siphon Lift · Return Channel',
      'Upper Glass Return Arch',
      'Central Conservatory Waters',
      'Copper Spiral Slide · Lower Basin',
      'Lower Grotto Fern Rocks',
      'Tokonoma Shrine Yuzu Tub',
      'Under the Verdigris Glass Vault',
    ],
  },
  ja: {
    prev: '前へ',
    next: '次へ',
    secretHeading: 'ひみつメモ:',
    traitPrefix: '○ 個体特徴:',
    habitatPrefix: '○ 生息域:',
    traitByIdx: [
      '水温38℃以上で活発・基準標本 (0.38m)',
      'エメラルド水面擬態・ガラスチューブ常連',
      '渦潮を好む・囲炉裏串焼きの人気個体',
      '温泉書斎のマスコット・上段プール回遊',
      '東の取水路を高速通過・サイフォン好き',
      'ゆったり浮遊・気泡上昇区間の観察個体',
      'ガラスアーチ通過時に高い視認性',
      '夕暮れ後に星空模様がほのかに光る',
      '銅スライダーの急カーブを勢いよく滑走',
      '下段シダ洞窟の影になじむ色合い',
      '黄金の王冠を戴くヒノキ柚子湯の守護者',
      '温室の光を虹色に反射する希少種',
    ],
    habitatByIdx: [
      '上段コンサバトリー・エメラルド湯',
      '上段プール北側水面',
      '下段シダ渦の洞窟',
      '温泉書斎・上段プール',
      '東の取水路・ガラスサイフォン',
      'サイフォン上昇管・帰還水路',
      '上段ガラスリターンアーチ',
      '温室プール中央水域',
      '銅スパイラルスライダー',
      '下段シダ洞窟の岩場',
      '床の間・ヒノキ柚子湯',
      '緑青ガラスドーム直下',
    ],
  },
};

// Normalized crop boxes [u, v, w, h] for individual monochrome duck ink drawings
// inside `book_specimen_plate.jpg` (3x3 grid) and `book_open_spread.jpg`.
const SPECIMEN_GRID_CROPS = [
  { src: 'plate',  rect: [0.132, 0.126, 0.205, 0.158] }, // 1. Classic
  { src: 'plate',  rect: [0.665, 0.126, 0.205, 0.158] }, // 3. Striped (Mint/Water)
  { src: 'plate',  rect: [0.398, 0.392, 0.205, 0.158] }, // 5. Heart / Cherry
  { src: 'plate',  rect: [0.665, 0.392, 0.205, 0.158] }, // 6. Ripple / Daisy
  { src: 'plate',  rect: [0.132, 0.392, 0.205, 0.158] }, // 4. Stars / Lightning
  { src: 'plate',  rect: [0.398, 0.658, 0.205, 0.158] }, // 8. Spotted / Cow
  { src: 'plate',  rect: [0.398, 0.392, 0.205, 0.158] }, // 5. Heart
  { src: 'plate',  rect: [0.132, 0.392, 0.205, 0.158] }, // 4. Stars
  { src: 'plate',  rect: [0.665, 0.126, 0.205, 0.158] }, // 3. Tiger
  { src: 'plate',  rect: [0.132, 0.658, 0.205, 0.158] }, // 7. Fern / Lavender
  { src: 'plate',  rect: [0.398, 0.120, 0.205, 0.164] }, // 2. Crown
  { src: 'plate',  rect: [0.665, 0.658, 0.205, 0.158] }, // 9. Minima / Prism
];

const SANCTUARY_DUCK_SPECS = [
  {
    folio: 'FOLIO I · ANAS CLASSICUS',
    stamp: 'CONFIDENTIAL',
    postit: ['개체 특징:', '수온 38°C 이상에서만 활성', '동판 슬라이드 집중 출몰', '서식지: Upper Conservatory'],
    entries: [
      { designIdx: 0, code: 'No. 01', label: '오리 No. 01 클래식', name: 'No. 01 클래식', hex: '#f2c138',
        trait: '수온 38°C 이상에서만 활성 · 기준 표본(0.38m)', habitat: 'Upper Conservatory 에메랄드 온천탕' },
      { designIdx: 1, code: 'No. 02', label: '오리 No. 02 민트', name: 'No. 02 민트', hex: '#68d8b6',
        trait: '에메랄드 수면 위장 · 유리 리턴 튜브 단골', habitat: 'Upper Conservatory 북측 수면' },
      { designIdx: 2, code: 'No. 03', label: '오리 No. 03 체리', name: 'No. 03 체리', hex: '#df4a5b',
        trait: '소용돌이 수류 선호 · 이로리 화로 꼬치 인기 1위', habitat: 'Lower Grotto 소용돌이 동굴' },
      { designIdx: 3, code: 'No. 04', label: '오리 No. 04 데이지', name: 'No. 04 데이지', hex: '#f7ecc2',
        trait: '온천 서재 다다미 책상 마스코트 개체', habitat: 'Onsen Study · 상부 온실 풀' },
    ],
  },
  {
    folio: 'FOLIO II · HYDRO-CIRCULATIO',
    stamp: 'FIELD LOG',
    postit: ['순환 계측 메모:', '구리 슬라이드 -> 소용돌이', '유리 사이펀 기포 상승', '1주회 약 56초 유지'],
    entries: [
      { designIdx: 4, code: 'No. 05', label: '오리 No. 05 라이트닝', name: 'No. 05 라이트닝', hex: '#39b8ff',
        trait: '동측 취수로 고속 통과 · 사이펀 흡입구 선호', habitat: 'East Intake Channel · 유리 사이펀' },
      { designIdx: 5, code: 'No. 06', label: '오리 No. 06 카우', name: 'No. 06 카우', hex: '#e8e4da',
        trait: '느긋한 부유 유영 · 기포 상승 구간 관찰', habitat: 'Siphon Lift · 상부 복귀 수로' },
      { designIdx: 6, code: 'No. 07', label: '오리 No. 07 하트', name: 'No. 07 하트', hex: '#f47da8',
        trait: '상부 유리 아치 튜브 통과 시 높은 시인성', habitat: 'Glass Return Tube · 상부 아치' },
      { designIdx: 7, code: 'No. 08', label: '오리 No. 08 스타즈', name: 'No. 08 스타즈', hex: '#2f4587',
        trait: '황혼 온실 천장 전구빛 반사 성좌 무늬', habitat: 'Upper Conservatory 중앙 수역' },
    ],
  },
  {
    folio: 'FOLIO III · REX THERMARUM',
    stamp: 'RESTRICTED',
    postit: ['희귀 개체 소견:', '크라운 덕은 도코노마', '히노끼 유자탕 중앙 좌정', '성소 수호 개체로 지정'],
    entries: [
      { designIdx: 8,  code: 'No. 09', label: '오리 No. 09 타이거', name: 'No. 09 타이거', hex: '#e57e2a',
        trait: '구리 슬라이드 급커브 역동 질주 개체', habitat: 'Copper Spiral Slide · 하부 수조' },
      { designIdx: 9,  code: 'No. 10', label: '오리 No. 10 라벤더', name: 'No. 10 라벤더', hex: '#9d7cd8',
        trait: '하부 고사리 동굴 그림자와 동화되는 빛깔', habitat: 'Lower Grotto 고사리 암반' },
      { designIdx: 10, code: 'No. 11', label: '오리 No. 11 크라운', name: 'No. 11 크라운', hex: '#f4c842',
        trait: '황금 왕관 착장 · 히노끼 유자탕 수호자', habitat: 'Tokonoma Shrine 유자 목욕통' },
      { designIdx: 11, code: 'No. 12', label: '오리 No. 12 프리즘', name: 'No. 12 프리즘', hex: '#7ae8ff',
        trait: '유리 지붕 빛을 무지갯빛으로 굴절하는 희귀종', habitat: 'Upper Conservatory 유리 돔 하부' },
    ],
  },
];

/**
 * Pure piecewise linear weights for the 4 relative Blender Shape Keys
 * (`Turn_25`, `Turn_50`, `Turn_75`, `Turn_100`) exported on `Book_FlipLeaf`.
 * At t=0 -> Basis (right page); at t=1 -> Turn_100 (left page).
 */
export function computeFlipMorphWeights(t) {
  const p = Math.max(0, Math.min(1, Number(t) || 0));
  if (p <= 0.25) {
    return [p / 0.25, 0, 0, 0];
  }
  if (p <= 0.50) {
    const a = (p - 0.25) / 0.25;
    return [1 - a, a, 0, 0];
  }
  if (p <= 0.75) {
    const a = (p - 0.50) / 0.25;
    return [0, 1 - a, a, 0];
  }
  const a = (p - 0.75) / 0.25;
  return [0, 0, 1 - a, a];
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hash2d(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Build the flat ordered sequence of book spreads and per-tab start indices.
 * Pure function so behavior tests can verify book indexing without DOM/WebGL.
 */
export function buildBookSpreads({ logbook, loop, secrets = null, graph = null, drama = null, lang = 'ko' }) {
  const seenDesigns = logbook?.designs || [];
  const spreads = [];
  const tabStarts = { ducks: 0, atelier: 0, collectibles: 0, stamps: 0 };
  const unlockedSecretList = secrets?.getUnlocked?.() || [];
  const unlockedSecretIds = new Set(unlockedSecretList.map((s) => s.id));
  const unlockedDuckIds = new Set(unlockedSecretList.map((s) => s.unlocks));
  const secretHint = secrets?.getNextHint?.(lang) || null;
  const graphSt = graph?.getState?.() || null;
  const dramaSt = drama?.getState?.() || null;
  const activeReqs = drama?.getActiveRequests?.(lang, 2) || [];
  const cue = CUE_LABELS[lang] || CUE_LABELS.ko;

  // 1. Duck Field-Log Spreads (3 spreads -> pages 01..06, Classic 01..12)
  tabStarts.ducks = spreads.length;
  for (let i = 0; i < SANCTUARY_DUCK_SPECS.length; i++) {
    const spec = SANCTUARY_DUCK_SPECS[i];
    const reqHeader = `${translate(lang, 'requests.title')} (${dramaSt ? dramaSt.completedRequests.length : 0}/${dramaSt ? dramaSt.totalRequests : 6})`;
    const postitLines = i === 0 && activeReqs.length
      ? [reqHeader, ...activeReqs.map((r) => `${r.title} (+${r.rewardShells}🐚)`)]
      : secretHint
        ? [cue.secretHeading, secretHint, `${unlockedSecretIds.size} / ${SANCTUARY_SECRETS.length} ${translate(lang, 'book.stamps.unlocked')}`]
        : spec.postit;
    spreads.push({
      tab: 'ducks',
      subIdx: i,
      folio: spec.folio,
      stamp: spec.stamp,
      postit: postitLines,
      entries: spec.entries.map((e) => {
        const dMeta = DESIGNS[e.designIdx];
        const localized = dMeta ? translate(lang, `duck.${dMeta.id}`) : e.name;
        return {
          ...e,
          label: `${e.code} ${localized}`,
          name: `${e.code} ${localized}`,
          trait: cue.traitByIdx?.[e.designIdx] || e.trait,
          habitat: cue.habitatByIdx?.[e.designIdx] || e.habitat,
          seen: Boolean(seenDesigns[e.designIdx]?.seen),
        };
      }),
    });
  }

  // 2. Atelier Custom Watercolor & Campfire Hearth Spreads
  tabStarts.atelier = spreads.length;
  const customs = loop?.customDucks || [];
  const unlocks = loop?.hearthUnlocks || { golden_smore: null, charred_ember: null };
  const stats = loop?.stats || { customCreated: 0, perfectRoasts: 0, ducksPetted: 0, ridesTaken: 0 };
  const atelierCount = Math.max(1, customs.length);
  for (let i = 0; i < atelierCount; i++) {
    spreads.push({
      tab: 'atelier',
      subIdx: i,
      folio: 'CODEX ARTIFICIS · CUSTOM & HEARTH',
      stamp: customs[i] ? 'ARCHIVED' : 'WORKSHOP',
      activeCustom: customs[i] || null,
      customs,
      unlocks,
      stats,
      postit: [
        translate(lang, 'book.tabs.atelier'),
        `${translate(lang, 'duck.custom')}: ${stats.customCreated}`,
        `♥ ${stats.ducksPetted} · ⛵ ${stats.ridesTaken}`,
        `🔥 ${stats.perfectRoasts}`,
      ],
    });
  }

  // 3. Maritime Collectibles (2 shelves synced with main pool logbook)
  tabStarts.collectibles = spreads.length;
  const foundMap = new Map((logbook?.pages || []).map((p) => [p.id, p]));
  const foundTotal = (logbook?.pages || []).filter((p) => p.found).length;
  for (const shelfNum of [1, 2]) {
    const items = COLLECTIBLES.filter((c) => c.shelf === shelfNum).map((item, idx) => ({
      code: `S${shelfNum}-${String(idx + 1).padStart(2, '0')}`,
      title: item.title,
      kindLabel: KIND_LABELS[item.kind] || item.kind,
      description: item.description,
      found: Boolean(foundMap.get(item.id)?.found),
    }));
    const bestLine = graphSt?.bestCatch
      ? `★ PB: ${graphSt.bestCatch.cm}cm · ${graphSt.speciesCount}/${graphSt.totalSpecies}`
      : `★ CATCHES: 0 / ${graphSt?.totalSpecies || 12}`;
    spreads.push({
      tab: 'collectibles',
      subIdx: shelfNum - 1,
      shelfNum,
      folio: `MARITIME ARCHIVE · SHELF ${shelfNum}`,
      stamp: foundTotal > 0 ? 'CATALOGED' : 'UNEXPLORED',
      foundTotal,
      totalCount: COLLECTIBLES.length,
      bestLine,
      shells: graphSt?.shells ?? 0,
      items,
      postit: [
        `Shelf #${shelfNum} · ${foundTotal}/${COLLECTIBLES.length}`,
        bestLine,
        `◇ SHELLS: ${graphSt?.shells ?? 0}`,
      ],
    });
  }

  // 4. Collector Stamps, Secrets, Pool Pals & Campfire Harmonies (13..24)
  tabStarts.stamps = spreads.length;
  const stamps = logbook?.stamps || [];
  const earnedCount = stamps.filter((s) => s.earned).length;
  const rec = logbook?.records || { bestLap: null, mostLaps: 0 };
  const palCount = dramaSt?.palCount || 0;
  const harmonyCount = graphSt?.harmoniesPlayed?.length || 0;
  spreads.push({
    tab: 'stamps',
    subIdx: 0,
    folio: 'ANNALES · COLLECTOR SEALS',
    stamp: 'VERIFIED',
    stamps,
    earnedCount,
    records: rec,
    palCount,
    harmonyCount,
    postit: [
      translate(lang, 'book.tabs.secrets'),
      `♥ PALS: ${palCount} · ♪ ${harmonyCount}/3`,
      `G-D-Em-C · Em-C-G-D`,
    ],
  });

  // Unexpected Ducks (13..24) & 4 Quiet Sanctuary Secrets Dossier
  spreads.push({
    tab: 'stamps',
    subIdx: 1,
    isSecretFolio: true,
    folio: 'FOLIO IV · UNEXPECTED & SECRETS',
    stamp: unlockedSecretIds.size > 0 ? 'VERIFIED' : 'CONFIDENTIAL',
    unexpected: UNEXPECTED_DUCK_SPECS.map((u) => ({
      ...u,
      name: translate(lang, `duck.${u.id}`),
      seen: Boolean(seenDesigns[u.designIdx]?.seen) || unlockedDuckIds.has(u.id),
    })),
    secretEntries: SANCTUARY_SECRETS.map((s) => ({
      id: s.id,
      unlocks: s.unlocks,
      duckName: translate(lang, `duck.${s.unlocks}`),
      name: translate(lang, `secret.${s.id}.name`),
      hint: translate(lang, `secret.${s.id}.hint`),
      unlocked: unlockedSecretIds.has(s.id),
    })),
    postit: [
      cue.secretHeading,
      secretHint || translate(lang, 'secret.allFound'),
      `${unlockedSecretIds.size} / ${SANCTUARY_SECRETS.length} ${translate(lang, 'book.stamps.unlocked')}`,
    ],
  });

  for (let i = 0; i < spreads.length; i++) {
    spreads[i].leftPageNum = i * 2 + 1;
    spreads[i].rightPageNum = i * 2 + 2;
  }

  return { spreads, tabStarts };
}

function assetUrl(rel) {
  return new URL(rel, document.baseURI).href;
}

function readSharedLogbook() {
  try {
    return createLogbook(window.localStorage);
  } catch {
    return createLogbook(null);
  }
}

// ---------------------------------------------------------------------------
// CANVAS ARTISTRY HELPERS (Ruled Field-Log Paper, Botanical Fern, Stamps)
// ---------------------------------------------------------------------------

function drawFieldPaperBase(ctx, side, pageNum, spreadIndex) {
  ctx.save();
  // Rich weathered field-journal parchment base (holds deep dark ink & cool #CBE8F5 spotlight without washout!)
  const bg = ctx.createLinearGradient(0, 0, PAGE_W, PAGE_H);
  bg.addColorStop(0, '#cecbb8');
  bg.addColorStop(0.5, '#c2bda8');
  bg.addColorStop(1, '#b5ae96');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Stronger antique corner grime, water rings & thumb-wear smudges (matching Reference Image 1!)
  const outerX = side === 'left' ? 92 : PAGE_W - 92;
  const stains = [
    [outerX, PAGE_H - 84, 410, 'rgba(72, 48, 22, 0.50)'],
    [outerX, 95, 290, 'rgba(84, 60, 32, 0.24)'],
    [side === 'left' ? 300 : PAGE_W - 300, PAGE_H - 36, 360, 'rgba(64, 44, 20, 0.36)'],
    [PAGE_W * 0.5, PAGE_H * 0.48, 490, 'rgba(248, 250, 240, 0.22)'],
  ];
  for (const [cx, cy, rad, col] of stains) {
    const g = ctx.createRadialGradient(cx, cy, rad * 0.06, cx, cy, rad);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  }

  // Deterministic organic paper fibers & foxing speckles
  const seedOff = spreadIndex * 19 + (side === 'left' ? 3 : 11);
  for (let i = 0; i < 520; i++) {
    const rx = hash2d(i + seedOff, 1.3) * PAGE_W;
    const ry = hash2d(i + seedOff, 7.9) * PAGE_H;
    const sz = 1.0 + hash2d(i, 3.1) * 2.8;
    const nearOuter = side === 'left' ? (1 - rx / PAGE_W) : (rx / PAGE_W);
    const alpha = (0.04 + 0.11 * nearOuter * nearOuter) * hash2d(i, 5.7);
    ctx.fillStyle = `rgba(54, 36, 18, ${alpha.toFixed(3)})`;
    ctx.fillRect(rx, ry, sz, sz);
  }

  // Crisp dark-graphite horizontal ruled field-notebook lines (26 lines)
  ctx.lineWidth = 1.8;
  const lineStartY = 148;
  const lineStep = 39.5;
  const x0 = side === 'left' ? 76 : 64;
  const x1 = side === 'left' ? PAGE_W - 62 : PAGE_W - 76;
  for (let k = 0; k < 26; k++) {
    const ly = lineStartY + k * lineStep;
    const gLine = ctx.createLinearGradient(x0, ly, x1, ly);
    gLine.addColorStop(0, 'rgba(46, 42, 34, 0.20)');
    gLine.addColorStop(0.08, 'rgba(42, 38, 32, 0.44)');
    gLine.addColorStop(0.92, 'rgba(42, 38, 32, 0.44)');
    gLine.addColorStop(1, 'rgba(46, 42, 34, 0.20)');
    ctx.strokeStyle = gLine;
    ctx.beginPath();
    ctx.moveTo(x0, ly);
    ctx.lineTo(x1, ly);
    ctx.stroke();
  }

  // Deep Baked Spine-Gutter Ambient Occlusion (pronounced curved fold shadow!)
  const spineGrad = side === 'left'
    ? ctx.createLinearGradient(PAGE_W - 168, 0, PAGE_W, 0)
    : ctx.createLinearGradient(0, 0, 168, 0);
  if (side === 'left') {
    spineGrad.addColorStop(0, 'rgba(24, 18, 12, 0.00)');
    spineGrad.addColorStop(0.50, 'rgba(24, 18, 12, 0.14)');
    spineGrad.addColorStop(0.82, 'rgba(18, 13, 8, 0.40)');
    spineGrad.addColorStop(1, 'rgba(10, 7, 4, 0.72)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(PAGE_W - 168, 0, 168, PAGE_H);
  } else {
    spineGrad.addColorStop(0, 'rgba(10, 7, 4, 0.72)');
    spineGrad.addColorStop(0.18, 'rgba(18, 13, 8, 0.40)');
    spineGrad.addColorStop(0.50, 'rgba(24, 18, 12, 0.14)');
    spineGrad.addColorStop(1, 'rgba(24, 18, 12, 0.00)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(0, 0, 168, PAGE_H);
  }

  // Deckle edge perimeter shading
  const topEdge = ctx.createLinearGradient(0, 0, 0, 60);
  topEdge.addColorStop(0, 'rgba(42, 30, 16, 0.30)');
  topEdge.addColorStop(1, 'rgba(42, 30, 16, 0)');
  ctx.fillStyle = topEdge;
  ctx.fillRect(0, 0, PAGE_W, 60);

  const botEdge = ctx.createLinearGradient(0, PAGE_H - 82, 0, PAGE_H);
  botEdge.addColorStop(0, 'rgba(42, 30, 16, 0)');
  botEdge.addColorStop(1, 'rgba(34, 22, 10, 0.42)');
  ctx.fillStyle = botEdge;
  ctx.fillRect(0, PAGE_H - 82, PAGE_W, 82);

  // Crisp Dark Running Header (`HYDRO-ONSEN COMPENDIUM` + directional arrow)
  ctx.fillStyle = 'rgba(22, 20, 16, 0.90)';
  ctx.font = '700 24px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HYDRO-ONSEN COMPENDIUM', PAGE_W * 0.5, 86);

  ctx.font = '700 30px Georgia, serif';
  if (side === 'left') {
    ctx.textAlign = 'left';
    ctx.fillText('←', 88, 86);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText('→', PAGE_W - 88, 86);
  }

  // Bottom Page Number
  ctx.fillStyle = 'rgba(18, 16, 13, 0.92)';
  ctx.font = '700 38px Georgia, "Times New Roman", serif';
  if (side === 'left') {
    ctx.textAlign = 'left';
    ctx.fillText(String(pageNum).padStart(2, '0'), 78, PAGE_H - 58);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(String(pageNum).padStart(2, '0'), PAGE_W - 78, PAGE_H - 58);
  }

  ctx.restore();
}

function drawHandwrittenCue(ctx, text, x, y, angleDeg) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = 'rgba(42, 38, 32, 0.72)';
  ctx.font = 'italic 600 34px "Apple SD Gothic Neo", "Nanum Pen Script", serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  // Subtle loose pencil underline flourish
  ctx.strokeStyle = 'rgba(46, 42, 34, 0.44)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-46, 14);
  ctx.quadraticCurveTo(0, 7, 48, 12);
  ctx.stroke();
  ctx.restore();
}

/**
 * Crisp procedural botanical mountain-fern pen-ink illustration down the right margin.
 */
function drawBotanicalFernInk(ctx, baseX, baseY, scale = 1.0) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = 'rgba(28, 32, 28, 0.76)';
  ctx.fillStyle = 'rgba(32, 38, 34, 0.14)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Curved central rachis (stem)
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-10, -140, -18, -310, -84, -475);
  ctx.stroke();

  const stemPt = (t) => {
    const u = 1 - t;
    const x = 3 * u * u * t * (-10) + 3 * u * t * t * (-18) + t * t * t * (-84);
    const y = 3 * u * u * t * (-140) + 3 * u * t * t * (-310) + t * t * t * (-475);
    return [x, y];
  };

  // 18 pairs of serrated crosshatched pinnae (frond leaflets)
  const pairs = 18;
  for (let i = 1; i <= pairs; i++) {
    const t = 0.14 + (i / pairs) * 0.84;
    const [sx, sy] = stemPt(t);
    const [sx2, sy2] = stemPt(Math.min(1, t + 0.03));
    const tangAng = Math.atan2(sy2 - sy, sx2 - sx);
    const env = Math.sin(Math.pow((t - 0.10) / 0.90, 0.8) * Math.PI);
    const len = (24 + 112 * env);

    for (const side of [-1, 1]) {
      const ang = tangAng + side * (1.12 - 0.28 * t);
      const ex = sx + Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len;
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      const wid = 6 + 13 * env;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) * 0.5 + nx * wid, (sy + ey) * 0.5 + ny * wid, ex, ey);
      ctx.quadraticCurveTo((sx + ex) * 0.5 - nx * wid * 0.7, (sy + ey) * 0.5 - ny * wid * 0.7, sx, sy);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Delicate midrib & diagonal ink crosshatching inside each leaflet
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const ribs = Math.max(2, Math.floor(len / 18));
      for (let r = 1; r < ribs; r++) {
        const ft = r / ribs;
        const rx = sx + (ex - sx) * ft;
        const ry = sy + (ey - sy) * ft;
        const rw = wid * 0.55 * Math.sin(ft * Math.PI);
        ctx.beginPath();
        ctx.moveTo(rx - nx * rw, ry - ny * rw);
        ctx.lineTo(rx + nx * rw, ry + ny * rw);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Worn crimson rectangular rubber stamp (`CONFIDENTIAL`, `ARCHIVED`, `VERIFIED`, etc.)
 */
function drawCrimsonRubberStamp(ctx, label, x, y, angleDeg = -13.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.globalCompositeOperation = 'multiply';

  const w = 326;
  const h = 96;
  ctx.strokeStyle = 'rgba(136, 16, 16, 0.94)';
  ctx.fillStyle = 'rgba(136, 16, 16, 0.94)';

  ctx.lineWidth = 7.5;
  ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
  ctx.lineWidth = 2.4;
  ctx.strokeRect(-w * 0.5 + 9, -h * 0.5 + 9, w - 18, h - 18);

  ctx.font = '900 44px "Arial Narrow", "Helvetica Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 2);

  // Deterministic worn ink dry-spots (stamp patina!)
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 65; i++) {
    const gx = (hash2d(i, 19.3) - 0.5) * (w + 4);
    const gy = (hash2d(i, 41.7) - 0.5) * (h + 4);
    const r = 1.4 + hash2d(i, 8.1) * 3.2;
    ctx.fillStyle = 'rgba(214, 206, 186, 0.42)';
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Circular dark-ink official archive inspection seal (bottom-right of right page!)
 */
function drawCircularArchiveSeal(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(24, 28, 30, 0.84)';
  ctx.fillStyle = 'rgba(24, 28, 30, 0.84)';

  // Concentric scalloped official rings
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  // Radial ring notch ticks
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 51, Math.sin(a) * 51);
    ctx.lineTo(Math.cos(a) * 65, Math.sin(a) * 65);
    ctx.stroke();
  }

  // Center horizontal archive banner
  ctx.fillStyle = 'rgba(214, 208, 190, 0.90)';
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillRect(-52, -18, 104, 36);
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(24, 28, 30, 0.84)';
  ctx.fillStyle = 'rgba(24, 28, 30, 0.88)';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(-52, -18, 104, 36);

  ctx.font = '800 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HYDRO-ONSEN', 0, -6);
  ctx.font = '700 11px "Courier New", monospace';
  ctx.fillText('ARCHIVUM', 0, 8);
  ctx.restore();
}

function drawBlueSuanboSeal(ctx, x, y, angleDeg = 9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(26, 78, 138, 0.88)';
  ctx.fillStyle = 'rgba(26, 78, 138, 0.88)';

  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();

  // Gentle hot-spring wave glyph in center
  ctx.lineWidth = 2.6;
  for (const dy of [-18, -8]) {
    ctx.beginPath();
    ctx.moveTo(-24, dy);
    ctx.quadraticCurveTo(-12, dy - 7, 0, dy);
    ctx.quadraticCurveTo(12, dy + 7, 24, dy);
    ctx.stroke();
  }
  ctx.font = '900 18px "Apple SD Gothic Neo", "Noto Sans KR", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('수안보', 0, 14);
  ctx.font = '700 11px "Courier New", monospace';
  ctx.fillText('38.4°C', 0, 32);
  ctx.restore();
}

function drawCrimsonWaxSeal(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  // Tactile raised crimson sealing-wax medallion (Monograph Ch. 07 Layer 06)
  ctx.fillStyle = 'rgba(42, 24, 16, 0.28)';
  ctx.beginPath();
  ctx.arc(4, 6, 46, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(-12, -14, 6, 0, 0, 46);
  grad.addColorStop(0, '#d83a34');
  grad.addColorStop(0.65, '#a81e1a');
  grad.addColorStop(1, '#6e100d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 43 + Math.sin(i * 3.1) * 3.4;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 212, 164, 0.55)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 31, 0, Math.PI * 2);
  ctx.stroke();

  // Embossed miniature duck silhouette in center of wax seal
  ctx.fillStyle = 'rgba(255, 224, 178, 0.72)';
  ctx.beginPath();
  ctx.ellipse(-2, 7, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -6, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -5, 4.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCustomPageStamps(ctx, stamps = []) {
  for (let i = 0; i < stamps.length; i++) {
    const st = stamps[i];
    const sx = st.u * PAGE_W;
    const sy = st.v * PAGE_H;
    if (st.kind === 'suanbo') {
      drawBlueSuanboSeal(ctx, sx, sy, st.angleDeg || 8);
    } else if (st.kind === 'temp384') {
      drawCrimsonRubberStamp(ctx, '38.4°C 극비', sx, sy, st.angleDeg || -11);
    } else {
      drawCrimsonRubberStamp(ctx, 'CONFIDENTIAL', sx, sy, st.angleDeg || -14);
    }
  }
}

function drawFallbackDuckSketch(ctx, cx, cy, r = 82) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1f1d19';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(-6, 22, r * 0.72, r * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.28, r * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(r * 0.70, -r * 0.22, r * 0.22, r * 0.11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#1f1d19';
  ctx.beginPath();
  ctx.arc(r * 0.38, -r * 0.34, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFramedPhotoMount(ctx, img, x, y, w, h, multiplyArchival = false) {
  ctx.save();
  // Subtle mat card shadow
  ctx.fillStyle = 'rgba(32, 24, 14, 0.16)';
  ctx.fillRect(x + 7, y + 9, w, h);

  ctx.fillStyle = multiplyArchival ? '#ded6be' : '#f7f3e6';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(64, 50, 32, 0.45)';
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x, y, w, h);

  if (img && img.complete && img.naturalWidth > 0) {
    const pad = 16;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const natAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = iw / ih;
    let dw = iw;
    let dh = ih;
    if (natAspect > boxAspect) dh = iw / natAspect;
    else dw = ih * natAspect;
    const dx = x + (w - dw) * 0.5;
    const dy = y + (h - dh) * 0.5;
    if (multiplyArchival) ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 4 dark antique corner photo-mounts holding the specimen photo onto the field log!
  ctx.fillStyle = 'rgba(34, 30, 26, 0.78)';
  const m = 28;
  for (const [cx, cy, sx, sy] of [
    [x - 4, y - 4, 1, 1],
    [x + w + 4, y - 4, -1, 1],
    [x - 4, y + h + 4, 1, -1],
    [x + w + 4, y + h + 4, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sx * m, cy);
    ctx.lineTo(cx, cy + sy * m);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function wrapTextLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// MAIN DIEGETIC 3D FIELD-LOG BOOK CONTROLLER
// ---------------------------------------------------------------------------

export function createDiegeticBook3D({
  meshes,
  renderer,
  logbook = null,
  loop = null,
  secrets = null,
  graph = null,
  drama = null,
  quirks = null,
  lang: initialLang = 'ko',
  onFollowDuckId = null,
  onPlayFlipSound = null,
  onScratchRedaction = null,
  onPageStamp = null,
}) {
  const {
    leftPage,
    rightPage,
    flipLeaf,
    postIt,
    maskingTape,
    tabs = [],
  } = meshes;

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);

  function makeCanvasTex(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    // Blender glTF exports v=0 at top edge -> flipY=false aligns canvas y=0 with book top!
    tex.flipY = false;
    tex.needsUpdate = true;
    return { canvas, ctx: canvas.getContext('2d'), tex };
  }

  const leftBuf = makeCanvasTex(PAGE_W, PAGE_H);
  const rightBuf = makeCanvasTex(PAGE_W, PAGE_H);
  const flipFrontBuf = makeCanvasTex(PAGE_W, PAGE_H);
  const flipBackBuf = makeCanvasTex(PAGE_W, PAGE_H);
  const postItBuf = makeCanvasTex(POSTIT_SIZE, POSTIT_SIZE);
  // Match physical 3D tab top aspect (0.036m wide x 0.064m tall -> 128 x 256 portrait!)
  const tabBufs = BOOK_TAB_DEFS.map(() => makeCanvasTex(128, 256));

  function collectMeshes(rootObj) {
    if (!rootObj) return [];
    if (rootObj.isMesh) return [rootObj];
    const list = [];
    rootObj.traverse((ch) => {
      if (ch.isMesh) list.push(ch);
    });
    return list;
  }

  // Bind CanvasTextures cleanly by matching glTF material name across single or multi-primitive groups
  function bindPageMatByName(rootObj, matPrefix, tex, polyOffset = false) {
    const meshList = collectMeshes(rootObj);
    let bound = false;
    for (const mObj of meshList) {
      const mats = Array.isArray(mObj.material) ? mObj.material : [mObj.material];
      for (const m of mats) {
        if (!m) continue;
        if (!matPrefix || (m.name && m.name.startsWith(matPrefix))) {
          m.map = tex;
          m.color.setHex(0xffffff);
          m.roughness = 0.88;
          m.metalness = 0.0;
          if (polyOffset) {
            m.polygonOffset = true;
            m.polygonOffsetFactor = -1;
            m.polygonOffsetUnits = -1;
          }
          m.needsUpdate = true;
          bound = true;
        }
      }
    }
    if (!bound && meshList[0]) {
      const m = Array.isArray(meshList[0].material) ? meshList[0].material[0] : meshList[0].material;
      if (m) {
        m.map = tex;
        m.color.setHex(0xffffff);
        m.roughness = 0.88;
        m.needsUpdate = true;
      }
    }
  }

  bindPageMatByName(leftPage, 'M_Book_Dynamic_Left', leftBuf.tex, false);
  bindPageMatByName(rightPage, 'M_Book_Dynamic_Right', rightBuf.tex, false);
  bindPageMatByName(flipLeaf, 'M_Book_Flip_Front', flipFrontBuf.tex, true);
  bindPageMatByName(flipLeaf, 'M_Book_Flip_Back', flipBackBuf.tex, true);
  bindPageMatByName(postIt, 'M_Book_PostIt', postItBuf.tex, true);
  for (const mObj of collectMeshes(maskingTape)) {
    const mats = Array.isArray(mObj.material) ? mObj.material : [mObj.material];
    for (const tm of mats) {
      if (!tm) continue;
      tm.transparent = true;
      tm.opacity = 0.62;
      tm.polygonOffset = true;
      tm.polygonOffsetFactor = -2;
      tm.polygonOffsetUnits = -2;
      tm.needsUpdate = true;
    }
  }
  tabs.forEach((tb, idx) => {
    if (tb && tabBufs[idx]) bindPageMatByName(tb, `M_Book_Tab_${idx}`, tabBufs[idx].tex, false);
  });

  // Collect ALL primitive sub-meshes of Book_FlipLeaf that carry the 4 Blender Shape Keys
  const flipPrimitives = collectMeshes(flipLeaf).filter(
    (m) => Array.isArray(m.morphTargetInfluences) && m.morphTargetInfluences.length >= 4,
  );
  for (const fp of flipPrimitives) fp.frustumCulled = false;
  if (flipLeaf) {
    flipLeaf.visible = false;
    flipLeaf.frustumCulled = false;
  }

  // Load archival illustration assets asynchronously and repaint once decoded
  const imgCache = {};
  function loadArt(key, relPath) {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      imgCache[key] = im;
      repaintCurrentSpread();
    };
    im.src = assetUrl(relPath);
    imgCache[key] = im;
  }
  loadArt('plate', 'sanctuary/textures/book_specimen_plate.jpg');
  loadArt('spread', 'sanctuary/textures/book_open_spread.jpg');
  loadArt('cover', 'sanctuary/textures/book_cloth_cover.jpg');
  loadArt('ukiyoe', 'sanctuary/textures/onsen_duck_ukiyoe.jpg');
  loadArt('easel', 'sanctuary/textures/watercolor_easel_canvas.jpg');

  const customImgCache = new Map();
  function getCustomImg(dataUrl) {
    if (!dataUrl) return null;
    if (customImgCache.has(dataUrl)) return customImgCache.get(dataUrl);
    const im = new Image();
    im.onload = () => repaintCurrentSpread();
    im.src = dataUrl;
    customImgCache.set(dataUrl, im);
    return im;
  }

  // Book runtime state
  let currentLang = initialLang || 'ko';
  let spreadIdx = 0;
  let stampMode = false;
  let stampKindCursor = 0;
  const STAMP_KINDS = ['suanbo', 'confidential', 'temp384'];
  let cachedBook = buildBookSpreads({ logbook: logbook || readSharedLogbook(), loop, secrets, graph, drama, lang: currentLang });
  let rightActionRects = []; // clickable UV regions on right page (e.g. "함께 타기")
  let leftActionRects = [];  // clickable UV regions on left page (unlocked unexpected ducks!)
  let flipState = null; // { dir: 1|-1, targetIdx, t, elapsed, previewFrozen }

  function drawMarineSpecimenPlate(ctx, items, shelfNum) {
    // Crisp botanical/nautical archival pen-and-ink specimen grid for caught sea collectibles
    ctx.save();
    ctx.strokeStyle = 'rgba(26, 22, 16, 0.72)';
    ctx.fillStyle = '#181612';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(118, 194, 770, 690);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(130, 206, 746, 666);

    // Subtle nautical compass rose watermark in center
    ctx.save();
    ctx.translate(503, 539);
    ctx.strokeStyle = 'rgba(54, 44, 28, 0.14)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 148, 0, Math.PI * 2);
    ctx.stroke();
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * (a % 2 === 0 ? 168 : 112), Math.sin(ang) * (a % 2 === 0 ? 168 : 112));
      ctx.stroke();
    }
    ctx.restore();

    const slots = [
      [312, 344], [694, 344],
      [312, 554], [694, 554],
      [312, 764], [694, 764],
    ];
    const shown = (items || []).slice(0, 6);
    for (let i = 0; i < shown.length; i++) {
      const it = shown[i];
      const [cx, cy] = slots[i];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = it.found ? '#181512' : 'rgba(40, 34, 26, 0.68)';
      ctx.fillStyle = it.found ? '#181512' : 'rgba(40, 34, 26, 0.68)';
      ctx.lineWidth = it.found ? 3.2 : 2.3;
      if (!it.found) ctx.setLineDash([6, 5]);

      const hint = `${it.id || ''} ${it.title || ''} ${it.kindLabel || ''}`.toLowerCase();
      const kind = hint.includes('bottle') || hint.includes('ship') || hint.includes('병') ? 0
        : hint.includes('island') || hint.includes('섬') || hint.includes('pine') ? 3
        : hint.includes('compass') ? 1
        : hint.includes('shell') ? 2
        : hint.includes('boat') ? 4
        : (i + shelfNum) % 6;
      if (kind === 0) {
        // Corked Ship-in-a-Bottle specimen
        ctx.beginPath();
        ctx.roundRect(-48, -22, 76, 48, 16);
        ctx.stroke();
        ctx.strokeRect(28, -11, 22, 22);
        ctx.strokeRect(48, -13, 12, 26);
        // Tiny rigged sailboat inside the bottle!
        ctx.beginPath();
        ctx.moveTo(-32, 12); ctx.lineTo(12, 12); ctx.lineTo(4, 21); ctx.lineTo(-24, 21); ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, 12); ctx.lineTo(-10, -14); ctx.lineTo(8, 8); ctx.closePath();
        if (it.found) ctx.fill(); else ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-14, 10); ctx.lineTo(-14, -8); ctx.lineTo(-28, 8); ctx.closePath();
        ctx.stroke();
      } else if (kind === 1) {
        // Brass Marine Compass
        ctx.beginPath();
        ctx.arc(0, 4, 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 4, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -24); ctx.lineTo(9, 4); ctx.lineTo(0, 32); ctx.lineTo(-9, 4); ctx.closePath();
        if (it.found) ctx.fill(); else ctx.stroke();
      } else if (kind === 2) {
        // Spiral Nautilus Sea Shell
        ctx.beginPath();
        for (let t = 0; t <= 26; t++) {
          const ang = t * 0.42;
          const r = 3.2 * Math.exp(ang * 0.24);
          const sx = Math.cos(ang) * Math.min(44, r);
          const sy = Math.sin(ang) * Math.min(44, r);
          if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      } else if (kind === 3) {
        // Miniature Volcanic Sea Island w/ Coastal Pine & Ripple Lines
        ctx.beginPath();
        ctx.moveTo(-52, 24);
        ctx.quadraticCurveTo(-24, -6, 0, 2);
        ctx.quadraticCurveTo(26, -12, 52, 24);
        ctx.closePath();
        ctx.stroke();
        // Coastal pine trunk & canopy
        ctx.beginPath();
        ctx.moveTo(10, 2); ctx.lineTo(14, -28);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(14, -32, 20, 10, -0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-58, 34); ctx.lineTo(58, 34);
        ctx.stroke();
      } else if (kind === 4) {
        // Paper Origami Boat
        ctx.beginPath();
        ctx.moveTo(-48, 12); ctx.lineTo(48, 12); ctx.lineTo(30, 38); ctx.lineTo(-30, 38); ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-24, 12); ctx.lineTo(0, -34); ctx.lineTo(24, 12);
        ctx.stroke();
      } else {
        // Starfish / Glass Buoy Float
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const ang = -Math.PI * 0.5 + (k * Math.PI) / 5;
          const r = k % 2 === 0 ? 42 : 17;
          if (k === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = '700 18px "Apple SD Gothic Neo", "Courier New", monospace';
      ctx.textAlign = 'center';
      const titleClean = it.title.length > 22 ? `${it.title.slice(0, 21)}…` : it.title;
      const label = it.found ? `${it.code} · ${titleClean}` : `${it.code} · ???`;
      ctx.fillText(label, 0, 74);
      ctx.restore();
    }
    ctx.restore();
  }

  function refreshData() {
    cachedBook = buildBookSpreads({ logbook: logbook || readSharedLogbook(), loop, secrets, graph, drama, lang: currentLang });
    spreadIdx = Math.max(0, Math.min(cachedBook.spreads.length - 1, spreadIdx));
  }

  // -------------------------------------------------------------------------
  // PAGE RENDERERS (Left Page, Right Page, Post-It, Physical 3D Edge Tabs)
  // -------------------------------------------------------------------------

  function renderLeftPage(ctx, spread, idx, recordActions = true) {
    drawFieldPaperBase(ctx, 'left', spread.leftPageNum, idx);
    const lActions = [];

    if (spread.tab === 'ducks') {
      // 2x2 Grid of Crisp Multiply-Blended Monochrome Rubber Duck Ink Drawings (ZERO crop rectangle!)
      const slots = [
        [292, 358],
        [684, 358],
        [292, 768],
        [684, 768],
      ];
      const plateImg = imgCache.plate;
      const plateReady = Boolean(plateImg && plateImg.complete && plateImg.naturalWidth > 0);

      for (let i = 0; i < spread.entries.length; i++) {
        const e = spread.entries[i];
        const [cx, cy] = slots[i];
        const crop = SPECIMEN_GRID_CROPS[e.designIdx % SPECIMEN_GRID_CROPS.length];

        if (plateReady && crop) {
          const [cu, cv, cw, ch] = crop.rect;
          const sx = cu * plateImg.naturalWidth;
          const sy = cv * plateImg.naturalHeight;
          const sw = cw * plateImg.naturalWidth;
          const sh = ch * plateImg.naturalHeight;
          const drawW = 290;
          const drawH = drawW * (sh / sw);

          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          // Push source paper background to pure #FFF so multiply transfers ONLY pitch-black pen crosshatching!
          ctx.filter = 'brightness(1.24) contrast(1.48) grayscale(1)';
          ctx.drawImage(plateImg, sx, sy, sw, sh, cx - drawW * 0.5, cy - drawH * 0.5 - 16, drawW, drawH);
          ctx.restore();
        } else {
          drawFallbackDuckSketch(ctx, cx, cy - 16, 86);
        }

        // Specimen caption cleanly spaced below duck outline (zero overlap!)
        ctx.save();
        ctx.fillStyle = '#0f0f0d';
        ctx.font = '800 28px "Apple SD Gothic Neo", "Noto Sans KR", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.label, cx, cy + 162);
        if (e.seen) {
          ctx.fillStyle = e.hex;
          ctx.beginPath();
          ctx.arc(cx - 124, cy + 162, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f0f0d';
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (spread.tab === 'atelier') {
      const active = spread.activeCustom;
      const im = active ? getCustomImg(active.dataUrl) : imgCache.easel;
      drawFramedPhotoMount(ctx, im, 118, 210, 770, 680, false);

      ctx.save();
      ctx.fillStyle = '#1d1b18';
      ctx.font = '700 30px "Apple SD Gothic Neo", serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        active ? `ATELIER #${String(active.seq).padStart(2, '0')} · ${active.name}` : 'ATELIER · 수채화 러버덕 습작',
        PAGE_W * 0.5, 962,
      );
      ctx.font = '500 22px "Apple SD Gothic Neo", serif';
      ctx.fillStyle = 'rgba(42, 36, 28, 0.78)';
      ctx.fillText(
        active
          ? '수채화 이젤에서 직접 채색해 성소 순환 수로에 합류시킨 표본'
          : '수채화 이젤에서 그림을 그린 뒤 「풀에 띄우기」로 등록하세요',
        PAGE_W * 0.5, 1008,
      );
      ctx.restore();
    } else if (spread.tab === 'collectibles') {
      drawMarineSpecimenPlate(ctx, spread.items, spread.shelfNum);

      ctx.save();
      ctx.fillStyle = '#1d1b18';
      ctx.font = '700 28px "Apple SD Gothic Neo", serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        translate(currentLang, spread.shelfNum === 1 ? 'book.sea.leftTitle1' : 'book.sea.leftTitle2'),
        PAGE_W * 0.5, 956,
      );
      ctx.font = '600 22px "Apple SD Gothic Neo", serif';
      ctx.fillStyle = 'rgba(32, 28, 22, 0.88)';
      ctx.fillText(
        `${spread.bestLine || ''}  ·  ◇ ${spread.shells ?? 0}  ·  ${spread.foundTotal}/${spread.totalCount}`,
        PAGE_W * 0.5, 1004,
      );
      ctx.restore();
    } else if (spread.isSecretFolio) {
      ctx.save();
      ctx.fillStyle = '#141310';
      ctx.font = '800 30px "Apple SD Gothic Neo", "Noto Sans KR", serif';
      ctx.textAlign = 'center';
      ctx.fillText(`UNEXPECTED DUCKS (13–24)`, PAGE_W * 0.5, 178);

      const list = spread.unexpected || [];
      ctx.textAlign = 'left';
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? 96 : 528;
        const y = 264 + row * 126;

        ctx.fillStyle = u.seen ? u.hex : 'rgba(60, 52, 42, 0.25)';
        ctx.beginPath();
        ctx.arc(x + 16, y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a1714';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = u.seen ? '#12110e' : 'rgba(42, 36, 28, 0.65)';
        ctx.font = '700 24px "Apple SD Gothic Neo", "Courier New", monospace';
        ctx.fillText(`${u.code}`, x + 42, y - 10);
        ctx.font = '600 22px "Apple SD Gothic Neo", sans-serif';
        ctx.fillText(u.name, x + 42, y + 20);

        if (u.seen) {
          lActions.push({
            id: `design:${u.id}`,
            label: `${u.name} 함께 타기`,
            u0: (x - 8) / PAGE_W,
            u1: (x + 360) / PAGE_W,
            v0: (y - 36) / PAGE_H,
            v1: (y + 44) / PAGE_H,
          });
        }
      }
      ctx.restore();
    } else {
      drawFramedPhotoMount(ctx, imgCache.ukiyoe, 128, 204, 750, 690, false);

      ctx.save();
      ctx.fillStyle = '#1d1b18';
      ctx.font = '700 28px "Apple SD Gothic Neo", serif';
      ctx.textAlign = 'center';
      ctx.fillText(`TABULA IV · ${translate(currentLang, 'book.title')}`, PAGE_W * 0.5, 964);
      const bestLap = spread.records?.bestLap != null ? `${spread.records.bestLap.toFixed(1)}s` : '—';
      ctx.font = '600 21px "Apple SD Gothic Neo", serif';
      ctx.fillStyle = 'rgba(32, 28, 22, 0.88)';
      ctx.fillText(
        `${spread.earnedCount}/${spread.stamps.length} · ♥ PALS ${spread.palCount || 0} · ♪ ${spread.harmonyCount || 0}/3 · Best ${bestLap}`,
        PAGE_W * 0.5, 1010,
      );
      ctx.restore();
    }

    if (idx > 0) {
      drawHandwrittenCue(ctx, (CUE_LABELS[currentLang] || CUE_LABELS.ko).prev, 216, PAGE_H - 132, -8);
    }
    if (spread.tab === 'ducks' || spread.tab === 'collectibles') {
      drawCrimsonWaxSeal(ctx, PAGE_W - 148, PAGE_H - 160);
    }
    if (quirks) drawCustomPageStamps(ctx, quirks.getPageStamps(idx, 'left'));
    if (recordActions) leftActionRects = lActions;
  }

  function renderRightPage(ctx, spread, idx, totalSpreads, recordActions = true) {
    drawFieldPaperBase(ctx, 'right', spread.rightPageNum, idx);
    const actions = [];

    // Upper-Right Botanical Mountain Fern Pen-Ink Sketch (matching Image 1!)
    drawBotanicalFernInk(ctx, PAGE_W - 148, 650, 0.96);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (spread.tab === 'ducks') {
      // Dual-persona Suanbo Field Research Log: cozy bio + scratchable black-ink classified redaction footnotes!
      const REDACT_SLOTS = [
        { id: 'classic_mole', key: 'quirk.redactedClassic' },
        { id: 'temp_384',     key: 'quirk.redactedTemp' },
        { id: 'cherry_beret', key: 'quirk.redactedCherry' },
        { id: 'daisy_pen',    key: 'quirk.redactedDaisy' },
      ];
      let y = 178;
      for (let i = 0; i < spread.entries.length; i++) {
        const e = spread.entries[i];
        const maxW = y < 600 ? 595 : 530;

        ctx.fillStyle = '#0c0c0b';
        ctx.font = '800 30px "Apple SD Gothic Neo", "Courier New", monospace';
        const mark = e.seen ? '●' : '○';
        ctx.fillText(`${mark}  ${e.name}`, 88, y);

        ctx.fillStyle = '#151412';
        ctx.font = '600 22px "Apple SD Gothic Neo", "Courier New", monospace';
        const cueCfg = CUE_LABELS[currentLang] || CUE_LABELS.ko;
        const traitLines = wrapTextLines(ctx, `${cueCfg.traitPrefix} ${e.trait}`, maxW);
        for (const ln of traitLines) {
          y += 34;
          ctx.fillText(ln, 108, y);
        }
        y += 34;
        ctx.fillText(`${cueCfg.habitatPrefix} ${e.habitat}`, 108, y);

        // On Folio I (spread 0), render scratchable 1968 Archivist redaction bar below each entry!
        if (idx === 0 && quirks && REDACT_SLOTS[i]) {
          const slot = REDACT_SLOTS[i];
          y += 33;
          const redacted = quirks.isRedacted(slot.id);
          if (redacted) {
            const bx = 104;
            const by = y - 14;
            const bw = Math.min(488, maxW - 14);
            const bh = 28;
            ctx.fillStyle = '#161310';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = 'rgba(244, 232, 200, 0.72)';
            ctx.font = '700 16px "Courier New", monospace';
            ctx.fillText(
              currentLang === 'en' ? '████ [CLASSIFIED · CLICK TO SCRATCH INK] ████'
                : currentLang === 'ja' ? '████ [黒塗り機密 · クリックで削る] ████'
                : '████ [1968 기밀 먹줄 · 클릭해 긁어내기] ████',
              bx + 12,
              y,
            );
            actions.push({
              kind: 'redaction',
              id: slot.id,
              label: translate(currentLang, 'quirk.redactedClick'),
              u0: bx / PAGE_W,
              u1: (bx + bw) / PAGE_W,
              v0: (by - 4) / PAGE_H,
              v1: (by + bh + 4) / PAGE_H,
            });
          } else {
            ctx.fillStyle = '#7c1a24';
            ctx.font = '700 18.5px "Apple SD Gothic Neo", "Courier New", monospace';
            const secretLines = wrapTextLines(ctx, `※ ${translate(currentLang, slot.key)}`, maxW - 10);
            for (let si = 0; si < Math.min(2, secretLines.length); si++) {
              if (si > 0) y += 26;
              ctx.fillText(secretLines[si], 108, y);
            }
          }
        }
        y += 50;
      }
    } else if (spread.tab === 'atelier') {
      let y = 188;
      ctx.fillStyle = '#171614';
      ctx.font = '700 30px "Apple SD Gothic Neo", serif';
      ctx.fillText(translate(currentLang, 'book.atelier.heading'), 92, y);
      y += 48;

      if (spread.customs.length === 0) {
        ctx.font = '500 22px "Apple SD Gothic Neo", monospace';
        ctx.fillStyle = '#2a2620';
        ctx.fillText(`○ ${translate(currentLang, 'book.atelier.empty1')}`, 92, y);
        y += 39.5;
        ctx.fillText(`  ${translate(currentLang, 'book.atelier.empty2')}`, 92, y);
        y += 68;
      } else {
        const shown = spread.customs.slice(0, 3);
        const rideLbl = translate(currentLang, 'book.atelier.rideBtn');
        for (const c of shown) {
          ctx.fillStyle = '#171614';
          ctx.font = '700 25px "Apple SD Gothic Neo", monospace';
          ctx.fillText(`●  #${String(c.seq).padStart(2, '0')} ${c.name}`, 92, y);

          const bx = 468;
          const by = y - 18;
          const bw = 166;
          const bh = 36;
          ctx.strokeStyle = '#1c5c52';
          ctx.lineWidth = 2.4;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = '#1c5c52';
          ctx.font = '700 20px "Apple SD Gothic Neo", sans-serif';
          ctx.fillText(rideLbl, bx + 18, y + 1);
          actions.push({
            id: c.id,
            label: `${c.name} · ${rideLbl}`,
            u0: bx / PAGE_W,
            u1: (bx + bw) / PAGE_W,
            v0: by / PAGE_H,
            v1: (by + bh) / PAGE_H,
          });
          y += 58;
        }
        y += 18;
      }

      // Campfire Special Hearth Unlocks
      ctx.fillStyle = '#171614';
      ctx.font = '700 26px "Apple SD Gothic Neo", serif';
      ctx.fillText(translate(currentLang, 'book.atelier.hearthHeading'), 92, y);
      y += 44;

      const rideLblH = translate(currentLang, 'book.atelier.rideBtn');
      for (const spec of Object.values(SPECIAL_HEARTH_DUCKS)) {
        const unlocked = spread.unlocks?.[spec.id] !== null;
        const locName = translate(currentLang, `duck.${spec.id}`);
        ctx.fillStyle = unlocked ? '#171614' : 'rgba(42, 36, 30, 0.62)';
        ctx.font = '700 24px "Apple SD Gothic Neo", monospace';
        ctx.fillText(`${unlocked ? '●' : '○'}  ${locName}`, 92, y);

        if (unlocked) {
          const bx = 448;
          const by = y - 17;
          const bw = 166;
          const bh = 34;
          ctx.strokeStyle = '#8b291e';
          ctx.lineWidth = 2.4;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = '#8b291e';
          ctx.font = '700 19px "Apple SD Gothic Neo", sans-serif';
          ctx.fillText(rideLblH, bx + 18, y + 1);
          actions.push({
            id: spec.id,
            label: `${locName} · ${rideLblH}`,
            u0: bx / PAGE_W,
            u1: (bx + bw) / PAGE_W,
            v0: by / PAGE_H,
            v1: (by + bh) / PAGE_H,
          });
        }
        y += 37;
        ctx.font = '500 20px "Apple SD Gothic Neo", monospace';
        const note = unlocked ? translate(currentLang, 'book.notes.hearth') : translate(currentLang, 'book.notes.hearthLocked');
        for (const ln of wrapTextLines(ctx, `  ${note}`, 500)) {
          ctx.fillText(ln, 106, y);
          y += 32;
        }
        y += 22;
      }
    } else if (spread.tab === 'collectibles') {
      let y = 188;
      ctx.fillStyle = '#171614';
      ctx.font = '700 29px "Apple SD Gothic Neo", serif';
      ctx.fillText(
        translate(currentLang, spread.shelfNum === 1 ? 'book.sea.rightTitle1' : 'book.sea.rightTitle2'),
        92, y,
      );
      y += 50;

      const lockedHint = translate(currentLang, 'book.sea.lockedHint');
      for (const item of spread.items.slice(0, 6)) {
        ctx.fillStyle = item.found ? '#171614' : 'rgba(44, 38, 32, 0.72)';
        ctx.font = '700 23px "Apple SD Gothic Neo", monospace';
        ctx.fillText(`${item.found ? '●' : '○'}  ${item.code}  ${item.found ? item.title : item.kindLabel}`, 92, y);
        y += 36;
        ctx.font = '500 19px "Apple SD Gothic Neo", monospace';
        const desc = item.found ? item.description : lockedHint;
        ctx.fillText(`   ${desc.slice(0, 44)}${desc.length > 44 ? '…' : ''}`, 96, y);
        y += 46;
      }
    } else if (spread.isSecretFolio) {
      let y = 188;
      ctx.fillStyle = '#171614';
      ctx.font = '800 30px "Apple SD Gothic Neo", serif';
      ctx.fillText(translate(currentLang, 'book.notes.secrets'), 92, y);
      y += 58;

      for (const sec of spread.secretEntries || []) {
        ctx.fillStyle = sec.unlocked ? '#7e1c18' : '#1f1d1a';
        ctx.font = '800 25px "Apple SD Gothic Neo", monospace';
        const tag = sec.unlocked ? `[★ ${translate(currentLang, 'book.stamps.unlocked')}]` : `[?]`;
        ctx.fillText(`${tag}  ${sec.name} → ${sec.duckName}`, 92, y);
        y += 38;
        ctx.fillStyle = '#2a2620';
        ctx.font = '600 21px "Apple SD Gothic Neo", monospace';
        for (const ln of wrapTextLines(ctx, `   ${sec.hint}`, 530)) {
          ctx.fillText(ln, 96, y);
          y += 34;
        }
        y += 28;
      }
    } else {
      let y = 188;
      ctx.fillStyle = '#171614';
      ctx.font = '700 29px "Apple SD Gothic Neo", serif';
      ctx.fillText(translate(currentLang, 'book.title'), 92, y);
      y += 52;

      for (const st of spread.stamps.slice(0, 8)) {
        ctx.fillStyle = st.earned ? '#7e1c18' : 'rgba(46, 40, 32, 0.64)';
        ctx.font = '700 23px "Apple SD Gothic Neo", monospace';
        ctx.fillText(`${st.earned ? '[印]' : '[○]'}  ${st.title}`, 92, y);
        y += 34;
        ctx.fillStyle = '#2c261f';
        ctx.font = '500 19px "Apple SD Gothic Neo", monospace';
        ctx.fillText(`     ${st.text.slice(0, 36)}`, 92, y);
        y += 46;
      }
    }
    ctx.restore();

    // Layer 3 Stamped Decals: Tilted Crimson `CONFIDENTIAL`, Blue Circular `수안보 도장` & Circular Archive Seal!
    drawCrimsonRubberStamp(ctx, spread.stamp || 'CONFIDENTIAL', 330, PAGE_H - 224, -14);
    drawBlueSuanboSeal(ctx, 578, PAGE_H - 216, 11);
    drawCircularArchiveSeal(ctx, PAGE_W - 178, PAGE_H - 210);
    if (quirks) drawCustomPageStamps(ctx, quirks.getPageStamps(idx, 'right'));

    if (idx < totalSpreads - 1) {
      drawHandwrittenCue(ctx, (CUE_LABELS[currentLang] || CUE_LABELS.ko).next, PAGE_W - 320, PAGE_H - 122, -7);
    }

    if (recordActions) rightActionRects = actions;
  }

  function renderPostIt(ctx, lines) {
    ctx.save();
    // Classic weathered sticky-note pale yellow with crisp dark handwritten Korean field notes
    const bg = ctx.createLinearGradient(0, 0, POSTIT_SIZE, POSTIT_SIZE);
    bg.addColorStop(0, '#dcd89c');
    bg.addColorStop(0.55, '#d1cc8a');
    bg.addColorStop(1, '#c0ba74');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, POSTIT_SIZE, POSTIT_SIZE);

    const topSh = ctx.createLinearGradient(0, 0, 0, 82);
    topSh.addColorStop(0, 'rgba(68, 62, 32, 0.30)');
    topSh.addColorStop(1, 'rgba(68, 62, 32, 0)');
    ctx.fillStyle = topSh;
    ctx.fillRect(0, 0, POSTIT_SIZE, 82);

    ctx.strokeStyle = 'rgba(84, 76, 40, 0.45)';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, POSTIT_SIZE - 8, POSTIT_SIZE - 8);

    ctx.fillStyle = '#11100d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = 108;
    for (let i = 0; i < lines.length; i++) {
      ctx.font = i === 0
        ? '800 36px "Apple SD Gothic Neo", "Nanum Pen Script", serif'
        : '700 31px "Apple SD Gothic Neo", "Nanum Pen Script", serif';
      const prefix = i === 0 ? '· ' : '• ';
      for (const ln of wrapTextLines(ctx, `${prefix}${lines[i]}`, POSTIT_SIZE - 68)) {
        ctx.fillText(ln, 34, y);
        y += 56;
      }
      y += 10;
    }
    ctx.restore();
  }

  function renderTabs(activeTabId) {
    BOOK_TAB_DEFS.forEach((def, idx) => {
      const buf = tabBufs[idx];
      if (!buf) return;
      const { ctx } = buf;
      const active = def.id === activeTabId;
      ctx.save();
      ctx.fillStyle = active ? '#21635d' : '#bba476';
      ctx.fillRect(0, 0, 128, 256);
      ctx.strokeStyle = active ? '#d9b468' : '#583e20';
      ctx.lineWidth = 7;
      ctx.strokeRect(4, 4, 120, 248);

      // Upright vertical stacked characters cleanly centered in the 1:2 portrait 3D tab
      const rawLbl = def.i18nKey ? translate(currentLang, def.i18nKey) : def.label;
      ctx.fillStyle = active ? '#fcf4df' : '#1b130a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (currentLang === 'en') {
        ctx.translate(64, 128);
        ctx.rotate(-Math.PI / 2);
        ctx.font = '800 30px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(rawLbl.slice(0, 7).toUpperCase(), 0, 0);
      } else {
        ctx.font = '800 32px "Apple SD Gothic Neo", sans-serif';
        const chars = [...rawLbl].slice(0, 4);
        const stepY = 46;
        const startY = 128 - ((chars.length - 1) * stepY) * 0.5;
        chars.forEach((ch, ci) => {
          ctx.fillText(ch, 70, startY + ci * stepY);
        });
      }
      ctx.restore();
      buf.tex.needsUpdate = true;
    });
  }

  function repaintCurrentSpread() {
    refreshData();
    const sp = cachedBook.spreads[spreadIdx];
    if (!sp) return;
    renderLeftPage(leftBuf.ctx, sp, spreadIdx);
    renderRightPage(rightBuf.ctx, sp, spreadIdx, cachedBook.spreads.length, true);
    renderPostIt(postItBuf.ctx, sp.postit || []);
    renderTabs(sp.tab);
    leftBuf.tex.needsUpdate = true;
    rightBuf.tex.needsUpdate = true;
    postItBuf.tex.needsUpdate = true;
  }

  function setFlipMeshMorph(t) {
    if (!flipPrimitives.length) return;
    const weights = computeFlipMorphWeights(t);
    for (const fp of flipPrimitives) {
      for (let i = 0; i < 4; i++) {
        fp.morphTargetInfluences[i] = weights[i];
      }
    }
  }

  function setPostItVisible(vis) {
    if (postIt) postIt.visible = vis;
    if (maskingTape) maskingTape.visible = vis;
  }

  function startFlipTo(targetIdx) {
    refreshData();
    const clamped = Math.max(0, Math.min(cachedBook.spreads.length - 1, targetIdx));
    if (clamped === spreadIdx) return false;

    // If a turn is already active, commit it immediately before starting the next
    if (flipState) {
      spreadIdx = flipState.targetIdx;
      flipState = null;
      if (flipLeaf) flipLeaf.visible = false;
      setPostItVisible(true);
      repaintCurrentSpread();
      if (clamped === spreadIdx) return true;
    }

    const dir = clamped > spreadIdx ? 1 : -1;
    const nextSp = cachedBook.spreads[clamped];

    if (!flipLeaf || !flipPrimitives.length) {
      spreadIdx = clamped;
      repaintCurrentSpread();
      return true;
    }

    if (dir > 0) {
      // Forward turn: right page lifts up (front=curRight, back=nextLeft), nextRight revealed beneath!
      flipFrontBuf.ctx.drawImage(rightBuf.canvas, 0, 0);
      renderLeftPage(flipBackBuf.ctx, nextSp, clamped);
      renderRightPage(rightBuf.ctx, nextSp, clamped, cachedBook.spreads.length, false);
      rightBuf.tex.needsUpdate = true;
    } else {
      // Backward turn: left page lifts from left to right (back=curLeft, front=prevRight), prevLeft revealed!
      flipBackBuf.ctx.drawImage(leftBuf.canvas, 0, 0);
      renderRightPage(flipFrontBuf.ctx, nextSp, clamped, cachedBook.spreads.length, false);
      renderLeftPage(leftBuf.ctx, nextSp, clamped);
      leftBuf.tex.needsUpdate = true;
    }
    flipFrontBuf.tex.needsUpdate = true;
    flipBackBuf.tex.needsUpdate = true;

    setPostItVisible(false);
    flipLeaf.visible = true;
    const startT = dir > 0 ? 0 : 1;
    setFlipMeshMorph(startT);
    flipState = { dir, targetIdx: clamped, elapsed: 0, t: startT, previewFrozen: false };
    if (onPlayFlipSound) onPlayFlipSound();
    return true;
  }

  function update(dt) {
    if (!flipState || flipState.previewFrozen) return;
    flipState.elapsed += Math.min(dt, 0.05);
    const u = Math.min(1, flipState.elapsed / FLIP_DURATION_SEC);
    const eased = easeInOutCubic(u);
    const t = flipState.dir > 0 ? eased : (1 - eased);
    flipState.t = t;
    setFlipMeshMorph(t);

    if (u >= 1) {
      spreadIdx = flipState.targetIdx;
      flipState = null;
      if (flipLeaf) flipLeaf.visible = false;
      setPostItVisible(true);
      repaintCurrentSpread();
    }
  }

  // Raycast helpers for Layer 5 (Zero UI Buttons — Direct 3D Page & Tab Interaction!)
  const rayTargets = [
    ...tabs.filter(Boolean),
    postIt,
    leftPage,
    rightPage,
  ].filter(Boolean);

  function rootOfHit(obj) {
    let cur = obj;
    while (cur) {
      if (cur === leftPage || cur === rightPage || cur === postIt || tabs.includes(cur)) return cur;
      cur = cur.parent;
    }
    return null;
  }

  function pickInteractive(raycaster) {
    const hits = raycaster.intersectObjects(rayTargets, true);
    if (!hits.length) return null;
    const hit = hits[0];
    const obj = rootOfHit(hit.object);
    if (!obj) return null;

    const tabIdx = tabs.indexOf(obj);
    if (tabIdx >= 0) {
      const def = BOOK_TAB_DEFS[tabIdx];
      return { kind: 'tab', tabId: def.id, label: `📑 ${def.label} 섹션으로 넘기기` };
    }
    if (obj === postIt) {
      return { kind: 'postit', label: '📝 현장 조사 메모 (우측 페이지 클릭: 다음 장)' };
    }
    if (obj === rightPage) {
      if (stampMode && hit.uv) {
        return { kind: 'stamp', side: 'right', u: hit.uv.x, v: hit.uv.y, label: translate(currentLang, 'quirk.stampModeOn') };
      }
      if (hit.uv) {
        const u = hit.uv.x;
        const v = hit.uv.y;
        const act = rightActionRects.find((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
        if (act) {
          if (act.kind === 'redaction') return { kind: 'redaction', redactionId: act.id, label: act.label };
          return { kind: 'follow', duckId: act.id, label: `🐥 ${act.label}` };
        }
      }
      const nextNum = cachedBook.spreads[spreadIdx + 1]?.rightPageNum;
      return spreadIdx < cachedBook.spreads.length - 1
        ? { kind: 'next', label: `다음 페이지로 넘기기 (p.${String(nextNum).padStart(2, '0')}) →` }
        : { kind: 'end', label: '도감 마지막 장' };
    }
    if (obj === leftPage) {
      if (stampMode && hit.uv) {
        return { kind: 'stamp', side: 'left', u: hit.uv.x, v: hit.uv.y, label: translate(currentLang, 'quirk.stampModeOn') };
      }
      if (hit.uv) {
        const u = hit.uv.x;
        const v = hit.uv.y;
        const act = leftActionRects.find((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
        if (act) return { kind: 'follow', duckId: act.id, label: `🐥 ${act.label}` };
      }
      const prevNum = cachedBook.spreads[spreadIdx - 1]?.leftPageNum;
      return spreadIdx > 0
        ? { kind: 'prev', label: `← 이전 페이지로 넘기기 (p.${String(prevNum).padStart(2, '0')})` }
        : { kind: 'start', label: '도감 첫 장' };
    }
    return null;
  }

  function slamStampAt(side, u, v, kind = null) {
    if (!quirks) return null;
    const chosen = kind || STAMP_KINDS[stampKindCursor++ % STAMP_KINDS.length];
    const st = quirks.addPageStamp(spreadIdx, side, u, v, chosen);
    repaintCurrentSpread();
    onPageStamp?.(st);
    return st;
  }

  function handleClick(raycaster, { shiftKey = false } = {}) {
    if (shiftKey && quirks) {
      const hits = raycaster.intersectObjects([leftPage, rightPage].filter(Boolean), true);
      if (hits.length && hits[0].uv) {
        const obj = rootOfHit(hits[0].object);
        const side = obj === leftPage ? 'left' : 'right';
        slamStampAt(side, hits[0].uv.x, hits[0].uv.y);
        return true;
      }
    }
    const hit = pickInteractive(raycaster);
    if (!hit) return false;
    if (hit.kind === 'stamp') {
      slamStampAt(hit.side, hit.u, hit.v);
      return true;
    }
    if (hit.kind === 'redaction' && quirks) {
      if (quirks.scratchRedaction(hit.redactionId)) {
        repaintCurrentSpread();
        onScratchRedaction?.(hit.redactionId);
      }
      return true;
    }
    if (hit.kind === 'next') return startFlipTo(spreadIdx + 1);
    if (hit.kind === 'prev') return startFlipTo(spreadIdx - 1);
    if (hit.kind === 'tab') {
      refreshData();
      const target = cachedBook.tabStarts[hit.tabId] ?? 0;
      return startFlipTo(target);
    }
    if (hit.kind === 'follow' && onFollowDuckId) {
      onFollowDuckId(hit.duckId);
      return true;
    }
    if (hit.kind === 'postit' && spreadIdx < cachedBook.spreads.length - 1) {
      return startFlipTo(spreadIdx + 1);
    }
    return false;
  }

  /**
   * Derive exact world-space camera pose & cool `#CBE8F5` overhead spotlight pose
   * straight from the actual left/right 3D page vertices (immune to Blender/glTF axis conventions).
   */
  function getReadingRigPoses() {
    if (!leftPage || !rightPage) return null;
    leftPage.updateWorldMatrix(true, true);
    rightPage.updateWorldMatrix(true, true);

    const boxL = new THREE.Box3().setFromObject(leftPage);
    const boxR = new THREE.Box3().setFromObject(rightPage);
    const centerL = boxL.getCenter(new THREE.Vector3());
    const centerR = boxR.getCenter(new THREE.Vector3());
    const center = centerL.clone().add(centerR).multiplyScalar(0.5);
    const rightAxis = centerR.clone().sub(centerL).normalize();

    // Sample actual top (min v_glTF) and bottom (max v_glTF) page vertices on leftPage in world space
    const primL = collectMeshes(leftPage)[0];
    let upAxis = new THREE.Vector3(0, 1, 0);
    if (primL?.geometry?.attributes?.position && primL.geometry.attributes.uv) {
      const posAttr = primL.geometry.attributes.position;
      const uvAttr = primL.geometry.attributes.uv;
      let minV = Infinity;
      let maxV = -Infinity;
      let topIdx = 0;
      let botIdx = 0;
      for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const v = uvAttr.getY(i);
        if (Math.abs(u - 0.5) < 0.15) {
          if (v < minV) { minV = v; topIdx = i; }
          if (v > maxV) { maxV = v; botIdx = i; }
        }
      }
      const pTop = new THREE.Vector3().fromBufferAttribute(posAttr, topIdx).applyMatrix4(primL.matrixWorld);
      const pBot = new THREE.Vector3().fromBufferAttribute(posAttr, botIdx).applyMatrix4(primL.matrixWorld);
      if (pTop.distanceToSquared(pBot) > 1e-4) {
        upAxis = pTop.sub(pBot).normalize();
      }
    }
    const normalAxis = rightAxis.clone().cross(upAxis).normalize();
    if (normalAxis.y < 0) normalAxis.negate();

    // Slightly lower reading angle so warm Onsen veranda & brass desk lantern frame the open book (Ref Image 1!)
    const viewDir = normalAxis.clone().multiplyScalar(0.86).addScaledVector(upAxis, -0.50).normalize();
    const camTarget = center.clone().addScaledVector(rightAxis, 0.022).addScaledVector(upAxis, 0.020);
    const camPos = camTarget.clone().addScaledVector(viewDir, 0.87);
    const spotPos = center.clone().addScaledVector(normalAxis, 1.15).addScaledVector(upAxis, 0.14);
    return { camPos, camTarget, fov: 35, spotPos, spotTarget: center.clone() };
  }

  // Initial paint so the 3D book on the lectern already looks alive even from the main sanctuary view!
  repaintCurrentSpread();

  return {
    refresh: repaintCurrentSpread,
    setLanguage(nextLang) {
      if (!nextLang || nextLang === currentLang) return;
      currentLang = nextLang;
      repaintCurrentSpread();
    },
    setStampMode(on) {
      stampMode = Boolean(on);
      return stampMode;
    },
    getStampMode: () => stampMode,
    slamStampAt,
    scratchRedaction(id) {
      if (!quirks) return false;
      const changed = quirks.scratchRedaction(id);
      if (changed) {
        repaintCurrentSpread();
        onScratchRedaction?.(id);
      }
      return changed;
    },
    update,
    pickInteractive,
    handleClick,
    getReadingRigPoses,
    nextPage: () => startFlipTo(spreadIdx + 1),
    prevPage: () => startFlipTo(spreadIdx - 1),
    jumpToTab(tabId) {
      refreshData();
      const target = cachedBook.tabStarts[tabId] ?? 0;
      if (target === spreadIdx) {
        repaintCurrentSpread();
        return false;
      }
      return startFlipTo(target);
    },
    // Deterministic mid-flip inspection helper for live screenshot verification
    freezeFlipPreview(t = 0.48) {
      if (!flipState) startFlipTo(Math.min(cachedBook.spreads.length - 1, spreadIdx + 1));
      if (flipState) {
        flipState.previewFrozen = true;
        flipState.t = t;
        setFlipMeshMorph(t);
      }
    },
    finishFlipImmediately() {
      if (!flipState) return;
      spreadIdx = flipState.targetIdx;
      flipState = null;
      if (flipLeaf) flipLeaf.visible = false;
      setPostItVisible(true);
      repaintCurrentSpread();
    },
    getState() {
      const sp = cachedBook.spreads[spreadIdx] || {};
      return {
        mode: 'diegetic-3d',
        lang: currentLang,
        spreadIdx,
        totalSpreads: cachedBook.spreads.length,
        tab: sp.tab || 'ducks',
        pages: [sp.leftPageNum || 1, sp.rightPageNum || 2],
        isFlipping: Boolean(flipState),
        flipT: flipState ? +flipState.t.toFixed(3) : 0,
        morphTargets: flipPrimitives[0]?.morphTargetInfluences?.length || 0,
        morphNames: flipPrimitives[0]?.morphTargetDictionary ? Object.keys(flipPrimitives[0].morphTargetDictionary) : [],
        flipPrimitiveCount: flipPrimitives.length,
        hasPostIt: Boolean(postIt),
        tabCount: tabs.filter(Boolean).length,
        secretsUnlocked: secrets?.getUnlocked?.().length || 0,
      };
    },
  };
}
