const E = require('../miniprogram/utils/entry');
let pass = 0, fail = 0;
const eq = (a, e, n) => {
  const A = JSON.stringify(a), X = JSON.stringify(e);
  A === X ? (pass++, console.log('  ✓ ' + n))
          : (fail++, console.log('  ✗ ' + n + '\n      期望 ' + X + '\n      实际 ' + A));
};

console.log('\n[1] 性别校验');
eq(E.genderOk('MD', ['M', 'M']), true,  '男双 = 两男');
eq(E.genderOk('MD', ['M', 'F']), false, '男双拒绝混合');
eq(E.genderOk('WD', ['F', 'F']), true,  '女双 = 两女');
eq(E.genderOk('XD', ['M', 'F']), true,  '混双 = 一男一女');
eq(E.genderOk('XD', ['F', 'M']), true,  '混双与顺序无关');
eq(E.genderOk('XD', ['M', 'M']), false, '混双拒绝两男');
eq(E.genderOk('MS', ['M']),      true,  '男单');

console.log('\n[2] accept 名额判定');
const base = { eventType: 'MD', genders: ['M', 'M'], feeCents: 20000, capacity: 32, occupiedCount: 24, waitlistCount: 0 };
eq(E.acceptResult(base), { ok: true, status: 'pending_payment' }, '有名额 → 待支付');
eq(E.acceptResult({ ...base, occupiedCount: 32 }),
   { ok: true, status: 'waitlisted', waitlistPosition: 1 }, '满员 → 候补第 1 位');
eq(E.acceptResult({ ...base, occupiedCount: 32, waitlistCount: 3 }),
   { ok: true, status: 'waitlisted', waitlistPosition: 4 }, '已有 3 位候补 → 排第 4');
eq(E.acceptResult({ ...base, feeCents: 0 }),
   { ok: true, status: 'confirmed' }, '免费赛事 → 直接确认（跳过支付）');
eq(E.acceptResult({ ...base, feeCents: 0, occupiedCount: 32 }),
   { ok: true, status: 'confirmed' }, '免费捷径优先于名额判定');
eq(E.acceptResult({ ...base, genders: ['M', 'F'] }),
   { ok: false, reason: 'gender' }, '性别不符 → 拒绝，且先于其他判定');

console.log('\n[3] 边界：恰好最后一个名额');
eq(E.acceptResult({ ...base, occupiedCount: 31 }).status, 'pending_payment', '31/32 还能进');
eq(E.acceptResult({ ...base, occupiedCount: 32 }).status, 'waitlisted', '32/32 进候补');

// ── SPEC §5.2 超发 ──────────────────────────────────────────────
// 曾经这里只数 confirmed。16 队的比赛已确认 12 队、待编排 4 队时，
// 名额其实已经满了，但只数 confirmed 会看成 12/16 还有空位 —— 超发。
console.log('\n[3b] 超发：待编排也占名额');
const cap16 = { ...base, capacity: 16 };
eq(E.acceptResult({ ...cap16, occupiedCount: 12 + 4 }).status, 'waitlisted',
   '已确认 12 + 待编排 4 = 16 → 满了，进候补');
eq(E.acceptResult({ ...cap16, occupiedCount: 12 }).status, 'pending_payment',
   '只有已确认 12（无待编排）→ 还有名额');
eq(E.acceptResult({ ...cap16, occupiedCount: 16 }).status, 'waitlisted',
   '16 条全是待编排、一条 confirmed 都没有 → 照样满员');
eq(E.acceptResult({ ...cap16, occupiedCount: 15, waitlistCount: 99 }).status, 'pending_payment',
   '候补 99 人不占正式名额，第 16 个仍进正式');

