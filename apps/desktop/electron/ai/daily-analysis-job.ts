import { createHash } from 'node:crypto';

import { AIError } from './errors.js';
import type { PrivacyMode } from './types.js';
import { analysisPeriod } from './analysis-periods.js';

export const DAILY_ANALYSIS_PAYLOAD_VERSION = 1 as const;

export interface DailyAnalysisJobPayload {
  schemaVersion: typeof DAILY_ANALYSIS_PAYLOAD_VERSION;
  localDate: string;
  timezone: string;
  periodStartUtc: string;
  periodEndUtc: string;
  providerProfileId: string;
  requestedModelId: string;
  privacyMode: PrivacyMode;
  promptId: string;
  promptVersion: string;
  sourceRevisionHash: string;
  regeneration: number;
  trigger: 'manual' | 'scheduled';
}

function validateDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new AIError('VALIDATION', 'Choose a valid local analysis date.');
  const [year, month, day] = value.split('-').map(Number);
  if (new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10) !== value)
    throw new AIError('VALIDATION', 'Choose a valid local analysis date.');
  return value;
}

export function validateTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new AIError('VALIDATION', 'Choose a valid analysis timezone.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
  } catch {
    throw new AIError('VALIDATION', 'Choose a valid analysis timezone.');
  }
  return value;
}

export function dailyPeriodBounds(
  localDate: string,
  timeZone: string
): { periodStartUtc: string; periodEndUtc: string } {
  const period = analysisPeriod('daily', validateDate(localDate), validateTimeZone(timeZone));
  return { periodStartUtc: period.periodStartUtc, periodEndUtc: period.periodEndUtc };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new AIError('VALIDATION', `Daily analysis payload ${field} is required.`);
  return value;
}

export function parseDailyAnalysisPayload(value: Record<string, unknown>): DailyAnalysisJobPayload {
  if (value.schemaVersion !== DAILY_ANALYSIS_PAYLOAD_VERSION)
    throw new AIError('VALIDATION', 'This daily analysis job payload version is unsupported.');
  const localDate = validateDate(value.localDate);
  const timezone = validateTimeZone(value.timezone);
  const calculated = dailyPeriodBounds(localDate, timezone);
  if (
    value.periodStartUtc !== calculated.periodStartUtc ||
    value.periodEndUtc !== calculated.periodEndUtc
  )
    throw new AIError('VALIDATION', 'Daily analysis job period boundaries are invalid.');
  if (!['DISABLED', 'LOCAL', 'CLOUD', 'HYBRID'].includes(String(value.privacyMode)))
    throw new AIError('VALIDATION', 'Daily analysis job privacy mode is invalid.');
  if (value.trigger !== 'manual' && value.trigger !== 'scheduled')
    throw new AIError('VALIDATION', 'Daily analysis job trigger is invalid.');
  if (!Number.isInteger(value.regeneration) || Number(value.regeneration) < 0)
    throw new AIError('VALIDATION', 'Daily analysis job regeneration value is invalid.');
  return {
    schemaVersion: DAILY_ANALYSIS_PAYLOAD_VERSION,
    localDate,
    timezone,
    periodStartUtc: calculated.periodStartUtc,
    periodEndUtc: calculated.periodEndUtc,
    providerProfileId: requiredString(value.providerProfileId, 'providerProfileId'),
    requestedModelId: requiredString(value.requestedModelId, 'requestedModelId'),
    privacyMode: value.privacyMode as PrivacyMode,
    promptId: requiredString(value.promptId, 'promptId'),
    promptVersion: requiredString(value.promptVersion, 'promptVersion'),
    sourceRevisionHash: requiredString(value.sourceRevisionHash, 'sourceRevisionHash'),
    regeneration: Number(value.regeneration),
    trigger: value.trigger
  };
}

export function dailyAnalysisIdempotencyKey(payload: DailyAnalysisJobPayload): string {
  return createHash('sha256')
    .update(
      [
        'daily_analysis',
        payload.providerProfileId,
        payload.requestedModelId,
        payload.privacyMode,
        payload.localDate,
        payload.timezone,
        payload.sourceRevisionHash,
        payload.promptVersion,
        String(payload.regeneration)
      ].join('\u001f')
    )
    .digest('hex');
}
