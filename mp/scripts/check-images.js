/**
 * 图片规格检查。规格见 design/image-spec.md。
 * 拦的是这几类：照片存成 PNG、扩展名与真实格式不符、单图超预算、主包超 2MB。
 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const DIR = path.join(__dirname, '../miniprogram/images');
const MP  = path.join(__dirname, '../miniprogram');

const LIMITS = [
  { re: /icons\//,        max:  10 * 1024, label: 'tabBar / 行内图标' },
  { re: /register-sponsors/, max: 150 * 1024, label: '注册页赞助商条' },
  { re: /./,              max: 120 * 1024, label: '一般图片' },
];

function magic(file) {
  const b = fs.readFileSync(file).subarray(0, 12);
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
  if (b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (b.subarray(0, 4).toString() === '<svg' || b.subarray(0, 5).toString() === '<?xml') return 'svg';
  if (b.subarray(0, 3).toString() === 'GIF') return 'gif';
  return 'unknown';
}
function dims(file) {
  try {
    const out = cp.execSync('sips -g pixelWidth -g pixelHeight ' + JSON.stringify(file), { encoding: 'utf8' });
    const w = (out.match(/pixelWidth:\s*(\d+)/) || [])[1];
    const h = (out.match(/pixelHeight:\s*(\d+)/) || [])[1];
    return w && h ? { w: +w, h: +h } : null;
  } catch (e) { return null; }
}
function walk(d, out) {
  if (!fs.existsSync(d)) return out;
  fs.readdirSync(d).forEach(function (f) {
    const p = path.join(d, f);
    fs.statSync(p).isDirectory() ? walk(p, out) : (/\.(png|jpe?g|webp|svg|gif)$/i.test(f) && out.push(p));
  });
  return out;
}
function dirSize(d) {
  return +cp.execSync('du -sk ' + JSON.stringify(d), { encoding: 'utf8' }).split(/\s+/)[0] * 1024;
}

let bad = 0, warn = 0, total = 0;
walk(DIR, []).forEach(function (file) {
  const rel = path.relative(MP, file);
  const size = fs.statSync(file).size;
  total += size;
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
  const real = magic(file);

  if (real !== 'unknown' && real !== ext) {
    console.log('  ✗ ' + rel + '  扩展名是 .' + ext + ' 但实际是 ' + real.toUpperCase());
    bad++;
  }
  const d = dims(file);
  if (real === 'png' && d && d.w * d.h > 400 * 400 && size > 200 * 1024) {
    console.log('  ✗ ' + rel + '  大尺寸照片存成了 PNG（' + kb(size) + '），改存 JPEG 能小一个数量级');
    bad++;
  }
  const rule = LIMITS.find(function (r) { return r.re.test(rel); });
  if (size > rule.max) {
    console.log('  ⚠ ' + rel + '  ' + kb(size) + '，超出「' + rule.label + '」预算 ' + kb(rule.max));
    warn++;
  }
  if (/register-sponsors/.test(rel) && d) {
    // 这条是 1:1 铺满 750rpx 宽的，@3x 机器要 2250px 才锐；低于 1500 就已经看得出发虚
    if (d.w < 1500) { console.log('  ⚠ ' + rel + '  宽 ' + d.w + 'px，@2x/@3x 上 logo 会发虚，理想 2250'); warn++; }
  }
});

const pkg = dirSize(MP);
console.log('  ── 图片合计 ' + kb(total) + ' · 主包 ' + mb(pkg) + ' / 2 MB (' + Math.round(pkg / 2097152 * 100) + '%)');
if (pkg > 2 * 1024 * 1024) { console.log('  ✗ 主包超出 2 MB'); bad++; }

console.log(bad ? '  ' + bad + ' 项不合规' + (warn ? '，' + warn + ' 项警告' : '')
                : (warn ? '  ✓ 无不合规，' + warn + ' 项警告' : '  ✓ 图片规格全部合规'));
process.exit(bad ? 1 : 0);

function kb(n) { return (n / 1024).toFixed(0) + ' KB'; }
function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }
