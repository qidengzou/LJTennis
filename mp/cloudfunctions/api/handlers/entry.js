const C = require('../lib/collections');
const { ok, fail } = require('../lib/result');
const E = require('../shared/entry');

/**
 * 报名相关。db 由外部注入，方便用内存 db 做单测。
 * 对应 api/endpoints.md「报名」一节。
 */
module.exports = function (db, _) {

  /** POST /entries —— 发起报名，进入 pending_partner */
  async function create(ev, ctx) {
    const { eventId, partnerId } = ev;
    if (!eventId) return fail('BAD_ARGS', '缺少 eventId');
    const event = await db.get(C.EVENTS, eventId);
    if (!event) return fail('NOT_FOUND', '项目不存在');

    const now = Date.now();
    const entry = {
      eventId: eventId,
      playerIds: [ctx.userId].concat(partnerId ? [partnerId] : []),
      initiatorId: ctx.userId,
      status: 'pending_partner',
      partnerDeadlineAt: now + 24 * 3600 * 1000,   // 等待态①
      createdAt: now,
    };
    const id = await db.add(C.ENTRIES, entry);
    return ok({ entryId: id, entry: Object.assign({ _id: id }, entry) });
  }

  /**
   * POST /entries/:id/accept —— 搭档接受，触发名额判定。
   * **必须在事务内**：计数 → 分配名额或候补位 → 写状态，并发接受不能超发。
   */
  async function accept(ev, ctx) {
    const entryId = ev.entryId;
    return db.transaction(async function (tx) {
      const entry = await tx.get(C.ENTRIES, entryId);
      if (!entry) return fail('NOT_FOUND', '报名不存在');
      if (entry.status !== 'pending_partner') return fail('BAD_STATE', '这条邀请已经处理过了');
      if (entry.partnerDeadlineAt && entry.partnerDeadlineAt < Date.now()) {
        return fail('EXPIRED', '邀请已超时作废');
      }

      const event = await tx.get(C.EVENTS, entry.eventId);
      const initiator = await tx.get(C.USERS, entry.initiatorId);
      const partner = await tx.get(C.USERS, ctx.userId);
      if (!event || !initiator || !partner) return fail('NOT_FOUND', '数据缺失');

      // 占正式名额的两个状态都要数。只数 confirmed 会超发 —— 待编排的那批
      // 已经付了钱、占着名额，漏掉它们等于把同一个名额卖两次。
      const occupiedCount =
          await tx.count(C.ENTRIES, { eventId: entry.eventId, status: 'confirmed' })
        + await tx.count(C.ENTRIES, { eventId: entry.eventId, status: 'seeking_partner' });
      const waitlistCount = await tx.count(C.ENTRIES, { eventId: entry.eventId, status: 'waitlisted' });

      // 与小程序端同一份逻辑（shared/entry.js）
      const r = E.acceptResult({
        eventType: event.type,
        genders: [initiator.gender, partner.gender],
        feeCents: event.feeCents,
        capacity: event.capacity,
        occupiedCount: occupiedCount,
        waitlistCount: waitlistCount,
      });
      if (!r.ok) return fail('GENDER', '这个项目对性别有要求，你和发起人不符合');

      const now = Date.now();
      const patch = {
        playerIds: [entry.initiatorId, ctx.userId],
        status: r.status,
        partnerRespondedAt: now,
        partnerDeadlineAt: null,
      };
      if (r.status === 'pending_payment') patch.paymentDeadlineAt = now + 15 * 60 * 1000;  // 等待态②
      if (r.status === 'waitlisted') patch.waitlistPosition = r.waitlistPosition;
      if (r.status === 'confirmed') patch.paidAt = now;                                     // 免费捷径

      await tx.update(C.ENTRIES, entryId, patch);
      return ok({ status: r.status, waitlistPosition: r.waitlistPosition || null });
    });
  }

  async function reject(ev) {
    const entry = await db.get(C.ENTRIES, ev.entryId);
    if (!entry) return fail('NOT_FOUND', '报名不存在');
    if (entry.status !== 'pending_partner') return fail('BAD_STATE', '这条邀请已经处理过了');
    await db.update(C.ENTRIES, ev.entryId, { status: 'cancelled', cancelledAt: Date.now() });
    return ok();
  }

  async function detail(ev) {
    const entry = await db.get(C.ENTRIES, ev.entryId);
    if (!entry) return fail('NOT_FOUND', '报名不存在');
    const event = await db.get(C.EVENTS, entry.eventId);
    const users = await db.getMany(C.USERS, entry.playerIds);
    // 免鉴权落地页：返回体不得含手机号
    return ok({
      entry: entry,
      event: event,
      players: users.map(publicUser),
    });
  }

  async function mine(ev, ctx) {
    const list = await db.where(C.ENTRIES, { playerIds: ctx.userId });
    return ok({ entries: E.sortEntries(list) });
  }

  /** 取消已确认的报名 → 退款 + 释放名额 + 触发候补转正 */
  async function cancel(ev, ctx) {
    const entry = await db.get(C.ENTRIES, ev.entryId);
    if (!entry) return fail('NOT_FOUND', '报名不存在');
    if (entry.initiatorId !== ctx.userId) return fail('FORBIDDEN', '只有发起人能取消');

    const event = await db.get(C.EVENTS, entry.eventId);
    const tour = await db.get(C.TOURNAMENTS, event.tournamentId);
    const days = (new Date(tour.startDate).getTime() - Date.now()) / 86400000;
    const refund = E.refundFor(event.feeCents, days);

    await db.update(C.ENTRIES, ev.entryId, {
      status: refund.cents > 0 ? 'refunding' : 'cancelled',
      cancelledAt: Date.now(),
    });
    await releaseSlot(db, entry.eventId);
    return ok({ refund: refund });
  }

  return { create, accept, reject, detail, mine, cancel };
};

/**
 * 有名额释放时把下一位候补转正，并重排候补位次。
 *
 * 候补是**先收过款**的（PRD §4），所以转正**立刻生效** —— 不通知本人、
 * 不等他付款、没有 24h 倒计时。曾经这里写 `status:'promoted'` 加一个
 * promotionDeadlineAt，那一整套（状态 + 定时任务 + 顺延）随先收款一起删了。
 *
 * 转正后落到哪个状态看人数：双打一个人 → 待编排，凑齐两人或单打 → 已确认。
 */
async function releaseSlot(db, eventId) {
  const waitlisted = await db.where(C.ENTRIES, { eventId: eventId, status: 'waitlisted' });
  const next = E.nextToPromote(waitlisted);
  if (!next) return null;
  const players = next.playerIds || [];
  await db.update(C.ENTRIES, next._id, {
    status: players.length >= 2 ? 'confirmed' : 'seeking_partner',
    promotedAt: Date.now(),
    waitlistPosition: null,
  });
  const rest = waitlisted.filter(function (e) { return e._id !== next._id; });
  E.reindexWaitlist(rest);
  for (const e of rest) await db.update(C.ENTRIES, e._id, { waitlistPosition: e.waitlistPosition });
  return next._id;
}

function publicUser(u) {
  if (!u) return null;
  return { _id: u._id, nickname: u.nickname, gender: u.gender, city: u.city, avatarColorIndex: u.avatarColorIndex };
}

module.exports.releaseSlot = releaseSlot;
module.exports.publicUser = publicUser;
