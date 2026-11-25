// Hydro Sanctuary Loop + Graph Engine (v2 — Steam Release Systems):
// Connects Placid Plastic Duck arrival/renaming/ARG triggers, WEBFISHING-grade 4-bait
// tactile reeling + 12-species rarity/size records, Campfire 4-chord Harmony Progressions,
// Sea-Glass Shell cozy economy, Spirit City Pomodoro Focus Companion, and Onsen 1968 Terminal
// into one deterministic persistent progression graph.
// Zero Math.random / Date.now for testability & scripts/check.mjs seeded-sim compliance.

import { DESIGNS, HATS } from '../pool/ducks.js';
import { COLLECTIBLES } from '../pool/collectibles.js';

export const SANCTUARY_GRAPH_KEY = 'rubber-duck-pool.graph.v1';
export const ARRIVAL_INTERVAL_SEC = 75;

const STARTER_HATS = ['none', 'party', 'flower', 'shades'];
const LOCKED_HATS = HATS.map((h) => h.id).filter((id) => !STARTER_HATS.includes(id));

export const GUITAR_CHORDS = Object.freeze([
  { id: 'G',  label: 'G',  freqs: [196.00, 246.94, 293.66, 392.00, 493.88] },
  { id: 'D',  label: 'D',  freqs: [146.83, 220.00, 293.66, 369.99, 440.00] },
  { id: 'Em', label: 'Em', freqs: [164.81, 246.94, 329.63, 392.00, 493.88] },
  { id: 'C',  label: 'C',  freqs: [130.81, 196.00, 261.63, 329.63, 392.00] },
  { id: 'Am', label: 'Am', freqs: [110.00, 164.81, 220.00, 261.63, 329.63] },
  { id: 'Bm', label: 'Bm', freqs: [123.47, 185.00, 246.94, 293.66, 369.99] },
]);

export const HARMONY_SONGS = Object.freeze([
  {
    id: 'twilight_lullaby',
    seq: ['G', 'D', 'Em', 'C'],
    unlocksDuck: '13-teapot',
    rewardShells: 15,
    rewardBait: null,
    title: { ko: '황혼의 자장가', en: 'Twilight Lullaby', ja: '黄昏の子守唄' },
  },
  {
    id: 'lantern_waltz',
    seq: ['Em', 'C', 'G', 'D'],
    unlocksDuck: '17-bookbinder',
    rewardShells: 15,
    rewardBait: null,
    title: { ko: '등불의 왈츠', en: 'Lantern Waltz', ja: '灯火のワルツ' },
  },
  {
    id: 'sea_breeze',
    seq: ['C', 'G', 'Am', 'Em'],
    unlocksDuck: null,
    rewardShells: 20,
    rewardBait: { id: 'yuzu', count: 3 },
    title: { ko: '해풍의 발라드', en: 'Sea Breeze Ballad', ja: '潮風のバラード' },
  },
]);

export const FISHING_BAITS = Object.freeze([
  { id: 'basic', infinite: true,  rarityBoost: 0.0,  tugScale: 1.0, icon: '🎋' },
  { id: 'yuzu',  infinite: false, rarityBoost: 0.24, tugScale: 1.1, icon: '🍊' },
  { id: 'smore', infinite: false, rarityBoost: 0.42, tugScale: 1.25, icon: '🔥' },
  { id: 'ink',   infinite: false, rarityBoost: 0.50, tugScale: 1.3, icon: '🎨' },
]);

export const COASTAL_SPECIES = Object.freeze([
  { id: 'sardine',          rarity: 'common',   minCm: 12,  maxCm: 24,  shells: 3,  colorHex: 0x96c8dc, name: { ko: '은빛 정어리', en: 'Silver Sardine', ja: '銀イワシ' } },
  { id: 'mackerel',         rarity: 'common',   minCm: 24,  maxCm: 42,  shells: 4,  colorHex: 0x4b8eb2, name: { ko: '푸른 고등어', en: 'Blue Mackerel', ja: '青サバ' } },
  { id: 'horse_mackerel',   rarity: 'common',   minCm: 18,  maxCm: 34,  shells: 4,  colorHex: 0x7cb8a8, name: { ko: '해안 전갱이', en: 'Coastal Aji', ja: '海辺のアジ' } },
  { id: 'sea_bream',        rarity: 'uncommon', minCm: 30,  maxCm: 56,  shells: 7,  colorHex: 0xe87b6c, name: { ko: '붉은 참돔', en: 'Crimson Bream', ja: '真鯛' } },
  { id: 'kelp_lantern',     rarity: 'uncommon', minCm: 16,  maxCm: 32,  shells: 8,  colorHex: 0x52e0c4, name: { ko: '다시마 초롱어', en: 'Kelp Lanternfish', ja: '昆布チョウチン' } },
  { id: 'pearl_oyster',     rarity: 'uncommon', minCm: 11,  maxCm: 21,  shells: 9,  colorHex: 0xf4e4d0, name: { ko: '진주 조개', en: 'Pearl Oyster', ja: '真珠貝' } },
  { id: 'golden_koi',       rarity: 'rare',     minCm: 42,  maxCm: 72,  shells: 14, colorHex: 0xf6b832, name: { ko: '황금 비단잉어', en: 'Golden Sea Koi', ja: '黄金錦鯉' } },
  { id: 'glass_octopus',    rarity: 'rare',     minCm: 26,  maxCm: 48,  shells: 15, colorHex: 0x8ee4ff, name: { ko: '유리 문어', en: 'Glass Octopus', ja: 'ガラスダコ' } },
  { id: 'moon_jelly',       rarity: 'rare',     minCm: 22,  maxCm: 44,  shells: 16, colorHex: 0xb6a4ff, name: { ko: '달빛 해파리', en: 'Moon Jelly', ja: '月光クラゲ' } },
  { id: 'starlight_naut',   rarity: 'mythic',   minCm: 32,  maxCm: 58,  shells: 26, colorHex: 0xffd27a, name: { ko: '별빛 앵무조개', en: 'Starlight Nautilus', ja: '星屑オウムガイ' } },
  { id: 'onsen_oarfish',    rarity: 'mythic',   minCm: 125, maxCm: 240, shells: 32, colorHex: 0xff6e7a, name: { ko: '온천 산갈치', en: 'Thermal Oarfish', ja: '湯けむりリュウグウ' } },
  { id: 'sunken_bell',      rarity: 'mythic',   minCm: 18,  maxCm: 30,  shells: 28, colorHex: 0xe6bf46, name: { ko: '해저 황동 종', en: 'Sunken Brass Bell', ja: '海底の真鍮鐘' } },
]);

