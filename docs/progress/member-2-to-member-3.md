# 成员二 → 成员三交接

日期：2026-09-13

> 沟通方式：成员三不在本地工作区，由项目负责人通过其他 App 转发本交接内容。

## 成员二当前进度

成员二已完成 M2-0 和 M2-1：

- 已建立 pnpm workspace、Express API、React/Vite 工程、根脚本、CI 和环境变量模板；
- 已建立 `packages/contracts`，完成 Zod 数据契约、推导类型、错误结构和 replay fixture；
- 已提供 API 基线、演示任务和演示经验地图；
- 正在进行基线验收：`pnpm install`、`pnpm lint`、`pnpm test`、`pnpm build`、`pnpm contracts:check`。

成员二后续负责 M2-2～M2-5：知乎 Provider、内容整理与证据校验、任务/缓存/SQLite、安全日志和部署。真实知乎接口尚未核验，不应作为前端当前工作的前置条件。

## 成员三现在可以做什么

成员三可以立即开始 M3-0，并行使用 replay 数据完成页面开发：

1. 只从 `@experience-map/contracts` 和 `@experience-map/contracts/fixtures` 导入类型、schema 和示例数据；
2. 建立 `/`、`/jobs/:jobId`、`/maps/:mapId`、`/maps/:mapId/plan` 页面路由；
3. 完成首页输入、任务状态页、经验地图页、路线比较、来源抽屉、行动清单和导出入口；
4. 建立 Mock API client，让首页到行动清单的主流程可操作；
5. 使用 fixture 验证路线、阶段、task、evidence、source 的 ID 关联；
6. 可以先做响应式、键盘操作和页面骨架，不必等待真实 Provider 或 OAuth。

项目负责人可直接转发本文件，或至少转发“当前进度”和“成员三现在可以做什么”两节。

## 交接边界

- 不要复制或重新设计 contracts；
- 不要自行猜测字段或使用 `as any` 绕过类型；
- 浏览器不得直连知乎或模型服务；
- 不要把 replay 合成数据标成实时结果；
- 契约字段如需修改，先同步成员二并记录 ADR；
- 成员二完成 M2-2～M2-5 后，再接入 live/replay/error 六种真实状态和 202 轮询。

## 当前可依赖的入口

- `packages/contracts/src/index.ts`
- `packages/contracts/src/fixtures.ts`
- `packages/api/src/server.ts`
- `packages/web/src/main.tsx`

