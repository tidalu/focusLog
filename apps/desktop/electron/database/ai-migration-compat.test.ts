import Database from 'better-sqlite3-multiple-ciphers';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { desktopMigrations } from './migrations.js';
import { migrateDesktopDatabase } from './database.js';
import { AIJobQueue } from '../ai/job-queue.js';
import { QueueReadService } from '../ai/queue-read-service.js';
import { AIJobWorker } from '../ai/job-worker.js';
import { searchCheckIns } from './check-in-search.js';
import { AIService } from '../ai/ai-service.js';
import { AnalysisService } from '../ai/analysis-service.js';
import { DesktopCredentialStore } from '../ai/credentials.js';
import { createAIQueueRuntime } from '../ai/queue-runtime.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds
} from '../ai/daily-analysis-job.js';
import { loadBuiltinPrompt } from '../ai/prompts.js';
import { AnalysisSchedulerService } from '../ai/analysis-scheduler.js';
import { AnalysisReadService } from '../ai/analysis-read-service.js';

function historical(version: number): Database.Database {
  const database = new Database(':memory:');
  database.exec(
    'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
  );
  for (const migration of desktopMigrations.filter((item) => item.version <= version)) {
    for (const statement of migration.statements) database.exec(statement);
    database
      .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
      .run(migration.version, migration.name, '2026-01-01T00:00:00.000Z');
  }
  return database;
}

function insertSearchableCheckIn(
  database: Database.Database,
  ownerId: string,
  id: string,
  body: string
) {
  const revision = `${id}-revision`;
  database
    .prepare(
      `INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01T10:00:00.000Z', 'UTC', 'v1', '2026-01-01', '2026-01-01')`
    )
    .run(id, ownerId, revision);
  database
    .prepare(
      'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(revision, id, body, `${id}-operation`, '2026-01-01');
}

function migrationVersions(database: Database.Database): number[] {
  return (
    database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
      version: number;
    }>
  ).map((row) => row.version);
}

function upgradedDailyJob(
  queue: AIJobQueue,
  analysis: AnalysisService,
  profileId: string,
  model: string
) {
  const timezone = 'UTC';
  const prompt = loadBuiltinPrompt('daily');
  const payload = {
    schemaVersion: DAILY_ANALYSIS_PAYLOAD_VERSION,
    localDate: '2026-07-21',
    timezone,
    ...dailyPeriodBounds('2026-07-21', timezone),
    providerProfileId: profileId,
    requestedModelId: model,
    privacyMode: 'LOCAL' as const,
    promptId: prompt.id,
    promptVersion: prompt.version,
    sourceRevisionHash: analysis.dailySourceRevisionHash('2026-07-21', timezone),
    regeneration: 0,
    trigger: 'manual' as const
  };
  return queue.enqueue({
    kind: 'daily_analysis',
    idempotencyKey: dailyAnalysisIdempotencyKey(payload),
    payload,
    requestedProfileId: profileId,
    requestedModelId: model,
    privacyMode: 'LOCAL'
  });
}

