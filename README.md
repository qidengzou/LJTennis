# LJTennis 设计

微信小程序 · 业余网球单双打赛事：**报名 → 记分 → 出分**

## 先读哪个

规格拆成三份，**一份只管一层**：

| 顺序 | 文件 | 回答什么 | 不回答什么 |
|---|---|---|---|
| 1 | **[PRD.md](PRD.md)** | 做什么、给谁、什么算做完 | 怎么实现 |
| 2 | **[SPEC.md](SPEC.md)** | 数据模型、页面、枚举、实现约束、待修 | 为什么这么定 |
| 3 | **[design/DESIGN.md](design/DESIGN.md)** | 颜色、字号、控件、图片、画布索引 | 业务规则 |
| 4 | [api/types.ts](api/types.ts) | 实体与状态机的**真身**，过 `tsc --strict` | |
| 5 | [api/endpoints.md](api/endpoints.md) | 24 条接口 · 鉴权 · 幂等 · 定时任务 | |

> **一个事实只定义一处，别处只引用。** 冲突时：类型和状态以 `api/types.ts`
> 为准，接口以 `api/endpoints.md` 为准，产品规则以 `PRD.md` 为准，页面结构以
> `SPEC.md` 为准，视觉以 `mp/miniprogram/styles/tokens.wxss` 为准。
>
> 早期那份 `设计流程.md`（决策日志，含被推翻的方案）已从工作区移除，
> 只留在历史里：`git show 7448efd:设计流程.md`。

## 设计稿怎么看

四张画布**直接用浏览器打开本地文件**即可，不需要装任何东西：

```
design/skeleton/ljtennis-miniprogram-skeleton.html   26 页结构图
design/home/ljtennis-tournament-home.html            赛事首页 · 线框与高保真
design/stage2/ljtennis-stage2-wireframes.html        阶段 2 线框 · 7 屏
design/admin/ljtennis-admin-backend.html             组织者网页后台 · 8 屏
```

画布按**一屏一张**组织：结构图只放结构图，单屏的线框与高保真各自独立成张。

可以缩放、平移、导出 PNG/PDF。每屏下方的红色编号是**设计批注** ——
那里写的是「为什么这么放」，比图本身信息量大。

高保真稿（阶段 4，小程序侧）：

```
design/hifi-matchday.html        比赛日全链路 13 屏
design/hifi-registration.html    报名链路 12 屏
design/hifi-account.html         注册与个人
design/hifi-rank.html            积分榜
design/design-system-v2.html     设计系统（记分器是可运行原型）
design/ia-v2.html                信息架构
design/wireframes.html           第一版线框 11 屏（已被 stage2 取代大半）
```

## 小程序工程

```
mp/
  miniprogram/   14 个页面 · 设计令牌 tokens.wxss（v0.4，权威副本）
  cloudfunctions/api/   24 条路由
  test/          165 项单测
  scripts/       7 个检查脚本
```

```bash
cd mp && npm run verify     # 7 项检查 + 165 项单测
```

`config/env.js` 的 `useMock` 现在是 `true` —— 阶段 5–8 搁置期间走本地
假数据，小程序独立可跑，不需要云环境。

> ⚠️ **代码里还有三处与规格不符**，见 [SPEC.md](SPEC.md) §5，以及正文里标
> **待修**的地方：名额判定只数 `confirmed`（会超发）、19 处引用已废弃的
> `pending_payment`、记分引擎不支持金球。恢复后端工作时一并处理。

## 改画布

一个目录就是一张画布：

```
design/home/
  Main.dc.html Cards.dc.html …   ← 画板源文件，一个画板一个文件
  canvas.json                    ← 画板在画布上的位置
  _hifi.txt _wf.txt              ← 共用样式（每个 .dc.html 内联一份副本）
  cover.jpg                      ← 图片素材
  ljtennis-tournament-home.html  ← 出稿产物，2.4MB，就是画布本身
```

**改设计改 `.dc.html`**，那个 `ljtennis-*.html` 是每次重新生成的产物，别手改。
出稿工具不在本仓库 —— 改完画板源文件找我重新生成。

> ⚠️ `_style.txt` 是样式的源，但每个 `.dc.html` 里内联了一份副本。
> 改了源要重新灌进所有画板，否则只有新建的画板会跟上。
