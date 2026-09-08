/** 本地假数据。云环境接好后由 config/env.js 的 useMock 关掉 */

const todayMatch = {
  id: 'm12',
  tournament: '2026 春季双打公开赛',
  eventName: '男双 8强',
  matchNo: 12,
  court: '3 号场',
  time: '14:00',
  format: 'sets2_st10_gp',
  a: ['张伟', '李强'],   // 我方
  b: ['陈曦', '周涛'],   // 对方
};

const otherToday = [
  { id: 'm18', eventName: '混双 16强', time: '16:30', court: '待定' },
];

const tournaments = [
  {
    id: 't1', name: '2026 春季双打公开赛', status: 'open',
    date: '4月18–19日', venue: '上海静安体育中心', deadline: '截止 4月10日',
    events: ['男双', '女双', '混双'], fee: '¥200',
  },
  {
    id: 't2', name: '静安周末双打邀请赛', status: 'open',
    date: '4月25日', venue: '上海静安网球中心', deadline: '截止 4月20日',
    events: ['男双', '混双'], fee: '¥120',
  },
  {
    id: 't3', name: '社区友谊赛', status: 'open',
    date: '5月3日', venue: '上海江宁球场', deadline: '截止 4月28日',
    events: ['混双'], fee: '免费',
  },
];

module.exports = { todayMatch, otherToday, tournaments };
