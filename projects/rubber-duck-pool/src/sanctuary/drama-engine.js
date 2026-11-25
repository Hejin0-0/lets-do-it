// Deterministic Emergent Duck Social Drama & Diegetic Field Request Engine.
// Tracks duck-pair friendships ("Pool Pals"), slide rivalries, Yuzu gatherings,
// and 6 zero-stress Sanctuary Field Requests pinned to the 3D Field-Log Book Post-It.
// Pure deterministic state (zero Math.random / Date.now for seeded-sim compliance).

export const DRAMA_STORAGE_KEY = 'rubber-duck-pool.drama.v1';
export const PAL_BOND_THRESHOLD = 3;

export const FIELD_REQUESTS = Object.freeze([
  {
    id: 'req_yuzu_party',
    rewardShells: 10,
    rewardBait: { id: 'yuzu', count: 2 },
    title: {
      ko: '상부 풀에 온천 유자 띄우기 (Y)',
      en: 'Toss a fragrant Yuzu into the pool (Y)',
      ja: '上段プールに柚子を浮かべる (Y)',
    },
  },
  {
    id: 'req_duck_style',
    rewardShells: 12,
    rewardBait: null,
    title: {
      ko: '오리 이름 변경 & 3D 모자 씌우기',
      en: 'Rename a duck & equip a 3D hat',
      ja: 'アヒルに名前をつけて3D帽子を被せる',
    },
  },
  {
    id: 'req_bait_catch',
    rewardShells: 15,
    rewardBait: { id: 'smore', count: 1 },
    title: {
      ko: '특수 미끼로 해안 부두에서 낚시 성공',
      en: 'Land a coastal pier catch with crafted bait',
      ja: '特製エサで海辺の桟橋から釣り上げる',
    },
  },
  {
    id: 'req_harmony_song',
    rewardShells: 18,
    rewardBait: { id: 'ink', count: 1 },
    title: {
      ko: '모닥불 기타 4코드 하모니 연주 (G-D-Em-C)',
      en: 'Play a 4-chord campfire harmony (G-D-Em-C)',
      ja: '囲炉裏ギターで4コード和音を奏でる (G-D-Em-C)',
    },
  },
  {
    id: 'req_terminal_decode',
    rewardShells: 15,
    rewardBait: null,
    title: {
      ko: '1968 온천 터미널 주파수 동조/복호화',
      en: 'Tune or decode a signal in the 1968 Terminal',
      ja: '1968年温泉端末で周波数を同調・復号する',
    },
  },
  {
    id: 'req_pool_pals',
    rewardShells: 12,
    rewardBait: { id: 'yuzu', count: 1 },
    title: {
      ko: '물리 충돌로 단짝 오리(Pool Pals) 탄생 목격',
      en: 'Witness two ducks bond as Pool Pals',
      ja: '物理衝突で仲良しペアの誕生を見届ける',
    },
  },
]);

function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function emptyState() {
  return {
    version: 1,
    pairBumps: {},     // { 'idA::idB': number }
    poolPals: [],      // [{ key, a, b, nameA, nameB }]
    rivals: [],        // [{ passer, passed, count }]
    yuzuDrops: 0,
    completedRequests: [],
    stats: {
      overtakes: 0,
      renamed: false,
      hatEquipped: false,
      craftedBaitCatch: false,
      harmonyPlayed: false,
      terminalDecoded: false,
    },
  };
}

function loadState(store) {
  if (!store) return emptyState();
  try {
    const raw = store.getItem(DRAMA_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw);
    if (!p || p.version !== 1) return emptyState();
    const base = emptyState();
    if (p.pairBumps && typeof p.pairBumps === 'object') base.pairBumps = { ...p.pairBumps };
    if (Array.isArray(p.poolPals)) base.poolPals = p.poolPals.slice(0, 24);
    if (Array.isArray(p.rivals)) base.rivals = p.rivals.slice(0, 16);
    if (Number.isInteger(p.yuzuDrops)) base.yuzuDrops = Math.max(0, p.yuzuDrops);
    if (Array.isArray(p.completedRequests)) base.completedRequests = [...new Set(p.completedRequests)];
    if (p.stats && typeof p.stats === 'object') Object.assign(base.stats, p.stats);
    return base;
  } catch {
    return emptyState();
  }
}

