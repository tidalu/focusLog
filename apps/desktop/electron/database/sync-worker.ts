import { ulid } from 'ulid';

import type { DesktopDatabase } from './database.js';
import { materializeLogSections, type MaterializedLogSection } from './category-inference.js';
import { readOwnerSettings, writeOwnerSettings } from '../reminders/preferences.js';

interface PushResult {
  operationId: string;
  status: 'accepted' | 'duplicate' | 'conflict';
  conflictId?: string;
}

function remoteSections(payload: Record<string, unknown>): MaterializedLogSection[] | undefined {
  if (!Array.isArray(payload.sections)) return undefined;
  return payload.sections.filter(
    (section): section is MaterializedLogSection =>
      typeof section === 'object' &&
      section !== null &&
      typeof (section as Record<string, unknown>).id === 'string' &&
      Array.isArray((section as Record<string, unknown>).categoryPath) &&
      typeof (section as Record<string, unknown>).body === 'string' &&
      Number.isInteger((section as Record<string, unknown>).position)
  );
}

export interface SyncTransport {
  push(operations: unknown[]): Promise<{ results: PushResult[] }>;
  pull?(cursor: string): Promise<{
    changes: Array<Record<string, unknown>>;
    nextCursor: string;
  }>;
  acknowledge?(cursor: string): Promise<void>;
}

export async function drainOutbox(
  database: DesktopDatabase,
  transport: SyncTransport,
  now = new Date(),
  localDeviceId?: string
): Promise<number> {
  const operations = database
    .prepare(
      'SELECT * FROM outbox_operations WHERE acknowledged_at IS NULL AND next_attempt_at <= ? ORDER BY device_sequence LIMIT 100'
    )
    .all(now.toISOString()) as Record<string, unknown>[];
  let pushed = 0;

  if (operations.length) {
    try {
      const response = await transport.push(operations);
      database.transaction(() => {
        for (const result of response.results) {
          if (
            result.status === 'accepted' ||
            result.status === 'duplicate' ||
            result.status === 'conflict'
          ) {
            database
              .prepare('UPDATE outbox_operations SET acknowledged_at = ? WHERE operation_id = ?')
              .run(now.toISOString(), result.operationId);
            if (result.status === 'conflict' || result.conflictId)
              storePushConflict(database, result, operations, now);
          }
        }
      })();
      pushed = response.results.length;
    } catch (error) {
      schedulePushRetry(database, operations, now, error);
      return 0;
    }
  }

  if (transport.pull) {
    try {
      await pullRemoteChanges(
        database,
        transport as Required<Pick<SyncTransport, 'pull'>> & Pick<SyncTransport, 'acknowledge'>,
        now,
        localDeviceId
      );
    } catch (error) {
      console.warn('FocusLog synchronization pull failed; cursor was not advanced.', error);
      // The durable cursor is not advanced when pull/application fails. The
      // periodic worker safely retries the same stream page.
    }
  }
  return pushed;
}

function schedulePushRetry(
  database: DesktopDatabase,
  operations: Record<string, unknown>[],
  now: Date,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : 'Unknown synchronization failure';
  database.transaction(() => {
    for (const operation of operations) {
      const attempts = Number(operation.attempts) + 1;
      const retryAt = new Date(now.getTime() + Math.min(300_000, 1_000 * 2 ** attempts));
      database
        .prepare(
          'UPDATE outbox_operations SET attempts = ?, next_attempt_at = ? WHERE operation_id = ? AND acknowledged_at IS NULL'
        )
        .run(attempts, retryAt.toISOString(), operation.operation_id);
      database
        .prepare(
          'INSERT OR REPLACE INTO sync_failures (operation_id, code, message, recorded_at) VALUES (?, ?, ?, ?)'
        )
        .run(operation.operation_id, 'NETWORK_FAILURE', message, now.toISOString());
    }
  })();
}

