import { ExperienceMapSchema, validateEvidenceReferences, type ExperienceMap } from '@experience-map/contracts';
import type { ZhihuSource } from './providers.js';

export type ModelAdapter = { organize(input: { query: string | null; sources: ZhihuSource[]; constraints: ExperienceMap['constraints'] }): Promise<unknown> };

export class DeterministicModelAdapter implements ModelAdapter {
  async organize(input: { query: string | null; sources: ZhihuSource[]; constraints: ExperienceMap['constraints'] }): Promise<ExperienceMap> {
    const now = new Date().toISOString();
    const sources = input.sources.map((source, index) => ({ sourceId: `src_${index + 1}`, contentType: source.contentType, title: source.title ?? '该问题下的回答摘要', authorName: source.authorName ?? null, summary: source.summary, quoteableText: source.summary, url: source.url, publishedAt: source.publishedAt ?? null, retrievedAt: now, authorityLevel: null, metrics: null }));
    if (!sources.length) throw new Error('EVIDENCE_INSUFFICIENT');
    const evidence = sources.map((source, index) => ({ evidenceId: `ev_${index + 1}`, sourceId: source.sourceId, claim: source.summary, quote: source.quoteableText.slice(0, Math.min(80, source.quoteableText.length)), support: 'direct' as const }));
    const route = { routeId: 'route_1', title: '基于来源的行动路线', strategy: '先完成来源明确支持的下一步，再根据反馈调整。', fit: [], tradeoffs: [], stages: [{ stageId: 'stage_1', title: '提取可执行行动', suggestedWeeks: '第 1 周（建议安排）', tasks: [{ taskId: 'task_1', action: sources[0].summary, doneWhen: '完成并记录结果', evidenceIds: [evidence[0].evidenceId] }] }, { stageId: 'stage_2', title: '复盘与调整', suggestedWeeks: '第 2 周（建议安排）', tasks: [{ taskId: 'task_2', action: '根据结果复盘', doneWhen: '记录下一步调整', evidenceIds: [evidence[0].evidenceId] }] }], risks: ['来源摘要有限，需回到知乎核对原文。'], evidenceIds: evidence.slice(0, Math.min(2, evidence.length)).map((item) => item.evidenceId) };
    return { schemaVersion: '1.0', mapId: `map_${Date.now()}`, query: input.query, inputMode: 'topic', questionUrl: null, constraints: input.constraints, dataStatus: { mode: 'live', retrievedAt: now, sources: 'zhihu_search', notice: '基于知乎公开内容摘要整理' }, overview: '路线仅基于可核验摘要生成。', routes: [route], differences: [], evidence, sources, limitations: ['回答接口返回摘要而非全文；建议核对原文。'] };
  }
}

export function validateModelOutput(raw: unknown): ExperienceMap {
  const parsed = ExperienceMapSchema.safeParse(raw);
  if (!parsed.success) throw new Error('MODEL_INVALID_OUTPUT');
  const errors = validateEvidenceReferences(parsed.data);
  if (errors.length) throw new Error('EVIDENCE_INSUFFICIENT');
  return parsed.data;
}
