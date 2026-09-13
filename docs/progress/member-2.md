# 成员二进度

日期：2026-09-13

## 已完成

- M2-0：建立 pnpm workspace、Node/pnpm 版本约束、Express API、React/Vite 空工程、根脚本、`.env.example`、Git 忽略。
- M2-1：建立 `packages/contracts`，使用 Zod 定义请求、任务、错误、ExperienceMap、来源、证据、路线和行动任务 schema；导出推导类型。
- 提供主场景 replay fixture、空结果/限流/超时/非法输出错误 fixture。
- 增加 `contracts:check` 与契约单测，覆盖 topic/question_url、无效 URL、证据引用连续性。
- API 基线提供三个固定接口和回放地图读取，供成员三按 contracts/fixtures 开始页面骨架。

## 基线验收证据（2026-09-13）

- `pnpm install`：通过；pnpm 11.19.0，提示 `pnpm.onlyBuiltDependencies` 配置将被忽略。
- `pnpm lint`：通过；contracts、api、web TypeScript 检查通过。
- `pnpm test`：通过；contracts 3 项、api 7 项、web 1 项，共 11 项。
- `pnpm build`：通过；contracts、api、web 构建成功。
- `pnpm contracts:check`：通过。

## 未核验与风险

- 真实知乎 API、Access Secret、额度和线上部署尚未完成 live 联调；没有把它们标成已完成。
- `packages/api` 中的 Provider、Pipeline、任务管理和迁移文件已落盘，但 M2-2～M2-5 的完整 live、幂等、缓存和部署验收仍需单独确认。
- 此前 `pnpm approve-builds esbuild` 曾受交互/安全策略影响；本轮 `pnpm install` 已成功完成。

## 交接给成员三

M2-0/M2-1 的目录和接口已就位，可只依赖 `@experience-map/contracts` 与 `@experience-map/contracts/fixtures` 开始 M3-0；不要复制 schema，也不要让浏览器直连知乎或模型服务。