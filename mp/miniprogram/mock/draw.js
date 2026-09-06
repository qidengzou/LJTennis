/** 签表假数据。两种赛制各一份，对应 api/types.ts 的 Match / Group */

const P = (id, a, b) => ({ id, players: [a, b] });
const set = (a, b, ta, tb) => (ta === undefined ? { a, b } : { a, b, tiebreak: { a: ta, b: tb } });

/* ---------- 男双 · 单败淘汰 16 组 ---------- */
const knockoutEntries = {};
[
  P('e1', '张伟', '李强'), P('e2', '陈曦', '周涛'), P('e3', '吴迪', '郑凯'), P('e4', '何军', '罗宇'),
  P('e5', '高翔', '邓琳'), P('e6', '马超', '许峰'), P('e7', '刘洋', '孙彬'), P('e8', '王磊', '赵明'),
  P('e9', 'Christopher Andersen', 'Aleksandr Volkov'), P('e10', '欧阳建国', '司马雨欣'),
  P('e11', '林峰', '徐斌'), P('e12', '杜宇', '范涛'), P('e13', '秦朗', '曹阳'),
  P('e14', '袁routes', '蒋波'), P('e15', '沈括', '韩野'), P('e16', '崔健', '方岩'),
].forEach(function (e) { knockoutEntries[e.id] = e; });
knockoutEntries.e14.players = ['袁磊', '蒋波'];

const knockout = {
  eventId: 'ev-md',
  eventName: '男双',
  tournament: '2026 春季双打公开赛',
  drawFormat: 'knockout',
  myEntryIds: ['e1'],
  entries: knockoutEntries,
  matches: [
    // R16
    { id: 'm1', matchNo: 1, roundOf: 16, entryAId: 'e1', entryBId: 'e9', status: 'confirmed', winnerEntryId: 'e1',
      scheduledAt: '12:00', court: '1 号场', score: { sets: [set(6, 2), set(6, 4)] } },
    { id: 'm2', matchNo: 2, roundOf: 16, entryAId: 'e2', entryBId: 'e10', status: 'confirmed', winnerEntryId: 'e2',
      scheduledAt: '12:00', court: '2 号场', score: { sets: [set(7, 6, 7, 4), set(6, 3)] } },
    { id: 'm3', matchNo: 3, roundOf: 16, entryAId: 'e3', entryBId: 'e11', status: 'confirmed', winnerEntryId: 'e3',
      scheduledAt: '12:30', court: '3 号场', score: { sets: [set(6, 4), set(6, 1)] } },
    { id: 'm4', matchNo: 4, roundOf: 16, entryAId: 'e4', entryBId: 'e12', status: 'confirmed', winnerEntryId: 'e4',
      scheduledAt: '12:30', court: '4 号场', score: { sets: [set(6, 3), set(6, 2)] } },
    { id: 'm5', matchNo: 5, roundOf: 16, entryAId: 'e5', entryBId: 'e13', status: 'confirmed', winnerEntryId: 'e5',
      scheduledAt: '13:00', court: '1 号场', score: { sets: [set(6, 0), set(6, 1)] } },
    { id: 'm6', matchNo: 6, roundOf: 16, entryAId: 'e6', entryBId: 'e14', status: 'confirmed', winnerEntryId: 'e6',
      scheduledAt: '13:00', court: '2 号场', score: { sets: [set(7, 5), set(4, 6), set(6, 3)] } },
    { id: 'm7', matchNo: 7, roundOf: 16, entryAId: 'e7', entryBId: 'e15', status: 'confirmed', winnerEntryId: 'e7',
      scheduledAt: '13:30', court: '3 号场', score: { sets: [set(6, 4), set(7, 6, 9, 7)] } },
    { id: 'm8', matchNo: 8, roundOf: 16, entryAId: 'e8', entryBId: 'e16', status: 'confirmed', winnerEntryId: 'e8',
      scheduledAt: '13:30', court: '4 号场', score: { sets: [set(6, 2), set(6, 2)] } },
    // R8
    { id: 'm9',  matchNo: 9,  roundOf: 8, entryAId: 'e3', entryBId: 'e4', status: 'confirmed', winnerEntryId: 'e3',
      scheduledAt: '14:00', court: '4 号场', score: { sets: [set(6, 4), set(7, 6, 7, 5)] } },
    { id: 'm10', matchNo: 10, roundOf: 8, entryAId: 'e5', entryBId: 'e6', status: 'pending',
      scheduledAt: '15:30', court: '1 号场' },
    { id: 'm11', matchNo: 11, roundOf: 8, entryAId: 'e7', entryBId: 'e8', status: 'pending',
      scheduledAt: '15:30', court: '2 号场' },
    { id: 'm12', matchNo: 12, roundOf: 8, entryAId: 'e1', entryBId: 'e2', status: 'pending',
      scheduledAt: '14:00', court: '3 号场' },
    // R4
    { id: 'm13', matchNo: 13, roundOf: 4, entryAId: null, entryBId: 'e3',
      sourceMatchAId: '场次 12', status: 'pending', scheduledAt: '16:30', court: '中心场' },
    { id: 'm14', matchNo: 14, roundOf: 4, entryAId: null, entryBId: null,
      sourceMatchAId: '场次 10', sourceMatchBId: '场次 11', status: 'pending', scheduledAt: '16:30', court: '1 号场' },
    // F
    { id: 'm15', matchNo: 15, roundOf: 2, entryAId: null, entryBId: null,
      sourceMatchAId: '场次 13', sourceMatchBId: '场次 14', status: 'pending', scheduledAt: '明日 10:00', court: '中心场' },
  ],
};

