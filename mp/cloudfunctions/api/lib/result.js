/** 统一返回体。小程序端只需判断 ok */
function ok(data) { return { ok: true, data: data === undefined ? null : data }; }
function fail(code, msg, extra) {
  return Object.assign({ ok: false, code: code, msg: msg || code }, extra || {});
}
module.exports = { ok, fail };
