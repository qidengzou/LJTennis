const mock = require('../../../mock/entries');
const E = require('../../../utils/entry');
const AV = ['var(--c-av-1)', 'var(--c-av-2)', 'var(--c-av-3)', 'var(--c-av-4)', 'var(--c-av-5)'];

Page({
  data: { ev: null, partners: [], picked: '', genderHint: '' },

  onLoad(q) {
    const t = mock.tournament;
    const e = t.events.filter(function (x) { return x.id === q.event; })[0] || t.events[0];
    const meG = mock.me.gender;

    // 性别校验放在选人这一步就做掉，不要等提交才报错
    const ok = mock.partners.filter(function (p) {
      return E.genderOk(e.type, [meG, p.gender]);
    });
    const hint = e.type === 'XD' ? '混双要求一男一女，已自动过滤同性选手'
               : (e.type === 'MD' ? '男双要求两名男选手' : '女双要求两名女选手');

    this.setData({
      ev: { id: e.id, name: e.name, type: e.type, tournamentName: t.name,
            feeText: e.feeCents ? ('¥' + e.feeCents / 100 + ' / 组') : '免费' },
      partners: ok.map(function (p, i) { return Object.assign({}, p, { color: AV[i % 5] }); }),
      genderHint: hint,
    });
  },

  onPick(e) { this.setData({ picked: e.currentTarget.dataset.id }); },

  onInvite() {
    // TODO 云环境接好后调用 POST /entries，返回 entryId 后生成转发卡片
    wx.navigateTo({ url: '/pages/entry/invite/index?preview=1' });
  },
});
