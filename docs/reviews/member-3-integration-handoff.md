# 成员三联调验收与成员二交接

日期：2026-09-13
工作分支：`feat/member-3-m3-api-integration`
合入后端：`feat/member-2-m2-security-hardening` @ `b88d9d0`（包含 `97bf032`）
原前端：`feat/member-3-m3-ui` @ `ae5b8dd`

## 结论

可以继续前端与本地后端 replay 联调，且本轮已实际跑通。真实知乎接入和线上交付尚未完成。这里的“后端回放”仍然是 shared fixture 的合成内容，不是已抓取的真实知乎案例。

没有改写 `packages/contracts`、Provider、JobManager、Pipeline 或成员二现有进度。M2 分支通过 merge 合入独立 M3 联调分支，保留父提交和角色边界，不直接合入 main。

## 本轮已修复并验收

- 补上 React `createRoot(...).render(...)`；旧版只有 Root 导出，构建通过不能证明页面实际挂载。
- 增加中文 HTML 文档、viewport；不再只交付空 div。
- 抽出 API Client，三个应用接口通过同源 `/api/v1` 发起请求；Vite 在开发时代理到本地 API。
- Zod 校验输入/响应，复用 contracts 和 fixtures；失败不猜字段；新增任务引用的存在性防御校验。
- 同一次提交在网络重试时复用幂等键，防重复点击；保留预算 0，拒绝越界条件。
- 区分 queued/retrieving/organizing/validating、succeeded、failed、expired；失败停止轮询；95 秒未知结果可手动检查。
- 空路线展示证据不足，不无限加载；无效 routeId 不自动换成另一条路线。
- 路线比较、来源引用高亮、原生 modal dialog、Tab 焦点约束、Esc 和关闭后焦点恢复。
- 合成 fixture 标记贯穿地图、抽屉、清单和导出；合成来源 URL 不再开放原文跳转。真实 URL 只接受 HTTPS 的 www.zhihu.com / zhuanlan.zhihu.com，并保留官方返回 query。
- 清单勾选、本机刷新恢复、过期 taskId 过滤、存储失败提示与 Markdown 导出；导出实际换行、条件、完成状态、引用和数据出处说明。

## 本轮实际执行结果

环境：Windows，Node 24.11.0、当前可用 pnpm 11.19.0、Playwright + 安装的 Edge。根 packageManager 仍声明 pnpm 10.15.0；本轮没有更改团队版本锁定，也不宣称已验证 Node 22 / pnpm 10 或 Linux 容器。

- `pnpm test`：24 项通过（contracts 3、api 12、web 9）。
- `pnpm lint`：通过。
- `pnpm contracts:check`：通过；共享 schema 零改动。
- `pnpm build`：通过；上游 Zod PURE 注释有非阻塞 Rollup 提示。
- `PLAYWRIGHT_CHANNEL=msedge pnpm --filter @experience-map/web test:e2e`：16 项通过。
- E2E 中主流程通过实际本地 API 进程和 Vite 代理，包含 POST、任务 GET、地图 GET。接口测试进程显式清空 Access Secret，不访问真实知乎。
- 错误/live 展示测试使用浏览器拦截返回；证明前端处理，不证明真实上游成功。
- 屏幕宽度 360/390/768/1440：自动检查无横向溢出；390/1440 截图已人工视觉查看。截图：[手机](../screenshots/m3-mobile.png)、[桌面](../screenshots/m3-desktop.png)。裁剪只展示首屏，完整截图在本机被 Git 忽略的 packages/web/test-results/。

## 本地运行

默认未设置 VITE_DATA_MODE 时为 replay，使用 HTTP 请求后端。若根 .env 已设置 mock，会优先使用该值；需切换时在命令中显式设置。

```powershell
# Windows / 仓库根目录；前后端同开
$env:VITE_DATA_MODE='replay'
pnpm dev
```

打开 http://127.0.0.1:5173，点击“查看已整理案例”，即可验证后端回放。默认 API 3001。不要把模型/知乎密钥放入任何 VITE_ 变量。

