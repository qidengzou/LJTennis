/**
 * 云开发环境配置
 *
 * 真实的环境 ID 不进版本库 —— 放在同目录的 env.local.js 里（已 gitignore）。
 * 首次克隆后复制一份：
 *
 *   cp config/env.local.example.js config/env.local.js
 *
 * 然后填入你自己的环境 ID（微信开发者工具 → 云开发 → 环境设置 → 环境 ID）。
 * 没有 env.local.js 时自动走本地假数据，小程序照样能完整跑通。
 */
let local = {};
try { local = require('./env.local.js'); } catch (e) { /* 没配就走假数据 */ }

module.exports = {
  cloudEnv: local.cloudEnv || '',
  // 有环境 ID 时默认仍走假数据，要连真链路把这里改成 false
  useMock: local.useMock !== undefined ? local.useMock : true,
};
