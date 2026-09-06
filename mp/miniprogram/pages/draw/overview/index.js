const mock = require('../../../mock/draw');
const D = require('../../../utils/draw');
const palette = require('../../../utils/palette');

/* 画布布局常量（逻辑像素，非 rpx —— canvas 用 px 体系） */
const COL_W = 172, BOX_W = 150, ROW_H = 78, BOX_H = 54, PAD = 16;

Page({
  data: { onlyMine: false },

  onLoad() {
    this.src = mock.knockout;
    this.view = { tx: 0, ty: 0, scale: 1 };
    this.layout = D.bracketLayout(this.src.matches, this.src.myEntryIds,
      { colW: COL_W, boxW: BOX_W, rowH: ROW_H, boxH: BOX_H, pad: PAD });
    this.initCanvas();
  },

  onUnload() {
    if (this._themeOff) wx.offThemeChange(this._themeOff);
  },

  initCanvas() {
    const self = this;
    wx.createSelectorQuery().select('#bracket')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        self.canvas = canvas;
        self.ctx = canvas.getContext('2d');
        self.ctx.scale(dpr, dpr);
        self.cssW = res[0].width;
        self.cssH = res[0].height;
        self.onFit();
        // 深色模式切换时重绘
        self._themeOff = function () { self.draw(); };
        if (wx.onThemeChange) wx.onThemeChange(self._themeOff);
      });
  },

  onFit() {
    const L = this.layout;
    const s = Math.min(this.cssW / L.totalW, this.cssH / L.totalH, 1);
    this.view = {
      scale: s,
      tx: (this.cssW - L.totalW * s) / 2,
      ty: (this.cssH - L.totalH * s) / 2,
    };
    this.draw();
  },

  onToggleMine() {
    this.setData({ onlyMine: !this.data.onlyMine }, this.draw);
  },

  /* ---------- 手势 ---------- */
  onStart(e) {
    const t = e.touches;
    if (t.length === 1) {
      this.drag = { x: t[0].x, y: t[0].y, tx: this.view.tx, ty: this.view.ty };
      this.pinch = null;
    } else if (t.length === 2) {
      this.drag = null;
      this.pinch = { d: dist(t), scale: this.view.scale, cx: (t[0].x + t[1].x) / 2, cy: (t[0].y + t[1].y) / 2,
                     tx: this.view.tx, ty: this.view.ty };
    }
  },

  onMove(e) {
    const t = e.touches;
    if (t.length === 1 && this.drag) {
      this.view.tx = this.drag.tx + (t[0].x - this.drag.x);
      this.view.ty = this.drag.ty + (t[0].y - this.drag.y);
      this.draw();
    } else if (t.length === 2 && this.pinch) {
      const k = clamp(this.pinch.scale * (dist(t) / this.pinch.d), 0.35, 3);
      const r = k / this.pinch.scale;
      // 以捏合中心为锚点缩放
      this.view.scale = k;
      this.view.tx = this.pinch.cx - (this.pinch.cx - this.pinch.tx) * r;
      this.view.ty = this.pinch.cy - (this.pinch.cy - this.pinch.ty) * r;
      this.draw();
    }
  },

  onEnd() { this.drag = null; this.pinch = null; },

  /* ---------- 绘制 ---------- */
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx, C = palette.current(), V = this.view, L = this.layout;
    const d = this.src, dim = this.data.onlyMine;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.canvas.width / this.cssW;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(V.tx, V.ty);
    ctx.scale(V.scale, V.scale);

    // 连接线：每两场汇入下一轮的一场（标准 bracket）
    const byRound = [];
    L.boxes.forEach(function (b) {
      (byRound[b.roundIndex] = byRound[b.roundIndex] || []).push(b);
    });
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    for (let ri = 0; ri < byRound.length - 1; ri++) {
      const cur = byRound[ri], next = byRound[ri + 1];
      for (let j = 0; j < next.length; j++) {
        const b1 = cur[j * 2], b2 = cur[j * 2 + 1], nb = next[j];
        if (!b1 || !b2 || !nb) continue;
        const xMid = b1.x + BOX_W + (COL_W - BOX_W) / 2;
        ctx.beginPath();
        ctx.moveTo(b1.x + BOX_W, b1.cy); ctx.lineTo(xMid, b1.cy);   // 上路横线
        ctx.moveTo(b2.x + BOX_W, b2.cy); ctx.lineTo(xMid, b2.cy);   // 下路横线
        ctx.moveTo(xMid, b1.cy);         ctx.lineTo(xMid, b2.cy);   // 竖线汇合
        ctx.moveTo(xMid, nb.cy);         ctx.lineTo(nb.x, nb.cy);   // 进入下一轮
        ctx.stroke();
      }
    }

    // 轮次标题
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink3;
    L.rounds.forEach(function (r, ri) {
      ctx.fillText(r.label, PAD + ri * COL_W, PAD - 4);
    });

    // 场次盒
    L.boxes.forEach(function (b) {
      const faded = dim && !b.mine;
      ctx.globalAlpha = faded ? 0.28 : 1;

      ctx.fillStyle = b.mine ? C.brandWeak : C.surface;
      ctx.strokeStyle = b.mine ? C.brand : C.line;
      ctx.lineWidth = b.mine ? 1.6 : 1;
      roundRect(ctx, b.x, b.y, BOX_W, BOX_H, 6);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(b.x, b.y + BOX_H / 2);
      ctx.lineTo(b.x + BOX_W, b.y + BOX_H / 2);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.stroke();

      drawSide(ctx, C, d, b.m, 'a', b.x, b.y, BOX_W, BOX_H);
      drawSide(ctx, C, d, b.m, 'b', b.x, b.y + BOX_H / 2, BOX_W, BOX_H);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  },
});

/* ---------- 辅助 ---------- */
function dist(t) {
  const dx = t[0].x - t[1].x, dy = t[0].y - t[1].y;
  return Math.sqrt(dx * dx + dy * dy) || 1;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 超宽名字截断加省略号 —— 全览图空间有限，这里允许截断，日常路径用轮次分页 */
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function drawSide(ctx, C, data, m, side, x, y, BOX_W, BOX_H) {
  const id = side === 'a' ? m.entryAId : m.entryBId;
  const won = m.winnerEntryId && m.winnerEntryId === id;
  const lost = m.winnerEntryId && id && m.winnerEntryId !== id;

  let label;
  if (!id) label = D.pendingLabel(m, side);
  else {
    const e = data.entries[id];
    label = e.players[0] + ' / ' + e.players[1];
  }

  ctx.font = (won ? '600 ' : '') + '10px sans-serif';
  ctx.fillStyle = (!id || lost) ? C.ink3 : C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const scoreW = 26;
  ctx.fillText(fit(ctx, label, BOX_W - 16 - scoreW), x + 8, y + BOX_H / 4);

  if (m.score && m.score.sets) {
    const g = m.score.sets.reduce(function (n, s) { return n + (side === 'a' ? s.a : s.b); }, 0);
    ctx.textAlign = 'right';
    ctx.fillStyle = won ? C.ink : C.ink3;
    ctx.font = '600 10px sans-serif';
    ctx.fillText(String(g), x + BOX_W - 8, y + BOX_H / 4);
  }
}
