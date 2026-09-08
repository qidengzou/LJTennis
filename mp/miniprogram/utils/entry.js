/**
 * 报名状态机 —— 纯函数，无副作用，可单测。
 * 对应 api/types.ts 的 EntryStatus 与 api/endpoints.md §04 的 accept 分支。
 */

/** 项目对性别的要求 */
function genderOk(eventType, genders) {
  const g = genders.slice().sort().join('');
  switch (eventType) {
    case 'MD': return g === 'MM';
    case 'WD': return g === 'FF';
    case 'XD': return g === 'FM';          // 一男一女，排序后固定是 FM
    case 'MS': return genders.length === 1 && genders[0] === 'M';
    case 'WS': return genders.length === 1 && genders[0] === 'F';
    default:   return false;
  }
}

/**
 * 搭档接受邀请后的名额判定。必须在事务内执行（并发接受不能超发）。
 * @returns {{ok:boolean, status?:string, reason?:string, waitlistPosition?:number}}
 */
function acceptResult(ctx) {
  if (!genderOk(ctx.eventType, ctx.genders)) {
    return { ok: false, reason: 'gender' };
  }
  // 免费赛事捷径：整段跳过支付，组合成立即确认
  if (!ctx.feeCents) {
    return { ok: true, status: 'confirmed' };
  }
  if (ctx.confirmedCount < ctx.capacity) {
    return { ok: true, status: 'pending_payment' };
  }
  return { ok: true, status: 'waitlisted', waitlistPosition: ctx.waitlistCount + 1 };
}

/** 状态 → 显示。颜色映射固定，不可临时改（design-system-v2 §01） */
function statusView(entry) {
  switch (entry.status) {
    case 'pending_partner':
      return { text: '待搭档确认', cls: 'chip-live', dot: true, action: '重新发送邀请', tone: 'secondary' };
    case 'pending_payment':
      return { text: '待支付', cls: 'chip-live', dot: true, action: '去支付', tone: 'wx' };
    case 'waitlisted':
      return { text: '候补 · 第 ' + (entry.waitlistPosition || 1) + ' 位', cls: 'chip-live', dot: false, action: null };
    case 'promoted':
      return { text: '候补转正', cls: 'chip-live', dot: true, action: '去支付', tone: 'wx' };
    case 'confirmed':
      return { text: '已确认', cls: 'chip-win', dot: false, action: null };
    case 'refunding':
      return { text: '退款中', cls: 'chip-live', dot: true, action: null };
    case 'refunded':
      return { text: '已退款', cls: 'chip-void', dot: false, action: null };
    case 'cancelled':
      return { text: '已取消', cls: 'chip-void', dot: false, action: null };
    default:
      return { text: entry.status, cls: '', dot: false, action: null };
  }
}

/** 需要我行动的排在前面；已结束的沉底 */
const SORT_WEIGHT = {
  pending_payment: 0, promoted: 0, pending_partner: 1,
  waitlisted: 2, confirmed: 3, refunding: 4, refunded: 5, cancelled: 5,
};
function sortEntries(list) {
  return list.slice().sort(function (a, b) {
    const wa = SORT_WEIGHT[a.status], wb = SORT_WEIGHT[b.status];
    if (wa !== wb) return wa - wb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * 退款金额。规则见 PRD.md §4「退款规则」：
 *   赛前 ≥7 天全额 · 3–7 天退 50% · <3 天不退 · 组织者取消全额
 */
function refundFor(feeCents, daysUntilStart, opt) {
  const o = opt || {};
  if (o.organizerCancelled) return { cents: feeCents, ratio: 1, label: '全额退款' };
  if (daysUntilStart >= 7) return { cents: feeCents, ratio: 1, label: '全额退款' };
  if (daysUntilStart >= 3) return { cents: Math.round(feeCents * 0.5), ratio: 0.5, label: '退 50%' };
  return { cents: 0, ratio: 0, label: '不予退款' };
}

/** 倒计时文案。超过 1 小时显示 H:MM:SS，否则 MM:SS */
function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = function (n) { return n < 10 ? '0' + n : String(n); };
  return h > 0 ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}

/** 不足 5 分钟转红 */
function isUrgent(ms) { return ms > 0 && ms < 5 * 60 * 1000; }

/**
 * 有名额释放时，下一个该转正的候补。
 * 按 waitlistPosition 升序取第一个仍在候补的。
 */
function nextToPromote(entries) {
  const w = entries.filter(function (e) { return e.status === 'waitlisted'; });
  w.sort(function (a, b) { return (a.waitlistPosition || 0) - (b.waitlistPosition || 0); });
  return w[0] || null;
}

/** 某人取消后，其后的候补统一前移一位 */
function reindexWaitlist(entries) {
  const w = entries.filter(function (e) { return e.status === 'waitlisted'; })
    .sort(function (a, b) { return (a.waitlistPosition || 0) - (b.waitlistPosition || 0); });
  w.forEach(function (e, i) { e.waitlistPosition = i + 1; });
  return entries;
}

module.exports = {
  genderOk, acceptResult, statusView, sortEntries,
  refundFor, formatCountdown, isUrgent, nextToPromote, reindexWaitlist,
};
