GOAL: 完成知乎经验地图 v1 的成员二后端与工程交付
DELIVERABLE: workspace、contracts/fixtures、知乎 Provider、Pipeline/ModelAdapter、任务/幂等/回放基线、部署说明
SUCCESS_CRITERIA: M2-2～M2-5 的代码边界清晰；lint、contracts:check、test、build、health 可验证；未核验真实上游不冒充完成
CONSTRAINTS: 保持 PROJECT_SPEC 1.0 契约；凭证仅服务端；摘要不是全文；前端不得直连上游；不等待 OAuth
CURRENT_TASK: M2-5 外部环境验收准备
CURRENT_TASK_STATUS: READY
NEXT_TASK: 真实知乎 API 脱敏联调、SQLite 重启持久化、Docker 公网部署与 HTTPS 验收
COMPLETED_TASKS: M2-0 workspace；M2-1 contracts/fixtures；M2-2 Provider 字段映射、Bearer/时间戳、去重、超时/限流错误；M2-3 ModelAdapter 与 Zod/sourceId/quote/数量/证据校验及增量测试；M2-4 JobManager 幂等、回放、95 秒任务边界、迁移 SQL及增量测试；M2-5 脱敏配置、health、Dockerfile、部署回滚说明
BLOCKED_TASKS: 真实知乎接口联调、SQLite 重启读写、HTTPS 公网部署尚未具备凭证/运行环境
UNRESOLVED_QUESTIONS: Access Secret、API 实际响应字段和额度；生产 SQLite 驱动选择；公网容器平台
FINAL_QA_STATUS: PARTIAL_PASS
FINAL_DELIVERABLE_STATUS: GENERATED_BASELINE
FINAL_STATUS: IN_PROGRESS
LAST_ACTION: 完成 M2-3/M2-4 增量测试并通过本地验证
LAST_VERIFIED_OUTPUT: pnpm contracts:check 通过；pnpm lint 通过；pnpm test 通过（contracts 3、api 11、web 1）；pnpm build 通过；pnpm health 通过
UNVERIFIED_COMMANDS: Docker build、真实 API 联调、SQLite 重启、pnpm test:e2e 未运行
ENVIRONMENT_BLOCK: 普通 Git HTTPS 链路曾需 HTTP/1.1；真实上游与公网环境仍需外部凭证和运行环境
EXECUTION_STOP_REASON: NONE
LAST_UPDATED: 2026-09-13
EXECUTION_CYCLE: 3