describe('AI migration 7–9 upgrade compatibility', () => {
  it('upgrades a pre-AI database without changing canonical check-ins', () => {
    const database = historical(5);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    database
      .prepare(
        `INSERT INTO check_ins (id, owner_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run('check', 'owner', '2026-01-01T01:00:00.000Z', 'UTC', 'v1', '2026-01-01', '2026-01-01');
    migrateDesktopDatabase(database);
    expect(database.prepare('SELECT id FROM check_ins WHERE id = ?').get('check')).toBeTruthy();
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_jobs'").get()
    ).toBeTruthy();
    database.close();
  });

  it('upgrades migration 6 rows through 7–9 without linking historical memories', () => {
    const database = historical(6);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    database
      .prepare(
        `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('memory', 'owner', 'DAY', '2026-01-01', 1, 'ACTIVE', 'old', '1', '1', '2026-01-01');
    database
      .prepare(
        `INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'local',
        'owner',
        'Local',
        'ollama',
        1,
        'model',
        0.2,
        1,
        100,
        30000,
        2,
        1,
        0,
        1,
        0,
        '2026-01-01',
        '2026-01-01'
      );
    database
      .prepare(
        `INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'cloud',
        'owner',
        'Cloud',
        'openai',
        1,
        'cloud-model',
        0.2,
        1,
        100,
        30000,
        2,
        1,
        0,
        2,
        1,
        '2026-01-01',
        '2026-01-01'
      );
    database
      .prepare(
        `INSERT INTO ai_settings (owner_id, mode, max_context_tokens, max_output_tokens, data_sharing_preview, automatic_analysis, analyses_enabled, facts_enabled, graph_enabled, embeddings_enabled, playground_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('owner', 'LOCAL', 12000, 2048, 1, 0, 1, 1, 1, 1, 1, '2026-01-01');
    database
      .prepare(
        `INSERT INTO ai_cloud_consents (id, owner_id, provider_profile_id, mode, consented_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run('consent', 'owner', 'cloud', 'CLOUD', '2026-01-01');
    migrateDesktopDatabase(database);
    expect(
      database.prepare('SELECT job_id AS jobId FROM ai_memories WHERE id = ?').get('memory')
    ).toEqual({ jobId: null });
    expect(
      database
        .prepare(
          'SELECT content, structured_result_json AS structured, structured_schema_version AS structuredVersion, validation_status AS validationStatus FROM ai_memories WHERE id = ?'
        )
        .get('memory')
    ).toEqual({
      content: 'old',
      structured: null,
      structuredVersion: null,
      validationStatus: 'legacy'
    });
    expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('ai_memories') WHERE name IN ('structured_result_json', 'structured_schema_version', 'validation_status')"
        )
        .get()
    ).toEqual({ count: 3 });
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_queue_diagnostics'").get()
    ).toBeTruthy();
    expect(
      database
        .prepare('SELECT generation_model AS model FROM ai_provider_profiles WHERE id = ?')
        .get('local')
    ).toEqual({ model: 'model' });
    expect(
      database.prepare('SELECT mode FROM ai_settings WHERE owner_id = ?').get('owner')
    ).toEqual({ mode: 'LOCAL' });
    expect(
      database
        .prepare('SELECT provider_profile_id AS profile FROM ai_cloud_consents WHERE id = ?')
        .get('consent')
    ).toEqual({ profile: 'cloud' });
    expect(JSON.stringify(database.prepare('SELECT * FROM ai_jobs').all())).not.toContain(
      'FOCUSLOG_TEST_SECRET'
    );
    database.close();
  });

  it('runs production daily queue behavior after a migration 6 persistent upgrade without duplicates', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-migration-runtime-'));
    const file = join(root, 'migration6.sqlite');
    const source = historical(6);
    source
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    await source.backup(file);
    source.close();
    const database = new Database(file);
    migrateDesktopDatabase(database);
    const credentials = new DesktopCredentialStore(join(root, 'credentials'), {
      isAvailable: () => true,
      protect: (value) => Buffer.from(value),
      unprotect: (value) => value.toString()
    });
    const ai = new AIService(database, 'owner', credentials);
    const profile = ai.saveProfile({
      name: 'Upgraded Ollama',
      providerId: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      generationModel: 'qwen3:8b',
      enabled: true
    });
    const fixtureSecret = 'PHASE2B_MIGRATION_SECRET_CREDENTIAL';
    credentials.set(profile.id, fixtureSecret);
    ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
    insertSearchableCheckIn(
      database,
      'owner',
      'upgrade-daily',
      'Completed migration verification work.'
    );
    database
      .prepare(
        "UPDATE check_ins SET submitted_at = '2026-07-21T10:00:00.000Z' WHERE id = 'upgrade-daily'"
      )
      .run();
    const analysis = new AnalysisService(database, 'owner', ai);
    const runtime = createAIQueueRuntime(database, 'owner', analysis, {
      workerId: 'migration-runtime',
      pollIntervalMs: 10,
      leaseDurationMs: 100,
      leaseRenewalMs: 20
    });
    const structured = JSON.stringify({
      schemaVersion: 1,
      periodId: '2026-07-21',
      summary: 'Upgraded daily reflection.',
      keyPatterns: [],
      positiveChanges: [],
      difficulties: [],
      recurringDistractions: [],
      activeProjects: [],
      reflectionQuestions: [],
      suggestedNextSteps: [],
      confidence: 'medium',
      dataCompleteness: { level: 'medium', reason: 'One check-in was available.' }
    });
    const calls = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ response: structured, prompt_eval_count: 2, eval_count: 1 }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', calls);
    try {
      const first = upgradedDailyJob(runtime.queue, analysis, profile.id, profile.generationModel!);
      expect(
        upgradedDailyJob(runtime.queue, analysis, profile.id, profile.generationModel!).id
      ).toBe(first.id);
      const cancelled = runtime.queue.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: 'upgraded-cancel',
        payload: {}
      });
      runtime.worker.requestCancellation(cancelled.id);
      expect(runtime.read.get(cancelled.id)?.status).toBe('cancelled');
      await runtime.start();
      runtime.wake();
      await vi.waitFor(() => expect(runtime.queue.get(first.id)?.status).toBe('succeeded'));
      expect(runtime.read.get(first.id)).toMatchObject({
        status: 'succeeded',
        resultReference: expect.any(String)
      });
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM ai_memories WHERE job_id = ?').get(first.id)
      ).toEqual({ count: 1 });
      expect(
        database
          .prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?')
          .get(first.id)
      ).toEqual({ count: 1 });
      expect(
        database
          .prepare(
            'SELECT structured_schema_version AS schemaVersion, validation_status AS validationStatus, structured_result_json AS structured, content FROM ai_memories WHERE job_id = ?'
          )
          .get(first.id)
      ).toMatchObject({
        schemaVersion: 1,
        validationStatus: 'valid',
        content: 'Upgraded daily reflection.',
        structured: expect.stringContaining('"schemaVersion":1')
      });
      expect(calls).toHaveBeenCalledTimes(1);
      expect(
        JSON.stringify({
          jobs: database.prepare('SELECT * FROM ai_jobs').all(),
          memories: database.prepare('SELECT id, job_id FROM ai_memories').all(),
          diagnostics: database.prepare('SELECT code, message FROM ai_queue_diagnostics').all(),
          projections: [runtime.read.list(), runtime.read.get(first.id)]
        })
      ).not.toContain(fixtureSecret);
      expect(credentials.get(profile.id)).toBe(fixtureSecret);
      await runtime.stop();
      await vi.waitFor(() =>
        expect(runtime.worker.resources()).toEqual({
          polling: false,
          heartbeat: false,
          activeExecution: false
        })
      );
      database.close();
      const reopened = new Database(file);
      migrateDesktopDatabase(reopened);
      const queue = new AIJobQueue(reopened, 'owner');
      expect(queue.recover().reconciled).toBe(0);
      expect(
        reopened.prepare('SELECT COUNT(*) AS count FROM ai_memories WHERE job_id = ?').get(first.id)
      ).toEqual({ count: 1 });
      expect(
        reopened
          .prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?')
          .get(first.id)
      ).toEqual({ count: 1 });
      expect(calls).toHaveBeenCalledTimes(1);
      reopened.close();
    } finally {
      vi.unstubAllGlobals();
      // Native SQLite can retain a Windows file handle briefly after a WAL-backed
      // database closes; cleanup is best-effort and never affects the fixture.
      try {
        rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch {
        /* best effort */
      }
    }
  }, 15000);

  it('preserves migration 7 queue states through migrations 8 and 9', () => {
    const database = historical(7);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    database
      .prepare(
        `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, max_attempts, run_after, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'job',
        'owner',
        'daily_analysis',
        'unique',
        '{}',
        'retry_wait',
        2,
        3,
        '2026-02-01',
        9,
        '2026-01-01',
        '2026-01-01'
      );
    migrateDesktopDatabase(database);
    expect(
      database.prepare('SELECT status, attempts, priority FROM ai_jobs WHERE id = ?').get('job')
    ).toEqual({ status: 'retry_wait', attempts: 2, priority: 9 });
    expect(database.prepare('PRAGMA index_list(ai_memories)').all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ai_memories_owner_job_idx' })])
    );
    database.close();
  });

  it('preserves every migration 7 terminal and active job state', () => {
    const database = historical(7);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const insert = database.prepare(
      `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, max_attempts, run_after, priority, lease_owner, lease_token, lease_expires_at, cancellation_requested, requested_profile_id, requested_model_id, actual_profile_id, actual_model_id, last_error_code, last_error_message, started_at, finished_at, created_at, updated_at) VALUES (?, 'owner', 'daily_analysis', ?, '{}', ?, 1, 3, '2026-02-01', 9, 'worker', 'token', '2026-02-02', 0, 'profile', 'model', 'profile', 'model', 'VALIDATION', 'safe', '2026-01-01', NULL, '2026-01-01', '2026-01-01')`
    );
    for (const status of [
      'queued',
      'leased',
      'retry_wait',
      'succeeded',
      'failed',
      'cancelled',
      'dead_lettered'
    ])
      insert.run(`job-${status}`, `key-${status}`, status);
    migrateDesktopDatabase(database);
    expect(
      (
        database.prepare('SELECT status FROM ai_jobs ORDER BY id').all() as Array<{
          status: string;
        }>
      )
        .map((row) => row.status)
        .sort()
    ).toEqual([
      'cancelled',
      'dead_lettered',
      'failed',
      'leased',
      'queued',
      'retry_wait',
      'succeeded'
    ]);
    expect(
      database
        .prepare(
          'SELECT priority, lease_owner AS leaseOwner, requested_model_id AS model FROM ai_jobs WHERE id = ?'
        )
        .get('job-leased')
    ).toEqual({ priority: 9, leaseOwner: 'worker', model: 'model' });
    database.close();
  });

  it('upgrades the complete migration 7 queue-state matrix and keeps queue behavior valid', () => {
    const database = historical(7);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const insert = database.prepare(
      `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, lease_owner, lease_token, lease_acquired_at, lease_expires_at, cancellation_requested, requested_profile_id, requested_model_id, actual_profile_id, actual_model_id, privacy_mode, last_error_code, last_error_message, started_at, finished_at, created_at, updated_at) VALUES (?, 'owner', 'daily_analysis', ?, ?, ?, 1, ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', ?, ?, ?, ?, ?, 'profile', 'requested-model', 'actual-profile', 'actual-model', 'LOCAL', ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')`
    );
    const states = [
      ['queued', 0, 3, '2000-01-01T00:00:00.000Z', null, null, null, null, 0, null, null, null],
      [
        'leased',
        1,
        3,
        '2000-01-01T00:00:00.000Z',
        'worker-a',
        'PHASE2B_LIFECYCLE_SECRET_LEASE',
        '2000-01-01T00:00:00.000Z',
        '2000-01-02T00:00:00.000Z',
        0,
        null,
        null,
        '2026-01-01T01:00:00.000Z'
      ],
      [
        'retry_wait',
        2,
        4,
        '2099-01-01T00:00:00.000Z',
        null,
        null,
        null,
        null,
        0,
        'NETWORK_UNAVAILABLE',
        'normalized retry error',
        '2026-01-01T01:00:00.000Z'
      ],
      [
        'succeeded',
        1,
        3,
        '2000-01-01T00:00:00.000Z',
        null,
        null,
        null,
        null,
        0,
        null,
        null,
        '2026-01-01T01:00:00.000Z'
      ],
      [
        'failed',
        3,
        3,
        '2000-01-01T00:00:00.000Z',
        null,
        null,
        null,
        null,
        0,
        'VALIDATION',
        'normalized failure',
        '2026-01-01T01:00:00.000Z'
      ],
      [
        'cancelled',
        1,
        3,
        '2000-01-01T00:00:00.000Z',
        null,
        null,
        null,
        null,
        1,
        'CANCELLATION',
        'cancelled safely',
        '2026-01-01T01:00:00.000Z'
      ],
      [
        'dead_lettered',
        4,
        4,
        '2000-01-01T00:00:00.000Z',
        null,
        null,
        null,
        null,
        0,
        'PROVIDER_UNAVAILABLE',
        'retry budget exhausted',
        '2026-01-01T01:00:00.000Z'
      ]
    ] as const;
    for (const [
      status,
      attempts,
      maxAttempts,
      runAfter,
      owner,
      token,
      acquired,
      expires,
      cancellation,
      code,
      message,
      started
    ] of states)
      insert.run(
        `job-${status}`,
        `migration7-${status}`,
        JSON.stringify({ state: status }),
        status,
        50 + attempts,
        attempts,
        maxAttempts,
        runAfter,
        owner,
        token,
        acquired,
        expires,
        cancellation,
        code,
        message,
        started,
        status === 'queued' || status === 'retry_wait' || status === 'leased'
          ? null
          : '2026-01-01T02:00:00.000Z'
      );
    migrateDesktopDatabase(database);
    const rows = database
      .prepare(
        'SELECT id, status, priority, attempts, max_attempts AS maxAttempts, lease_owner AS leaseOwner, requested_model_id AS requestedModel, actual_model_id AS actualModel, cancellation_requested AS cancellationRequested, last_error_code AS code FROM ai_jobs ORDER BY id'
      )
      .all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.id === 'job-leased')).toMatchObject({
      status: 'leased',
      priority: 51,
      attempts: 1,
      maxAttempts: 3,
      leaseOwner: 'worker-a',
      requestedModel: 'requested-model',
      actualModel: 'actual-model'
    });
    expect(rows.find((row) => row.id === 'job-cancelled')).toMatchObject({
      status: 'cancelled',
      cancellationRequested: 1,
      code: 'CANCELLATION'
    });
    const queue = new AIJobQueue(database, 'owner');
    const read = new QueueReadService(database, 'owner');
    expect(read.list(20)).toHaveLength(7);
    expect(read.get('job-leased')).not.toHaveProperty('leaseToken');
    expect(
      queue.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: 'migration7-succeeded',
        payload: { changed: true }
      }).id
    ).toBe('job-succeeded');
    expect(queue.leaseNext('runtime-b', 10, new Date('2026-01-01T00:00:00.000Z'))?.id).toBe(
      'job-queued'
    );
    expect(queue.get('job-retry_wait')?.status).toBe('retry_wait');
    expect(queue.reclaimExpiredLeases(new Date('2026-01-03T00:00:00.000Z'))).toBeGreaterThan(0);
    expect(queue.get('job-cancelled')?.status).toBe('cancelled');
    database.close();
  });

  it('preserves migration 8 result linkage while adding recovery diagnostics', () => {
    const database = historical(8);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    database
      .prepare(
        `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, max_attempts, run_after, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'job8',
        'owner',
        'daily_analysis',
        'unique8',
        '{}',
        'succeeded',
        1,
        3,
        '2026-01-01',
        1,
        '2026-01-01',
        '2026-01-01'
      );
    database
      .prepare(
        `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, job_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'linked',
        'owner',
        'DAY',
        '2026-01-01',
        1,
        'ACTIVE',
        'complete',
        '1',
        '1',
        'job8',
        '2026-01-01'
      );
    migrateDesktopDatabase(database);
    expect(
      database.prepare('SELECT job_id AS jobId FROM ai_memories WHERE id = ?').get('linked')
    ).toEqual({ jobId: 'job8' });
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_queue_diagnostics'").get()
    ).toBeTruthy();
    database.close();
  });

  it('reconciles a migration 8 linked result without replaying a provider and preserves unlinked history and usage', () => {
    const database = historical(8);
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const job = database.prepare(
      `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, lease_owner, lease_token, lease_expires_at, cancellation_requested, created_at, updated_at) VALUES (?, 'owner', 'daily_analysis', ?, '{}', ?, 1, 10, 1, 3, ?, ?, ?, ?, ?, '2026-01-01', '2026-01-01')`
    );
    job.run(
      'linked-job',
      'linked-key',
      'leased',
      '2000-01-01',
      'lost-worker',
      'stale-token',
      '2000-01-02',
      0
    );
    job.run('plain-job', 'plain-key', 'queued', '2000-01-01', null, null, null, 0);
    job.run('retry-job', 'retry-key', 'retry_wait', '2099-01-01', null, null, null, 0);
    job.run(
      'expired-job',
      'expired-key',
      'leased',
      '2000-01-01',
      'lost-worker',
      'expired-token',
      '2000-01-02',
      0
    );
    job.run('cancelled-job', 'cancelled-key', 'cancelled', '2000-01-01', null, null, null, 1);
    job.run('failed-job', 'failed-key', 'failed', '2000-01-01', null, null, null, 0);
    const memory = database.prepare(
      `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, job_id, created_at) VALUES (?, 'owner', 'DAY', ?, 1, 'ACTIVE', ?, '1', '1', ?, '2026-01-01')`
    );
    memory.run('linked-memory', '2026-01-01', 'committed linked result', 'linked-job');
    memory.run('historical-memory', '2025-12-31', 'historical result', null);
    database
      .prepare(
        `INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, duration_ms, usage_reported, outcome, created_at) VALUES ('usage-linked', 'owner', 'linked-job', 'daily-analysis', 10, 0, 'SUCCESS', '2026-01-01')`
      )
      .run();
    migrateDesktopDatabase(database);
    const queue = new AIJobQueue(database, 'owner');
    const recovered = queue.recover(new Date('2026-01-03T00:00:00.000Z'));
    expect(recovered.reconciled).toBe(1);
    expect(queue.get('linked-job')).toMatchObject({
      status: 'succeeded',
      resultReference: 'linked-memory'
    });
    expect(queue.get('retry-job')?.status).toBe('retry_wait');
    expect(queue.get('expired-job')?.status).toBe('retry_wait');
    expect(queue.get('cancelled-job')?.status).toBe('cancelled');
    expect(
      database
        .prepare('SELECT job_id AS jobId FROM ai_memories WHERE id = ?')
        .get('historical-memory')
    ).toEqual({ jobId: null });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_memories WHERE job_id = ?')
        .get('linked-job')
    ).toEqual({ count: 1 });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?')
        .get('linked-job')
    ).toEqual({ count: 1 });
    let linkedProviderCalls = 0;
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async ({ job: activeJob }) => {
          if (activeJob.id === 'linked-job') linkedProviderCalls += 1;
          return { resultReference: 'unexpected' };
        }
      },
      { pollIntervalMs: 1_000 }
    );
    worker.start();
    expect(queue.get('linked-job')?.status).toBe('succeeded');
    expect(linkedProviderCalls).toBe(0);
    worker.stop();
    database.close();
  });

  it('preserves FTS records and schema objects from pre-AI and migration 6 fixtures', () => {
    for (const version of [5, 6]) {
      const database = historical(version);
      database
        .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run('owner', '2026-01-01', '2026-01-01');
      insertSearchableCheckIn(
        database,
        'owner',
        `fts-${version}`,
        `migration ${version} searchable focus record`
      );
      expect(
        searchCheckIns(database, 'owner', { query: 'searchable focus' }).map((row) => row.id)
      ).toContain(`fts-${version}`);
      const schema = database
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE name IN ('check_in_revisions_fts', 'check_in_revisions_fts_insert', 'check_in_revisions_fts_delete', 'check_in_revisions_fts_update', 'check_ins_owner_submitted_idx') ORDER BY name`
        )
        .all();
      migrateDesktopDatabase(database);
      expect(
        searchCheckIns(database, 'owner', { query: 'searchable focus' }).map((row) => row.id)
      ).toContain(`fts-${version}`);
      expect(
        database
          .prepare(
            `SELECT name, sql FROM sqlite_master WHERE name IN ('check_in_revisions_fts', 'check_in_revisions_fts_insert', 'check_in_revisions_fts_delete', 'check_in_revisions_fts_update', 'check_ins_owner_submitted_idx') ORDER BY name`
          )
          .all()
      ).toEqual(schema);
      database.close();
    }
  });

  it('reopens every historical starting version repeatedly without destructive migration or recovery diagnostics', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-migration-reopen-matrix-'));
    try {
      for (const version of [5, 6, 7, 8]) {
        const file = join(root, `migration-${version}.sqlite`);
        const source = historical(version);
        source
          .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
          .run('owner', '2026-01-01', '2026-01-01');
        insertSearchableCheckIn(source, 'owner', `history-${version}`, `stable history ${version}`);
        await source.backup(file);
        source.close();
        const first = new Database(file);
        migrateDesktopDatabase(first);
        const versions = migrationVersions(first);
        const objects = first
          .prepare(
            "SELECT type, name FROM sqlite_master WHERE name LIKE 'ai_%' ORDER BY type, name"
          )
          .all();
        first.close();
        const second = new Database(file);
        migrateDesktopDatabase(second);
        second.close();
        const third = new Database(file);
        migrateDesktopDatabase(third);
        expect(migrationVersions(third)).toEqual(versions);
        expect(
          third
            .prepare(
              "SELECT type, name FROM sqlite_master WHERE name LIKE 'ai_%' ORDER BY type, name"
            )
            .all()
        ).toEqual(objects);
        expect(third.prepare('SELECT COUNT(*) AS count FROM ai_queue_diagnostics').get()).toEqual({
          count: 0
        });
        expect(
          searchCheckIns(third, 'owner', { query: 'stable history' }).map((row) => row.id)
        ).toContain(`history-${version}`);
        expect(
          new AIJobQueue(third, 'owner').enqueue({
            kind: 'daily_analysis',
            idempotencyKey: `reopen-${version}`,
            payload: {}
          }).status
        ).toBe('queued');
        third.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);

  it('upgrades a file-backed pre-2D Phase 2C database through analysis hierarchy and scheduler migrations', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-2d-migration-gate-'));
    const file = join(root, 'phase2c-v14.sqlite');
    try {
      const source = historical(14);
      source
        .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run('owner', '2026-01-01', '2026-01-01');
      source
        .prepare(
          `INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'profile',
          'owner',
          'Local',
          'ollama',
          1,
          'qwen3:8b',
          0.2,
          1,
          100,
          30000,
          2,
          1,
          0,
          1,
          0,
          '2026-01-01',
          '2026-01-01'
        );
      source
        .prepare(
          `INSERT INTO ai_settings (owner_id, mode, max_context_tokens, max_output_tokens, data_sharing_preview, automatic_analysis, analyses_enabled, facts_enabled, graph_enabled, embeddings_enabled, playground_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('owner', 'LOCAL', 12000, 2048, 0, 1, 1, 0, 0, 0, 0, '2026-01-01');
      insertSearchableCheckIn(
        source,
        'owner',
        'phase2d-fts',
        'phase 2d migration gate searchable record'
      );
      source
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, requested_profile_id, requested_model_id, actual_profile_id, actual_model_id, privacy_mode, result_reference, created_at, updated_at, finished_at) VALUES ('job-structured', 'owner', 'daily_analysis', 'structured-key', '{}', 'succeeded', 1, 10, 1, 3, '2026-01-01', 'profile', 'qwen3:8b', 'profile', 'qwen3:8b', 'LOCAL', 'memory-structured', '2026-01-01', '2026-01-01', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, lease_owner, lease_token, lease_expires_at, requested_profile_id, requested_model_id, privacy_mode, created_at, updated_at) VALUES ('job-leased', 'owner', 'daily_analysis', 'leased-key', '{}', 'leased', 1, 20, 1, 3, '2026-01-01', 'old-worker', 'PHASE2D_GATE_SECRET_LEASE', '2000-01-01', 'profile', 'qwen3:8b', 'LOCAL', '2026-01-01', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, provider_profile_id, source_revision_watermark, job_id, created_at, structured_result_json, structured_schema_version, validation_status) VALUES (?, 'owner', 'DAY', ?, 1, 'ACTIVE', ?, '1', '1.0.0', 'profile', ?, ?, '2026-01-01', ?, ?, ?)`
        )
        .run(
          'memory-freeform',
          '2026-07-20',
          'Historical free-form daily result.',
          'hash-freeform',
          null,
          null,
          null,
          'legacy'
        );
      source
        .prepare(
          `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, provider_profile_id, source_revision_watermark, job_id, created_at, structured_result_json, structured_schema_version, validation_status) VALUES (?, 'owner', 'DAY', ?, 1, 'ACTIVE', ?, '1', '1.0.0', 'profile', ?, ?, '2026-01-02', ?, ?, ?)`
        )
        .run(
          'memory-structured',
          '2026-07-21',
          'Historical structured daily result.',
          'hash-structured',
          'job-structured',
          JSON.stringify({
            schemaVersion: 1,
            periodId: '2026-07-21',
            summary: 'Historical structured daily result.'
          }),
          1,
          'valid'
        );
      source
        .prepare(
          `INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, provider_profile_id, model_id, prompt_version, duration_ms, input_tokens, output_tokens, total_tokens, usage_reported, estimated_cost_usd, pricing_version, retry_index, outcome, created_at) VALUES ('usage-structured', 'owner', 'job-structured', 'daily-analysis', 'profile', 'qwen3:8b', '1.0.0', 10, 2, 3, 5, 1, 0.000005, 'fixture-pricing-v1', 0, 'SUCCESS', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_provider_attempts (id, owner_id, job_id, sequence, queue_attempt, provider_profile_id, provider_type, model_id, operation_type, required_capabilities_json, started_at, finished_at, duration_ms, outcome, input_tokens, output_tokens, estimated_cost_micros, reserved_cost_micros, settled_cost_micros, provider_started_at, created_at, updated_at) VALUES ('attempt-structured', 'owner', 'job-structured', 1, 1, 'profile', 'ollama', 'qwen3:8b', 'analysis', '[]', '2026-01-01', '2026-01-01', 10, 'success', 2, 3, 5, 10, 5, '2026-01-01', '2026-01-01', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_budget_reservations (id, owner_id, job_id, provider_attempt_id, planned_attempt_key, provider_profile_id, period_key, reserved_micros, settled_micros, status, expires_at, settlement_source, pricing_version, pricing_snapshot_json, created_at, updated_at) VALUES ('reservation-structured', 'owner', 'job-structured', 'attempt-structured', 'attempt-1', 'profile', '2026-07', 10, 5, 'settled', '2026-02-01', 'provider_usage', 'fixture-pricing-v1', '{"safe":true}', '2026-01-01', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_queue_diagnostics (id, owner_id, job_id, code, message, created_at) VALUES ('queue-diag', 'owner', 'job-leased', 'LEASE_RECOVERY', 'safe diagnostic without secrets', '2026-01-01')`
        )
        .run();
      source
        .prepare(
          `INSERT INTO ai_budget_recovery_diagnostics (id, owner_id, reservation_id, job_id, category, prior_state, resulting_state, reason, created_at) VALUES ('budget-diag', 'owner', 'reservation-structured', 'job-structured', 'settlement', 'reserved', 'settled', 'safe recovery reason', '2026-01-01')`
        )
        .run();
      expect(
        searchCheckIns(source, 'owner', { query: 'searchable record' }).map((row) => row.id)
      ).toContain('phase2d-fts');
      await source.backup(file);
      source.close();

      const first = new Database(file);
      migrateDesktopDatabase(first);
      expect(
        first
          .prepare(
            "SELECT name FROM sqlite_master WHERE name IN ('ai_analysis_results', 'ai_analysis_child_sources', 'ai_analysis_log_sources', 'ai_analysis_schedules') ORDER BY name"
          )
          .all()
      ).toHaveLength(4);
      expect(first.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({
        count: 2
      });
      expect(
        first
          .prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?')
          .get('job-structured')
      ).toEqual({ count: 1 });
      expect(
        first
          .prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations WHERE job_id = ?')
          .get('job-structured')
      ).toEqual({ count: 1 });
      expect(
        searchCheckIns(first, 'owner', { query: 'phase 2d migration' }).map((row) => row.id)
      ).toContain('phase2d-fts');
      const ai = new AIService(
        first,
        'owner',
        new DesktopCredentialStore(join(root, 'credentials'), {
          isAvailable: () => true,
          protect: (value) => Buffer.from(value),
          unprotect: (value) => value.toString()
        })
      );
      const analysis = new AnalysisService(first, 'owner', ai);
      const queue = new AIJobQueue(first, 'owner');
      const scheduler = new AnalysisSchedulerService(
        first,
        'owner',
        ai,
        analysis,
        undefined,
        queue
      );
      const saved = scheduler.save({
        level: 'weekly',
        enabled: true,
        localTime: '03:00',
        timezone: 'Europe/Warsaw',
        providerProfileId: 'profile',
        privacyMode: 'LOCAL',
        maxCostMicros: '12345',
        catchUpLimit: 2
      });
      expect(saved).toMatchObject({
        level: 'weekly',
        timezone: 'Europe/Warsaw',
        maxCostMicros: '12345',
        catchUpLimit: 2
      });
      const read = new AnalysisReadService(first, 'owner');
      expect(read.list('daily', 10).map((item) => item.id)).toEqual(
        expect.arrayContaining(['memory-freeform', 'memory-structured'])
      );
      expect(
        JSON.stringify({
          jobs: new QueueReadService(first, 'owner').list(10),
          daily: read.list('daily', 10),
          scheduler: read.schedulerStatus()
        })
      ).not.toContain('PHASE2D_GATE_SECRET_LEASE');
      const versions = migrationVersions(first);
      const aiObjects = first
        .prepare(
          "SELECT type, name, sql FROM sqlite_master WHERE name LIKE 'ai_%' ORDER BY type, name"
        )
        .all();
      first.close();

      const second = new Database(file);
      migrateDesktopDatabase(second);
      second.close();
      const third = new Database(file);
      migrateDesktopDatabase(third);
      expect(migrationVersions(third)).toEqual(versions);
      expect(
        third
          .prepare(
            "SELECT type, name, sql FROM sqlite_master WHERE name LIKE 'ai_%' ORDER BY type, name"
          )
          .all()
      ).toEqual(aiObjects);
      expect(
        third
          .prepare('SELECT COUNT(*) AS count FROM ai_analysis_schedules WHERE owner_id = ?')
          .get('owner')
      ).toEqual({ count: 1 });
      expect(third.prepare('SELECT COUNT(*) AS count FROM ai_queue_diagnostics').get()).toEqual({
        count: 1
      });
      expect(
        third.prepare('SELECT COUNT(*) AS count FROM ai_budget_recovery_diagnostics').get()
      ).toEqual({ count: 1 });
      expect(
        searchCheckIns(third, 'owner', { query: 'searchable record' }).map((row) => row.id)
      ).toContain('phase2d-fts');
      third.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rolls back controlled failures in migrations 7, 8, and 9 and retries safely', () => {
    for (const target of [7, 8, 9]) {
      const database = historical(target - 1);
      database
        .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run('owner', '2026-01-01', '2026-01-01');
      insertSearchableCheckIn(
        database,
        'owner',
        `failure-${target}`,
        `readable before failure ${target}`
      );
      expect(() =>
        migrateDesktopDatabase(database, {
          beforeMigration: (migration) => {
            if (migration.version === target)
              throw new Error(`controlled migration ${target} failure`);
          }
        })
      ).toThrow(`controlled migration ${target} failure`);
      expect(migrationVersions(database)).not.toContain(target);
      expect(
        searchCheckIns(database, 'owner', { query: 'readable before failure' }).map((row) => row.id)
      ).toContain(`failure-${target}`);
      migrateDesktopDatabase(database);
      expect(migrationVersions(database)).toContain(target);
      expect(() => migrateDesktopDatabase(database)).not.toThrow();
      database.close();
    }
  });

  it('reopens an upgraded persistent database without rerunning migrations', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-migration-reopen-'));
    const file = join(root, 'fixture.sqlite');
    const first = historical(6);
    await first.backup(file);
    first.close();
    const database = new Database(file);
    migrateDesktopDatabase(database);
    const versions = database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as {
      count: number;
    };
    database.close();
    const reopened = new Database(file);
    migrateDesktopDatabase(reopened);
    expect(reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual(
      versions
    );
    reopened.close();
    rmSync(root, { recursive: true, force: true });
  });
});
