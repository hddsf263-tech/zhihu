import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { CreateMapJobRequestSchema, ErrorResponseSchema } from '@experience-map/contracts';
import { JobManager } from './job-manager.js';
import { ZhihuHttpClient } from './providers.js';
import { DeterministicModelAdapter } from './pipeline.js';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
const manager = new JobManager(new ZhihuHttpClient(), new DeterministicModelAdapter());

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'api', timestamp: new Date().toISOString() }));

app.post('/api/v1/maps/jobs', (req, res) => {
  const parsed = CreateMapJobRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const body = { error: { code: 'VALIDATION_ERROR' as const, message: '请求参数不符合接口契约。', retryable: false, requestId: `req_${randomUUID()}` } };
    return res.status(400).json(ErrorResponseSchema.parse(body));
  }
  try {
    return res.status(202).json(manager.create(parsed.data, String(req.header('Idempotency-Key') ?? randomUUID())));
  } catch (error) {
    if ((error as Error).message === 'IDEMPOTENCY_CONFLICT') return res.status(409).json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: '相同幂等键对应了不同请求。', retryable: false, requestId: `req_${randomUUID()}` } });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用。', retryable: true, requestId: `req_${randomUUID()}` } });
  }
});

app.get('/api/v1/maps/jobs/:jobId', (req, res) => {
  const job = manager.jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '整理任务不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
  return res.json(job);
});

app.get('/api/v1/maps/:mapId', (req, res) => {
  const map = manager.maps.get(req.params.mapId);
  if (!map) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '经验地图不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
  return res.json(map);
});

if (process.env.NODE_ENV !== 'test') app.listen(Number(process.env.API_PORT ?? 3001), () => console.log(`API listening on ${process.env.API_PORT ?? 3001}`));