import { z } from 'zod';

export const InputModeSchema = z.enum(['topic', 'question_url']);
export const DataModeSchema = z.enum(['live', 'replay']);
export const JobStatusSchema = z.enum(['queued', 'retrieving', 'organizing', 'validating', 'succeeded', 'failed', 'expired']);
export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR', 'IDEMPOTENCY_CONFLICT', 'UPSTREAM_AUTH', 'UPSTREAM_RATE_LIMIT',
  'UPSTREAM_TIMEOUT', 'UPSTREAM_EMPTY', 'MODEL_INVALID_OUTPUT', 'EVIDENCE_INSUFFICIENT',
  'JOB_EXPIRED', 'INTERNAL_ERROR'
]);

const nullableText = z.string().trim().min(1).max(200).nullable();
const constraintsSchema = z.object({
  background: nullableText,
  weeks: z.number().int().min(1).max(104).nullable(),
  hoursPerWeek: z.number().min(0).max(168).nullable(),
  budgetCny: z.number().min(0).max(1_000_000).nullable()
}).strict();

export const CreateMapJobRequestSchema = z.object({
  inputMode: InputModeSchema,
  query: z.string().trim().min(1).max(500).nullable(),
  questionUrl: z.string().url().regex(/^https:\/\/www\.zhihu\.com\/question\/\d+(?:[/?#].*)?$/).nullable(),
  focus: z.string().trim().max(300).nullable(),
  constraints: constraintsSchema,
  dataMode: DataModeSchema
}).strict().superRefine((value, ctx) => {
  if (value.inputMode === 'topic' && (!value.query || value.questionUrl !== null)) {
    ctx.addIssue({ code: 'custom', path: ['query'], message: 'topic 模式要求 query 非空且 questionUrl 为 null' });
  }
  if (value.inputMode === 'question_url' && (!value.questionUrl || value.query !== null)) {
    ctx.addIssue({ code: 'custom', path: ['questionUrl'], message: 'question_url 模式要求 questionUrl 非空且 query 为 null' });
  }
});
export type CreateMapJobRequest = z.infer<typeof CreateMapJobRequestSchema>;

export const CreateMapJobResponseSchema = z.object({ jobId: z.string().min(1), status: z.literal('queued'), pollAfterMs: z.number().int().positive() }).strict();
export type CreateMapJobResponse = z.infer<typeof CreateMapJobResponseSchema>;

export const ErrorResponseSchema = z.object({ error: z.object({ code: ErrorCodeSchema, message: z.string().min(1), retryable: z.boolean(), requestId: z.string().min(1) }).strict() }).strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const JobSchema = z.object({
  jobId: z.string().min(1), status: JobStatusSchema, message: z.string().min(1), mapId: z.string().min(1).nullable(),
  error: ErrorResponseSchema.shape.error.nullable(), retryable: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime()
}).strict();
export type Job = z.infer<typeof JobSchema>;

export const SourceSchema = z.object({
  sourceId: z.string().min(1), contentType: z.enum(['answer', 'article', 'question_answer_summary']),
  title: z.string().min(1), authorName: z.string().nullable(), summary: z.string().min(1), quoteableText: z.string().min(1),
  url: z.string().url(), publishedAt: z.string().datetime().nullable(), retrievedAt: z.string().datetime(),
  authorityLevel: z.string().nullable(), metrics: z.record(z.string(), z.number()).nullable()
}).strict();
export type Source = z.infer<typeof SourceSchema>;

export const EvidenceSchema = z.object({
  evidenceId: z.string().min(1), sourceId: z.string().min(1), claim: z.string().min(1), quote: z.string().min(1), support: z.enum(['direct', 'contextual'])
}).strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TaskSchema = z.object({ taskId: z.string().min(1), action: z.string().min(1), doneWhen: z.string().min(1), evidenceIds: z.array(z.string().min(1)).min(1) }).strict();
export const StageSchema = z.object({ stageId: z.string().min(1), title: z.string().min(1), suggestedWeeks: z.string(), tasks: z.array(TaskSchema).min(1).max(3) }).strict();
export const RouteSchema = z.object({
  routeId: z.string().min(1), title: z.string().min(1), strategy: z.string().min(1), fit: z.array(z.string().min(1)),
  tradeoffs: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }).strict()), stages: z.array(StageSchema).min(2).max(5),
  risks: z.array(z.string().min(1)), evidenceIds: z.array(z.string().min(1)).min(1)
}).strict();
export type Route = z.infer<typeof RouteSchema>;

export const DifferenceSchema = z.object({ title: z.string().min(1), summary: z.string().min(1), evidenceIds: z.array(z.string().min(1)).min(1) }).strict();
export const DataStatusSchema = z.object({ mode: DataModeSchema, retrievedAt: z.string().datetime(), sources: z.string().min(1), notice: z.string().min(1) }).strict();
// Optional metadata keeps existing saved maps and fixtures readable.
export const PresentationSchema = z.object({
  kind: z.enum(['plan', 'process', 'choice', 'preparation', 'skill', 'insight']),
  timing: z.enum(['none', 'source', 'suggested']),
  timingNote: z.string(),
  completeness: z.enum(['complete', 'sources_only']),
  focus: z.object({
    requested: z.string().nullable(),
    status: z.enum(['not_requested', 'covered', 'limited']),
    summary: z.string(),
    evidenceIds: z.array(z.string())
  }).strict()
}).strict();
export const ExperienceMapSchema = z.object({
  schemaVersion: z.literal('1.0'), mapId: z.string().min(1), query: z.string().nullable(), inputMode: InputModeSchema, questionUrl: z.string().url().nullable(),
  constraints: constraintsSchema, dataStatus: DataStatusSchema, overview: z.string().min(1), routes: z.array(RouteSchema).max(3),
  differences: z.array(DifferenceSchema), evidence: z.array(EvidenceSchema), sources: z.array(SourceSchema), limitations: z.array(z.string().min(1)), presentation: PresentationSchema.optional()
}).strict();
export type ExperienceMap = z.infer<typeof ExperienceMapSchema>;

export function validateEvidenceReferences(map: ExperienceMap): string[] {
  const sourceIds = new Set(map.sources.map((source) => source.sourceId));
  const evidenceIds = new Set(map.evidence.map((evidence) => evidence.evidenceId));
  const errors: string[] = [];
  for (const evidence of map.evidence) {
    if (!sourceIds.has(evidence.sourceId)) errors.push(`${evidence.evidenceId}: unknown sourceId ${evidence.sourceId}`);
    const source = map.sources.find((item) => item.sourceId === evidence.sourceId);
    if (source && !source.quoteableText.includes(evidence.quote)) errors.push(`${evidence.evidenceId}: quote is not a contiguous source excerpt`);
  }
  for (const route of map.routes) {
    if (route.evidenceIds.filter((id) => evidenceIds.has(id)).length < 1) errors.push(`${route.routeId}: no valid evidence`);
    if (route.evidenceIds.map((id) => map.evidence.find((e) => e.evidenceId === id)?.sourceId).filter(Boolean).length < 2 && map.sources.length > 1) errors.push(`${route.routeId}: requires two distinct sources when available`);
  }
  return errors;
}
