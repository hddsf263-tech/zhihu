import { createHash, randomUUID } from 'node:crypto';
import type { CreateMapJobRequest, CreateMapJobResponse, ExperienceMap, Job } from '@experience-map/contracts';
import { replayJob, replayMap } from '@experience-map/contracts/fixtures';
import type { JobStore } from './job-store.js';
import { MemoryJobStore } from './job-store.js';
import type { ZhihuClient, ZhihuSource } from './providers.js';
import { dedupeSources, UpstreamError } from './providers.js';
import type { ModelAdapter } from './pipeline.js';
import { validateModelOutput } from './pipeline.js';

export function expandTopicQueries(query: string): string[] {
  const raw = query.trim().replace(/[？?。！!，,；;：:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  // Separate conversational framing from the object the user wants help with.
  // Keep the original wording as the first query for precision, then generate
  // progressively more canonical forms for APIs whose search index is literal.
  const core = raw
    .replace(/^(我想(?:要|学|开始)?|请问|想问一下)\s*/u, '')
    .replace(/^(?:怎么|如何|怎样)\s*/u, '')
    .replace(/^(?:准备|开始)\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutLevel = core
    .replace(/(?:从零基础|零基础|从零|入门)\s*/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const topic = withoutLevel || core;
  const variants = [raw];
  if (core && core !== raw) variants.push(core);
  if (withoutLevel && withoutLevel !== core) variants.push(`零基础 ${withoutLevel}`);
  if (/选|选择/u.test(topic)) {
    variants.push(`${topic} 考虑因素`);
  } else if (/自驾|旅行|旅游|出行/u.test(topic)) {
    variants.push(`${topic} 准备清单`, `${topic} 注意事项`);
  } else if (/学|学习|入门|编程|健身|备考|考试|N[1１]/iu.test(topic)) {
    variants.push(`${topic} 学习路线`, `${topic} 入门经验`);
  } else if (topic) {
    variants.push(`${topic} 经验`);
  }
  return [...new Set(variants)].slice(0, 4);
}

export function normalizeQuestionUrl(url: string): string {
  const match = url.match(/^(https:\/\/www\.zhihu\.com\/question\/\d+)/);
  return match?.[1] ?? url;
}

const stopWords = new Set(['怎么','如何','怎样','准备','开始','从零','零基础','我','的','了','什么','一个','有哪些','可以','请问','想','要']);
export function topicTerms(query: string): string[] {
  const terms = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(query)]
    .filter(s => s.isWordLike).map(s => s.segment.toLowerCase()).filter(s => !stopWords.has(s) && s.trim());
  return [...new Set(terms)];
}
export function focusTerms(focus: string): string[] {
  const aliases = [
    [/成本|预算|花费|价格|省钱/u, ['预算','费用','价格','元','免费','付费','成本','便宜','性价比']],
    [/时间|多久|效率|周期/u, ['时间','小时','周','月','年','天','效率','进度']],
    [/风险|安全/u, ['风险','安全','保险','应急','危险','检查','故障','事故']],
    [/就业|工作/u, ['就业','岗位','行业','招聘','薪资','实习','职业']]
  ] as const;
  return [...new Set([...topicTerms(focus), ...aliases.filter(([r]) => r.test(focus)).flatMap(([, words]) => words)])];
}
export function rankSources(sources: ZhihuSource[], query = '', focus = ''): ZhihuSource[] {
  const terms = topicTerms(query);
  const interests = focusTerms(focus);
  const remaining = sources.map((source, index) => {
    const text = ((source.title ?? '') + ' ' + source.summary).toLowerCase();
    const relevance = terms.length ? terms.filter(t => text.includes(t)).length / terms.length : 1;
    const metrics = source.metrics ?? {};
    // Engagement is capped below topical relevance. Unknown is never "unpopular".
    const popularity = Math.min(1, Math.log1p(Math.max(0, metrics.voteUpCount ?? 0)) / Math.log1p(100000));
    const comments = Math.min(1, Math.log1p(Math.max(0, metrics.commentCount ?? 0)) / Math.log1p(10000));
    const detail = Math.min(1, source.summary.length / 250);
    const interest = interests.length ? Math.min(1, interests.filter(t => text.includes(t)).length / 2) : 0;
    const short = source.summary.length < 24 ? 1 : 0;
    return { source, index, score: 8 * relevance + .6 * popularity + .15 * comments + .25 * detail + .5 * interest - short };
  });
  const authors = new Map<string, number>();
  const selected: ZhihuSource[] = [];
  while (remaining.length && selected.length < 10) {
    const adjusted = (item: typeof remaining[number]) => item.score - .6 * (authors.get(item.source.authorName ?? '') ?? 0);
    remaining.sort((a,b) => adjusted(b) - adjusted(a) || a.index - b.index);
    const item = remaining.shift()!;
    selected.push(item.source);
    if (item.source.authorName) authors.set(item.source.authorName, (authors.get(item.source.authorName) ?? 0) + 1);
  }
  return selected;
}

function findQuestionTitle(sources: ZhihuSource[]): string | null {
  return sources.find(source => source.questionTitle?.trim())?.questionTitle?.trim() ?? null;
}

export class JobManager {
  private activeJobs = 0;
  private readonly queue: Array<{ jobId: string; request: CreateMapJobRequest }> = [];

  constructor(
    private readonly client: ZhihuClient,
    private readonly model: ModelAdapter,
    private readonly store: JobStore = new MemoryJobStore(),
    private readonly maxConcurrent = 2
  ) {
    this.seedReplay();
  }

  getJob(jobId: string): Job | undefined { return this.store.getJob(jobId); }
  getMap(mapId: string): ExperienceMap | undefined { return this.store.getMap(mapId); }
  close(): void { this.store.close(); }

  create(request: CreateMapJobRequest, key: string): CreateMapJobResponse {
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const existing = this.store.getIdempotency(key);
    if (existing && existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
    if (existing) return existing.response;

    const jobId = request.dataMode === 'replay' ? replayJob.jobId : `job_${randomUUID()}`;
    const response = { jobId, status: 'queued' as const, pollAfterMs: 1500 };
    const now = new Date().toISOString();
    const job: Job = {
      jobId,
      status: 'queued',
      message: '排队中',
      mapId: null,
      error: null,
      retryable: false,
      createdAt: now,
      updatedAt: now
    };

    this.store.saveIdempotency(key, fingerprint, response);
    this.store.saveJob(request.dataMode === 'replay' ? replayJob : job, request);
    if (request.dataMode === 'live') this.enqueue(jobId, request);
    return response;
  }

  private enqueue(jobId: string, request: CreateMapJobRequest): void {
    this.queue.push({ jobId, request });
    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.activeJobs < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.activeJobs += 1;
      void this.run(next.jobId, next.request).finally(() => {
        this.activeJobs -= 1;
        this.drainQueue();
      });
    }
  }
  private async run(jobId: string, request: CreateMapJobRequest) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      this.update(jobId, { status: 'retrieving', message: request.inputMode === 'topic' ? '查找知乎内容' : '查找问题下的回答' });
      const retrieved = request.inputMode === 'topic'
        ? await this.retrieveTopicSources(request.query!, controller.signal, request.focus ?? undefined)
        : await this.client.questionAnswers(normalizeQuestionUrl(request.questionUrl!), controller.signal);
      const sources = rankSources(retrieved, request.query ?? '', request.focus ?? '');
      const questionTitle = request.inputMode === 'question_url' ? findQuestionTitle(sources) : null;
      this.update(jobId, { status: 'organizing', message: '整理经验路线' });
      const raw = await this.model.organize({ query: request.query ?? questionTitle, inputMode: request.inputMode, questionUrl: request.questionUrl, focus: request.focus, sources, constraints: request.constraints }, controller.signal);
      this.update(jobId, { status: 'validating', message: '检查来源' });
      const map = validateModelOutput(raw);
      this.store.saveMap(map);
      this.update(jobId, { status: 'succeeded', message: map.presentation?.completeness === 'sources_only' ? '已获取资料，整理未完成' : '已整理完成', mapId: map.mapId });
    } catch (error) {
      const code = error instanceof UpstreamError
        ? error.code
        : (error as Error).message === 'MODEL_INVALID_OUTPUT'
          ? 'MODEL_INVALID_OUTPUT'
          : (error as Error).message === 'EVIDENCE_INSUFFICIENT'
            ? 'EVIDENCE_INSUFFICIENT'
            : 'INTERNAL_ERROR';
      this.update(jobId, {
        status: 'failed',
        message: '整理失败',
        error: { code, message: error instanceof UpstreamError ? error.message : '整理结果未通过校验，请稍后重试。', retryable: code === 'UPSTREAM_TIMEOUT', requestId: `req_${randomUUID()}` },
        retryable: code === 'UPSTREAM_TIMEOUT'
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Keep the user's original wording first, then use a small number of
   * broader searches only when the first result set is sparse. Optional
   * focus/constraints are deliberately not appended as hard search terms;
   * they are used by the organizer to prioritize the final answer.
   */
  private async retrieveTopicSources(query: string, signal: AbortSignal, focus?: string): Promise<ZhihuSource[]> {
    const queries = expandTopicQueries(query);
    let collected: ZhihuSource[] = [];
    let emptyError: UpstreamError | undefined;
    let expandedAfterEmpty = false;
    for (const candidate of queries) {
      try {
        const found = await this.client.search(candidate, signal);
        collected = dedupeSources([...collected, ...found]);
        // Preserve the precise first-hit behavior. Broaden only after a
        // genuinely empty first query, then gather enough evidence to avoid
        // organizing from a single accidental hit.
        if (!expandedAfterEmpty && collected.length > 0) break;
        if (expandedAfterEmpty && collected.length >= 3) break;
      } catch (error) {
        if (error instanceof UpstreamError && error.code === 'UPSTREAM_EMPTY') {
          emptyError = error;
          expandedAfterEmpty = true;
          continue;
        }
        throw error;
      }
    }
    if (!collected.length) throw emptyError ?? new UpstreamError('UPSTREAM_EMPTY', '未找到可整理的知乎内容。');
    // Supplement only when optional focus has little coverage. Never replace core results.
    if (focus?.trim() && collected.filter(s => focusTerms(focus).some(t => ((s.title ?? '') + s.summary).includes(t))).length < 2 && !signal.aborted) {
      try {
        const supplement = await this.client.search((queries[1] ?? queries[0]) + ' ' + focus, signal);
        collected = dedupeSources([...collected, ...supplement]);
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
        if (signal.aborted) throw error;
        // Auxiliary quota/empty/timeout cannot erase already-retrieved evidence; no retry.
      }
    }
    return collected;
  }
  private update(jobId: string, patch: Partial<Job>) {
    const current = this.store.getJob(jobId);
    if (current) this.store.saveJob({ ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  private seedReplay(): void {
    if (!this.store.getMap(replayMap.mapId)) this.store.saveMap(replayMap);
    if (!this.store.getJob(replayJob.jobId)) this.store.saveJob(replayJob);
  }
}