/* ---------- 混双 · 小组循环 ---------- */
const groupEntries = {};
[
  P('g1', '张伟', '李娜'), P('g2', '陈曦', '王芳'), P('g3', '吴迪', '刘敏'), P('g4', '何军', '赵璐'),
  P('g5', '高翔', '孙倩'), P('g6', '马超', '周敏'), P('g7', '林峰', '许静'), P('g8', '杜宇', '曹丽'),
].forEach(function (e) { groupEntries[e.id] = e; });

const group = {
  eventId: 'ev-xd',
  eventName: '混双',
  tournament: '2026 春季双打公开赛',
  drawFormat: 'group_knockout',
  myEntryIds: ['g1'],
  entries: groupEntries,
  groups: [
    { id: 'A', name: 'A 组', entryIds: ['g1', 'g2', 'g3', 'g4'], qualifyCount: 2 },
    { id: 'B', name: 'B 组', entryIds: ['g5', 'g6', 'g7', 'g8'], qualifyCount: 2 },
  ],
  matches: [
    { id: 'gm1', matchNo: 1, groupId: 'A', entryAId: 'g1', entryBId: 'g4', status: 'confirmed', winnerEntryId: 'g1',
      scheduledAt: '10:00', court: '1 号场', score: { sets: [set(6, 2), set(6, 3)] } },
    { id: 'gm2', matchNo: 2, groupId: 'A', entryAId: 'g2', entryBId: 'g3', status: 'confirmed', winnerEntryId: 'g2',
      scheduledAt: '10:00', court: '2 号场', score: { sets: [set(6, 4), set(4, 6), set(6, 4)] } },
    { id: 'gm3', matchNo: 3, groupId: 'A', entryAId: 'g1', entryBId: 'g2', status: 'confirmed', winnerEntryId: 'g1',
      scheduledAt: '11:30', court: '1 号场', score: { sets: [set(6, 4), set(6, 4)] } },
    { id: 'gm4', matchNo: 4, groupId: 'A', entryAId: 'g3', entryBId: 'g4', status: 'confirmed', winnerEntryId: 'g3',
      scheduledAt: '11:30', court: '2 号场', score: { sets: [set(6, 3), set(6, 3)] } },
    { id: 'gm5', matchNo: 5, groupId: 'A', entryAId: 'g2', entryBId: 'g4', status: 'pending',
      scheduledAt: '15:00', court: '2 号场' },
    { id: 'gm6', matchNo: 6, groupId: 'A', entryAId: 'g1', entryBId: 'g3', status: 'pending',
      scheduledAt: '15:00', court: '1 号场' },
    { id: 'gm7', matchNo: 7, groupId: 'B', entryAId: 'g5', entryBId: 'g8', status: 'confirmed', winnerEntryId: 'g5',
      scheduledAt: '10:00', court: '3 号场', score: { sets: [set(6, 1), set(6, 2)] } },
    { id: 'gm8', matchNo: 8, groupId: 'B', entryAId: 'g6', entryBId: 'g7', status: 'pending',
      scheduledAt: '15:00', court: '3 号场' },
  ],
};

module.exports = { knockout, group };
