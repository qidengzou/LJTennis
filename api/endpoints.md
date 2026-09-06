# LJTennis API 契约 v1.0

配套 `api/types.ts`。第一版范围：注册 + 报名 + 记分 + 积分（双打）。

---

## 一、鉴权约定

### 三个接口必须免鉴权

它们是转发卡片的落地页，也是唯一的获客路径。**未登录用户要能完整浏览内容**，
登录墙放在「报名 / 接受邀请」这一步。

| 接口 | 落地页 |
|---|---|
| `GET /tournaments/:id` | 赛事详情 |
| `GET /events/:id` | 比赛详情 |
| `GET /entries/:id` | 组队邀请 |

> 代价：后端要提供一套无鉴权只读接口。收益：从群里点进来的人不会被授权弹窗劝退。
> 这三个接口返回的数据里**不得包含任何用户手机号**。

### 其余接口

`Authorization: Bearer <session>`，session 由 `POST /auth/login` 用微信 `code` 换取。

---

## 二、幂等与并发

### 记分提交必须幂等

球场信号差，小程序会离线累积、联网后重传。

- `POST /matches/:id/score` 带 `version`（乐观锁）
- version 不匹配 → `409 Conflict`，返回服务端当前 `Match`，由客户端决定合并还是放弃
- 相同 `(matchId, version, score)` 重复提交 → 返回 `200` 与相同结果，不产生副作用

### 名额是竞争资源

`POST /entries/:id/accept` 触发名额判定，必须在**事务内**完成：
计数 → 分配名额或候补位 → 写状态。并发接受时不能超发。

---

## 三、接口清单

### 认证与用户

| Method | Path | 用途 | 对应屏 |
|---|---|---|---|
| POST | `/auth/login` | code → session | — |
| POST | `/auth/phone` | 微信加密数据 → 手机号 | 注册步骤 1 |
| POST | `/users` | 注册：nickname + gender | 注册步骤 2 |
| GET | `/users/me` | 我的资料与统计 | 我的 |
| PATCH | `/users/me` | 改昵称 / 城市；**gender 有 active entry 时返回 409** | 资料编辑 |
| GET | `/users/:id` | 选手主页（不含手机号） | 选手主页 |
| GET | `/users/me/partners` | 常搭档列表 | 发起报名 · 选搭档 |
| GET | `/users/me/records` | 我的战绩，按赛事分组 | 我的战绩 |

**`PATCH /users/me` 的 gender 规则**：存在 status ∈ {pending_partner, pending_payment,
waitlisted, promoted, confirmed} 的 entry 时拒绝修改，错误体要带上阻塞的赛事名，
前端据此渲染「你有 1 个进行中的混双报名，等这场赛事结束后就能修改」。

### 赛事与比赛

| Method | Path | 用途 | 鉴权 |
|---|---|---|---|
| GET | `/tournaments` | 列表，筛选 `status` `city` | 是 |
| GET | `/tournaments/:id` | 详情 + 比赛列表 | **否** |
| GET | `/events/:id` | 比赛详情 | **否** |
| GET | `/events/:id/entries` | 已报名组合，**按报名先后排序** | 否 |

### 报名

| Method | Path | 用途 |
|---|---|---|
| POST | `/entries` | `{eventId, partnerId?}` → `pending_partner`，生成邀请链接 |
| GET | `/entries/:id` | 邀请落地页数据（含「谁付钱」） |
| POST | `/entries/:id/accept` | 搭档接受 → 名额判定 |
| POST | `/entries/:id/reject` | 搭档拒绝 → `cancelled` |
| POST | `/entries/:id/cancel` | 主动取消（已付款的走退款） |
| GET | `/users/me/entries` | 我的报名，五种状态 |

**`accept` 的分支**（详见 types.ts 的 EntryStatus）：

```
accept
 ├ 性别校验失败                      → 400
 ├ feeCents === 0                    → confirmed        ← 免费赛事捷径
 ├ confirmedCount < capacity         → pending_payment  (+ paymentDeadlineAt)
 └ 已满                              → waitlisted       (+ waitlistPosition)
```

> ⚠️ **免费赛事捷径必须实现。** 否则第一场社区友谊赛会卡在一个支付 ¥0 的页面上。

### 支付

