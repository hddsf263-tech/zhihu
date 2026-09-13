import { describe, expect, it } from 'vitest';
import { DeterministicModelAdapter, validateModelOutput } from './pipeline.js';

describe('pipeline validation', () => {
  it('rejects malformed model output', () => { expect(() => validateModelOutput({ nope: true })).toThrow('MODEL_INVALID_OUTPUT'); });
  it('creates a schema-valid map from sanitized summaries', async () => {
    const map = await new DeterministicModelAdapter().organize({ query: '测试', constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, sources: [{ contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' }] });
    expect(map.schemaVersion).toBe('1.0');
  });
});

describe('pipeline evidence gates', () => {
  it('maps non-contiguous quotes to evidence insufficiency', async () => {
    const adapter = new DeterministicModelAdapter();
    const map = await adapter.organize({ query: '测试', constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, sources: [{ contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' }, { contentType: 'article', summary: '另一条建议', url: 'https://zhuanlan.zhihu.com/p/2' }] });
    map.evidence[0].quote = '不是来源中的连续文本';
    expect(() => validateModelOutput(map)).toThrow('EVIDENCE_INSUFFICIENT');
  });

  it('rejects a route that lacks distinct source evidence when alternatives exist', async () => {
    const adapter = new DeterministicModelAdapter();
    const map = await adapter.organize({ query: '测试', constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, sources: [{ contentType: 'answer', summary: '建议一', url: 'https://www.zhihu.com/a' }, { contentType: 'article', summary: '建议二', url: 'https://zhuanlan.zhihu.com/p/2' }] });
    map.routes[0].evidenceIds = [map.evidence[0].evidenceId];
    expect(() => validateModelOutput(map)).toThrow('EVIDENCE_INSUFFICIENT');
  });
});