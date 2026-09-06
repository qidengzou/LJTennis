/**
 * 令牌的 JS 镜像。
 *
 * ⚠️ canvas 读不到 CSS 变量，所以画布上的颜色只能在 JS 里写。
 * 这是 styles/tokens.wxss 的副本 —— **改令牌时必须同步改这里**。
 * 除 canvas 外的任何地方都不要用它，一律走 CSS 变量。
 */

const LIGHT = {
  ground: '#F4F5F7', surface: '#FFFFFF', surface2: '#EBEDF2',
  ink: '#141821', ink2: '#4C5567', ink3: '#7B8496', line: '#DFE2E9',
  brand: '#2E4FD8', brandWeak: '#E7EBFC',
  win: '#0E9F6E', loss: '#E0294B', live: '#F5A524',
};

const DARK = {
  ground: '#0E1116', surface: '#161A21', surface2: '#1F242D',
  ink: '#E7EAF0', ink2: '#A3ACBD', ink3: '#6F7889', line: '#252B35',
  brand: '#7A93F5', brandWeak: '#1A2140',
  win: '#2FBF88', loss: '#FF5C77', live: '#FFB84D',
};

/** 当前主题的调色板。跟随系统深色模式 */
function current() {
  let theme = 'light';
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    theme = info.theme || 'light';
  } catch (e) { /* 取不到就按浅色 */ }
  return theme === 'dark' ? DARK : LIGHT;
}

module.exports = { LIGHT, DARK, current };
