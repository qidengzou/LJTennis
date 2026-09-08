/**
 * LJTennis 数据模型 v1.0
 * 第一版范围：注册 + 报名 + 记分 + 积分（双打）
 *
 * 这份类型定义从 design/ 下的 41 屏高保真反推而来，
 * 同时作为小程序、后端、组织者后台三端的契约。
 * 每个字段后面标注了它出现在哪一屏。
 */

// ============================================================
// 枚举
// ============================================================

/** 比赛类型。单双打都上 —— 模型按「赛事→比赛→Entry」三层设计，Entry 是 1~2 人 */
export type EventType =
  | 'MD'   // 男双
  | 'WD'   // 女双
  | 'XD'   // 混双
  | 'MS'   // 男单
  | 'WS';  // 女单

/** 赛制。第一版只做两种 */
export type DrawFormat =
  | 'knockout'        // 单败淘汰 → 树状签表
  | 'group_knockout'; // 小组循环取前二出线 → 小组积分表 + 树状签表

/** 比赛赛制。由赛事设定，选手不可改（避免两边记的赛制不一致） */
export type MatchFormat =
  | 'short6_tb'   // 6 局短盘，6-6 抢七
  | 'long6_tb'    // 标准 6 局
  | 'tb10';       // 抢十

export type Gender = 'M' | 'F';

/** NTRP 自评档位。1.5 实际没人自评到，不放出来 */
export type NtrpLevel = '2.0' | '2.5' | '3.0' | '3.5' | '4.0' | '4.5' | '5.0';
export const NTRP_LEVELS: NtrpLevel[] = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];

/** 赛事状态 */
export type TournamentStatus =
  | 'draft'      // 组织者后台编辑中，不对选手可见
  | 'open'       // 报名中
  | 'closed'     // 报名截止，未开赛
  | 'live'       // 进行中
  | 'done'
  | 'cancelled';

/** 比赛状态 */
export type EventStatus =
  | 'open'       // 可报名
  | 'full'       // 名额满，可加候补（注意：满员不是错误态）
  | 'closed'     // 报名截止
  | 'drawn'      // 已抽签
  | 'live'
  | 'done';

/**
 * 报名状态机。两个「等待态」（seeking_partner / waitlisted）**同一个出口**：
 * 报名截止那一刻结算，没进签位的作废退款、没转正的候补全额退款。
 * 没有任何按状态各自计时的倒计时字段。
 * 状态色映射固定（design-system-v2 §01）：
 *   seeking_partner / waitlisted → live 橙
 *   confirmed → win 绿
 *   cancelled / refunded → void 灰
 */
export type EntryStatus =
  /**
   * 等待态①：**待编排**。报名即付款，付完就落在这里。
   * 双打只有这一条路径：接受邀请、扫码报名、朋友推荐进来的完全一样，
   * 区别只是 invitedBy 填没填。成组一律由主办方在签表屏上完成。
   */
  | 'seeking_partner'
  /**
   * 等待态②：**候补**。**同样先收款** —— 有人退出立刻转正（改状态即可，
   * 不用等谁响应），到报名截止仍没转上则全额退款。
   * 付了钱但**不占正式名额**：占名额的只有 seeking_partner / confirmed。
   * 旧的 'promoted'（转正待付）随先收款一起删掉了。
   */
  | 'waitlisted'
  | 'confirmed'         // 已确认参赛，进签表
  | 'cancelled'         // 作废（拒绝 / 超时 / 主动取消）
  | 'refunding'
  | 'refunded';

/** 场次状态 */
export type MatchStatus =
  | 'pending'          // 未开始（对阵可能还是「待定」）
  | 'live'             // 记分中
  | 'pending_confirm'  // 比分已提交，等对方确认
  | 'confirmed'        // 已确认，签表可推进
  | 'disputed'         // 有异议，已冻结，等俱乐部管理员裁定
  | 'walkover';        // 弃权

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunding' | 'refunded';

/** 淘汰赛轮次。roundOf = 该轮参赛组合数 */
export type Round = { roundOf: 64 | 32 | 16 | 8 | 4 | 2 };

// ============================================================
// 用户
// ============================================================

export interface User {
  id: string;
  openid: string;
  unionid?: string;

  /** 昵称。**会显示在签表、赛程、秩序册上** —— 注册页必须写明这一点 */
  nickname: string;

