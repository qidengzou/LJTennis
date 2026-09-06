/**
 * 网球计分引擎 —— 纯函数，无副作用，可单测。
 * 双打的发球轮转与抢七换发按 ITF 规则实现。
 *
 * 设计依据见 design/design-system-v2.html「排版规则」与 api/types.ts 的 MatchScore。
 */

const POINT_LABELS = ['0', '15', '30', '40'];

const FORMATS = {
  // 6 局短盘，6-6 抢七，三盘两胜
  short6_tb:  { gamesToWin: 6, tiebreakAt: 6, tiebreakTo: 7,  setsToWin: 2, label: '6局短盘 · 抢七' },
  // 单盘 6 局
  single6_tb: { gamesToWin: 6, tiebreakAt: 6, tiebreakTo: 7,  setsToWin: 1, label: '单盘6局 · 抢七' },
  // 抢十：整场就是一个决胜局
  tb10:       { gamesToWin: 0, tiebreakAt: 0, tiebreakTo: 10, setsToWin: 1, label: '抢十' },
};

/**
 * @param {string[]} serveOrder 发球顺序。双打长度 4：[A1, B1, A2, B2]；单打长度 2
 * @param {string} format FORMATS 的 key
 */
function createMatch({ serveOrder, format = 'short6_tb' }) {
  if (!FORMATS[format]) throw new Error('未知赛制: ' + format);
  if (![2, 4].includes(serveOrder.length)) throw new Error('发球顺序长度必须是 2 或 4');
  return {
    format,
    serveOrder: serveOrder.slice(),
    points: [0, 0],
    games: [0, 0],
    gameIndex: 0,          // 本盘已完成的局数，用于发球轮转
    sets: [],              // 已完成的盘 [{a, b, tiebreak?}]
    setWins: [0, 0],
    tiebreak: format === 'tb10',
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

/** 某一方当前分的显示文本 */
function pointLabel(m, side) {
  if (m.tiebreak) return String(m.points[side]);
  const me = m.points[side];
  const opp = m.points[1 - side];
  if (me >= 3 && opp >= 3) {
    if (me === opp) return '40';
    return me > opp ? 'Ad' : '-';
  }
  return POINT_LABELS[me];
}

function clone(m) {
  return {
    format: m.format,
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
  }
}

/**
 * 记一分。返回**新的** match 对象，原对象不变（撤销靠页面保存快照）。
 * @param {0|1} side 0 = 我方，1 = 对方
 */
function scorePoint(m, side) {
  if (m.finished) return m;
  const cfg = FORMATS[m.format];
  const n = clone(m);
  const o = 1 - side;
  n.points[side] += 1;

  if (n.tiebreak) {
    if (n.points[side] >= cfg.tiebreakTo && n.points[side] - n.points[o] >= 2) {
      const tb = { a: n.points[0], b: n.points[1] };
      n.points = [0, 0];
      if (n.format === 'tb10') {
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

  if (n.points[side] >= 4 && n.points[side] - n.points[o] >= 2) {
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
  FORMATS,
  createMatch,
  scorePoint,
  serverIndex,
  server,
  pointLabel,
  setsForDisplay,
  toMatchScore,
};
