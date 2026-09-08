const C = require('../lib/collections');
const NTRP = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
/* 手机号有两条来路：微信授权（phoneCode 换出来，可信）和用户手打
   （不可信）。手打那条必须在服务端拦格式 —— 填错了组织者联系不上人 */
const PHONE = /^1\d{10}$/;
/* 服务端暂存的有效期。微信 code 是 5 分钟，我们授权当场就换掉，
   之后用户慢慢填表也不怕 —— 这个 30 分钟是给填表用的 */
const VERIFY_TTL = 30 * 60 * 1000;

function mask(p) { return p ? p.slice(0, 3) + '****' + p.slice(7) : ''; }
const { ok, fail } = require('../lib/result');

module.exports = function (db, openapi) {
  /** 用 openid 换用户。没有 User 记录 = 未注册（云开发天然带 openid，不需要单独的鉴权层） */
  async function me(ev, ctx) {
    const u = await db.first(C.USERS, { openid: ctx.openid });
    if (!u) return ok({ registered: false, user: null });
    return ok({ registered: true, user: safeSelf(u) });
  }

  /**
   * 授权当场拿 code 换手机号，存服务端，只把掩码回给前端。
   * 免鉴权 —— 注册前就要调。真号不出服务端。
   */
  async function verifyPhone(ev, ctx) {
    if (!ev.code) return fail('BAD_ARGS', '缺 code');
    if (!openapi) return fail('INTERNAL', '未配置云调用');
    const phone = await openapi.phoneByCode(ev.code);
    if (!phone) return fail('PHONE_FAILED', '没换到手机号，请手动填写');

    const rec = await db.first(C.PHONE_VERIFY, { openid: ctx.openid });
    const data = { openid: ctx.openid, phone: phone, createdAt: Date.now(), usedAt: null };
    if (rec) await db.update(C.PHONE_VERIFY, rec._id, data);
    else await db.add(C.PHONE_VERIFY, data);
    return ok({ phoneMasked: mask(phone) });
  }

  /** 取出授权换来的号；过期或已用过都算没有 */
  async function takeVerified(openid) {
    const rec = await db.first(C.PHONE_VERIFY, { openid: openid });
    if (!rec || rec.usedAt) return null;
    if (Date.now() - rec.createdAt > VERIFY_TTL) return null;
    await db.update(C.PHONE_VERIFY, rec._id, { usedAt: Date.now() });
    return rec.phone;
  }

  /** POST /users —— 注册。手机号 · 昵称 · 性别 */
  async function register(ev, ctx) {
    const exist = await db.first(C.USERS, { openid: ctx.openid });
    if (exist) return ok({ user: safeSelf(exist) });
    if (!ev.nickname || !ev.gender) return fail('BAD_ARGS', '昵称和性别必填');
    if (['M', 'F'].indexOf(ev.gender) < 0) return fail('BAD_ARGS', '性别取值非法');
    if (ev.level && NTRP.indexOf(ev.level) < 0) return fail('BAD_ARGS', '水平取值非法');
    // 授权号在 user.phone 那步就换好存下了，这里只取。
    // 不接受客户端直接传号码充当「已验证」—— 那样谁都能认领任意号。
    let phone = null;
    if (ev.phoneVerified) {
      phone = await takeVerified(ctx.openid);
      if (!phone) return fail('PHONE_FAILED', '授权已过期，请重新获取或手动填写');
    } else if (ev.phone) {
      if (!PHONE.test(String(ev.phone))) return fail('BAD_ARGS', '手机号格式不对');
      phone = ev.phone;
    }

    const u = {
      openid: ctx.openid,
      unionid: ctx.unionid || null,
      nickname: String(ev.nickname).slice(0, 20),
      gender: ev.gender,
      phoneEncrypted: phone,                // TODO 落库前加密
      city: ev.city || null,
      selfRatedLevel: ev.level || null,     // 自评，只做初始分组
      avatarColorIndex: Math.abs(hash(ctx.openid)) % 5,
      createdAt: Date.now(),
    };
    const id = await db.add(C.USERS, u);
    return ok({ user: safeSelf(Object.assign({ _id: id }, u)) });
  }

  /** 昵称随时可改；**性别在有 active entry 时锁定** */
  async function update(ev, ctx) {
    const u = await db.first(C.USERS, { openid: ctx.openid });
    if (!u) return fail('NOT_FOUND', '还没注册');
    const patch = {};
    if (ev.nickname) patch.nickname = String(ev.nickname).slice(0, 20);
    if (ev.city !== undefined) patch.city = ev.city;
    if (ev.phone !== undefined) {
      if (ev.phone && !PHONE.test(String(ev.phone))) return fail('BAD_ARGS', '手机号格式不对');
      patch.phoneEncrypted = ev.phone || null;
    }
    if (ev.level) {
      if (NTRP.indexOf(ev.level) < 0) return fail('BAD_ARGS', '水平取值非法');
      patch.selfRatedLevel = ev.level;      // 自评随时可改，不像性别要锁
    }

    if (ev.gender && ev.gender !== u.gender) {
      const ACTIVE = ['pending_partner', 'pending_payment', 'waitlisted', 'seeking_partner', 'confirmed'];
      const mine = await db.where(C.ENTRIES, { playerIds: u._id });
      const blocking = mine.filter(function (e) { return ACTIVE.indexOf(e.status) >= 0; });
      if (blocking.length) {
        return fail('GENDER_LOCKED', '你有进行中的报名，等赛事结束后才能改性别', { count: blocking.length });
      }
      patch.gender = ev.gender;
    }
    await db.update(C.USERS, u._id, patch);
    return ok({ user: safeSelf(Object.assign({}, u, patch)) });
  }

  /** 他人主页：不含手机号 */
  async function detail(ev) {
    const u = await db.get(C.USERS, ev.userId);
    if (!u) return fail('NOT_FOUND', '选手不存在');
    return ok({ user: { _id: u._id, nickname: u.nickname, gender: u.gender, city: u.city,
                        avatarColorIndex: u.avatarColorIndex } });
  }

  /** 常搭档 —— 双打复购的核心，也是唯一不需要输入就能选到人的入口 */
  async function partners(ev, ctx) {
    const u = await db.first(C.USERS, { openid: ctx.openid });
    if (!u) return ok({ partners: [] });
    const mine = await db.where(C.ENTRIES, { playerIds: u._id });
    const count = {};
    mine.forEach(function (e) {
      (e.playerIds || []).forEach(function (id) {
        if (id !== u._id) count[id] = (count[id] || 0) + 1;
      });
    });
    const ids = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
    const users = await db.getMany(C.USERS, ids);
    return ok({
      partners: users.filter(Boolean).map(function (p) {
        return { _id: p._id, nickname: p.nickname, gender: p.gender,
                 avatarColorIndex: p.avatarColorIndex, together: count[p._id] };
      }),
    });
  }

  return { me, register, update, detail, partners, verifyPhone };
};

/** 自己看自己：手机号脱敏，绝不返回密文 */
function safeSelf(u) {
  return {
    _id: u._id, nickname: u.nickname, gender: u.gender, city: u.city,
    selfRatedLevel: u.selfRatedLevel || null,
    avatarColorIndex: u.avatarColorIndex,
    phoneMasked: mask(u.phoneEncrypted) || null,   // 前缀取真号，别写死成 138
    createdAt: u.createdAt,
  };
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + String(s).charCodeAt(i)) | 0;
  return h;
}