  /**
   * 性别。必填，决定能参加哪些比赛：
   *   MD → 双方均为 M；WD → 双方均为 F；XD → 一 M 一 F
   * 有 active entry 时不可修改（资料编辑页显示锁定态并说明何时解锁）
   */
  gender: Gender;

  /** 手机号。**加密存储，绝不返回给其他选手**。自己看时脱敏为 138****6421 */
  phoneEncrypted: string;

  city?: string;

  /**
   * 注册时的**自评**水平（NTRP 业余段 '2.0'..'5.0'，0.5 一档）。
   * 只用于赛事初始分组，不是算出来的评分 ——
   * 由比分推算的双打水平仍延后到第二版，字段另设。
   */
  selfRatedLevel?: NtrpLevel;

  /** 头像色板索引 0-4，由 id 取模得出。冷色系，不含绿/红/橙（避免与记分语义色冲突） */
  avatarColorIndex: number;

  createdAt: string;
}

/** 「我的」和「选手主页」用的聚合统计。注意 registered 与 completed 必须是两个数 */
export interface UserStats {
  userId: string;
  registered: number;  // 报名场次
  completed: number;   // 完赛场次（业余赛退赛率高，与 registered 差距本身是有用信息）
  wins: number;
  losses: number;
}

/** 常搭档。双打复购的核心入口，也是唯一不需要用户输入就能选到人的地方 */
export interface Partnership {
  userId: string;
  partnerId: string;
  matchesTogether: number;
  winsTogether: number;
  lastPlayedAt: string;
}

// ============================================================
// 赛事 → 比赛
// ============================================================

export interface Tournament {
  id: string;
  /** 卡片内两行封顶，321pt 宽下容量约 40 个中文字（实测 39 字不截断） */
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  venue: string;
  registrationDeadline: string;
  status: TournamentStatus;
  description?: string;
  organizerId: string;
}

export interface Event {
  id: string;
  tournamentId: string;
  type: EventType;
  drawFormat: DrawFormat;
  matchFormat: MatchFormat;

  /** 名额（组数） */
  capacity: number;

  /** 报名费，单位「分」。**0 = 免费，报名状态机走捷径直接 confirmed** */
  feeCents: number;

  status: EventStatus;

  // 派生字段，列表页直接用
  confirmedCount: number;
  waitlistCount: number;
}

// ============================================================
// Entry —— 核心抽象
// ============================================================

/**
 * 参赛主体。单打时 playerIds 长度为 1，双打为 2。
 * 签表、赛程、场次全部挂在 Entry 上 —— 这样单双打共用一套结构。
 */
export interface Entry {
  id: string;
  eventId: string;

  /** [发起人, 搭档]。顺序有意义：playerIds[0] === initiatorId */
  playerIds: string[];

  /** 发起人。**由他一人付清全款** —— 每多一个付款环节就多掉一批人 */
  initiatorId: string;

  status: EntryStatus;

  // ---- 三个等待态的超时时间。到点由定时任务自动流转 ----
  /** ①搭档确认截止。超时 → cancelled */
  partnerDeadlineAt?: string;
  /** ②支付截止。超时 → cancelled 并释放名额，随即触发候补转正 */
  paymentDeadlineAt?: string;
  /** ③候补转正后的支付截止（转正时间 +24h）。超时 → cancelled 并顺延下一位候补 */
  promotionDeadlineAt?: string;

  /** 候补位次，从 1 开始。按钮上要显示（「加入候补 · 第 4 位」） */
  waitlistPosition?: number;

  /** 种子号，组织者后台设定，可空 */
  seed?: number;

  createdAt: string;
  partnerRespondedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
}

export interface Order {
  id: string;
  entryId: string;
  /** 付款人 === entry.initiatorId */
  payerId: string;
  amountCents: number;
  status: OrderStatus;
  wxTransactionId?: string;
  /** 与 entry 的 paymentDeadlineAt 一致 */
  expiresAt: string;
  refundCents?: number;
  refundedAt?: string;
  /** 失败原因，要能转成人话（「银行卡余额不足」而不是错误码） */
  failReason?: string;
}

// ============================================================
// 签表与场次
// ============================================================

/** 小组（仅 group_knockout） */
export interface Group {
  id: string;
  eventId: string;
  /** A / B / C … */
  name: string;
  entryIds: string[];
  /** 出线名额，默认 2 */
  qualifyCount: number;
}

