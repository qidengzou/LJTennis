const D = require('../miniprogram/utils/draw');
let pass = 0, fail = 0;
const eq = (a, e, n) => {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  A === E ? (pass++, console.log('  ✓ ' + n))
          : (fail++, console.log('  ✗ ' + n + '\n      期望 ' + E + '\n      实际 ' + A));
};
const set = (a, b, ta, tb) => (ta === undefined ? { a, b } : { a, b, tiebreak: { a: ta, b: tb } });
const M = (o) => Object.assign({ status: 'confirmed', groupId: 'A' }, o);

console.log('\n[1] 轮次归组与命名');
eq(D.rounds([{ roundOf: 8 }, { roundOf: 16 }, { roundOf: 8 }, { roundOf: 2 }]),
   [{ roundOf: 16, label: '16强' }, { roundOf: 8, label: '8强' }, { roundOf: 2, label: '决赛' }],
   '去重 + 由大到小 + 中文轮次名');
eq(D.roundLabel(4), '半决赛', '4 → 半决赛');

console.log('\n[2] 局数统计含抢七盘');
eq(D.gamesFor({ score: { sets: [set(6, 4), set(7, 6, 7, 5)] } }, 'a'), 13, '6+7=13 局');
eq(D.gamesFor({ score: { sets: [set(6, 4), set(7, 6, 7, 5)] } }, 'b'), 10, '4+6=10 局');
eq(D.gamesFor({}, 'a'), 0, '无比分记 0');

console.log('\n[3] 小组积分：胜场优先');
{
  const g = { id: 'A', entryIds: ['e1', 'e2', 'e3', 'e4'], qualifyCount: 2 };
  const ms = [
    M({ entryAId: 'e1', entryBId: 'e4', winnerEntryId: 'e1', score: { sets: [set(6, 2), set(6, 3)] } }),
    M({ entryAId: 'e1', entryBId: 'e2', winnerEntryId: 'e1', score: { sets: [set(6, 4), set(6, 4)] } }),
    M({ entryAId: 'e2', entryBId: 'e3', winnerEntryId: 'e2', score: { sets: [set(6, 1), set(6, 1)] } }),
    M({ entryAId: 'e3', entryBId: 'e4', winnerEntryId: 'e3', score: { sets: [set(6, 3), set(6, 3)] } }),
  ];
  const s = D.standings(g, ms);
  eq(s.map(r => r.entryId), ['e1', 'e2', 'e3', 'e4'], '按胜场排序');
  eq(s.map(r => r.wins + '-' + r.losses), ['2-0', '1-1', '1-1', '0-2'], '胜负纪录');
  eq(s.map(r => r.qualified), [true, true, false, false], '前 2 名出线');
}

console.log('\n[4] 同分看净胜局');
{
  const g = { id: 'A', entryIds: ['x', 'y'], qualifyCount: 1 };
  const ms = [
    M({ entryAId: 'x', entryBId: 'z1', winnerEntryId: 'x', score: { sets: [set(6, 0)] } }),
    M({ entryAId: 'y', entryBId: 'z2', winnerEntryId: 'y', score: { sets: [set(6, 5)] } }),
  ];
  // z1/z2 不在本组，只统计 x/y 自己那场
  const s = D.standings(g, ms.map(m => Object.assign({}, m)));
  eq(s.map(r => r.entryId), ['x', 'y'], '同为 1 胜时净胜局多的在前');
  eq(s.map(r => r.gameDiff), [0, 0], '对手不在组内时不计局数');
}
{
  const g = { id: 'A', entryIds: ['p', 'q', 'r'], qualifyCount: 2 };
  const ms = [
    M({ entryAId: 'p', entryBId: 'r', winnerEntryId: 'p', score: { sets: [set(6, 0), set(6, 0)] } }),
    M({ entryAId: 'q', entryBId: 'r', winnerEntryId: 'q', score: { sets: [set(6, 4), set(6, 4)] } }),
  ];
  const s = D.standings(g, ms);
  eq([s[0].entryId, s[0].gameDiff, s[1].entryId, s[1].gameDiff], ['p', 12, 'q', 4], 'p 净胜 12 排在 q 净胜 4 之前');
}

console.log('\n[5] 未确认的比赛不计入积分表');
{
  const g = { id: 'A', entryIds: ['a1', 'a2'], qualifyCount: 1 };
  const ms = [M({ entryAId: 'a1', entryBId: 'a2', winnerEntryId: 'a1',
                  score: { sets: [set(6, 0)] }, status: 'pending_confirm' })];
  const s = D.standings(g, ms);
  eq(s.map(r => r.wins), [0, 0], '待确认的比分不进榜');
}

console.log('\n[6] 我的场次置顶');
{
  const ms = [
    { matchNo: 14, entryAId: 'x', entryBId: 'y' },
    { matchNo: 12, entryAId: 'me', entryBId: 'z' },
    { matchNo: 13, entryAId: 'p', entryBId: 'q' },
  ];
  eq(D.sortForDisplay(ms, ['me']).map(m => m.matchNo), [12, 13, 14], '我的置顶，其余按场次号');
  eq(D.sortForDisplay(ms, []).map(m => m.matchNo), [12, 13, 14], '没有我的场次时纯按场次号');
  eq(D.isMine(ms[1], ['me']), true, 'isMine 识别 entryA');
  eq(D.isMine({ entryAId: 'x', entryBId: 'me' }, ['me']), true, 'isMine 识别 entryB');
}

console.log('\n[7] 待定文案');
eq(D.pendingLabel({ sourceMatchAId: '场次 11' }, 'a'), '待定（场次 11 胜者）', '带上游场次');
eq(D.pendingLabel({}, 'b'), '待定', '无上游时只写待定');


console.log('\n[8] bracket 布局几何');
{
  const mock = require('../miniprogram/mock/draw');
  const L = D.bracketLayout(mock.knockout.matches, mock.knockout.myEntryIds,
                            { colW: 100, boxW: 90, rowH: 80, boxH: 50, pad: 10 });
  eq(L.rounds.map(r => r.roundOf), [16, 8, 4, 2], '四轮');
  eq(L.boxes.length, 15, '15 个盒子');
  eq([L.totalW, L.totalH], [420, 660], '总尺寸 = pad*2 + 轮数*colW / 首轮场数*rowH');

  const byRound = {};
  L.boxes.forEach(b => { (byRound[b.m.roundOf] = byRound[b.m.roundOf] || []).push(b.cy); });
  eq(byRound[16], [50, 130, 210, 290, 370, 450, 530, 610], 'R16 八场等距');
  eq(byRound[8],  [90, 250, 410, 570], 'R8 四场，间距翻倍');
  eq(byRound[4],  [170, 490], '半决赛两场');
  eq(byRound[2],  [330], '决赛一场');

  // 关键性质：下一轮盒子的中心 = 上一轮两场中心的中点
  let aligned = true;
  [[16, 8], [8, 4], [4, 2]].forEach(([hi, lo]) => {
    byRound[lo].forEach((cy, j) => {
      const mid = (byRound[hi][j * 2] + byRound[hi][j * 2 + 1]) / 2;
      if (Math.abs(cy - mid) > 0.001) aligned = false;
    });
  });
  eq(aligned, true, '每轮盒子正好落在上一轮两场的中线上');

  eq(L.boxes.filter(b => b.mine).length, 2, '我的场次共 2 场（R16 + R8）');
  eq([...new Set(L.boxes.map(b => b.x))], [10, 110, 210, 310], '四列横坐标');
}

console.log('\n──────────────────────────────');
console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
