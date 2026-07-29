import { parseJournalEntry } from '@focuslog/shared-utils';
import type { CSSProperties } from 'react';

export type HistoryItem = Awaited<ReturnType<Window['focuslog']['history']>>[number];
export type Report = Awaited<ReturnType<Window['focuslog']['report']>>;
export type TimelineItem = Report['timeline'][number];

export const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function localDay(instant = new Date(), timezoneId = systemTimezone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function categoryTone(category: string): number {
  const semanticTones: Record<string, number> = {
    study: 1,
    reading: 1,
    work: 3,
    startup: 3,
    sleep: 2,
    gym: 10,
    exercise: 10,
    food: 7,
    lunch: 7,
    dinner: 7,
    youtube: 5,
    entertainment: 5,
    break: 11
  };
  const normalized = category.toLocaleLowerCase();
  if (semanticTones[normalized] != null) return semanticTones[normalized];
  let hash = 2166136261;
  for (const character of normalized) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 12;
}

export const categoryStyle = (category: string): CSSProperties =>
  ({ '--category-tone': categoryTone(category) }) as CSSProperties;

export function categoryLabel(category: string): string {
  if (category === 'Uncategorized') return category;
  return category
    .split('/')
    .map((segment) => segment.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase()))
    .join(' / ');
}

export function entryText(body: string): string {
  return parseJournalEntry(body).text || 'Empty journal entry';
}

export function timeLabel(instant: string, timezoneId = systemTimezone): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezoneId,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(instant));
}

export function periodFor(instant: string, timezoneId = systemTimezone): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(instant))
  );
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function newestHistoryFirst<T extends { id: string; submittedAt: string }>(
  items: readonly T[]
): T[] {
  return [...items].sort(
    (left, right) =>
      right.submittedAt.localeCompare(left.submittedAt) || right.id.localeCompare(left.id)
  );
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function delayLabel(seconds: number | null | undefined): string {
  if (seconds == null) return 'Manual entry';
  if (seconds < 60) return `${seconds}s response`;
  return `${Math.round(seconds / 60)}m delayed`;
}

export function dateTitle(day: string, timezoneId = systemTimezone): string {
  const today = localDay(new Date(), timezoneId);
  if (day === today) return 'Today';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date(`${day}T12:00:00Z`));
}
