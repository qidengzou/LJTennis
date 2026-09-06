/** 验证 setup 推导的 serveOrder / serveSlots 与引擎的 serverIndex 全程一致 */
const T = require('../miniprogram/utils/tennis');
const mock = require('../miniprogram/mock/data');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)); };

// 复刻 pages/score/setup/index.js 的 refresh()
function derive(m, firstSide, aFirst, bFirst) {
  const A = [{ s: 0, i: aFirst }, { s: 0, i: 1 - aFirst }];
  const B = [{ s: 1, i: bFirst }, { s: 1, i: 1 - bFirst }];
  const slots = firstSide === 0 ? [A[0], B[0], A[1], B[1]] : [B[0], A[0], B[1], A[1]];
  const order = slots.map(x => (x.s === 0 ? m.a[x.i] : m.b[x.i]));
  return { order, slots };
}

const m = mock.todayMatch;
console.log('\n[A] 8 种开局组合下 slots 与 order 始终指向同一个人');
let allOk = true;
for (const fs of [0, 1]) for (const af of [0, 1]) for (const bf of [0, 1]) {
  const { order, slots } = derive(m, fs, af, bf);
  let match = T.createMatch({ serveOrder: order, format: m.format });
  // 走 12 局 + 抢七若干分，全程比对
  for (let g = 0; g < 12; g++) {
    for (let chk = 0; chk < 3; chk++) {
      const idx = T.serverIndex(match);
      const slot = slots[idx];
      const nameFromSlot = slot.s === 0 ? m.a[slot.i] : m.b[slot.i];
      if (nameFromSlot !== order[idx]) { allOk = false; }
      match = T.scorePoint(match, chk % 2);
    }
    for (let k = 0; k < 4; k++) match = T.scorePoint(match, g % 2);
  }
}
ok(allOk, '8 种组合 × 全程比对，slot 与 order 指向一致');

console.log('\n[B] 第一发球者就是设置里选的那个人');
{
  const { order } = derive(m, 0, 1, 0);   // 我方、李强先发
  ok(order[0] === m.a[1], '我方 + 第二人先发 → 首发是 ' + order[0]);
  const d2 = derive(m, 1, 0, 1);          // 对方、周涛先发
  ok(d2.order[0] === m.b[1], '对方 + 第二人先发 → 首发是 ' + d2.order[0]);
}

console.log('\n[C] 轮转严格 A→B→A→B 交替方');
{
  const { slots } = derive(m, 0, 0, 0);
  ok(slots.map(x => x.s).join('') === '0101', '发球方交替：' + slots.map(x => x.s).join(''));
  const d = derive(m, 1, 0, 0);
  ok(d.slots.map(x => x.s).join('') === '1010', '对方先发时：' + d.slots.map(x => x.s).join(''));
}

console.log('\n[D] 同一方的两人不会连续发球');
{
  const { slots } = derive(m, 0, 0, 0);
  let bad = 0;
  for (let i = 0; i < 4; i++) if (slots[i].s === slots[(i + 1) % 4].s) bad++;
  ok(bad === 0, '相邻发球者分属不同方');
}

console.log('\n──────────────────────────────');
console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
