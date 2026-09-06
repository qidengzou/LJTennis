/** 内存数据库，接口与 cloudfunctions/api/lib/wxdb.js 一致，用于云函数单测 */
module.exports = function memdb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  let seq = 1000;
  const all = (c) => (store[c] = store[c] || []);
  const match = (doc, q) => Object.keys(q).every((k) => {
    const v = q[k];
    if (v && typeof v === 'object' && v.$in) return v.$in.indexOf(doc[k]) >= 0;
    if (v && typeof v === 'object' && v.$lt !== undefined) return doc[k] < v.$lt;
    if (Array.isArray(doc[k])) return doc[k].indexOf(v) >= 0;   // playerIds 命中
    return doc[k] === v;
  });

  const api = {
    async get(c, id) { return all(c).find((d) => d._id === id) || null; },
    async getMany(c, ids) {
      const s = new Set((ids || []).filter(Boolean));
      return all(c).filter((d) => s.has(d._id));
    },
    async where(c, q) { return all(c).filter((d) => match(d, q)).map((d) => d); },
    async whereIn(c, fa, ids, fb) {
      return all(c).filter((d) => ids.indexOf(d[fa]) >= 0 || (fb && ids.indexOf(d[fb]) >= 0));
    },
    async first(c, q) { return all(c).find((d) => match(d, q)) || null; },
    async count(c, q) { return all(c).filter((d) => match(d, q)).length; },
    async add(c, data) { const _id = 'id' + (++seq); all(c).push(Object.assign({ _id }, data)); return _id; },
    async update(c, id, patch) {
      const d = all(c).find((x) => x._id === id);
      if (d) Object.assign(d, patch);
      return true;
    },
    async transaction(fn) { return fn(api); },   // 内存实现不做真回滚，只验业务分支
    _dump: () => store,
  };
  return api;
};
