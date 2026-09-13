# 成员三跨机器联调说明（不含密钥）

本文基于 `feat/integration-member-2-provider` 的集成提交，供成员三从 GitHub 拉取后进行前后端联调。文档不记录 Access Secret、Token、个人信息或真实响应内容。

## 获取代码与启动

```powershell
git clone https://github.com/hddsf263-tech/zhihu.git
cd zhihu
git fetch origin feat/integration-member-2-provider
git switch --track origin/feat/integration-member-2-provider
pnpm install
```

开发联调可同时启动 API 与 Web：

```powershell
$env:VITE_DATA_MODE='replay'   # replay 调本地 API；live 仅在已安全注入凭据时使用
pnpm dev
```

Web 默认监听 `5173`，API 默认监听 `3001`。Vite 开发代理把 `/api` 转发到本机 API；跨机器时不要把浏览器直接连到知乎或直答服务。

## 环境变量（只列变量名与配置方式）

| 变量 | 配置方式 |
| --- | --- |
| `NODE_ENV` | API 进程环境变量；生产设为 `production` |
| `API_PORT` | API 监听端口，默认 `3001` |
| `WEB_PORT` | Vite 开发端口，默认 `5173` |
| `DATABASE_PATH` | SQLite 文件路径；生产挂载到持久卷 |
| `ZHIHU_ACCESS_SECRET` | 仅由服务端环境变量或部署平台 Secret 注入；禁止写入 `.env`、镜像、日志、前端 `VITE_` 变量 |
| `ZHIHU_API_BASE_URL` | 服务端上游地址，默认 `https://developer.zhihu.com` |
| `ZHIHU_TIMEOUT_MS` | 服务端上游超时毫秒数 |
| `MODEL_PROVIDER` | 服务端模型提供方配置 |
| `MODEL_NAME` | 服务端直答模型名 |
| `VITE_DATA_MODE` | Web 构建/开发模式：`mock`、`replay` 或 `live`；不得放入密钥 |

## API 健康检查与流程

- 健康检查：`GET http://<api-host>:3001/api/v1/health`，预期 JSON `ok: true`。
- 创建任务：`POST /api/v1/maps/jobs`，请求体按 `packages/contracts`，`dataMode: "live"` 返回 HTTP `202` 与 `jobId`。
- 轮询任务：`GET /api/v1/maps/jobs/:jobId`，完成后取得 `mapId`。
- 读取地图：`GET /api/v1/maps/:mapId`。

跨机器时，成员三只需把 Web 的 API base 指向反向代理公开的同源地址，或在开发环境配置 Vite proxy 的目标为 API 主机；不要在代码中写入机器 IP、密钥或真实内容。

## Docker 与 HTTPS 要求

仓库 `Dockerfile` 构建 Node 22 API 镜像并暴露 `3001`。运行时必须把 SQLite 数据目录挂载为持久卷，并通过 Secret 注入 `ZHIHU_ACCESS_SECRET`。当前仓库未验证 Docker 实际构建/运行，因此以下为部署前检查清单：

1. 反向代理（Nginx、Caddy 或云负载均衡）终止公网 HTTPS，并仅向容器转发内网 HTTP。
2. 将 `/api/*` 转发至 API `3001`；静态 Web 由独立托管或同一代理提供，不能把 API 错误页改写成 SPA HTML。
3. 对外只开放 `443`；容器端口不直接暴露公网。
4. 配置健康检查访问 `/api/v1/health`，失败时摘除实例。
5. 生产部署前执行 `pnpm lint`、`pnpm contracts:check`、`pnpm test`、`pnpm build`；回滚使用上一镜像标签，并先备份 SQLite 文件。

负责人尚未指定云平台或可访问 HTTPS 域名，因此公网 HTTPS、证书、持久卷、Docker 运行和生产静态托管均标记为“未验证”。请负责人先选择部署目标（已有云主机 + 反向代理、容器平台或内网 HTTPS 隧道），再提供对应的非敏感连接信息。

## 成员三联调步骤

1. 从集成分支拉取代码并运行 `pnpm install`。
2. 先以 `VITE_DATA_MODE=replay` 启动，确认页面通过 `/api/v1` 代理获得回放地图。
3. API 部署负责人安全注入 `ZHIHU_ACCESS_SECRET` 后，成员三将模式改为 `live`，提交主题或问题链接，观察 202→轮询→地图读取流程。
4. 仅记录 HTTP 状态、任务状态、来源数量及证据字段存在性；真实标题、摘要、作者、URL 参数和用户内容不得进入截图、日志或仓库。
