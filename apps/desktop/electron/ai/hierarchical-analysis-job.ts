import { createHash } from 'node:crypto';

import { analysisPeriod, analysisTimeZone } from './analysis-periods.js';
import type { AnalysisLevel } from './analysis-contracts.js';
import { AIError } from './errors.js';
import type { PrivacyMode } from './types.js';

export const HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION = 1 as const;
export type ParentAnalysisLevel = Exclude<AnalysisLevel, 'daily'>;

export interface HierarchicalAnalysisJobPayload {
  schemaVersion: typeof HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION;
  level: ParentAnalysisLevel;
  localAnchor: string;
  timezone: string;
  periodId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  providerProfileId: string;
  requestedModelId: string;
  privacyMode: PrivacyMode;
  promptId: string;
  promptVersion: string;
  sourceRevisionHash: string;
  regeneration: number;
  trigger: 'manual' | 'scheduled' | 'dependency';
}

const parentLevels = new Set<AnalysisLevel>(['weekly', 'monthly', 'quarterly', 'yearly']);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new AIError('VALIDATION', `Analysis payload ${field} is required.`);
  return value;
}

function validateDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new AIError('VALIDATION', 'Choose a valid local analysis date.');
  const [year, month, day] = value.split('-').map(Number);
  if (new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10) !== value)
    throw new AIError('VALIDATION', 'Choose a valid local analysis date.');
  return value;
}

export function parseHierarchicalAnalysisPayload(
  value: Record<string, unknown>
): HierarchicalAnalysisJobPayload {
  if (value.schemaVersion !== HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION)
    throw new AIError('VALIDATION', 'This analysis job payload version is unsupported.');
  const level = value.level as AnalysisLevel;
  if (!parentLevels.has(level))
    throw new AIError('VALIDATION', 'This parent analysis level is unsupported.');
  const localAnchor = validateDate(value.localAnchor);
  const timezone = analysisTimeZone(requiredString(value.timezone, 'timezone'));
  const period = analysisPeriod(level, localAnchor, timezone);
  if (
    value.periodId !== period.periodId ||
    value.periodStartUtc !== period.periodStartUtc ||
    value.periodEndUtc !== period.periodEndUtc
  )
    throw new AIError('VALIDATION', 'Analysis job period boundaries are invalid.');
  if (!['DISABLED', 'LOCAL', 'CLOUD', 'HYBRID'].includes(String(value.privacyMode)))
    throw new AIError('VALIDATION', 'Analysis job privacy mode is invalid.');
  if (!['manual', 'scheduled', 'dependency'].includes(String(value.trigger)))
    throw new AIError('VALIDATION', 'Analysis job trigger is invalid.');
  if (!Number.isInteger(value.regeneration) || Number(value.regeneration) < 0)
    throw new AIError('VALIDATION', 'Analysis job regeneration value is invalid.');
  return {
    schemaVersion: HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION,
    level: level as ParentAnalysisLevel,
    localAnchor,
    timezone,
    periodId: period.periodId,
    periodStartUtc: period.periodStartUtc,
    periodEndUtc: period.periodEndUtc,
    providerProfileId: requiredString(value.providerProfileId, 'providerProfileId'),
    requestedModelId: requiredString(value.requestedModelId, 'requestedModelId'),
    privacyMode: value.privacyMode as PrivacyMode,
    promptId: requiredString(value.promptId, 'promptId'),
    promptVersion: requiredString(value.promptVersion, 'promptVersion'),
    sourceRevisionHash: requiredString(value.sourceRevisionHash, 'sourceRevisionHash'),
    regeneration: Number(value.regeneration),
    trigger: value.trigger as HierarchicalAnalysisJobPayload['trigger']
  };
}

export function hierarchicalAnalysisIdempotencyKey(
  payload: HierarchicalAnalysisJobPayload
): string {
  return createHash('sha256')
    .update(
      [
        `${payload.level}_analysis`,
        payload.providerProfileId,
        payload.requestedModelId,
        payload.privacyMode,
        payload.periodId,
        payload.timezone,
        payload.sourceRevisionHash,
        payload.promptVersion,
        String(payload.regeneration)
      ].join('\u001f')
    )
    .digest('hex');
}
