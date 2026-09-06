const C = require('../lib/collections');
const { ok, fail } = require('../lib/result');

module.exports = function (db) {
  async function list(ev) {
    const q = {};
    if (ev.status) q.status = ev.status;
    if (ev.city) q.city = ev.city;
    const ts = await db.where(C.TOURNAMENTS, q);
    return ok({ tournaments: ts });
  }

  /** 免鉴权落地页：不含任何手机号 */
  async function detail(ev) {
    const t = await db.get(C.TOURNAMENTS, ev.tournamentId);
    if (!t) return fail('NOT_FOUND', '赛事不存在');
    const events = await db.where(C.EVENTS, { tournamentId: t._id });
    const withCount = [];
    for (const e of events) {
      const confirmed = await db.count(C.ENTRIES, { eventId: e._id, status: 'confirmed' });
      const waiting = await db.count(C.ENTRIES, { eventId: e._id, status: 'waitlisted' });
      withCount.push(Object.assign({}, e, { confirmedCount: confirmed, waitlistCount: waiting }));
    }
    return ok({ tournament: t, events: withCount });
  }

  async function eventDetail(ev) {
    const e = await db.get(C.EVENTS, ev.eventId);
    if (!e) return fail('NOT_FOUND', '项目不存在');
    const confirmed = await db.count(C.ENTRIES, { eventId: e._id, status: 'confirmed' });
    const waiting = await db.count(C.ENTRIES, { eventId: e._id, status: 'waitlisted' });
    return ok({ event: Object.assign({}, e, { confirmedCount: confirmed, waitlistCount: waiting }) });
  }

  /** 已报名组合 —— 第一版不做积分，按报名先后排 */
  async function eventEntries(ev) {
    const list = await db.where(C.ENTRIES, { eventId: ev.eventId, status: 'confirmed' });
    list.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    const ids = list.reduce(function (r, e) { return r.concat(e.playerIds || []); }, []);
    const users = await db.getMany(C.USERS, ids);
    const nameOf = {};
    users.forEach(function (u) { if (u) nameOf[u._id] = u.nickname; });
    return ok({
      entries: list.map(function (e) {
        return { _id: e._id, createdAt: e.createdAt,
                 players: (e.playerIds || []).map(function (id) { return nameOf[id] || '选手'; }) };
      }),
    });
  }

  return { list, detail, eventDetail, eventEntries };
};