function storePushConflict(
  database: DesktopDatabase,
  result: PushResult,
  operations: Record<string, unknown>[],
  now: Date
): void {
  const operation = operations.find((candidate) => candidate.operation_id === result.operationId);
  if (!operation) return;
  const local = currentCheckInSnapshot(database, String(operation.entity_id));
  database
    .prepare(
      'INSERT OR IGNORE INTO conflicts (id, owner_id, entity_type, entity_id, local_operation_id, remote_operation_id, local_payload_json, remote_payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      result.conflictId ?? result.operationId,
      operation.owner_id,
      operation.entity_type,
      operation.entity_id,
      operation.base_version ?? null,
      operation.operation_id,
      JSON.stringify(local),
      operation.payload_json,
      'OPEN',
      now.toISOString()
    );
}

async function pullRemoteChanges(
  database: DesktopDatabase,
  transport: Required<Pick<SyncTransport, 'pull'>> & Pick<SyncTransport, 'acknowledge'>,
  now: Date,
  localDeviceId?: string
): Promise<void> {
  const identity = localDeviceId
    ? (database
        .prepare("SELECT owner_id, id FROM devices WHERE id = ? AND status = 'ACTIVE'")
        .get(localDeviceId) as { owner_id: string; id: string } | undefined)
    : ((database
        .prepare(
          `SELECT owner_id, device_id AS id FROM outbox_operations
           ORDER BY device_sequence DESC LIMIT 1`
        )
        .get() ??
        database
          .prepare(
            "SELECT owner_id, id FROM devices WHERE status = 'ACTIVE' ORDER BY created_at LIMIT 1"
          )
          .get()) as { owner_id: string; id: string } | undefined);
  if (!identity) return;
  let cursor =
    (
      database
        .prepare(
          'SELECT last_applied_sequence FROM sync_cursors WHERE owner_id = ? AND device_id = ?'
        )
        .get(identity.owner_id, identity.id) as { last_applied_sequence?: number } | undefined
    )?.last_applied_sequence ?? 0;

  while (true) {
    const response = await transport.pull(String(cursor));
    if (response.changes.length === 0) break;
    database.transaction(() => {
      for (const change of response.changes) applyRemoteChange(database, identity, change, now);
      database
        .prepare(
          'INSERT INTO sync_cursors (owner_id, device_id, last_applied_sequence, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id, device_id) DO UPDATE SET last_applied_sequence = excluded.last_applied_sequence, updated_at = excluded.updated_at'
        )
        .run(identity.owner_id, identity.id, Number(response.nextCursor), now.toISOString());
    })();
    cursor = Number(response.nextCursor);
    if (transport.acknowledge) await transport.acknowledge(String(cursor));
    if (response.changes.length < 100) break;
  }
}

function applyRemoteChange(
  database: DesktopDatabase,
  identity: { owner_id: string; id: string },
  change: Record<string, unknown>,
  now: Date
): void {
  const operationId = String(change.operationId);
  if (database.prepare('SELECT 1 FROM sync_operations WHERE operation_id = ?').get(operationId))
    return;
  const sourceDevice = change.sourceDevice as Record<string, unknown>;
  database
    .prepare(
      'INSERT INTO devices (id, owner_id, public_key, fingerprint, platform, display_name, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at'
    )
    .run(
      sourceDevice.id,
      identity.owner_id,
      sourceDevice.publicKey,
      sourceDevice.fingerprint,
      String(sourceDevice.platform).toLowerCase(),
      sourceDevice.displayName ?? null,
      sourceDevice.isOwnerDevice ? 1 : 0,
      sourceDevice.status,
      sourceDevice.createdAt,
      sourceDevice.updatedAt
    );

  const payload = change.payload as Record<string, unknown>;
  if (change.status === 'CONFLICT') {
    storePulledConflict(database, identity.owner_id, change, payload, now);
  } else if (String(change.deviceId) === identity.id) {
    // The originating transaction already materialized this operation locally.
  } else if (change.kind === 'check_in.create') {
    applyCheckInCreate(database, identity.owner_id, change, payload, now);
  } else if (change.kind === 'check_in.revise') {
    applyCheckInRevision(database, identity.owner_id, change, payload, now);
  } else if (change.kind === 'check_in.delete') {
    applyCheckInDeletion(database, identity.owner_id, change, payload, now);
  } else if (change.kind === 'reminder.schedule') {
    applyReminderSchedule(database, identity.owner_id, change, payload, now);
  } else if (change.kind === 'reminder.transition') {
    applyReminderTransition(database, identity.owner_id, change, payload, now);
  } else if (change.kind === 'reminder.complete') {
    applyReminderCompletion(database, identity.owner_id, change, payload, now);
  }

  database
    .prepare(
      'INSERT INTO sync_operations (operation_id, owner_id, device_id, device_sequence, entity_type, entity_id, kind, base_version, payload_json, occurred_at, received_at, status, result_json, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      operationId,
      identity.owner_id,
      change.deviceId,
      Number(change.deviceSequence),
      change.entityType,
      change.entityId,
      change.kind,
      change.baseVersion ?? null,
      JSON.stringify(payload),
      change.occurredAt,
      now.toISOString(),
      change.status,
      change.result == null ? null : JSON.stringify(change.result),
      Number(change.sequence)
    );
}

