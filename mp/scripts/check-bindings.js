/**
 * 校验每个页面的 WXML 与 JS 是否对得上：
 *   · bind/catch 绑定的事件处理器在 Page({}) 里存在
 *   · {{}} 里引用的顶层字段在 data 里声明过
 * 这类错误在开发者工具里要点进那一屏才会暴露，很容易漏。
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../miniprogram');

const WX_BUILTIN = new Set(['true', 'false', 'null', 'undefined', 'item', 'index']);

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.wxml')) out.push(p);
  });
  return out;
}

let bad = 0;
walk(path.join(ROOT, 'pages'), []).forEach(function (wxml) {
  const js = wxml.replace(/\.wxml$/, '.js');
  if (!fs.existsSync(js)) return;
  const W = fs.readFileSync(wxml, 'utf8');
  const J = fs.readFileSync(js, 'utf8');
  const rel = path.relative(ROOT, wxml);

  // 1. 事件处理器
  const handlers = new Set();
  [...W.matchAll(/\b(?:bind|catch|capture-bind|capture-catch):?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g)]
    .forEach(function (m) { handlers.add(m[2].trim()); });
  handlers.forEach(function (h) {
    const re = new RegExp('(^|[\\s,{])' + h + '\\s*(\\(|:\\s*function|[:=]\\s*\\()', 'm');
    if (!re.test(J)) { console.log('  ✗ ' + rel + '  事件 ' + h + ' 在 JS 里没有实现'); bad++; }
  });

  // 2. {{}} 里的顶层字段
  const fields = new Set();
  [...W.matchAll(/\{\{([^}]+)\}\}/g)].forEach(function (m) {
    // 先去掉字符串字面量与属性访问，避免把 {{x ? 'on' : ''}} 里的 on 当成字段
    const expr = m[1]
      .replace(/'[^']*'/g, ' ')
      .replace(/"[^"]*"/g, ' ')
      .replace(/\.\s*[A-Za-z_$][\w$]*/g, ' ');
    [...expr.matchAll(/[A-Za-z_$][\w$]*/g)].forEach(function (t) {
      const name = t[0];
      if (WX_BUILTIN.has(name)) return;
      if (expr[t.index + name.length] === '(') return;         // 方法调用
      fields.add(name);
    });
  });
  // wx:for-item / wx:for-index 声明的局部变量
  [...W.matchAll(/wx:for-(?:item|index)\s*=\s*"([^"]+)"/g)].forEach(function (m) { fields.delete(m[1]); });

  const dataBlock = (J.match(/data:\s*\{([\s\S]*?)\n\s{0,4}\}/) || [, ''])[1];
  fields.forEach(function (f) {
    const declared = new RegExp('(^|[\\s,{])' + f + '\\s*:', 'm').test(dataBlock)
      || new RegExp('setData\\([^)]*[\\s,{\'"]' + f + '\\s*[:\'"]').test(J);
    if (!declared) { console.log('  ⚠ ' + rel + '  字段 ' + f + ' 未在 data 声明也未 setData'); bad++; }
  });
});

console.log(bad ? '  ' + bad + ' 处对不上' : '  ✓ 所有页面 WXML 与 JS 对得上');
process.exit(bad ? 1 : 0);
