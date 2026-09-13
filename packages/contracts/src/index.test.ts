import { describe, expect, it } from 'vitest';
import { CreateMapJobRequestSchema, ExperienceMapSchema, validateEvidenceReferences } from './index.js';
import { replayMap } from './fixtures.js';

describe('contracts', () => {
  it('accepts topic and question URL modes', () => {
    expect(() => CreateMapJobRequestSchema.parse({ inputMode: 'topic', query: '主题', questionUrl: null, focus: null, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: 0 }, dataMode: 'replay' })).not.toThrow();
    expect(() => CreateMapJobRequestSchema.parse({ inputMode: 'question_url', query: null, questionUrl: 'https://www.zhihu.com/question/123', focus: null, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live' })).not.toThrow();
  });
  it('rejects malformed mode combinations and URLs', () => {
    expect(() => CreateMapJobRequestSchema.parse({ inputMode: 'topic', query: null, questionUrl: null, focus: null, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live' })).toThrow();
    expect(() => CreateMapJobRequestSchema.parse({ inputMode: 'question_url', query: null, questionUrl: 'https://example.com/question/1', focus: null, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'live' })).toThrow();
  });
  it('accepts a valid map and checks contiguous citations', () => {
    expect(() => ExperienceMapSchema.parse(replayMap)).not.toThrow();
    expect(validateEvidenceReferences(replayMap)).toEqual([]);
  });
});
