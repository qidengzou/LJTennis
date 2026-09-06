const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
[['miniprogram/utils/entry.js', 'cloudfunctions/api/shared/entry.js']].forEach(function (p) {
  fs.copyFileSync(path.join(ROOT, p[0]), path.join(ROOT, p[1]));
  console.log('  ' + p[0] + '  →  ' + p[1]);
});
