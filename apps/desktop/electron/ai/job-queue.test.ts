import { describe, expect, it } from 'vitest';

import { AIJobQueue, retryDelay } from './job-queue.js';
import { openDesktopDatabase } from '../database/database.js';

function queue() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  return { database, queue: new AIJobQueue(database, 'owner') };
}

describe('durable AI job queue', () => {
  it('deduplicates equivalent active jobs and leases only once', () => {
    const { database, queue: jobs } = queue();
    const first = jobs.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:2026-07-21',
      payload: { day: '2026-07-21' },
      runAfter: new Date('2026-07-21T00:00:00.000Z')
    });
    expect(
      jobs.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: 'daily:2026-07-21',
        payload: { day: '2026-07-21' },
        runAfter: new Date('2026-07-21T00:00:00.000Z')
      }).id
    ).toBe(first.id);
    const leased = jobs.leaseNext('worker-a', 30_000, new Date('2026-07-21T00:00:00.000Z'));
    expect(leased).toMatchObject({ id: first.id, status: 'leased', attempts: 1 });
    expect(jobs.leaseNext('worker-b', 30_000, new Date('2026-07-21T00:00:00.000Z'))).toBeNull();
    database.close();
  });

  it('rejects stale worker completion and reclaims an expired lease', () => {
    const { database, queue: jobs } = queue();
    const job = jobs.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:lease',
      payload: {},
      runAfter: new Date('2026-07-21T00:00:00.000Z')
    });
    const leased = jobs.leaseNext('worker-a', 1_000, new Date('2026-07-21T00:00:00.000Z'))!;
    expect(jobs.complete(job.id, 'worker-b', leased.leaseToken!, 'memory')).toBe(false);
    expect(jobs.reclaimExpiredLeases(new Date('2026-07-21T00:00:02.000Z'))).toBe(1);
    const reclaimed = jobs.leaseNext('worker-b', 1_000, new Date('2026-07-21T00:00:02.000Z'))!;
    expect(reclaimed.leaseOwner).toBe('worker-b');
    database.close();
  });

  it('persists retry wait, dead letters after attempts, and allows cancellation', () => {
    const { database, queue: jobs } = queue();
    const job = jobs.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:retry',
      payload: {},
      maxAttempts: 2
    });
    const leased = jobs.leaseNext('worker', 1_000)!;
    expect(
      jobs.fail(job.id, 'worker', leased.leaseToken!, 'NETWORK_UNAVAILABLE', 'offline')?.status
    ).toBe('retry_wait');
    const retry = jobs.leaseNext('worker', 1_000, new Date('2099-01-01T00:00:00.000Z'))!;
    expect(
      jobs.fail(
        job.id,
        'worker',
        retry.leaseToken!,
        'NETWORK_UNAVAILABLE',
        'offline',
        true,
        new Date('2099-01-01T00:00:00.000Z')
      )?.status
    ).toBe('dead_lettered');
    const cancelled = jobs.enqueue({
      kind: 'weekly_analysis',
      idempotencyKey: 'weekly:cancel',
      payload: {}
    });
    expect(jobs.requestCancellation(cancelled.id)).toMatchObject({
      status: 'cancelled',
      cancellationRequested: true
    });
    database.close();
  });

  it('uses bounded exponential retry jitter', () => {
    expect(retryDelay(1, () => 0)).toBe(750);
    expect(retryDelay(2, () => 1)).toBe(2_500);
    expect(retryDelay(99, () => 0.5)).toBe(300_000);
  });
  it('persists an immutable sanitized fallback snapshot with the job', () => {
    const { database, queue: jobs } = queue();
    const snapshot = {
      schemaVersion: 1 as const,
      chainId: 'chain-a',
      chainVersion: 1,
      entries: [
        {
          providerProfileId: 'profile-a',
          providerType: 'ollama',
          model: 'model-a',
          maxSameProviderRetries: 1,
          allowFallback: true
        }
      ]
    };
    const job = jobs.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:snapshot',
      payload: {},
      fallbackSnapshot: snapshot
    });
    snapshot.entries[0]!.model = 'changed-after-enqueue';
    expect(jobs.fallbackSnapshot(job.id)).toMatchObject({
      chainId: 'chain-a',
      chainVersion: 1,
      entries: [{ model: 'model-a' }]
    });
    expect(JSON.stringify(jobs.fallbackSnapshot(job.id))).not.toContain('credential');
    database.close();
  });
});
