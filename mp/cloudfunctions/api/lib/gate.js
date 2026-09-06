/**
 * 鉴权闸门。云开发天然带 openid，所以「鉴权」退化为一次业务查询：
 * users 里有没有这个 openid。
 *
 * 抽出来是因为 index.js 顶层 require('wx-server-sdk') 没法单测，
 * 而这里的判断恰恰是最容易出错、又最致命的一段
 * —— 把 user.register 漏在名单外，注册就永远返回 NOT_REGISTERED。
 */

/** 免鉴权：分享落地页 + 注册链路本身。登录墙在「报名 / 接受邀请」那一步 */
const PUBLIC = [
  'tournament.list', 'tournament.detail', 'event.detail', 'event.entries',
  'entry.detail',
  'user.me',        // 要靠它判断「是否已注册」
  'user.phone',     // 注册前就要调
  'user.register',  // 注册本身当然不能要求已注册
];

/** 全新环境的引导：一个用户都没有时才放行，建完库这个口子自动关上 */
const BOOTSTRAP = ['admin.initDb'];

/** 云开发查不存在的集合会抛，这在全新环境属正常，不该当成故障 */
function isMissingCollection(e) {
  if (!e) return false;
  if (e.errCode === -502005) return true;
  return /collection not exists|DATABASE_COLLECTION_NOT_EXIST/i.test(e.message || '');
}

module.exports = function (db) {
  async function tolerant(fn, fallback) {
    try { return await fn(); }
    catch (e) { if (isMissingCollection(e)) return fallback; throw e; }
  }

  /**
   * @returns {{allow:true, user:object|null}} 或 {{allow:false, code, msg}}
   */
  async function gate(action, openid) {
    if (PUBLIC.indexOf(action) >= 0) return { allow: true, user: null };

    const me = await tolerant(() => db.first('users', { openid: openid }), null);
    if (me) return { allow: true, user: me };

    if (BOOTSTRAP.indexOf(action) >= 0) {
      const n = await tolerant(() => db.count('users', {}), 0);
      if (n === 0) return { allow: true, user: null };
    }
    return { allow: false, code: 'NOT_REGISTERED', msg: '需要先注册' };
  }

  return { gate, PUBLIC, BOOTSTRAP };
};