/** 小组积分行。同分看净胜局 —— 这条规则要显示在表下面，不能藏进规则页 */
export interface GroupStanding {
  entryId: string;
  rank: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  /** gamesWon - gamesLost */
  gameDiff: number;
  qualified: boolean;
}

/** 一盘的比分。抢七时 tiebreak 有值，UI 渲染为上标：7⁷ 6⁵ */
export interface SetScore {
  a: number;
  b: number;
  tiebreak?: { a: number; b: number };
}

/**
 * 一个场次的完整比分。
 *
 * 注意：**第一版不上传逐分数据**。逐分只存在小程序本地（用于撤销、断网续记、
 * 杀进程恢复），上传时只传 sets + serveOrder。
 * 逐分数据的唯一消费场景是发球统计（保发率），第一版没有那个界面，
 * 存了是负担。要做发球统计时再加 `points` 字段即可，不影响现有结构。
 */
export interface MatchScore {
  sets: SetScore[];
  /**
   * 发球顺序，长度 4（双打）或 2（单打）：[A1, B1, A2, B2]
   * 开局设定一次，之后每局按 gameIndex % 4 自动轮转；
   * 抢七内第 1 分后换发，之后每 2 分换一次（ITF 规则）
   */
  serveOrder: string[];
}

export interface Match {
  id: string;
  eventId: string;

  /** 场次号，显示为「场次 12」 */
  matchNo: number;

  /** 淘汰赛轮次；小组赛为 null */
  round?: Round;
  /** 小组赛所属小组；淘汰赛为 null */
  groupId?: string;

  /** 对阵双方。未定时为 null，UI 显示「待定（场次 11 胜者）」 */
  entryAId: string | null;
  entryBId: string | null;
  /** 上游场次，用于渲染「待定」文案与自动填充胜者 */
  sourceMatchAId?: string;
  sourceMatchBId?: string;

  scheduledAt?: string;
  court?: string;

  status: MatchStatus;

  /** 记分方。每场指定一人，另一方确认 */
  scorerId?: string;

  score?: MatchScore;
  winnerEntryId?: string;

  /** 确认人。必须是对方组合中的任一人 */
  confirmedById?: string;
  confirmedAt?: string;

  /** 异议说明。status = disputed 时比分冻结，签表不推进 */
  disputeReason?: string;

  /**
   * 乐观锁。记分提交必须带上，防止离线重传覆盖更新的数据。
   * 见 endpoints.md 的幂等性约定。
   */
  version: number;
}

// ============================================================
// 积分
// ============================================================

/**
 * 积分记录。**排「人」不排「组合」** —— 双打搭档会换，排组合没有连续性。
 *
 * ⚠️ 以下规则尚未确定，界面按通行假设绘制，规则一定后只需改分值来源：
 *   1. 各轮次分值（冠军/亚军/四强/八强/十六强/小组未出线）
 *   2. 赛事等级系数
 *   3. 双打是两人各得全额还是各得一半
 *   4. 赛季划分方式（当前假设：自然年，年末清零）
 */
export interface PointRecord {
  id: string;
  userId: string;
  eventId: string;
  eventType: EventType;
  season: string;        // '2026'
  /** 最好成绩，显示为「8 强」「亚军」「小组未出线」 */
  result: string;
  /** 获得积分。**0 分也要记录并显示** —— 只列加分不列零分，用户会怀疑漏算 */
  points: number;
  awardedAt: string;
}

/** 榜单一行。积分与参赛场次必须同时出现，否则打得少的人会觉得榜单不公平 */
export interface RankRow {
  rank: number;
  /** 同分并列，且并列占用名次（1 · 2 · 2 · 4） */
  tied: boolean;
  userId: string;
  nickname: string;
  avatarColorIndex: number;
  points: number;
  /** 参赛场次 */
  eventCount: number;
}

// ============================================================
// 定时任务（后端必须实现，缺一个就会有名额烂在手里）
// ============================================================

export type ScheduledJob =
  /** ① 搭档邀请超时 → entry.cancelled */
  | 'expire_partner_invite'
  /** ② 支付超时 → entry.cancelled + 释放名额 + 触发候补转正 */
  | 'expire_payment'
  /** ③ 候补转正 24h 未付 → cancelled + **自动顺延下一位候补**（业余赛退赛率高，会频繁触发） */
  | 'expire_promotion'
  /** ④ 报名截止 → event.closed */
  | 'close_registration'
  /** ⑤ 赛前提醒订阅消息 */
  | 'send_match_reminder';
