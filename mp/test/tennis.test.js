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

console.log('\n[2] 占先制：平分 / 占先 / 扳平（sets3_ad）');
// 这一组测的是**占先制**，必须显式指定 —— 默认赛制是金球，到不了 Ad
m = T.createMatch({ serveOrder: ORDER, format: 'sets3_ad' });
m = win(m, 0, 3); m = win(m, 1, 3);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['40', '40'], '40-40 平分');
m = T.scorePoint(m, 0);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['Ad', '-'], 'A 占先');
m = T.scorePoint(m, 1);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['40', '40'], 'B 扳平回平分');
m = T.scorePoint(m, 1); m = T.scorePoint(m, 1);
eq(m.games, [0, 1], 'B 连得两分拿下');
eq(T.isGoldenPoint(m), false, '占先制没有金球点');

// ── SPEC §5.1 金球 ──────────────────────────────────────────────
// 引擎原来只有 `points>=4 && 差>=2`，那是占先制；而默认赛制 short6_gp
// 就是金球，于是每一场默认赛制的比赛都会在平分之后算错。
console.log('\n[2b] 金球：平分后一分定胜负（默认赛制自带金球）');
eq(T.createMatch({ serveOrder: ORDER }).format.noAd, true, '默认赛制是金球');
m = T.createMatch({ serveOrder: ORDER });
m = win(m, 0, 3); m = win(m, 1, 3);
eq([T.pointLabel(m, 0), T.pointLabel(m, 1)], ['40', '40'], '40-40');
eq(T.isGoldenPoint(m), true, '此刻是金球点');
m = T.scorePoint(m, 0);
eq([m.games, m.points], [[1, 0], [0, 0]], '下一分直接拿下这一局，不打占先');

// 反过来：金球赛制**绝不能**出现「占先」
m = T.createMatch({ serveOrder: ORDER });
m = win(m, 0, 3); m = win(m, 1, 3); 
eq(T.pointLabel(m, 0).indexOf('Ad'), -1, '金球赛制不出现 Ad');

// 3-3 之前的判定与占先制一致，别把普通局也改坏
m = T.createMatch({ serveOrder: ORDER });
m = win(m, 0, 3);
eq(m.games, [0, 0], '连得 3 分还没赢下这一局');
m = T.scorePoint(m, 0);
eq(m.games, [1, 0], '第 4 分才拿下（40-0 的正常局不受影响）');
m = T.createMatch({ serveOrder: ORDER });
m = win(m, 0, 3); m = win(m, 1, 2);
eq(m.games, [0, 0], '40-30 还没结束');

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
m = T.createMatch({ serveOrder: ['甲', '乙'], format: 'set1_gp' });
const s2 = [T.server(m)];
m = game(m, 0); s2.push(T.server(m));
m = game(m, 1); s2.push(T.server(m));
eq(s2, ['甲', '乙', '甲'], '单打每局换发');

// ── 结构化格式 ──────────────────────────────────────────────
// 旧的扁平枚举表达不了「两盘 + 决胜抢十」：setsToWin:2 是第三盘打满，
// tb10 是整场只有一个抢十，都不是这个 —— 而它是业余双打最主流的赛制。
console.log('\n[10b] 决胜盘抢十（默认赛制）');
m = T.createMatch({ serveOrder: ORDER });
eq([m.format.setsToWin, m.format.decidingTiebreakTo], [2, 10], '默认就是两盘 + 决胜抢十');
for (let i = 0; i < 6; i++) m = game(m, 0);      // A 拿下第一盘
for (let i = 0; i < 6; i++) m = game(m, 1);      // B 拿下第二盘
eq([m.setWins, m.tiebreak], [[1, 1], true], '1-1 之后自动进抢十，不再打满一盘');
m = win(m, 0, 9); m = win(m, 1, 9);
eq([m.points, m.finished], [[9, 9], false], '抢十打到 9-9 仍需净胜 2 分');
m = win(m, 0, 2);
eq(m.finished, true, '11-9 结束');
eq(m.sets[2], { a: 1, b: 0, tiebreak: { a: 11, b: 9 } }, '决胜抢十记成一盘 1-0，不产生局分');