export const SHELL_SHOP_ITEMS = Object.freeze([
  { id: 'pack_yuzu',   cost: 8,  kind: 'bait',   baitId: 'yuzu',  amount: 3 },
  { id: 'pack_smore',  cost: 12, kind: 'bait',   baitId: 'smore', amount: 3 },
  { id: 'unlock_hat',  cost: 15, kind: 'hat' },
  { id: 'summon_duck', cost: 20, kind: 'arrival' },
]);

export const SECRET_NAME_TRIGGERS = Object.freeze([
  {
    id: 'arg_name_kitsune',
    aliases: ['KITSUNE', '여우', 'きつね', 'キツネ'],
    unlocks: '20-radio',
    logId: 'LOG_KITSUNE',
    summary: {
      ko: '암호명 KITSUNE 확인 — 1960년형 라디오 덕이 주파수를 타고 풀에 합류했습니다.',
      en: 'Callsign KITSUNE confirmed — Radio Duck tuned into the sanctuary pool.',
      ja: '暗号名 KITSUNE 確認 — ラジオダックが周波数に乗ってプールへ現れました。',
    },
  },
  {
    id: 'arg_name_yuzu',
    aliases: ['YUZU', '유자', 'ゆず', 'ユズ'],
    unlocks: '15-citrus',
    logId: 'LOG_YUZU',
    summary: {
      ko: '암호명 YUZU 확인 — 향긋한 시트러스 덕이 히노끼 온천 향기를 따라 도착했습니다.',
      en: 'Callsign YUZU confirmed — Citrus Duck drifted in on the hinoki bath steam.',
      ja: '暗号名 YUZU 確認 — シトラスダックが檜の湯気に誘われて到着しました。',
    },
  },
  {
    id: 'arg_name_magneto',
    aliases: ['MAGNETO', 'MAGNET', '자석', 'じしゃく'],
    unlocks: '21-magnet',
    logId: 'LOG_MAGNETO',
    summary: {
      ko: '암호명 MAGNETO 확인 — 자석 덕이 상부 풀의 금속 수류를 감지하고 합류했습니다.',
      en: 'Callsign MAGNETO confirmed — Magnet Duck answered the copper aqueduct field.',
      ja: '暗号名 MAGNETO 確認 — マグネットダックが銅水路の磁場に応答しました。',
    },
  },
  {
    id: 'arg_name_quack00',
    aliases: ['QUACK-00', 'QUACK00', 'TSUKI', '달빛', 'つき'],
    unlocks: '22-snow-globe',
    logId: 'LOG_QUACK00',
    summary: {
      ko: '기밀 표본 QUACK-00 확인 — 스노글로브 덕이 유리 온실의 별빛 아래 강하했습니다.',
      en: 'Specimen QUACK-00 confirmed — Snow Globe Duck descended beneath the glass vault.',
      ja: '極秘標本 QUACK-00 確認 — スノードームダックがガラス温室に舞い降りました。',
    },
  },
]);

export const BOTTLE_CLUES = Object.freeze([
  {
    id: 'clue_freq_884',
    freq: '88.4',
    text: {
      ko: '병 속 메모 #01: 온천 라디오를 88.4 MHz에 맞추고, 오리 한 마리에게 KITSUNE라 이름 붙여 보세요.',
      en: 'Bottle Note #01: Tune the onsen radio to 88.4 MHz, or rename any duck KITSUNE.',
      ja: '瓶のメモ #01: 温泉ラジオを 88.4 MHz に合わせるか、アヒルに KITSUNE と名付けてみて。',
    },
  },
  {
    id: 'clue_freq_1042',
    freq: '104.2',
    text: {
      ko: '병 속 메모 #02: 104.2 MHz 반송파 수신 — 터미널에서 TUNE 104.2 또는 DECODE ONSEN-7 입력.',
      en: 'Bottle Note #02: Carrier detected at 104.2 MHz — try TUNE 104.2 or DECODE ONSEN-7.',
      ja: '瓶のメモ #02: 104.2 MHz に信号あり — TUNE 104.2 か DECODE ONSEN-7 を試して。',
    },
  },
  {
    id: 'clue_freq_777',
    freq: '77.7',
    text: {
      ko: '병 속 메모 #03: 77.7 MHz 등대 신호 — 캠프파이어 기타로 G-D-Em-C 를 연주해 보세요.',
      en: 'Bottle Note #03: 77.7 MHz lighthouse signal — strum G-D-Em-C on the campfire guitar!',
      ja: '瓶のメモ #03: 77.7 MHz 灯台信号 — 囲炉裏ギターで G-D-Em-C を奏でてみて。',
    },
  },
]);