- `mock`：只用共享 fixture，不需要 API；离线静态构建可选此模式，页面明确合成数据。
- `replay`：调用本地 API，request.dataMode=replay，获取现有固定样例。改输入不会生成新内容，页面明示。
- `live`：调用同一 API，request.dataMode=live；用于后续接通真实 Provider。当前后端尚未达到 live 发布验收。
- “查看已整理案例”在 live 模式仍显式提交 replay，不静默把失败改成成功。

```powershell
# 自动起两个隔离测试服务：API 3019、Web 5179；不要提前占用
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm test:e2e
```

其他机器可使用 `pnpm --filter @experience-map/web exec playwright install chromium` 后清除 PLAYWRIGHT_CHANNEL 运行；测试不包含真实登录授权。

## 成员二优先修复项（代码审阅发现，未跨职责修改）

### B1：公共内容 Provider 协议与官方文档不符，阻塞 live

当前 `packages/api/src/config.ts` 默认 `https://openapi.zhihu.com`；Provider 用 POST `/v1/zhihu/search` 和 `/v1/zhihu/question_answers`、小写 JSON body，并读取 `payload.data/items`。本地知乎 Skill HTTP 文档描述的是：

- 搜索：GET `https://developer.zhihu.com/api/v1/content/zhihu_search`，Query/Count query 参数，返回 `Code/Message/Data.Items`；摘要 `ContentText`，ContentType 示例为 `Answer`/`Article`，时间为 `EditTime`。
- 回答摘要：GET `https://developer.zhihu.com/api/v1/content/question_answers`，QuestionUrl/Offset/Limit，返回 `Data.Items` 的 Summary，以及 `Data.Paging.IsEnd/NextOffset`。
- 两者为 Bearer Access Secret + 秒级 X-Request-Timestamp；API Code 20001、30001 等须处理，不能只检查 HTTP 状态。

验收：用文档形状的脱敏响应 fixture 测请求域名、方法、参数大小写、响应 envelope、ContentText/类型/时间映射；分页遵守 NextOffset。然后再由成员二用授权凭证做真实最小调用。本轮没有替成员二发出请求或读取密钥。

### B2：JobManager 的阶段和边界还不是完整实现

- `maxConcurrent` 参数没有实际排队或并发限制；jobs/maps/idempotency 在内存，不是 SQLite 持久化或结果缓存。
- 95 秒 controller 只包裹检索，模型步骤不在总时限内；异常时 timer 也应 finally 清理。需一个整个任务的截止边界。
- `model.organize` 输入未传 inputMode/questionUrl/focus；适配器返回固定 topic/zhihu_search。问题链接场景将丢失输入语义。
- 失败文案目前过于统一；前端按 code 映射，但请保留精确错误原因与 retryable。

验收：超并发排队、任务全过程超时、服务重启后读取、相同输入缓存命中、URL/focus 全程保留测试。

### B3：模型与证据质量尚未完成

- 目前只有 DeterministicModelAdapter：把摘要直接作为任务，追加固定复盘动作；不是已接通直答模型的多路线生成。
- `validateEvidenceReferences` 的两来源判断没按 sourceId 去重，且只有一条来源时可能绕过。引用计数不能代替独立来源数。
- 核心建议需要真正的语义证据审核，不能因为 quote 是子串就认为行动正确。

验收：两 evidence 来自同 source、单 source、未知 task/difference 引用均拒绝；模型适配器的有效/非法 JSON、时间预算建议标签和条件差异有测试。最终主案例由成员一人工评价。

### B4：Docker/公网交付不是当前回归覆盖范围

当前 tsc 基配置 `noEmit: true` 可能令 API 构建无 dist；Docker CMD 指向 packages/api/dist/server.js，应实际构建并验证路径、contracts 运行时导出。Express server.ts 暂未托管前端静态资源及 SPA fallback；README 的同源生产承诺需要实现后验证。当前本机联调用 Vite dev proxy，不证明 Docker 可运行。

验收：容器健康检查、首页和四条深链刷新、/api/v1 错误不回 SPA HTML、持久卷、公网 HTTPS。配置缓存状态字段前请走契约 ADR；当前 DataStatus.mode 只有 live/replay，前端不自行加 cache。

## 下一步协作

成员二按 B1→B2/B3→B4 完成后推送独立分支；成员三继续使用同一共享 schema 合入并验收 live。成员一可现在审阅交互效果，但不要把合成演示包装成真实用户经验。
