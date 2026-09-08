const cloud = require('../../../utils/cloud');
const store = require('../../../utils/store');

/**
 * 注册。自定义导航栏 + 全屏照片 + 单页表单。
 *
 * 两个触发点（PRD.md §9）：
 *   A 点「报名 / 接受邀请」时 —— 带上下文，完成后回原流程
 *   B 点「我的」tab 时 —— 无上下文，完成后回「我的」
 * 回跳目标走本地存储：wx.switchTab 带不了参数。
 *
 * 四项：昵称 · 手机号 · 性别 · 水平。
 * 这里的水平是**注册时自评**，只做初始分组；算出来的双打评分仍延后到第二版。
 */

/** NTRP 业余段。1.5 太低，实际没人自评到那一档 */
const LEVELS = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
/** 轨道两端各留半个滑块，与 index.wxss 的 .rail / .thumb 对应 */
const PAD_RPX = 22;
/** 假数据模式下可选的号码。真机上这一步由微信自己的选号弹窗完成 */
const MOCK_PHONES = ['18512349029', '13800006421', '13612345678'];
function maskOf(p) { return p.slice(0, 3) + '****' + p.slice(7); }

Page({
  data: {
    statusBar: 20,
    navRight: 100,        // 胶囊按钮占位，返回键要避开
    nickname: '',
    phoneFrom: '',      // 'wx' = 已授权，此时只读展示
    phoneShown: '',
    gender: 'M',      // 默认男：报名以男双为主，少数人才要改
    canSubmit: false,
    mock: cloud.isMock,
    levels: [],
    fillW: '0%',
    thumbL: '22rpx',
  },

  onLoad(q) {
    // 自定义导航栏必须自己避让状态栏与右上角胶囊（87×32pt）
    let statusBar = 20, navRight = 100;
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBar = win.statusBarHeight || 20;
      const cap = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
      if (cap && cap.width) navRight = (win.windowWidth - cap.left) + 8;
      this.rpx = (win.windowWidth || 375) / 750;   // 1rpx = ? px
    } catch (e) { this.rpx = 0.5; }

    const back = store.getRegisterReturn();
    this.back = back || (q.back ? { type: 'navigate', url: decodeURIComponent(q.back) } : null);
    this.lvIdx = 1;                                // 默认 2.5
    // back.ctx（「你正在报名什么」）不再上屏，但回跳目标仍然要靠它
    this.setData({
      statusBar: statusBar,
      navRight: navRight,
    }, this.renderLevels);
  },

  onReady() { this.measure(); },

  /* ---------- 水平滑杆 ---------- */

  measure() {
    const self = this;
    wx.createSelectorQuery().select('#lvTrack').boundingClientRect(function (r) {
      if (r && r.width) self.rect = r;
    }).exec();
  },

  renderLevels() {
    const i = this.lvIdx;
    const pct = i / (LEVELS.length - 1);
    this.setData({
      levels: LEVELS.map(function (v, k) {
        const sel = k === i;
        return {
          v: v,
          dot: sel ? 'transparent' : (k < i ? 'var(--c-brand)' : 'var(--c-line)'),
          fg: sel ? 'var(--c-brand)' : 'var(--c-ink-3)',
          fw: sel ? '600' : '500',
        };
      }),
      fillW: 'calc((100% - ' + (PAD_RPX * 2) + 'rpx) * ' + pct + ')',
      thumbL: 'calc(' + PAD_RPX + 'rpx + (100% - ' + (PAD_RPX * 2) + 'rpx) * ' + pct + ')',
    });
  },

  seek(e) {
    if (!this.rect) { this.measure(); return; }
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const pad = PAD_RPX * this.rpx;
    const span = Math.max(1, this.rect.width - pad * 2);
    const p = Math.min(1, Math.max(0, (t.clientX - this.rect.left - pad) / span));
    const i = Math.round(p * (LEVELS.length - 1));
    if (i !== this.lvIdx) { this.lvIdx = i; this.renderLevels(); }
  },

  onLvStart(e) { this.lvDrag = true; this.seek(e); },
  onLvMove(e)  { if (this.lvDrag) this.seek(e); },
  onLvEnd()    { this.lvDrag = false; },

  onBack() {
    wx.navigateBack({ fail: function () { wx.switchTab({ url: '/pages/tournament/index' }); } });
  },

  /* ---------- 表单 ---------- */
  onNick(e)   { this.setData({ nickname: e.detail.value }, this.validate); },
  onGender(e) { this.setData({ gender: e.currentTarget.dataset.v }, this.validate); },

  /** 真机：<button open-type="getPhoneNumber"> 的回调 */
  onWxPhone(e) {
    const d = e.detail || {};
    if (String(d.errMsg || '').indexOf('ok') < 0 || !d.code) {
      wx.showToast({ title: '没拿到手机号，可以手动填', icon: 'none' });
      return;
    }
    // 立刻换：微信的 code 只有 5 分钟且一次性，等用户填完表再换十有八九过期
    const self = this;
    wx.showLoading({ title: '获取中', mask: true });
    cloud.call('user.phone', { code: d.code }).then(function (r) {
      wx.hideLoading();
      self.phoneVerified = true;
      self.setData({ phoneFrom: 'wx', phoneShown: r.phoneMasked }, self.validate);
    }).catch(function (err) {
      wx.hideLoading();
      self.phoneVerified = false;
      cloud.toast(err);
    });
  },

  onPhoneReset() {
    this.phoneVerified = false;
    this.setData({ phoneFrom: '', phoneShown: '' },
                 this.validate);
  },

  /** 假数据模式下 open-type 为空，走普通点击 */
  onWxPhoneMock() {
    if (!cloud.isMock) return;
    const self = this;
    // 真机上微信会弹一个选号面板，假数据模式也给一个，省得只能测一个号
    wx.showActionSheet({
      itemList: MOCK_PHONES.map(maskOf),
      success(r) {
        self.phoneVerified = true;
        self.setData({ phoneFrom: 'wx', phoneShown: maskOf(MOCK_PHONES[r.tapIndex]) },
                     self.validate);
      },
      fail() { /* 用户取消，什么都不做 */ },
    });
  },


  validate() {
    const d = this.data;
    this.setData({ canSubmit: !!d.nickname.trim() && !!d.gender && !!this.phoneVerified });
  },

  /* ---------- 提交 ---------- */
  onSubmit() {
    if (this.data.canSubmit) { this.submit(); return; }
    // 不把按钮灰掉，点了直接说缺什么 —— 灰按钮不给反馈，用户不知道卡在哪
    const d = this.data;
    const miss = [];
    if (!d.nickname.trim()) miss.push('昵称');
    if (!this.phoneVerified) miss.push('手机号');
    if (!d.gender) miss.push('性别');
    wx.showToast({ title: '还差' + miss.join('、'), icon: 'none' });
  },

  submit() {
    if (this.submitting) return;
    const self = this;
    this.submitting = true;
    wx.showLoading({ title: '注册中', mask: true });

    cloud.call('user.register', {
      nickname: this.data.nickname.trim(),
      gender: this.data.gender,
      level: LEVELS[this.lvIdx],
      phoneVerified: true,
    }).then(function (r) {
      wx.hideLoading();
      self.submitting = false;
      wx.setStorageSync('lj:wxNickname', r.user.nickname);
      store.clearRegisterReturn();
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(function () { self.goBack(); }, 700);
    }).catch(function (err) {
      wx.hideLoading();
      self.submitting = false;
      // 换号失败：退掉授权态、落到手动输入，别让用户对着一个
      //「已通过微信授权」却提交不了的死界面
      if (err && err.code === 'PHONE_FAILED') {
        self.phoneVerified = false;
        self.setData({ phoneFrom: '', phoneShown: '' },
                      self.validate);
      }
      cloud.toast(err);
    });
  },

  goBack() {
    const b = this.back;
    if (b && b.type === 'tab') wx.switchTab({ url: b.url });
    else if (b && b.url) wx.redirectTo({ url: b.url });
    else wx.navigateBack({ fail: function () { wx.switchTab({ url: '/pages/tournament/index' }); } });
  },
});
