/**
 * 校验前后端共享的纯逻辑文件完全一致。
 * accept 的名额判定、性别校验、退款规则必须两端同源，否则会出现
 * 「前端说能报，后端说不能」这种最难查的 bug。
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PAIRS = [['miniprogram/utils/entry.js', 'cloudfunctions/api/shared/entry.js']];

let bad = 0;
PAIRS.forEach(function (p) {
  const a = fs.readFileSync(path.join(ROOT, p[0]), 'utf8');
  const b = fs.readFileSync(path.join(ROOT, p[1]), 'utf8');
  if (a === b) console.log('  ✓ ' + p[0] + '  ≡  ' + p[1]);
  else { bad++; console.log('  ✗ 不一致：' + p[0] + '  ≠  ' + p[1] + '\n     跑 npm run sync-shared 同步'); }
});
process.exit(bad ? 1 : 0);
