const mock = require('../../mock/data');
const store = require('../../utils/store');
const cloud = require('../../utils/cloud');
const T = require('../../utils/tennis');

Page({
  data: {
    today: null, otherToday: [], tournaments: [],
    resume: null, resumeScore: { a: '', b: '' },
  },

  onShow() {
    // tab 页只 onLoad 一次，状态恢复必须放 onShow
    const active = store.getActiveMatch();
    let resume = null, resumeScore = { a: '', b: '' };

    if (active) {
      const saved = store.loadMatchState(active.id);
      if (saved && saved.match && !saved.match.finished) {
        resume = active;
        const m = saved.match;
        const done = T.setsForDisplay(m);
        resumeScore = {
          a: done.map(function (s) { return s.a; }).concat([m.games[0]]).join(' '),
          b: done.map(function (s) { return s.b; }).concat([m.games[1]]).join(' '),
        };
      } else if (saved && saved.match && saved.match.finished) {
        store.clearActiveMatch();
      }
    }

    this.setData({ resume: resume, resumeScore: resumeScore, otherToday: mock.otherToday });

    // 云环境没配好时 cloud.call 自动降级到本地假数据
    const self = this;
    Promise.all([
      cloud.call('match.today'),
      cloud.call('tournament.list', { status: 'open' }),
    ]).then(function (r) {
      self.setData({
        today: resume ? null : (r[0].upcoming[0] || null),
        tournaments: r[1].tournaments,
      });
    }).catch(cloud.toast);
  },

  onStart() {
    wx.navigateTo({ url: '/pages/score/setup/index?id=' + mock.todayMatch.id });
  },

  onTournament(e) {
    wx.navigateTo({ url: '/pages/tournament/detail/index?id=' + e.currentTarget.dataset.id });
  },

  onDraw() {
    wx.navigateTo({ url: '/pages/draw/index' });
  },

  onResume() {
    wx.navigateTo({ url: '/pages/score/live/index?id=' + this.data.resume.id });
  },
});
