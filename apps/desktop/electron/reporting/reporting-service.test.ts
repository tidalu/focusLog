import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import { ReportingService } from './reporting-service.js';

const timestamp = '2026-03-28T20:00:00.000Z';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO devices
        (id, owner_id, public_key, fingerprint, platform, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'windows', 'ACTIVE', ?, ?)`
    )
    .run('device', 'owner', 'public', 'fingerprint', timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO focus_modes
        (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at)
       VALUES ('mode', 'owner', 'Deep work', 30, '{}', 'v1', ?, ?)`
    )
    .run(timestamp, timestamp);
  return {
    database,
    reporting: new ReportingService(database, 'owner', () => new Date('2026-03-30T12:00:00Z'))
  };
}

function insertSession(
  database: ReturnType<typeof openDesktopDatabase>,
  id: string,
  startedAt: string,
  endedAt: string | null
) {
  database
    .prepare(
      `INSERT INTO focus_sessions
        (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id,
         started_at, ended_at, version, created_at, updated_at)
       VALUES (?, 'owner', 'mode', 'Deep work', 'COMPLETED', '{}', 'Europe/Warsaw',
               ?, ?, 'v1', ?, ?)`
    )
    .run(id, startedAt, endedAt, timestamp, timestamp);
}

function insertCheckIn(
  database: ReturnType<typeof openDesktopDatabase>,
  id: string,
  submittedAt: string,
  body = 'A detailed completed focus check-in'
) {
  const revisionId = `${id}-revision`;
  database
    .prepare(
      `INSERT INTO check_ins
        (id, owner_id, current_revision_id, submitted_at, timezone_id, version,
         created_at, updated_at)
       VALUES (?, 'owner', ?, ?, 'Europe/Warsaw', ?, ?, ?)`
    )
    .run(id, revisionId, submittedAt, revisionId, submittedAt, submittedAt);
  database
    .prepare(
      `INSERT INTO check_in_revisions
        (id, check_in_id, body, author_device_id, operation_id, created_at)
       VALUES (?, ?, ?, 'device', ?, ?)`
    )
    .run(revisionId, id, body, `${id}-operation`, submittedAt);
}

describe('desktop reporting', () => {
  it('uses a 23-hour DST day and clips overlapping sessions to the local day', () => {
    const { database, reporting } = fixture();
    insertSession(database, 'session', '2026-03-28T22:30:00.000Z', '2026-03-29T22:30:00.000Z');
    insertCheckIn(database, 'inside', '2026-03-28T23:15:00.000Z');
    insertCheckIn(database, 'outside', '2026-03-29T22:15:00.000Z');

    const report = reporting.daily({ day: '2026-03-29', timezoneId: 'Europe/Warsaw' });

    expect(report.dayDurationMinutes).toBe(1380);
    expect(report.totalTrackedMinutes).toBe(1380);
    expect(report.timeline.filter((item) => item.kind === 'CHECK_IN')).toHaveLength(1);
  });

  it('includes reminders, transitions, session boundaries and conflicts in chronological logs', () => {
    const { database, reporting } = fixture();
    insertSession(database, 'session', '2026-03-29T08:00:00.000Z', '2026-03-29T09:00:00.000Z');
    database
      .prepare(
        `INSERT INTO reminder_occurrences
          (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at,
           resolved_at, timezone_id, policy_snapshot_json, version, created_at, updated_at)
         VALUES ('occurrence', 'owner', 'session', 'COMPLETED', ?, ?, ?,
                 'Europe/Warsaw', '{}', 'v2', ?, ?)`
      )
      .run(
        '2026-03-29T08:30:00.000Z',
        '2026-03-29T08:30:00.000Z',
        '2026-03-29T08:35:00.000Z',
        timestamp,
        timestamp
      );
    database
      .prepare(
        `INSERT INTO reminder_transitions
          (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state,
           original_scheduled_at, occurred_at, operation_id, created_at)
         VALUES ('transition', 'owner', 'occurrence', 'device', 'PRESENTED', 'COMPLETED',
                 ?, ?, 'transition-operation', ?)`
      )
      .run('2026-03-29T08:30:00.000Z', '2026-03-29T08:35:00.000Z', '2026-03-29T08:35:00.000Z');
    insertCheckIn(database, 'check-in', '2026-03-29T08:35:00.000Z');
    database
      .prepare(
        `INSERT INTO conflicts
          (id, owner_id, entity_type, entity_id, status, created_at)
         VALUES ('conflict', 'owner', 'check_in', 'check-in', 'OPEN', ?)`
      )
      .run('2026-03-29T08:36:00.000Z');

    const report = reporting.daily({ day: '2026-03-29', timezoneId: 'Europe/Warsaw' });

    expect(report.completedIntervals).toBe(1);
    expect(report.focusScore).toBe(100);
    expect(report.completionPercentage).toBe(100);
    expect(report.averageResponseDelayMinutes).toBe(5);
    expect(report.longestFocusStreak).toBe(1);
    expect(report.mostCommonActivity).toBe('A detailed completed focus check-in');
    expect(report.wordCloud).toContainEqual({ word: 'check-in', count: 1 });
    expect(new Set(report.timeline.map((item) => item.kind))).toEqual(
      new Set([
        'SESSION_START',
        'SESSION_END',
        'REMINDER',
        'REMINDER_TRANSITION',
        'CHECK_IN',
        'CONFLICT'
      ])
    );
  });

  it('returns every day for historical and leap-year heatmaps', () => {
    const { database, reporting } = fixture();
    insertCheckIn(database, 'old', '2024-02-29T12:00:00.000Z');

    const heatmap = reporting.heatmap(2024, 'Europe/Warsaw');

    expect(heatmap.days).toHaveLength(366);
    expect(heatmap.days[0]?.day).toBe('2024-01-01');
    expect(heatmap.days.at(-1)?.day).toBe('2024-12-31');
    expect(heatmap.days.find((day) => day.day === '2024-02-29')).toMatchObject({
      value: 1,
      intensity: 1
    });
  });
});