export const TERMINAL_FREQUENCIES = Object.freeze({
  '88.4': {
    station: 'KYOTO HYDRO-ARCHIVE RELAY',
    unlocks: null,
    logId: 'FREQ_884',
    lines: {
      ko: [
        '[88.4 MHz LOCK] 교토 온천 수문 기록국 중계 수신...',
        '기록 #04: "수온 38.4°C 유지 중. 오리 이름을 KITSUNE로 기록하면 20번 개체가 응답한다."',
        '추가 복호화 명령: DECODE ONSEN-7',
      ],
      en: [
        '[88.4 MHz LOCK] Kyoto Hydro-Archive Relay acquired...',
        'Log #04: "Thermal basin steady at 38.4°C. Naming a duck KITSUNE summons Specimen #20."',
        'Next cipher command: DECODE ONSEN-7',
      ],
      ja: [
        '[88.4 MHz LOCK] 京都温泉水文記録局の中継を受信...',
        '記録 #04: 「水温38.4℃安定。アヒルを KITSUNE と名付けると20番個体が応答する。」',
        '復号コマンド: DECODE ONSEN-7',
      ],
    },
  },
  '104.2': {
    station: 'GLASS CONSERVATORY HARMONIC',
    unlocks: '23-mosaic',
    logId: 'FREQ_1042',
    lines: {
      ko: [
        '[104.2 MHz LOCK] 유리 온실 공명 대역 확보.',
        '숨겨진 타일 표본 #23 모자이크 덕을 상부 에메랄드 풀로 호출했습니다.',
      ],
      en: [
        '[104.2 MHz LOCK] Glass conservatory harmonic carrier locked.',
        'Summoned hidden tile specimen #23 Mosaic Duck into the Upper Emerald Pool.',
      ],
      ja: [
        '[104.2 MHz LOCK] ガラス温室の共鳴帯域を捕捉。',
        '隠し標本 #23 モザイクダックを上段エメラルドプールへ呼び出しました。',
      ],
    },
  },
  '77.7': {
    station: 'CLIFFSIDE LIGHTHOUSE BEACON',
    unlocks: '16-cloud',
    logId: 'FREQ_777',
    lines: {
      ko: [
        '[77.7 MHz LOCK] 해안 절벽 등대 비콘 수신 — 구름 덕(#16)이 해풍을 타고 착수했습니다.',
        '암호 단서: 오리 이름을 QUACK-00 또는 MAGNETO로 변경해 보세요.',
      ],
      en: [
        '[77.7 MHz LOCK] Coastal lighthouse beacon locked — Cloud Duck (#16) landed on the breeze.',
        'Cipher hint: Try renaming a duck QUACK-00 or MAGNETO.',
      ],
      ja: [
        '[77.7 MHz LOCK] 海岸灯台ビーコン受信 — くもダック(#16)が海風に乗って着水しました。',
        '暗号ヒント: アヒルの名前を QUACK-00 または MAGNETO に変えてみてください。',
      ],
    },
  },
});

