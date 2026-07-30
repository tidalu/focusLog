import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { AnalysisService } from './analysis-service.js';
import { HierarchicalAnalysisService } from './hierarchical-analysis-service.js';
import { createAIQueueRuntime } from './queue-runtime.js';
import { AIJobQueue } from './job-queue.js';
import { analysisPeriod } from './analysis-periods.js';
import type { AnalysisLevel } from './analysis-contracts.js';

const directories: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function analysisJson(level: AnalysisLevel, periodId: string, summary: string, evidenceId: string) {
  return JSON.stringify({
    schemaVersion: 1,
    level,
    periodId,
    result: {
      summary,
      patterns: [{ title: 'Pattern', detail: 'Consistent progress.', evidenceIds: [evidenceId] }],
      changes: [],
      difficulties: [],
      projects: [],
      habits: [],
      distractions: [],
      reflectionQuestions: [],
      nextSteps: [],
      confidence: 'medium',
      completeness: 'medium'
    }
  });
}

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01', '2026-01-01');
  const root = mkdtempSync(join(tmpdir(), 'focuslog-hierarchy-'));
  directories.push(root);
  const ai = new AIService(
    database,
    'owner',
    new DesktopCredentialStore(root, {
      isAvailable: () => true,
      protect: (text) => Buffer.from(text),
      unprotect: (ciphertext) => ciphertext.toString()
    })
  );
  const profile = ai.saveProfile({
    name: 'Ollama',
    providerId: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    generationModel: 'qwen3:8b',
    enabled: true
  });
  ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
  const daily = new AnalysisService(database, 'owner', ai);
  const hierarchy = new HierarchicalAnalysisService(database, 'owner', ai);
  const queue = new AIJobQueue(database, 'owner');
  return { database, ai, profile, daily, hierarchy, queue };
}