| Method | Path | 用途 |
|---|---|---|
| POST | `/entries/:id/order` | 下单，返回 `wx.requestPayment` 所需参数 |
| POST | `/webhooks/wxpay` | 支付回调 → `confirmed` |
| POST | `/entries/:id/refund` | 申请退款 |

退款规则（暂定，可配置）：赛前 7 天以上全额 · 3–7 天退 50% · 3 天内不退 ·
组织者取消全额 · 换搭档不涉及退款。

### 签表与赛程

| Method | Path | 用途 | 对应屏 |
|---|---|---|---|
| GET | `/events/:id/draw` | 淘汰赛树或小组表 | 签表 |
| GET | `/events/:id/schedule` | 按时间排的场次 | 赛程 |
| GET | `/users/me/matches?scope=today` | 今日/进行中的场次 | **赛事 tab 首页的今日赛程区** |
| GET | `/matches/:id` | 单场详情 | 场次卡 |

> `GET /users/me/matches?scope=today` 是**第一版最关键的一个接口**。
> 记分让出了 tab 位，比赛日能不能压回 2 tap 全靠这个区置顶。它必须快、必须能缓存。

### 记分

| Method | Path | 用途 |
|---|---|---|
| POST | `/matches/:id/start` | `{serveOrder}` → `live` |
| POST | `/matches/:id/score` | `{sets, serveOrder, version}` → `pending_confirm`（幂等） |
| POST | `/matches/:id/confirm` | 对方确认 → `confirmed`，**签表推进到下一轮** |
| POST | `/matches/:id/dispute` | `{reason}` → `disputed`，比分冻结 |

确认后端要做的事：写 winnerEntryId → 填充下游 match 的 entryAId/entryBId →
若为小组赛则重算 GroupStanding → 结算 PointRecord。

### 积分

| Method | Path | 用途 |
|---|---|---|
| GET | `/rank?type=MD&season=2026&city=` | 榜单，含并列名次计算 |
| GET | `/users/me/points?type=MD&season=2026` | 积分明细，**含 0 分场次** |

---

## 四、定时任务

缺一个就会有名额烂在手里。

| Job | 触发 | 动作 |
|---|---|---|
| `expire_partner_invite` | `partnerDeadlineAt` | entry → `cancelled` |
| `expire_payment` | `paymentDeadlineAt` | entry → `cancelled`，释放名额，**触发候补转正** |
| `expire_promotion` | `promotionDeadlineAt` | entry → `cancelled`，**自动顺延下一位候补** |
| `close_registration` | `registrationDeadline` | event → `closed` |
| `send_match_reminder` | 赛前 N 小时 | 订阅消息 |

> `expire_promotion` 是其中最关键的。业余赛退赛率高，这个任务会频繁触发；
> 不实现的话每个空位都会烂在一个不响应的人手里。

---

## 五、微信能力清单

| 能力 | 用途 | 备注 |
|---|---|---|
| `wx.login` | 换 session | |
| `getPhoneNumber` | 注册步骤 1 | **需企业主体** + 用户隐私保护指引里声明「手机号」并过审；2023-08-26 起每次约 0.026–0.03 元。`code` 有效期 5 分钟且一次性，所以**授权当场就换**（`user.phone`），不能等提交 |
| `wx.requestPayment` | 报名费 | **需企业主体 + 商户号**，行政流程可能数周，建议尽早办 |
| 订阅消息 | 搭档邀请 / 支付提醒 / 候补转正 / 赛前提醒 / 待确认比分 | 授权在用户主动操作时申请，不能一进小程序就弹 |
| `onShareAppMessage` | 赛事详情、组队邀请、赛后战绩 | 获客主路径 |
| `wx.setStorageSync` | 记分离线、断网续记、杀进程恢复 | |
| `wx.loadFontFace` | 子集化数字字体（约 4KB） | |

---

## 六、尚未确定的（阻塞开发）

1. **积分规则** —— 各轮次分值 · 赛事等级系数 · 双打各得全额还是各半 · 赛季划分方式
2. **组织者后台** —— 本契约只覆盖选手端。建赛事、开比赛、抽签、排赛程、管报名
   这些写操作的接口尚未定义。**没有它，小程序里一条真实数据都没有。**
3. **企业主体与商户号** —— 支付与手机号授权的硬前提
