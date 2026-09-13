import type { ExperienceMap, Job } from './index.js';

const retrievedAt = '2026-09-13T01:00:04.000Z';
export const replayJob: Job = {
  jobId: 'job_replay_pm_intern', status: 'succeeded', message: '已整理完成', mapId: 'map_replay_pm_intern', error: null,
  retryable: false, createdAt: '2026-09-13T01:00:00.000Z', updatedAt: '2026-09-13T01:00:08.000Z'
};

export const replayMap: ExperienceMap = {
  schemaVersion: '1.0', mapId: 'map_replay_pm_intern', query: '大学生如何准备第一份产品经理实习？', inputMode: 'topic', questionUrl: null,
  constraints: { background: '零实习经历', weeks: 8, hoursPerWeek: 10, budgetCny: 500 },
  dataStatus: { mode: 'replay', retrievedAt, sources: 'fixture', notice: '演示案例：合成测试数据，不代表实时请求' },
  overview: '不同路径对应不同投入顺序；应先验证自己能持续完成哪类实践。',
  routes: [
    { routeId: 'route_portfolio', title: '先做可展示作品', strategy: '先用小项目形成可复盘作品，再带着证据投递。', fit: ['有 8 周连续时间'], tradeoffs: [{ label: '成本', value: '低到中，具体费用未由来源确认' }], stages: [
      { stageId: 'stage_portfolio_1', title: '确定小项目', suggestedWeeks: '第 1–2 周（建议安排）', tasks: [{ taskId: 'task_portfolio_1', action: '选择两周内能完成的用户问题', doneWhen: '写出目标用户、问题和验证方式', evidenceIds: ['ev_portfolio'] }] },
      { stageId: 'stage_portfolio_2', title: '完成并复盘', suggestedWeeks: '第 3–5 周（建议安排）', tasks: [{ taskId: 'task_portfolio_2', action: '完成原型并记录验证结果', doneWhen: '形成一页项目复盘', evidenceIds: ['ev_portfolio_2'] }] }
    ], risks: ['只堆功能、不记录验证过程'], evidenceIds: ['ev_portfolio', 'ev_portfolio_2'] },
    { routeId: 'route_feedback', title: '边做边投递', strategy: '尽早投递并用反馈调整材料和项目。', fit: ['能接受频繁迭代'], tradeoffs: [{ label: '时间', value: '投递与项目并行，节奏更紧' }], stages: [
      { stageId: 'stage_feedback_1', title: '准备最小材料', suggestedWeeks: '第 1–2 周（建议安排）', tasks: [{ taskId: 'task_feedback_1', action: '整理一版简历和项目说明', doneWhen: '完成一次针对岗位的投递', evidenceIds: ['ev_feedback'] }] },
      { stageId: 'stage_feedback_2', title: '收集反馈迭代', suggestedWeeks: '第 3–8 周（建议安排）', tasks: [{ taskId: 'task_feedback_2', action: '每周复盘投递反馈', doneWhen: '记录三类常见反馈及改动', evidenceIds: ['ev_feedback_2'] }] }
    ], risks: ['反馈样本少时过度归因'], evidenceIds: ['ev_feedback', 'ev_feedback_2'] }
  ],
  differences: [{ title: '投入顺序差异', summary: '来源 A 强调先形成作品，来源 B 强调尽早获得投递反馈。', evidenceIds: ['ev_portfolio', 'ev_feedback'] }],
  evidence: [
    { evidenceId: 'ev_portfolio', sourceId: 'src_answer_a', claim: '摘要提到先完成一个可展示项目。', quote: '先完成一个可展示项目', support: 'direct' },
    { evidenceId: 'ev_portfolio_2', sourceId: 'src_article_a', claim: '摘要强调记录验证过程。', quote: '记录验证过程', support: 'direct' },
    { evidenceId: 'ev_feedback', sourceId: 'src_answer_b', claim: '摘要建议尽早投递获取反馈。', quote: '尽早投递获取反馈', support: 'direct' },
    { evidenceId: 'ev_feedback_2', sourceId: 'src_article_b', claim: '摘要建议按周复盘反馈。', quote: '按周复盘反馈', support: 'contextual' }
  ],
  sources: [
    { sourceId: 'src_answer_a', contentType: 'answer', title: '该问题下的回答摘要', authorName: null, summary: '先完成一个可展示项目，再带着证据投递。', quoteableText: '先完成一个可展示项目', url: 'https://www.zhihu.com/question/123456789/answer/1001?utm_source=experience-map', publishedAt: null, retrievedAt, authorityLevel: null, metrics: null },
    { sourceId: 'src_article_a', contentType: 'article', title: '产品项目复盘方法', authorName: null, summary: '项目需要记录验证过程。', quoteableText: '记录验证过程', url: 'https://zhuanlan.zhihu.com/p/1001?utm_source=experience-map', publishedAt: null, retrievedAt, authorityLevel: null, metrics: null },
    { sourceId: 'src_answer_b', contentType: 'answer', title: '该问题下的回答摘要', authorName: null, summary: '尽早投递获取反馈。', quoteableText: '尽早投递获取反馈', url: 'https://www.zhihu.com/question/123456789/answer/1002?utm_source=experience-map', publishedAt: null, retrievedAt, authorityLevel: null, metrics: null },
    { sourceId: 'src_article_b', contentType: 'article', title: '求职反馈复盘', authorName: null, summary: '按周复盘反馈。', quoteableText: '按周复盘反馈', url: 'https://zhuanlan.zhihu.com/p/1002?utm_source=experience-map', publishedAt: null, retrievedAt, authorityLevel: null, metrics: null }
  ],
  limitations: ['回答接口返回摘要而非全文；建议核对原文。']
};

export const emptyResultFixture = { code: 'UPSTREAM_EMPTY', message: '未找到可整理的知乎内容。', retryable: false } as const;
export const rateLimitFixture = { code: 'UPSTREAM_RATE_LIMIT', message: '知乎内容服务暂时达到调用限制，请稍后重试或查看已整理案例。', retryable: false } as const;
export const timeoutFixture = { code: 'UPSTREAM_TIMEOUT', message: '知乎内容服务响应超时，请稍后重试。', retryable: true } as const;
export const invalidMapFixture = { code: 'MODEL_INVALID_OUTPUT', message: '整理结果未通过来源校验。', retryable: false } as const;
