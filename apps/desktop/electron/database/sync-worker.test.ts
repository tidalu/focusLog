import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from './database.js';
import { drainOutbox } from './sync-worker.js';

function queuedDatabase() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare(
      'INSERT INTO outbox_operations (operation_id, owner_id, device_id, device_sequence, entity_type, entity_id, kind, payload_json, occurred_at, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      '01J00000000000000000000009',
      '01J00000000000000000000000',
      '01J00000000000000000000001',
      1,
      'check_in',
      '01J00000000000000000000008',
      'check_in.revise',
      '{}',
      '2026-07-20T00:00:00.000Z',
      '2026-07-20T00:00:00.000Z',
      '2026-07-20T00:00:00.000Z'
    );
  return database;
}

describe('offline outbox synchronization', () => {
  it('acknowledges accepted and duplicate operations exactly once', async () => {
    const database = queuedDatabase();
    await drainOutbox(
      database,
      {
        push: async () => ({
          results: [{ operationId: '01J00000000000000000000009', status: 'duplicate' }]
        })
      },
      new Date('2026-07-20T01:00:00.000Z')
    );
    expect(database.prepare('SELECT acknowledged_at FROM outbox_operations').get()).toMatchObject({
      acknowledged_at: '2026-07-20T01:00:00.000Z'
    });
    database.close();
  });

  it('retains an operation and schedules retry after a network interruption', async () => {
    const database = queuedDatabase();
    await drainOutbox(
      database,
      {
        push: async () => {
          throw new Error('network unavailable');
        }
      },
      new Date('2026-07-20T01:00:00.000Z')
    );
    expect(
      database.prepare('SELECT attempts, acknowledged_at FROM outbox_operations').get()
    ).toMatchObject({ attempts: 1, acknowledged_at: null });
    expect(database.prepare('SELECT code FROM sync_failures').get()).toMatchObject({
      code: 'NETWORK_FAILURE'
    });
    database.close();
  });
});
