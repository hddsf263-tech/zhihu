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