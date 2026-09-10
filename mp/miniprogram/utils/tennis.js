/**
 * 网球计分引擎 —— 纯函数，无副作用，可单测。
 * 双打的发球轮转与抢七换发按 ITF 规则实现。
 *
 * 设计依据见 design/design-system-v2.html「排版规则」与 api/types.ts 的 MatchScore。
 */

const POINT_LABELS = ['0', '15', '30', '40'];

/**
 * 比赛格式是一个**结构化配置**，不是一个写死的枚举。
 *
 * 五个维度彼此独立，展开有十几种组合 —— 业余赛的格式因场地、天气、
 * 报名人数天天在变，任何固定清单都会漏掉别人正在用的那一种。
 * 这份代码已经因此错过两次：先漏了金球，再漏了决胜盘抢十。
 *
 * 字段按**盘 → 局 → 分**从大到小排，跟人说赛制的顺序一致：
 *
 * | | 维度 | 字段 |
 * |---|---|---|
 * | 盘 | **先赢**几盘算赢（不是总共打几盘） | `setsToWin` |
 * | 盘 | 决胜盘抢到几分 | `decidingTiebreakTo` —— 必填，**0 = 打满一盘** |
 * | 局 | 一盘打几局 | `gamesToWin` —— 常见 6 / 8 / 4 |
 * | 局 | 几平进抢七 | `tiebreakAt` —— **0 = 一开局就进，整场就是一个抢七/抢十** |
 * | 分 | 抢七到几分 | `tiebreakTo` —— 默认：**4 局抢五；6 局、8 局都抢七** |
 * | 分 | 平分怎么办 | `noAd` —— true = 金球，不打占先 |
 *
 * 契约见 `api/types.ts` 的 `MatchFormat`。
 */

/**
 * 常用预设。**只是建赛表单的快捷方式**，主办方可以在此基础上改任意一项。
 * 字段按**盘 → 局 → 分**从大到小排，跟人说赛制的顺序一致。
 */
/**
 * `tiebreakAt` 和 `tiebreakTo` **不写** —— resolveFormat 会推：
 * 几平进抢七默认等于局数，抢几分按 4 局及以下抢五、其余抢七。
 * 只有 tb10 那种非常规组合才需要显式写出来。
 */
const PRESETS = {
  //              ── 盘 ──────────────────────  ── 局 ────────  ── 分 ──
  // 两盘 + 决胜抢十 —— 业余双打最主流：省时间、场地周转快
  sets2_st10_gp: { setsToWin: 2, decidingTiebreakTo: 10, gamesToWin: 6, noAd: true  },
  sets3_gp:      { setsToWin: 2, decidingTiebreakTo: 0,  gamesToWin: 6, noAd: true  },
  sets3_ad:      { setsToWin: 2, decidingTiebreakTo: 0,  gamesToWin: 6, noAd: false },
  // 4 局制推出来的是 4-4 进、抢五
  short4_gp:     { setsToWin: 2, decidingTiebreakTo: 10, gamesToWin: 4, noAd: true  },
  set1_gp:       { setsToWin: 1, decidingTiebreakTo: 0,  gamesToWin: 6, noAd: true  },
  // 八局制（pro set）：单盘打到 8 局，推出来是 8-8 抢七。国内业余双打常用
  // —— 六局有时嫌短、三盘两胜又太长，八局定胜负正好卡在中间
  proset8_gp:    { setsToWin: 1, decidingTiebreakTo: 0,  gamesToWin: 8, noAd: true  },
  // 整场一个抢十：0 平就进抢七，也就是一开局就进；抢到 10 分赢下这 1 局，
  // 也就赢下这一盘。这两项推不出来，必须写
  tb10:          { setsToWin: 1, decidingTiebreakTo: 0,  gamesToWin: 1, noAd: true, tiebreakAt: 0, tiebreakTo: 10 },
};

const DEFAULT_FORMAT = PRESETS.sets2_st10_gp;

