import { CreateMapJobRequestSchema, ExperienceMapSchema, validateEvidenceReferences } from './index.js';
import { replayMap } from './fixtures.js';

CreateMapJobRequestSchema.parse({ inputMode: 'topic', query: '测试主题', questionUrl: null, focus: null, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null }, dataMode: 'replay' });
ExperienceMapSchema.parse(replayMap);
const errors = validateEvidenceReferences(replayMap);
if (errors.length) throw new Error(errors.join('; '));
console.log('contracts:check passed');