const TERMINAL_CIPHERS = Object.freeze({
  'ONSEN-7': {
    unlocks: '18-ramen',
    logId: 'CIPHER_ONSEN7',
    reply: {
      ko: '[복호화 성공: ONSEN-7] 온천 야식 기록 해제 — 라멘 덕(#18)이 뜨거운 김을 내며 풀에 합류했습니다!',
      en: '[DECODED: ONSEN-7] Midnight kitchen archive opened — Ramen Duck (#18) steamed into the pool!',
      ja: '[復号成功: ONSEN-7] 温泉夜食記録を解放 — ラーメンダック(#18)が湯気を立てて合流しました！',
    },
  },
  'HYDRO-24': {
    unlocks: '14-terrarium',
    logId: 'CIPHER_HYDRO24',
    reply: {
      ko: '[복호화 성공: HYDRO-24] 온실 식물 표본 해제 — 테라리움 덕(#14)이 유리 돔 아래에 나타났습니다!',
      en: '[DECODED: HYDRO-24] Botanical dome file opened — Terrarium Duck (#14) surfaced in the pool!',
      ja: '[復号成功: HYDRO-24] 温室植物標本を解放 — テラリウムダック(#14)が水面へ現れました！',
    },
  },
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyGraphState() {
  return {
    version: 2,
    duckNames: {},
    duckHats: {},
    unlockedHats: [...STARTER_HATS],
    bottleClues: [],
    argLogs: [],
    argDucks: [],
    tunedFreq: '88.4',
    arrivalElapsed: 0,
    arrivalCount: 0,
    fishingCasts: 0,
    fishingCatches: 0,
    selectedBait: 'basic',
    baits: { yuzu: 2, smore: 1, ink: 1 }, // Cozy starter sample pouch so players feel crafting right away!
    caughtSpecies: {},     // { [speciesId]: { count, bestCm } }
    bestCatch: null,       // { speciesId, cm, rarity }
    shells: 10,            // Cozy Sea-Glass Shell currency
    guitarStrums: 0,
    harmoniesPlayed: [],   // song ids mastered
    focusSessionsCompleted: 0,
    edgesFired: {},
  };
}

function loadGraphState(store) {
  if (!store) return emptyGraphState();
  try {
    const raw = store.getItem(SANCTUARY_GRAPH_KEY);
    if (!raw) return emptyGraphState();
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return emptyGraphState();
    const base = emptyGraphState();
    if (parsed.duckNames && typeof parsed.duckNames === 'object') base.duckNames = { ...parsed.duckNames };
    if (parsed.duckHats && typeof parsed.duckHats === 'object') base.duckHats = { ...parsed.duckHats };
    if (Array.isArray(parsed.unlockedHats)) {
      base.unlockedHats = Array.from(new Set([...STARTER_HATS, ...parsed.unlockedHats.filter((h) => HATS.some((x) => x.id === h))]));
    }
    if (Array.isArray(parsed.bottleClues)) base.bottleClues = [...new Set(parsed.bottleClues)];
    if (Array.isArray(parsed.argLogs)) base.argLogs = [...new Set(parsed.argLogs)];
    if (Array.isArray(parsed.argDucks)) base.argDucks = [...new Set(parsed.argDucks)];
    if (typeof parsed.tunedFreq === 'string') base.tunedFreq = parsed.tunedFreq;
    if (Number.isFinite(parsed.arrivalElapsed)) base.arrivalElapsed = Math.max(0, parsed.arrivalElapsed);
    if (Number.isInteger(parsed.arrivalCount)) base.arrivalCount = Math.max(0, parsed.arrivalCount);
    if (Number.isInteger(parsed.fishingCasts)) base.fishingCasts = Math.max(0, parsed.fishingCasts);
    if (Number.isInteger(parsed.fishingCatches)) base.fishingCatches = Math.max(0, parsed.fishingCatches);
    if (FISHING_BAITS.some((b) => b.id === parsed.selectedBait)) base.selectedBait = parsed.selectedBait;
    if (parsed.baits && typeof parsed.baits === 'object') {
      for (const k of ['yuzu', 'smore', 'ink']) {
        if (Number.isInteger(parsed.baits[k])) base.baits[k] = Math.max(0, parsed.baits[k]);
      }
    }
    if (parsed.caughtSpecies && typeof parsed.caughtSpecies === 'object') base.caughtSpecies = { ...parsed.caughtSpecies };
    if (parsed.bestCatch && typeof parsed.bestCatch === 'object') base.bestCatch = { ...parsed.bestCatch };
    if (Number.isInteger(parsed.shells)) base.shells = Math.max(0, parsed.shells);
    if (Number.isInteger(parsed.guitarStrums)) base.guitarStrums = Math.max(0, parsed.guitarStrums);
    if (Array.isArray(parsed.harmoniesPlayed)) base.harmoniesPlayed = [...new Set(parsed.harmoniesPlayed)];
    if (Number.isInteger(parsed.focusSessionsCompleted)) base.focusSessionsCompleted = Math.max(0, parsed.focusSessionsCompleted);
    if (parsed.edgesFired && typeof parsed.edgesFired === 'object') base.edgesFired = { ...parsed.edgesFired };
    return base;
  } catch {
    return emptyGraphState();
  }
}

export function createSanctuaryGraph({ store = null, seed = 8842 } = {}) {
  const rng = mulberry32(seed);
  const state = loadGraphState(store);
  const recentChords = [];

  const fishing = {
    phase: 'idle', // 'idle' | 'waiting' | 'biting' | 'reeling'
    elapsed: 0,
    waitDuration: 3.4,
    biteWindow: 6.5,
    bobberSeed: 0,
    activeBait: 'basic',
    hookedSpecies: null,
    reelProgress: 0,
    reelTension: 0.25,
    reelTugPhase: 0,
  };

  const pomodoro = {
    running: false,
    durationSec: 25 * 60,
    remainingSec: 25 * 60,
  };

  function save() {
    if (!store) return;
    try {
      store.setItem(SANCTUARY_GRAPH_KEY, JSON.stringify(state));
    } catch { /* ignore storage quota / private mode */ }
  }

  function recordEdge(edgeName) {
    state.edgesFired[edgeName] = (state.edgesFired[edgeName] || 0) + 1;
    save();
    return state.edgesFired[edgeName];
  }

  function addShells(amount, edgeName = null) {
    const n = Math.max(0, Math.round(amount || 0));
    if (!n) return state.shells;
    state.shells += n;
    if (edgeName) recordEdge(edgeName);
    else save();
    return state.shells;
  }

  function addBait(baitId, amount = 1, edgeName = null) {
    if (!['yuzu', 'smore', 'ink'].includes(baitId)) return 0;
    state.baits[baitId] = (state.baits[baitId] || 0) + Math.max(1, Math.round(amount));
    if (edgeName) recordEdge(edgeName);
    else save();
    return state.baits[baitId];
  }

  function selectBait(baitId) {
    const spec = FISHING_BAITS.find((b) => b.id === baitId);
    if (!spec) return state.selectedBait;
    if (!spec.infinite && (state.baits[baitId] || 0) <= 0) {
      state.selectedBait = 'basic';
    } else {
      state.selectedBait = baitId;
    }
    save();
    return state.selectedBait;
  }

  function unlockHat(hatId) {
    if (!HATS.some((h) => h.id === hatId)) return false;
    if (state.unlockedHats.includes(hatId)) return false;
    state.unlockedHats.push(hatId);
    save();
    return true;
  }

  function unlockArgDuck(designId) {
    if (!designId || !DESIGNS.some((d) => d.id === designId)) return false;
    if (state.argDucks.includes(designId)) return false;
    state.argDucks.push(designId);
    save();
    return true;
  }

  function unlockArgLog(logId) {
    if (!logId || state.argLogs.includes(logId)) return false;
    state.argLogs.push(logId);
    save();
    return true;
  }

  // ---- 1. Duck Identity, Renaming & Secret Name ARG ----
  function getDuckName(duckId, fallbackName) {
    return state.duckNames[duckId] || fallbackName;
  }

  function renameDuck(duckId, rawName, lang = 'ko') {
    const cleaned = String(rawName || '').trim().slice(0, 24);
    if (!cleaned) return { ok: false, name: state.duckNames[duckId] || '', argUnlocked: null };
    state.duckNames[duckId] = cleaned;
    const upper = cleaned.toUpperCase();
    let argUnlocked = null;
    for (const trig of SECRET_NAME_TRIGGERS) {
      if (trig.aliases.some((a) => a.toUpperCase() === upper)) {
        const isNewLog = unlockArgLog(trig.logId);
        const isNewDuck = unlockArgDuck(trig.unlocks);
        recordEdge('rename->arg');
        recordEdge('arg->pool');
        argUnlocked = {
          id: trig.id,
          logId: trig.logId,
          unlocks: trig.unlocks,
          isNew: isNewLog || isNewDuck,
          message: trig.summary[lang] || trig.summary.en,
        };
        break;
      }
    }
    save();
    return { ok: true, name: cleaned, argUnlocked };
  }

  // ---- 2. Wearable 3D Hats ----
  function getDuckHat(duckId) {
    return state.duckHats[duckId] || 'none';
  }

  function equipHat(duckId, hatId) {
    const valid = state.unlockedHats.includes(hatId) ? hatId : 'none';
    state.duckHats[duckId] = valid;
    recordEdge('hats->pool');
    save();
    return valid;
  }

  function cycleDuckHat(duckId) {
    const cur = getDuckHat(duckId);
    const list = state.unlockedHats;
    const idx = list.indexOf(cur);
    const next = list[(idx + 1) % list.length] || 'none';
    return equipHat(duckId, next);
  }

  // ---- 3. Zeigarnik Passive Mystery Duck Arrival Loop ----
  function pickNextArrivalDesign(presentDesignIds = []) {
    const here = new Set(presentDesignIds);
    const missing = DESIGNS.filter((d) => !here.has(d.id));
    if (missing.length) {
      const idx = Math.floor(rng() * missing.length);
      return missing[idx];
    }
    const unexpected = DESIGNS.filter((d) => d.unexpected);
    return unexpected[state.arrivalCount % unexpected.length] || DESIGNS[0];
  }

  function triggerArrivalNow(presentDesignIds = []) {
    const design = pickNextArrivalDesign(presentDesignIds);
    state.arrivalElapsed = 0;
    state.arrivalCount += 1;
    unlockArgDuck(design.id);
    recordEdge('arrival->pool');
    save();
    return { arrived: design, arrivalCount: state.arrivalCount };
  }

  function tickArrival(dt, presentDesignIds = []) {
    if (!(dt > 0)) return { progress: state.arrivalElapsed / ARRIVAL_INTERVAL_SEC, arrived: null };
    state.arrivalElapsed += dt;
    if (state.arrivalElapsed >= ARRIVAL_INTERVAL_SEC) {
      const res = triggerArrivalNow(presentDesignIds);
      return { progress: 0, arrived: res.arrived, arrivalCount: res.arrivalCount };
    }
    return { progress: Math.min(1, state.arrivalElapsed / ARRIVAL_INTERVAL_SEC), arrived: null };
  }

  // ---- 4. WEBFISHING-Grade 4-Bait Tactile Reeling + 12-Species Fishing Loop ----
  function rollHookedSpecies(baitId) {
    const bait = FISHING_BAITS.find((b) => b.id === baitId) || FISHING_BAITS[0];
    const r = Math.min(0.999, rng() + bait.rarityBoost * 0.52);
    const tier = r > 0.90 ? 'mythic' : r > 0.68 ? 'rare' : r > 0.36 ? 'uncommon' : 'common';
    const pool = COASTAL_SPECIES.filter((s) => s.rarity === tier);
    return pool[Math.floor(rng() * pool.length)] || COASTAL_SPECIES[0];
  }

  function castLine(baitOverride = null) {
    if (fishing.phase !== 'idle') return { ok: false, phase: fishing.phase };
    const wantBait = baitOverride || state.selectedBait;
    const spec = FISHING_BAITS.find((b) => b.id === wantBait) || FISHING_BAITS[0];
    let usedBait = 'basic';
    if (spec.infinite) {
      usedBait = 'basic';
    } else if ((state.baits[spec.id] || 0) > 0) {
      usedBait = spec.id;
      state.baits[spec.id] -= 1;
      if (state.baits[spec.id] <= 0 && state.selectedBait === spec.id) state.selectedBait = 'basic';
    }
    fishing.activeBait = usedBait;
    fishing.phase = 'waiting';
    fishing.elapsed = 0;
    fishing.waitDuration = (usedBait === 'basic' ? 2.6 : 1.9) + rng() * 2.0;
    fishing.bobberSeed += 1;
    fishing.hookedSpecies = null;
    fishing.reelProgress = 0;
    fishing.reelTension = 0.25;
    fishing.reelTugPhase = 0;
    state.fishingCasts += 1;
    save();
    return { ok: true, phase: fishing.phase, bait: usedBait, waitDuration: fishing.waitDuration };
  }

  function cancelFishing() {
    fishing.phase = 'idle';
    fishing.elapsed = 0;
    fishing.hookedSpecies = null;
    fishing.reelProgress = 0;
    fishing.reelTension = 0.2;
  }

  function stepFishing(dt) {
    if (fishing.phase === 'idle' || !(dt > 0)) return { phase: fishing.phase, event: null };
    fishing.elapsed += dt;
    if (fishing.phase === 'waiting' && fishing.elapsed >= fishing.waitDuration) {
      fishing.phase = 'biting';
      fishing.elapsed = 0;
      fishing.hookedSpecies = rollHookedSpecies(fishing.activeBait);
      fishing.reelProgress = 0.14;
      fishing.reelTension = 0.45;
      return { phase: 'biting', event: 'bite', species: fishing.hookedSpecies };
    }
    if (fishing.phase === 'biting' && fishing.elapsed >= fishing.biteWindow) {
      // Zero-stress: line gently drifts back to waiting instead of punishing failure!
      fishing.phase = 'waiting';
      fishing.elapsed = 0;
      fishing.waitDuration = 2.2 + rng() * 1.8;
      return { phase: 'waiting', event: 'escaped_gently' };
    }
    if (fishing.phase === 'reeling') {
      const rarityFactor = fishing.hookedSpecies?.rarity === 'mythic' ? 1.45
        : fishing.hookedSpecies?.rarity === 'rare' ? 1.25 : 1.0;
      fishing.reelTugPhase += dt * (3.6 * rarityFactor);
      const tug = 0.5 + 0.5 * Math.sin(fishing.reelTugPhase);
      // Zero-stress tension wave: fish gently pulls back slightly, never snaps the line!
      fishing.reelTension = +(0.30 + 0.58 * tug).toFixed(3);
      fishing.reelProgress = Math.max(0.08, fishing.reelProgress - dt * 0.08 * rarityFactor);
    }
    return { phase: fishing.phase, event: null };
  }

  function finalizeCatch({ logbook = null, lang = 'ko', simTime = null } = {}) {
    const baitUsed = fishing.activeBait || 'basic';
    const sp = fishing.hookedSpecies || rollHookedSpecies(baitUsed);
    cancelFishing();
    state.fishingCatches += 1;

    const cm = +(sp.minCm + rng() * (sp.maxCm - sp.minCm)).toFixed(1);
    const kg = +(Math.pow(cm / 32, 2.35) * 0.65).toFixed(2);
    const prevRec = state.caughtSpecies[sp.id];
    const isNewSpecies = !prevRec;
    const isNewRecord = !prevRec || cm > prevRec.bestCm;
    state.caughtSpecies[sp.id] = {
      count: (prevRec?.count || 0) + 1,
      bestCm: Math.max(prevRec?.bestCm || 0, cm),
    };
    if (!state.bestCatch || cm > state.bestCatch.cm) {
      state.bestCatch = { speciesId: sp.id, cm, kg, rarity: sp.rarity };
    }
    addShells(sp.shells, 'fishing->shells');
    recordEdge('fishing->records');

    const catchInfo = {
      speciesId: sp.id,
      name: sp.name[lang] || sp.name.en,
      rarity: sp.rarity,
      cm,
      kg,
      shells: sp.shells,
      colorHex: sp.colorHex,
      isNewSpecies,
      isNewRecord,
      baitUsed,
    };

    // Graph-connected bonus treasure alongside the coastal species catch!
    const foundPages = new Set((logbook?.pages || []).filter((p) => p.found).map((p) => p.id));
    const missingCollectibles = COLLECTIBLES.filter((c) => !foundPages.has(c.id));
    const missingHats = LOCKED_HATS.filter((h) => !state.unlockedHats.includes(h));
    const missingClues = BOTTLE_CLUES.filter((c) => !state.bottleClues.includes(c.id));

    const catchNum = state.fishingCatches;
    let reward = null;

    if (missingCollectibles.length && (catchNum % 3 === 1 || (!missingHats.length && !missingClues.length))) {
      const item = missingCollectibles[0];
      if (logbook?.observe) {
        const obsTime = Number.isFinite(simTime) && simTime > 0 ? simTime : catchNum * 5;
        logbook.observe({ time: obsTime, day: { hour: 18 }, ducks: [] }, [{ type: 'collected', ids: [item.id] }]);
        logbook.flush?.();
      }
      recordEdge('fishing->book');
      reward = {
        kind: 'collectible',
        id: item.id,
        title: item.title,
        description: item.description,
      };
    } else if (missingClues.length && (catchNum % 3 === 2 || !missingHats.length)) {
      const clue = missingClues[0];
      state.bottleClues.push(clue.id);
      recordEdge('fishing->terminal');
      reward = {
        kind: 'bottle_clue',
        id: clue.id,
        freq: clue.freq,
        text: clue.text[lang] || clue.text.en,
      };
    } else if (missingHats.length) {
      const hatId = missingHats[0];
      unlockHat(hatId);
      const hatMeta = HATS.find((h) => h.id === hatId);
      recordEdge('fishing->hats');
      reward = {
        kind: 'hat',
        id: hatId,
        label: hatMeta?.label || hatId,
      };
    } else {
      const clue = BOTTLE_CLUES[(catchNum - 1) % BOTTLE_CLUES.length];
      recordEdge('fishing->book');
      reward = {
        kind: 'sea_glass',
        id: `glass-${catchNum}`,
        text: clue.text[lang] || clue.text.en,
      };
    }

    save();
    return { caught: true, catches: state.fishingCatches, catchInfo, reward };
  }

  function reelLine({ logbook = null, lang = 'ko', forceCatch = false, pump = 0.36, simTime = null } = {}) {
    if (forceCatch) {
      return finalizeCatch({ logbook, lang, simTime });
    }
    if (fishing.phase === 'biting') {
      fishing.phase = 'reeling';
      fishing.reelProgress = Math.min(1, fishing.reelProgress + pump);
      fishing.reelTension = 0.72;
      if (fishing.reelProgress >= 1) return finalizeCatch({ logbook, lang, simTime });
      return { caught: false, phase: 'reeling', progress: +fishing.reelProgress.toFixed(3), tension: fishing.reelTension, reward: null };
    }
    if (fishing.phase === 'reeling') {
      fishing.reelProgress = Math.min(1, fishing.reelProgress + pump);
      fishing.reelTension = Math.min(0.96, fishing.reelTension + 0.14);
      if (fishing.reelProgress >= 1) return finalizeCatch({ logbook, lang, simTime });
      return { caught: false, phase: 'reeling', progress: +fishing.reelProgress.toFixed(3), tension: fishing.reelTension, reward: null };
    }
    const prev = fishing.phase;
    cancelFishing();
    return { caught: false, reason: prev === 'waiting' ? 'early' : 'idle', reward: null };
  }

  // ---- 5. Onsen 1960s Radio / Hydro-Archive Terminal ----
  function runTerminalCommand(rawInput, { lang = 'ko', stats = {} } = {}) {
    const trimmed = String(rawInput || '').trim();
    const upper = trimmed.toUpperCase();
    const parts = upper.split(/\s+/);
    const cmd = parts[0] || '';
    const arg = parts.slice(1).join(' ');

    if (!cmd || cmd === 'HELP' || cmd === '?') {
      return {
        ok: true,
        unlockedDuck: null,
        lines: lang === 'ko'
          ? [
              'HYDRO-ARCHIVE TERMINAL v2.0 — 사용 가능 명령:',
              '  STATUS        · 성소 수온/오리/조개/충돌/어획 기록 조회',
              '  SCAN          · 1960s AM/FM 숨겨진 주파수 스캔',
              '  TUNE <MHz>    · 주파수 동조 (예: TUNE 88.4 / 104.2 / 77.7)',
              '  DECODE <CODE> · 암호 해독 (예: DECODE ONSEN-7 / HYDRO-24)',
              '  WEATHER <M>   · 성소 날씨 전환 (CLEAR / PETALS / MIST / RAIN)',
              '  YUZU          · 상부 온천 풀에 향긋한 유자 띄우기',
              '  CLUES         · 낚시로 건진 병 속 암호 메모 열람',
            ]
          : lang === 'ja'
            ? [
                'HYDRO-ARCHIVE TERMINAL v2.0 — コマンド一覧:',
                '  STATUS        · サンクチュアリ計測・貝殻・釣果を表示',
                '  SCAN          · 隠しFM周波数をスキャン',
                '  TUNE <MHz>    · 周波数チューニング (88.4 / 104.2 / 77.7)',
                '  DECODE <CODE> · 暗号を復号 (ONSEN-7 / HYDRO-24)',
                '  WEATHER <M>   · 天気を切り替え (CLEAR / PETALS / MIST / RAIN)',
                '  YUZU          · 香り豊かな柚子をプールに浮かべる',
                '  CLUES         · 釣り上げた瓶のメモを表示',
              ]
            : [
                'HYDRO-ARCHIVE TERMINAL v2.0 — COMMANDS:',
                '  STATUS        · View live sanctuary telemetry, shells & records',
                '  SCAN          · Sweep FM band for anomalous carriers',
                '  TUNE <MHz>    · Tune radio frequency (88.4 / 104.2 / 77.7)',
                '  DECODE <CODE> · Decrypt archive code (ONSEN-7 / HYDRO-24)',
                '  WEATHER <M>   · Set sanctuary weather (CLEAR / PETALS / MIST / RAIN)',
                '  YUZU          · Toss a fragrant Yuzu citrus into the pool',
                '  CLUES         · Read fished message-in-a-bottle clues',
              ],
      };
    }

    if (cmd === 'STATUS') {
      const pct = Math.round((state.arrivalElapsed / ARRIVAL_INTERVAL_SEC) * 100);
      const best = state.bestCatch ? `${state.bestCatch.speciesId} (${state.bestCatch.cm}cm)` : 'NONE';
      return {
        ok: true,
        unlockedDuck: null,
        lines: [
          `BASIN TEMP : 38.4°C  |  TUNED : ${state.tunedFreq} MHz  |  SHELLS : ${state.shells}`,
          `DUCKS : ${stats.duckCount ?? 0}  |  COLLISIONS : ${stats.collisions ?? 0}  |  NEXT DROP : ${pct}%`,
          `CATCHES : ${state.fishingCatches} (BEST: ${best})  |  HARMONIES : ${state.harmoniesPlayed.length}/${HARMONY_SONGS.length}`,
        ],
      };
    }

    if (cmd === 'SCAN') {
      return {
        ok: true,
        unlockedDuck: null,
        lines: [
          'SWEEP 76.0 .. 108.0 MHz COMPLETE:',
          '  ● 77.7 MHz  [STRONG]  CLIFFSIDE LIGHTHOUSE BEACON',
          '  ● 88.4 MHz  [STRONG]  KYOTO HYDRO-ARCHIVE RELAY',
          '  ● 104.2 MHz [PULSE]   GLASS CONSERVATORY HARMONIC',
        ],
      };
    }

    if (cmd === 'CLUES') {
      if (!state.bottleClues.length) {
        return {
          ok: true,
          unlockedDuck: null,
          lines: [
            lang === 'ko'
              ? '아직 낚시로 건진 병 속 메모가 없습니다. 남측 해안 부두에서 낚싯대를 던져 보세요.'
              : lang === 'ja'
                ? 'まだ瓶のメモがありません。南側の海辺の桟橋から釣り糸を垂らしてみてください。'
                : 'No bottle notes yet. Cast your line off the coastal timber pier to fish one up.',
          ],
        };
      }
      const lines = state.bottleClues.map((cid) => {
        const c = BOTTLE_CLUES.find((x) => x.id === cid);
        return c ? `• ${c.text[lang] || c.text.en}` : `• ${cid}`;
      });
      return { ok: true, unlockedDuck: null, lines };
    }

    if (cmd === 'WEATHER' || cmd === 'WX') {
      const wMap = { CLEAR: 'clear', PETALS: 'petals', MIST: 'mist', RAIN: 'rain' };
      const targetW = wMap[arg];
      if (!targetW) {
        return { ok: false, unlockedDuck: null, lines: ['[ERR] Usage: WEATHER CLEAR | PETALS | MIST | RAIN'] };
      }
      recordEdge('terminal->weather');
      return {
        ok: true,
        unlockedDuck: null,
        weatherCmd: targetW,
        lines: [`[ATMOS OVERRIDE] Sanctuary conservatory weather set to ${targetW.toUpperCase()}.`],
      };
    }

    if (cmd === 'YUZU') {
      recordEdge('terminal->pool');
      return {
        ok: true,
        unlockedDuck: null,
        dropYuzu: true,
        lines: [
          lang === 'ko'
            ? '[YUZU DISPENSE] 상부 에메랄드 풀에 향긋한 유자를 띄웠습니다 — 오리들이 모여듭니다.'
            : lang === 'ja'
              ? '[YUZU DISPENSE] 上段プールに柚子を浮かべました — アヒルたちが集まってきます。'
              : '[YUZU DISPENSE] Tossed a fragrant Yuzu into the Upper Emerald Pool — ducks are gathering!',
        ],
      };
    }

    if (cmd === 'TUNE' || cmd === 'FREQ') {
      const freq = arg.replace(/[^0-9.]/g, '');
      const station = TERMINAL_FREQUENCIES[freq];
      if (!station) {
        return {
          ok: false,
          unlockedDuck: null,
          lines: [`[${freq || '???'} MHz] ...static... (try SCAN to find live carriers)`],
        };
      }
      state.tunedFreq = freq;
      unlockArgLog(station.logId);
      let unlockedDuck = null;
      if (station.unlocks) {
        unlockArgDuck(station.unlocks);
        unlockedDuck = station.unlocks;
        recordEdge('terminal->pool');
      }
      recordEdge('terminal->arg');
      save();
      return {
        ok: true,
        freq,
        unlockedDuck,
        lines: station.lines[lang] || station.lines.en,
      };
    }

    if (cmd === 'DECODE' || cmd === 'CODE') {
      const code = arg.replace(/\s+/g, '-');
      const cipher = TERMINAL_CIPHERS[code];
      if (cipher) {
        unlockArgLog(cipher.logId);
        unlockArgDuck(cipher.unlocks);
        recordEdge('terminal->arg');
        recordEdge('terminal->pool');
        save();
        return {
          ok: true,
          unlockedDuck: cipher.unlocks,
          lines: [cipher.reply[lang] || cipher.reply.en],
        };
      }
      const nameMatch = SECRET_NAME_TRIGGERS.find((t) => t.aliases.some((a) => a.toUpperCase() === code));
      if (nameMatch) {
        unlockArgLog(nameMatch.logId);
        unlockArgDuck(nameMatch.unlocks);
        recordEdge('terminal->arg');
        recordEdge('terminal->pool');
        save();
        return {
          ok: true,
          unlockedDuck: nameMatch.unlocks,
          lines: [nameMatch.summary[lang] || nameMatch.summary.en],
        };
      }
      return {
        ok: false,
        unlockedDuck: null,
        lines: [`[ERR] Unknown cipher '${code || ''}'. Try TUNE 88.4 or CLUES.`],
      };
    }

    if (TERMINAL_FREQUENCIES[upper]) return runTerminalCommand(`TUNE ${upper}`, { lang, stats });
    if (TERMINAL_CIPHERS[upper] || SECRET_NAME_TRIGGERS.some((t) => t.aliases.some((a) => a.toUpperCase() === upper))) {
      return runTerminalCommand(`DECODE ${upper}`, { lang, stats });
    }

    return {
      ok: false,
      unlockedDuck: null,
      lines: [`Unknown command '${trimmed}'. Type HELP or SCAN.`],
    };
  }

  // ---- 6. Campfire Guitar & 4-Chord Harmonic Progression Recognizer ----
  function recordGuitarStrum(chordIdx = 0, lang = 'ko') {
    const chord = GUITAR_CHORDS[((chordIdx % GUITAR_CHORDS.length) + GUITAR_CHORDS.length) % GUITAR_CHORDS.length];
    state.guitarStrums += 1;
    recordEdge('guitar->pool');

    recentChords.push(chord.id);
    if (recentChords.length > 4) recentChords.shift();

    let harmony = null;
    if (recentChords.length === 4) {
      const matched = HARMONY_SONGS.find((song) => song.seq.every((c, idx) => recentChords[idx] === c));
      if (matched) {
        recentChords.length = 0;
        const isFirst = !state.harmoniesPlayed.includes(matched.id);
        if (isFirst) state.harmoniesPlayed.push(matched.id);
        if (matched.unlocksDuck) unlockArgDuck(matched.unlocksDuck);
        if (matched.rewardShells) addShells(matched.rewardShells, 'guitar->harmony');
        if (matched.rewardBait) addBait(matched.rewardBait.id, matched.rewardBait.count, 'harmony->fishing');
        recordEdge('harmony->pool');
        harmony = {
          id: matched.id,
          title: matched.title[lang] || matched.title.en,
          isFirst,
          unlocksDuck: matched.unlocksDuck,
          rewardShells: matched.rewardShells,
        };
      }
    }
    save();
    return { chord, totalStrums: state.guitarStrums, recentChords: [...recentChords], harmony };
  }

  // ---- 7. Cozy Sea-Glass Shell Shop (Zero-Grind Cross-Loop Rewards) ----
  function buyShellItem(itemId, presentDesignIds = []) {
    const item = SHELL_SHOP_ITEMS.find((x) => x.id === itemId);
    if (!item || state.shells < item.cost) return { ok: false, reason: 'insufficient_shells', shells: state.shells };
    state.shells -= item.cost;
    if (item.kind === 'bait') {
      addBait(item.baitId, item.amount, 'shells->fishing');
      return { ok: true, item, shells: state.shells, baitCount: state.baits[item.baitId] };
    }
    if (item.kind === 'hat') {
      const nextHat = LOCKED_HATS.find((h) => !state.unlockedHats.includes(h));
      if (!nextHat) {
        state.shells += item.cost;
        return { ok: false, reason: 'all_hats_unlocked', shells: state.shells };
      }
      unlockHat(nextHat);
      recordEdge('shells->hats');
      const meta = HATS.find((h) => h.id === nextHat);
      return { ok: true, item, shells: state.shells, hatId: nextHat, hatLabel: meta?.label || nextHat };
    }
    if (item.kind === 'arrival') {
      const res = triggerArrivalNow(presentDesignIds);
      recordEdge('shells->pool');
      return { ok: true, item, shells: state.shells, arrived: res.arrived };
    }
    save();
    return { ok: true, item, shells: state.shells };
  }

  // ---- 8. Spirit City Desk Companion Focus Pomodoro Timer ----
  function startFocusTimer(minutes = 25) {
    const secs = Math.max(60, Math.round(minutes) * 60);
    pomodoro.durationSec = secs;
    pomodoro.remainingSec = secs;
    pomodoro.running = true;
    return { ...pomodoro };
  }

  function toggleFocusTimer(minutes = 25) {
    if (pomodoro.running) {
      pomodoro.running = false;
      return { ...pomodoro };
    }
    if (pomodoro.remainingSec <= 0 || pomodoro.remainingSec === pomodoro.durationSec) {
      return startFocusTimer(minutes);
    }
    pomodoro.running = true;
    return { ...pomodoro };
  }

  function completeFocusSession(presentDesignIds = []) {
    pomodoro.running = false;
    pomodoro.remainingSec = pomodoro.durationSec;
    state.focusSessionsCompleted += 1;
    addShells(25, 'pomodoro->shells');
    const arr = triggerArrivalNow(presentDesignIds);
    recordEdge('pomodoro->arrival');
    save();
    return {
      completed: true,
      sessions: state.focusSessionsCompleted,
      shellsAwarded: 25,
      arrived: arr.arrived,
    };
  }

  function tickFocusTimer(dt, presentDesignIds = []) {
    if (!pomodoro.running || !(dt > 0)) return { completed: false, remainingSec: pomodoro.remainingSec };
    pomodoro.remainingSec = Math.max(0, pomodoro.remainingSec - dt);
    if (pomodoro.remainingSec <= 0) {
      return completeFocusSession(presentDesignIds);
    }
    return { completed: false, remainingSec: pomodoro.remainingSec };
  }

  function getState() {
    return {
      duckNames: { ...state.duckNames },
      duckHats: { ...state.duckHats },
      unlockedHats: [...state.unlockedHats],
      bottleClues: [...state.bottleClues],
      argLogs: [...state.argLogs],
      argDucks: [...state.argDucks],
      tunedFreq: state.tunedFreq,
      arrivalProgress: +(Math.min(1, state.arrivalElapsed / ARRIVAL_INTERVAL_SEC)).toFixed(3),
      arrivalCount: state.arrivalCount,
      shells: state.shells,
      selectedBait: state.selectedBait,
      baits: { ...state.baits },
      speciesCount: Object.keys(state.caughtSpecies).length,
      totalSpecies: COASTAL_SPECIES.length,
      bestCatch: state.bestCatch ? { ...state.bestCatch } : null,
      fishing: {
        phase: fishing.phase,
        elapsed: +fishing.elapsed.toFixed(2),
        casts: state.fishingCasts,
        catches: state.fishingCatches,
        activeBait: fishing.activeBait,
        reelProgress: +fishing.reelProgress.toFixed(3),
        reelTension: +fishing.reelTension.toFixed(3),
        hookedRarity: fishing.hookedSpecies?.rarity || null,
      },
      guitarStrums: state.guitarStrums,
      recentChords: [...recentChords],
      harmoniesPlayed: [...state.harmoniesPlayed],
      pomodoro: {
        running: pomodoro.running,
        durationSec: pomodoro.durationSec,
        remainingSec: Math.ceil(pomodoro.remainingSec),
        completed: state.focusSessionsCompleted,
      },
      edgesFired: { ...state.edgesFired },
      activeEdgeCount: Object.keys(state.edgesFired).length,
    };
  }

  return {
    getDuckName,
    renameDuck,
    getDuckHat,
    unlockHat,
    equipHat,
    cycleDuckHat,
    tickArrival,
    triggerArrivalNow,
    addShells,
    addBait,
    selectBait,
    castLine,
    cancelFishing,
    stepFishing,
    reelLine,
    runTerminalCommand,
    recordGuitarStrum,
    buyShellItem,
    startFocusTimer,
    toggleFocusTimer,
    tickFocusTimer,
    completeFocusSession,
    recordEdge,
    getState,
  };
}
