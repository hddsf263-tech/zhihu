# 成员三 API 联调包

基线：`feat/member-2-m2-provider-protocol`，commit `5ab0b49ae80b07037a67f5d4140d349a236006d4`。

本说明以 `packages/contracts` 为唯一数据契约。前端不要复制或修改 schema，也不要直接访问知乎开放平台或模型服务。

## 1. 服务地址与通用约定

- 本地 API 默认地址：`http://localhost:3001`
- 接口前缀：`/api/v1`
- 请求与响应：`application/json`
- 创建任务建议始终发送 `Idempotency-Key`。同一个键和同一个请求会返回原任务；同一个键对应不同请求会返回 HTTP `409`。
- `replay` 使用合成 fixture，不调用知乎或模型；`live` 才调用真实上游。
- 浏览器只能调用本项目 API，不得携带 `ZHIHU_ACCESS_SECRET`。

## 2. 三个固定接口

### POST `/api/v1/maps/jobs`

创建异步任务。合法请求返回 HTTP `202`，并不表示地图已经生成。

主题模式请求：

```json
{
  "inputMode": "topic",
  "query": "大学生如何准备第一份产品经理实习？",
  "questionUrl": null,
  "focus": null,
  "constraints": {
    "background": "零实习经历",
    "weeks": 8,
    "hoursPerWeek": 10,
    "budgetCny": 500
  },
  "dataMode": "replay"
}
```

问题链接模式必须使用完整知乎问题 URL，并将 `query` 设为 `null`：

```json
{
  "inputMode": "question_url",
  "query": null,
  "questionUrl": "https://www.zhihu.com/question/19581624",
  "focus": null,
  "constraints": {
    "background": null,
    "weeks": null,
    "hoursPerWeek": null,
    "budgetCny": null
  },
  "dataMode": "live"
}
```

HTTP `202` 响应：

```json
{
  "jobId": "job_example",
  "status": "queued",
  "pollAfterMs": 1500
}
```

创建阶段可能直接返回：

| HTTP | 场景 | `error.code` |
|---:|---|---|
| 400 | 请求不符合 contracts | `VALIDATION_ERROR` |
| 409 | 幂等键绑定了不同请求 | `IDEMPOTENCY_CONFLICT` |
| 500 | 创建阶段内部异常 | `INTERNAL_ERROR` |

### GET `/api/v1/maps/jobs/:jobId`

轮询任务。已知任务返回 HTTP `200`。`status` 依次可能为：

```text
queued -> retrieving -> organizing -> validating -> succeeded
                                                 \-> failed
```

成功任务响应：

```json
{
  "jobId": "job_example",
  "status": "succeeded",
  "message": "已整理完成",
  "mapId": "map_example",
  "error": null,
  "retryable": false,
  "createdAt": "2026-09-13T06:00:00.000Z",
  "updatedAt": "2026-09-13T06:00:02.000Z"
}
```

失败任务仍是 HTTP `200`，失败原因位于任务体：

```json
{
  "jobId": "job_example",
  "status": "failed",
  "message": "整理失败",
  "mapId": null,
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "整理结果未通过校验，请稍后重试。",
    "retryable": true,
    "requestId": "req_example"
  },
  "retryable": true,
  "createdAt": "2026-09-13T06:00:00.000Z",
  "updatedAt": "2026-09-13T06:00:10.000Z"
}
```

未知或过期任务返回 HTTP `404`，`error.code` 为 `JOB_EXPIRED`。

### GET `/api/v1/maps/:mapId`

成功任务取得 `mapId` 后读取地图。存在时返回 HTTP `200` 和 `ExperienceMap`；不存在时返回 HTTP `404`，`error.code` 为 `JOB_EXPIRED`。

地图字段必须直接使用 `ExperienceMapSchema` 对应类型，主要包括：`routes`、`differences`、`evidence`、`sources`、`limitations` 和 `dataStatus`。

## 3. 前端 202 创建与轮询流程

