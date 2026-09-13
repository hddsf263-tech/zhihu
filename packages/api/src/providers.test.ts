import { describe, expect, it, vi } from 'vitest';
import { dedupeSources, normalizeZhihuItem, UpstreamError, ZhihuHttpClient } from './providers.js';

function withTestSecret() { vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real'); }
function cleanup() { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }

describe('Zhihu provider protocol and normalization', () => {
  it('maps documented search fields and drops empty summaries', () => {
    const [source] = normalizeZhihuItem({ ContentType: 'Article', ContentText: '摘要', ContentID: '123', Title: '标题', AuthorName: '作者', EditTime: 1_700_000_000, Url: 'https://zhuanlan.zhihu.com/p/123' });
    expect(source).toMatchObject({ contentType: 'article', summary: '摘要', contentToken: '123', title: '标题', authorName: '作者', publishedAt: new Date(1_700_000_000_000).toISOString() });
    expect(normalizeZhihuItem({ ContentText: '', Url: 'https://www.zhihu.com/a' })).toEqual([]);
  });

  it('uses the documented GET search endpoint and Data.Items envelope', async () => {
    withTestSecret();
    let calledUrl = '';
    let calledMethod = '';
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calledUrl = input.toString();
      calledMethod = init?.method ?? '';
      return new Response(JSON.stringify({ Code: 0, Data: { Items: [{ ContentType: 'Answer', ContentText: '摘要', Url: 'https://www.zhihu.com/answer/1' }] } }), { status: 200 });
    }));
    try {
      const sources = await new ZhihuHttpClient().search('测试 主题', new AbortController().signal);
      const url = new URL(calledUrl);
      expect(calledMethod).toBe('GET');
      expect(url.origin + url.pathname).toBe('https://developer.zhihu.com/api/v1/content/zhihu_search');
      expect(url.searchParams.get('Query')).toBe('测试 主题');
      expect(url.searchParams.get('Count')).toBe('10');
      expect(sources[0].summary).toBe('摘要');
    } finally { cleanup(); }
  });

  it('uses the documented question answers query and summary type', async () => {
    withTestSecret();
    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      calledUrl = input.toString();
      return new Response(JSON.stringify({ Code: 0, Data: { Items: [{ ContentType: 'Answer', ContentToken: 'answer-token', Summary: '回答摘要', Url: 'https://www.zhihu.com/answer/2' }] } }), { status: 200 });
    }));
    try {
      const questionUrl = 'https://www.zhihu.com/question/123';
      const [source] = await new ZhihuHttpClient().questionAnswers(questionUrl, new AbortController().signal);
      const url = new URL(calledUrl);
      expect(url.pathname).toBe('/api/v1/content/question_answers');
      expect(url.searchParams.get('QuestionUrl')).toBe(questionUrl);
      expect(url.searchParams.get('Offset')).toBe('0');
      expect(url.searchParams.get('Limit')).toBe('20');
      expect(source).toMatchObject({ contentType: 'question_answer_summary', summary: '回答摘要', contentToken: 'answer-token' });
    } finally { cleanup(); }
  });

  it('deduplicates and bounds sources', () => {
    const sources = Array.from({ length: 12 }, (_, i) => ({ contentType: 'answer' as const, summary: `s${i % 2}`, url: `u${i % 2}` }));
    expect(dedupeSources(sources)).toHaveLength(2);
  });

  it('exposes typed upstream errors', () => {
    expect(new UpstreamError('UPSTREAM_TIMEOUT', 'timeout', true).retryable).toBe(true);
  });

  it('maps HTTP 429 to rate limit', async () => {
    withTestSecret();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    try { await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' }); }
    finally { cleanup(); }
  });

  it('maps business code 30001 to rate limit', async () => {
    withTestSecret();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Code: 30001, Message: 'rate limited' }), { status: 200 })));
    try { await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' }); }
    finally { cleanup(); }
  });

  it('maps business code 20001 to auth failure', async () => {
    withTestSecret();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Code: 20001, Message: 'unauthorized' }), { status: 200 })));
    try { await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_AUTH' }); }
    finally { cleanup(); }
  });

  it('maps an aborted request to retryable timeout', async () => {
    withTestSecret();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }));
    try { await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', retryable: true }); }
    finally { cleanup(); }
  });

  it('maps an empty successful payload to upstream empty', async () => {
    withTestSecret();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Code: 0, Data: { Items: [] } }), { status: 200 })));
    try { await expect(new ZhihuHttpClient().search('测试', new AbortController().signal)).rejects.toMatchObject({ code: 'UPSTREAM_EMPTY' }); }
    finally { cleanup(); }
  });
});