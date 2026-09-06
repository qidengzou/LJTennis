const cloud = require('../../utils/cloud');
const store = require('../../utils/store');

Page({
  data: {
    loaded: false, registered: false, user: null,
    genderText: '', stats: { registered: 0, completed: 0, wins: 0, losses: 0 },
    pendingText: '', topPartner: null,
  },

  // tab 页只 onLoad 一次，注册完回来必须靠 onShow 刷新
  onShow() { this.load(); },

  load() {
    const self = this;
    cloud.call('user.me').then(function (r) {
      if (!r.registered) {
        self.setData({ loaded: true, registered: false, user: null });
        return;
      }
      self.setData({
        loaded: true, registered: true, user: r.user,
        genderText: r.user.gender === 'F' ? '女' : '男',
      });
      self.loadExtras();
    }).catch(function (err) {
      self.setData({ loaded: true, registered: false });
      cloud.toast(err);
    });
  },

  loadExtras() {
    const self = this;
    cloud.call('entry.mine').then(function (r) {
      const list = r.entries || [];
      const NEED = ['pending_payment', 'promoted', 'pending_partner'];
      const pending = list.filter(function (e) { return NEED.indexOf(e.status) >= 0; }).length;
      const done = list.filter(function (e) { return e.status === 'confirmed'; }).length;
      self.setData({
        pendingText: pending ? (pending + ' 项待处理') : '暂无待处理',
        // 报名与完赛必须是两个数：业余赛退赛率高，合成一个会误导
        stats: { registered: list.length, completed: done, wins: 0, losses: 0 },
      });
    }).catch(function () { /* 次要数据，失败不打断 */ });

    cloud.call('user.partners').then(function (r) {
      self.setData({ topPartner: (r.partners || [])[0] || null });
    }).catch(function () { /* 没有搭档时整行隐藏 */ });
  },

  onRegister() {
    // 触发点 B：完成后回「我的」。switchTab 带不了参数，走本地存储
    store.setRegisterReturn({ type: 'tab', url: '/pages/me/index' });
    wx.navigateTo({ url: '/pages/auth/register/index' });
  },

  onEntries() { wx.navigateTo({ url: '/pages/me/entries/index' }); },
  onProfile() { wx.showToast({ title: '资料编辑待接入', icon: 'none' }); },
});
