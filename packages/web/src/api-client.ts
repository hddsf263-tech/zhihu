import {
  CreateMapJobRequestSchema, CreateMapJobResponseSchema, ErrorResponseSchema,
  ExperienceMapSchema, JobSchema, validateEvidenceReferences,
  type CreateMapJobRequest, type CreateMapJobResponse, type ExperienceMap, type Job
} from '@experience-map/contracts';

export type ClientMode = 'mock' | 'replay' | 'live';
export type ClientError = { code: string; message: string; retryable: boolean };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ClientError };
export interface MapClient {
  createJob(request: CreateMapJobRequest, key: string, signal?: AbortSignal): Promise<Result<CreateMapJobResponse>>;
  getJob(id: string, signal?: AbortSignal): Promise<Result<Job>>;
  getMap(id: string, signal?: AbortSignal): Promise<Result<ExperienceMap>>;
}
const invalid: ClientError = { code: 'INVALID_RESPONSE', message: '返回数据不符合共享契约，请联系项目维护者。', retryable: false };
export const messages: Record<string, string> = {
  NETWORK_ERROR: '网络暂时中断，正在自动重连；请保持页面打开。',
  WAIT_TIMEOUT: '整理时间较长，结果尚未确认，请点击再次检查状态。',
  UPSTREAM_AUTH: '知乎内容服务尚未配置或授权失效，请稍后重试。',
  UPSTREAM_EMPTY: '未找到可整理的内容，请缩短问题或换个主题。',
  UPSTREAM_RATE_LIMIT: '内容服务已达到调用限制，请稍后再试。',
  UPSTREAM_TIMEOUT: '内容服务响应超时，可以重新整理。',
  MODEL_INVALID_OUTPUT: '整理结果未通过结构校验，暂时无法展示。',
  EVIDENCE_INSUFFICIENT: '现有证据不足以形成可靠路线，请换个主题。',
  JOB_EXPIRED: '任务或地图不存在、已过期，或服务已重新启动。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后再试。'
};
export function errorText(error: ClientError) { return messages[error.code] ?? error.message; }

type Parser<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
export function createHttpClient(fetcher: typeof fetch = fetch): MapClient {
  async function request<T>(path: string, schema: Parser<T>, init: RequestInit = {}, signal?: AbortSignal): Promise<Result<T>> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    // A free hosting instance may need over 50 seconds to wake up.
    const timer = setTimeout(abort, 150000);
    try {
      const response = await fetcher(`/api/v1${path}`, { ...init, signal: controller.signal, credentials: 'same-origin' });
      const value: unknown = await response.json();
      if (!response.ok) {
        const parsed = ErrorResponseSchema.safeParse(value);
        return { ok: false, error: parsed.success ? parsed.data.error : invalid };
      }
      const parsed = schema.safeParse(value);
      return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: invalid };
    } catch (error) {
      return { ok: false, error: error instanceof SyntaxError ? invalid : {
        code: 'NETWORK_ERROR', message: '连接中断，请检查服务后重试。重复提交将复用本次请求标识。', retryable: true
      } };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    async createJob(payload, key, signal) {
      const parsed = CreateMapJobRequestSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: { code: 'VALIDATION_ERROR', message: '请检查输入条件。', retryable: false } };
      return request('/maps/jobs', CreateMapJobResponseSchema, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(parsed.data)
      }, signal);
    },
    getJob: (id, signal) => request(`/maps/jobs/${encodeURIComponent(id)}`, JobSchema, {}, signal),
    async getMap(id, signal) {
      const result = await request(`/maps/${encodeURIComponent(id)}`, ExperienceMapSchema, {}, signal);
      if (result.ok && !referencesValid(result.data)) return { ok: false, error: invalid };
      return result;
    }
  };
}
function referencesValid(map: ExperienceMap): boolean {
  if (validateEvidenceReferences(map).length) return false;
  const ids = new Set(map.evidence.map(e => e.evidenceId));
  return [...map.routes.flatMap(r => [...r.evidenceIds, ...r.stages.flatMap(s => s.tasks.flatMap(t => t.evidenceIds))]),
    ...map.differences.flatMap(d => d.evidenceIds)].every(id => ids.has(id));
}
export function createMockClient(): MapClient {
  const fixture = () => import('@experience-map/contracts/fixtures');
  const missing = { ok: false as const, error: { code: 'JOB_EXPIRED', message: '演示资源不存在。', retryable: false } };
  return {
    async createJob(payload) {
      if (!CreateMapJobRequestSchema.safeParse(payload).success) return { ok: false, error: invalid };
      return { ok: true, data: { jobId: (await fixture()).replayJob.jobId, status: 'queued', pollAfterMs: 1500 } };
    },
    async getJob(id) { const { replayJob } = await fixture(); return id === replayJob.jobId ? { ok: true, data: JobSchema.parse(replayJob) } : missing; },
    async getMap(id) { const { replayMap } = await fixture(); return id === replayMap.mapId ? { ok: true, data: ExperienceMapSchema.parse(replayMap) } : missing; }
  };
}
export function resolveMode(value: unknown, production = false): ClientMode {
  if (value === undefined || value === '') return production ? 'live' : 'replay';
  if (value === 'mock' || value === 'replay' || value === 'live') return value;
  throw new Error('VITE_DATA_MODE must be mock, replay or live');
}
