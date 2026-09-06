/** 报名链路假数据 */

const now = Date.now();
const H = 3600 * 1000;

const me = { id: 'u1', nickname: '张伟', gender: 'M' };

const partners = [
  { id: 'u2', nickname: '李强', gender: 'M', together: 9, winRate: 67 },
  { id: 'u3', nickname: '李娜', gender: 'F', together: 9, winRate: 67 },
  { id: 'u4', nickname: '王芳', gender: 'F', together: 3, winRate: 33 },
];

const tournament = {
  id: 't1',
  name: '2026 春季双打公开赛',
  date: '4月18–19日',
  venue: '上海静安体育中心',
  deadline: '截止 4月10日',
  status: 'open',
  daysUntilStart: 12,
  rules: '单败淘汰 · 6局短盘 · 6-6 抢七',
  events: [
    { id: 'ev-md', type: 'MD', name: '男双', capacity: 32, confirmedCount: 24, waitlistCount: 0, feeCents: 20000 },
    { id: 'ev-wd', type: 'WD', name: '女双', capacity: 16, confirmedCount: 11, waitlistCount: 0, feeCents: 20000 },
    { id: 'ev-xd', type: 'XD', name: '混双', capacity: 16, confirmedCount: 16, waitlistCount: 3, feeCents: 20000 },
  ],
};

/** 项目里已报名的组合，按报名先后（第一版不做积分排序） */
const eventEntries = {
  'ev-md': [
    { id: 'x1', names: ['高翔', '邓琳'], at: '3月28日 报名' },
    { id: 'x2', names: ['吴迪', '郑凯'], at: '3月29日 报名' },
    { id: 'x3', names: ['何军', '罗宇'], at: '4月1日 报名' },
  ],
  'ev-xd': [
    { id: 'y1', names: ['张伟', '李娜'], at: '3月26日 报名' },
    { id: 'y2', names: ['陈曦', '王芳'], at: '3月27日 报名' },
  ],
};

/** 我的报名，覆盖五种状态 */
const myEntries = [
  { id: 'en1', status: 'pending_payment', tournamentName: '2026 春季双打公开赛', eventName: '混双',
    partners: ['张伟', '李娜'], feeCents: 20000, deadlineAt: now + 23 * H + 41 * 60000, createdAt: 5 },
  { id: 'en2', status: 'pending_partner', tournamentName: '夏季团体赛', eventName: '男双',
    partners: ['张伟', '李强'], feeCents: 15000, deadlineAt: now + 18 * H, invitee: '李强', createdAt: 4 },
  { id: 'en3', status: 'waitlisted', waitlistPosition: 4, tournamentName: '2026 春季双打公开赛', eventName: '混双',
    partners: ['张伟', '王芳'], feeCents: 20000, createdAt: 3 },
  { id: 'en4', status: 'confirmed', tournamentName: '2026 春季双打公开赛', eventName: '男双',
    partners: ['张伟', '李强'], feeCents: 20000, paidAt: '4月2日', createdAt: 2 },
  { id: 'en5', status: 'refunded', tournamentName: '冬季邀请赛', eventName: '男双',
    partners: ['张伟', '李强'], feeCents: 20000, refundedAt: '3月2日', createdAt: 1 },
];

/** 别人发给我的组队邀请（分享落地页） */
const incomingInvite = {
  id: 'inv1',
  from: { nickname: '张伟', gender: 'M' },
  tournamentName: '2026 春季双打公开赛',
  eventName: '混双',
  eventType: 'XD',
  date: '4月18–19日',
  feeCents: 20000,
  payerName: '张伟',
  expiresAt: now + 23 * H + 41 * 60000,
};

module.exports = { me, partners, tournament, eventEntries, myEntries, incomingInvite, H };
