# 部署与回滚

- 单容器运行 Node 22，API 使用 `/api/v1`，前端静态文件由同一入口提供；生产环境由反向代理终止 HTTPS。
- `ZHIHU_ACCESS_SECRET` 只注入服务端环境变量，不进入镜像、日志或浏览器 bundle。
- API 默认将 SQLite 写入 `DATABASE_PATH`（默认 `./data/experience-map.db`），生产环境应把其父目录挂载为持久卷；启动时自动执行 `packages/api/migrations/001_init.sql`。
- SQLite 使用 WAL 模式；进程收到 SIGINT/SIGTERM 时关闭 HTTP 服务和数据库连接。
- 发布前执行 `pnpm lint && pnpm contracts:check && pnpm test && pnpm build`。
- 回滚：保留上一镜像 tag，停止当前容器并切回上一 tag；SQLite 文件先只读备份，再执行回滚。
