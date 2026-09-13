import { createHash, randomUUID } from 'node:crypto';
import type { CreateMapJobRequest, CreateMapJobResponse, ExperienceMap, Job } from '@experience-map/contracts';
import { replayJob, replayMap } from '@experience-map/contracts/fixtures';
import type { JobStore } from './job-store.js';
import { MemoryJobStore } from './job-store.js';
import type { ZhihuClient } from './providers.js';
import { UpstreamError } from './providers.js';
import type { ModelAdapter } from './pipeline.js';
import { validateModelOutput } from './pipeline.js';

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
      const sources = request.inputMode === 'topic'
        ? await this.client.search(request.query!, controller.signal)
        : await this.client.questionAnswers(request.questionUrl!, controller.signal);
      this.update(jobId, { status: 'organizing', message: '整理经验路线' });
      const raw = await this.model.organize({ query: request.query, inputMode: request.inputMode, questionUrl: request.questionUrl, focus: request.focus, sources, constraints: request.constraints }, controller.signal);
      this.update(jobId, { status: 'validating', message: '检查来源' });
      const map = validateModelOutput(raw);
      this.store.saveMap(map);
      this.update(jobId, { status: 'succeeded', message: '已整理完成', mapId: map.mapId });
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

  private update(jobId: string, patch: Partial<Job>) {
    const current = this.store.getJob(jobId);
    if (current) this.store.saveJob({ ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  private seedReplay(): void {
    if (!this.store.getMap(replayMap.mapId)) this.store.saveMap(replayMap);
    if (!this.store.getJob(replayJob.jobId)) this.store.saveJob(replayJob);
  }
}
