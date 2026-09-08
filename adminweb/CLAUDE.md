# adminweb —— 组织者网页后台

赛前用的桌面端后台：建俱乐部、建赛事、审批入会、签表。
**React + Vite + TypeScript**，同仓子目录，和 `mp/` 平级。

设计稿在 `design/admin/`（9 屏，双击 `ljtennis-admin-backend.html` 打开）。
根目录那份 `CLAUDE.md` 仍然管着：术语、规格归属、不要碰的东西 —— 那些不在这里重复。

## 边界 —— 先读这条

**后台不新开后端。** 它和小程序调的是**同一个** `api` 云函数分发器
（`mp/cloudfunctions/api/`），只是换了客户端：`@cloudbase/js-sdk` 的 `callFunction`，而不是 `wx.cloud.callFunction`。

不要为后台写第二套 handler，也不要在前端直连数据库。要加接口就去改那个分发器，并同步 `api/endpoints.md`。

**该做什么、不该做什么**看 `PRD.md` §2 的「现场 vs 赛前」：记分、改比分、处理争议是**现场**的事，留在小程序里，别因为后台屏大就挪来。

## 契约：直接编译 `api/types.ts`，不许抄

```ts
// tsconfig.json
"include": ["src", "../api/types.ts"],
"paths":   { "@api/types": ["../api/types.ts"] }
```

```js
// vite.config.ts —— 两处都要，少一处 dev 会 403
resolve: { alias: { '@api/types': path.resolve(__dirname, '../api/types.ts') } },
server:  { fs: { allow: ['..'] } }   // types.ts 在 Vite root 之外
```

- 顺带：**在 adminweb 之前，`api/types.ts` 根本没有自动检查**，只靠人手跑 `tsc`。`npm run verify` 配好之后它才第一次被门管起来

## 目录

```
src/
  pages/        一个路由一个文件夹，和 design/admin/ 的 9 屏对应
  components/   跨页复用才放这儿；只用一次的就留在 pages/ 里
  lib/
    cloud.ts    单例 app + auth + 一个 call() 包住 callFunction
    session.ts  当前登录用户 + 当前俱乐部
```

## 硬约束

- **单位是 px，不是 rpx。** 颜色令牌和小程序共用一套（`design/DESIGN.md` §1），
  尺寸令牌各一套：桌面控件 `--h-ctl: 36px`。`88rpx`（44pt）那条是给手指的，
  鼠标不需要。现成的一套变量在 `design/admin/_style.txt` 里，照抄过来
- **不做深色模式**，全站同一条。样式里不许出现 `prefers-color-scheme`
- **hash 路由**。静态托管没有 rewrite，history 模式刷新子路由会 404。
  真要上 history，必须把托管的「404 错误文档」配成 `index.html` ——
  不配就是坏的，而且只在刷新时坏，本地跑看不出来
- **不许用 `any` 绕类型**：不写 `: any`、`as any`、`@ts-ignore`。
  边界上形状真的未知就用 `unknown` 再收窄。`any` 会静默扩散，
  而类型是这个项目唯一的编译期安全网
- **密钥一律不进代码**。环境 ID 走 `.env.local`（已在 `.gitignore` 的
  `node_modules/` 之外另加），AppSecret、商户号密钥从来没进过代码，保持下去

## 状态怎么放

**服务端数据不进全局 store。** 每页自己取自己的，取完就地渲染 ——
后台的页面之间几乎不共享数据，一个全局 store 只会让「这份列表是什么时候
取的」变得没人说得清。

真正全局的只有两样：**当前登录用户**和**当前选中的俱乐部**，放 `lib/session.ts`。

## 门

```bash
cd adminweb && npm run verify   # = tsc --noEmit + lint + build
```

三条都必须过才算完。**「能编译」不等于做完** —— 改了路由、表单、鉴权或者
任何异步流程，得真的在浏览器里把那条路走一遍，并写清楚查了什么：
哪条路由、什么操作、预期什么、实际什么。

## 鉴权 —— 还没有，且**阻塞**

`admin.*` 路由**现在没有任何鉴权**，而 `users.phoneEncrypted` 存的是明文。
两件事必须一起补，见 `SPEC.md` §5.2。

在补完之前，**不要把后台部署到公网**。今天这个洞暴露面小是因为根本没有
admin 客户端；后台一上静态托管，就变成「公网上一个页面，背后一条谁都能
调的路由，返回明文手机号」。

登录用的是**微信扫码**（`design/admin/Login.dc.html` 已经画好），
身份两层：`PlatformRole` 决定能不能建俱乐部，`ClubRole` 决定能管哪个俱乐部。
**平台管理员不自动获得各俱乐部的数据权限** —— 这条是刻意的，见 `PRD.md` §2。
