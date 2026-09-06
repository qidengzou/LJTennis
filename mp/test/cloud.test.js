const memdb = require('./memdb');
const makeEntry = require('../cloudfunctions/api/handlers/entry');
const makeMatch = require('../cloudfunctions/api/handlers/match');
const makeUser  = require('../cloudfunctions/api/handlers/user');
const makeGate  = require('../cloudfunctions/api/lib/gate');

let pass = 0, fail = 0;
const eq = (a, e, n) => {
  const A = JSON.stringify(a), X = JSON.stringify(e);
  A === X ? (pass++, console.log('  ✓ ' + n))
          : (fail++, console.log('  ✗ ' + n + '\n      期望 ' + X + '\n      实际 ' + A));
};
const H = 3600 * 1000;

const seed = (over) => Object.assign({
  users: [
    { _id: 'u1', openid: 'o1', nickname: '张伟', gender: 'M' },
    { _id: 'u2', openid: 'o2', nickname: '李强', gender: 'M' },
    { _id: 'u3', openid: 'o3', nickname: '李娜', gender: 'F' },
  ],
  tournaments: [{ _id: 't1', name: '春季赛', startDate: new Date(Date.now() + 30 * 24 * H).toISOString(), status: 'open' }],
  events: [{ _id: 'ev1', tournamentId: 't1', type: 'MD', capacity: 2, feeCents: 20000 }],
  entries: [], matches: [],
}, over || {});

const newInvite = (db) => db.add('entries', {
  eventId: 'ev1', initiatorId: 'u1', playerIds: ['u1'],
  status: 'pending_partner', partnerDeadlineAt: Date.now() + H,
});

