import { AIError } from './errors.js';
import {
  ANALYSIS_BOUNDARY_POLICY_VERSION,
  type AnalysisLevel,
  type AnalysisPeriod
} from './analysis-contracts.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
function date(value: string): string {
  if (!datePattern.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)))
    throw new AIError('VALIDATION', 'Choose a valid local analysis date.');
  return value;
}
export function analysisTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch {
    throw new AIError('VALIDATION', 'Choose a valid analysis timezone.');
  }
}
function offsetAt(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(instant)
    .reduce<Record<string, number>>((all, part) => {
      if (part.type !== 'literal') all[part.type] = Number(part.value);
      return all;
    }, {});
  return (
    Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) -
    instant.getTime()
  );
}
function midnightUtc(value: string, zone: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const expected = Date.UTC(year!, month! - 1, day!);
  let instant = expected;
  for (let index = 0; index < 3; index += 1) instant = expected - offsetAt(new Date(instant), zone);
  return new Date(instant).toISOString();
}
function plusDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}
function isoWeek(value: string): { year: number; week: number; monday: string } {
  const instant = new Date(`${value}T00:00:00.000Z`);
  const weekday = (instant.getUTCDay() + 6) % 7;
  const monday = plusDays(value, -weekday);
  const thursday = new Date(`${monday}T00:00:00.000Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstMonday = new Date(Date.UTC(weekYear, 0, 4 - ((firstThursday.getUTCDay() + 6) % 7)));
  return {
    year: weekYear,
    week:
      Math.floor((Date.parse(`${monday}T00:00:00.000Z`) - firstMonday.getTime()) / 604_800_000) + 1,
    monday
  };
}

/** Pure calendar/ISO-week period calculation; end boundaries are exclusive local midnights. */
export function analysisPeriod(
  level: AnalysisLevel,
  localAnchor: string,
  timezone: string
): AnalysisPeriod {
  const anchor = date(localAnchor);
  const zone = analysisTimeZone(timezone);
  const [year, month] = anchor.split('-').map(Number);
  let localStart: string;
  let localEnd: string;
  let periodId: string;
  if (level === 'daily') {
    localStart = anchor;
    localEnd = plusDays(anchor, 1);
    periodId = anchor;
  } else if (level === 'weekly') {
    const week = isoWeek(anchor);
    localStart = week.monday;
    localEnd = plusDays(localStart, 7);
    periodId = `${week.year}-W${String(week.week).padStart(2, '0')}`;
  } else if (level === 'monthly') {
    localStart = `${year}-${String(month).padStart(2, '0')}-01`;
    localEnd = new Date(Date.UTC(year!, month!, 1)).toISOString().slice(0, 10);
    periodId = localStart.slice(0, 7);
  } else if (level === 'quarterly') {
    const quarter = Math.floor((month! - 1) / 3) + 1;
    const startMonth = (quarter - 1) * 3 + 1;
    localStart = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    localEnd = new Date(Date.UTC(year!, startMonth + 2, 1)).toISOString().slice(0, 10);
    periodId = `${year}-Q${quarter}`;
  } else {
    localStart = `${year}-01-01`;
    localEnd = `${year! + 1}-01-01`;
    periodId = String(year);
  }
  return {
    level,
    timezone: zone,
    localStart,
    localEnd,
    periodId,
    periodStartUtc: midnightUtc(localStart, zone),
    periodEndUtc: midnightUtc(localEnd, zone),
    boundaryPolicyVersion: ANALYSIS_BOUNDARY_POLICY_VERSION
  };
}
