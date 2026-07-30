import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { createAIQueueRuntime } from './queue-runtime.js';

describe('production AI queue runtime', () => {
  it('uses the production composition and safely starts, wakes, and stops once', async () => {
    const database = openDesktopDatabase(':memory:');
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const runtime = createAIQueueRuntime(database, 'owner', {} as never, { pollIntervalMs: 1000 });
    await runtime.start();
    await runtime.start();
    runtime.wake();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
    database.close();
  });

  it('stops an idle runtime without retaining a worker execution', async () => {
    const database = openDesktopDatabase(':memory:');
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01', '2026-01-01');
    const runtime = createAIQueueRuntime(database, 'owner', {} as never, { pollIntervalMs: 5 });
    await runtime.start();
    expect(runtime.worker.hasActiveExecution()).toBe(false);
    await runtime.stop(10);
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.worker.hasActiveExecution()).toBe(false);
    database.close();
  });
});