console.log('\n[10c] decidingTiebreakTo: 0 时第三盘照常打满');
m = T.createMatch({ serveOrder: ORDER, format: 'sets3_gp' });
for (let i = 0; i < 6; i++) m = game(m, 0);
for (let i = 0; i < 6; i++) m = game(m, 1);
eq([m.setWins, m.tiebreak], [[1, 1], false], '1-1 之后仍是普通一盘');

console.log('\n[10d] 格式是配置不是枚举');
eq(T.formatLabel('sets2_st10_gp'), '两盘 + 决胜抢十 · 6局金球 · 抢七',
   '文案由配置推导，顺序是盘 → 局 → 分');
eq(T.formatLabel({ setsToWin: 1, gamesToWin: 5 }), '单盘 · 5局金球 · 抢七',
   '预设之外的自定义组合也能用，且文案自动对');

// 抢几分跟着局数走：4 局抢五、6 局抢七 —— 不传 tiebreakTo 时自动推
eq(T.resolveFormat({ setsToWin: 2, gamesToWin: 4 }).tiebreakTo, 5, '4 局默认抢五');
eq(T.resolveFormat({ setsToWin: 2, gamesToWin: 6 }).tiebreakTo, 7, '6 局默认抢七');
// 8 局制（pro set）是 8-8 抢七，不是「局数+1」推出来的抢九
eq(T.resolveFormat({ setsToWin: 1, gamesToWin: 8 }).tiebreakTo, 7, '8 局默认抢七，不是抢九');
eq(T.resolveFormat({ setsToWin: 2, gamesToWin: 4 }).tiebreakAt, 4, '几平进抢七默认等于局数');
eq(T.resolveFormat({ setsToWin: 1, gamesToWin: 1, tiebreakAt: 0 }).tiebreakTo, 10,
   'tiebreakAt: 0（一开局就进）默认抢十');
eq(T.resolveFormat({ setsToWin: 2, gamesToWin: 6 }).decidingTiebreakTo, 0,
   'resolveFormat 补齐成 0 —— 契约里这一项必填，0 就是打满一盘');
try { T.resolveFormat({ setsToWin: 1, gamesToWin: 0 }); eq('无异常', '应抛错', 'gamesToWin: 0 应报错'); }
catch (e) { eq(true, true, 'gamesToWin: 0 被拒 —— 整场抢十要用 tiebreakAt: 0 表达'); }
eq(T.resolveFormat({ setsToWin: 2, gamesToWin: 4, tiebreakTo: 7 }).tiebreakTo, 7, '显式传了就不推导');
// 预设也走同一段归一化 —— 它们省掉了 tiebreakAt / tiebreakTo，靠推
eq([T.resolveFormat('proset8_gp').tiebreakAt, T.resolveFormat('proset8_gp').tiebreakTo], [8, 7],
   '预设省掉的那两项也会被推出来（八局制 8-8 抢七）');
eq([T.resolveFormat('short4_gp').tiebreakAt, T.resolveFormat('short4_gp').tiebreakTo], [4, 5],
   '4 局预设推出 4-4 抢五');


// 决胜抢七（不是抢十）—— 换成 union 就表达不了，number 才行
m = T.createMatch({ serveOrder: ORDER, format: { setsToWin: 2, gamesToWin: 6, decidingTiebreakTo: 7 } });
eq(T.formatLabel(m.format), '两盘 + 决胜抢七 · 6局金球 · 抢七', '决胜抢几分是自由的，文案跟着变');
for (let i = 0; i < 6; i++) m = game(m, 0);
for (let i = 0; i < 6; i++) m = game(m, 1);
eq(m.tiebreak, true, '1-1 进决胜抢七');
m = win(m, 0, 7);
eq([m.finished, m.sets[2].tiebreak], [true, { a: 7, b: 0 }], '抢到 7 分就结束，不是 10');

