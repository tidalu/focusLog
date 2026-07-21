import { ulid } from 'ulid';

import { inferredCategoryId } from '../database/category-inference.js';
import type { DesktopDatabase } from '../database/database.js';
import { queueSyncOperation } from '../database/local-sync.js';
import { transitionReminder, type ReminderState } from './state.js';

interface ReminderRow {
  id: string;
  owner_id: string;
  focus_session_id: string;
  state: ReminderState;
  scheduled_at: string;
  original_scheduled_at: string;
  timezone_id: string;
  policy_snapshot_json: string;
  version: string;
}

export function queueReminderSchedule(
  database: DesktopDatabase,
  input: { ownerId: string; deviceId: string; occurrenceId: string; occurredAt?: string }
): string {
  const row = database
    .prepare(
      `SELECT ro.*, fs.focus_mode_id, fs.name AS session_name, fs.started_at,
              fs.schedule_policy_json, fm.name AS mode_name, fm.interval_minutes,
              fm.policy_json, fm.version AS mode_version, fs.version AS session_version
       FROM reminder_occurrences ro
       JOIN focus_sessions fs ON fs.id = ro.focus_session_id
       JOIN focus_modes fm ON fm.id = fs.focus_mode_id
       WHERE ro.id = ? AND ro.owner_id = ?`
    )
    .get(input.occurrenceId, input.ownerId) as Record<string, unknown> | undefined;
  if (!row) throw new Error('Reminder occurrence was not found.');
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return queueSyncOperation(database, {
    ownerId: input.ownerId,
    deviceId: input.deviceId,
    entityType: 'reminder_occurrence',
    entityId: input.occurrenceId,
    kind: 'reminder.schedule',
    payload: {
      mode: {
        id: row.focus_mode_id,
        name: row.mode_name,
        intervalMinutes: row.interval_minutes,
        policy: JSON.parse(String(row.policy_json)),
        version: row.mode_version
      },
      session: {
        id: row.focus_session_id,
        name: row.session_name,
        startedAt: row.started_at,
        timezoneId: row.timezone_id,
        schedulePolicy: JSON.parse(String(row.schedule_policy_json)),
        version: row.session_version
      },
      occurrence: {
        scheduledAt: row.scheduled_at,
        originalScheduledAt: row.original_scheduled_at,
        timezoneId: row.timezone_id,
        policySnapshot: JSON.parse(String(row.policy_snapshot_json)),
        version: row.version
      }
    },
    occurredAt
  });
}

export function transitionReminderOffline(
  database: DesktopDatabase,
  input: {
    ownerId: string;
    deviceId: string;
    occurrenceId: string;
    to: ReminderState;
    reason?: string;
    occurredAt?: string;
    effectiveDueAt?: string;
  }
): string {
  const occurrence = database
    .prepare('SELECT * FROM reminder_occurrences WHERE id = ? AND owner_id = ?')
    .get(input.occurrenceId, input.ownerId) as ReminderRow | undefined;
  if (!occurrence) throw new Error('Reminder occurrence was not found.');
  transitionReminder(occurrence.state, input.to);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const operationId = ulid();
  const transitionId = ulid();
  database.transaction(() => {
    database
      .prepare(
        `UPDATE reminder_occurrences
         SET state = ?, scheduled_at = COALESCE(?, scheduled_at),
             presented_at = CASE WHEN ? = 'PRESENTED' THEN ? ELSE presented_at END,
             resolved_at = CASE WHEN ? IN ('COMPLETED','MISSED','SKIPPED','EMERGENCY_DISMISSED','SUPERSEDED') THEN ? ELSE resolved_at END,
             version = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        input.to,
        input.effectiveDueAt ?? null,
        input.to,
        occurredAt,
        input.to,
        occurredAt,
        operationId,
        occurredAt,
        input.occurrenceId
      );
    database
      .prepare(
        `INSERT INTO reminder_transitions
         (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state, reason,
          original_scheduled_at, occurred_at, operation_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        transitionId,
        input.ownerId,
        input.occurrenceId,
        input.deviceId,
        occurrence.state,
        input.to,
        input.reason ?? null,
        occurrence.original_scheduled_at,
        occurredAt,
        operationId,
        occurredAt
      );
    queueSyncOperation(database, {
      ownerId: input.ownerId,
      deviceId: input.deviceId,
      entityType: 'reminder_occurrence',
      entityId: input.occurrenceId,
      kind: 'reminder.transition',
      baseVersion: occurrence.version,
      payload: {
        transitionId,
        fromState: occurrence.state,
        toState: input.to,
        occurredAt,
        reason: input.reason ?? null,
        effectiveDueAt: input.effectiveDueAt ?? null
      },
      occurredAt,
      operationId
    });
  })();
  return operationId;
}

export function completeReminderOffline(
  database: DesktopDatabase,
  input: {
    ownerId: string;
    deviceId: string;
    occurrenceId: string;
    text: string;
    occurredAt?: string;
  }
): { checkInId: string; operationId: string } {
  const body = input.text.trim();
  if ([...body].length < 20)
    throw new Error('Reminder completion requires at least 20 Unicode characters.');
  const occurrence = database
    .prepare('SELECT * FROM reminder_occurrences WHERE id = ? AND owner_id = ?')
    .get(input.occurrenceId, input.ownerId) as ReminderRow | undefined;
  if (!occurrence) throw new Error('Reminder occurrence was not found.');
  const prior = database
    .prepare('SELECT id FROM check_ins WHERE reminder_occurrence_id = ?')
    .get(input.occurrenceId) as { id: string } | undefined;
  if (prior && occurrence.state === 'COMPLETED')
    return { checkInId: prior.id, operationId: occurrence.version };
  transitionReminder(occurrence.state, 'COMPLETED', body);

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const operationId = ulid();
  const transitionId = ulid();
  const checkInId = ulid();
  const revisionId = ulid();
  database.transaction(() => {
    const categoryId = inferredCategoryId(database, input.ownerId, body, occurredAt);
    database
      .prepare(
        "UPDATE reminder_occurrences SET state = 'COMPLETED', resolved_at = ?, version = ?, updated_at = ? WHERE id = ?"
      )
      .run(occurredAt, operationId, occurredAt, input.occurrenceId);
    database
      .prepare(
        `INSERT INTO reminder_transitions
         (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state,
          original_scheduled_at, occurred_at, operation_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`
      )
      .run(
        transitionId,
        input.ownerId,
        input.occurrenceId,
        input.deviceId,
        occurrence.state,
        occurrence.original_scheduled_at,
        occurredAt,
        operationId,
        occurredAt
      );
    database
      .prepare(
        `INSERT INTO check_ins
         (id, owner_id, reminder_occurrence_id, focus_session_id, category_id, current_revision_id,
          submitted_at, timezone_id, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        checkInId,
        input.ownerId,
        input.occurrenceId,
        occurrence.focus_session_id,
        categoryId,
        revisionId,
        occurredAt,
        occurrence.timezone_id,
        revisionId,
        occurredAt,
        occurredAt
      );
    database
      .prepare(
        'INSERT INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(revisionId, checkInId, body, input.deviceId, operationId, occurredAt);
    queueSyncOperation(database, {
      ownerId: input.ownerId,
      deviceId: input.deviceId,
      entityType: 'reminder_occurrence',
      entityId: input.occurrenceId,
      kind: 'reminder.complete',
      baseVersion: occurrence.version,
      payload: { transitionId, checkInId, revisionId, body, completedAt: occurredAt },
      occurredAt,
      operationId
    });
  })();
  return { checkInId, operationId };
}
