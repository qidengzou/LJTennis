/**
 * 云函数调用封装。
 *
 * 关键设计：**云环境没配好时自动降级到本地假数据**，
 * 这样小程序在没有云环境的机器上也能完整跑通，方便设计走查和真机验证。
 */
const { cloudEnv, useMock } = require('../config/env');

const MOCK_OFF = !cloudEnv || useMock;

/** action → 本地假数据。与 cloudfunctions/api/index.js 的 ROUTES 一一对应 */
function mockFor(action, payload) {
  const entries = require('../mock/entries');
  const draw = require('../mock/draw');
  const data = require('../mock/data');

  switch (action) {
    case 'user.me': {
      // 假数据模式下也能走一遍注册：清掉 lj:mockUser 就回到未注册态
      let u = null;
      try { u = wx.getStorageSync('lj:mockUser') || null; } catch (e) { /* noop */ }
      if (!u) return { registered: false, user: null };
      return { registered: true, user: u };
    }
    case 'user.phone':
      return { phoneMasked: '185****9029' };
    case 'user.register': {
      const u = {
        _id: 'u1',
        nickname: payload.nickname,
        gender: payload.gender,
        selfRatedLevel: payload.level || null,
        phoneMasked: payload.phone ? ('138****' + String(payload.phone).slice(-4)) : null,
        avatarUrl: null,
      };
      try { wx.setStorageSync('lj:mockUser', u); } catch (e) { /* noop */ }
      return { user: u };
    }
    case 'user.update': {
      let u = {};
      try { u = wx.getStorageSync('lj:mockUser') || {}; } catch (e) { /* noop */ }
      const next = Object.assign({}, u, payload);
      try { wx.setStorageSync('lj:mockUser', next); } catch (e) { /* noop */ }
      return { user: next };
    }
    case 'user.partners':     return { partners: entries.partners };
    case 'tournament.list':   return { tournaments: data.tournaments };
    case 'tournament.detail': return { tournament: entries.tournament, events: entries.tournament.events };
    case 'event.detail':
      return { event: entries.tournament.events.filter(function (e) { return e.id === payload.eventId; })[0]
                      || entries.tournament.events[0] };
    case 'event.entries':     return { entries: entries.eventEntries[payload.eventId] || [] };
    case 'entry.mine':        return { entries: entries.myEntries };
    case 'entry.detail':      return { entry: entries.incomingInvite };
    case 'match.today':       return { live: null, upcoming: [data.todayMatch] };
    case 'match.draw':
      return payload && payload.format === 'group' ? draw.group : draw.knockout;
    default:
      return null;
  }
}

/**
 * 调用云函数。
 * @param {string} action 见 api/endpoints.md
 * @param {object} payload
 * @returns {Promise<object>} 直接返回 data；失败抛出 {code, msg}
 */
function call(action, payload) {
  if (MOCK_OFF) {
    const d = mockFor(action, payload || {});
    if (d === null) {
      return Promise.reject({ code: 'MOCK_MISS', msg: '本地假数据没有覆盖 ' + action });
    }
    // 模拟一点网络延迟，让加载态能被看到
    return new Promise(function (res) { setTimeout(function () { res(d); }, 120); });
  }

  return wx.cloud
    .callFunction({ name: 'api', data: Object.assign({ action: action }, payload || {}) })
    .then(function (r) {
      const out = r.result || {};
      if (out.ok) return out.data;
      return Promise.reject(out);
    })
    .catch(function (e) {
      if (e && e.code) return Promise.reject(e);
      console.error('[cloud] ' + action, e);
      return Promise.reject({ code: 'NETWORK', msg: '网络不太好，稍后再试' });
    });
}

/** 统一的错误提示。业务错误说人话，网络错误给重试 */
function toast(err) {
  const msg = (err && err.msg) || '出了点问题';
  wx.showToast({ title: msg, icon: 'none', duration: 2200 });
}

module.exports = { call, toast, isMock: MOCK_OFF };
