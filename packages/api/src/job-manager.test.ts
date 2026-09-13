import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateMapJobRequest } from '@experience-map/contracts';
import { JobManager } from './job-manager.js';
import { MemoryJobStore, SqliteJobStore } from './job-store.js';
import { DeterministicModelAdapter } from './pipeline.js';
import type { ZhihuClient, ZhihuSource } from './providers.js';

const liveRequest: CreateMapJobRequest = {
  inputMode: 'topic', query: '测试主题', questionUrl: null, focus: null,
  constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live'
};

function fakeClient(counter: { calls: number }): ZhihuClient {
  const source: ZhihuSource = { contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' };
  return {
    search: vi.fn(async () => { counter.calls += 1; return [source]; }),
    questionAnswers: vi.fn(async () => [source])
  };
}

async function waitForTerminal(manager: JobManager, jobId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = manager.getJob(jobId);
    if (job?.status === 'succeeded' || job?.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('job did not finish');
}

const temporaryDirectories: string[] = [];
afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
});

describe('job manager M2-4 boundaries', () => {
  it('reuses the same live job for an idempotency key', async () => {
    const counter = { calls: 0 };
    const manager = new JobManager(fakeClient(counter), new DeterministicModelAdapter());
    const first = manager.create(liveRequest, 'idem-1');
    const second = manager.create(liveRequest, 'idem-1');
    expect(second).toEqual(first);
    await waitForTerminal(manager, first.jobId);
    expect(counter.calls).toBe(1);
  });

  it('keeps replay mode read-only and does not call the upstream client', () => {
    const counter = { calls: 0 };
    const manager = new JobManager(fakeClient(counter), new DeterministicModelAdapter());
    const replay = { ...liveRequest, dataMode: 'replay' as const };
    const response = manager.create(replay, 'replay-1');
    expect(response.jobId).toBe('job_replay_pm_intern');
    expect(counter.calls).toBe(0);
    expect(manager.getMap('map_replay_pm_intern')).toBeDefined();
  });

  it('does not run more live jobs than the configured concurrency limit', async () => {
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const client: ZhihuClient = {
      search: vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return [{ contentType: 'answer' as const, summary: '可执行建议', url: 'https://www.zhihu.com/a' }];
      }),
      questionAnswers: vi.fn(async () => [])
    };
    const manager = new JobManager(client, new DeterministicModelAdapter(), new MemoryJobStore(), 1);
    const first = manager.create(liveRequest, 'concurrency-1');
    const second = manager.create(liveRequest, 'concurrency-2');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.getJob(second.jobId)?.status).toBe('queued');
    expect(maximumActive).toBe(1);
    releases.shift()!();
    await waitForTerminal(manager, first.jobId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maximumActive).toBe(1);
    releases.shift()!();
    await waitForTerminal(manager, second.jobId);
  });
  it('restores jobs, maps, and idempotency responses after reopening SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'experience-map-sqlite-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'experience-map.db');
    const counter = { calls: 0 };
    const firstManager = new JobManager(fakeClient(counter), new DeterministicModelAdapter(), new SqliteJobStore(databasePath));
    const created = firstManager.create(liveRequest, 'persistent-idem');
    const completed = await waitForTerminal(firstManager, created.jobId);
    expect(completed.status).toBe('succeeded');
    firstManager.close();

    const reopened = new JobManager(fakeClient(counter), new DeterministicModelAdapter(), new SqliteJobStore(databasePath));
    expect(reopened.getJob(created.jobId)).toEqual(completed);
    expect(reopened.getMap(completed.mapId!)).toBeDefined();
    expect(reopened.create(liveRequest, 'persistent-idem')).toEqual(created);
    expect(counter.calls).toBe(1);
    reopened.close();
  });
});