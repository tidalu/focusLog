import {
  addReportDays,
  heatmapDays,
  localDayForInstant,
  reportDayBounds,
  type HeatmapDay
} from '@focuslog/shared-utils';

import type { DesktopDatabase } from '../database/database.js';

export type ReportSelection = { day: string; timezoneId: string };
export type TimelineEntry = {
  id: string;
  kind:
    'CHECK_IN' | 'REMINDER' | 'REMINDER_TRANSITION' | 'SESSION_START' | 'SESSION_END' | 'CONFLICT';
  occurredAt: string;
  title: string;
  detail: string;
  originalTimezoneId?: string;
};

export type DailyReport = {
  day: string;
  timezoneId: string;
  dayDurationMinutes: number;
  completedIntervals: number;
  missedIntervals: number;
  totalTrackedMinutes: number;
  focusScore: number;
  completionPercentage: number;
  averageResponseDelayMinutes: number;
  longestFocusStreak: number;
  mostCommonActivity: string | null;
  wordCloud: Array<{ word: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  occurrenceStates: Array<{ state: string; count: number }>;
  timeline: TimelineEntry[];
  trends: { weekly: number; monthly: number; yearly: number };
};

export type YearHeatmap = {
  year: number;
  timezoneId: string;
  metric: 'check-ins';
  metricDescription: string;
  thresholds: number[];
  days: HeatmapDay[];
};

type OccurrenceRow = {
  id: string;
  state: string;
  scheduledAt: string;
  resolvedAt: string | null;
  timezoneId: string;
};

const effectiveOccurrenceTime = (row: OccurrenceRow): string => row.resolvedAt ?? row.scheduledAt;
const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const ignoredWords = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'been',
  'being',
  'completed',
  'during',
  'focus',
  'from',
  'have',
  'into',
  'just',
  'that',
  'the',
  'their',
  'this',
  'was',
  'were',
  'what',
  'with'
]);

export class ReportingService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  daily(selection: ReportSelection): DailyReport {
    const bounds = reportDayBounds(selection.day, selection.timezoneId);
    const start = bounds.start.toISOString();
    const end = bounds.end.toISOString();
    const occurrences = this.database
      .prepare(
        `SELECT id, state, scheduled_at AS scheduledAt, resolved_at AS resolvedAt,
                timezone_id AS timezoneId
           FROM reminder_occurrences
          WHERE owner_id = ?
            AND COALESCE(resolved_at, scheduled_at) >= ?
            AND COALESCE(resolved_at, scheduled_at) < ?
          ORDER BY COALESCE(resolved_at, scheduled_at), id`
      )
      .all(this.ownerId, start, end) as OccurrenceRow[];
    const completedIntervals = occurrences.filter((item) => item.state === 'COMPLETED').length;
    const missedIntervals = occurrences.filter((item) => item.state === 'MISSED').length;
    const totalIntervals = completedIntervals + missedIntervals;
    const completionPercentage =
      totalIntervals === 0 ? 0 : Math.round((completedIntervals / totalIntervals) * 100);
    const completionDelays = occurrences
      .filter(
        (item): item is OccurrenceRow & { resolvedAt: string } =>
          item.state === 'COMPLETED' && Boolean(item.resolvedAt)
      )
      .map((item) =>
        Math.max(0, new Date(item.resolvedAt).getTime() - new Date(item.scheduledAt).getTime())
      );
    const averageResponseDelayMinutes =
      completionDelays.length === 0
        ? 0
        : Math.round(
            completionDelays.reduce((total, delay) => total + delay, 0) /
              completionDelays.length /
              60_000
          );
    let runningStreak = 0;
    let longestFocusStreak = 0;
    for (const occurrence of occurrences) {
      if (occurrence.state === 'COMPLETED') {
        runningStreak += 1;
        longestFocusStreak = Math.max(longestFocusStreak, runningStreak);
      } else if (['MISSED', 'SKIPPED', 'EMERGENCY_DISMISSED'].includes(occurrence.state)) {
        runningStreak = 0;
      }
    }

