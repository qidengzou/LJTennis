const mock = require('../../../mock/entries');
const E = require('../../../utils/entry');

Page({
  data: { list: [] },

  onShow() { this.render(); this.timer = setInterval(this.render.bind(this), 1000); },
  onHide() { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },

  render() {
    const now = Date.now();
    const list = E.sortEntries(mock.myEntries).map(function (en, i) {
      const view = E.statusView(en);
      const left = en.deadlineAt ? en.deadlineAt - now : 0;
      const urgent = en.deadlineAt ? E.isUrgent(left) : false;

      let right = '', sub = '';
      if (en.deadlineAt) right = E.formatCountdown(left);
      else if (en.paidAt) right = en.paidAt;
      else if (en.refundedAt) right = en.refundedAt;
      else if (en.status === 'waitlisted') right = '无需付款';

      if (en.status === 'pending_partner') sub = '已邀请 ' + en.invitee + '，等待接受';
      else if (en.status === 'waitlisted')  sub = '有组合退赛时按顺序通知你';
      else if (en.status === 'refunded')    sub = '退款 ¥' + en.feeCents / 100 + ' 已原路返回';
      else sub = en.partners.join(' / ') + ' · ¥' + en.feeCents / 100;

      return Object.assign({}, en, {
        view: view, right: right, sub: sub, urgent: urgent,
        hero: i === 0 && !!view.action,
        faded: en.status === 'refunded' || en.status === 'cancelled',
        btnCls: view.tone === 'wx' ? 'btn-wx' : 'btn-secondary',
      });
    });
    this.setData({ list: list });
  },

  onAction(e) {
    const { id, status } = e.currentTarget.dataset;
    if (status === 'pending_payment') {
      wx.navigateTo({ url: '/pages/entry/pay/index?entry=' + id });
    } else if (status === 'pending_partner') {
      wx.showToast({ title: '已重新发送邀请', icon: 'success' });
    }
  },
});
