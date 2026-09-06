/**
 * 全站只走亮色 —— 守住这个决定。
 *
 * 小程序的 @media (prefers-color-scheme: dark) 只在 app.json 配了
 * darkmode: true 时才生效。两者是一套，任何一半漏回来都会让部分页面
 * 跟着系统翻色，而注册页那种压在固定底图上的页面翻不了 —— 就会出现
 * 浅色卡片里嵌深色控件。
 *
 * 所以这里同时守两头：配置关着，样式里也没有暗色分支。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
let bad = 0;

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
if (app.darkmode) {
  console.log('  ✗ app.json darkmode 是 true —— 全站按亮色处理，应为 false');
  bad++;
}
if (app.themeLocation) {
  console.log('  ✗ app.json 还有 themeLocation —— 关了 darkmode 就用不到 theme.json');
  bad++;
}

// @变量 只在 themeLocation 存在时能解析，否则导航栏/tabBar 会拿到字面量
const cfg = JSON.stringify({ window: app.window, tabBar: app.tabBar });
const vars = cfg.match(/"@[A-Za-z]+"/g);
if (vars) {
  console.log('  ✗ app.json 仍在用主题变量 ' + [...new Set(vars)].join(' ') +
              ' —— 没有 theme.json 会解析失败');
  bad++;
}

// 样式里不该再有暗色分支
const walk = function (d, out) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.wxss')) out.push(p);
  }
  return out;
};
/* 注释里提到 prefers-color-scheme 是合法的（比如解释「我们为什么不用它」），
   所以先剥掉块注释再查 —— 守卫要看真实的 CSS，不是文字 */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const f of walk(ROOT, [])) {
  if (/prefers-color-scheme/.test(stripComments(fs.readFileSync(f, 'utf8')))) {
    console.log('  ✗ ' + path.relative(ROOT, f) + ' 里有 prefers-color-scheme 分支');
    bad++;
  }
}

if (bad) {
  console.log('\n  要恢复暗黑模式，得同时改回 darkmode:true + theme.json + 令牌暗色值，' +
              '并给照片页单独钉亮色板。');
  process.exit(1);
}
console.log('  ✓ 全站只走亮色：darkmode 关闭，样式无暗色分支');