/** 预设名或配置对象 → 配置对象。存进 match 的是**解析后的对象**，见 createMatch */
function resolveFormat(f) {
  // 预设、配置对象、不传 —— 三条入口**走同一段归一化**。
  // 曾经预设走的是 Object.assign({}, PRESETS[f]) 直接返回，绕过了默认
  // 推导；预设里一旦省掉 tiebreakAt / tiebreakTo 就会推出 undefined。
  const raw = !f ? DEFAULT_FORMAT : (typeof f === 'string' ? PRESETS[f] : f);
  if (!raw) throw new Error('未知赛制预设: ' + f);
  if (typeof raw.gamesToWin !== 'number' || typeof raw.setsToWin !== 'number') {
    throw new Error('赛制配置缺字段: 需要 gamesToWin 与 setsToWin');
  }
  if (raw.gamesToWin < 1) throw new Error('gamesToWin 至少是 1；「整场一个抢十」用 tiebreakAt: 0 表达');

  // 几平进抢七默认等于局数（6-6 进、8-8 进、4-4 进）。
  // 抢几分按**实际规则**推，不是「局数 + 1」—— 那个只在 4 和 6 上碰巧
  // 成立：抢七是 7 分因为标准抢七就是 7 分，跟局数无关；只有 4 局制
  // （FAST4 那套）才用抢五。8 局制仍是 8-8 抢七，按 +1 会推成抢九，是错的。
  const at = raw.tiebreakAt !== undefined ? raw.tiebreakAt : raw.gamesToWin;
  const to = at === 0 ? 10 : (raw.gamesToWin <= 4 ? 5 : 7);
  return Object.assign({ tiebreakAt: at, tiebreakTo: to, noAd: true, decidingTiebreakTo: 0 }, raw);
}


/**
 * 由配置**推导**显示文案。不能存 label ——
 * 主办方改过任意一项之后，存下来的那句话就是错的。
 */
const CN_NUM = ['零','一','二','三','四','五','六','七','八','九','十'];
function tbName(n) { return '抢' + (CN_NUM[n] !== undefined ? CN_NUM[n] : n); }

/** 文案顺序与字段顺序一致：**盘 → 局 → 分** */
function formatLabel(f) {
  const c = resolveFormat(f);
  if (c.tiebreakAt === 0) return tbName(c.tiebreakTo);   // 整场一个抢七/抢十
  const sets = c.setsToWin >= 2
    ? (c.decidingTiebreakTo > 0 ? '两盘 + 决胜抢' + (CN_NUM[c.decidingTiebreakTo] || c.decidingTiebreakTo) : '三盘两胜')
    : '单盘';
  return [sets, c.gamesToWin + '局' + (c.noAd ? '金球' : '短盘'), tbName(c.tiebreakTo)].join(' · ');
}

/**
 * @param {string[]} serveOrder 发球顺序。双打长度 4：[A1, B1, A2, B2]；单打长度 2
 * @param {string|object} format 预设名或配置对象；不传用默认（两盘+决胜抢十·金球）
 *
 * **存进 match 的是解析后的配置对象，不是预设名。** 这样这场比赛永远
 * 按开打那天的规则算 —— 预设定义以后改了，历史比分不会被重新解释。
 */
function createMatch({ serveOrder, format }) {
  const cfg = resolveFormat(format);
  if (![2, 4].includes(serveOrder.length)) throw new Error('发球顺序长度必须是 2 或 4');
  return {
    format: cfg,
    serveOrder: serveOrder.slice(),
    points: [0, 0],
    games: [0, 0],
    gameIndex: 0,          // 本盘已完成的局数，用于发球轮转
    sets: [],              // 已完成的盘 [{a, b, tiebreak?}]
    setWins: [0, 0],
    tiebreak: cfg.tiebreakAt === 0,   // 0 平就进抢七 —— 一开局就进
    finished: false,
    winner: null,          // 0 | 1
  };
}

/** 当前发球者在 serveOrder 中的下标 */
function serverIndex(m) {
  const n = m.serveOrder.length;
  if (!m.tiebreak) return m.gameIndex % n;
  // 抢七：第 1 分后换发，之后每 2 分换一次
  const total = m.points[0] + m.points[1];
  return (m.gameIndex + Math.floor((total + 1) / 2)) % n;
}

/** 当前发球者 */
function server(m) {
  return m.serveOrder[serverIndex(m)];
}

/**
 * 某一方当前分的显示文本。
 * **金球赛制不会出现「占先」** —— 40-40 之后下一分就结束了，
 * 根本到不了 Ad 这一档，显示出来是错的。
 */
function pointLabel(m, side) {
  if (m.tiebreak) return String(m.points[side]);
  const cfg = m.format || {};
  const me = m.points[side];
  const opp = m.points[1 - side];
  if (me >= 3 && opp >= 3) {
    if (cfg.noAd || me === opp) return '40';
    return me > opp ? 'Ad' : '-';
  }
  return POINT_LABELS[me];
}

/** 金球点：平分且是金球赛制，下一分定这一局。UI 要不要标由调用方决定 */
function isGoldenPoint(m) {
  const cfg = m.format || {};
  return !!cfg.noAd && !m.tiebreak && m.points[0] >= 3 && m.points[1] >= 3;
}