function addCheckIn(
  database: ReturnType<typeof openDesktopDatabase>,
  day: string,
  text = 'Focused planning block.'
) {
  const id = `check-${day}`;
  const revision = `rev-${day}`;
  if (database.prepare('SELECT 1 FROM check_ins WHERE id = ?').get(id)) return;
  const at = `${day}T10:00:00.000Z`;
  database
    .prepare(
      `INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at)
       VALUES (?, 'owner', ?, ?, 'UTC', 'v1', ?, ?)`
    )
    .run(id, revision, at, at, at);
  database
    .prepare(
      'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(revision, id, text, `op-${revision}`, at);
}

function seedDaily(database: ReturnType<typeof openDesktopDatabase>, day: string, version = 1) {
  addCheckIn(database, day);
  const id = `daily-${day}-v${version}`;
  database
    .prepare(
      `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version,
        provider_profile_id, source_revision_watermark, created_at, structured_result_json, structured_schema_version, validation_status)
       VALUES (?, 'owner', 'DAY', ?, ?, 'ACTIVE', ?, '1', '1.0.0', 'profile', ?, ?, ?, 1, 'valid')`
    )
    .run(
      id,
      day,
      version,
      `Daily summary ${day} v${version}`,
      `hash-${id}`,
      `${day}T12:00:00.000Z`,
      '{}'
    );
  return id;
}

function seedAnalysis(
  database: ReturnType<typeof openDesktopDatabase>,
  level: Exclude<AnalysisLevel, 'daily'>,
  localAnchor: string,
  childIds: string[] = [],
  sourceLevel: AnalysisLevel = 'daily'
) {
  const period = analysisPeriod(level, localAnchor, 'UTC');
  const id = `${level}-${period.periodId}-v1`;
  database
    .prepare(
      `INSERT INTO ai_analysis_results (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc,
        period_end_utc, boundary_policy_version, version, status, source_revision_hash, statistics_json, structured_result_json,
        readable_summary, prompt_id, prompt_version, schema_version, generation_metadata_json, provider_profile_id, provider_id,
        model_id, fallback_used, created_at, updated_at)
       VALUES (?, 'owner', ?, ?, 'UTC', ?, ?, ?, ?, ?, 1, 'current', ?, '{}', ?, ?, ?, '1.0.0', '1', '{}', 'profile', 'ollama', 'qwen3:8b', 0, ?, ?)`
    )
    .run(
      id,
      level,
      period.periodId,
      period.localStart,
      period.localEnd,
      period.periodStartUtc,
      period.periodEndUtc,
      period.boundaryPolicyVersion,
      `source-${id}`,
      analysisJson(level, period.periodId, `${level} summary`, childIds[0] ?? id),
      `${level} summary`,
      level,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    );
  const childInsert = database.prepare(
    `INSERT INTO ai_analysis_child_sources (analysis_result_id, owner_id, child_result_id, child_level, child_period_id, child_version, child_source_kind)
     VALUES (?, 'owner', ?, ?, ?, 1, ?)`
  );
  for (const child of childIds)
    childInsert.run(
      id,
      child,
      sourceLevel,
      child.replace(`${sourceLevel}-`, '').replace('-v1', ''),
      sourceLevel === 'daily' ? 'ai_memories' : 'ai_analysis_results'
    );
  return id;
}

async function waitForStatus(queue: AIJobQueue, jobId: string, status: string): Promise<void> {
  await vi.waitFor(() => expect(queue.get(jobId)?.status).toBe(status), { timeout: 2_000 });
}

describe('hierarchical analysis handlers', () => {
  it('migration creates shared version and dependency tables', () => {
    const { database } = fixture();
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_analysis_results'"
        )
        .get()
    ).toEqual({ name: 'ai_analysis_results' });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'ai_analysis_results_current_idx'"
        )
        .get()
    ).toEqual({ name: 'ai_analysis_results_current_idx' });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_analysis_child_sources'"
        )
        .get()
    ).toEqual({ name: 'ai_analysis_child_sources' });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_analysis_log_sources'"
        )
        .get()
    ).toEqual({ name: 'ai_analysis_log_sources' });
    database.close();
  });

  it('weekly uses exact daily summaries and persists dependency provenance', async () => {
    const { database, ai, profile, daily, hierarchy, queue } = fixture();
    const dailyIds = [
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26'
    ].map((day) => seedDaily(database, day));
    let prompt = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, init) => {
        prompt = JSON.parse(String(init?.body)).prompt;
        return new Response(
          JSON.stringify({
            response: analysisJson('weekly', '2026-W30', 'Weekly reflection.', dailyIds[0]!),
            prompt_eval_count: 9,
            eval_count: 4
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      })
    );
    const job = hierarchy.enqueue(queue, {
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      requestedModelId: profile.generationModel!,
      privacyMode: 'LOCAL'
    });
    const runtime = createAIQueueRuntime(
      database,
      'owner',
      daily,
      {
        pollIntervalMs: 20,
        leaseDurationMs: 100,
        leaseRenewalMs: 20,
        workerId: 'hierarchy-weekly'
      },
      ai
    );
    await runtime.start();
    runtime.wake();
    await waitForStatus(queue, job.id, 'succeeded');
    await runtime.stop();
    const result = database
      .prepare(
        'SELECT id, readable_summary AS summary, job_id AS jobId FROM ai_analysis_results WHERE level = ?'
      )
      .get('weekly') as { id: string; summary: string; jobId: string };
    expect(result).toEqual(
      expect.objectContaining({ summary: 'Weekly reflection.', jobId: job.id })
    );
    expect(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM ai_analysis_child_sources WHERE analysis_result_id = ?'
        )
        .get(result.id)
    ).toEqual({ count: 7 });
    expect(prompt).toContain('<trusted_child_summaries>');
    expect(prompt).toContain(dailyIds[0]!);
    database.close();
  });

  it('monthly, quarterly, and yearly use only the immediate child level', async () => {
    const { database, hierarchy } = fixture();
    const week = seedAnalysis(database, 'weekly', '2026-07-06');
    const month = seedAnalysis(database, 'monthly', '2026-07-01', [week], 'weekly');
    const quarter = seedAnalysis(database, 'quarterly', '2026-07-01', [month], 'monthly');
    const year = seedAnalysis(database, 'yearly', '2026-01-01', [quarter], 'quarterly');
    hierarchy.sourceRevisionHash('monthly', '2026-07-01', 'UTC');
    expect(
      database
        .prepare(
          'SELECT child_level AS childLevel FROM ai_analysis_child_sources WHERE analysis_result_id = ?'
        )
        .get(month)
    ).toEqual({ childLevel: 'weekly' });
    expect(
      database
        .prepare(
          'SELECT child_level AS childLevel FROM ai_analysis_child_sources WHERE analysis_result_id = ?'
        )
        .get(quarter)
    ).toEqual({ childLevel: 'monthly' });
    expect(
      database
        .prepare(
          'SELECT child_level AS childLevel FROM ai_analysis_child_sources WHERE analysis_result_id = ?'
        )
        .get(year)
    ).toEqual({ childLevel: 'quarterly' });
    database.close();
  });

  it('missing dependency enqueues the oldest child and prevents parent publication', async () => {
    const { database, ai, profile, daily, hierarchy, queue } = fixture();
    ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'].forEach(
      (day) => seedDaily(database, day)
    );
    const job = hierarchy.enqueue(queue, {
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      requestedModelId: profile.generationModel!,
      privacyMode: 'LOCAL'
    });
    const runtime = createAIQueueRuntime(
      database,
      'owner',
      daily,
      {
        pollIntervalMs: 20,
        leaseDurationMs: 100,
        leaseRenewalMs: 20,
        workerId: 'hierarchy-missing'
      },
      ai
    );
    await runtime.start();
    runtime.wake();
    await waitForStatus(queue, job.id, 'retry_wait');
    await runtime.stop();
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM ai_jobs WHERE kind = 'daily_analysis'").get()
    ).toEqual({ count: 1 });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_analysis_results WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    database.close();
  });

  it('regeneration supersedes the prior current version and stale propagation is exact', () => {
    const { database, hierarchy } = fixture();
    const oldDaily = seedDaily(database, '2026-07-20');
    const related = seedAnalysis(database, 'weekly', '2026-07-20', [oldDaily]);
    const unrelatedDaily = seedDaily(database, '2026-08-03');
    const unrelated = seedAnalysis(database, 'weekly', '2026-08-03', [unrelatedDaily]);
    expect(hierarchy.markDependentsStale([oldDaily], 'Daily changed.')).toBe(1);
    expect(
      database.prepare('SELECT status FROM ai_analysis_results WHERE id = ?').get(related)
    ).toEqual({ status: 'stale' });
    expect(
      database.prepare('SELECT status FROM ai_analysis_results WHERE id = ?').get(unrelated)
    ).toEqual({ status: 'current' });
    database.close();
  });

  it('dependency change during execution prevents current publication', async () => {
    const { database, ai, profile, daily, hierarchy, queue } = fixture();
    const dailyIds = [
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26'
    ].map((day) => seedDaily(database, day));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        database
          .prepare("UPDATE ai_memories SET status = 'SUPERSEDED' WHERE id = ?")
          .run(dailyIds[0]);
        seedDaily(database, '2026-07-20', 2);
        return new Response(
          JSON.stringify({
            response: analysisJson('weekly', '2026-W30', 'Stale provider result.', dailyIds[0]!)
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      })
    );
    const job = hierarchy.enqueue(queue, {
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      requestedModelId: profile.generationModel!,
      privacyMode: 'LOCAL'
    });
    const runtime = createAIQueueRuntime(
      database,
      'owner',
      daily,
      { pollIntervalMs: 20, leaseDurationMs: 100, leaseRenewalMs: 20, workerId: 'hierarchy-race' },
      ai
    );
    await runtime.start();
    runtime.wake();
    await waitForStatus(queue, job.id, 'retry_wait');
    await runtime.stop();
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_analysis_results WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    database.close();
  });

  it('invalid evidence references never persist', async () => {
    const { database, ai, profile, daily, hierarchy, queue } = fixture();
    [
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26'
    ].forEach((day) => seedDaily(database, day));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            response: analysisJson('weekly', '2026-W30', 'Invalid.', 'not-available')
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const job = hierarchy.enqueue(queue, {
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      requestedModelId: profile.generationModel!,
      privacyMode: 'LOCAL'
    });
    const runtime = createAIQueueRuntime(
      database,
      'owner',
      daily,
      {
        pollIntervalMs: 20,
        leaseDurationMs: 100,
        leaseRenewalMs: 20,
        workerId: 'hierarchy-invalid'
      },
      ai
    );
    await runtime.start();
    runtime.wake();
    await waitForStatus(queue, job.id, 'failed');
    await runtime.stop();
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_analysis_results WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    database.close();
  });

  it('crash after result persistence before acknowledgement reconciles without duplicate cost or usage', async () => {
    const { database, ai, profile, daily, hierarchy, queue } = fixture();
    const dailyIds = [
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26'
    ].map((day) => seedDaily(database, day));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            response: analysisJson('weekly', '2026-W30', 'Recovered weekly.', dailyIds[0]!)
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const job = hierarchy.enqueue(queue, {
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      requestedModelId: profile.generationModel!,
      privacyMode: 'LOCAL'
    });
    const runtimeA = createAIQueueRuntime(
      database,
      'owner',
      daily,
      {
        pollIntervalMs: 20,
        leaseDurationMs: 100,
        leaseRenewalMs: 20,
        workerId: 'hierarchy-crash-a',
        hierarchicalAnalysis: { fault: 'after_persistence_before_acknowledgement' }
      },
      ai
    );
    await runtimeA.start();
    runtimeA.wake();
    await vi.waitFor(
      () =>
        expect(
          database
            .prepare('SELECT COUNT(*) AS count FROM ai_analysis_results WHERE job_id = ?')
            .get(job.id)
        ).toEqual({ count: 1 }),
      { timeout: 2_000 }
    );
    runtimeA.abandonForProcessLoss();
    const runtimeB = createAIQueueRuntime(
      database,
      'owner',
      daily,
      {
        pollIntervalMs: 20,
        leaseDurationMs: 100,
        leaseRenewalMs: 20,
        workerId: 'hierarchy-crash-b'
      },
      ai
    );
    await runtimeB.start();
    runtimeB.wake();
    await waitForStatus(queue, job.id, 'succeeded');
    await runtimeB.stop();
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_analysis_results WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 1 });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 1 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    database.close();
  });
});
