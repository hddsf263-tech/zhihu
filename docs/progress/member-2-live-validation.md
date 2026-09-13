# M2 真实知乎 API 脱敏联调记录

日期：2026-09-13
分支：`feat/integration-member-2-live-validation`（基于 `3928028e02e4aff1e9363d2f983d032844d02a6e`）

## 已完成的只读核对

- Provider 使用官方 `GET /api/v1/content/zhihu_search` 与 `GET /api/v1/content/question_answers`。
- 生产 ModelAdapter 使用 `POST /v1/chat/completions`；测试路径保留 Deterministic 适配器。
- 项目 API 路由：`POST /api/v1/maps/jobs`、`GET /api/v1/maps/jobs/:jobId`、`GET /api/v1/maps/:mapId`。
- `packages/contracts` 未修改，`main` 未修改。

## 凭据与真实联调状态

知乎 CLI 状态检查显示系统密钥链已配置凭据，但当前 API 工作树进程未发现 `ZHIHU_ACCESS_SECRET` 环境变量。没有从密钥链导出、打印或写入 Access Secret，因此项目 API 进程的 live 端到端调用暂未执行。

此前官方 CLI 已分别成功完成知乎搜索、问题回答摘要、知乎直答各 1 次；这证明 CLI 凭据与上游可用，但不替代项目 API 进程的 live 验收。

## 可复现的安全联调步骤

1. 由部署负责人在 API 进程启动环境中注入 `ZHIHU_ACCESS_SECRET`（仅环境变量/平台 Secret，不能写入仓库、日志或前端）。
2. 启动 API 后提交 `POST /api/v1/maps/jobs`，请求体使用 `dataMode: "live"`；主题模式触发知乎搜索，问题链接模式触发问题回答摘要。
3. 记录 202 与 `jobId`，轮询 `GET /api/v1/maps/jobs/:jobId`，成功后用返回 `mapId` 请求 `GET /api/v1/maps/:mapId`。
4. 仅记录脱敏元数据：方法/路径、HTTP 状态、任务状态、来源数量、`sourceId/evidenceId/quote` 字段是否存在；不得保存标题、摘要、作者、URL 参数或用户内容。
5. 直答由后端调用 `/v1/chat/completions`；401/403、429、超时、无效 JSON 分别核对 `UPSTREAM_AUTH`、`UPSTREAM_RATE_LIMIT`、`UPSTREAM_TIMEOUT`、`MODEL_INVALID_OUTPUT` 映射。

## 未验证项与限制

- 项目 API 的真实 live 搜索、问题回答、直答：未验证（缺少安全注入到该进程的环境变量）。
- 上游真实响应字段完整性、额度消耗、限流/超时：未在项目进程验证。
- Docker、HTTPS、公网部署、生产静态托管：未验证。
- 不得将 CLI 的成功调用描述为项目 API live 验收通过。
