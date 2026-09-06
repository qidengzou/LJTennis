const mock = require('../../mock/draw');
const store = require('../../utils/store');
const D = require('../../utils/draw');

/** 一方的比分格子：抢七分渲染成上标 */
function setCells(match, side) {
  if (!match.score || !match.score.sets) return [];
  return match.score.sets.map(function (s) {
    const v = side === 'a' ? s.a : s.b;
    const sup = s.tiebreak ? (side === 'a' ? s.tiebreak.a : s.tiebreak.b) : '';
    return { v: v, sup: sup === '' ? '' : String(sup) };
  });
}

function chipFor(m, mine) {
  if (mine) return { chipText: '我的', chipCls: 'chip-brand' };
  if (m.status === 'confirmed') return { chipText: '已确认', chipCls: 'chip-win' };
  if (m.status === 'live') return { chipText: '进行中', chipCls: 'chip-live' };
  return { chipText: '未开始', chipCls: '' };
}

function buildCard(m, data) {
  const mine = D.isMine(m, data.myEntryIds);
  const nameOf = function (id, which) {
    if (!id) return { name: D.pendingLabel(m, which), pending: true };
    const e = data.entries[id];
    return { name: e.players[0] + ' / ' + e.players[1], pending: false };
  };
  const A = nameOf(m.entryAId, 'a');
  const B = nameOf(m.entryBId, 'b');
  const hasScore = !!(m.score && m.score.sets && m.score.sets.length);
  const chip = chipFor(m, mine);

  return {
    id: m.id,
    no: m.matchNo,
    when: (m.scheduledAt || '') + (m.court ? ' · ' + m.court : ''),
    mine: mine,
    hasScore: hasScore,
    chipText: chip.chipText,
    chipCls: chip.chipCls,
    a: { name: A.name, pending: A.pending, sets: setCells(m, 'a'),
         lose: hasScore && m.winnerEntryId && m.winnerEntryId !== m.entryAId },
    b: { name: B.name, pending: B.pending, sets: setCells(m, 'b'),
         lose: hasScore && m.winnerEntryId && m.winnerEntryId !== m.entryBId },
    // 只有我的、且对阵已确定、且还没打完的场次才给记分入口
    canScore: mine && !hasScore && !!m.entryAId && !!m.entryBId && m.status !== 'confirmed',
  };
}

Page({
  data: {
    fmt: 'knockout',
    rounds: [], curRound: 0, onlyMine: false, cards: [],
    groups: [], curGroup: '', standings: [], qualifyCount: 2, groupCards: [],
  },

  onLoad() { this.apply('knockout'); },

  apply(fmt) {
    const d = fmt === 'knockout' ? mock.knockout : mock.group;
    this.src = d;
    if (fmt === 'knockout') {
      const rounds = D.rounds(d.matches);
      // 默认停在「我下一场」所在的轮次 —— 90% 的使用场景就是这个
      const mineNext = d.matches.filter(function (m) {
        return D.isMine(m, d.myEntryIds) && m.status !== 'confirmed';
      })[0];
      const cur = mineNext ? mineNext.roundOf : rounds[0].roundOf;
      this.setData({ fmt: fmt, rounds: rounds, curRound: cur, onlyMine: false }, this.renderRound);
    } else {
      const gs = d.groups.map(function (g) { return { id: g.id, name: g.name }; });
      this.setData({ fmt: fmt, groups: gs, curGroup: d.groups[0].id }, this.renderGroup);
    }
  },

  renderRound() {
    const d = this.src, self = this;
    let ms = d.matches.filter(function (m) { return m.roundOf === self.data.curRound; });
    if (this.data.onlyMine) ms = ms.filter(function (m) { return D.isMine(m, d.myEntryIds); });
    ms = D.sortForDisplay(ms, d.myEntryIds);
    this.setData({ cards: ms.map(function (m) { return buildCard(m, d); }) });
  },

  renderGroup() {
    const d = this.src, gid = this.data.curGroup;
    const g = d.groups.filter(function (x) { return x.id === gid; })[0];
    const rows = D.standings(g, d.matches).map(function (r) {
      const e = d.entries[r.entryId];
      return {
        entryId: r.entryId, rank: r.rank, qualified: r.qualified,
        name: e.players[0] + ' / ' + e.players[1],
        wl: r.wins + '-' + r.losses,
        diff: (r.gameDiff > 0 ? '+' : r.gameDiff < 0 ? '−' : '') + Math.abs(r.gameDiff),
      };
    });
    const ms = D.sortForDisplay(
      d.matches.filter(function (m) { return m.groupId === gid; }), d.myEntryIds);
    this.setData({
      standings: rows,
      qualifyCount: g.qualifyCount || 2,
      groupCards: ms.map(function (m) { return buildCard(m, d); }),
    });
  },

  onFmt(e)   { this.apply(e.currentTarget.dataset.v); },
  onRound(e) { this.setData({ curRound: +e.currentTarget.dataset.v }, this.renderRound); },
  onGroup(e) { this.setData({ curGroup: e.currentTarget.dataset.v }, this.renderGroup); },
  onAll()    { this.setData({ onlyMine: false }, this.renderRound); },
  onMine()   { this.setData({ onlyMine: true }, this.renderRound); },

  onOverview() {
    wx.navigateTo({ url: '/pages/draw/overview/index?event=' + this.src.eventId });
  },

  /** 同 tab 内跳转，可以直接带参数 —— 记分收进赛事 tab 之后省掉了 storage 传参 */
  onScore(e) {
    const id = e.currentTarget.dataset.id;
    const saved = store.loadMatchState(id);
    const url = saved && saved.match
      ? '/pages/score/live/index?id=' + id
      : '/pages/score/setup/index?id=' + id;
    wx.navigateTo({ url: url });
  },
});