console.log('\n[10e2] 八局制走通');
m = T.createMatch({ serveOrder: ORDER, format: 'proset8_gp' });
for (let i = 0; i < 7; i++) { m = game(m, 0); m = game(m, 1); }
eq([m.games, m.tiebreak, m.finished], [[7, 7], false, false], '7-7 还没到抢七');
m = game(m, 0); m = game(m, 1);
eq([m.games, m.tiebreak], [[8, 8], true], '8-8 才进抢七');
m = win(m, 0, 7);
eq([m.finished, m.sets[0]], [true, { a: 9, b: 8, tiebreak: { a: 7, b: 0 } }], '抢七拿下，记成 9-8');

console.log('\n[10e] 4 局制走通');
m = T.createMatch({ serveOrder: ORDER, format: 'short4_gp' });
for (let i = 0; i < 4; i++) { m = game(m, 0); m = game(m, 1); }
eq([m.games, m.tiebreak], [[4, 4], true], '4-4 进抢七');
m = win(m, 0, 5);
eq([m.setWins[0], m.sets[0]], [1, { a: 5, b: 4, tiebreak: { a: 5, b: 0 } }], '抢到 5 分就拿下这一盘');
eq(typeof T.createMatch({ serveOrder: ORDER }).format, 'object',
   'match 存的是解析后的配置对象，不是预设名 —— 预设以后改了不会重新解释历史比分');

console.log('\n[11] toMatchScore 只含 sets 与 serveOrder');
m = T.createMatch({ serveOrder: ORDER });
for (let g = 0; g < 6; g++) m = game(m, 0);
eq(Object.keys(T.toMatchScore(m)).sort(), ['serveOrder', 'sets'], '不含逐分数据');

console.log('\n[11b] 只填大分：这串盘分打不打得出来');
{
  const R = (sets, fmt) => T.resultFromSets(sets, fmt || T.PRESETS.sets2_st10_gp);

  eq([R([{ a: 6, b: 4 }, { a: 6, b: 3 }]).legal, R([{ a: 6, b: 4 }, { a: 6, b: 3 }]).winner],
     [true, 0], '6-4 6-3 → 合法，A 胜');
  eq(R([{ a: 6, b: 4 }]).finished, false, '只填一盘 → 合法但没打完');
  eq(R([{ a: 7, b: 6, tiebreak: { a: 7, b: 5 } }]).legal, true, '7-6(7-5) 合法');
  eq(R([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 1, b: 0, tiebreak: { a: 10, b: 8 } }]).winner,
     0, '决胜抢十记成 1-0 + 抢分');

  // 打不出来的比分。没有这道判据，签表会被一个假比分推进
  eq(R([{ a: 6, b: 5 }]).legal, false, '6-5 收不了盘');
  eq(R([{ a: 8, b: 6 }]).legal, false, '6 局制里 8-6 到不了');
  eq(R([{ a: 7, b: 6 }]).legal, false, '7-6 缺抢七比分');
  // 理由文案要分得开「缺」和「打不出来」—— 导入历史数据出问题时，
  // 这两句指向的是完全不同的修法
  eq(R([{ a: 7, b: 6 }]).reason, '第 1 盘缺抢7的比分', '缺抢分说「缺」，不说「打不出来」');
  eq(R([{ a: 7, b: 6, tiebreak: { a: 5, b: 7 } }]).legal, false, '抢七赢家和这一盘赢家对不上');
  eq(R([{ a: 6, b: 4 }, { a: 6, b: 3 }, { a: 6, b: 0 }]).legal, false, '已经 2-0 了不该还有第三盘');
  eq(R([{ a: 1, b: 0, tiebreak: { a: 10, b: 8 } }]).legal, false, '第一盘不是决胜盘，不能记成 1-0');

  // 八局制：8-6 在这里反而是合法的 —— 判据跟着赛制走，不是写死 6
  eq(R([{ a: 8, b: 6 }], T.PRESETS.proset8_gp).finished, true, '八局制 8-6 合法且结束');
  eq(R([{ a: 6, b: 4 }], T.PRESETS.proset8_gp).legal, false, '八局制里 6-4 还没打完一盘');

  // 最强的一条：逐分记出来的结果，喂回判据必须说「合法且已结束」。
  // 两条路算出来的胜负如果会不一致，那就是有一条错了。
  let x = T.createMatch({ serveOrder: ORDER });
  for (let g = 0; g < 6; g++) x = game(x, 0);
  for (let g = 0; g < 6; g++) x = game(x, 0);
  const back = R(T.toMatchScore(x).sets);
  eq([x.finished, back.legal, back.finished, back.winner], [true, true, true, 0],
     '逐分记出来的比分，喂回判据必须一致');
}

