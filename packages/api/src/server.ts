import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { CreateMapJobRequestSchema, ErrorResponseSchema } from '@experience-map/contracts';
import { replayJob, replayMap } from '@experience-map/contracts/fixtures';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

const jobs = new Map([[replayJob.jobId, replayJob]]);
const maps = new Map([[replayMap.mapId, replayMap]]);

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'api', timestamp: new Date().toISOString() }));

app.post('/api/v1/maps/jobs', (req, res) => {
  const parsed = CreateMapJobRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const body = { error: { code: 'VALIDATION_ERROR' as const, message: '请求参数不符合接口契约。', retryable: false, requestId: `req_${randomUUID()}` } };
    return res.status(400).json(ErrorResponseSchema.parse(body));
  }
  if (parsed.data.dataMode === 'replay') {
    jobs.set(replayJob.jobId, replayJob);
    return res.status(202).json({ jobId: replayJob.jobId, status: 'queued', pollAfterMs: 1500 });
  }
  const jobId = `job_${randomUUID()}`;
  return res.status(202).json({ jobId, status: 'queued', pollAfterMs: 1500 });
});

app.get('/api/v1/maps/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '整理任务不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
  return res.json(job);
});

app.get('/api/v1/maps/:mapId', (req, res) => {
  const map = maps.get(req.params.mapId);
  if (!map) return res.status(404).json({ error: { code: 'JOB_EXPIRED', message: '经验地图不存在或已过期。', retryable: false, requestId: `req_${randomUUID()}` } });
  return res.json(map);
});

if (process.env.NODE_ENV !== 'test') app.listen(Number(process.env.API_PORT ?? 3001), () => console.log(`API listening on ${process.env.API_PORT ?? 3001}`));