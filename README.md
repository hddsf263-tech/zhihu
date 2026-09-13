# zhihu

知乎经验地图黑客松项目。

## 成员二 M2-0 / M2-1 基线

本分支提供共享 workspace、API/Web 工程基线、`packages/contracts` 数据契约和 replay fixtures。成员三可基于 `@experience-map/contracts` 与 `@experience-map/contracts/fixtures` 开始 M3-0 页面开发。

```text
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm contracts:check
```

后端和前端源码保留在 `packages/api`、`packages/web`；浏览器不得直连知乎或模型服务，真实凭证只允许放在后端环境变量中。
## 成员三：本地 API 联调

最新验收与后端待修复项见 [联调交接](docs/reviews/member-3-integration-handoff.md)。

未设置 `VITE_DATA_MODE` 时 Web 默认 replay：通过 Vite 同源代理请求本地 API。`pnpm dev` 同时启动 Web/API，打开 http://127.0.0.1:5173。

- mock：共享合成 fixture；不请求后端。
- replay：三个 `/api/v1` HTTP 接口；当前返回合成固定实习案例。
- live：同一接口发送 live，请先完成后端真实 Provider 验收。

Windows 使用已安装 Edge 测试：`$env:PLAYWRIGHT_CHANNEL='msedge'` 后执行 `pnpm test:e2e`。测试自行启动 API 3019 / Web 5179，并清空测试进程 Access Secret，不请求知乎。
