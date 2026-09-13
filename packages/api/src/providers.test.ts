import { describe, expect, it } from 'vitest';
import { dedupeSources, normalizeZhihuItem, UpstreamError } from './providers.js';

describe('Zhihu provider normalization', () => {
  it('maps documented fields and drops empty summaries', () => {
    expect(normalizeZhihuItem({ ContentType: 'answer', Summary: '摘要', Url: 'https://www.zhihu.com/a' })).toHaveLength(1);
    expect(normalizeZhihuItem({ Summary: '', Url: 'https://www.zhihu.com/a' })).toEqual([]);
  });
  it('deduplicates and bounds sources', () => {
    const sources = Array.from({ length: 12 }, (_, i) => ({ contentType: 'answer' as const, summary: `s${i % 2}`, url: `u${i % 2}` }));
    expect(dedupeSources(sources)).toHaveLength(2);
  });
  it('exposes typed upstream errors', () => { expect(new UpstreamError('UPSTREAM_TIMEOUT', 'timeout', true).retryable).toBe(true); });
});