function clone(m) {
  return {
    format: Object.assign({}, m.format),
    serveOrder: m.serveOrder.slice(),
    points: m.points.slice(),
    games: m.games.slice(),
    gameIndex: m.gameIndex,
    sets: m.sets.map(function (s) {
      return s.tiebreak ? { a: s.a, b: s.b, tiebreak: { a: s.tiebreak.a, b: s.tiebreak.b } } : { a: s.a, b: s.b };
    }),
    setWins: m.setWins.slice(),
    tiebreak: m.tiebreak,
    finished: m.finished,
    winner: m.winner,
  };
}

function finishCheck(n, cfg) {
  const side = n.setWins[0] >= cfg.setsToWin ? 0 : (n.setWins[1] >= cfg.setsToWin ? 1 : -1);
  if (side >= 0) {
    n.finished = true;
    n.winner = side;
    return;
  }
  // 决胜盘抢十：两边各拿一盘，第三盘不打满，直接进一个抢十。
  // 这是业余双打最主流的赛制，而旧的扁平枚举根本表达不了它 ——
  // setsToWin:2 是「第三盘打满」，tb10 是「整场只有一个抢十」，都不是这个。
  if (cfg.decidingTiebreakTo > 0 && isDecidingSet(n, cfg)) {
    n.tiebreak = true;
  }
}

/** 是不是到了决胜盘：双方都差最后一盘 */
function isDecidingSet(n, cfg) {
  return n.setWins[0] === cfg.setsToWin - 1 && n.setWins[1] === cfg.setsToWin - 1;
}

/**
 * 记一分。返回**新的** match 对象，原对象不变（撤销靠页面保存快照）。
 * @param {0|1} side 0 = 我方，1 = 对方
 */
function scorePoint(m, side) {
  if (m.finished) return m;
  const cfg = m.format;
  const n = clone(m);
  const o = 1 - side;
  n.points[side] += 1;

  if (n.tiebreak) {
    // 决胜盘抢十打到 10，普通盘的 6-6 抢七打到 tiebreakTo
    const target = (cfg.decidingTiebreakTo > 0 && isDecidingSet(n, cfg) && cfg.tiebreakAt > 0)
      ? cfg.decidingTiebreakTo : cfg.tiebreakTo;
    if (n.points[side] >= target && n.points[side] - n.points[o] >= 2) {
      const tb = { a: n.points[0], b: n.points[1] };
      n.points = [0, 0];
      // 整场一个抢十，或决胜盘抢十 —— 两种都没有局分，记成 1-0
      if (cfg.tiebreakAt === 0 || (cfg.decidingTiebreakTo > 0 && isDecidingSet(n, cfg))) {
        n.sets.push({ a: side === 0 ? 1 : 0, b: side === 1 ? 1 : 0, tiebreak: tb });
      } else {
        n.games[side] += 1;                       // 7-6
        n.sets.push({ a: n.games[0], b: n.games[1], tiebreak: tb });
        n.games = [0, 0];
        n.gameIndex = 0;
      }
      n.setWins[side] += 1;
      n.tiebreak = false;
      finishCheck(n, cfg);
    }
    return n;
  }

  // 金球：拿到第 4 分就赢下这一局，不要求净胜两分。
  // 曾经这里只写 `差 >= 2`，那是占先制 —— 而默认赛制正是金球，
  // 于是每一场默认赛制的比赛都会在平分之后算错。
  if (n.points[side] >= 4 && (cfg.noAd || n.points[side] - n.points[o] >= 2)) {
    n.games[side] += 1;
    n.points = [0, 0];
    n.gameIndex += 1;
    if (n.games[0] === cfg.tiebreakAt && n.games[1] === cfg.tiebreakAt) {
      n.tiebreak = true;
    } else if (n.games[side] >= cfg.gamesToWin && n.games[side] - n.games[o] >= 2) {
      n.sets.push({ a: n.games[0], b: n.games[1] });
      n.setWins[side] += 1;
      n.games = [0, 0];
      n.gameIndex = 0;
      finishCheck(n, cfg);
    }
  }
  return n;
}

/**
 * 已完成盘的展示结构。抢七分作为上标渲染：7⁷ 6⁵
 * @returns {{a:number,b:number,ta:number|null,tb:number|null}[]}
 */
function setsForDisplay(m) {
  return m.sets.map(function (s) {
    return {
      a: s.a, b: s.b,
      ta: s.tiebreak ? s.tiebreak.a : null,
      tb: s.tiebreak ? s.tiebreak.b : null,
    };
  });
}

/**
 * 只填大分时用：一串盘分能不能构成一场打得出来的比赛。
 *
 * 业余赛常态是**没人愿意每分点一次** —— 打完回来填 6-4 6-3 就想收工
 * （`PRD.md` §6「不记小分也能结束比赛」）。但填出来的分必须是这个赛制下
 * 真打得出来的：6-5 收不了盘，8-6 在 6 局制里到不了，决胜抢十不该有局分。
 * 没有这道判据，签表就会被一个打不出来的比分推进。
 *
 * 判据只看**这一盘合不合法**和**赢够盘没有**，不还原逐分 ——
 * 逐分本来就没记，硬编一份假的比真话还糟。
 *
 * @returns {{legal:boolean, finished:boolean, winner:0|1|-1, reason:string}}
 */
