/**
 * 本地存储。三个用途（见 api/cloudbase-notes.md）：
 *   1. 跨页/跨 tab 传参 —— wx.switchTab 带不了 query
 *   2. 断网续记 —— 球场信号差，每一分都要落地
 *   3. 杀进程恢复 —— 记分中被打断后能接着记
 */

const ACTIVE_KEY = 'lj:activeMatch';
const stateKey = function (id) { return 'lj:match:' + id; };

/** 记录「当前正在进行的比赛」，赛事 tab 首页据此置顶今日比赛区 */
function setActiveMatch(meta) {
  try { wx.setStorageSync(ACTIVE_KEY, meta); } catch (e) { console.error('[store] setActiveMatch', e); }
}
function getActiveMatch() {
  try { return wx.getStorageSync(ACTIVE_KEY) || null; } catch (e) { return null; }
}
function clearActiveMatch() {
  try { wx.removeStorageSync(ACTIVE_KEY); } catch (e) { /* noop */ }
}

/** 每记一分都调用。同步写，别用异步 —— 异步写在杀进程时可能丢 */
function saveMatchState(id, payload) {
  try {
    wx.setStorageSync(stateKey(id), { ...payload, savedAt: Date.now(), synced: false });
  } catch (e) {
    console.error('[store] saveMatchState', e);
  }
}
function loadMatchState(id) {
  try { return wx.getStorageSync(stateKey(id)) || null; } catch (e) { return null; }
}
function clearMatchState(id) {
  try { wx.removeStorageSync(stateKey(id)); } catch (e) { /* noop */ }
}

/* ---- 注册回跳目标 ---- */
const REG_KEY = 'lj:registerReturn';

/**
 * 记下「注册完成后回哪里」。
 * @param {{type:'tab'|'navigate', url:string, ctx?:{title:string, sub:string}}} target
 */
function setRegisterReturn(target) {
  try { wx.setStorageSync(REG_KEY, target); } catch (e) { console.error('[store] setRegisterReturn', e); }
}
function getRegisterReturn() {
  try { return wx.getStorageSync(REG_KEY) || null; } catch (e) { return null; }
}
function clearRegisterReturn() {
  try { wx.removeStorageSync(REG_KEY); } catch (e) { /* noop */ }
}

/** 列出所有未同步的比赛，联网后批量上传用 */
function listUnsynced() {
  try {
    const { keys } = wx.getStorageInfoSync();
    return keys
      .filter(function (k) { return k.indexOf('lj:match:') === 0; })
      .map(function (k) { return wx.getStorageSync(k); })
      .filter(function (v) { return v && v.synced === false; });
  } catch (e) {
    return [];
  }
}

module.exports = {
  setActiveMatch, getActiveMatch, clearActiveMatch,
  saveMatchState, loadMatchState, clearMatchState, listUnsynced,
  setRegisterReturn, getRegisterReturn, clearRegisterReturn,
};
