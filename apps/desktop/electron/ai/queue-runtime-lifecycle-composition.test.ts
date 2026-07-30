import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AIService } from './ai-service.js';
import { AnalysisService } from './analysis-service.js';
import { DesktopCredentialStore } from './credentials.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds
} from './daily-analysis-job.js';
import { AIJobQueue } from './job-queue.js';
import { loadBuiltinPrompt } from './prompts.js';
import { createAIQueueRuntime } from './queue-runtime.js';
import { openDesktopDatabase } from '../database/database.js';

const roots: string[] = [];
function dailyResult(summary: string) {
  return JSON.stringify({
    schemaVersion: 1,
    periodId: '2026-07-21',
    summary,
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
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function setup(filename = ':memory:', retryLimit = 2) {
  const database =
    filename === ':memory:'
      ? openDesktopDatabase(filename)
      : openDesktopDatabase(filename, Buffer.alloc(32, 9));
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-07-21T00:00:00.000Z', '2026-07-21T00:00:00.000Z');
  const credentialsRoot = mkdtempSync(join(tmpdir(), 'focuslog-lifecycle-creds-'));
  roots.push(credentialsRoot);
  const credentials = new DesktopCredentialStore(credentialsRoot, {
    isAvailable: () => true,
    protect: (value) => Buffer.from(value),
    unprotect: (value) => value.toString()
  });
  const ai = new AIService(database, 'owner', credentials);
  const profile = ai.saveProfile({
    name: 'Ollama',
    providerId: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    generationModel: 'qwen3:8b',
    enabled: true,
    retryLimit
  });
  ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
  database
    .prepare(
      `INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('check-in', 'owner', 'revision', '2026-07-21T10:00:00.000Z', 'UTC', 'v1', '2026-07-21T10:00:00.000Z', '2026-07-21T10:00:00.000Z')`
    )
    .run();
  database
    .prepare(
      `INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('revision', 'check-in', 'A focused day.', 'operation', '2026-07-21T10:00:00.000Z')`
    )
    .run();
  return { database, ai, profile, analysis: new AnalysisService(database, 'owner', ai) };
}

function enqueueDaily(
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
    privacyMode: 'LOCAL',
    fallbackSnapshot: {
      schemaVersion: 1,
      entries: [
        {
          providerProfileId: profileId,
          providerType: 'ollama',
          model,
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ]
    }
  });
}

describe('production queue runtime lifecycle composition', () => {
  it('persists cancellation before startup without provider, attempt, or reservation side effects', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-runtime-cancel-before-start-'));
    roots.push(root);
    const current = setup(join(root, 'runtime.sqlite'));
    const calls = vi.fn();
    vi.stubGlobal('fetch', calls);
    const runtime = createAIQueueRuntime(current.database, 'owner', current.analysis, {
      workerId: 'cancel-before-start',
      pollIntervalMs: 1_000
    });
    const job = enqueueDaily(
      runtime.queue,
      current.analysis,
      current.profile.id,
      current.profile.generationModel!
    );
    expect(runtime.queue.requestCancellation(job.id)?.status).toBe('cancelled');
    await runtime.start();
    runtime.wake();
    expect(runtime.queue.get(job.id)?.status).toBe('cancelled');
    expect(calls).not.toHaveBeenCalled();
    expect(
      current.database
        .prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    expect(
      current.database
        .prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    await runtime.stop();
    expect(runtime.worker.resources()).toEqual({
      polling: false,
      heartbeat: false,
      activeExecution: false
    });
    current.database.close();
  }, 10_000);

  it('cancels a real daily handler after reservation and before provider invocation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-runtime-cancel-after-reservation-'));
    roots.push(root);
    const current = setup(join(root, 'runtime.sqlite'));
    const reserved = deferred<void>();
    const proceed = deferred<void>();
    const calls = vi.fn();
    vi.stubGlobal('fetch', calls);
    const runtime = createAIQueueRuntime(current.database, 'owner', current.analysis, {
      workerId: 'cancel-after-reservation',
      pollIntervalMs: 1_000,
      dailyAnalysis: {
        coordinatorHooks: {
          afterReservation: async () => {
            reserved.resolve();
            await proceed.promise;
          }
        }
      }
    });
    const job = enqueueDaily(
      runtime.queue,
      current.analysis,
      current.profile.id,
      current.profile.generationModel!
    );
    await runtime.start();
    runtime.wake();
    await reserved.promise;
    expect(runtime.requestCancellation(job.id)?.cancellationRequested).toBe(true);
    proceed.resolve();
    await vi.waitFor(() => expect(runtime.queue.get(job.id)?.status).toBe('cancelled'));
    expect(calls).not.toHaveBeenCalled();
    expect(
      current.database
        .prepare(
          'SELECT status, reserved_micros AS reserved FROM ai_budget_reservations WHERE job_id = ?'
        )
        .all(job.id)
    ).toEqual([{ status: 'released', reserved: 0 }]);
    expect(
      current.database
        .prepare('SELECT outcome, error_code AS code FROM ai_provider_attempts WHERE job_id = ?')
        .all(job.id)
    ).toEqual([{ outcome: 'failed', code: 'CANCELLATION' }]);
    expect(
      current.database
        .prepare('SELECT COUNT(*) AS count FROM ai_memories WHERE job_id = ?')
        .get(job.id)
    ).toEqual({ count: 0 });
    await runtime.stop();
    expect(runtime.worker.resources()).toEqual({
      polling: false,
      heartbeat: false,
      activeExecution: false
    });
    current.database.close();
  });

  it('continues a file-backed retry after process loss with monotonic attempts and an unchanged snapshot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-runtime-restart-retry-'));
    roots.push(root);
    const filename = join(root, 'runtime.sqlite');
    const first = setup(filename, 0);
    const calls = vi.fn().mockImplementation(() => {
      if (calls.mock.calls.length === 1) return Promise.reject(new TypeError('offline'));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: dailyResult('Recovered once.'),
            prompt_eval_count: 3,
            eval_count: 2
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', calls);
    const runtimeA = createAIQueueRuntime(first.database, 'owner', first.analysis, {
      workerId: 'runtime-a',
      pollIntervalMs: 1_000,
      leaseDurationMs: 10_000
    });
    const job = enqueueDaily(
      runtimeA.queue,
      first.analysis,
      first.profile.id,
      first.profile.generationModel!
    );
    const snapshot = first.database
      .prepare('SELECT snapshot_json AS snapshot FROM ai_job_fallback_snapshots WHERE job_id = ?')
      .get(job.id);
    await runtimeA.start();
    runtimeA.wake();
    await vi.waitFor(() => expect(runtimeA.queue.get(job.id)?.status).toBe('retry_wait'));
    expect(
      first.database
        .prepare(
          'SELECT sequence, queue_attempt, fallback_position, outcome FROM ai_provider_attempts WHERE job_id = ?'
        )
        .all(job.id)
    ).toEqual([{ sequence: 1, queue_attempt: 1, fallback_position: 0, outcome: 'failed' }]);
    runtimeA.abandonForProcessLoss();
    first.database.close();

    const second = openDesktopDatabase(filename, Buffer.alloc(32, 9));
    second
      .prepare('UPDATE ai_jobs SET run_after = ? WHERE id = ?')
      .run(new Date(Date.now() - 1).toISOString(), job.id);
    const aiB = new AIService(
      second,
      'owner',
      new DesktopCredentialStore(join(root, 'credentials-b'), {
        isAvailable: () => true,
        protect: (value) => Buffer.from(value),
        unprotect: (value) => value.toString()
      })
    );
    const runtimeB = createAIQueueRuntime(
      second,
      'owner',
      new AnalysisService(second, 'owner', aiB),
      { workerId: 'runtime-b', pollIntervalMs: 1_000, leaseDurationMs: 10_000 }
    );
    await runtimeB.start();
    runtimeB.wake();
    await vi.waitFor(() => expect(runtimeB.queue.get(job.id)?.status).toBe('succeeded'));
    expect(calls).toHaveBeenCalledTimes(2);
    expect(
      second
        .prepare(
          'SELECT sequence, queue_attempt, fallback_position, operation_type, outcome FROM ai_provider_attempts WHERE job_id = ? ORDER BY sequence'
        )
        .all(job.id)
    ).toEqual([
      {
        sequence: 1,
        queue_attempt: 1,
        fallback_position: 0,
        operation_type: 'generation',
        outcome: 'failed'
      },
      {
        sequence: 2,
        queue_attempt: 2,
        fallback_position: 0,
        operation_type: 'generation',
        outcome: 'succeeded'
      }
    ]);
    expect(
      second
        .prepare('SELECT snapshot_json AS snapshot FROM ai_job_fallback_snapshots WHERE job_id = ?')
        .get(job.id)
    ).toEqual(snapshot);
    expect(
      second.prepare('SELECT COUNT(*) AS count FROM ai_memories WHERE job_id = ?').get(job.id)
    ).toEqual({ count: 1 });
    expect(
      second.prepare('SELECT COUNT(*) AS count FROM ai_usage_records WHERE job_id = ?').get(job.id)
    ).toEqual({ count: 1 });
    expect(
      second
        .prepare(
          "SELECT COUNT(*) AS count FROM ai_budget_reservations WHERE job_id = ? AND status = 'reserved'"
        )
        .get(job.id)
    ).toEqual({ count: 0 });
    await runtimeB.stop();
    expect(runtimeB.worker.resources()).toEqual({
      polling: false,
      heartbeat: false,
      activeExecution: false
    });
    second.close();
  }, 15_000);

  it('crash after persistence reconciles without provider replay and rejects stale acknowledgement', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-runtime-crash-'));
    roots.push(root);
    const filename = join(root, 'runtime.sqlite');
    const first = setup(filename);
    const calls = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: dailyResult('Committed once.'),
          prompt_eval_count: 4,
          eval_count: 2
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', calls);
    const runtimeA = createAIQueueRuntime(first.database, 'owner', first.analysis, {
      workerId: 'runtime-a',
      pollIntervalMs: 1_000,
      leaseDurationMs: 10_000,
      leaseRenewalMs: 20,
      dailyAnalysis: { fault: 'after_persistence_before_acknowledgement' }
    });
    const job = enqueueDaily(
      runtimeA.queue,
      first.analysis,
      first.profile.id,
      first.profile.generationModel!
    );
    await runtimeA.start();
    runtimeA.wake();
    await vi.waitFor(() =>
      expect(first.database.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({
        count: 1
      })
    );
    const staleLease = runtimeA.queue.get(job.id)!;
    expect(staleLease.status).toBe('leased');
    expect(staleLease.leaseToken).toBeTruthy();
    runtimeA.abandonForProcessLoss();
    await Promise.resolve();
    first.database.close();

    const second = openDesktopDatabase(filename, Buffer.alloc(32, 9));
    const aiB = new AIService(
      second,
      'owner',
      new DesktopCredentialStore(join(root, 'credentials-b'), {
        isAvailable: () => true,
        protect: (value) => Buffer.from(value),
        unprotect: (value) => value.toString()
      })
    );
    const runtimeB = createAIQueueRuntime(
      second,
      'owner',
      new AnalysisService(second, 'owner', aiB),
      { workerId: 'runtime-b', pollIntervalMs: 1_000 }
    );
    await runtimeB.start();
    await vi.waitFor(() => expect(runtimeB.queue.get(job.id)?.status).toBe('succeeded'));
    expect(calls).toHaveBeenCalledTimes(1);
    expect(second.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({ count: 1 });
    expect(second.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 1
    });
    expect(second.prepare('SELECT job_id AS jobId FROM ai_memories').get()).toEqual({
      jobId: job.id
    });
    expect(runtimeB.queue.complete(job.id, 'runtime-a', staleLease.leaseToken!, 'stale')).toBe(
      false
    );
    expect(runtimeB.queue.get(job.id)?.status).toBe('succeeded');
    expect(second.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 1
    });
    await runtimeB.stop();
    second.close();
  }, 15_000);

  it('late provider cannot persist after bounded shutdown and leaves a recoverable lease', async () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-runtime-late-'));
    roots.push(root);
    const filename = join(root, 'runtime.sqlite');
    const current = setup(filename);
    const providerStarted = deferred<void>();
    const cancellation = deferred<void>();
    const lateResponse = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => cancellation.resolve(), { once: true });
        providerStarted.resolve();
        return lateResponse.promise;
      })
    );
    const runtime = createAIQueueRuntime(current.database, 'owner', current.analysis, {
      workerId: 'late-runtime',
      pollIntervalMs: 1_000,
      leaseDurationMs: 50,
      leaseRenewalMs: 5
    });
    const job = enqueueDaily(
      runtime.queue,
      current.analysis,
      current.profile.id,
      current.profile.generationModel!
    );
    await runtime.start();
    runtime.wake();
    await providerStarted.promise;
    expect(runtime.queue.get(job.id)?.status).toBe('leased');
    const began = performance.now();
    await runtime.stop(25);
    expect(performance.now() - began).toBeLessThan(250);
    await cancellation.promise;
    expect(runtime.worker.resources()).toMatchObject({ polling: false, heartbeat: false });
    expect(current.database.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({
      count: 0
    });
    expect(
      current.database.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()
    ).toEqual({ count: 0 });
    expect(runtime.queue.get(job.id)?.status).toBe('leased');
    lateResponse.resolve(
      new Response(JSON.stringify({ response: dailyResult('Too late.') }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    await vi.waitFor(() =>
      expect(runtime.worker.resources()).toEqual({
        polling: false,
        heartbeat: false,
        activeExecution: false
      })
    );
    expect(current.database.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({
      count: 0
    });
    current.database.close();

    const reopened = openDesktopDatabase(filename, Buffer.alloc(32, 9));
    const runtimeB = createAIQueueRuntime(reopened, 'owner', {} as never, {
      workerId: 'recovery-runtime',
      pollIntervalMs: 1_000
    });
    expect(runtimeB.queue.recover(new Date(Date.now() + 1_000)).reclaimed).toBe(1);
    expect(runtimeB.queue.get(job.id)?.status).toBe('retry_wait');
    await runtimeB.stop();
    reopened.close();
  });

  it('keeps lifecycle diagnostics bounded and excludes queue payload secrets from projections', () => {
    const current = setup();
    const runtime = createAIQueueRuntime(current.database, 'owner', current.analysis);
    const secrets = [
      'PHASE2B_LIFECYCLE_SECRET_KEY',
      'Bearer PHASE2B_LIFECYCLE_SECRET_AUTH',
      'PHASE2B_LIFECYCLE_SECRET_PROMPT',
      'PHASE2B_LIFECYCLE_SECRET_BODY',
      'PHASE2B_LIFECYCLE_SECRET_LEASE'
    ];
    const job = runtime.queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'secret-safe-projection',
      payload: { raw: secrets.join('|') }
    });
    const insert = current.database.prepare(
      `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, job_id, created_at) VALUES (?, 'owner', 'DAY', ?, 1, 'ACTIVE', ?, '1', '1', ?, '2026-07-21T00:00:00.000Z')`
    );
    for (let index = 0; index < 105; index += 1)
      insert.run(
        `orphan-${index}`,
        `orphan-${index}`,
        secrets[index % secrets.length],
        `missing-job-${index}`
      );
    runtime.queue.recover();
    const serialized = JSON.stringify({
      diagnostics: current.database.prepare('SELECT code, message FROM ai_queue_diagnostics').all(),
      projection: runtime.read.get(job.id)
    });
    expect(
      current.database.prepare('SELECT COUNT(*) AS count FROM ai_queue_diagnostics').get()
    ).toEqual({ count: 100 });
    for (const secret of secrets) expect(serialized).not.toContain(secret);
    current.database.close();
  });
});
