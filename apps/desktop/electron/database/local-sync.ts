import { ulid } from 'ulid';

import type { DesktopDatabase } from './database.js';

function nextDeviceSequence(database: DesktopDatabase, ownerId: string, deviceId: string): number {
  return (
    database
      .prepare(
        'SELECT COALESCE(MAX(device_sequence), 0) + 1 AS next FROM outbox_operations WHERE owner_id = ? AND device_id = ?'
      )
      .get(ownerId, deviceId) as { next: number }
  ).next;
}

export function queueSyncOperation(
  database: DesktopDatabase,
  input: {
    ownerId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    kind: string;
    baseVersion?: string;
    payload: Record<string, unknown>;
    occurredAt: string;
    operationId?: string;
  }
): string {
  const operationId = input.operationId ?? ulid();
  database
    .prepare(
      'INSERT INTO outbox_operations (operation_id, owner_id, device_id, device_sequence, entity_type, entity_id, kind, base_version, payload_json, occurred_at, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      operationId,
      input.ownerId,
      input.deviceId,
      nextDeviceSequence(database, input.ownerId, input.deviceId),
      input.entityType,
      input.entityId,
      input.kind,
      input.baseVersion ?? null,
      JSON.stringify(input.payload),
      input.occurredAt,
      input.occurredAt,
      input.occurredAt
    );
  return operationId;
}

export function createOfflineCheckIn(
  database: DesktopDatabase,
  input: {
    ownerId: string;
    deviceId: string;
    body: string;
    submittedAt?: string;
    timezoneId?: string;
    reminderOccurrenceId?: string;
    focusSessionId?: string;
    reminderCompletion?: boolean;
  }
): { checkInId: string; revisionId: string; operationId: string } {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const timezoneId = input.timezoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const checkInId = ulid();
  const revisionId = ulid();
  const operationId = ulid();
  database.transaction(() => {
    database
      .prepare(
        'INSERT INTO check_ins (id, owner_id, reminder_occurrence_id, focus_session_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        checkInId,
        input.ownerId,
        input.reminderOccurrenceId ?? null,
        input.focusSessionId ?? null,
        revisionId,
        submittedAt,
        timezoneId,
        revisionId,
        submittedAt,
        submittedAt
      );
    database
      .prepare(
        'INSERT INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(revisionId, checkInId, input.body.trim(), input.deviceId, operationId, submittedAt);
    queueSyncOperation(database, {
      ownerId: input.ownerId,
      deviceId: input.deviceId,
      entityType: 'check_in',
      entityId: checkInId,
      kind: 'check_in.create',
      payload: {
        revisionId,
        body: input.body.trim(),
        submittedAt,
        timezoneId,
        reminderCompletion: input.reminderCompletion ?? false,
        ...(input.reminderOccurrenceId ? { reminderOccurrenceId: input.reminderOccurrenceId } : {})
      },
      occurredAt: submittedAt,
      operationId
    });
  })();
  return { checkInId, revisionId, operationId };
}

export function reviseOfflineCheckIn(
  database: DesktopDatabase,
  input: { ownerId: string; deviceId: string; checkInId: string; body: string; createdAt?: string }
): { revisionId: string; operationId: string } {
  const current = database
    .prepare(
      'SELECT current_revision_id FROM check_ins WHERE id = ? AND owner_id = ? AND deleted_at IS NULL'
    )
    .get(input.checkInId, input.ownerId) as { current_revision_id: string } | undefined;
  if (!current) throw new Error('Check-in was not found.');
  const createdAt = input.createdAt ?? new Date().toISOString();
  const revisionId = ulid();
  const operationId = ulid();
  database.transaction(() => {
    database
      .prepare(
        'INSERT INTO check_in_revisions (id, check_in_id, parent_revision_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        revisionId,
        input.checkInId,
        current.current_revision_id,
        input.body.trim(),
        input.deviceId,
        operationId,
        createdAt
      );
    database
      .prepare(
        'UPDATE check_ins SET current_revision_id = ?, version = ?, updated_at = ? WHERE id = ?'
      )
      .run(revisionId, revisionId, createdAt, input.checkInId);
    queueSyncOperation(database, {
      ownerId: input.ownerId,
      deviceId: input.deviceId,
      entityType: 'check_in',
      entityId: input.checkInId,
      kind: 'check_in.revise',
      baseVersion: current.current_revision_id,
      payload: { revisionId, body: input.body.trim(), createdAt },
      occurredAt: createdAt,
      operationId
    });
  })();
  return { revisionId, operationId };
}

export function deleteOfflineCheckIn(
  database: DesktopDatabase,
  input: { ownerId: string; deviceId: string; checkInId: string; deletedAt?: string }
): string {
  const current = database
    .prepare(
      'SELECT current_revision_id FROM check_ins WHERE id = ? AND owner_id = ? AND deleted_at IS NULL'
    )
    .get(input.checkInId, input.ownerId) as { current_revision_id: string } | undefined;
  if (!current) throw new Error('Check-in was not found.');
  const deletedAt = input.deletedAt ?? new Date().toISOString();
  const operationId = ulid();
  database.transaction(() => {
    database
      .prepare('UPDATE check_ins SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(deletedAt, operationId, deletedAt, input.checkInId);
    database
      .prepare(
        'INSERT OR REPLACE INTO tombstones (id, owner_id, entity_type, entity_id, version, deleted_at, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        ulid(),
        input.ownerId,
        'check_in',
        input.checkInId,
        operationId,
        deletedAt,
        new Date(Date.parse(deletedAt) + 180 * 86_400_000).toISOString(),
        deletedAt
      );
    queueSyncOperation(database, {
      ownerId: input.ownerId,
      deviceId: input.deviceId,
      entityType: 'check_in',
      entityId: input.checkInId,
      kind: 'check_in.delete',
      baseVersion: current.current_revision_id,
      payload: { deletedAt },
      occurredAt: deletedAt,
      operationId
    });
  })();
  return operationId;
}
