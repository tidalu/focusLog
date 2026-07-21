import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { queueReminderSchedule, transitionReminderOffline } from './operations.js';
import { defaultReminderPolicy, parseReminderPolicy } from './policy.js';

export const reminderIntervalChoices = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as const;
export const minimumReminderInterval = 5;
export const maximumReminderInterval = 240;

type SettingsValues = Record<string, unknown>;

export type CloseBehavior = 'tray' | 'exit';

function validateInterval(intervalMinutes: number): number {
  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes < minimumReminderInterval ||
    intervalMinutes > maximumReminderInterval
  ) {
    throw new Error(
      `Reminder interval must be a whole number between ${minimumReminderInterval} and ${maximumReminderInterval} minutes.`
    );
  }
  return intervalMinutes;
}

export function readOwnerSettings(database: DesktopDatabase, ownerId: string): SettingsValues {
  const row = database
    .prepare('SELECT values_json FROM settings WHERE owner_id = ?')
    .get(ownerId) as { values_json: string } | undefined;
  if (!row) return {};
  try {
    const values = JSON.parse(row.values_json) as unknown;
    return values && typeof values === 'object' && !Array.isArray(values)
      ? (values as SettingsValues)
      : {};
  } catch {
    return {};
  }
}

export function writeOwnerSettings(
  database: DesktopDatabase,
  ownerId: string,
  values: SettingsValues,
  now = new Date()
): void {
  const timestamp = now.toISOString();
  database
    .prepare(
      `INSERT INTO settings (owner_id, values_json, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_id) DO UPDATE
       SET values_json = excluded.values_json,
           version = excluded.version,
           updated_at = excluded.updated_at`
    )
    .run(ownerId, JSON.stringify(values), ulid(), timestamp, timestamp);
}

export function closeBehavior(database: DesktopDatabase, ownerId: string): CloseBehavior {
  return readOwnerSettings(database, ownerId).closeBehavior === 'exit' ? 'exit' : 'tray';
}

export function setCloseBehavior(
  database: DesktopDatabase,
  ownerId: string,
  behavior: CloseBehavior,
  now = new Date()
): CloseBehavior {
  if (behavior !== 'tray' && behavior !== 'exit') {
    throw new Error('Close behavior must be tray or exit.');
  }
  writeOwnerSettings(
    database,
    ownerId,
    { ...readOwnerSettings(database, ownerId), closeBehavior: behavior },
    now
  );
  return behavior;
}

export function reminderIntervalMinutes(database: DesktopDatabase, ownerId: string): number {
  const activeOccurrence = database
    .prepare(
      `SELECT reminder_occurrences.policy_snapshot_json AS policyJson
         FROM reminder_occurrences
         JOIN focus_sessions ON focus_sessions.id = reminder_occurrences.focus_session_id
        WHERE reminder_occurrences.owner_id = ?
          AND focus_sessions.status IN ('ACTIVE', 'PAUSED')
          AND reminder_occurrences.state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED')
        ORDER BY reminder_occurrences.scheduled_at
        LIMIT 1`
    )
    .get(ownerId) as { policyJson: string } | undefined;
  if (activeOccurrence) {
    return parseReminderPolicy(activeOccurrence.policyJson).intervalMinutes;
  }
  const configured = readOwnerSettings(database, ownerId).reminderIntervalMinutes;
  return typeof configured === 'number' &&
    Number.isInteger(configured) &&
    configured >= minimumReminderInterval &&
    configured <= maximumReminderInterval
    ? configured
    : defaultReminderPolicy.intervalMinutes;
}

export function setReminderInterval(
  database: DesktopDatabase,
  ownerId: string,
  deviceId: string,
  requestedMinutes: number,
  now = new Date()
): number {
  const intervalMinutes = validateInterval(requestedMinutes);
  const timestamp = now.toISOString();
  const policy = { ...defaultReminderPolicy, intervalMinutes };
  const policyJson = JSON.stringify(policy);

  database.transaction(() => {
    writeOwnerSettings(
      database,
      ownerId,
      { ...readOwnerSettings(database, ownerId), reminderIntervalMinutes: intervalMinutes },
      now
    );

    const mode = database
      .prepare(
        `SELECT id FROM focus_modes
          WHERE owner_id = ? AND name = 'Default focus' AND deleted_at IS NULL`
      )
      .get(ownerId) as { id: string } | undefined;
    if (mode) {
      database
        .prepare(
          `UPDATE focus_modes
              SET interval_minutes = ?, policy_json = ?, version = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(intervalMinutes, policyJson, ulid(), timestamp, mode.id);
    }

    const session = database
      .prepare(
        `SELECT id FROM focus_sessions
          WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED')
          ORDER BY started_at DESC LIMIT 1`
      )
      .get(ownerId) as { id: string } | undefined;
    if (!session) return;

    database
      .prepare(
        `UPDATE focus_sessions
            SET schedule_policy_json = ?, version = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(policyJson, ulid(), timestamp, session.id);

    const occurrence = database
      .prepare(
        `SELECT id, state FROM reminder_occurrences
          WHERE owner_id = ? AND focus_session_id = ?
            AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED')
          ORDER BY scheduled_at LIMIT 1`
      )
      .get(ownerId, session.id) as { id: string; state: string } | undefined;
    if (!occurrence) return;

    if (occurrence.state === 'DUE' || occurrence.state === 'PRESENTED') {
      database
        .prepare(
          `UPDATE reminder_occurrences
              SET policy_snapshot_json = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(policyJson, timestamp, occurrence.id);
      return;
    }

    transitionReminderOffline(database, {
      ownerId,
      deviceId,
      occurrenceId: occurrence.id,
      to: 'SUPERSEDED',
      occurredAt: timestamp,
      reason: 'reminder-interval-changed'
    });

    if (
      (
        database.prepare('SELECT status FROM focus_sessions WHERE id = ?').get(session.id) as {
          status: string;
        }
      ).status !== 'ACTIVE'
    ) {
      return;
    }

    const dueAt = new Date(now.getTime() + intervalMinutes * 60_000).toISOString();
    const occurrenceId = ulid();
    database
      .prepare(
        `INSERT INTO reminder_occurrences
          (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at,
           timezone_id, policy_snapshot_json, version, created_at, updated_at)
         SELECT ?, owner_id, id, 'SCHEDULED', ?, ?, timezone_id, ?, ?, ?, ?
           FROM focus_sessions WHERE id = ?`
      )
      .run(occurrenceId, dueAt, dueAt, policyJson, ulid(), timestamp, timestamp, session.id);
    queueReminderSchedule(database, {
      ownerId,
      deviceId,
      occurrenceId,
      occurredAt: timestamp
    });
  })();

  return intervalMinutes;
}
