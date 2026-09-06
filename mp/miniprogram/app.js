// app.js
const { cloudEnv } = require('./config/env');

App({
  globalData: {
    cloudReady: false,
    /** 跨页传参用（wx.switchTab 带不了 query，见 api/endpoints.md） */
    activeMatch: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[LJTennis] 需要基础库 2.2.3 以上才能使用云能力');
      return;
    }
    if (!cloudEnv) {
      console.warn('[LJTennis] 未配置云环境 ID，当前跑在本地假数据模式。见 config/env.js');
      return;
    }
    wx.cloud.init({ env: cloudEnv, traceUser: true });
    this.globalData.cloudReady = true;
  },
});
