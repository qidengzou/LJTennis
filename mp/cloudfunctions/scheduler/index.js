const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 定时任务。**5 个 job 合并成一个每分钟扫描的函数**，不拆成 5 个触发器。
 *
 * 原因见 api/cloudbase-notes.md：顺序很重要 ——
 * expire_payment 释放名额后必须紧接着触发候补转正，
 * 拆成独立触发器会出现空窗，而且云函数定时触发器有数量和并发限制。
 */
exports.main = async () => {
  const now = Date.now();
  const report = { partnerExpired: 0, paymentExpired: 0, promotionExpired: 0, promoted: 0, eventsClosed: 0 };

  // ① 搭档邀请超时 → 作废
  report.partnerExpired = await expire('pending_partner', 'partnerDeadlineAt', now);

  // ② 支付超时 → 作废并释放名额（顺序在候补转正之前）
  const paymentDead = await find({ status: 'pending_payment', paymentDeadlineAt: _.lt(now) });
  for (const e of paymentDead) {
    await db.collection('entries').doc(e._id).update({ data: { status: 'cancelled', cancelledAt: now } });
    report.paymentExpired++;
    if (await promoteNext(e.eventId, now)) report.promoted++;
  }

  // ③ 候补转正 24h 未付 → 作废并顺延下一位（业余赛退赛率高，这条会频繁触发）
  const promoDead = await find({ status: 'promoted', promotionDeadlineAt: _.lt(now) });
  for (const e of promoDead) {
    await db.collection('entries').doc(e._id).update({ data: { status: 'cancelled', cancelledAt: now } });
    report.promotionExpired++;
    if (await promoteNext(e.eventId, now)) report.promoted++;
  }

  // ④ 报名截止 → 关闭项目
  const closing = await db.collection('tournaments')
    .where({ status: 'open', registrationDeadline: _.lt(new Date(now).toISOString()) })
    .limit(100).get();
  for (const t of closing.data) {
    await db.collection('tournaments').doc(t._id).update({ data: { status: 'closed' } });
    const evs = await db.collection('events').where({ tournamentId: t._id }).limit(100).get();
    for (const ev of evs.data) {
      await db.collection('events').doc(ev._id).update({ data: { status: 'closed' } });
      report.eventsClosed++;
    }
  }

  // ⑤ 赛前提醒 —— 订阅消息（云调用不需要管 access_token）
  // TODO 接入 cloud.openapi.subscribeMessage.send

  console.log('[scheduler]', JSON.stringify(report));
  return report;
};

async function find(q) {
  const r = await db.collection('entries').where(q).limit(100).get();
  return r.data;
}

async function expire(status, field, now) {
  const list = await find({ status: status, [field]: _.lt(now) });
  for (const e of list) {
    await db.collection('entries').doc(e._id).update({ data: { status: 'cancelled', cancelledAt: now } });
  }
  return list.length;
}

/** 有名额释放 → 下一位候补转正 + 其余前移一位 */
async function promoteNext(eventId, now) {
  const r = await db.collection('entries')
    .where({ eventId: eventId, status: 'waitlisted' })
    .orderBy('waitlistPosition', 'asc').limit(100).get();
  const list = r.data;
  if (!list.length) return false;

  const next = list[0];
  await db.collection('entries').doc(next._id).update({
    data: { status: 'promoted', promotedAt: now, promotionDeadlineAt: now + 24 * 3600 * 1000, waitlistPosition: null },
  });
  for (let i = 1; i < list.length; i++) {
    await db.collection('entries').doc(list[i]._id).update({ data: { waitlistPosition: i } });
  }
  return true;
}
