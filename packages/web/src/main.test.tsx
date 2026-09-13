import { afterEach, describe, expect, it, vi } from 'vitest';
import { replayMap, replayJob } from '@experience-map/contracts/fixtures';
import { createHttpClient, createMockClient, resolveMode } from './api-client.js';
import { markdownPlan, readCompleted, safeSourceUrl, statusLabel } from './presentation.js';
const payload = { inputMode: 'topic' as const, query: '产品经理实习', questionUrl: null, focus: null, constraints: replayMap.constraints, dataMode: 'replay' as const };
afterEach(() => vi.useRealTimers());
describe('HTTP boundary', () => {
  it('sends only same-origin application request with stable idempotency key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ jobId: replayJob.jobId, status: 'queued', pollAfterMs: 1500 }));
    const client = createHttpClient(fetcher);
    await client.createJob(payload, 'same-key'); await client.createJob(payload, 'same-key');
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe('/api/v1/maps/jobs'); expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'Idempotency-Key': 'same-key' });
      expect(JSON.parse(String(init?.body))).toEqual(payload);
    }
  });
  it('rejects invalid input before any network call', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await createHttpClient(fetcher).createJob({ ...payload, constraints: { ...payload.constraints, weeks: -1 } }, 'k');
    expect(result.ok).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves structured rate limits and does not automatically retry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { code: 'UPSTREAM_RATE_LIMIT', message: '受限', retryable: false, requestId: 'req_1' } }, { status: 429 }));
    const result = await createHttpClient(fetcher).getJob('id');
    expect(result).toMatchObject({ ok: false, error: { code: 'UPSTREAM_RATE_LIMIT', retryable: false } }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects schema-invalid and dangling task evidence from server', async () => {
    const malformed = structuredClone(replayMap); malformed.routes[0].stages[0].tasks[0].evidenceIds = ['missing'];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ mapId: 'bad' })).mockResolvedValueOnce(Response.json(malformed));
    const client = createHttpClient(fetcher);
    expect((await client.getMap('x')).ok).toBe(false); expect((await client.getMap('y')).ok).toBe(false);
  });
  it('aborts hung requests with a recoverable network error', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const promise = createHttpClient(fetcher).getJob('id'); await vi.advanceTimersByTimeAsync(12001);
    expect(await promise).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR', retryable: true } });
  });
  it('mock mode returns labelled fixture without network', async () => {
    const client = createMockClient(); const result = await client.getMap(replayMap.mapId);
    expect(result.ok && result.data.dataStatus.sources).toBe('fixture'); expect((await client.getJob('unknown')).ok).toBe(false);
    expect(resolveMode(undefined)).toBe('replay'); expect(() => resolveMode('oops')).toThrow();
  });
});
describe('safe presentation and persisted plan', () => {
  it('filters stale task IDs and deduplicates saved progress', () => {
    const route = replayMap.routes[0]; const id = route.stages[0].tasks[0].taskId;
    expect(readCompleted(JSON.stringify({ schemaVersion: '1.0', completedTaskIds: [id, id, 'stale', 7] }), route)).toEqual([id]);
    expect(readCompleted('null', route)).toEqual([]);
  });
  it('exports actual newlines, conditions, completion and synthetic provenance without fake source links', () => {
    const route = replayMap.routes[0]; const text = markdownPlan(replayMap, route, [route.stages[0].tasks[0].taskId]);
    expect(text).toContain('\n## 来源\n'); expect(text).toContain('- [x]'); expect(text).toContain('预算：500');
    expect(text).toContain('合成测试'); expect(text).not.toContain('https://www.zhihu.com/question/123456789');
  });
  it('allows only actual https Zhihu links and preserves query provenance', () => {
    const url = 'https://www.zhihu.com/question/999?utm_source=official'; expect(safeSourceUrl(url)).toBe(url);
    for (const bad of ['javascript:alert(1)', 'https://zhihu.com.evil.test/x', 'https://user@www.zhihu.com/x']) expect(safeSourceUrl(bad)).toBeNull();
    expect(statusLabel(replayMap)).toContain('合成'); expect(statusLabel({ ...replayMap, dataStatus: { ...replayMap.dataStatus, mode: 'live', sources: 'zhihu_search', notice: '实时' } })).toBe('实时整理');
  });
});
