import { describe, expect, it, vi } from 'vitest';

import { AIError } from './errors.js';
import { AIJobQueue } from './job-queue.js';
import { AIJobWorker } from './job-worker.js';
import { openDesktopDatabase } from '../database/database.js';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  return { database, queue: new AIJobQueue(database, 'owner') };
}

async function waitForStatus(queue: AIJobQueue, id: string, status: string): Promise<void> {
  await vi.waitFor(() => expect(queue.get(id)?.status).toBe(status), { timeout: 1_000 });
}

describe('AIJobWorker', () => {
  it('starts once, wakes for eligible work, and completes through its handler registry', async () => {
    const { database, queue } = fixture();
    let executions = 0;
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async () => {
          executions += 1;
          return { resultReference: 'memory-1' };
        }
      },
      { pollIntervalMs: 50, leaseDurationMs: 100, leaseRenewalMs: 20, workerId: 'test-worker' }
    );
    worker.start();
    worker.start();
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:worker',
      payload: {}
    });
    worker.wake();
    await waitForStatus(queue, job.id, 'succeeded');
    expect(executions).toBe(1);
    expect(queue.get(job.id)?.leaseToken).toBeNull();
    worker.stop();
    worker.stop();
    database.close();
  });

  it('leaves future retry-wait work ineligible and maps handler errors into queue states', async () => {
    const { database, queue } = fixture();
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async () => {
          throw new AIError('NETWORK_UNAVAILABLE', 'offline', true);
        }
      },
      { pollIntervalMs: 20, workerId: 'test-worker' }
    );
    const future = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:future',
      payload: {},
      runAfter: new Date(Date.now() + 60_000)
    });
    const retry = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:retry',
      payload: {}
    });
    const unsupported = queue.enqueue({
      kind: 'weekly_analysis',
      idempotencyKey: 'weekly:unsupported',
      payload: {}
    });
    worker.start();
    worker.wake();
    await waitForStatus(queue, retry.id, 'retry_wait');
    await waitForStatus(queue, unsupported.id, 'failed');
    expect(queue.get(unsupported.id)?.lastErrorCode).toBe('UNSUPPORTED_JOB_TYPE');
    expect(queue.get(future.id)?.status).toBe('queued');
    worker.stop();
    database.close();
  });

  it('renews a long-running lease and aborts a handler when cancellation is requested', async () => {
    const { database, queue } = fixture();
    let started: (() => void) | undefined;
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async ({ signal }) => {
          started?.();
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              {
                once: true
              }
            );
          });
          return {};
        }
      },
      { pollIntervalMs: 20, leaseDurationMs: 60, leaseRenewalMs: 10, workerId: 'test-worker' }
    );
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:cancel',
      payload: {}
    });
    worker.start();
    worker.wake();
    await running;
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(queue.get(job.id)?.leaseExpiresAt).toBeTruthy();
    queue.requestCancellation(job.id);
    await waitForStatus(queue, job.id, 'cancelled');
    worker.stop();
    database.close();
  });

  it('does not complete work after lease ownership is lost', async () => {
    const { database, queue } = fixture();
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { resultReference: 'late-result' };
        }
      },
      { pollIntervalMs: 20, leaseDurationMs: 50, leaseRenewalMs: 10, workerId: 'test-worker' }
    );
    vi.spyOn(queue, 'renewLease').mockReturnValue(false);
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:lost',
      payload: {}
    });
    worker.start();
    worker.wake();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(queue.get(job.id)?.status).not.toBe('succeeded');
    worker.stop();
    database.close();
  });

  it('stops an active cancellable execution without acknowledging a partial result', async () => {
    const { database, queue } = fixture();
    let started: (() => void) | undefined;
    const active = new Promise<void>((resolve) => {
      started = resolve;
    });
    const worker = new AIJobWorker(
      queue,
      {
        daily_analysis: async ({ signal }) => {
          started?.();
          await new Promise<void>((_resolve, reject) =>
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true }
            )
          );
          return { resultReference: 'partial' };
        }
      },
      { pollIntervalMs: 5, leaseDurationMs: 50, leaseRenewalMs: 5 }
    );
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'shutdown-active',
      payload: {}
    });
    worker.start();
    worker.wake();
    await active;
    worker.stop();
    worker.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(worker.isRunning()).toBe(false);
    expect(queue.get(job.id)?.status).toBe('leased');
    expect(queue.get(job.id)?.resultReference).toBeNull();
    database.close();
  });
});
