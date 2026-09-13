import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { CreateMapJobRequest } from '@experience-map/contracts';
import { createApp } from './server.js';
import { DeterministicModelAdapter, type ModelAdapter } from './pipeline.js';
import { UpstreamError, type ZhihuClient, type ZhihuSource } from './providers.js';

const liveRequest: CreateMapJobRequest = {
  inputMode: 'topic', query: '测试主题', questionUrl: null, focus: null,
  constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live'
};

const source: ZhihuSource = { contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' };
const successfulClient: ZhihuClient = { search: vi.fn(async () => [source]), questionAnswers: vi.fn(async () => [source]) };

async function pollJob(app: ReturnType<typeof createApp>['app'], jobId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await request(app).get(`/api/v1/maps/jobs/${jobId}`);
    if (response.body.status === 'succeeded' || response.body.status === 'failed') return response;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('job did not finish');
}

function failingClient(code: 'UPSTREAM_EMPTY' | 'UPSTREAM_RATE_LIMIT' | 'UPSTREAM_TIMEOUT'): ZhihuClient {
  return {
    search: vi.fn(async () => { throw new UpstreamError(code, code, code === 'UPSTREAM_TIMEOUT'); }),
    questionAnswers: vi.fn(async () => { throw new UpstreamError(code, code, code === 'UPSTREAM_TIMEOUT'); })
  };
}

describe('API baseline and callable states', () => {
  it('validates create job payloads', async () => {
    const { app } = createApp({ client: successfulClient });
    const response = await request(app).post('/api/v1/maps/jobs').send({ inputMode: 'topic', query: null });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('serves replay via POST, job GET, and map GET without upstream calls', async () => {
    const client = { search: vi.fn(async () => [source]), questionAnswers: vi.fn(async () => [source]) };
    const { app } = createApp({ client });
    const created = await request(app).post('/api/v1/maps/jobs').set('Idempotency-Key', 'replay-http').send({ ...liveRequest, dataMode: 'replay' });
    expect(created.status).toBe(202);
    const job = await request(app).get(`/api/v1/maps/jobs/${created.body.jobId}`);
    expect(job.status).toBe(200);
    expect(job.body.status).toBe('succeeded');
    const map = await request(app).get(`/api/v1/maps/${job.body.mapId}`);
    expect(map.status).toBe(200);
    expect(map.body.dataStatus.mode).toBe('replay');
    expect(client.search).not.toHaveBeenCalled();
  });

  it('returns a successful live map through all three endpoints', async () => {
    const { app } = createApp({ client: successfulClient });
    const created = await request(app).post('/api/v1/maps/jobs').set('Idempotency-Key', 'live-http').send(liveRequest);
    expect(created.status).toBe(202);
    const job = await pollJob(app, created.body.jobId);
    expect(job.body.status).toBe('succeeded');
    const map = await request(app).get(`/api/v1/maps/${job.body.mapId}`);
    expect(map.status).toBe(200);
    expect(map.body.dataStatus.mode).toBe('live');
  });

  it.each([
    ['empty', 'UPSTREAM_EMPTY', false],
    ['rate-limit', 'UPSTREAM_RATE_LIMIT', false],
    ['timeout', 'UPSTREAM_TIMEOUT', true]
  ] as const)('exposes the %s state as a failed callable job', async (_name, code, retryable) => {
    const { app } = createApp({ client: failingClient(code) });
    const created = await request(app).post('/api/v1/maps/jobs').set('Idempotency-Key', `error-${code}`).send(liveRequest);
    const job = await pollJob(app, created.body.jobId);
    expect(job.body.status).toBe('failed');
    expect(job.body.error.code).toBe(code);
    expect(job.body.retryable).toBe(retryable);
  });

  it('exposes invalid-map as MODEL_INVALID_OUTPUT', async () => {
    const invalidModel: ModelAdapter = { organize: vi.fn(async () => ({ invalid: true })) };
    const { app } = createApp({ client: successfulClient, model: invalidModel });
    const created = await request(app).post('/api/v1/maps/jobs').set('Idempotency-Key', 'invalid-map').send(liveRequest);
    const job = await pollJob(app, created.body.jobId);
    expect(job.body.status).toBe('failed');
    expect(job.body.error.code).toBe('MODEL_INVALID_OUTPUT');
  });
});