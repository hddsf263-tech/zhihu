# 成员二进度

日期：2026-09-13

## 已完成

- M2-0：建立 pnpm workspace、Node/pnpm 版本约束、Express API、React/Vite 空工程、根脚本、`.env.example`、Git 忽略。
- M2-1：建立 `packages/contracts`，使用 Zod 定义请求、任务、错误、ExperienceMap、来源、证据、路线和行动任务 schema；导出推导类型。
- 提供主场景 replay fixture、空结果/限流/超时/非法输出错误 fixture。
- 增加 `contracts:check` 与契约单测，覆盖 topic/question_url、无效 URL、证据引用连续性。
- API 基线提供三个固定接口和回放地图读取，供成员三按 contracts/fixtures 开始页面骨架。
- M2-2～M2-5 基线代码已落盘：Provider、Pipeline/ModelAdapter、JobManager、迁移脚本、健康检查和部署说明。
- M2-3/M2-4 增量测试已补充：非连续引用、证据来源数量、live 幂等键复用、replay 只读。
- M2-5 安全补强已完成：服务端脱敏函数对任何密钥值统一返回 `[REDACTED]`，不再保留首尾字符，并增加配置安全单测。

## M2 本地验收证据（2026-09-13）

- `pnpm install`：通过；pnpm 11.19.0，提示 `pnpm.onlyBuiltDependencies` 配置将被忽略。
- `pnpm lint`：通过；contracts、api、web TypeScript 检查通过。
- `pnpm test`：通过；contracts 3 项、api 12 项、web 1 项，共 16 项。
- `pnpm build`：通过；contracts、api、web 构建成功。
- `pnpm contracts:check`：通过。
- `pnpm health`：通过；API 返回 `ok: true`。

## 未核验与风险

- 真实知乎 API、Access Secret、额度和线上部署尚未完成 live 联调；没有把它们标成已完成。
- SQLite 重启持久化、Docker 公网部署与 HTTPS、Playwright E2E 尚未完成验收。
- `packages/api` 中 M2-2～M2-5 的代码已通过本地静态/单元验证，但不等同于真实上游和生产环境验收。
- 此前 `pnpm approve-builds esbuild` 曾受交互/安全策略影响；本轮 `pnpm install` 已成功完成。

## 交接给成员三

M2-0/M2-1 的目录和接口已就位，可只依赖 `@experience-map/contracts` 与 `@experience-map/contracts/fixtures` 开始 M3-0；不要复制 schema，也不要让浏览器直连知乎或模型服务。