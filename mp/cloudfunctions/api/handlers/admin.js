const C = require('../lib/collections');
const { ok } = require('../lib/result');

/**
 * 一次性初始化。第一版组织者不做界面 ——
 * 建赛事、排赛程走云开发控制台或这里的导入接口（见 api/cloudbase-notes.md）。
 */
module.exports = function (db, rawDb) {
  async function initDb() {
    const created = [];
    for (const name of Object.values(C)) {
      try { await rawDb.createCollection(name); created.push(name); }
      catch (e) { /* 已存在，云开发会抛错，属正常 */ }
    }
    return ok({ collections: Object.values(C), created: created });
  }

  /** 批量导入（赛事 / 项目 / 报名 / 场次），CSV 转好 JSON 后调这里 */
  async function importDocs(ev) {
    const { collection, docs } = ev;
    if (Object.values(C).indexOf(collection) < 0) return ok({ skipped: true });
    const ids = [];
    for (const d of (docs || [])) ids.push(await db.add(collection, d));
    return ok({ inserted: ids.length, ids: ids });
  }

  return { initDb, importDocs };
};
