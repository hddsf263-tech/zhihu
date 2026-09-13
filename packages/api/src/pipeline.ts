import { randomUUID } from 'node:crypto';
import { ExperienceMapSchema, validateEvidenceReferences, type CreateMapJobRequest, type ExperienceMap } from '@experience-map/contracts';
import { loadConfig } from './config.js';
import { UpstreamError, type ZhihuSource } from './providers.js';

export type ModelInput = {
  query: string | null;
  inputMode: CreateMapJobRequest['inputMode'];
  questionUrl: string | null;
  sources: ZhihuSource[];
  constraints: ExperienceMap['constraints'];
};
export type ModelAdapter = { organize(input: ModelInput): Promise<unknown> };

export class ZhidaHttpModelAdapter implements ModelAdapter {
  private readonly config = loadConfig();

  async organize(input: ModelInput): Promise<unknown> {
    if (!this.config.accessSecret) throw new UpstreamError('UPSTREAM_AUTH', '知乎直答服务未配置 Access Secret。');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(new URL('/v1/chat/completions', this.config.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessSecret}`,
          'Content-Type': 'application/json',
          'X-Request-Timestamp': String(Math.floor(Date.now() / 1000))
        },
        body: JSON.stringify({
          model: this.config.modelName,
          stream: false,
          messages: [{ role: 'user', content: buildPrompt(input) }]
        }),
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) throw new UpstreamError('UPSTREAM_AUTH', '知乎直答服务鉴权失败。');
      if (response.status === 429) throw new UpstreamError('UPSTREAM_RATE_LIMIT', '知乎直答服务暂时达到调用限制。');
      if (!response.ok) throw new Error('MODEL_INVALID_OUTPUT');
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return parseModelJson(payload.choices?.[0]?.message?.content);
    } catch (error) {
      if (error instanceof UpstreamError || (error as Error).message === 'MODEL_INVALID_OUTPUT') throw error;
      if ((error as Error).name === 'AbortError') throw new UpstreamError('UPSTREAM_TIMEOUT', '知乎直答服务响应超时。', true);
      throw new Error('MODEL_INVALID_OUTPUT');
    } finally {
      clearTimeout(timer);
    }
  }
}

export class DeterministicModelAdapter implements ModelAdapter {
  async organize(input: ModelInput): Promise<ExperienceMap> {
    const now = new Date().toISOString();
    const sources = input.sources.map((source, index) => ({
      sourceId: `src_${index + 1}`,
      contentType: source.contentType,
      title: source.title ?? '该问题下的回答摘要',
      authorName: source.authorName ?? null,
      summary: source.summary,
      quoteableText: source.summary,
      url: source.url,
      publishedAt: source.publishedAt ?? null,
      retrievedAt: now,
      authorityLevel: null,
      metrics: null
    }));
    if (!sources.length) throw new Error('EVIDENCE_INSUFFICIENT');
    const evidence = sources.map((source, index) => ({ evidenceId: `ev_${index + 1}`, sourceId: source.sourceId, claim: source.summary, quote: source.quoteableText.slice(0, Math.min(80, source.quoteableText.length)), support: 'direct' as const }));
    const route = {
      routeId: 'route_1', title: '基于来源的行动路线', strategy: '先完成来源明确支持的下一步，再根据反馈调整。', fit: [], tradeoffs: [],
      stages: [
        { stageId: 'stage_1', title: '提取可执行行动', suggestedWeeks: '第 1 周（建议安排）', tasks: [{ taskId: 'task_1', action: sources[0].summary, doneWhen: '完成并记录结果', evidenceIds: [evidence[0].evidenceId] }] },
        { stageId: 'stage_2', title: '复盘与调整', suggestedWeeks: '第 2 周（建议安排）', tasks: [{ taskId: 'task_2', action: '根据结果复盘', doneWhen: '记录下一步调整', evidenceIds: [evidence[0].evidenceId] }] }
      ],
      risks: ['来源摘要有限，需回到知乎核对原文。'],
      evidenceIds: evidence.slice(0, Math.min(2, evidence.length)).map((item) => item.evidenceId)
    };
    return {
      schemaVersion: '1.0', mapId: `map_${randomUUID()}`, query: input.query, inputMode: input.inputMode, questionUrl: input.questionUrl,
      constraints: input.constraints, dataStatus: { mode: 'live', retrievedAt: now, sources: input.inputMode === 'topic' ? 'zhihu_search' : 'question_answers', notice: '基于知乎公开内容摘要整理' },
      overview: '路线仅基于可核验摘要生成。', routes: [route], differences: [], evidence, sources, limitations: ['回答接口返回摘要而非全文；建议核对原文。']
    };
  }
}

export function validateModelOutput(raw: unknown): ExperienceMap {
  const parsed = ExperienceMapSchema.safeParse(raw);
  if (!parsed.success) throw new Error('MODEL_INVALID_OUTPUT');
  const errors = validateEvidenceReferences(parsed.data);
  for (const route of parsed.data.routes) {
    const distinctSourceIds = new Set(route.evidenceIds.map((id) => parsed.data.evidence.find((item) => item.evidenceId === id)?.sourceId).filter(Boolean));
    if (parsed.data.sources.length > 1 && distinctSourceIds.size < 2) errors.push(`${route.routeId}: requires two distinct sources when available`);
  }
  if (errors.length) throw new Error('EVIDENCE_INSUFFICIENT');
  return parsed.data;
}

function buildPrompt(input: ModelInput): string {
  return [
    '只返回一个 JSON 对象，不要 Markdown 或解释。对象必须满足 ExperienceMap schemaVersion 1.0。',
    `输入模式：${input.inputMode}`,
    `主题：${input.query ?? ''}`,
    `问题链接：${input.questionUrl ?? ''}`,
    `约束：${JSON.stringify(input.constraints)}`,
    '要求：最多 3 条路线；每条路线 2-5 个阶段，每阶段 1-3 个任务；所有 evidenceId/sourceId 必须存在；quote 必须是 quoteableText 的连续原文；有多个来源时每条路线至少引用两个不同来源。',
    `来源：${JSON.stringify(input.sources)}`
  ].join('\n');
}

function parseModelJson(content: string | undefined): unknown {
  if (!content) throw new Error('MODEL_INVALID_OUTPUT');
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed); }
  catch { throw new Error('MODEL_INVALID_OUTPUT'); }
}