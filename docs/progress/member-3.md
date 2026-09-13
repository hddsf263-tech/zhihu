# 成员三进度

更新：2026-09-13
分支：feat/member-3-m3-api-integration
父基线：ae5b8dd（M3） + b88d9d0（M2 安全加固）

## 已验证

- 已修复旧前端漏掉 createRoot 挂载造成的空白页；旧占位测试不能视为页面可用证据。
- 四条路由已通过同源 HTTP /api/v1 接通本地后端 replay。
- 使用共享 contracts 与 fixture，没有复制 schema 或修改后端 DTO。
- 表单校验、幂等键、防重复提交、任务终态停止、95 秒边界、空路线、无效 routeId 均有验证。
- 路线对比、来源抽屉焦点/高亮、合成地址禁跳、本机清单保存及 Markdown 导出通过实际浏览器流程。
- pnpm test：24 项；pnpm lint / contracts:check / build 均通过。
- Playwright Edge E2E：16 项通过；360/390/768/1440 宽度无横向溢出。
- 合成 fixture、真实 HTTP 回放、受控 live 响应测试的边界已明确；没有调用真实知乎或读取 Secret。

## 待团队完成

- 真实 Provider 的请求协议需按官方文档修正；DeterministicModelAdapter 还不是模型多路线生成。
- SQLite 持久化、全任务超时、真正并发/缓存、生产静态托管/Docker/HTTPS 尚待成员二。
- DataStatus 无 cache 枚举；未来缓存元信息需契约协商，不在前端私加。
- 更换成真实内容后，成员一人工审核证据与路线；最终视觉和演示视频后续完成。

完整交接与运行方式：[member-3-integration-handoff.md](../reviews/member-3-integration-handoff.md)。
