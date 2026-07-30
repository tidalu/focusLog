import type { AnalysisPeriod } from './analysis-contracts.js';

export interface StatisticsRecord {
  id: string;
  ownerId: string;
  submittedAt: string;
  category?: string | null;
  project?: string | null;
  completed?: boolean;
  text?: string;
}
export interface AnalysisStatistics {
  schemaVersion: 1;
  unit: 'count';
  sourceRange: { startUtc: string; endUtc: string };
  checkInCount: number;
  completionCount: number;
  categoryDistribution: Array<{ name: string; count: number }>;
  projectDistribution: Array<{ name: string; count: number }>;
  timeOfDay: Array<{ hour: number; count: number }>;
  recurringDistractions: string[];
  activeProjects: string[];
  outlierIds: string[];
  previousPeriodDelta: number | null;
  dataCompleteness: { level: 'low' | 'medium' | 'high'; missingData: string[] };
}
const words = (value: string | undefined): string[] =>
  (value ?? '').toLowerCase().match(/[a-z][a-z-]{3,}/gu) ?? [];
const distribution = (values: Array<string | null | undefined>) =>
  [
    ...values
      .reduce((map, value) => {
        if (value?.trim()) map.set(value.trim(), (map.get(value.trim()) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  ]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/** Stable application-side statistics. Null deltas mean no comparable prior range was supplied. */
export function analysisStatistics(
  records: StatisticsRecord[],
  period: AnalysisPeriod,
  previousRecords?: StatisticsRecord[]
): AnalysisStatistics {
  const ordered = [...records].sort(
    (a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id)
  );
  const categories = distribution(ordered.map((record) => record.category));
  const projects = distribution(ordered.map((record) => record.project));
  const hours = new Map<number, number>();
  for (const record of ordered) {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: period.timezone,
        hour: '2-digit',
        hourCycle: 'h23'
      }).format(new Date(record.submittedAt))
    );
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const themes = new Map<string, number>();
  for (const record of ordered)
    for (const word of words(record.text)) themes.set(word, (themes.get(word) ?? 0) + 1);
  const recurringDistractions = [...themes.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word]) => word);
  const averageLength = ordered.length
    ? ordered.reduce((sum, record) => sum + (record.text?.length ?? 0), 0) / ordered.length
    : 0;
  const outlierIds = ordered
    .filter((record) => (record.text?.length ?? 0) > averageLength * 2 && averageLength > 0)
    .map((record) => record.id);
  const missingData = [
    ...new Set(
      ordered
        .flatMap((record) => [
          record.category ? null : 'category',
          record.project ? null : 'project',
          record.text?.trim() ? null : 'content'
        ])
        .filter((value): value is string => Boolean(value))
    )
  ].sort();
  return {
    schemaVersion: 1,
    unit: 'count',
    sourceRange: { startUtc: period.periodStartUtc, endUtc: period.periodEndUtc },
    checkInCount: ordered.length,
    completionCount: ordered.filter((record) => record.completed).length,
    categoryDistribution: categories,
    projectDistribution: projects,
    timeOfDay: [...hours.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    recurringDistractions,
    activeProjects: projects.slice(0, 8).map((item) => item.name),
    outlierIds,
    previousPeriodDelta:
      previousRecords === undefined ? null : ordered.length - previousRecords.length,
    dataCompleteness: {
      level: ordered.length === 0 ? 'low' : missingData.length ? 'medium' : 'high',
      missingData
    }
  };
}
