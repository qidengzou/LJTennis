/**
 * WXML 标签配对与花括号配对校验。
 * 这类错误只有编译时才报，而且报的是「unexpected end tag」，
 * 定位到的行号往往离真正没闭合的那一行很远。
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../miniprogram');
const VOID = new Set(['image', 'input', 'import', 'include', 'wxs', 'icon', 'progress', 'br']);

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    const p = path.join(dir, f);
    fs.statSync(p).isDirectory() ? walk(p, out) : (f.endsWith('.wxml') && out.push(p));
  });
  return out;
}

let bad = 0;
walk(ROOT, []).forEach(function (file) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  // 花括号
  const o = (src.match(/\{\{/g) || []).length, c = (src.match(/\}\}/g) || []).length;
  if (o !== c) { console.log('  ✗ ' + rel + '  花括号不配对 {{=' + o + ' }}=' + c); bad++; }

  // 标签
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const closing = m[1] === '/', tag = m[2], selfClose = m[4] === '/';
    const line = src.slice(0, m.index).split('\n').length;
    if (selfClose || VOID.has(tag)) continue;
    if (!closing) { stack.push({ tag: tag, line: line }); continue; }
    if (!stack.length) { console.log('  ✗ ' + rel + ':' + line + '  多余的 </' + tag + '>'); bad++; continue; }
    const top = stack.pop();
    if (top.tag !== tag) {
      console.log('  ✗ ' + rel + ':' + line + '  </' + tag + '> 与第 ' + top.line + ' 行的 <' + top.tag + '> 不匹配');
      bad++;
    }
  }
  stack.forEach(function (t) {
    console.log('  ✗ ' + rel + ':' + t.line + '  <' + t.tag + '> 没有闭合');
    bad++;
  });
});

console.log(bad ? '  ' + bad + ' 处标签/花括号问题' : '  ✓ 所有 WXML 标签与花括号配对正确');
process.exit(bad ? 1 : 0);
