const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const { ok, fail } = require('./lib/result');
const makeDb = require('./lib/wxdb');
const makeOpenApi = require('./lib/wxopen');

const db = makeDb(cloud.database(), cloud.database().command);
const openapi = makeOpenApi(cloud);
const H = {
  user:       require('./handlers/user')(db, openapi),
  tournament: require('./handlers/tournament')(db),
  entry:      require('./handlers/entry')(db, cloud.database().command),
  match:      require('./handlers/match')(db),
  admin:      require('./handlers/admin')(db, cloud.database()),
};

/** action → handler。命名与 api/endpoints.md 对齐 */
const ROUTES = {
  'user.me':            H.user.me,
  'user.phone':         H.user.verifyPhone,
  'user.register':      H.user.register,
  'user.update':        H.user.update,
  'user.detail':        H.user.detail,
  'user.partners':      H.user.partners,

  'tournament.list':    H.tournament.list,
  'tournament.detail':  H.tournament.detail,
  'event.detail':       H.tournament.eventDetail,
  'event.entries':      H.tournament.eventEntries,

  'entry.create':       H.entry.create,
  'entry.detail':       H.entry.detail,
  'entry.accept':       H.entry.accept,
  'entry.reject':       H.entry.reject,
  'entry.mine':         H.entry.mine,
  'entry.cancel':       H.entry.cancel,

  'match.today':        H.match.today,
  'match.draw':         H.match.draw,
  'match.start':        H.match.start,
  'match.release':      H.match.release,
  'match.score':        H.match.score,
  'match.confirm':      H.match.confirm,
  'match.dispute':      H.match.dispute,

  'admin.initDb':       H.admin.initDb,
  'admin.import':       H.admin.importDocs,
};

/** 这些 action 允许未注册用户调用 —— 分享落地页，登录墙在「报名/接受邀请」那一步 */
const { gate } = require('./lib/gate')(db);

exports.main = async (event, context) => {
  const action = event.action;
  const fn = ROUTES[action];
  if (!fn) return fail('NO_ROUTE', '未知 action: ' + action);

  const wx = cloud.getWXContext();
  const ctx = { openid: wx.OPENID, unionid: wx.UNIONID, appid: wx.APPID, userId: null };

  try {
    const g = await gate(action, ctx.openid);
    if (!g.allow) return fail(g.code, g.msg);
    if (g.user) { ctx.userId = g.user._id; ctx.user = g.user; }
  } catch (e) {
    console.error('[api] gate ' + action, e);
    return fail('INTERNAL', e && e.message ? e.message : '鉴权失败');
  }

  try {
    return await fn(event, ctx);
  } catch (e) {
    console.error('[api] ' + action, e);
    return fail('INTERNAL', e && e.message ? e.message : '服务异常');
  }
};
