/**
 * LJTennis 数据模型 v1.1
 * 第一版范围：注册 + 报名 + 记分 + 积分（单打 + 双打）
 *
 * **这份文件是类型与状态机的真身。** 冲突时以它为准 —— 产品规则看
 * `PRD.md`，页面结构看 `SPEC.md`，但字段和枚举以这里为准。
 * 三端（小程序、云函数、网页后台）共用这一份契约。
 *
 * ⚠️ 契约会**领先于实现**。代码还没跟上的地方记在 `SPEC.md` §5「待修」，
 * 不要反过来改这份文件去迁就旧代码。
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

/** 赛制。第一版只做两种，覆盖约 90% 的业余赛事。见 PRD.md §5 */
export type DrawFormat =
  | 'knockout'        // 单败淘汰 → 树状签表
  | 'group_knockout'; // 小组循环 → 小组积分表 + 树状签表（出线数见 Event.qualifyCount）

/**
 * 比赛格式。由赛事设定，选手不可改（避免两边记的赛制不一致）。
 *
 * **是配置不是枚举** —— 业余赛的格式因场地、天气、人数天天在变，固定清单
 * 必然漏掉别人正在用的那种（这份契约已经漏过两次）。`tennis.js` 的
 * `PRESETS` 只是建赛表单的快捷方式，每一项都能改。
 *
 * 与 `DrawFormat` 分工：那个决定签表长什么样，这个决定一分怎么算。
 * **存进 `Match` 的是解析后的对象而不是预设名** —— 每场比赛按开打那天的
 * 规则结算。
 */
export interface MatchFormat {
  // ── 盘 ────────────────────────────────────────────────
  /**
   * **先赢几盘算赢** —— 不是「总共打几盘」。
   *   `2` + `decidingTiebreakTo: 7`  = 三盘两胜
   *   `2` + `decidingTiebreakTo: 10` = 两盘 + 决胜抢十
   *   `1` = 单盘
   */
  setsToWin: number;

  /**
   * 决胜盘打一个抢七、抢到几分。**必填**，`0` = 决胜盘照常打满一盘。
   * 仅 `setsToWin >= 2` 有意义。
   *
   * 不做成可选的：决胜盘怎么打是建赛时**必须想清楚**的一项，
   * 留空等于把它推给默认值，而两盘制和三盘制的赛程时长差着一倍。
   *
   * `10`（1-1 后打一个抢十）是业余双打主流 ——
   * **和 `tiebreakAt: 0` 的「整场一个抢十」不是一回事**。
   */
  decidingTiebreakTo: number;

  // ── 局 ────────────────────────────────────────────────
  /** 一盘打几局。常见 **6**（标准）、**8**（八局制 pro set）、**4**（短盘） */
  gamesToWin: number;

  /**
   * 几平进抢七。默认等于 `gamesToWin`（6-6 进、8-8 进、4-4 进）。
   *
   * **`0` = 一开局就进** —— 整场就是一个抢七/抢十。这不是哨兵值，
   * 「0 平进抢七」字面上就是它的意思。
   */
  tiebreakAt: number;

  // ── 分 ────────────────────────────────────────────────
  /**
   * 抢七打到几分。默认：**4 局及以下抢五，6 局和 8 局都抢七**，
   * `tiebreakAt: 0` 时抢十。
   *
   * 不是「局数 + 1」—— 那只在 4 和 6 上碰巧成立。抢七是 7 分因为标准
   * 抢七就是 7 分，跟局数无关；8 局制仍然是 8-8 抢七，不是抢九。
   */
  tiebreakTo: number;

  /** 金球：40-40 后不打占先，下一分定胜负。**与「短盘」是两个维度** */
  noAd: boolean;
}

/** 赛事积分等级。组织者选等级，各轮次分值由平台固定 —— 见 PRD.md §7 */
export type TournamentTier = 'A' | 'B' | 'C';

