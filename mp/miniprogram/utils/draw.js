/**
 * 签表工具 —— 纯函数，无副作用，可单测。
 * 对应 api/types.ts 的 Match / Group / GroupStanding。
 */

const ROUND_LABELS = { 64: '64强', 32: '32强', 16: '16强', 8: '8强', 4: '半决赛', 2: '决赛' };

function roundLabel(roundOf) {
  return ROUND_LABELS[roundOf] || (roundOf + '强');
}

/** 从场次列表里取出所有轮次，由大到小（16强 → 决赛） */
function rounds(matches) {
  const set = {};
  matches.forEach(function (m) { if (m.roundOf) set[m.roundOf] = true; });
  return Object.keys(set).map(Number).sort(function (a, b) { return b - a; })
    .map(function (r) { return { roundOf: r, label: roundLabel(r) }; });
}

/** 某一方在一场比赛里赢下的局数 */
function gamesFor(match, side) {
  if (!match.score || !match.score.sets) return 0;
  return match.score.sets.reduce(function (n, s) { return n + (side === 'a' ? s.a : s.b); }, 0);
}

/**
 * 小组积分表。判定顺序：胜场 → 净胜盘 → 净胜局 → 报名先后（`PRD.md` §5）。
 * 这条规则要显示在表下面，不能藏进规则页。
 *
 * ⚠️ **净胜盘这一档还没做**（缺 setsWon/setDiff，见 SPEC.md §5.1），
 * 现在是胜场 → 净胜局 → 报名先后，中间少比一档。
 *
 * **兜底是 seq（报名先后），不是抽签。** 别在这里补随机数 ——
 * 抽签事后没法复算，谁也说不清那次抽的是什么；seq 是死的，谁都能自己数一遍。
 */
function standings(group, matches) {
  const rows = group.entryIds.map(function (id, i) {
    return { entryId: id, seq: i, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, rank: 0, qualified: false };
  });
  const byId = {};
  rows.forEach(function (r) { byId[r.entryId] = r; });

  matches.forEach(function (m) {
    if (m.groupId !== group.id || m.status !== 'confirmed') return;
    const A = byId[m.entryAId], B = byId[m.entryBId];
    if (!A || !B) return;
    const ga = gamesFor(m, 'a'), gb = gamesFor(m, 'b');
    A.gamesWon += ga; A.gamesLost += gb;
    B.gamesWon += gb; B.gamesLost += ga;
    if (m.winnerEntryId === m.entryAId) { A.wins++; B.losses++; }
    else if (m.winnerEntryId === m.entryBId) { B.wins++; A.losses++; }
  });

  rows.forEach(function (r) { r.gameDiff = r.gamesWon - r.gamesLost; });
  rows.sort(function (x, y) {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    return x.seq - y.seq;
  });
  rows.forEach(function (r, i) {
    r.rank = i + 1;
    r.qualified = r.rank <= (group.qualifyCount || 2);
  });
  return rows;
}

/** 我参与的场次（含我还没打、但对阵已确定的） */
function isMine(match, myEntryIds) {
  return myEntryIds.indexOf(match.entryAId) >= 0 || myEntryIds.indexOf(match.entryBId) >= 0;
}

/**
 * 一轮里的场次排序：我的置顶，其余按场次号。
 * 真实场景 90% 是「我下一场打谁」，所以我的那场必须在最上面。
 */
function sortForDisplay(matches, myEntryIds) {
  return matches.slice().sort(function (a, b) {
    const ma = isMine(a, myEntryIds) ? 0 : 1;
    const mb = isMine(b, myEntryIds) ? 0 : 1;
    if (ma !== mb) return ma - mb;
    return a.matchNo - b.matchNo;
  });
}

/** 「待定（场次 11 胜者）」的文案 */
function pendingLabel(match, which) {
  const src = which === 'a' ? match.sourceMatchAId : match.sourceMatchBId;
  return src ? ('待定（' + src + ' 胜者）') : '待定';
}

/**
 * 经典 bracket 的几何布局。第 r 轮第 j 场的纵向中心呈 2^r 倍间距，
 * 保证下一轮的盒子正好落在上一轮两场的中线上。
 * @returns {{rounds, boxes, totalW, totalH}}
 */
function bracketLayout(matches, myEntryIds, opt) {
  const o = Object.assign({ colW: 172, boxW: 150, rowH: 78, boxH: 54, pad: 16 }, opt || {});
  const rs = rounds(matches);
  const boxes = [];
  rs.forEach(function (r, ri) {
    const ms = matches
      .filter(function (m) { return m.roundOf === r.roundOf; })
      .sort(function (a, b) { return a.matchNo - b.matchNo; });
    ms.forEach(function (m, j) {
      const span = Math.pow(2, ri);
      boxes.push({
        m: m,
        roundIndex: ri,
        x: o.pad + ri * o.colW,
        y: o.pad + o.rowH * span * (j + 0.5) - o.boxH / 2,
        cy: o.pad + o.rowH * span * (j + 0.5),
        mine: isMine(m, myEntryIds),
      });
    });
  });
  return {
    rounds: rs,
    boxes: boxes,
    opt: o,
    totalW: o.pad * 2 + rs.length * o.colW,
    totalH: o.pad * 2 + o.rowH * (rs.length ? rs[0].roundOf / 2 : 0),
  };
}

module.exports = { roundLabel, rounds, gamesFor, standings, isMine, sortForDisplay, pendingLabel, bracketLayout };
