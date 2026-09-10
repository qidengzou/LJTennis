const C = require('../lib/collections');
const { ok, fail } = require('../lib/result');

/** 签表 · 赛程 · 记分。对应 api/endpoints.md「签表与赛程」「记分」 */
module.exports = function (db) {

  /**
   * GET /users/me/matches?scope=today —— 第一版最关键的接口。
   * 记分让出了 tab 位，比赛日能否压回 2 tap 全靠赛事 tab 首页的今日比赛区。
   * 必须快：只返回渲染卡片必需的字段，不带完整 Match。
   */
  async function today(ev, ctx) {
    const mine = await db.where(C.ENTRIES, { playerIds: ctx.userId, status: 'confirmed' });
    const entryIds = mine.map(function (e) { return e._id; });
    if (!entryIds.length) return ok({ live: null, upcoming: [] });

    const all = await db.whereIn(C.MATCHES, 'entryAId', entryIds, 'entryBId');
    const day = new Date().toISOString().slice(0, 10);
    const todays = all.filter(function (m) {
      return m.status !== 'confirmed' && (!m.scheduledAt || String(m.scheduledAt).slice(0, 10) === day);
    });

    const live = todays.filter(function (m) { return m.status === 'live'; })[0] || null;
    const upcoming = todays
      .filter(function (m) { return m.status === 'pending'; })
      .sort(function (a, b) { return String(a.scheduledAt).localeCompare(String(b.scheduledAt)); });

    return ok({ live: live ? slim(live) : null, upcoming: upcoming.map(slim) });
  }

  async function draw(ev) {
    const eventId = ev.eventId;
    const event = await db.get(C.EVENTS, eventId);
    if (!event) return fail('NOT_FOUND', '项目不存在');
    // 云函数内一次聚合返回，不让小程序端多次查询拼装
    const matches = await db.where(C.MATCHES, { eventId: eventId });
    const groups = await db.where(C.GROUPS, { eventId: eventId });
    const entryIds = {};
    matches.forEach(function (m) {
      if (m.entryAId) entryIds[m.entryAId] = 1;
      if (m.entryBId) entryIds[m.entryBId] = 1;
    });
    groups.forEach(function (g) { (g.entryIds || []).forEach(function (id) { entryIds[id] = 1; }); });
    const entries = await db.getMany(C.ENTRIES, Object.keys(entryIds));
    const users = await db.getMany(C.USERS, flatten(entries.map(function (e) { return e.playerIds; })));
    const nameOf = {};
    users.forEach(function (u) { if (u) nameOf[u._id] = u.nickname; });

    return ok({
      event: event,
      groups: groups,
      matches: matches,
      entries: entries.map(function (e) {
        return { _id: e._id, players: (e.playerIds || []).map(function (id) { return nameOf[id] || '选手'; }) };
      }),
    });
  }

  /**
   * 他在这场的哪一边：0 = A、1 = B、**-1 = 根本不是这场的人**。
   *
   * 记分、确认、提异议**一律先过这一关**。原来一个都没查 ——
   * `lib/gate.js` 只拦「未注册」，于是任何注册用户都能给任意一场报比分、
   * 替别人确认、冻结任意一场比赛。
   *
   * ⚠️ 这是**选手侧**的判据。管理员记分 / 改比分（`PRD.md` §6）是另一条路，
   * 做的时候要单独放行，别把这里改松。
   */
  async function sideOf(m, userId) {
    if (!userId) return -1;
    const a = m.entryAId ? await db.get(C.ENTRIES, m.entryAId) : null;
    if (a && (a.playerIds || []).indexOf(userId) >= 0) return 0;
    const b = m.entryBId ? await db.get(C.ENTRIES, m.entryBId) : null;
    if (b && (b.playerIds || []).indexOf(userId) >= 0) return 1;
    return -1;
  }

  async function start(ev, ctx) {
    const m = await db.get(C.MATCHES, ev.matchId);
    if (!m) return fail('NOT_FOUND', '场次不存在');
    if (m.status === 'confirmed') return fail('BAD_STATE', '这场已经确认过了');
    if ((await sideOf(m, ctx.userId)) < 0) return fail('FORBIDDEN', '只有这场的选手能开始记分');
    await db.update(C.MATCHES, ev.matchId, {
      status: 'live',
      scorerId: ctx.userId,
      score: { sets: [], serveOrder: ev.serveOrder || [] },
      version: (m.version || 0) + 1,
    });
    return ok();
  }

  /**
   * POST /matches/:id/score —— 幂等 + 乐观锁。
   * 球场信号差，客户端会离线累积后重传。
   */
  async function score(ev, ctx) {
    const m = await db.get(C.MATCHES, ev.matchId);
    if (!m) return fail('NOT_FOUND', '场次不存在');
    if (m.status === 'confirmed') return fail('BAD_STATE', '这场已经确认过了');
    // 记分方定下了就只认他 —— 队友也不行，两个人同时记会互相覆盖。
    // 还没定（没走 start 直接报分）则至少得是这场的人。
    if (m.scorerId) {
      if (m.scorerId !== ctx.userId) return fail('FORBIDDEN', '这场由对方记分');
    } else if ((await sideOf(m, ctx.userId)) < 0) {
      return fail('FORBIDDEN', '只有这场的选手能记分');
    }

    const cur = m.version || 0;
    if (typeof ev.version === 'number' && ev.version !== cur) {
      // 版本不匹配：可能是重放，也可能是真冲突
      if (JSON.stringify(m.score) === JSON.stringify(ev.score)) {
        return ok({ version: cur, replayed: true });        // 幂等重放
      }
      return fail('CONFLICT', '这场比分已被更新，请先同步', { current: m });
    }

    const next = cur + 1;
    await db.update(C.MATCHES, ev.matchId, {
      score: ev.score,
      winnerEntryId: ev.winnerEntryId || null,
      status: ev.finished ? 'pending_confirm' : 'live',
      scorerId: m.scorerId || ctx.userId,
      version: next,
    });
    return ok({ version: next });
  }

  /** 确认后签表推进：把胜者填进下游场次 */
  async function confirm(ev, ctx) {
    const m = await db.get(C.MATCHES, ev.matchId);
    if (!m) return fail('NOT_FOUND', '场次不存在');
    if (m.status !== 'pending_confirm') return fail('BAD_STATE', '这场不在待确认状态');
    if (m.scorerId === ctx.userId) return fail('FORBIDDEN', '记分方不能自己确认');
    // 「确认人必须是**对方**组合中的任一人」（api/types.ts 的 confirmedById）。
    // 只查「不是记分方」远远不够：那样场外任何注册用户都能替人确认，
    // 队友也能 —— 而队友确认自己这边记的分，等于没有确认这一步。
    const mine = await sideOf(m, ctx.userId);
    if (mine < 0) return fail('FORBIDDEN', '只有这场的选手能确认');
    const theirs = await sideOf(m, m.scorerId);
    if (theirs >= 0 && mine === theirs) return fail('FORBIDDEN', '要由对方确认');

    await db.update(C.MATCHES, ev.matchId, {
      status: 'confirmed', confirmedById: ctx.userId, confirmedAt: Date.now(),
      version: (m.version || 0) + 1,
    });
    const advanced = await advance(db, m);
    return ok({ advancedTo: advanced });
  }

  async function dispute(ev, ctx) {
    const m = await db.get(C.MATCHES, ev.matchId);
    if (!m) return fail('NOT_FOUND', '场次不存在');
    // 异议是**确认之前**的岔路（PRD.md §6 那张流程图）。已确认的场次胜者
    // 早就 advance 进下游了，这时候再冻结，签表上就会出现「从一场有争议的
    // 比赛里晋级」—— 而没有任何东西会把下游退回去。改判要走管理员改比分。
    if (m.status !== 'live' && m.status !== 'pending_confirm') {
      return fail('BAD_STATE', '这场不在可提异议的状态');
    }
    if ((await sideOf(m, ctx.userId)) < 0) return fail('FORBIDDEN', '只有这场的选手能提异议');
    await db.update(C.MATCHES, ev.matchId, {
      status: 'disputed', disputeReason: ev.reason || '', version: (m.version || 0) + 1,
    });
    return ok();
  }

  return { today, draw, start, score, confirm, dispute };
};

/** 把胜者写进下游场次的空位 */
async function advance(db, m) {
  if (!m.winnerEntryId) return null;
  const downstream = await db.where(C.MATCHES, { eventId: m.eventId });
  const target = downstream.filter(function (d) {
    return d.sourceMatchAId === m._id || d.sourceMatchBId === m._id;
  })[0];
  if (!target) return null;
  const patch = target.sourceMatchAId === m._id
    ? { entryAId: m.winnerEntryId } : { entryBId: m.winnerEntryId };
  await db.update(C.MATCHES, target._id, patch);
  return target._id;
}

function slim(m) {
  return {
    _id: m._id, eventId: m.eventId, matchNo: m.matchNo, roundOf: m.roundOf,
    entryAId: m.entryAId, entryBId: m.entryBId,
    scheduledAt: m.scheduledAt, court: m.court, status: m.status,
    score: m.score || null, version: m.version || 0,
  };
}
function flatten(a) { return a.reduce(function (r, x) { return r.concat(x || []); }, []); }

module.exports.advance = advance;