/** 俱乐部会员状态。入会要管理员审核；**审批只管入会，不管报名** —— PRD.md §2 */
export type MembershipStatus =
  | 'pending'    // 申请中
  | 'active'     // 已入会
  | 'rejected'   // 被拒，可再申请
  | 'removed';   // 被移除，可再申请

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

  /**
   * 手机号。**绝不返回给其他选手** —— 选手侧任何地方都只看到掩码
   * `138****6421`，包括自己的。真号只在云函数里存在。
   *
   * ⚠️ **字段名超前于实现：现在存的是明文。** 加密方案见 `SPEC.md` §4，
   * 它必须和 `admin.*` 鉴权一起做（`SPEC.md` §5.1）—— 只加密不做访问控制，
   * 号还是谁都能导。谁能看到全号的规则见 `PRD.md` §9。
   */
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

  /** 所属俱乐部。「你是某俱乐部管理员，所以能以俱乐部名义办赛」 */
  clubId: string;

  /** 积分等级。组织者选，分值由平台固定 —— 自由填分值会让全局榜失去可比性 */
  tier: TournamentTier;

  /**
   * 封面。**可选** —— 没传不是错误状态，用主色渐变加赛事名首字水印兜底，
   * 灰色占位图会让那场赛事看起来像坏了。出图 1125×630，见 `design/DESIGN.md` §2
   */
  coverUrl?: string;
}

