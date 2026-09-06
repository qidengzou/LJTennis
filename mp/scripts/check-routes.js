/** 校验云函数路由表里的 action 都有对应实现，且没有实现了却没接进路由的 handler */
const fs = require('fs'), path = require('path');
const HDIR = path.join(__dirname, '../cloudfunctions/api/handlers');
const src = fs.readFileSync(path.join(__dirname, '../cloudfunctions/api/index.js'), 'utf8');

const routes = [...src.matchAll(/'([a-z]+\.[A-Za-z]+)':\s*H\.(\w+)\.(\w+)/g)]
  .map((m) => ({ action: m[1], mod: m[2], fn: m[3] }));

/** 取工厂函数末尾那句 `return { a, b, c };`（纯标识符列表，排除 return ok({...})） */
function exportsOf(code) {
  const all = [...code.matchAll(/return\s*\{\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*,?\s*\}\s*;/g)];
  if (!all.length) return [];
  return all[all.length - 1][1].split(',').map((s) => s.trim());
}

let bad = 0;
const wanted = {};
routes.forEach((r) => { (wanted[r.mod] = wanted[r.mod] || new Set()).add(r.fn); });

Object.keys(wanted).forEach((mod) => {
  const file = path.join(HDIR, mod + '.js');
  if (!fs.existsSync(file)) { console.log('  ✗ 缺 handler 文件 ' + mod + '.js'); bad++; return; }
  const exp = exportsOf(fs.readFileSync(file, 'utf8'));
  wanted[mod].forEach((fn) => {
    if (exp.indexOf(fn) < 0) { console.log('  ✗ ' + mod + '.js 未导出 ' + fn); bad++; }
  });
  // 反向：实现了但没接进路由
  exp.forEach((fn) => {
    if (!wanted[mod].has(fn)) { console.log('  ⚠ ' + mod + '.' + fn + ' 已实现但未接入路由'); }
  });
});

console.log(bad ? `  ${bad} 处不一致` : `  ✓ ${routes.length} 条路由全部有实现`);
process.exit(bad ? 1 : 0);
