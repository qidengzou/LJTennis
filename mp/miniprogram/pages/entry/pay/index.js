const mock = require('../../../mock/entries');
const E = require('../../../utils/entry');

Page({
  data: { en: null, countdown: '', urgent: false, cdLabel: '超时释放名额' },

  onLoad(q) {
    const en = mock.myEntries.filter(function (x) { return x.id === q.entry; })[0] || mock.myEntries[0];
    this.expiresAt = en.deadlineAt || (Date.now() + 15 * 60000);
    this.setData({
      en: Object.assign({}, en, { fee: en.feeCents / 100 }),
      cdLabel: '超时释放名额',
    });
    this.tick();
  },
  onShow()   { this.timer = setInterval(this.tick.bind(this), 1000); },
  onHide()   { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },

  tick() {
    const left = this.expiresAt - Date.now();
    this.setData({ countdown: E.formatCountdown(left), urgent: E.isUrgent(left) });
  },

  onPay() {
    // TODO 接云支付：POST /entries/:id/order → wx.requestPayment → 回调置 confirmed
    wx.showModal({
      title: '未接入支付',
      content: '云支付需要企业主体 + 商户号。当前为演示流程，点确定模拟支付成功。',
      success(res) {
        if (!res.confirm) return;
        wx.showToast({ title: '已确认参赛', icon: 'success' });
        setTimeout(function () { wx.navigateTo({ url: '/pages/me/entries/index' }); }, 800);
      },
    });
  },
});
