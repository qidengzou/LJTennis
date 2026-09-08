const mock = require('../../../mock/data');
const store = require('../../../utils/store');
const T = require('../../../utils/tennis');

Page({
  data: { m: null, formatLabel: '', firstSide: 0, aFirst: 0, bFirst: 0, serveOrder: [], serveSlots: [] },

  onLoad(query) {
    const m = mock.todayMatch;            // TODO 云环境接好后按 query.id 拉取
    this.setData({ m, formatLabel: T.formatLabel(m.format) }, this.refresh);
  },

  /**
   * 三次选择推导出完整轮转：先发方的人 → 后发方的人 → 先发方另一人 → 后发方另一人
   * serveSlots 与 serveOrder 一一对应，记录的是「哪一方的第几个人」——
   * 记分页据此高亮发球点。不能靠名字匹配，双打里两人重名是可能的。
   */
  refresh() {
    const { m, firstSide, aFirst, bFirst } = this.data;
    const A = [{ s: 0, i: aFirst }, { s: 0, i: 1 - aFirst }];
    const B = [{ s: 1, i: bFirst }, { s: 1, i: 1 - bFirst }];
    const slots = firstSide === 0 ? [A[0], B[0], A[1], B[1]] : [B[0], A[0], B[1], A[1]];
    const order = slots.map(function (x) { return x.s === 0 ? m.a[x.i] : m.b[x.i]; });
    this.setData({ serveOrder: order, serveSlots: slots });
  },

  onSide(e)   { this.setData({ firstSide: +e.currentTarget.dataset.v }, this.refresh); },
  onAFirst(e) { this.setData({ aFirst: +e.currentTarget.dataset.v }, this.refresh); },
  onBFirst(e) { this.setData({ bFirst: +e.currentTarget.dataset.v }, this.refresh); },

  onStart() {
    const { m, serveOrder, serveSlots } = this.data;
    const match = T.createMatch({ serveOrder, format: m.format });
    store.saveMatchState(m.id, { match, history: [], meta: m, serveSlots });
    store.setActiveMatch(m);
    wx.redirectTo({ url: '/pages/score/live/index?id=' + m.id });
  },
});