export function createDramaEngine({ store = null } = {}) {
  const state = loadState(store);

  function save() {
    if (!store) return;
    try {
      store.setItem(DRAMA_STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore storage restrictions */ }
  }

  function evaluateRequests() {
    const conds = {
      req_yuzu_party: state.yuzuDrops >= 1,
      req_duck_style: Boolean(state.stats.renamed && state.stats.hatEquipped),
      req_bait_catch: Boolean(state.stats.craftedBaitCatch),
      req_harmony_song: Boolean(state.stats.harmonyPlayed),
      req_terminal_decode: Boolean(state.stats.terminalDecoded),
      req_pool_pals: state.poolPals.length >= 1,
    };
    const newlyCompleted = [];
    for (const req of FIELD_REQUESTS) {
      if (conds[req.id] && !state.completedRequests.includes(req.id)) {
        state.completedRequests.push(req.id);
        newlyCompleted.push(req);
      }
    }
    if (newlyCompleted.length) save();
    return newlyCompleted;
  }

  function recordCollision(idA, idB, nameA = idA, nameB = idB) {
    if (!idA || !idB || idA === idB) return { newPal: null, completed: [] };
    const k = pairKey(idA, idB);
    const next = (state.pairBumps[k] || 0) + 1;
    state.pairBumps[k] = next;
    let newPal = null;
    if (next === PAL_BOND_THRESHOLD && !state.poolPals.some((p) => p.key === k)) {
      newPal = { key: k, a: idA, b: idB, nameA, nameB };
      state.poolPals.push(newPal);
      if (state.poolPals.length > 24) state.poolPals.shift();
    }
    const completed = evaluateRequests();
    if (newPal || completed.length) save();
    return { newPal, bumps: next, completed };
  }

  function recordOvertake(passerId, passedId) {
    state.stats.overtakes += 1;
    const hit = state.rivals.find((r) => r.passer === passerId && r.passed === passedId);
    if (hit) hit.count += 1;
    else state.rivals.push({ passer: passerId, passed: passedId, count: 1 });
    if (state.rivals.length > 16) state.rivals.shift();
    save();
    return { overtakes: state.stats.overtakes };
  }

  function recordAction(kind) {
    if (kind === 'yuzu') state.yuzuDrops += 1;
    else if (kind === 'rename') state.stats.renamed = true;
    else if (kind === 'hat') state.stats.hatEquipped = true;
    else if (kind === 'crafted_bait_catch') state.stats.craftedBaitCatch = true;
    else if (kind === 'harmony') state.stats.harmonyPlayed = true;
    else if (kind === 'terminal') state.stats.terminalDecoded = true;
    const completed = evaluateRequests();
    save();
    return { completed };
  }

  function getPartnerForDuck(duckId) {
    const pal = state.poolPals.find((p) => p.a === duckId || p.b === duckId);
    if (!pal) return null;
    return pal.a === duckId ? pal.nameB : pal.nameA;
  }

  function getActiveRequests(lang = 'ko', limit = 3) {
    const pending = FIELD_REQUESTS.filter((r) => !state.completedRequests.includes(r.id));
    return pending.slice(0, limit).map((r) => ({
      id: r.id,
      done: false,
      rewardShells: r.rewardShells,
      title: r.title[lang] || r.title.en,
    }));
  }

  function getAllRequests(lang = 'ko') {
    return FIELD_REQUESTS.map((r) => ({
      id: r.id,
      done: state.completedRequests.includes(r.id),
      rewardShells: r.rewardShells,
      title: r.title[lang] || r.title.en,
    }));
  }

  function getState() {
    return {
      poolPals: state.poolPals.slice(),
      palCount: state.poolPals.length,
      overtakes: state.stats.overtakes,
      yuzuDrops: state.yuzuDrops,
      completedRequests: state.completedRequests.slice(),
      totalRequests: FIELD_REQUESTS.length,
    };
  }

  return {
    recordCollision,
    recordOvertake,
    recordAction,
    getPartnerForDuck,
    getActiveRequests,
    getAllRequests,
    getState,
  };
}
