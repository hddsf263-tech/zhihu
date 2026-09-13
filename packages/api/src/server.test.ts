import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './server.js';

describe('API baseline', () => {
  it('validates create job payloads', async () => {
    const response = await request(app).post('/api/v1/maps/jobs').send({ inputMode: 'topic', query: null });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('serves replay job and map', async () => {
    const job = await request(app).get('/api/v1/maps/jobs/job_replay_pm_intern');
    expect(job.status).toBe(200);
    const map = await request(app).get('/api/v1/maps/map_replay_pm_intern');
    expect(map.status).toBe(200);
    expect(map.body.dataStatus.mode).toBe('replay');
  });
});
