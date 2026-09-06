/**
 * 云数据库适配层。把云开发的链式 API 收拢成一组小函数，
 * 这样 handlers 可以注入内存 db 做单测（见 test/cloud.test.js）。
 *
 * ⚠️ 云数据库单次查询上限：小程序端 20 条、云函数端 100 条。
 * 所以这里的 where 默认带分页，签表/榜单一律在云函数内聚合后一次返回。
 */
const LIMIT = 100;

module.exports = function (cloudDb, _) {
  async function get(col, id) {
    if (!id) return null;
    try { const r = await cloudDb.collection(col).doc(id).get(); return r.data || null; }
    catch (e) { return null; }
  }

  async function getMany(col, ids) {
    const uniq = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniq.length) return [];
    const out = [];
    for (let i = 0; i < uniq.length; i += LIMIT) {
      const r = await cloudDb.collection(col).where({ _id: _.in(uniq.slice(i, i + LIMIT)) }).limit(LIMIT).get();
      out.push.apply(out, r.data);
    }
    return out;
  }

  async function where(col, q) {
    const out = [];
    let skip = 0;
    for (;;) {
      const r = await cloudDb.collection(col).where(q).skip(skip).limit(LIMIT).get();
      out.push.apply(out, r.data);
      if (r.data.length < LIMIT) break;
      skip += LIMIT;
      if (skip > 2000) break;                 // 防跑飞
    }
    return out;
  }

  /** 两个字段任一命中（用于「我参与的场次」） */
  async function whereIn(col, fieldA, ids, fieldB) {
    const a = await where(col, { [fieldA]: _.in(ids) });
    const b = fieldB ? await where(col, { [fieldB]: _.in(ids) }) : [];
    const seen = {};
    return a.concat(b).filter(function (x) {
      if (seen[x._id]) return false;
      seen[x._id] = 1; return true;
    });
  }

  async function first(col, q) {
    const r = await cloudDb.collection(col).where(q).limit(1).get();
    return r.data[0] || null;
  }

  async function count(col, q) {
    const r = await cloudDb.collection(col).where(q).count();
    return r.total;
  }

  async function add(col, data) {
    const r = await cloudDb.collection(col).add({ data: data });
    return r._id;
  }

  async function update(col, id, patch) {
    await cloudDb.collection(col).doc(id).update({ data: patch });
    return true;
  }

  /** 云开发数据库事务。名额判定必须走这里 */
  async function transaction(fn) {
    const tx = await cloudDb.startTransaction();
    const api = {
      get: async function (col, id) { try { const r = await tx.collection(col).doc(id).get(); return r.data; } catch (e) { return null; } },
      count: async function (col, q) { const r = await tx.collection(col).where(q).count(); return r.total; },
      update: async function (col, id, patch) { await tx.collection(col).doc(id).update({ data: patch }); },
      add: async function (col, data) { const r = await tx.collection(col).add({ data: data }); return r._id; },
    };
    try {
      const out = await fn(api);
      if (out && out.ok === false) { await tx.rollback(); return out; }
      await tx.commit();
      return out;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  return { get, getMany, where, whereIn, first, count, add, update, transaction, LIMIT };
};
