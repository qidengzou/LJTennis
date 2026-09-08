# LJTennis

微信小程序 · 业余网球单双打赛事：**报名 → 记分 → 出分**。
根目录是规格与设计稿，`mp/` 是小程序工程，`api/` 是契约。

## 规格写在哪 —— 动手前先看这条

| 要写/要查的东西 | 归哪份 |
|---|---|
| 做什么、给谁、什么算做完、业务规则 | `PRD.md` |
| 数据模型、页面清单、枚举含义、实现约束、待修 | `SPEC.md` |
| 颜色、字号、控件高度、图片规格、画布索引 | `design/DESIGN.md` |
| 实体与状态机的**真身** | `api/types.ts`（过 `tsc --strict`） |
| 接口、鉴权、幂等、定时任务 | `api/endpoints.md` |

> **一个事实只定义一处，别处只引用。**
> 冲突时：类型和状态以 `api/types.ts` 为准，接口以 `api/endpoints.md` 为准，
> 产品规则以 `PRD.md` 为准，页面结构以 `SPEC.md` 为准，
> 视觉以 `mp/miniprogram/styles/tokens.wxss` 为准。
>
> 早期的决策日志已从工作区移除，只留在历史里：`git show 7448efd:设计流程.md`。
>
> 具体地说：**不要把枚举值抄进 markdown**，写「状态见 `api/types.ts`」。
> 抄一遍就是多一处会过期的地方 —— `design/hifi-*.html` 就是这么烂掉的。

## 命令

```bash
cd mp && npm run verify     # = check + test，提交前必须过
cd mp && npm run check      # 六个静态检查：路由/绑定/WXML/共享代码/主题/图片
```

`check` 里的 `check-theme.js` 是**反向守卫**：断言全站没有深色模式分支。
`check-images.js` 管尺寸和主包体积（2 MB 上限）。这些不是建议，是门。

## 术语 —— 最容易写错的一处

界面文案和注释里必须这么叫：

| 模型 | 界面用词 | 绝不能叫 |
|---|---|---|
| `Tournament` | **赛事** | — |
| `Event` | **比赛**（男双/女双/混双） | ~~项目~~ |
| `Match` | **场次** | ~~比赛~~ |
| `Entry` | **报名 / 参赛** | ~~组合~~（单打只有一人） |
| `Entry` 的计数单位 | 双打 **队**、单打 **人**（16 队 / 16 人） | ~~组~~ |

`Entry` 是关键抽象：单打 1 人、双打 2 人，签表和积分都挂在它上面。

> **「组」只指小组循环的小组**（A 组 / B 组），不指一对搭档 ——
> 两个都叫「组」，「每组 4 组」就读不通了。

## 小程序硬约束

- **单位是 rpx**，设计稿宽 750rpx = 屏宽。1 设计稿 px = 1rpx
- **全站不做深色模式**，`app.json` 的 `darkmode` 为 `false`，样式里不许出现
  `prefers-color-scheme`
- `<input>` `<button>` 是**原生组件**：垂直 padding 不撑内部行盒，
  高度要显式写（`--h-control: 88rpx`）；`placeholder-class` 不继承字号
- WXSS 的 `background-image` **不能用包内本地图**，要用 `<image>` 标签
- `wx.switchTab` **带不了参数**，跨 tab 传值走本地存储
- 假数据模式：`mp/miniprogram/config/env.local.js`（**不进版本库**）

## 改设计画布

画布源文件在 `design/<名字>/`：`*.dc.html` 是画板，`canvas.json` 是布局，
`ljtennis-*.html` 是生成物（浏览器双击可开）。

改法：改 `*.dc.html` → 用 `/design` 技能里的 `seed-canvas.mjs` **重新生成**
→ 用 Artifact 工具发布**到原 URL**（不传 `url` 会新建一个）。

**只画高保真，不画线框。** 设计系统已定稿（`tokens.wxss`），套令牌画和画灰盒子
一样快，两套稿只会各自漂移 —— `design/stage2/` 那批线框就是这么废掉的。
结构先在 `PRD.md` 里用文字定，定完直接出高保真。

> 线框真正的价值是**批注**（`.anns` 那几条「为什么这么排」），不是灰盒子。
> 高保真照样带批注，那部分一条都别省。

> ⚠️ 坑：`_style.txt` 只是样式的存档，**每个 `.dc.html` 内联着自己的一份**。
> 改了 `_style.txt` 不等于改了已有画板 —— 要逐个注回去。

## 不要碰

- **AppSecret、商户号密钥从来不进代码**，一次也没有过，保持下去
- `env.local.js` 已在 `.gitignore` 里，别改回来
- `admin.*` 路由**目前没有鉴权**（见 `SPEC.md` §5），有真实用户前必须补上
