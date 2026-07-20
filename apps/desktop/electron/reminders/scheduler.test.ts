import { describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { openDesktopDatabase, type DesktopDatabase } from '../database/database.js';
import { defaultReminderPolicy } from './policy.js';
import { ReminderScheduler } from './scheduler.js';

function fixture(dueDates: string[]) {
  const database = openDesktopDatabase(':memory:');
  const ownerId = ulid();
  const deviceId = ulid();
  const modeId = ulid();
  const sessionId = ulid();
  const createdAt = '2026-07-20T08:00:00.000Z';
  const policy = JSON.stringify(defaultReminderPolicy);
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(ownerId, createdAt, createdAt);
  database
    .prepare(
      "INSERT INTO devices (id, owner_id, public_key, fingerprint, platform, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'windows', 1, 'ACTIVE', ?, ?)"
    )
    .run(deviceId, ownerId, `key-${deviceId}`, `fingerprint-${deviceId}`, createdAt, createdAt);
  database
    .prepare(
      "INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Default focus', 30, ?, ?, ?, ?)"
    )
    .run(modeId, ownerId, policy, ulid(), createdAt, createdAt);
  database
    .prepare(
      "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, 'Test', 'ACTIVE', ?, 'UTC', ?, ?, ?, ?)"
    )
    .run(sessionId, ownerId, modeId, policy, createdAt, ulid(), createdAt, createdAt);
  const ids = dueDates.map((dueAt) => {
    const id = ulid();
    database
      .prepare(
        "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, 'UTC', ?, ?, ?, ?)"
      )
      .run(id, ownerId, sessionId, dueAt, dueAt, policy, ulid(), createdAt, createdAt);
    return id;
  });
  return { database, ownerId, deviceId, ids };
}

function count(database: DesktopDatabase, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number })
    .count;
}

describe('persistent desktop reminder scheduler', () => {
  it('recovers a due reminder after process restart without duplicating its transition', () => {
    const value = fixture(['2026-07-20T08:59:00.000Z']);
    const firstPresentations: string[] = [];
    new ReminderScheduler(
      value.database,
      value.ownerId,
      value.deviceId,
      (id) => firstPresentations.push(id),
      () => new Date('2026-07-20T09:00:00.000Z')
    ).recover('restart');
    expect(firstPresentations).toEqual([value.ids[0]]);
    expect(
      value.database
        .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
        .get(value.ids[0])
    ).toMatchObject({ state: 'DUE' });
    expect(count(value.database, 'reminder_transitions')).toBe(1);

    const restartedPresentations: string[] = [];
    new ReminderScheduler(
      value.database,
      value.ownerId,
      value.deviceId,
      (id) => restartedPresentations.push(id),
      () => new Date('2026-07-20T09:00:10.000Z')
    ).recover('restart');
    expect(restartedPresentations).toEqual([value.ids[0]]);
    expect(count(value.database, 'reminder_transitions')).toBe(1);
    value.database.close();
  });

  it('detects a reminder that became due while Windows was asleep', () => {
    const value = fixture(['2026-07-20T09:30:00.000Z']);
    const presented: string[] = [];
    const scheduler = new ReminderScheduler(value.database, value.ownerId, value.deviceId, (id) =>
      presented.push(id)
    );
    scheduler.recover('resume', new Date('2026-07-20T10:00:00.000Z'));
    expect(presented).toEqual([value.ids[0]]);
    expect(value.database.prepare('SELECT reason FROM reminder_transitions').get()).toMatchObject({
      reason: 'recovery:resume'
    });
    value.database.close();
  });

  it('records overdue recovery through due to missed without showing an overlay', () => {
    const value = fixture(['2026-07-20T07:00:00.000Z']);
    const presented: string[] = [];
    new ReminderScheduler(value.database, value.ownerId, value.deviceId, (id) =>
      presented.push(id)
    ).recover('resume', new Date('2026-07-20T10:00:00.000Z'));
    expect(presented).toEqual([]);
    expect(
      value.database
        .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
        .get(value.ids[0])
    ).toMatchObject({ state: 'MISSED' });
    expect(
      value.database
        .prepare(
          'SELECT from_state, to_state FROM reminder_transitions WHERE reminder_occurrence_id = ? ORDER BY occurred_at, rowid'
        )
        .all(value.ids[0])
    ).toEqual([
      { from_state: 'SCHEDULED', to_state: 'DUE' },
      { from_state: 'DUE', to_state: 'MISSED' }
    ]);
    value.database.close();
  });

  it('completes offline atomically and queues the synchronized reminder operation', () => {
    const value = fixture(['2026-07-20T08:59:00.000Z']);
    const scheduler = new ReminderScheduler(
      value.database,
      value.ownerId,
      value.deviceId,
      () => undefined,
      () => new Date('2026-07-20T09:00:00.000Z')
    );
    scheduler.recover('restart');
    expect(() => scheduler.complete(value.ids[0], 'too short')).toThrow(/20 Unicode/);
    scheduler.complete(value.ids[0], 'Writing a complete offline check-in');
    expect(
      value.database
        .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
        .get(value.ids[0])
    ).toMatchObject({ state: 'COMPLETED' });
    expect(count(value.database, 'check_ins')).toBe(1);
    expect(
      value.database
        .prepare("SELECT kind FROM outbox_operations WHERE kind = 'reminder.complete'")
        .get()
    ).toMatchObject({ kind: 'reminder.complete' });
    value.database.close();
  });

  it('consolidates multiple recovered reminders into one visible overlay', () => {
    const value = fixture([
      '2026-07-20T08:57:00.000Z',
      '2026-07-20T08:58:00.000Z',
      '2026-07-20T08:59:00.000Z'
    ]);
    const presented: string[] = [];
    new ReminderScheduler(
      value.database,
      value.ownerId,
      value.deviceId,
      (id) => presented.push(id),
      () => new Date('2026-07-20T09:00:00.000Z')
    ).recover('resume');
    expect(presented).toEqual([value.ids[0]]);
    expect(
      value.database
        .prepare("SELECT COUNT(*) AS count FROM reminder_occurrences WHERE state = 'DUE'")
        .get()
    ).toMatchObject({ count: 3 });
    value.database.close();
  });
});
