import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  CreateMapJobResponseSchema,
  ExperienceMapSchema,
  JobSchema,
  type CreateMapJobRequest,
  type CreateMapJobResponse,
  type ExperienceMap,
  type Job
} from '@experience-map/contracts';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

type IdempotencyRecord = {
  fingerprint: string;
  response: CreateMapJobResponse;
};

export interface JobStore {
  getJob(jobId: string): Job | undefined;
  saveJob(job: Job, request?: CreateMapJobRequest): void;
  getMap(mapId: string): ExperienceMap | undefined;
  saveMap(map: ExperienceMap): void;
  getIdempotency(key: string): IdempotencyRecord | undefined;
  saveIdempotency(key: string, fingerprint: string, response: CreateMapJobResponse): void;
  close(): void;
}

export class MemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly maps = new Map<string, ExperienceMap>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  getJob(jobId: string) { return this.jobs.get(jobId); }
  saveJob(job: Job) { this.jobs.set(job.jobId, job); }
  getMap(mapId: string) { return this.maps.get(mapId); }
  saveMap(map: ExperienceMap) { this.maps.set(map.mapId, map); }
  getIdempotency(key: string) { return this.idempotency.get(key); }
  saveIdempotency(key: string, fingerprint: string, response: CreateMapJobResponse) {
    this.idempotency.set(key, { fingerprint, response });
  }
  close() {}
}

export class SqliteJobStore implements JobStore {
  private readonly database: import('node:sqlite').DatabaseSync;

  constructor(databasePath: string, migrationPath = fileURLToPath(new URL('../migrations/001_init.sql', import.meta.url))) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.database.exec(readFileSync(migrationPath, 'utf8'));
    this.ensureColumn('jobs', 'payload_json', 'TEXT');
    this.ensureColumn('idempotency_keys', 'response_json', 'TEXT');
  }

  getJob(jobId: string): Job | undefined {
    const row = this.database.prepare('SELECT payload_json FROM jobs WHERE job_id = ?').get(jobId) as { payload_json: string | null } | undefined;
    return row?.payload_json ? JobSchema.parse(JSON.parse(row.payload_json)) : undefined;
  }

  saveJob(job: Job, request?: CreateMapJobRequest): void {
    this.database.prepare(`
      INSERT INTO jobs (job_id, status, request_json, payload_json, map_id, error_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        status = excluded.status,
        request_json = CASE WHEN excluded.request_json = '{}' THEN jobs.request_json ELSE excluded.request_json END,
        payload_json = excluded.payload_json,
        map_id = excluded.map_id,
        error_json = excluded.error_json,
        updated_at = excluded.updated_at
    `).run(
      job.jobId,
      job.status,
      request ? JSON.stringify(request) : '{}',
      JSON.stringify(job),
      job.mapId,
      job.error ? JSON.stringify(job.error) : null,
      job.createdAt,
      job.updatedAt
    );
  }

  getMap(mapId: string): ExperienceMap | undefined {
    const row = this.database.prepare('SELECT payload_json FROM maps WHERE map_id = ?').get(mapId) as { payload_json: string } | undefined;
    return row ? ExperienceMapSchema.parse(JSON.parse(row.payload_json)) : undefined;
  }

  saveMap(map: ExperienceMap): void {
    this.database.prepare(`
      INSERT INTO maps (map_id, schema_version, payload_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(map_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        payload_json = excluded.payload_json
    `).run(map.mapId, map.schemaVersion, JSON.stringify(map), map.dataStatus.retrievedAt);
  }

  getIdempotency(key: string): IdempotencyRecord | undefined {
    const row = this.database.prepare('SELECT request_hash, response_json, job_id FROM idempotency_keys WHERE key = ?').get(key) as { request_hash: string; response_json: string | null; job_id: string } | undefined;
    if (!row) return undefined;
    const response = row.response_json
      ? CreateMapJobResponseSchema.parse(JSON.parse(row.response_json))
      : CreateMapJobResponseSchema.parse({ jobId: row.job_id, status: 'queued', pollAfterMs: 1500 });
    return { fingerprint: row.request_hash, response };
  }

  saveIdempotency(key: string, fingerprint: string, response: CreateMapJobResponse): void {
    this.database.prepare(`
      INSERT INTO idempotency_keys (key, request_hash, job_id, response_json, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        request_hash = excluded.request_hash,
        job_id = excluded.job_id,
        response_json = excluded.response_json
    `).run(key, fingerprint, response.jobId, JSON.stringify(response), new Date().toISOString());
  }

  close(): void { this.database.close(); }

  private ensureColumn(table: 'jobs' | 'idempotency_keys', column: 'payload_json' | 'response_json', type: 'TEXT'): void {
    const columns = this.database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}