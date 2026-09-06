const mock = require('../../../mock/entries');

Page({
  data: { t: null, events: [] },
  onLoad() {
    const t = mock.tournament;
    const events = t.events.map(function (e) {
      const full = e.confirmedCount >= e.capacity;
      return Object.assign({}, e, {
        full: full,
        pct: Math.min(100, Math.round(e.confirmedCount / e.capacity * 100)),
        countText: full
          ? ('已满 · 候补 ' + e.waitlistCount)
          : (e.confirmedCount + '/' + e.capacity + ' 组'),
      });
    });
    this.setData({
      t: Object.assign({}, t, { feeText: '¥' + (t.events[0].feeCents / 100) + ' / 组' }),
      events: events,
    });
  },
  onEvent(e) { wx.navigateTo({ url: '/pages/event/detail/index?id=' + e.currentTarget.dataset.id }); },
  onPick()   { wx.navigateTo({ url: '/pages/event/detail/index?id=' + this.data.events[0].id }); },
  onShareAppMessage() {
    return { title: this.data.t.name + ' 报名中', path: '/pages/tournament/detail/index?id=' + this.data.t.id };
  },
});