    const sessions = this.database
      .prepare(
        `SELECT id, name, started_at AS startedAt, ended_at AS endedAt,
                timezone_id AS timezoneId
           FROM focus_sessions
          WHERE owner_id = ? AND deleted_at IS NULL
            AND started_at < ? AND (ended_at IS NULL OR ended_at > ?)
          ORDER BY started_at`
      )
      .all(this.ownerId, end, start) as Array<{
      id: string;
      name: string | null;
      startedAt: string;
      endedAt: string | null;
      timezoneId: string;
    }>;
    const now = this.now().getTime();
    const totalTrackedMinutes = Math.round(
      sessions.reduce((total, session) => {
        const clippedStart = Math.max(
          bounds.start.getTime(),
          new Date(session.startedAt).getTime()
        );
        const naturalEnd = session.endedAt ? new Date(session.endedAt).getTime() : now;
        const clippedEnd = Math.min(bounds.end.getTime(), naturalEnd, now);
        return total + Math.max(0, clippedEnd - clippedStart) / 60_000;
      }, 0)
    );

    const checkIns = this.database
      .prepare(
        `SELECT check_ins.id, check_in_revisions.body,
                check_ins.submitted_at AS submittedAt,
                check_ins.timezone_id AS timezoneId,
                COALESCE(categories.name, 'Uncategorized') AS category
           FROM check_ins
           JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
           LEFT JOIN categories ON categories.id = check_ins.category_id
          WHERE check_ins.owner_id = ? AND check_ins.deleted_at IS NULL
            AND check_ins.submitted_at >= ? AND check_ins.submitted_at < ?
          ORDER BY check_ins.submitted_at, check_ins.id`
      )
      .all(this.ownerId, start, end) as Array<{
      id: string;
      body: string;
      submittedAt: string;
      timezoneId: string;
      category: string;
    }>;
    const categoryCounts = new Map<string, number>();
    const activityCounts = new Map<string, number>();
    const words = new Map<string, number>();
    for (const item of checkIns) {
      categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
      activityCounts.set(item.body, (activityCounts.get(item.body) ?? 0) + 1);
      for (const match of item.body.toLocaleLowerCase().match(wordPattern) ?? []) {
        if (match.length < 3 || ignoredWords.has(match)) continue;
        words.set(match, (words.get(match) ?? 0) + 1);
      }
    }
    const mostCommonActivity =
      Array.from(activityCounts).sort(
        ([leftText, leftCount], [rightText, rightCount]) =>
          rightCount - leftCount || leftText.localeCompare(rightText)
      )[0]?.[0] ?? null;
    const wordCloud = Array.from(words, ([word, count]) => ({ word, count }))
      .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word))
      .slice(0, 16);

    const timeline: TimelineEntry[] = checkIns.map((item) => ({
      id: item.id,
      kind: 'CHECK_IN',
      occurredAt: item.submittedAt,
      title: `Check-in · ${item.category}`,
      detail: item.body,
      originalTimezoneId: item.timezoneId
    }));
    timeline.push(
      ...occurrences.map((item) => ({
        id: item.id,
        kind: 'REMINDER' as const,
        occurredAt: effectiveOccurrenceTime(item),
        title: `Reminder ${item.state.toLowerCase().replaceAll('_', ' ')}`,
        detail: `Scheduled ${item.scheduledAt}`,
        originalTimezoneId: item.timezoneId
      }))
    );
    const transitions = this.database
      .prepare(
        `SELECT reminder_transitions.id, reminder_transitions.occurred_at AS occurredAt,
                reminder_transitions.from_state AS fromState,
                reminder_transitions.to_state AS toState,
                reminder_transitions.reason,
                reminder_occurrences.timezone_id AS timezoneId
           FROM reminder_transitions
           JOIN reminder_occurrences
             ON reminder_occurrences.id = reminder_transitions.reminder_occurrence_id
          WHERE reminder_transitions.owner_id = ?
            AND reminder_transitions.occurred_at >= ?
            AND reminder_transitions.occurred_at < ?`
      )
      .all(this.ownerId, start, end) as Array<{
      id: string;
      occurredAt: string;
      fromState: string;
      toState: string;
      reason: string | null;
      timezoneId: string;
    }>;
    timeline.push(
      ...transitions.map((item) => ({
        id: item.id,
        kind: 'REMINDER_TRANSITION' as const,
        occurredAt: item.occurredAt,
        title: `${item.fromState.toLowerCase()} → ${item.toState.toLowerCase()}`,
        detail: item.reason ?? 'Reminder state transition',
        originalTimezoneId: item.timezoneId
      }))
    );
    for (const session of sessions) {
      if (session.startedAt >= start && session.startedAt < end) {
        timeline.push({
          id: `${session.id}:start`,
          kind: 'SESSION_START',
          occurredAt: session.startedAt,
          title: 'Focus session started',
          detail: session.name ?? 'Focus session',
          originalTimezoneId: session.timezoneId
        });
      }
      if (session.endedAt && session.endedAt >= start && session.endedAt < end) {
        timeline.push({
          id: `${session.id}:end`,
          kind: 'SESSION_END',
          occurredAt: session.endedAt,
          title: 'Focus session ended',
          detail: session.name ?? 'Focus session',
          originalTimezoneId: session.timezoneId
        });
      }
    }
    const conflicts = this.database
      .prepare(
        `SELECT id, entity_type AS entityType, entity_id AS entityId,
                status, created_at AS createdAt
           FROM conflicts
          WHERE owner_id = ? AND created_at >= ? AND created_at < ?`
      )
      .all(this.ownerId, start, end) as Array<{
      id: string;
      entityType: string;
      entityId: string;
      status: string;
      createdAt: string;
    }>;
    timeline.push(
      ...conflicts.map((item) => ({
        id: item.id,
        kind: 'CONFLICT' as const,
        occurredAt: item.createdAt,
        title: `Synchronization conflict · ${item.status.toLowerCase()}`,
        detail: `${item.entityType} ${item.entityId}`
      }))
    );
    timeline.sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
    );

    const occurrenceStates = Array.from(
      occurrences.reduce<Map<string, number>>((counts, item) => {
        counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
        return counts;
      }, new Map())
    )
      .map(([state, count]) => ({ state, count }))
      .sort((left, right) => left.state.localeCompare(right.state));
    const trendCount = (days: number): number => {
      const trendStart = reportDayBounds(
        addReportDays(selection.day, -(days - 1)),
        bounds.timezoneId
      ).start.toISOString();
      return (
        this.database
          .prepare(
            `SELECT COUNT(*) AS count FROM check_ins
              WHERE owner_id = ? AND deleted_at IS NULL
                AND submitted_at >= ? AND submitted_at < ?`
          )
          .get(this.ownerId, trendStart, end) as { count: number }
      ).count;
    };
    return {
      day: bounds.day,
      timezoneId: bounds.timezoneId,
      dayDurationMinutes: bounds.durationMinutes,
      completedIntervals,
      missedIntervals,
      totalTrackedMinutes,
      focusScore: completionPercentage,
      completionPercentage,
      averageResponseDelayMinutes,
      longestFocusStreak,
      mostCommonActivity,
      wordCloud,
      categories: Array.from(categoryCounts, ([name, count]) => ({ name, count })).sort(
        (left, right) => right.count - left.count || left.name.localeCompare(right.name)
      ),
      occurrenceStates,
      timeline,
      trends: { weekly: trendCount(7), monthly: trendCount(30), yearly: trendCount(365) }
    };
  }

  heatmap(year: number, timezoneId: string): YearHeatmap {
    const first = reportDayBounds(`${year.toString().padStart(4, '0')}-01-01`, timezoneId);
    const next = reportDayBounds(`${(year + 1).toString().padStart(4, '0')}-01-01`, timezoneId, {
      latestYear: 10_000
    });
    const rows = this.database
      .prepare(
        `SELECT submitted_at AS submittedAt
           FROM check_ins
          WHERE owner_id = ? AND deleted_at IS NULL
            AND submitted_at >= ? AND submitted_at < ?
          ORDER BY submitted_at`
      )
      .all(this.ownerId, first.start.toISOString(), next.start.toISOString()) as Array<{
      submittedAt: string;
    }>;
    const values = new Map<string, number>();
    for (const row of rows) {
      const day = localDayForInstant(row.submittedAt, first.timezoneId);
      values.set(day, (values.get(day) ?? 0) + 1);
    }
    const result = heatmapDays(year, values);
    return {
      year,
      timezoneId: first.timezoneId,
      metric: 'check-ins',
      metricDescription:
        'Activity is the number of completed check-ins. Levels 1–4 use quartiles across active days in this year.',
      thresholds: result.thresholds,
      days: result.days
    };
  }
}
