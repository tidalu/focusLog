import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import {
  closeBehavior,
  reminderIntervalMinutes,
  setCloseBehavior,
  setReminderInterval,
  writeOwnerSettings
} from './preferences.js';

const now = new Date('2026-07-20T12:00:00.000Z');

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', now.toISOString(), now.toISOString());
  database
    .prepare(
      `INSERT INTO devices
        (id, owner_id, public_key, fingerprint, platform, status, created_at, updated_at)
       VALUES ('device', 'owner', 'public', 'fingerprint', 'windows', 'ACTIVE', ?, ?)`
    )
    .run(now.toISOString(), now.toISOString());
  return database;
}

describe('desktop reminder preferences', () => {
  it('minimizes to the tray by default and persists an explicit exit preference', () => {
    const database = fixture();
    expect(closeBehavior(database, 'owner')).toBe('tray');
    expect(setCloseBehavior(database, 'owner', 'exit', now)).toBe('exit');
    expect(closeBehavior(database, 'owner')).toBe('exit');
    expect(() => setCloseBehavior(database, 'owner', 'invalid' as 'tray', now)).toThrow(
      'tray or exit'
    );
    database.close();
  });

  it('uses 15 minutes by default and validates the supported custom range', () => {
    const database = fixture();
    expect(reminderIntervalMinutes(database, 'owner')).toBe(15);
    expect(() => setReminderInterval(database, 'owner', 'device', 4, now)).toThrow(
      'between 5 and 240'
    );
    expect(() => setReminderInterval(database, 'owner', 'device', 241, now)).toThrow(
      'between 5 and 240'
    );
  });

  it('preserves unrelated settings and reschedules the next active reminder', () => {
    const database = fixture();
    writeOwnerSettings(database, 'owner', { startupEnabled: true }, now);
    database
      .prepare(
        `INSERT INTO focus_modes
          (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at)
         VALUES ('mode', 'owner', 'Default focus', 15, ?, 'mode-v1', ?, ?)`
      )
      .run('{"intervalMinutes":15}', now.toISOString(), now.toISOString());
    database
      .prepare(
        `INSERT INTO focus_sessions
          (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id,
           started_at, version, created_at, updated_at)
         VALUES ('session', 'owner', 'mode', 'Focus session', 'ACTIVE', ?, 'UTC',
                 ?, 'session-v1', ?, ?)`
      )
      .run('{"intervalMinutes":15}', now.toISOString(), now.toISOString(), now.toISOString());
    database
      .prepare(
        `INSERT INTO reminder_occurrences
          (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at,
           timezone_id, policy_snapshot_json, version, created_at, updated_at)
         VALUES ('old', 'owner', 'session', 'SCHEDULED', ?, ?, 'UTC', ?,
                 'occurrence-v1', ?, ?)`
      )
      .run(
        new Date(now.getTime() + 15 * 60_000).toISOString(),
        new Date(now.getTime() + 15 * 60_000).toISOString(),
        '{"intervalMinutes":15}',
        now.toISOString(),
        now.toISOString()
      );

    expect(setReminderInterval(database, 'owner', 'device', 45, now)).toBe(45);
    expect(reminderIntervalMinutes(database, 'owner')).toBe(45);
    expect(
      database.prepare('SELECT state FROM reminder_occurrences WHERE id = ?').get('old')
    ).toMatchObject({ state: 'SUPERSEDED' });
    expect(
      database
        .prepare(
          `SELECT scheduled_at AS scheduledAt, policy_snapshot_json AS policyJson
             FROM reminder_occurrences WHERE state = 'SCHEDULED'`
        )
        .get()
    ).toMatchObject({
      scheduledAt: new Date(now.getTime() + 45 * 60_000).toISOString()
    });
    const settings = database
      .prepare('SELECT values_json AS valuesJson FROM settings WHERE owner_id = ?')
      .get('owner') as { valuesJson: string };
    expect(JSON.parse(settings.valuesJson)).toMatchObject({
      startupEnabled: true,
      reminderIntervalMinutes: 45
    });
    expect(
      (
        database
          .prepare(
            `SELECT COUNT(*) AS count FROM outbox_operations
              WHERE kind IN ('reminder.transition', 'reminder.schedule')`
          )
          .get() as { count: number }
      ).count
    ).toBe(2);
  });
});
