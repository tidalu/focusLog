import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AIService } from './ai-service.js';
import { AnalysisService } from './analysis-service.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds
} from './daily-analysis-job.js';
import { createDailyAnalysisHandler } from './daily-analysis-handler.js';
import { DesktopCredentialStore } from './credentials.js';
import { AIJobQueue } from './job-queue.js';
import { AIJobWorker } from './job-worker.js';
import { loadBuiltinPrompt } from './prompts.js';
import { openDesktopDatabase } from '../database/database.js';

const directories: string[] = [];
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
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  const root = mkdtempSync(join(tmpdir(), 'focuslog-daily-queue-'));
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
  database
    .prepare(
      `INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'check-in',
      'owner',
      'revision',
      '2026-07-21T10:00:00.000Z',
      'UTC',
      'v1',
      '2026-07-21T10:00:00.000Z',
      '2026-07-21T10:00:00.000Z'
    );
  database
    .prepare(
      'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      'revision',
      'check-in',
      'Completed a focused planning block.',
      'operation',
      '2026-07-21T10:00:00.000Z'
    );
  const analysis = new AnalysisService(database, 'owner', ai);
  return { database, ai, analysis, profile, queue: new AIJobQueue(database, 'owner') };
}

function enqueueDaily(
  queue: AIJobQueue,
  analysis: AnalysisService,
  profileId: string,
  model: string
) {
  const prompt = loadBuiltinPrompt('daily');
  const timezone = 'UTC';
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

async function waitForStatus(queue: AIJobQueue, jobId: string, status: string): Promise<void> {
  await vi.waitFor(() => expect(queue.get(jobId)?.status).toBe(status), { timeout: 1_500 });
}

describe('queued daily analysis', () => {
  it('deduplicates the enqueue and persists a result, provenance, usage, and job link', async () => {
    const { database, analysis, profile, queue } = fixture();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            response: dailyResult('A useful reflection.'),
            prompt_eval_count: 5,
            eval_count: 3
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
    );
    const first = enqueueDaily(queue, analysis, profile.id, profile.generationModel!);
    const duplicate = enqueueDaily(queue, analysis, profile.id, profile.generationModel!);
    expect(duplicate.id).toBe(first.id);
    const worker = new AIJobWorker(
      queue,
      { daily_analysis: createDailyAnalysisHandler(analysis) },
      { pollIntervalMs: 20, leaseDurationMs: 100, leaseRenewalMs: 20, workerId: 'daily-test' }
    );
    worker.start();
    worker.wake();
    await waitForStatus(queue, first.id, 'succeeded');
    expect(database.prepare('SELECT job_id AS jobId, content FROM ai_memories').get()).toEqual({
      jobId: first.id,
      content: 'A useful reflection.'
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_memory_sources').get()).toEqual({
      count: 1
    });
    expect(database.prepare('SELECT job_id AS jobId FROM ai_usage_records').get()).toEqual({
      jobId: first.id
    });
    worker.stop();
    database.close();
  });

  it('reconciles a result persisted before acknowledgement without generating a duplicate', async () => {
    const { database, analysis, profile, queue } = fixture();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: dailyResult('Recovered result.') }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const job = enqueueDaily(queue, analysis, profile.id, profile.generationModel!);
    await analysis.analyzeDaily(profile.id, '2026-07-21', { jobId: job.id, timezone: 'UTC' });
    const worker = new AIJobWorker(
      queue,
      { daily_analysis: createDailyAnalysisHandler(analysis) },
      { pollIntervalMs: 20, workerId: 'daily-recovery' }
    );
    worker.start();
    worker.wake();
    await waitForStatus(queue, job.id, 'succeeded');
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({
      count: 1
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    worker.stop();
    database.close();
  });
  it('repairs one invalid queued response through a separately recorded coordinator attempt', async () => {
    const { database, analysis, profile, queue } = fixture();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ response: 'not-json' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ response: dailyResult('Repaired reflection.') }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        )
    );
    const job = enqueueDaily(queue, analysis, profile.id, profile.generationModel!);
    const worker = new AIJobWorker(
      queue,
      { daily_analysis: createDailyAnalysisHandler(analysis) },
      { pollIntervalMs: 20, leaseDurationMs: 100, leaseRenewalMs: 20, workerId: 'daily-repair' }
    );
    worker.start();
    worker.wake();
    await waitForStatus(queue, job.id, 'succeeded');
    expect(
      database
        .prepare(
          'SELECT operation_type AS operation, outcome FROM ai_provider_attempts WHERE job_id = ? ORDER BY sequence'
        )
        .all(job.id)
    ).toEqual([
      { operation: 'generation', outcome: 'succeeded' },
      { operation: 'structured_repair', outcome: 'succeeded' }
    ]);
    expect(
      database.prepare('SELECT content FROM ai_memories WHERE job_id = ?').get(job.id)
    ).toEqual({ content: 'Repaired reflection.' });
    await worker.stop();
    database.close();
  });
});
