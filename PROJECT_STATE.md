GOAL: 完成知乎经验地图 v1 的成员二后端与工程交付
DELIVERABLE: workspace、contracts/fixtures、知乎 Provider、Pipeline/ModelAdapter、任务/幂等/回放基线、部署说明
SUCCESS_CRITERIA: M2-2～M2-5 的代码边界清晰；lint、contracts:check、test、build、health 可验证；未核验真实上游不冒充完成
CONSTRAINTS: 保持 PROJECT_SPEC 1.0 契约；凭证仅服务端；摘要不是全文；前端不得直连上游；不等待 OAuth
CURRENT_TASK: 外部环境与跨成员最终验收
CURRENT_TASK_STATUS: BLOCKED
NEXT_TASK: 用户安全注入服务进程凭据；提供 Docker/公网环境；成员三修复并提供前端 E2E
COMPLETED_TASKS: M2-0 workspace；M2-1 contracts/fixtures；M2-2 官方 GET 协议与真实字段映射、Bearer/时间戳、Provider 超时/去重/限流错误、Zhida 模型适配及官方 CLI 最小真实验证；M2-3 ModelAdapter 与 Zod/sourceId/quote/数量/证据校验及增量测试；M2-4 JobManager 幂等、回放、95 秒任务边界、SQLite 持久化/重启恢复、任务并发队列及六状态接口测试；M2-5 全量密钥脱敏、配置安全测试、health、Dockerfile、部署回滚说明
BLOCKED_TASKS: 项目服务进程的 live 端到端联调缺少安全凭据注入；Docker/HTTPS 公网部署缺少 Docker/公网环境；Playwright E2E 属成员三前端且当前配置报错、无用例
UNRESOLVED_QUESTIONS: 服务进程凭据安全注入方式；公网容器平台；成员三前端 E2E 修复与集成时点
FINAL_QA_STATUS: PARTIAL_PASS
FINAL_DELIVERABLE_STATUS: GENERATED_BASELINE
FINAL_STATUS: IN_PROGRESS
LAST_ACTION: 按官方协议修正 Provider/Zhida 适配，完成搜索、问题回答、直答各一次真实 CLI 验证
LAST_VERIFIED_OUTPUT: pnpm contracts:check 通过；pnpm lint 通过；pnpm test 通过（contracts 3、api 28、web 1）；pnpm build 通过；pnpm health 通过；API 进程重启后任务与幂等键恢复通过
UNVERIFIED_COMMANDS: 项目服务端到端 live、Docker build/HTTPS 未验证；pnpm test:e2e 已运行但因成员三范围的配置错误与无用例失败
ENVIRONMENT_BLOCK: 项目进程不能擅自提取系统凭据；Docker 未安装；Playwright/Vitest 配置错误且无 E2E 用例；公网平台未提供
EXECUTION_STOP_REASON: GENUINE_BLOCKER
LAST_UPDATED: 2026-09-13
EXECUTION_CYCLE: 6