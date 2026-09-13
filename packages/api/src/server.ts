import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { CreateMapJobRequestSchema, ErrorResponseSchema } from '@experience-map/contracts';
import { JobManager } from './job-manager.js';
import { MemoryJobStore, SqliteJobStore, type JobStore } from './job-store.js';
import { ZhihuHttpClient, type ZhihuClient } from './providers.js';
import { DeterministicModelAdapter, ZhidaHttpModelAdapter, type ModelAdapter } from './pipeline.js';

export function createApp(options: { store?: JobStore; client?: ZhihuClient; model?: ModelAdapter } = {}) {
  const app = express();
  const manager = new JobManager(
    options.client ?? new ZhihuHttpClient(),
    options.model ?? (process.env.NODE_ENV === 'test' ? new DeterministicModelAdapter() : new ZhidaHttpModelAdapter()),
    options.store ?? new MemoryJobStore()
  );
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));

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
    const job = manager.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '整理任务不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
    return res.json(job);
  });

  app.get('/api/v1/maps/:mapId', (req, res) => {
    const map = manager.getMap(req.params.mapId);
    if (!map) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '经验地图不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
    return res.json(map);
  });

  // In the production container, serve the built Vite app from the same
  // origin as the API. Keeping API routes above this fallback prevents the
  // SPA handler from masking API errors.
  const webDist = resolve(process.cwd(), 'packages/web/dist');
  app.use(express.static(webDist));
  app.get(/^(?!\/api\/v1(?:\/|$)).*/, (_req, res) => {
    res.sendFile(resolve(webDist, 'index.html'));
  });

  return { app, manager };
}

const defaultApplication = process.env.NODE_ENV === 'test'
  ? createApp()
  : createApp({ store: new SqliteJobStore(resolve(process.env.DATABASE_PATH ?? './data/experience-map.db')) });

export const app = defaultApplication.app;

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  const server = app.listen(port, () => console.log(`API listening on ${port}`));
  const close = () => server.close(() => { defaultApplication.manager.close(); process.exit(0); });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