function resultFromSets(sets, format) {
  const cfg = resolveFormat(format);
  const T = cfg.tiebreakAt;                 // 几平进抢七
  const wins = [0, 0];
  const bad = function (reason) { return { legal: false, finished: false, winner: -1, reason: reason }; };

  for (let i = 0; i < (sets || []).length; i++) {
    if (wins[0] >= cfg.setsToWin || wins[1] >= cfg.setsToWin) return bad('已经分出胜负，后面不该还有盘');
    const st = sets[i] || {};
    const a = st.a, b = st.b;
    if (typeof a !== 'number' || typeof b !== 'number' || a < 0 || b < 0) return bad('第 ' + (i + 1) + ' 盘局分不完整');
    if (a === b) return bad('第 ' + (i + 1) + ' 盘打平了，收不了盘');
    const w = a > b ? 0 : 1;                // 这一盘谁赢
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const tb = st.tiebreak;

    // 决胜盘抢十 / 整场一个抢十：没有局分，记成 1-0 + 抢分
    const deciding = cfg.decidingTiebreakTo > 0 && T > 0 &&
                     wins[0] === cfg.setsToWin - 1 && wins[1] === cfg.setsToWin - 1;
    if (deciding || T === 0) {
      const to = deciding ? cfg.decidingTiebreakTo : cfg.tiebreakTo;
      if (hi !== 1 || lo !== 0) return bad('第 ' + (i + 1) + ' 盘是抢' + to + '，只记 1-0 不记局分');
      if (!tb) return bad('第 ' + (i + 1) + ' 盘缺抢' + to + '的比分');
      if (!tbOk(tb, w, to)) return bad('第 ' + (i + 1) + ' 盘的抢' + to + '比分打不出来');
    } else if (hi === T + 1 && lo === T) {
      // 抢七盘：局分只可能是 (T+1)-T，且抢七的赢家必须是这一盘的赢家
      if (!tb) return bad('第 ' + (i + 1) + ' 盘缺抢' + cfg.tiebreakTo + '的比分');
      if (!tbOk(tb, w, cfg.tiebreakTo)) return bad('第 ' + (i + 1) + ' 盘的抢' + cfg.tiebreakTo + '比分打不出来');
    } else {
      if (tb) return bad('第 ' + (i + 1) + ' 盘不该有抢七比分');
      if (hi < cfg.gamesToWin) return bad('第 ' + (i + 1) + ' 盘不够 ' + cfg.gamesToWin + ' 局，收不了盘');
      if (hi - lo < 2) return bad('第 ' + (i + 1) + ' 盘只领先 1 局，收不了盘');
      if (hi > T + 1 || lo >= T) return bad('第 ' + (i + 1) + ' 盘 ' + hi + '-' + lo + ' 在这个赛制下打不出来');
    }
    wins[w] += 1;
  }

  const winner = wins[0] >= cfg.setsToWin ? 0 : (wins[1] >= cfg.setsToWin ? 1 : -1);
  return { legal: true, finished: winner >= 0, winner: winner, reason: '' };
}

/** 抢七/抢十本身合不合法：赢家到分、净胜 2 分，且赢家就是这一盘的赢家 */
function tbOk(tb, setWinner, to) {
  if (!tb || typeof tb.a !== 'number' || typeof tb.b !== 'number') return false;
  if (tb.a === tb.b) return false;
  const w = tb.a > tb.b ? 0 : 1;
  if (w !== setWinner) return false;
  const hi = Math.max(tb.a, tb.b), lo = Math.min(tb.a, tb.b);
  return hi >= to && hi - lo >= 2;
}

/** 上传给后端的 MatchScore（见 api/types.ts）。第一版不上传逐分数据 */
function toMatchScore(m) {
  return {
    sets: m.sets.map(function (s) {
      return s.tiebreak ? { a: s.a, b: s.b, tiebreak: { a: s.tiebreak.a, b: s.tiebreak.b } } : { a: s.a, b: s.b };
    }),
    serveOrder: m.serveOrder.slice(),
  };
}

module.exports = {
  PRESETS,
  DEFAULT_FORMAT,
  resolveFormat,
  formatLabel,
  createMatch,
  scorePoint,
  serverIndex,
  server,
  pointLabel,
  isGoldenPoint,
  setsForDisplay,
  resultFromSets,
  toMatchScore,
};
