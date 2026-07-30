import { describe, expect, it } from 'vitest';

import { AIJobQueue } from './job-queue.js';
import { QueueReadService } from './queue-read-service.js';
import { openDesktopDatabase } from '../database/database.js';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  return {
    database,
    queue: new AIJobQueue(database, 'owner'),
    read: new QueueReadService(database, 'owner')
  };
}

function persistDailyResult(database: ReturnType<typeof openDesktopDatabase>, jobId: string): void {
  database
    .prepare(
      `INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, job_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      `memory-${jobId}`,
      'owner',
      'DAY',
      '2026-07-21',
      1,
      'ACTIVE',
      'Persisted before acknowledgement.',
      '1',
      '1.0.0',
      jobId,
      '2026-07-21T00:00:00.000Z'
    );
}

describe('AI queue recovery and safe read models', () => {
  it('reconciles persisted daily results without another provider execution', () => {
    const { database, queue } = fixture();
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'reconcile',
      payload: {},
      runAfter: new Date('2026-07-21T00:00:00.000Z')
    });
    const leased = queue.leaseNext('dead-worker', 60_000)!;
    expect(leased.id).toBe(job.id);
    persistDailyResult(database, job.id);
    expect(queue.recover(new Date('2026-07-21T00:00:01.000Z'))).toMatchObject({ reconciled: 1 });
    expect(queue.get(job.id)).toMatchObject({
      status: 'succeeded',
      resultReference: `memory-${job.id}`
    });
    database.close();
  });

  it('preserves retry schedules and reclaims only expired leases', () => {
    const { database, queue } = fixture();
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'expired',
      payload: {},
      runAfter: new Date('2026-07-21T00:00:00.000Z')
    });
    queue.leaseNext('dead-worker', 100, new Date('2026-07-21T00:00:00.000Z'));
    expect(queue.recover(new Date('2026-07-21T00:00:00.050Z')).reclaimed).toBe(0);
    expect(queue.recover(new Date('2026-07-21T00:00:01.000Z')).reclaimed).toBe(1);
    expect(queue.get(job.id)?.status).toBe('retry_wait');
    database.close();
  });

  it('returns sanitized renderer-safe summaries and makes cancellation/retry idempotent', () => {
    const { database, queue, read } = fixture();
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'safe-view',
      payload: { secret: 'nope' }
    });
    expect(read.get(job.id)).toMatchObject({
      id: job.id,
      actions: { canCancel: true, canRetry: false }
    });
    expect(JSON.stringify(read.get(job.id))).not.toContain('secret');
    expect(queue.requestCancellation(job.id)?.status).toBe('cancelled');
    expect(queue.requestCancellation(job.id)?.status).toBe('cancelled');
    const failed = queue.enqueue({ kind: 'daily_analysis', idempotencyKey: 'failed', payload: {} });
    const leased = queue.leaseNext('worker', 100)!;
    queue.fail(failed.id, 'worker', leased.leaseToken!, 'VALIDATION', 'bad input', false);
    const retry = queue.retry(failed.id)!;
    expect(queue.retry(failed.id)?.id).toBe(retry.id);
    expect(read.get(retry.id)?.actions.canCancel).toBe(true);
    database.close();
  });
  it('projects a safe ordered execution timeline without payload, leases, or reservation internals', () => {
    const { database, queue, read } = fixture();
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'timeline',
      payload: { rawPrompt: 'SECRET_PROMPT' },
      fallbackSnapshot: {
        schemaVersion: 1,
        chainVersion: 2,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 1,
            allowFallback: true
          }
        ]
      }
    });
    database
      .prepare(
        "INSERT INTO ai_provider_attempts (id,owner_id,job_id,sequence,queue_attempt,provider_type,model_id,operation_type,outcome,settled_cost_micros,created_at,updated_at) VALUES ('attempt','owner',?,1,1,'ollama','m','generation','succeeded',7,'2026-01-01','2026-01-01')"
      )
      .run(job.id);
    expect(read.executionSummary(job.id)).toMatchObject({
      snapshotVersion: 2,
      attempts: [{ sequence: 1, settledMicros: '7' }]
    });
    const serialized = JSON.stringify(read.executionSummary(job.id));
    expect(serialized).not.toContain('SECRET_PROMPT');
    expect(serialized).not.toContain('leaseToken');
    database.close();
  });
});
