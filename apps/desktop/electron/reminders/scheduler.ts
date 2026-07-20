import { performance } from 'node:perf_hooks';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import {
  completeReminderOffline,
  queueReminderSchedule,
  transitionReminderOffline
} from './operations.js';
import { parseReminderPolicy } from './policy.js';
import type { ReminderState } from './state.js';

interface PendingOccurrence {
  id: string;
  state: ReminderState;
  scheduled_at: string;
  original_scheduled_at: string;
  policy_snapshot_json: string;
}

const terminalStates = new Set<ReminderState>([
  'COMPLETED',
  'MISSED',
  'SKIPPED',
  'EMERGENCY_DISMISSED',
  'SUPERSEDED'
]);

/**
 * Durable reminder scheduler. SQLite is the source of truth; the timer is only
 * a wake-up hint. Every start, resume, and detected wall-clock jump replays due
 * records from storage.
 */
export class ReminderScheduler {
  private timer: NodeJS.Timeout | undefined;
  private lastWallClock = Date.now();
  private lastMonotonic = performance.now();
  private runningTick = false;

  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly deviceId: string,
    private readonly onDue: (occurrenceId: string) => void,
    private readonly clock: () => Date = () => new Date()
  ) {}

  start(): void {
    this.recover('restart');
    this.timer = setInterval(() => this.tick(), 15_000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  recover(
    reason: 'restart' | 'resume' | 'unlock' | 'clock-change' = 'restart',
    now = this.clock()
  ): void {
    this.tick(now, reason);
  }

  tick(now = this.clock(), recoveryReason?: string): void {
    if (this.runningTick) return;
    this.runningTick = true;
    try {
      const wallElapsed = now.getTime() - this.lastWallClock;
      const monotonicElapsed = performance.now() - this.lastMonotonic;
      if (!recoveryReason && Math.abs(wallElapsed - monotonicElapsed) > 60_000)
        recoveryReason = 'clock-change';
      this.lastWallClock = now.getTime();
      this.lastMonotonic = performance.now();

      const pending = this.database
        .prepare(
          `SELECT id, state, scheduled_at, original_scheduled_at, policy_snapshot_json
           FROM reminder_occurrences
           WHERE owner_id = ?
             AND ((state IN ('SCHEDULED','SNOOZED') AND scheduled_at <= ?)
                  OR state IN ('DUE','PRESENTED'))
           ORDER BY scheduled_at`
        )
        .all(this.ownerId, now.toISOString()) as PendingOccurrence[];

      const actionable: PendingOccurrence[] = [];
      for (const occurrence of pending) {
        const policy = parseReminderPolicy(occurrence.policy_snapshot_json);
        const expiresAt =
          Date.parse(occurrence.scheduled_at) + policy.responseWindowMinutes * 60_000;
        if (
          now.getTime() > expiresAt &&
          (occurrence.state === 'SCHEDULED' ||
            occurrence.state === 'SNOOZED' ||
            !policy.allowLateCompletion)
        ) {
          if (occurrence.state === 'SCHEDULED' || occurrence.state === 'SNOOZED')
            transitionReminderOffline(this.database, {
              ownerId: this.ownerId,
              deviceId: this.deviceId,
              occurrenceId: occurrence.id,
              to: 'DUE',
              occurredAt: now.toISOString(),
              reason: recoveryReason
                ? `recovery:${recoveryReason}:overdue`
                : 'scheduled-time-reached'
            });
          transitionReminderOffline(this.database, {
            ownerId: this.ownerId,
            deviceId: this.deviceId,
            occurrenceId: occurrence.id,
            to: 'MISSED',
            occurredAt: now.toISOString(),
            reason: recoveryReason
              ? `recovery:${recoveryReason}:response-window-expired`
              : 'response-window-expired'
          });
          this.ensureNextOccurrence(occurrence.id, now);
          continue;
        }
        if (occurrence.state === 'SCHEDULED' || occurrence.state === 'SNOOZED') {
          transitionReminderOffline(this.database, {
            ownerId: this.ownerId,
            deviceId: this.deviceId,
            occurrenceId: occurrence.id,
            to: 'DUE',
            occurredAt: now.toISOString(),
            reason: recoveryReason ? `recovery:${recoveryReason}` : 'scheduled-time-reached'
          });
          actionable.push({ ...occurrence, state: 'DUE' });
        } else actionable.push(occurrence);
      }

      // Recovery must not create an overlay storm. Present the oldest unresolved
      // occurrence; later occurrences remain durably DUE and follow it.
      if (actionable[0]) this.onDue(actionable[0].id);
    } finally {
      this.runningTick = false;
    }
  }

  snooze(id: string, minutes: number): void {
    const row = this.row(id);
    const policy = parseReminderPolicy(row.policy_snapshot_json);
    if (!policy.snoozeMinutes.includes(minutes))
      throw new Error('That snooze duration is not allowed.');
    const snoozeCount = (
      this.database
        .prepare(
          "SELECT COUNT(*) AS count FROM reminder_transitions WHERE reminder_occurrence_id = ? AND to_state = 'SNOOZED'"
        )
        .get(id) as { count: number }
    ).count;
    if (snoozeCount >= policy.maxSnoozes) throw new Error('The snooze limit has been reached.');
    const now = this.clock();
    transitionReminderOffline(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId: id,
      to: 'SNOOZED',
      occurredAt: now.toISOString(),
      effectiveDueAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
      reason: `snoozed:${minutes}m`
    });
  }

  present(id: string): void {
    if (this.state(id) !== 'DUE') return;
    transitionReminderOffline(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId: id,
      to: 'PRESENTED',
      occurredAt: this.clock().toISOString(),
      reason: 'desktop-overlay'
    });
  }

  complete(id: string, text: string): void {
    const now = this.clock();
    completeReminderOffline(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId: id,
      text,
      occurredAt: now.toISOString()
    });
    this.ensureNextOccurrence(id, now);
    this.tick(now);
  }

  emergencyDismiss(id: string): void {
    const now = this.clock();
    transitionReminderOffline(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId: id,
      to: 'EMERGENCY_DISMISSED',
      occurredAt: now.toISOString(),
      reason: 'explicit-emergency-dismissal'
    });
    this.ensureNextOccurrence(id, now);
    this.tick(now);
  }

  markMissed(id: string): void {
    const now = this.clock();
    transitionReminderOffline(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId: id,
      to: 'MISSED',
      occurredAt: now.toISOString(),
      reason: 'response-window-expired'
    });
    this.ensureNextOccurrence(id, now);
  }

  private row(id: string): PendingOccurrence {
    const row = this.database
      .prepare(
        'SELECT id, state, scheduled_at, original_scheduled_at, policy_snapshot_json FROM reminder_occurrences WHERE id = ? AND owner_id = ?'
      )
      .get(id, this.ownerId) as PendingOccurrence | undefined;
    if (!row) throw new Error('Reminder occurrence not found.');
    return row;
  }

  private state(id: string): ReminderState {
    return this.row(id).state;
  }

  private ensureNextOccurrence(resolvedId: string, now: Date): void {
    const source = this.database
      .prepare(
        `SELECT ro.*, fs.status AS session_status, fs.started_at
         FROM reminder_occurrences ro
         JOIN focus_sessions fs ON fs.id = ro.focus_session_id
         WHERE ro.id = ? AND ro.owner_id = ?`
      )
      .get(resolvedId, this.ownerId) as (Record<string, unknown> & PendingOccurrence) | undefined;
    if (!source || source.session_status !== 'ACTIVE' || !terminalStates.has(source.state)) return;
    const existing = this.database
      .prepare(
        "SELECT id FROM reminder_occurrences WHERE focus_session_id = ? AND state IN ('SCHEDULED','DUE','PRESENTED','SNOOZED') LIMIT 1"
      )
      .get(source.focus_session_id) as { id: string } | undefined;
    if (existing) return;

    const policy = parseReminderPolicy(source.policy_snapshot_json);
    const interval = policy.intervalMinutes * 60_000;
    const anchor = Date.parse(String(source.started_at));
    const nextIndex = Math.max(1, Math.floor((now.getTime() - anchor) / interval) + 1);
    const dueAt = new Date(anchor + nextIndex * interval).toISOString();
    const occurrenceId = ulid();
    const version = ulid();
    const createdAt = now.toISOString();
    this.database
      .prepare(
        `INSERT INTO reminder_occurrences
         (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at,
          timezone_id, policy_snapshot_json, version, created_at, updated_at)
         VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        occurrenceId,
        this.ownerId,
        source.focus_session_id,
        dueAt,
        dueAt,
        source.timezone_id,
        source.policy_snapshot_json,
        version,
        createdAt,
        createdAt
      );
    queueReminderSchedule(this.database, {
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      occurrenceId,
      occurredAt: createdAt
    });
  }
}
