# 成员三进度

日期：2026-09-13
分支：feat/member-3-m3-ui
基线：feat/member-2-m2-baseline-clean @ d156856

## 已完成

- [x] 读取成员二交接、contracts 和 replay fixtures。
- [x] 使用现有 `@experience-map/contracts` 类型和 fixtures，未复制 schema。
- [x] 实现首页 `/`：主题/问题链接入口、可选条件、主案例填充和校验。
- [x] 实现任务页 `/jobs/:jobId`：四阶段状态展示、轮询、成功/失败态。
- [x] 实现地图页 `/maps/:mapId`：条件摘要、路线卡片、路线切换、阶段任务、风险和来源。
- [x] 实现来源抽屉：摘要、引用片段、缺失作者占位、知乎原文安全跳转、Esc 关闭。
- [x] 实现行动清单 `/maps/:mapId/plan`：任务勾选、本机 localStorage 保存、进度条和 Markdown 导出。
- [x] 实现响应式布局和基础键盘焦点样式。
- [x] 本地验证 `pnpm install`、`pnpm --filter @experience-map/web lint`、`pnpm --filter @experience-map/web test`、`pnpm --filter @experience-map/web build` 通过。
- [x] 已提交前端改动：`0113cec feat(web): build replay experience map flow`。

## 当前限制

- [ ] 尚未完成真实 API client；当前为 replay Mock 闭环。
- [ ] 尚未运行 Playwright（基线暂无有效 E2E 配置）。
- [ ] 尚未完成 live/replay/error 六种后端状态联调。
- [ ] GitHub 推送因网络连接重置尚未得到远端确认；本地 commit 可直接 push。
- [ ] `docs/decisions/` 中 packages 目录差异 ADR 待项目负责人统一记录。

## 下一步

1. 确认 `0113cec` 已推送到 GitHub，通知成员一和成员二审阅。
2. 等成员二完成 M2-2～M2-5 后接入 `/api/v1`，保留 `VITE_DATA_MODE=mock|live|replay`。
3. 补充有意义的前端测试：提交防重复、来源抽屉、路线切换、localStorage、导出和错误态。
4. 完成 360/390/768/1440px 截图、键盘检查和 Playwright smoke。
