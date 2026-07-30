import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { AIJobQueue } from './job-queue.js';

describe('queue forced process-loss recovery', () => {
  it('leaves a lost lease intact until expiry, then reclaims it and rejects stale completion', () => {
    const root = mkdtempSync(join(tmpdir(), 'focuslog-process-loss-'));
    const file = join(root, 'queue.sqlite');
    const key = Buffer.alloc(32, 7);
    const first = openDesktopDatabase(file, key);
    first
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const queueA = new AIJobQueue(first, 'owner');
    const job = queueA.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'loss',
      payload: {},
      runAfter: new Date('2026-01-01T00:00:00.000Z')
    });
    const leased = queueA.leaseNext('runtime-a', 100, new Date('2026-01-01T00:00:00.000Z'))!;
    first.close(); // forced loss: no worker stop, no release, no terminal transition
    const second = openDesktopDatabase(file, key);
    const queueB = new AIJobQueue(second, 'owner');
    expect(queueB.get(job.id)?.status).toBe('leased');
    expect(queueB.recover(new Date('2026-01-01T00:00:00.050Z')).reclaimed).toBe(0);
    expect(queueB.recover(new Date('2026-01-01T00:00:01.000Z')).reclaimed).toBe(1);
    const reclaimed = queueB.leaseNext('runtime-b', 100, new Date('2026-01-01T00:00:01.000Z'))!;
    expect(queueB.complete(job.id, 'runtime-a', leased.leaseToken!, 'stale')).toBe(false);
    expect(reclaimed.leaseOwner).toBe('runtime-b');
    second.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('finalizes a cancellation requested before process loss without restarting the provider', () => {
    const database = openDesktopDatabase(':memory:');
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const queue = new AIJobQueue(database, 'owner');
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'cancel-loss',
      payload: {},
      runAfter: new Date('2026-01-01T00:00:00.000Z')
    });
    queue.leaseNext('lost', 10, new Date('2026-01-01T00:00:00.000Z'));
    queue.requestCancellation(job.id);
    queue.recover(new Date('2026-01-01T00:00:01.000Z'));
    expect(queue.get(job.id)?.status).toBe('cancelled');
    database.close();
  });
});
