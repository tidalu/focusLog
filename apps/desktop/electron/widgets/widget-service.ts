import { localDayForInstant } from '@focuslog/shared-utils';

import type { DesktopDatabase } from '../database/database.js';
import type { ReportingService } from '../reporting/reporting-service.js';

export const widgetSnapshotSchemaVersion = 1;

export type WidgetMode = 'minimal' | 'productivity' | 'insight';
export type WidgetPrivacy = 'hidden' | 'redacted' | 'full';

export type WidgetSettings = {
  enabled: boolean;
  mode: WidgetMode;
  privacy: WidgetPrivacy;
  alwaysOnTop: boolean;
  width: number;
  height: number;
  x?: number;
  y?: number;
};

export type WidgetSnapshot = {
  schemaVersion: number;
  profileId: string;
  createdAt: string;
  dataFreshnessAt: string;
  localDate: string;
  timezoneId: string;
  dailyCompletionPercentage: number;
  logsToday: number;
  focusDurationMinutes: number;
  focusScore: number | null;
  activeSession: { name: string; status: 'ACTIVE' | 'PAUSED'; startedAt: string } | null;
  timeSinceLastLogMinutes: number | null;
  nextReminderAt: string | null;
  timeUntilNextReminderMinutes: number | null;
  currentActivity: string | null;
  latestInsight: { content: string; createdAt: string; stale: boolean } | null;
  offline: boolean;
  pendingSync: boolean;
  privacy: WidgetPrivacy;
};

export const defaultWidgetSettings: WidgetSettings = {
  enabled: false,
  mode: 'minimal',
  privacy: 'hidden',
  alwaysOnTop: false,
  width: 340,
  height: 238
};

function validMode(value: unknown): value is WidgetMode {
  return value === 'minimal' || value === 'productivity' || value === 'insight';
}

function validPrivacy(value: unknown): value is WidgetPrivacy {
  return value === 'hidden' || value === 'redacted' || value === 'full';
}

export function readWidgetSettings(values: Record<string, unknown>): WidgetSettings {
  const source = values.widget;
  if (!source || typeof source !== 'object') return { ...defaultWidgetSettings };
  const candidate = source as Partial<WidgetSettings>;
  return {
    enabled:
      typeof candidate.enabled === 'boolean' ? candidate.enabled : defaultWidgetSettings.enabled,
    mode: validMode(candidate.mode) ? candidate.mode : defaultWidgetSettings.mode,
    privacy: validPrivacy(candidate.privacy) ? candidate.privacy : defaultWidgetSettings.privacy,
    alwaysOnTop:
      typeof candidate.alwaysOnTop === 'boolean'
        ? candidate.alwaysOnTop
        : defaultWidgetSettings.alwaysOnTop,
    width:
      typeof candidate.width === 'number' && candidate.width >= 260 && candidate.width <= 800
        ? Math.round(candidate.width)
        : defaultWidgetSettings.width,
    height:
      typeof candidate.height === 'number' && candidate.height >= 160 && candidate.height <= 700
        ? Math.round(candidate.height)
        : defaultWidgetSettings.height,
    ...(typeof candidate.x === 'number' ? { x: Math.round(candidate.x) } : {}),
    ...(typeof candidate.y === 'number' ? { y: Math.round(candidate.y) } : {})
  };
}

export function updateWidgetSettings(
  values: Record<string, unknown>,
  patch: Partial<WidgetSettings>
): WidgetSettings {
  const current = readWidgetSettings(values);
  const next = readWidgetSettings({ widget: { ...current, ...patch } });
  values.widget = next;
  return next;
}

function redactInsight(content: string): string {
  const sentence =
    content
      .replace(/\s+/gu, ' ')
      .trim()
      .split(/(?<=[.!?])\s/u)[0] ?? '';
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
}

export class WidgetService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly reporting: ReportingService,
    private readonly offline: () => boolean
  ) {}

  snapshot(settings: WidgetSettings): WidgetSnapshot {
    const now = new Date();
    const timezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const localDate = localDayForInstant(now, timezoneId);
    const report = this.reporting.daily({ day: localDate, timezoneId });
    const activeSession = this.database
      .prepare(
        `SELECT COALESCE(name, 'Focus session') AS name, status, started_at AS startedAt
           FROM focus_sessions WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED')
           ORDER BY started_at DESC LIMIT 1`
      )
      .get(this.ownerId) as
      { name: string; status: 'ACTIVE' | 'PAUSED'; startedAt: string } | undefined;
    const nextReminder = this.database
      .prepare(
        `SELECT scheduled_at AS dueAt FROM reminder_occurrences WHERE owner_id = ?
          AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED') ORDER BY scheduled_at LIMIT 1`
      )
      .get(this.ownerId) as { dueAt: string } | undefined;
    const lastCheckIn = this.database
      .prepare(
        `SELECT check_in_revisions.body AS body, check_ins.submitted_at AS submittedAt
           FROM check_ins JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
          WHERE check_ins.owner_id = ? AND check_ins.deleted_at IS NULL
          ORDER BY check_ins.submitted_at DESC LIMIT 1`
      )
      .get(this.ownerId) as { body: string; submittedAt: string } | undefined;
    const memory = this.database
      .prepare(
        `SELECT content, created_at AS createdAt FROM ai_memories
          WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ? AND status = 'ACTIVE'
          ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, localDate) as { content: string; createdAt: string } | undefined;
    const queued = (
      this.database
        .prepare(
          'SELECT COUNT(*) AS count FROM outbox_operations WHERE owner_id = ? AND acknowledged_at IS NULL'
        )
        .get(this.ownerId) as { count: number }
    ).count;
    const minutesUntil = nextReminder
      ? Math.max(0, Math.ceil((new Date(nextReminder.dueAt).getTime() - now.getTime()) / 60_000))
      : null;
    const insight =
      settings.privacy === 'hidden' || !memory
        ? null
        : {
            content:
              settings.privacy === 'redacted' ? redactInsight(memory.content) : memory.content,
            createdAt: memory.createdAt,
            stale: memory.createdAt.slice(0, 10) !== localDate
          };
    return {
      schemaVersion: widgetSnapshotSchemaVersion,
      profileId: this.ownerId,
      createdAt: now.toISOString(),
      dataFreshnessAt: now.toISOString(),
      localDate,
      timezoneId,
      dailyCompletionPercentage: report.completionPercentage,
      logsToday: report.entryCount,
      focusDurationMinutes: report.totalTrackedMinutes,
      focusScore: report.focusScore,
      activeSession: activeSession ?? null,
      timeSinceLastLogMinutes: lastCheckIn
        ? Math.max(
            0,
            Math.floor((now.getTime() - new Date(lastCheckIn.submittedAt).getTime()) / 60_000)
          )
        : null,
      nextReminderAt: nextReminder?.dueAt ?? null,
      timeUntilNextReminderMinutes: minutesUntil,
      currentActivity: lastCheckIn?.body.replace(/<[^>]+>/gu, '').trim() || null,
      latestInsight: insight,
      offline: this.offline(),
      pendingSync: queued > 0,
      privacy: settings.privacy
    };
  }
}
