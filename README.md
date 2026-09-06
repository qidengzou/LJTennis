# LJTennis 设计

微信小程序 · 业余网球单双打赛事：**报名 → 记分 → 出分**

## 先读哪个

| 顺序 | 文件 | 是什么 |
|---|---|---|
| 1 | **[设计定稿0.md](设计定稿0.md)** | **规格书。只有结论，14 章。照这个做。** |
| 2 | [api/types.ts](api/types.ts) | 实体与状态机，过 `tsc --strict` |
| 3 | [api/endpoints.md](api/endpoints.md) | 24 条接口 · 鉴权 · 幂等 · 定时任务 |
| — | [设计流程.md](设计流程.md) | **过程日志，不是规范。** 回答「为什么这么定」，里面有被推翻的方案 |

> ⚠️ 定稿与流程冲突时**以定稿为准**。流程日志保留了作废的结论是故意的 ——
> 它记录的是决策过程。

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

## 这里没有的

小程序工程代码不在本仓库。设计令牌的权威副本在那边
（`mp/miniprogram/styles/tokens.wxss`，v0.4），本仓库
[设计定稿0.md §12](设计定稿0.md) 有完整摘录。

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