console.log('\n[4] 状态显示映射');
eq(E.statusView({ status: 'pending_payment' }).cls, 'chip-live', '待支付 = 橙');
eq(E.statusView({ status: 'confirmed' }).cls,       'chip-win',  '已确认 = 绿');
eq(E.statusView({ status: 'refunded' }).cls,        'chip-void', '已退款 = 灰');
eq(E.statusView({ status: 'waitlisted', waitlistPosition: 4 }).text, '候补 · 第 4 位', '候补带位次');
eq(E.statusView({ status: 'waitlisted' }).action, null, '候补不需要我行动，无按钮');
eq(E.statusView({ status: 'confirmed' }).action,  null, '已确认无按钮');
// promoted 状态已删除（PRD §4 候补也先收款 → 转正立刻生效）。
// 这里反过来断言：它不该再有任何显示，出现即是残留。
eq(E.statusView({ status: 'promoted' }).text, 'promoted', '已废弃的 promoted 落到 default 分支，不再有专属文案');
eq(E.statusView({ status: 'promoted' }).action, null, '更不该再提示「去支付」—— 候补的钱早收过了');

console.log('\n[5] 排序：需要我行动的在前');
{
  const list = [
    { id: 'a', status: 'confirmed', createdAt: 5 },
    { id: 'b', status: 'refunded', createdAt: 9 },
    { id: 'c', status: 'pending_payment', createdAt: 1 },
    { id: 'd', status: 'waitlisted', createdAt: 8 },
    { id: 'e', status: 'pending_partner', createdAt: 2 },
  ];
  eq(E.sortEntries(list).map(x => x.id), ['c', 'e', 'd', 'a', 'b'], '待支付 → 待搭档 → 候补 → 已确认 → 已退款');
}

console.log('\n[6] 退款规则与边界');
eq(E.refundFor(20000, 10), { cents: 20000, ratio: 1, label: '全额退款' }, '赛前 10 天全额');
eq(E.refundFor(20000, 7).ratio,  1,   '恰好 7 天 → 全额');
eq(E.refundFor(20000, 6.9).ratio, 0.5, '6.9 天 → 退半');
eq(E.refundFor(20000, 3).ratio,  0.5, '恰好 3 天 → 退半');
eq(E.refundFor(20000, 2.9).ratio, 0,  '2.9 天 → 不退');
eq(E.refundFor(20000, 0).cents,  0,   '当天不退');
eq(E.refundFor(20000, 1, { organizerCancelled: true }),
   { cents: 20000, ratio: 1, label: '全额退款' }, '组织者取消 → 无视天数全额');
eq(E.refundFor(20001, 5).cents, 10001, '奇数分四舍五入');

console.log('\n[7] 倒计时格式');
eq(E.formatCountdown(85268000), '23:41:08', '超过 1 小时用 H:MM:SS');
eq(E.formatCountdown(899000),   '14:59',    '不足 1 小时用 MM:SS');
eq(E.formatCountdown(47000),    '00:47',    '不足 1 分钟补零');
eq(E.formatCountdown(0),        '00:00',    '归零');
eq(E.formatCountdown(-5000),    '00:00',    '负数也归零');
eq(E.isUrgent(4 * 60 * 1000), true,  '4 分钟 → 紧急');
eq(E.isUrgent(6 * 60 * 1000), false, '6 分钟 → 不紧急');
eq(E.isUrgent(0), false, '已归零不算紧急');

console.log('\n[8] 候补顺延');
{
  const es = [
    { id: 'w2', status: 'waitlisted', waitlistPosition: 2 },
    { id: 'c1', status: 'confirmed' },
    { id: 'w1', status: 'waitlisted', waitlistPosition: 1 },
    { id: 'w3', status: 'waitlisted', waitlistPosition: 3 },
  ];
  eq(E.nextToPromote(es).id, 'w1', '取位次最小的候补');
  es.find(x => x.id === 'w1').status = 'promoted';
  E.reindexWaitlist(es);
  eq(es.filter(x => x.status === 'waitlisted').map(x => x.id + ':' + x.waitlistPosition),
     ['w2:1', 'w3:2'], '转正后其余候补前移一位');
  eq(E.nextToPromote([{ status: 'confirmed' }]), null, '没有候补时返回 null');
}

console.log('\n──────────────────────────────');
console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