/** 俱乐部会员。**旁挂在报名链路之外** —— Entry 绝不查 Membership，见 PRD.md §2 */
export interface Membership {
  id: string;
  clubId: string;
  userId: string;
  status: MembershipStatus;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface Event {
  id: string;
  tournamentId: string;
  type: EventType;
  drawFormat: DrawFormat;
  matchFormat: MatchFormat;

  /**
   * 名额。**单位跟着比赛走**：双打是「队」，单打是「人」——
   * 界面上照这个渲染（16 队 / 16 人）。`Entry`（1~2 人）让这一列
   * 只换单位、不换逻辑。**「组」这个词留给小组循环的小组**。
   */
  capacity: number;

  /** 报名费，单位「分」。**0 = 免费，报名状态机走捷径直接 confirmed** */
  feeCents: number;

  /** 候补上限。建赛时设 */
  waitlistCapacity?: number;

  // ---- 小组循环专用。drawFormat === 'knockout' 时无意义 ----
  /**
   * 每组几**队**。建赛时按比赛设 —— 男双和女双可以不一样。**默认 4**：
   * 业余赛第一诉求是「来一趟多打几场」，4 队一组每队保底 3 场。
   * 代价是 12 队分 3×4 后出线 6 队填不满 8 签位，会有 2 个轮空。
   */
  groupSize?: 3 | 4;

  /**
   * 每组取前几出线。**第一版固定 2，不给组织者配。**
   *
   * 它不是自由旋钮：`出线队数 = 组数 × qualifyCount`，而这个乘积必须
   * 填得进 2 的幂签表。4 队一组取前 3 会得到 9 队进 16 签位、7 个轮空 ——
   * 一张没法看的签表。取前 1 则让小组赛最后一轮变成走过场。
   *
   * **同一个比赛里所有小组必须一致**，所以它在 Event 上而不是 Group 上。
   * 字段留着：第二版遇到「8 组取第一」这种场景改一个值即可，不动模型。
   */
  qualifyCount?: number;

  // ---- 派生字段，列表页直接用 ----
  /**
   * **占了正式名额**的条数 = `seeking_partner` + `confirmed`。
   * 曾经这里叫 confirmedCount 且只数 confirmed —— 于是待编排那批
   * （已付款、占着名额）被漏掉，直接超发。**别用「付没付钱」去判名额**：
   * 候补也付了钱，但占的是候补位。
   */
  occupiedCount: number;
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

  /**
   * 参赛人。**报名时只有一个人** —— 成组发生在主办方把第二个人拖进
   * 同一签位那一刻（PRD.md §5），拖出来就拆回两条 Entry。单打恒为 1 人。
   */
  playerIds: string[];

  /**
   * 报名人。**每人付自己那一份，没有代付** —— 两个陌生人之间代付很尴尬，
   * 单独报名时更是根本没有「发起人」这个角色。
   */
  initiatorId: string;

  status: EntryStatus;

  // ---- 来源。两个字段必须分开，这是正确性问题不是记账问题 ----
  /**
   * **邀请队友**：想跟我一队的人接受邀请后填这里。**参与配对** ——
   * 签表屏进屏时会把有这层关系的两人预先并好。
   */
  invitedBy?: string;
  /**
   * **邀请朋友**：只是叫人来打同一场，**不进同一队**。只做来源统计，
   * 第一版不做界面，但字段要存 —— 冷启动阶段「人从哪来」丢了就补不回来。
   *
   * ⚠️ 与 `invitedBy` **共用一个字段会出错**：配对屏会把「张伟叫李强来
   * 打比赛」误读成「张伟想跟李强一队」，生成一条看起来很有道理的错误建议，
   * 管理员多半就点确认了。
   */
  referredBy?: string;

  /** 候补位次，从 1 开始。按钮上要显示（「加入候补 · 第 4 位」） */
  waitlistPosition?: number;

  /**
   * **主办方补入**。人凑不满一张签表时，主办方从本俱乐部已入会成员里
   * 直接挑人进签位（PRD.md §5）。这类 Entry **默认免付**，账目上要分得开 ——
   * 月底对账不能把它算成一笔收入。
   *
   * 边界：补人只能补进签表，**不能替人报名** —— 被补的人必须已注册。
   */
  addedByOrganizer?: boolean;

  /**
   * 种子号。**第一版一律为空** —— 抽签是随机的，抽完主办方手动拖调
   * （PRD.md §5）。字段留着是接口：第二版加种子只是多一步排序，不改模型。
   */
  seed?: number;

  createdAt: string;
  /** 候补转正时刻。候补先收过款，所以转正立刻生效，没有「转正待付」这一档 */
  promotedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
}

export interface Order {
  id: string;
  entryId: string;
  /**
   * 付款人。**每人付自己那一份** —— 双打一条 Entry 对应**两笔** Order，
   * 不是一笔全款。候补也有 Order：候补同样先收款（PRD.md §4）。
   */
  payerId: string;
  amountCents: number;
  status: OrderStatus;
  wxTransactionId?: string;
  /** 微信支付本身的订单过期时间。**与报名状态无关** —— 报名没有支付倒计时 */
  expiresAt: string;
  refundCents?: number;
  refundedAt?: string;
  /** 失败原因，要能转成人话（「银行卡余额不足」而不是错误码） */
  failReason?: string;
}

// ============================================================
// 签表与场次
// ============================================================

/**
 * 小组（仅 group_knockout）。
 * **出线名额不在这里** —— 它在 `Event.qualifyCount` 上，因为同一个比赛里
 * 所有小组必须一致，否则出线队数不确定、签表算不出来。
 */
export interface Group {
  id: string;
  eventId: string;
  /** A / B / C … */
  name: string;
  entryIds: string[];
}

/**
 * 小组积分行。
 *
 * **判定顺序：胜场 → 净胜盘 → 净胜局 → 抽签。** 由平台写死，组织者不可配 ——
 * 赛场上临时改判定顺序，就是在颁奖前吵架。这条规则要显示在表下面，
 * 不能藏进规则页。
 *
 * 三队一组最常出现的是**三方循环**（每队都 1 胜 1 负），光看胜场排不出名次，
 * 净胜盘一比就分开了 —— 所以 `setDiff` 必须存，不能只存净胜局。
 */
export interface GroupStanding {
  entryId: string;
  rank: number;
  wins: number;
  losses: number;
  /** 净胜盘的分子分母。**排在净胜局之前比** */
  setsWon: number;
  setsLost: number;
  /** setsWon - setsLost */
  setDiff: number;
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
 * 已定：**组织者选等级（A/B/C），各轮次分值由平台固定**。不让组织者自由
 * 填分值，否则全局榜会失去可比性 —— 赛事 A 冠军给 1000、赛事 B 给 100，
 * 榜首可能只是参加了分值虚高的赛事。ATP 榜单成立恰恰因为 1000/500/250
 * 是等级而不是自由输入框。见 PRD.md §7。
 *
 * ⚠️ 以下仍未定，界面按通行假设绘制，定了只需改分值来源：
 *   1. A/B/C 各轮次的**具体分值**（冠军/亚军/四强/八强/十六强/小组未出线）
 *   2. 双打是两人各得全额还是各得一半
 *   3. 赛季划分方式（当前假设：自然年，年末清零）
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
// 定时任务
// ============================================================

/**
 * **一个按状态各自计时的倒计时都没有。**
 *
 * 原来有三个（搭档确认 48h、支付 24h、候补转正 24h），随着两条规则一起消失：
 *   · 「报名即付款」 → 搭档确认和支付两个等待态没了
 *   · 「候补也先收款」 → 转正立刻生效，不用等谁付款
 *
 * 剩下的两个等待态（`seeking_partner` / `waitlisted`）**同一个出口**：
 * 报名截止那一刻结算。所以只需要一个定时任务，而且它跑的时间是确定的。
 */
export type ScheduledJob =
  /**
   * ① 报名截止结算。一次做完三件事：
   *   · event.status → closed
   *   · 仍在 seeking_partner 的（没进签位）→ cancelled + 全额退款
   *   · 仍在 waitlisted 的（没转正）→ cancelled + 全额退款，不按赛前天数扣
   */
  | 'settle_registration_deadline'
  /** ② 赛前提醒订阅消息 */
  | 'send_match_reminder';
