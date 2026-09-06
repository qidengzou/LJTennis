/** 集合名。与 api/types.ts 的实体一一对应 */
module.exports = {
  USERS: 'users',
  /* 授权当场换出来的手机号先存这儿，注册时再取 —— 微信的 code 只有
     5 分钟且一次性，不能等到用户填完表才换 */
  PHONE_VERIFY: 'phoneVerifications',
  TOURNAMENTS: 'tournaments',
  EVENTS: 'events',
  ENTRIES: 'entries',
  ORDERS: 'orders',
  GROUPS: 'groups',
  MATCHES: 'matches',
  POINTS: 'points',
};
