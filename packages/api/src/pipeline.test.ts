import { describe, expect, it, vi } from 'vitest';
import { replayMap } from '@experience-map/contracts/fixtures';
import { DeterministicModelAdapter, validateModelOutput, ZhidaHttpModelAdapter } from './pipeline.js';

const constraints = { background: null, weeks: null, hoursPerWeek: null, budgetCny: null };
const singleSource = [{ contentType: 'answer' as const, summary: '可执行建议', url: 'https://www.zhihu.com/a' }];

describe('pipeline validation', () => {
  it('rejects malformed model output', () => { expect(() => validateModelOutput({ nope: true })).toThrow('MODEL_INVALID_OUTPUT'); });

  it('creates a schema-valid topic map from sanitized summaries', async () => {
    const map = await new DeterministicModelAdapter().organize({ query: '测试', inputMode: 'topic', questionUrl: null, constraints, sources: singleSource });
    expect(map).toMatchObject({ schemaVersion: '1.0', inputMode: 'topic', questionUrl: null });
  });

  it('preserves question_url mode and URL', async () => {
    const questionUrl = 'https://www.zhihu.com/question/123';
    const map = await new DeterministicModelAdapter().organize({ query: null, inputMode: 'question_url', questionUrl, constraints, sources: singleSource });
    expect(map).toMatchObject({ inputMode: 'question_url', questionUrl, query: null });
  });

  it('calls the documented non-streaming Zhida endpoint and parses JSON content', async () => {
    vi.stubEnv('ZHIHU_ACCESS_SECRET', 'test-secret-not-real');
    let calledUrl = '';
    let requestBody: { model?: string; stream?: boolean; messages?: unknown[] } = {};
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calledUrl = input.toString();
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replayMap) } }] }), { status: 200 });
    }));
    try {
      const raw = await new ZhidaHttpModelAdapter().organize({ query: '测试', inputMode: 'topic', questionUrl: null, constraints, sources: singleSource });
      expect(calledUrl).toBe('https://developer.zhihu.com/v1/chat/completions');
      expect(requestBody).toMatchObject({ model: 'zhida-fast-1p5', stream: false });
      expect(requestBody.messages).toHaveLength(1);
      expect(raw).toEqual(replayMap);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('pipeline evidence gates', () => {
  it('maps non-contiguous quotes to evidence insufficiency', async () => {
    const adapter = new DeterministicModelAdapter();
    const map = await adapter.organize({ query: '测试', inputMode: 'topic', questionUrl: null, constraints, sources: [{ contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' }, { contentType: 'article', summary: '另一条建议', url: 'https://zhuanlan.zhihu.com/p/2' }] });
    map.evidence[0].quote = '不是来源中的连续文本';
    expect(() => validateModelOutput(map)).toThrow('EVIDENCE_INSUFFICIENT');
  });

  it('rejects a route that lacks distinct source evidence when alternatives exist', async () => {
    const adapter = new DeterministicModelAdapter();
    const map = await adapter.organize({ query: '测试', inputMode: 'topic', questionUrl: null, constraints, sources: [{ contentType: 'answer', summary: '建议一', url: 'https://www.zhihu.com/a' }, { contentType: 'article', summary: '建议二', url: 'https://zhuanlan.zhihu.com/p/2' }] });
    map.routes[0].evidenceIds = [map.evidence[0].evidenceId];
    expect(() => validateModelOutput(map)).toThrow('EVIDENCE_INSUFFICIENT');
  });
});