# 部署与回滚

- 单容器运行 Node 22，API 使用 `/api/v1`，前端静态文件由同一入口提供；生产环境由反向代理终止 HTTPS。
- `ZHIHU_ACCESS_SECRET` 只注入服务端环境变量，不进入镜像、日志或浏览器 bundle。
- 数据库挂载到 `DATABASE_PATH` 对应持久卷；迁移脚本位于 `packages/api/migrations/`。
- 发布前执行 `pnpm lint && pnpm contracts:check && pnpm test && pnpm build`。
- 回滚：保留上一镜像 tag，停止当前容器并切回上一 tag；SQLite 文件先只读备份，再执行回滚。
