const mock = require('../../../mock/entries');
const AV = ['var(--c-av-1)', 'var(--c-av-2)', 'var(--c-av-3)', 'var(--c-av-4)', 'var(--c-av-5)'];

Page({
  data: { ev: null, entries: [], rules: '', ctaText: '发起报名' },
  onLoad(q) {
    const t = mock.tournament;
    const e = t.events.filter(function (x) { return x.id === q.id; })[0] || t.events[0];
    const full = e.confirmedCount >= e.capacity;
    const list = (mock.eventEntries[e.id] || []).map(function (x, i) {
      return Object.assign({}, x, { color: AV[i % 5], initial: x.names[0].charAt(0) });
    });
    this.setData({
      ev: Object.assign({}, e, {
        full: full,
        pct: Math.min(100, Math.round(e.confirmedCount / e.capacity * 100)),
        countText: full ? ('已满 · 候补 ' + e.waitlistCount) : (e.confirmedCount + '/' + e.capacity + ' 组'),
        feeText: e.feeCents ? ('¥' + e.feeCents / 100 + ' / 组') : '免费',
      }),
      entries: list,
      rules: t.rules,
      ctaText: full ? ('加入候补 · 第 ' + (e.waitlistCount + 1) + ' 位') : '发起报名',
    });
  },
  onCreate() { wx.navigateTo({ url: '/pages/entry/create/index?event=' + this.data.ev.id }); },
});