1. 生成一个稳定且仅用于本次提交的 `Idempotency-Key`。
2. 调用 `POST /api/v1/maps/jobs`。
3. 收到 `202` 后保存 `jobId`，等待 `pollAfterMs`。
4. 调用 `GET /api/v1/maps/jobs/:jobId`。
5. `queued/retrieving/organizing/validating`：继续轮询。
6. `succeeded`：停止轮询，使用 `mapId` 请求地图。
7. `failed/expired`：停止轮询，展示 `error.code` 对应状态；仅当 `retryable=true` 时提供重试。
8. 页面卸载或用户取消时，取消前端定时器和未完成的 fetch。

示例客户端：

```ts
import {
  CreateMapJobResponseSchema,
  ExperienceMapSchema,
  JobSchema,
  type CreateMapJobRequest
} from '@experience-map/contracts';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export async function createAndWaitForMap(input: CreateMapJobRequest, idempotencyKey: string) {
  const createdResponse = await fetch(`${API_BASE}/api/v1/maps/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input)
  });
  if (createdResponse.status !== 202) throw await createdResponse.json();
  const created = CreateMapJobResponseSchema.parse(await createdResponse.json());

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, created.pollAfterMs));
    const jobResponse = await fetch(`${API_BASE}/api/v1/maps/jobs/${created.jobId}`);
    if (!jobResponse.ok) throw await jobResponse.json();
    const job = JobSchema.parse(await jobResponse.json());
    if (job.status === 'failed' || job.status === 'expired') throw job.error ?? job;
    if (job.status === 'succeeded') {
      const mapResponse = await fetch(`${API_BASE}/api/v1/maps/${job.mapId}`);
      if (!mapResponse.ok) throw await mapResponse.json();
      return ExperienceMapSchema.parse(await mapResponse.json());
    }
  }
}
```

## 4. 六种联调状态

六种异步状态的创建接口均返回 HTTP `202`；轮询已知任务均返回 HTTP `200`。`empty/rate-limit/timeout/invalid-map` 通过轮询任务体里的 `status=failed` 与 `error.code` 区分。

| 状态 | 启动或触发方法 | 创建 HTTP | 轮询结果 | 地图 GET |
|---|---|---:|---|---|
| `live` | `dataMode: "live"`，服务端配置有效上游凭据 | 202 | `succeeded` + `mapId` | 200 |
| `replay` | `dataMode: "replay"`；不需要凭据 | 202 | 立即为 `succeeded` | 200，`dataStatus.mode=replay` |
| `empty` | 自动测试注入返回空列表的 Provider | 202 | 200，`failed/UPSTREAM_EMPTY` | 不调用 |
| `rate-limit` | 自动测试注入 `UPSTREAM_RATE_LIMIT`；Provider 测试另覆盖 HTTP 429 与业务码 `30001` | 202 | 200，`failed/UPSTREAM_RATE_LIMIT` | 不调用 |
| `timeout` | 自动测试注入 `UPSTREAM_TIMEOUT`；Provider 测试另覆盖 AbortError | 202 | 200，`failed/UPSTREAM_TIMEOUT`，`retryable=true` | 不调用 |
| `invalid-map` | 自动测试注入不满足 Zod 的模型输出 | 202 | 200，`failed/MODEL_INVALID_OUTPUT` | 不调用 |

本地可重复验证命令：

```text
pnpm --filter @experience-map/api test
```

证据位置：

- 三个接口、live/replay 和四种错误任务：`packages/api/src/server.test.ts`
- HTTP 429、业务码 30001、超时、空结果、官方 GET 参数和响应字段：`packages/api/src/providers.test.ts`
- invalid-map 与来源证据门槛：`packages/api/src/pipeline.test.ts`
- replay 不调用上游、幂等、并发和 SQLite 重启：`packages/api/src/job-manager.test.ts`

说明：当前没有公开的开发开关可让运行中的生产 API 人为制造上游错误。错误态通过依赖注入测试触发，避免在生产接口中加入危险的调试入口。

## 5. Fixtures

前端可直接引用 contracts 包中的 replay fixture：

```ts
import {
  emptyResultFixture,
  invalidMapFixture,
  rateLimitFixture,
  replayJob,
  replayMap,
  timeoutFixture
} from '@experience-map/contracts/fixtures';
```

- `replayJob`、`replayMap`：完整成功场景。
- 其他四个 fixture：用于错误卡片文案和状态视觉测试。
- fixture 是合成测试数据，UI 必须显示 `dataStatus.notice`，不得标成实时知乎结果。

## 6. 环境变量

只配置变量，不把任何真实值写进 Git、截图、日志或浏览器：

| 变量 | 所属端 | 配置方式 |
|---|---|---|
| `API_PORT` | API | 本地 shell 或部署平台普通环境变量 |
| `DATABASE_PATH` | API | 指向挂载持久卷中的 SQLite 文件；本地默认在被忽略的 `data/` |
| `ZHIHU_ACCESS_SECRET` | API | 仅用系统凭据库、部署平台 Secret 或进程环境安全注入 |
| `ZHIHU_API_BASE_URL` | API | 通常使用 `.env.example` 中的官方域名 |
| `ZHIHU_TIMEOUT_MS` | API | 上游请求超时毫秒数 |
| `MODEL_PROVIDER` | API | 当前约定为 `zhida` |
| `MODEL_NAME` | API | 使用账号有权限的知乎直答模型 |
| `VITE_API_BASE_URL` | Web | 前端只配置本项目 API 地址；可暴露但不得含密钥 |
| `VITE_DATA_MODE` | Web | `mock/replay/live` 的 UI 切换标志；最终行为以请求体 `dataMode` 为准 |

## 7. Mock API Client 切换到真实 API Client

1. 保留 Mock Client，新增 Real Client；两者实现相同的前端接口。
2. Real Client 只依赖 `@experience-map/contracts` 的类型和 Zod schema。
3. 配置 `VITE_API_BASE_URL` 指向成员二 API；不要把知乎域名或凭据放入 Vite 变量。
4. 用 `dataMode: "replay"` 先验证 202、轮询和地图页面，无需任何上游凭据。
5. 验证 loading、四个处理中状态、成功、失败、过期和重试 UI。
6. 服务端完成凭据注入后，再把请求体切为 `dataMode: "live"`。
7. 保留 Mock Client 作为 Storybook/视觉回归和离线演示后备，不要删除 fixtures。

## 8. 已验证、未验证与限制

已验证：

- `pnpm lint`、`pnpm test`、`pnpm build`、`pnpm contracts:check`、`pnpm health` 通过。
- contracts 3 项、API 28 项、Web 1 项，共 32 项测试通过。
- 三个接口以及六种状态通过本地 HTTP/依赖注入测试。
- Provider 对 HTTP 429、业务码 30001、AbortError、空结果的映射通过测试。
- SQLite 数据库重开与完整 API 进程重启后，任务和幂等响应可恢复。
- 知乎官方 CLI 对搜索、问题回答、直答各完成一次最小真实调用。

未验证：

- 项目 API 进程尚未安全注入真实 Access Secret，完整 `live` 创建到地图的端到端链路未验证。
- Docker build/run、公网部署、持久卷和 HTTPS 未验证；当前机器没有 Docker。
- Playwright E2E 未通过；当前前端配置出现 Vitest 内部状态错误且没有发现 E2E 用例，属于成员三范围。

已知限制：

- 搜索最多保留 10 个去重来源；问题回答当前只读取第一页。
- API 任务总边界为 95 秒，Provider/模型单次请求另受 `ZHIHU_TIMEOUT_MS` 限制。
- 当前失败任务的用户文案是统一安全文案，前端应主要按 `error.code` 和 `retryable` 决定展示与重试。
- replay 是只读合成数据，不代表实时知乎内容。
