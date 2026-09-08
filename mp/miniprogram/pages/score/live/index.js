const store = require('../../../utils/store');
const T = require('../../../utils/tennis');

const MAX_HISTORY = 80;

Page({
  data: {
    id: '', meta: null, formatLabel: '',
    ptA: '0', ptB: '0', setWins: '0-0', gameScore: '0-0', doneSets: [],
    srvSide: 0, srvIdx: 0,
    canUndo: false, finished: false, syncTip: '未联网 · 已本地保存',
  },

  onLoad(query) {
    const id = query.id;
    const saved = store.loadMatchState(id);
    if (!saved || !saved.match) {
      wx.showToast({ title: '没有找到这场比赛', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this.match = saved.match;
    this.history = saved.history || [];
    this.serveSlots = saved.serveSlots || [];
    this.setData({ id, meta: saved.meta, formatLabel: T.formatLabel(saved.match.format) });
    this.render();
    // 记分中不锁屏 —— 换边间隙 90 秒，锁屏会打断
    wx.setKeepScreenOn({ keepScreenOn: true });
  },

  onUnload() {
    wx.setKeepScreenOn({ keepScreenOn: false });
  },

  render() {
    const m = this.match;
    const slot = this.serveSlots[T.serverIndex(m)] || { s: 0, i: 0 };
    this.setData({
      ptA: T.pointLabel(m, 0),
      ptB: T.pointLabel(m, 1),
      setWins: m.setWins[0] + '-' + m.setWins[1],
      gameScore: m.games[0] + '-' + m.games[1],
      doneSets: T.setsForDisplay(m),
      srvSide: slot.s, srvIdx: slot.i,
      canUndo: this.history.length > 0,
      finished: m.finished,
      syncTip: m.finished
        ? '比赛已结束 · 待提交'
        : (m.tiebreak ? '抢七 · 每两分换发球 · 已本地保存' : '未联网 · 已本地保存'),
    });
  },

  point(side) {
    if (this.match.finished) return;
    this.history.push(JSON.stringify(this.match));
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.match = T.scorePoint(this.match, side);
    this.persist();
    this.render();
    wx.vibrateShort({ type: 'light' });
  },

  onA() { this.point(0); },
  onB() { this.point(1); },

  onUndo() {
    if (!this.history.length) return;
    this.match = JSON.parse(this.history.pop());
    this.persist();
    this.render();
  },

  /** 每一分都同步落地。异步写在杀进程时可能丢 */
  persist() {
    store.saveMatchState(this.data.id, {
      match: this.match,
      history: this.history,
      meta: this.data.meta,
      serveSlots: this.serveSlots,
    });
  },

  onFinish() {
    const self = this;
    const done = this.match.finished;
    wx.showModal({
      title: done ? '提交比分' : '提前结束',
      content: done
        ? '提交后由对方确认，确认后签表才会推进。'
        : '这场还没打完，确定要结束吗？已记录的比分会保留。',
      success(res) {
        if (!res.confirm) return;
        // TODO 云环境接好后调用 POST /matches/:id/score（幂等，带 version）
        console.log('[LJTennis] 待上传的 MatchScore:', T.toMatchScore(self.match));
        store.clearActiveMatch();
        wx.showToast({ title: '已保存到本地', icon: 'success' });
        setTimeout(function () { wx.navigateBack(); }, 900);
      },
    });
  },
});
