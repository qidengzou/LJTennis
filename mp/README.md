# LJTennis 小程序

业余网球双打赛事：报名 → 记分 → 积分。基于微信云开发。

设计与契约文档见上层目录：`PRD.md`、`SPEC.md`、`design/`、`api/`。

## 跑起来

1. 微信开发者工具打开本目录（`mp/`）
2. **填云环境 ID** → `miniprogram/config/env.js` 的 `cloudEnv`
   （工具右上角「云开发」→ 环境设置 → 环境 ID）
3. 不填也能跑 —— 当前是本地假数据模式，记分链路完全可用

## 已实现

| 模块 | 状态 |
|---|---|
| tabBar 三个 tab（赛事 / 积分 / 我的） | ✅ 含深色模式 |
| 设计令牌接入 | ✅ `styles/tokens.wxss`，零硬编码颜色 |
| 计分引擎 | ✅ 纯函数 + 25 项单测 |
| 开局设置（发球顺序推导） | ✅ |
| 记分器（双打轮转 / 抢七 / 撤销 / 离线） | ✅ |
| 赛事 tab 今日比赛区 | ✅ 假数据 |
| 签表 · 轮次分页（方案 B） | ✅ 含我的路径筛选 |
| 签表 · 小组循环 + 积分表 | ✅ 含出线标记与净胜局 |
| 签表 · 全览图（canvas bracket） | ✅ 拖动 + 双指缩放 |
| 报名链路（详情 → 项目 → 组队 → 支付 → 我的报名） | ✅ 状态机 + 实时倒计时 |
| 云函数（api 分派 + scheduler 定时） | ✅ 30 项单测（内存 db） |
| 云环境未配置时自动降级本地假数据 | ✅ |
| 积分 / 我的主页 | ⬜ 占位 |

## 测试与校验

```bash
npm run verify     # 一致性校验 + 全部单测（131 项）
npm test           # 只跑单测
npm run check      # 只跑校验：共享逻辑一致 + 云函数路由完整
npm run sync-shared   # 把 miniprogram/utils/entry.js 同步到云函数
```

| 文件 | 覆盖 |
|---|---|
| `test/tennis.test.js` | 计分引擎 25 项 |
| `test/integration.test.js` | 发球轮转与页面数据流 6 项 |
| `test/draw.test.js` | 签表逻辑与 bracket 几何 28 项 |
| `test/entry.test.js` | 报名状态机 42 项 |
| `test/cloud.test.js` | 云函数 handler 30 项（内存 db 注入） |

## 云函数

**两个函数**，不是几十个 —— 冷启动是记分链路的实际风险，函数越少常驻实例命中率越高。

| 函数 | 职责 |
|---|---|
| `api` | 全部业务，按 `action` 分派（23 条路由，命名对齐 `api/endpoints.md`） |
| `scheduler` | 定时任务。**5 个 job 合并成一个每分钟扫描**，因为顺序重要：支付超时释放名额后必须紧接着触发候补转正 |

部署：开发者工具右键 `cloudfunctions/api` → 上传并部署（云端安装依赖），`scheduler` 同理。
首次部署后调用一次 `admin.initDb` 建集合。

`miniprogram/utils/entry.js` 与 `cloudfunctions/api/shared/entry.js` 是**同一份纯逻辑**
（性别校验、名额判定、退款规则），`npm run check` 会验证两者字节一致 ——
否则会出现「前端说能报、后端说不能」这类最难查的 bug。

## 目录

```
miniprogram/
  config/env.js       云环境 ID（需填）
  styles/tokens.wxss  设计令牌 v0.3
  utils/tennis.js     计分引擎（纯函数，可单测）
  utils/draw.js       签表逻辑：小组积分 / 轮次归组 / bracket 几何（纯函数）
  utils/entry.js      报名状态机：性别校验 / 名额判定 / 退款 / 倒计时 / 候补顺延（纯函数）
  utils/palette.js    令牌的 JS 镜像，仅供 canvas 使用（改令牌须同步）
  utils/store.js      本地存储：跨页传参 / 断网续记 / 杀进程恢复
  mock/data.js        假数据
  pages/
    tournament/       赛事 tab —— 今日比赛区 + 赛事列表
    rank/             积分 tab —— 占位
    me/               我的 tab —— 占位
    tournament/detail 赛事详情（分享落地，免登录）
    event/detail/     项目详情（含满员候补）
    entry/create/     发起报名 · 选搭档
    entry/invite/     组队邀请（分享落地，免登录）
    entry/pay/        支付确认（倒计时）
    me/entries/       我的报名 · 五状态
    draw/             签表 —— 轮次分页 / 小组循环
    draw/overview/    签表全览图（canvas）
    score/setup/      开局设置
    score/live/       记分器
cloudfunctions/
  quickstartFunctions/  模板自带，尚未改造
test/                 node 单测
```

## 下一步

1. 云函数按 `api/endpoints.md` 拆分实现
2. 注册两步流程（手机号 + 昵称性别）
3. 积分榜与我的主页
