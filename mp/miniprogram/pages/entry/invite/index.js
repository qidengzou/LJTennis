const mock = require('../../../mock/entries');
const E = require('../../../utils/entry');
const cloud = require('../../../utils/cloud');
const store = require('../../../utils/store');

Page({
  data: { inv: null, countdown: '', urgent: false },

  onLoad() {
    const i = mock.incomingInvite;
    this.expiresAt = i.expiresAt;
    this.setData({ inv: Object.assign({}, i, { feeText: '¥' + i.feeCents / 100 + ' / 组' }) });
    this.tick();
  },
  onShow()   { this.timer = setInterval(this.tick.bind(this), 1000); },
  onHide()   { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },

  tick() {
    const left = this.expiresAt - Date.now();
    this.setData({ countdown: E.formatCountdown(left), urgent: E.isUrgent(left) });
  },

  onAccept() {
    const self = this;
    // 登录墙在这一步，不在页面入口 —— 落地页要全程免登录
    cloud.call('user.me').then(function (r) {
      if (r.registered) { self.doAccept(); return; }
      const i = mock.incomingInvite;
      store.setRegisterReturn({
        type: 'navigate',
        url: '/pages/entry/invite/index',
        ctx: { title: i.tournamentName + ' · ' + i.eventName,
               sub: i.from.nickname + ' 邀请你组队 · ¥' + i.feeCents / 100 + ' 由 ' + i.payerName + ' 支付' },
      });
      wx.navigateTo({ url: '/pages/auth/register/index' });
    }).catch(cloud.toast);
  },

  doAccept() {
    const i = mock.incomingInvite;
    const ev = mock.tournament.events.filter(function (x) { return x.type === i.eventType; })[0];
    // 与后端同一套判定逻辑（api/endpoints.md §04）
    const r = E.acceptResult({
      eventType: ev.type,
      genders: [i.from.gender, mock.me.gender === 'M' ? 'F' : 'M'],  // 演示：我作为异性搭档
      feeCents: ev.feeCents,
      capacity: ev.capacity,
      confirmedCount: ev.confirmedCount,
      waitlistCount: ev.waitlistCount,
    });
    if (!r.ok) {
      wx.showModal({ title: '无法接受', content: '这个项目对性别有要求，你和发起人不符合。', showCancel: false });
      return;
    }
    if (r.status === 'confirmed') {
      wx.showToast({ title: '免费赛事，已进正选', icon: 'success' });
      setTimeout(function () { wx.navigateTo({ url: '/pages/me/entries/index' }); }, 900);
    } else if (r.status === 'pending_payment') {
      wx.navigateTo({ url: '/pages/entry/pay/index?entry=en1' });
    } else {
      wx.showModal({
        title: '已加入候补',
        content: '你排在第 ' + r.waitlistPosition + ' 位。有组合退赛时会通知你，转正后 24 小时内支付即可。',
        showCancel: false,
        success() { wx.navigateTo({ url: '/pages/me/entries/index' }); },
      });
    }
  },

  onReject() {
    wx.showModal({
      title: '拒绝邀请', content: '拒绝后这条报名会作废。',
      success(res) { if (res.confirm) wx.navigateBack(); },
    });
  },
});
