import { describe, expect, it, vi } from 'vitest';
import { dedupeSources, normalizeZhihuItem, UpstreamError, ZhihuHttpClient } from './providers.js';

describe('Zhihu provider normalization', () => {
  it('maps documented fields and drops empty summaries', () => {
    expect(normalizeZhihuItem({ ContentType: 'answer', Summary: '摘要', Url: 'https://www.zhihu.com/a' })).toHaveLength(1);
    expect(normalizeZhihuItem({ Summary: '', Url: 'https://www.zhihu.com/a' })).toEqual([]);
  });

  it('deduplicates and bounds sources', () => {
    const sources = Array.from({ length: 12 }, (_, i) => ({ contentType: 'answer' as const, summary: `s${i % 2}`, url: `u${i % 2}` }));
    expect(dedupeSources(sources)).toHaveLength(2);
  });

  it('exposes typed upstream errors', () => {
    expect(new UpstreamError('UPSTREAM_TIMEOUT', 'timeout', true).retryable).toBe(true);
  });

  it('maps HTTP 429 to rate limit', async () => {
    vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    try {
      await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('maps business code 30001 to rate limit', async () => {
    vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Code: 30001, Message: 'rate limited' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    try {
      await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('maps an aborted request to retryable timeout', async () => {
    vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }));
    try {
      await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', retryable: true });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('maps an empty successful payload to upstream empty', async () => {
    vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    try {
      await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_EMPTY' });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});