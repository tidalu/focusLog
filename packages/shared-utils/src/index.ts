export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type ParsedJournalEntry = {
  category: string;
  text: string;
  hasCategoryToken: boolean;
};

export type ParsedLogSection = {
  categoryPath: string[];
  path: string;
  text: string;
  metadata: Record<string, string>;
  position: number;
};

export type ParsedJournalLog = {
  sections: ParsedLogSection[];
};

const categoryTokenPattern = /<([^<>\r\n]{1,80})>/gu;
const sectionHeaderPattern = /^[\t ]*((?:<[^<>\r\n]{1,80}>[\t ]*)+)(.*)$/gmu;
const metadataPattern = /^#([\p{L}\p{N}_.-]{1,80})\s*=\s*(.+)$/u;

export const normalizeJournalCategory = (value: string): string =>
  value
    .trim()
    .replace(/[\\/]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase();

function sectionContent(value: string): { text: string; metadata: Record<string, string> } {
  const metadata: Record<string, string> = {};
  const bodyLines: string[] = [];
  for (const line of value.trim().split(/\r?\n/u)) {
    const match = metadataPattern.exec(line.trim());
    if (match) metadata[(match[1] ?? '').toLocaleLowerCase()] = (match[2] ?? '').trim();
    else bodyLines.push(line);
  }
  return { text: bodyLines.join('\n').trim(), metadata };
}

export const parseJournalLog = (value: string): ParsedJournalLog => {
  const body = value.trim();
  if (!body) return { sections: [] };
  const headers = Array.from(body.matchAll(sectionHeaderPattern));
  if (!headers.length) {
    const content = sectionContent(body);
    return {
      sections: [
        {
          categoryPath: [],
          path: 'Uncategorized',
          ...content,
          position: 0
        }
      ]
    };
  }

  const sections: ParsedLogSection[] = [];
  const leading = body.slice(0, headers[0]?.index ?? 0).trim();
  if (leading) {
    sections.push({
      categoryPath: [],
      path: 'Uncategorized',
      ...sectionContent(leading),
      position: sections.length
    });
  }
  for (const [headerIndex, header] of headers.entries()) {
    const tokens = Array.from((header[1] ?? '').matchAll(categoryTokenPattern))
      .map((match) => normalizeJournalCategory(match[1] ?? ''))
      .filter(Boolean);
    const bodyStart = (header.index ?? 0) + header[0].length;
    const bodyEnd = headers[headerIndex + 1]?.index ?? body.length;
    const inline = (header[2] ?? '').trim();
    const following = body.slice(bodyStart, bodyEnd).trim();
    const content = sectionContent([inline, following].filter(Boolean).join('\n'));
    sections.push({
      categoryPath: tokens,
      path: tokens.length ? tokens.join('/') : 'Uncategorized',
      ...content,
      position: sections.length
    });
  }
  return { sections };
};

export const parseJournalEntry = (value: string): ParsedJournalEntry => {
  const parsed = parseJournalLog(value);
  const first = parsed.sections[0];
  if (!first) return { category: 'Uncategorized', text: '', hasCategoryToken: false };
  return {
    category: first.path,
    text: first.text,
    hasCategoryToken: first.categoryPath.length > 0
  };
};

import { Temporal } from '@js-temporal/polyfill';

export type ReportDayBounds = {
  day: string;
  timezoneId: string;
  start: Date;
  end: Date;
  durationMinutes: number;
};

export type HeatmapDay = {
  day: string;
  value: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export const validateTimeZone = (timezoneId: string): string => {
  const normalized = timezoneId.trim();
  if (!normalized || normalized.length > 100) throw new Error('Invalid report timezone.');
  try {
    Temporal.Now.instant().toZonedDateTimeISO(normalized);
  } catch {
    throw new Error('Invalid report timezone.');
  }
  return normalized;
};

export const reportDayBounds = (
  day: string,
  timezoneId: string,
  options: { earliestYear?: number; latestYear?: number } = {}
): ReportDayBounds => {
  const zone = validateTimeZone(timezoneId);
  let date: Temporal.PlainDate;
  try {
    date = Temporal.PlainDate.from(day, { overflow: 'reject' });
  } catch {
    throw new Error('Invalid report day.');
  }
  const earliestYear = options.earliestYear ?? 1970;
  const latestYear = options.latestYear ?? 9999;
  if (date.year < earliestYear || date.year > latestYear || date.toString() !== day) {
    throw new Error('Invalid report day.');
  }
  const startInstant = date.toZonedDateTime(zone).startOfDay().toInstant();
  const endInstant = date.add({ days: 1 }).toZonedDateTime(zone).startOfDay().toInstant();
  const start = new Date(startInstant.epochMilliseconds);
  const end = new Date(endInstant.epochMilliseconds);
  return {
    day,
    timezoneId: zone,
    start,
    end,
    durationMinutes: (end.getTime() - start.getTime()) / 60_000
  };
};

export const localDayForInstant = (instant: Date | string, timezoneId: string): string => {
  const milliseconds = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
  if (!Number.isFinite(milliseconds)) throw new Error('Invalid instant.');
  return Temporal.Instant.fromEpochMilliseconds(milliseconds)
    .toZonedDateTimeISO(validateTimeZone(timezoneId))
    .toPlainDate()
    .toString();
};

export const reportYearDays = (year: number): string[] => {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error('Invalid report year.');
  }
  const first = Temporal.PlainDate.from({ year, month: 1, day: 1 });
  return Array.from({ length: first.daysInYear }, (_, index) =>
    first.add({ days: index }).toString()
  );
};

export const addReportDays = (day: string, days: number): string => {
  if (!Number.isInteger(days)) throw new Error('Invalid day offset.');
  try {
    return Temporal.PlainDate.from(day, { overflow: 'reject' }).add({ days }).toString();
  } catch {
    throw new Error('Invalid report day.');
  }
};

export const heatmapDays = (
  year: number,
  values: ReadonlyMap<string, number> | Record<string, number>
): { days: HeatmapDay[]; thresholds: number[] } => {
  const valueFor = (day: string): number => {
    const raw = values instanceof Map ? values.get(day) : (values as Record<string, number>)[day];
    return Math.max(0, Math.floor(raw ?? 0));
  };
  const allDays = reportYearDays(year);
  const positive = allDays
    .map(valueFor)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const percentile = (fraction: number): number =>
    positive.length === 0
      ? 0
      : positive[Math.min(positive.length - 1, Math.ceil(positive.length * fraction) - 1)];
  const thresholds = [percentile(0.25), percentile(0.5), percentile(0.75)];
  const intensityFor = (value: number): 0 | 1 | 2 | 3 | 4 => {
    if (value === 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    return 4;
  };
  return {
    days: allDays.map((day) => {
      const value = valueFor(day);
      return { day, value, intensity: intensityFor(value) };
    }),
    thresholds
  };
};