function applyReminderSchedule(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  const entityId = String(change.entityId);
  if (
    database
      .prepare('SELECT 1 FROM reminder_occurrences WHERE id = ? AND owner_id = ?')
      .get(entityId, ownerId)
  )
    return;
  const mode = payload.mode as Record<string, unknown>;
  const session = payload.session as Record<string, unknown>;
  const occurrence = payload.occurrence as Record<string, unknown>;
  const existingMode = database
    .prepare('SELECT id FROM focus_modes WHERE owner_id = ? AND name = ?')
    .get(ownerId, mode.name) as { id: string } | undefined;
  const modeId = existingMode?.id ?? String(mode.id);
  if (!existingMode)
    database
      .prepare(
        'INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        modeId,
        ownerId,
        mode.name,
        mode.intervalMinutes,
        JSON.stringify(mode.policy),
        mode.version,
        session.startedAt,
        now.toISOString()
      );
  else
    database
      .prepare(
        `UPDATE focus_modes
            SET interval_minutes = ?, policy_json = ?, version = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(
        mode.intervalMinutes,
        JSON.stringify(mode.policy),
        mode.version,
        now.toISOString(),
        modeId
      );
  writeOwnerSettings(
    database,
    ownerId,
    {
      ...readOwnerSettings(database, ownerId),
      reminderIntervalMinutes: Number(mode.intervalMinutes)
    },
    now
  );
  database
    .prepare(
      "INSERT OR IGNORE INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)"
    )
    .run(
      session.id,
      ownerId,
      modeId,
      session.name ?? null,
      JSON.stringify(session.schedulePolicy),
      session.timezoneId,
      session.startedAt,
      session.version,
      session.startedAt,
      now.toISOString()
    );
  database
    .prepare(
      "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      entityId,
      ownerId,
      session.id,
      occurrence.scheduledAt,
      occurrence.originalScheduledAt,
      occurrence.timezoneId,
      JSON.stringify(occurrence.policySnapshot),
      occurrence.version,
      change.occurredAt,
      now.toISOString()
    );
}

function applyReminderTransition(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  const entityId = String(change.entityId);
  const current = database
    .prepare(
      'SELECT state, original_scheduled_at, version FROM reminder_occurrences WHERE id = ? AND owner_id = ?'
    )
    .get(entityId, ownerId) as
    { state: string; original_scheduled_at: string; version: string } | undefined;
  if (!current) {
    storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  if (current.state === payload.toState) return;
  const terminal = ['COMPLETED', 'MISSED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'SUPERSEDED'];
  if (terminal.includes(current.state)) {
    storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  const occurredAt = String(payload.occurredAt);
  database
    .prepare(
      `UPDATE reminder_occurrences SET state = ?, scheduled_at = COALESCE(?, scheduled_at),
       presented_at = CASE WHEN ? = 'PRESENTED' THEN ? ELSE presented_at END,
       resolved_at = CASE WHEN ? IN ('COMPLETED','MISSED','SKIPPED','EMERGENCY_DISMISSED','SUPERSEDED') THEN ? ELSE resolved_at END,
       version = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      payload.toState,
      payload.effectiveDueAt ?? null,
      payload.toState,
      occurredAt,
      payload.toState,
      occurredAt,
      change.operationId,
      now.toISOString(),
      entityId
    );
  database
    .prepare(
      'INSERT OR IGNORE INTO reminder_transitions (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state, reason, original_scheduled_at, occurred_at, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      payload.transitionId,
      ownerId,
      entityId,
      change.deviceId,
      current.state,
      payload.toState,
      payload.reason ?? null,
      current.original_scheduled_at,
      occurredAt,
      change.operationId,
      now.toISOString()
    );
}

