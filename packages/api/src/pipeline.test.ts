import { describe, expect, it } from 'vitest';
import { DeterministicModelAdapter, validateModelOutput } from './pipeline.js';

describe('pipeline validation', () => {
  it('rejects malformed model output', () => { expect(() => validateModelOutput({ nope: true })).toThrow('MODEL_INVALID_OUTPUT'); });
  it('creates a schema-valid map from sanitized summaries', async () => {
    const map = await new DeterministicModelAdapter().organize({ query: '测试', constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, sources: [{ contentType: 'answer', summary: '可执行建议', url: 'https://www.zhihu.com/a' }] });
    expect(map.schemaVersion).toBe('1.0');
  });
});
