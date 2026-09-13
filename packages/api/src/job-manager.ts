import { randomUUID } from 'node:crypto';
import type { CreateMapJobRequest, ExperienceMap, Job } from '@experience-map/contracts';
import { replayJob, replayMap } from '@experience-map/contracts/fixtures';
import type { ZhihuClient } from './providers.js';
import { UpstreamError } from './providers.js';
import type { ModelAdapter } from './pipeline.js';
import { validateModelOutput } from './pipeline.js';

export class JobManager {
  readonly jobs = new Map<string, Job>([[replayJob.jobId, replayJob]]);
  readonly maps = new Map<string, ExperienceMap>([[replayMap.mapId, replayMap]]);
  private readonly idempotency = new Map<string, { fingerprint: string; response: { jobId: string; status: 'queued'; pollAfterMs: number } }>();
  constructor(private readonly client: ZhihuClient, private readonly model: ModelAdapter, private readonly maxConcurrent = 2) {}
  create(request: CreateMapJobRequest, key: string) {
    const fingerprint = JSON.stringify(request);
    const existing = this.idempotency.get(key);
    if (existing && existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
    if (existing) return existing.response;
    const jobId = request.dataMode === 'replay' ? replayJob.jobId : `job_${randomUUID()}`;
    const response = { jobId, status: 'queued' as const, pollAfterMs: 1500 };
    this.idempotency.set(key, { fingerprint, response });
    const job: Job = { jobId, status: 'queued', message: '排队中', mapId: null, error: null, retryable: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.jobs.set(jobId, request.dataMode === 'replay' ? replayJob : job);
    if (request.dataMode === 'live') void this.run(jobId, request);
    return response;
  }
  private async run(jobId: string, request: CreateMapJobRequest) {
    try {
      this.update(jobId, { status: 'retrieving', message: request.inputMode === 'topic' ? '查找知乎内容' : '查找问题下的回答' });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 95_000);
      const sources = request.inputMode === 'topic' ? await this.client.search(request.query!, controller.signal) : await this.client.questionAnswers(request.questionUrl!, controller.signal);
      clearTimeout(timer);
      this.update(jobId, { status: 'organizing', message: '整理经验路线' });
      const raw = await this.model.organize({ query: request.query, sources, constraints: request.constraints });
      this.update(jobId, { status: 'validating', message: '检查来源' });
      const map = validateModelOutput(raw);
      this.maps.set(map.mapId, map);
      this.update(jobId, { status: 'succeeded', message: '已整理完成', mapId: map.mapId });
    } catch (error) {
      const code = error instanceof UpstreamError ? error.code : (error as Error).message === 'MODEL_INVALID_OUTPUT' ? 'MODEL_INVALID_OUTPUT' : (error as Error).message === 'EVIDENCE_INSUFFICIENT' ? 'EVIDENCE_INSUFFICIENT' : 'INTERNAL_ERROR';
      this.update(jobId, { status: 'failed', message: '整理失败', error: { code, message: '整理结果未通过校验，请稍后重试。', retryable: code === 'UPSTREAM_TIMEOUT', requestId: `req_${randomUUID()}` }, retryable: code === 'UPSTREAM_TIMEOUT' });
    }
  }
  private update(jobId: string, patch: Partial<Job>) { const current = this.jobs.get(jobId); if (current) this.jobs.set(jobId, { ...current, ...patch, updatedAt: new Date().toISOString() }); }
}