function applyReminderCompletion(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  applyReminderTransition(
    database,
    ownerId,
    change,
    {
      transitionId: payload.transitionId,
      toState: 'COMPLETED',
      occurredAt: payload.completedAt
    },
    now
  );
  const existing = database
    .prepare('SELECT id FROM check_ins WHERE reminder_occurrence_id = ?')
    .get(change.entityId) as { id: string } | undefined;
  if (existing) {
    if (existing.id !== payload.checkInId)
      storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  const occurrence = database
    .prepare(
      'SELECT focus_session_id, timezone_id, state FROM reminder_occurrences WHERE id = ? AND owner_id = ?'
    )
    .get(change.entityId, ownerId) as
    { focus_session_id: string; timezone_id: string; state: string } | undefined;
  if (!occurrence) return;
  if (occurrence.state !== 'COMPLETED')
    database
      .prepare(
        "UPDATE reminder_occurrences SET state = 'COMPLETED', resolved_at = ?, version = ?, updated_at = ? WHERE id = ?"
      )
      .run(payload.completedAt, change.operationId, now.toISOString(), change.entityId);
  database
    .prepare(
      'INSERT INTO check_ins (id, owner_id, reminder_occurrence_id, focus_session_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      payload.checkInId,
      ownerId,
      change.entityId,
      occurrence.focus_session_id,
      payload.revisionId,
      payload.completedAt,
      occurrence.timezone_id,
      payload.revisionId,
      payload.completedAt,
      now.toISOString()
    );
  database
    .prepare(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      payload.revisionId,
      payload.checkInId,
      payload.body,
      change.deviceId,
      change.operationId,
      payload.completedAt
    );
  materializeLogSections(database, {
    ownerId,
    checkInId: String(payload.checkInId),
    revisionId: String(payload.revisionId),
    body: String(payload.body),
    occurredAt: String(payload.completedAt),
    timezoneId: occurrence.timezone_id,
    sections: remoteSections(payload)
  });
}

function applyCheckInCreate(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  const entityId = String(change.entityId);
  if (
    database
      .prepare('SELECT 1 FROM tombstones WHERE owner_id = ? AND entity_type = ? AND entity_id = ?')
      .get(ownerId, 'check_in', entityId)
  )
    return;
  const current = database
    .prepare('SELECT current_revision_id FROM check_ins WHERE id = ? AND owner_id = ?')
    .get(entityId, ownerId) as { current_revision_id: string } | undefined;
  if (current) {
    if (current.current_revision_id !== payload.revisionId)
      storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  database
    .prepare(
      'INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      entityId,
      ownerId,
      payload.revisionId,
      payload.submittedAt,
      payload.timezoneId,
      payload.revisionId,
      payload.submittedAt,
      now.toISOString()
    );
  database
    .prepare(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      payload.revisionId,
      entityId,
      payload.body,
      change.deviceId,
      change.operationId,
      payload.submittedAt
    );
  materializeLogSections(database, {
    ownerId,
    checkInId: entityId,
    revisionId: String(payload.revisionId),
    body: String(payload.body),
    occurredAt: String(payload.submittedAt),
    timezoneId: String(payload.timezoneId),
    sections: remoteSections(payload)
  });
}

function applyCheckInRevision(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  const entityId = String(change.entityId);
  const current = database
    .prepare(
      'SELECT current_revision_id, deleted_at, timezone_id, submitted_at FROM check_ins WHERE id = ? AND owner_id = ?'
    )
    .get(entityId, ownerId) as
    | {
        current_revision_id: string;
        deleted_at: string | null;
        timezone_id: string;
        submitted_at: string;
      }
    | undefined;
  if (!current || current.deleted_at) {
    storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  if (current.current_revision_id === payload.revisionId) return;
  if (current.current_revision_id !== change.baseVersion) {
    storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  database
    .prepare(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, parent_revision_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      payload.revisionId,
      entityId,
      change.baseVersion,
      payload.body,
      change.deviceId,
      change.operationId,
      payload.createdAt
    );
  database
    .prepare(
      'UPDATE check_ins SET current_revision_id = ?, version = ?, updated_at = ? WHERE id = ?'
    )
    .run(payload.revisionId, payload.revisionId, now.toISOString(), entityId);
  materializeLogSections(database, {
    ownerId,
    checkInId: entityId,
    revisionId: String(payload.revisionId),
    body: String(payload.body),
    occurredAt: current.submitted_at,
    timezoneId: current.timezone_id,
    sections: remoteSections(payload)
  });
}

function applyCheckInDeletion(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  payload: Record<string, unknown>,
  now: Date
): void {
  const entityId = String(change.entityId);
  const current = database
    .prepare('SELECT current_revision_id, deleted_at FROM check_ins WHERE id = ? AND owner_id = ?')
    .get(entityId, ownerId) as
    { current_revision_id: string; deleted_at: string | null } | undefined;
  if (!current || (!current.deleted_at && current.current_revision_id !== change.baseVersion)) {
    storePulledConflict(database, ownerId, change, payload, now);
    return;
  }
  database
    .prepare('UPDATE check_ins SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ?')
    .run(payload.deletedAt, change.operationId, now.toISOString(), entityId);
  database
    .prepare(
      'INSERT OR REPLACE INTO tombstones (id, owner_id, entity_type, entity_id, version, deleted_at, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      ulid(),
      ownerId,
      'check_in',
      entityId,
      change.operationId,
      payload.deletedAt,
      new Date(Date.parse(String(payload.deletedAt)) + 180 * 86_400_000).toISOString(),
      now.toISOString()
    );
}

function storePulledConflict(
  database: DesktopDatabase,
  ownerId: string,
  change: Record<string, unknown>,
  remotePayload: Record<string, unknown>,
  now: Date
): void {
  const result = change.result as { conflictId?: string } | null;
  database
    .prepare(
      'INSERT OR IGNORE INTO conflicts (id, owner_id, entity_type, entity_id, local_operation_id, remote_operation_id, local_payload_json, remote_payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      result?.conflictId ?? String(change.operationId),
      ownerId,
      change.entityType,
      change.entityId,
      change.baseVersion ?? null,
      change.operationId,
      JSON.stringify(currentCheckInSnapshot(database, String(change.entityId))),
      JSON.stringify(remotePayload),
      'OPEN',
      now.toISOString()
    );
}

function currentCheckInSnapshot(
  database: DesktopDatabase,
  checkInId: string
): Record<string, unknown> | null {
  const row = database
    .prepare(
      'SELECT check_ins.current_revision_id AS revisionId, check_ins.deleted_at AS deletedAt, check_in_revisions.body, check_in_revisions.created_at AS createdAt FROM check_ins LEFT JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id WHERE check_ins.id = ?'
    )
    .get(checkInId) as Record<string, unknown> | undefined;
  return row ?? null;
}
