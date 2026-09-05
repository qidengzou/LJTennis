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

两张画布**直接用浏览器打开本地文件**即可，不需要装任何东西：

```
design/stage2/ljtennis-stage2-wireframes.html    小程序侧 · 7 屏低保真线框
design/admin/ljtennis-admin-backend.html         组织者网页后台 · 8 屏
```

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

画板源文件是 `design/*/[Name].dc.html` 加 `canvas.json`。
改完要重新出稿才会反映到那两个 `ljtennis-*.html` 里 ——
出稿工具不在本仓库，直接改画板源文件后找我重新生成。
