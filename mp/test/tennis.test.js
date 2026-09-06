const T = require('../miniprogram/utils/tennis');
let pass = 0, fail = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      期望 ' + e + '\n      实际 ' + a); }
}
const ORDER = ['张伟', '陈曦', '李强', '周涛'];  // A1 B1 A2 B2
const win = (m, side, n) => { for (let i = 0; i < n; i++) m = T.scorePoint(m, side); return m; };
const game = (m, side) => win(m, side, 4);

console.log('\n[1] 一局的分数递进');
let m = T.createMatch({ serveOrder: ORDER });
eq(T.pointLabel(m, 0), '0', '开局 0');
m = T.scorePoint(m, 0); eq(T.pointLabel(m, 0), '15', '15');
m = T.scorePoint(m, 0); eq(T.pointLabel(m, 0), '30', '30');
m = T.scorePoint(m, 0); eq(T.pointLabel(m, 0), '40', '40');
m = T.scorePoint(m, 0); eq(m.games, [1, 0], '拿下一局');

console.log('\n[2] 平分 / 占先 / 扳平');
m = T.createMatch({ serveOrder: ORDER });
m = win(m, 0, 3); m = win(m, 1, 3);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['40', '40'], '40-40 平分');
m = T.scorePoint(m, 0);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['Ad', '-'], 'A 占先');
m = T.scorePoint(m, 1);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['40', '40'], 'B 扳平回平分');
m = T.scorePoint(m, 1); m = T.scorePoint(m, 1);
eq(m.games, [0, 1], 'B 连得两分拿下');

console.log('\n[3] 双打发球轮转 A1→B1→A2→B2');
m = T.createMatch({ serveOrder: ORDER });
const servers = [T.server(m)];
for (let i = 0; i < 4; i++) { m = game(m, i % 2); servers.push(T.server(m)); }
eq(servers, ['张伟', '陈曦', '李强', '周涛', '张伟'], '每局轮转且第 5 局回到 A1');

console.log('\n[4] 6-6 进抢七');
m = T.createMatch({ serveOrder: ORDER });
for (let i = 0; i < 6; i++) { m = game(m, 0); m = game(m, 1); }
eq([m.games, m.tiebreak], [[6, 6], true], '6-6 自动进抢七');
eq(T.pointLabel(m, 0), '0', '抢七分用原始计数');

console.log('\n[5] 抢七换发：第 1 分后换，之后每 2 分');
const tbServers = [T.server(m)];
for (let i = 0; i < 6; i++) { m = T.scorePoint(m, i % 2); tbServers.push(T.server(m)); }
eq(tbServers, ['张伟', '陈曦', '陈曦', '李强', '李强', '周涛', '周涛'], 'ITF 抢七换发规则');

console.log('\n[6] 抢七结束记为 7-6 且带小分');
m = T.createMatch({ serveOrder: ORDER });
for (let i = 0; i < 6; i++) { m = game(m, 0); m = game(m, 1); }
m = win(m, 0, 5); m = win(m, 1, 5);   // 5-5
m = win(m, 0, 2);                      // 7-5
eq(T.setsForDisplay(m), [{ a: 7, b: 6, ta: 7, tb: 5 }], '记为 7⁷ 6⁵');
eq(m.setWins, [1, 0], '算一盘');

console.log('\n[7] 7-5 拿盘（不进抢七）');
m = T.createMatch({ serveOrder: ORDER });
for (let i = 0; i < 5; i++) { m = game(m, 0); m = game(m, 1); }  // 5-5
m = game(m, 0); m = game(m, 0);                                   // 7-5
eq(T.setsForDisplay(m), [{ a: 7, b: 5, ta: null, tb: null }], '7-5 直接拿盘');

console.log('\n[8] 三盘两胜结束');
m = T.createMatch({ serveOrder: ORDER });
for (let s = 0; s < 2; s++) for (let g = 0; g < 6; g++) m = game(m, 0);
eq([m.finished, m.winner, m.setWins], [true, 0, [2, 0]], '拿满两盘即结束');
const before = JSON.stringify(m);
m = T.scorePoint(m, 1);
eq(JSON.stringify(m), before, '结束后再点不改变状态');

console.log('\n[9] 抢十赛制');
m = T.createMatch({ serveOrder: ORDER, format: 'tb10' });
eq(m.tiebreak, true, '开局即抢七态');
m = win(m, 0, 9); m = win(m, 1, 9);
eq([m.points, m.finished], [[9, 9], false], '9-9 需净胜 2 分');
m = win(m, 0, 2);
eq([m.finished, T.setsForDisplay(m)], [true, [{ a: 1, b: 0, ta: 11, tb: 9 }]], '11-9 结束');

console.log('\n[10] 单打（发球顺序长度 2）');
m = T.createMatch({ serveOrder: ['甲', '乙'], format: 'single6_tb' });
const s2 = [T.server(m)];
m = game(m, 0); s2.push(T.server(m));
m = game(m, 1); s2.push(T.server(m));
eq(s2, ['甲', '乙', '甲'], '单打每局换发');

console.log('\n[11] toMatchScore 只含 sets 与 serveOrder');
m = T.createMatch({ serveOrder: ORDER });
for (let g = 0; g < 6; g++) m = game(m, 0);
eq(Object.keys(T.toMatchScore(m)).sort(), ['serveOrder', 'sets'], '不含逐分数据');

console.log('\n[12] 非法入参');
try { T.createMatch({ serveOrder: ['a', 'b', 'c'] }); eq('无异常', '应抛错', '发球顺序长度 3 应报错'); }
catch (e) { eq(true, true, '发球顺序长度 3 抛错'); }
try { T.createMatch({ serveOrder: ORDER, format: 'nope' }); eq('无异常', '应抛错', '未知赛制应报错'); }
catch (e) { eq(true, true, '未知赛制抛错'); }

console.log('\n──────────────────────────────');
console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