async function main() {
  console.log('\n[1] accept —— 有名额');
  {
    const db = memdb(seed()), E = makeEntry(db);
    const id = await newInvite(db);
    const r = await E.accept({ entryId: id }, { userId: 'u2' });
    eq([r.ok, r.data.status], [true, 'pending_payment'], '进入待支付');
    const e = await db.get('entries', id);
    eq([e.playerIds, !!e.paymentDeadlineAt, e.partnerDeadlineAt],
       [['u1', 'u2'], true, null], '写入搭档 + 支付截止 + 清掉邀请截止');
  }

  console.log('\n[2] accept —— 满员进候补');
  {
    const s = seed();
    s.entries = [
      { _id: 'c1', eventId: 'ev1', status: 'confirmed' },
      { _id: 'c2', eventId: 'ev1', status: 'confirmed' },
      { _id: 'w1', eventId: 'ev1', status: 'waitlisted', waitlistPosition: 1 },
    ];
    const db = memdb(s), E = makeEntry(db);
    const r = await E.accept({ entryId: await newInvite(db) }, { userId: 'u2' });
    eq([r.data.status, r.data.waitlistPosition], ['waitlisted', 2], '容量 2 已满 → 候补第 2 位');
  }

  console.log('\n[3] accept —— 免费赛事跳过支付');
  {
    const s = seed(); s.events[0].feeCents = 0;
    const db = memdb(s), E = makeEntry(db);
    const id = await newInvite(db);
    const r = await E.accept({ entryId: id }, { userId: 'u2' });
    const e = await db.get('entries', id);
    eq([r.data.status, !!e.paidAt, e.paymentDeadlineAt === undefined],
       ['confirmed', true, true], '直接确认，不产生支付截止');
  }

  console.log('\n[4] accept —— 性别 / 状态 / 超时');
  {
    const db = memdb(seed()), E = makeEntry(db);
    eq((await E.accept({ entryId: await newInvite(db) }, { userId: 'u3' })).code, 'GENDER', '男双 + 女搭档 → GENDER');
    const id2 = await db.add('entries', { eventId: 'ev1', initiatorId: 'u1', status: 'confirmed' });
    eq((await E.accept({ entryId: id2 }, { userId: 'u2' })).code, 'BAD_STATE', '已处理过 → BAD_STATE');
    const id3 = await db.add('entries', { eventId: 'ev1', initiatorId: 'u1', playerIds: ['u1'],
      status: 'pending_partner', partnerDeadlineAt: Date.now() - 1000 });
    eq((await E.accept({ entryId: id3 }, { userId: 'u2' })).code, 'EXPIRED', '邀请已超时 → EXPIRED');
  }

  console.log('\n[5] 释放名额 → 候补转正并重排');
  {
    const s = seed();
    s.entries = [
      { _id: 'w1', eventId: 'ev1', status: 'waitlisted', waitlistPosition: 1 },
      { _id: 'w2', eventId: 'ev1', status: 'waitlisted', waitlistPosition: 2 },
      { _id: 'w3', eventId: 'ev1', status: 'waitlisted', waitlistPosition: 3 },
    ];
    const db = memdb(s);
    eq(await makeEntry.releaseSlot(db, 'ev1'), 'w1', '位次最小的转正');
    const w1 = await db.get('entries', 'w1');
    eq([w1.status, !!w1.promotionDeadlineAt, w1.waitlistPosition], ['promoted', true, null], '转正带 24h 截止');
    eq([(await db.get('entries', 'w2')).waitlistPosition, (await db.get('entries', 'w3')).waitlistPosition],
       [1, 2], '其余候补前移一位');
    eq(await makeEntry.releaseSlot(memdb(seed()), 'ev1'), null, '没有候补时返回 null');
  }

  console.log('\n[6] 记分幂等与乐观锁');
  {
    const s = seed();
    s.matches = [{ _id: 'm1', eventId: 'ev1', status: 'live', version: 3,
                   score: { sets: [{ a: 6, b: 4 }], serveOrder: [] }, scorerId: 'u1' }];
    const db = memdb(s), M = makeMatch(db);
    const same = { sets: [{ a: 6, b: 4 }], serveOrder: [] };

    eq((await M.score({ matchId: 'm1', version: 2, score: same }, { userId: 'u1' })).data,
       { version: 3, replayed: true }, '版本落后但内容相同 → 幂等重放');

    const cf = await M.score({ matchId: 'm1', version: 2, score: { sets: [{ a: 6, b: 3 }] } }, { userId: 'u1' });
    eq([cf.ok, cf.code, !!cf.current], [false, 'CONFLICT', true], '内容不同 → CONFLICT 并带回当前状态');

    const good = await M.score({ matchId: 'm1', version: 3, finished: true, winnerEntryId: 'eA',
      score: { sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }] } }, { userId: 'u1' });
    eq(good.data.version, 4, '版本匹配 → 递增');
    eq((await db.get('matches', 'm1')).status, 'pending_confirm', '打完置为待确认');
  }

  console.log('\n[7] 确认与签表推进');
  {
    const s = seed();
    s.matches = [
      { _id: 'm1', eventId: 'ev1', status: 'pending_confirm', scorerId: 'u1', winnerEntryId: 'eA', version: 1 },
      { _id: 'm9', eventId: 'ev1', status: 'pending', sourceMatchAId: 'm1', entryAId: null, entryBId: 'eZ' },
    ];
    const db = memdb(s), M = makeMatch(db);
    eq((await M.confirm({ matchId: 'm1' }, { userId: 'u1' })).code, 'FORBIDDEN', '记分方自己确认 → FORBIDDEN');
    const r = await M.confirm({ matchId: 'm1' }, { userId: 'u2' });
    eq([r.ok, r.data.advancedTo], [true, 'm9'], '对方确认 → 推进下游');
    eq((await db.get('matches', 'm9')).entryAId, 'eA', '胜者填入下游空位');
    eq((await M.confirm({ matchId: 'm1' }, { userId: 'u2' })).code, 'BAD_STATE', '重复确认 → BAD_STATE');
  }

  console.log('\n[8] 性别在有进行中报名时锁定');
  {
    const s = seed();
    s.entries = [{ _id: 'e1', eventId: 'ev1', playerIds: ['u1'], status: 'confirmed' }];
    const db = memdb(s), U = makeUser(db);
    const r = await U.update({ gender: 'F' }, { openid: 'o1' });
    eq([r.ok, r.code, r.count], [false, 'GENDER_LOCKED', 1], '有 confirmed 报名 → 拒绝改性别');
    eq((await U.update({ nickname: '张三' }, { openid: 'o1' })).ok, true, '昵称仍可改');
    eq((await makeUser(memdb(seed())).update({ gender: 'F' }, { openid: 'o1' })).ok, true, '无进行中报名 → 可改');
  }

  console.log('\n[9] 落地页返回体不含手机号');
  {
    const s = seed();
    s.users[0].phoneEncrypted = '13812346421';
    s.entries = [{ _id: 'e1', eventId: 'ev1', playerIds: ['u1', 'u2'], status: 'pending_partner' }];
    const db = memdb(s), E = makeEntry(db), U = makeUser(db);
    eq(JSON.stringify(await E.detail({ entryId: 'e1' })).indexOf('13812346421'), -1, 'entry.detail 不含手机号');
    eq(JSON.stringify(await U.detail({ userId: 'u1' })).indexOf('13812346421'), -1, 'user.detail 不含手机号');
    eq((await U.me({}, { openid: 'o1' })).data.user.phoneMasked, '138****6421', '自己看自己：脱敏而非密文');
  }

  console.log('\n[10] 注册');
  {
    const db = memdb(seed()), U = makeUser(db);
    eq((await U.me({}, { openid: 'oNew' })).data.registered, false, '没有 User 记录 = 未注册');
    eq((await U.register({ nickname: '王五' }, { openid: 'oNew' })).code, 'BAD_ARGS', '缺性别 → BAD_ARGS');
    eq((await U.register({ nickname: '王五', gender: 'X' }, { openid: 'oNew' })).code, 'BAD_ARGS', '性别取值非法');
    const r = await U.register({ nickname: '王五', gender: 'M', phone: '13900000000' }, { openid: 'oNew' });
    eq([r.ok, r.data.user.nickname, r.data.user.phoneMasked], [true, '王五', '139****0000'], '注册成功：掩码前缀跟真号走');
    eq((await U.me({}, { openid: 'oNew' })).data.registered, true, '注册后 me 返回已注册');
  }

  console.log('\n[11] 水平自评');
  {
    const db = memdb(seed()), U = makeUser(db);
    eq((await U.register({ nickname: '甲', gender: 'M', level: '9.9' }, { openid: 'oL' })).code,
       'BAD_ARGS', '非 NTRP 档位 → BAD_ARGS');
    const r = await U.register({ nickname: '甲', gender: 'M', level: '3.5' }, { openid: 'oL' });
    eq([r.ok, r.data.user.selfRatedLevel], [true, '3.5'], '合法档位写入');

    const db2 = memdb(seed()), U2 = makeUser(db2);
    eq((await U2.register({ nickname: '乙', gender: 'F' }, { openid: 'oM' })).data.user.selfRatedLevel,
       null, '不填水平也能注册');

    // 自评随时可改，不像性别有 active entry 就锁
    const s3 = seed();
    s3.entries = [{ _id: 'e1', eventId: 'ev1', playerIds: ['u1'], status: 'confirmed' }];
    const db3 = memdb(s3), U3 = makeUser(db3);
    eq((await U3.update({ level: '4.0' }, { openid: 'o1' })).ok, true, '有进行中报名仍可改水平');
    eq((await U3.update({ level: 'x' }, { openid: 'o1' })).code, 'BAD_ARGS', '改成非法档位被拒');
  }

  console.log('\n[12] 手机号：授权当场换号，注册时取暂存');
  {
    // 假的云调用。单测不该联网，更不该真的产生 0.03 元/次的调用费
    const okApi   = { phoneByCode: async (c) => (c === 'CODE_OK' ? '18512349029' : null) };
    const deadApi = { phoneByCode: async () => null };

    // ── 第一步：授权换号
    const db = memdb(seed()), U = makeUser(db, okApi);
    const v = await U.verifyPhone({ code: 'CODE_OK' }, { openid: 'wx1' });
    eq([v.ok, v.data.phoneMasked], [true, '185****9029'], '换到号，只回掩码');
    eq(Object.keys(v.data).indexOf('phone'), -1, '真号不出服务端');
    eq((await db.first('phoneVerifications', { openid: 'wx1' })).phone, '18512349029',
       '真号存在服务端');

    eq((await U.verifyPhone({}, { openid: 'wx1' })).code, 'BAD_ARGS', '缺 code 被拒');
    eq((await makeUser(memdb(seed()), deadApi).verifyPhone({ code: 'X' }, { openid: 'w' })).code,
       'PHONE_FAILED', '换不到 → PHONE_FAILED');
    eq((await makeUser(memdb(seed()), null).verifyPhone({ code: 'X' }, { openid: 'w' })).code,
       'INTERNAL', '没配云调用 → INTERNAL');

    // ── 第二步：注册时取
    const r = await U.register({ nickname: '甲', gender: 'M', phoneVerified: true },
                               { openid: 'wx1' });
    eq(r.ok, true, '注册取到暂存的号');
    eq((await db.first('users', { openid: 'wx1' })).phoneEncrypted, '18512349029', '存的是真号');
    eq(r.data.user.phoneMasked, '185****9029', '掩码前缀取真号，不是写死的 138');

    // ── 一次性
    const db2 = memdb(seed()), U2 = makeUser(db2, okApi);
    await U2.verifyPhone({ code: 'CODE_OK' }, { openid: 'wx2' });
    await U2.register({ nickname: '甲', gender: 'M', phoneVerified: true }, { openid: 'wx2' });
    db2._dump().users.length = 0;   // 清掉用户，模拟再注册一次
    eq((await U2.register({ nickname: '甲', gender: 'M', phoneVerified: true },
                          { openid: 'wx2' })).code, 'PHONE_FAILED', '暂存只能用一次');

    // ── 过期
    const db3 = memdb(seed()), U3 = makeUser(db3, okApi);
    await U3.verifyPhone({ code: 'CODE_OK' }, { openid: 'wx3' });
    const rec = await db3.first('phoneVerifications', { openid: 'wx3' });
    await db3.update('phoneVerifications', rec._id, { createdAt: Date.now() - 31 * 60 * 1000 });
    eq((await U3.register({ nickname: '甲', gender: 'M', phoneVerified: true },
                          { openid: 'wx3' })).code, 'PHONE_FAILED', '超 30 分钟算过期');

    // ── 不能自称已验证
    const db4 = memdb(seed()), U4 = makeUser(db4, okApi);
    eq((await U4.register({ nickname: '甲', gender: 'M', phoneVerified: true },
                          { openid: 'wx4' })).code, 'PHONE_FAILED',
       '没授权过却声称已验证 → 拒绝，不能凭空认领号码');
  }

  console.log('\n[13] 手机号格式（手打的，服务端必须拦）');
  {
    const db = memdb(seed()), U = makeUser(db);
    for (const bad of ['1380000', '23800006421', '138000064210', 'abcdefghijk']) {
      eq((await U.register({ nickname: '甲', gender: 'M', phone: bad }, { openid: 'p' + bad })).code,
         'BAD_ARGS', '拒绝 ' + bad);
    }
    eq((await U.register({ nickname: '甲', gender: 'M', phone: '13800006421' },
                         { openid: 'pOk' })).ok, true, '接受 13800006421');
    eq((await U.register({ nickname: '乙', gender: 'F' }, { openid: 'pNone' })).ok,
       true, '不填手机号也能注册');

    const db2 = memdb(seed()), U2 = makeUser(db2);
    eq((await U2.update({ phone: '19900001111' }, { openid: 'o1' })).ok, true, '改成合法号');
    eq((await U2.update({ phone: '199' }, { openid: 'o1' })).code, 'BAD_ARGS', '改成非法号被拒');
  }
  console.log('\n[14] 鉴权闸门');
  {
    const G = (db) => makeGate(db).gate;

    // 注册链路三件套必须免鉴权，否则新用户永远进不来
    const empty = memdb({ users: [] });
    for (const a of ['user.me', 'user.phone', 'user.register']) {
      eq((await G(empty)(a, 'oNew')).allow, true, a + ' 免鉴权');
    }
    eq((await G(empty)('entry.create', 'oNew')).code, 'NOT_REGISTERED',
       '报名要先注册');

    // 已注册的人带上 user
    const s1 = seed();
    const g = await G(memdb(s1))('entry.create', 'o1');
    eq([g.allow, !!g.user], [true, true], '已注册 → 放行并带上 user');

    // 全新环境：集合根本不存在，不能当成故障
    const nocol = {
      first: async () => { const e = new Error('collection not exists'); e.errCode = -502005; throw e; },
      count: async () => { const e = new Error('collection not exists'); e.errCode = -502005; throw e; },
    };
    eq((await makeGate(nocol).gate('user.register', 'o')).allow, true,
       '集合不存在时注册仍放行');
    eq((await makeGate(nocol).gate('admin.initDb', 'o')).allow, true,
       '空环境放行建库');
    eq((await makeGate(memdb(seed())).gate('admin.initDb', 'oX')).code, 'NOT_REGISTERED',
       '已有用户后建库口子关上');

    // 真故障不能被吞成「未注册」
    const broken = { first: async () => { throw new Error('DB down'); } };
    let threw = false;
    try { await makeGate(broken).gate('entry.create', 'o'); } catch (e) { threw = true; }
    eq(threw, true, '数据库真故障要抛出，不能伪装成未注册');
  }


  console.log('\n──────────────────────────────');
  console.log(fail === 0 ? `全部通过 ${pass}/${pass}` : `通过 ${pass} · 失败 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
