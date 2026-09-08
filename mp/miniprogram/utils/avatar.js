/**
 * 头像兜底。
 *
 * `avatarUrl` 有三种情况会是空：平台那组图还没备好、旧数据、**图加载失败**
 * （球场信号差，这条最常发生）。所以兜底不是可选项，是常态路径。
 *
 * 兜底 = 昵称首字 + 一块冷色。色**由 id 在客户端算**，不存库 ——
 * 存了就要跟着用户走一辈子，而它只是个兜底。
 */

/** 色板大小，对应 tokens.wxss 的 --c-av-1..5。冷色系，不含绿/红/橙 —— 见 DESIGN.md §1 */
const PALETTE_SIZE = 5;

function hash(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

/** 1..5，直接拼进 `var(--c-av-N)` */
function colorNo(id) {
  return (Math.abs(hash(id)) % PALETTE_SIZE) + 1;
}

/** 首字。空昵称返回空串，别让它渲染出 "undefined" */
function initial(nickname) {
  return nickname ? String(nickname).charAt(0) : '';
}

/** 给 setData 用：把一个带 nickname/_id 的人补上兜底字段 */
function decorate(u) {
  if (!u) return u;
  u.avColor = colorNo(u._id || u.nickname);
  u.avText = initial(u.nickname);
  return u;
}

module.exports = { colorNo, initial, decorate, PALETTE_SIZE };