console.log('\n[11c] 盘位给的选项：名单和判据必须正好相等');
{
  const show = (l) => l.map((x) => x.hi + '-' + x.lo + (x.needsTiebreak ? '*' : '')).join(' ');
  const L = (fmt, opts) => T.legalSetScores(fmt, opts);

  eq(show(L(T.PRESETS.sets2_st10_gp)), '6-0 6-1 6-2 6-3 6-4 7-5 7-6*',
     '6 局制的名单（* = 还要补抢分）');
  eq(show(L(T.PRESETS.sets2_st10_gp, { deciding: true })), '1-0*', '决胜盘只有 1-0 + 抢十分');
  eq(show(L(T.PRESETS.proset8_gp)), '8-0 8-1 8-2 8-3 8-4 8-5 8-6 9-7 9-8*',
     '八局制名单不一样 —— 判据跟着赛制走，不写死 6');
  eq(show(L(T.PRESETS.short4_gp)), '4-0 4-1 4-2 5-3 5-4*', '4 局制推出来是 4-4 进、抢五');
  eq(show(L(T.PRESETS.tb10)), '1-0*', '整场一个抢十');

  // 7-0「看着合法」但永远走不到：拿到第 6 局领先 2 局，那盘当场就收了
  eq(L(T.PRESETS.sets2_st10_gp).some((x) => x.hi === 7 && x.lo === 0), false, '7-0 不在名单上');
  eq(L(T.PRESETS.sets2_st10_gp).some((x) => x.hi === 6 && x.lo === 5), false, '6-5 不在名单上');

  // ── 这两条是重点：名单和判据要**正好相等**，不能只是「名单里的都合法」 ──
  // 名单窄了，界面挡掉本来打得出来的比分；名单宽了，界面让你选一个服务端会拒的。
  const FMTS = ['sets2_st10_gp', 'proset8_gp', 'short4_gp', 'sets3_ad'];
  let inBad = 0, outBad = 0;
  for (const key of FMTS) {
    const f = T.PRESETS[key];
    const listed = new Set(L(f).map((x) => x.hi + '-' + x.lo));
    const tbTo = T.resolveFormat(f).tiebreakTo;
    for (let hi = 1; hi <= 12; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const item = L(f).find((x) => x.hi === hi && x.lo === lo);
        const st = item && item.needsTiebreak
          ? { a: hi, b: lo, tiebreak: { a: tbTo, b: 0 } }
          : { a: hi, b: lo };
        const legal = T.resultFromSets([st], f).legal;
        if (listed.has(hi + '-' + lo) && !legal) inBad++;
        // 名单外的：连补上抢分也不该合法
        if (!listed.has(hi + '-' + lo)) {
          const withTb = T.resultFromSets([{ a: hi, b: lo, tiebreak: { a: tbTo, b: 0 } }], f).legal;
          if (legal || withTb) outBad++;
        }
      }
    }
  }
  eq(inBad, 0, '名单里的每一项，判据都说合法');
  eq(outBad, 0, '名单外的每一项，判据都说不合法');
}

console.log('\n[12] 非法入参');
try { T.createMatch({ serveOrder: ['a', 'b', 'c'] }); eq('无异常', '应抛错', '发球顺序长度 3 应报错'); }
catch (e) { eq(true, true, '发球顺序长度 3 抛错'); }
try { T.createMatch({ serveOrder: ORDER, format: 'nope' }); eq('无异常', '应抛错', '未知赛制应报错'); }
catch (e) { eq(true, true, '未知赛制抛错'); }

console.log('\n──────────────────────────────');
console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
