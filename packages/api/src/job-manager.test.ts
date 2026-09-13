import { describe, expect, it, vi } from 'vitest';
import { JobManager } from './job-manager.js';
import { DeterministicModelAdapter } from './pipeline.js';
import type { CreateMapJobRequest } from '@experience-map/contracts';
import type { ZhihuClient, ZhihuSource } from './providers.js';

const liveRequest: CreateMapJobRequest = {
  inputMode: 'topic', query: '测试主题', questionUrl: null, focus: null,
  constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live'
};

function fakeClient(counter: { calls: number }): ZhihuClient {
  const source: ZhihuSource = { contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' };
  return { search: vi.fn(async () => { counter.calls += 1; return [source]; }), questionAnswers: vi.fn(async () => [source]) };
}

describe('job manager M2-4 boundaries', () => {
  it('reuses the same live job for an idempotency key', async () => {
    const counter = { calls: 0 };
    const manager = new JobManager(fakeClient(counter), new DeterministicModelAdapter());
    const first = manager.create(liveRequest, 'idem-1');
    const second = manager.create(liveRequest, 'idem-1');
    expect(second).toEqual(first);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(counter.calls).toBe(1);
  });

  it('keeps replay mode read-only and does not call the upstream client', () => {
    const counter = { calls: 0 };
    const manager = new JobManager(fakeClient(counter), new DeterministicModelAdapter());
    const replay = { ...liveRequest, dataMode: 'replay' as const };
    const response = manager.create(replay, 'replay-1');
    expect(response.jobId).toBe('job_replay_pm_intern');
    expect(counter.calls).toBe(0);
    expect(manager.maps.has('map_replay_pm_intern')).toBe(true);
  });
});