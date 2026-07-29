import { AIError } from './errors.js';
import type { RuntimeSchema } from './types.js';

export interface DailyAnalysisResultV1 {
  schemaVersion: 1;
  periodId: string;
  summary: string;
  keyPatterns: Array<{ title: string; description: string; evidenceIds: string[] }>;
  positiveChanges: string[];
  difficulties: string[];
  recurringDistractions: string[];
  activeProjects: string[];
  reflectionQuestions: string[];
  suggestedNextSteps: string[];
  confidence: 'low' | 'medium' | 'high';
  dataCompleteness: { level: 'low' | 'medium' | 'high'; reason: string };
}

const string = (value: unknown, field: string, max = 1_000): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new AIError('VALIDATION', `Daily structured output has an invalid ${field}.`);
  return value.trim();
};
const strings = (value: unknown, field: string, maxItems = 12): string[] => {
  if (!Array.isArray(value) || value.length > maxItems)
    throw new AIError('VALIDATION', `Daily structured output has an invalid ${field}.`);
  return value.map((item) => string(item, field, 500));
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[], name: string): void => {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new AIError('VALIDATION', `Daily structured output has unexpected ${name} fields.`);
};

export function parseDailyAnalysisResultV1(
  value: unknown,
  periodId: string,
  allowedEvidenceIds: ReadonlySet<string>
): DailyAnalysisResultV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AIError('VALIDATION', 'Daily structured output must be an object.');
  const item = value as Record<string, unknown>;
  exactKeys(
    item,
    [
      'schemaVersion',
      'periodId',
      'summary',
      'keyPatterns',
      'positiveChanges',
      'difficulties',
      'recurringDistractions',
      'activeProjects',
      'reflectionQuestions',
      'suggestedNextSteps',
      'confidence',
      'dataCompleteness'
    ],
    'top-level'
  );
  if (item.schemaVersion !== 1 || item.periodId !== periodId)
    throw new AIError('VALIDATION', 'Daily structured output has an invalid version or period.');
  if (!['low', 'medium', 'high'].includes(String(item.confidence)))
    throw new AIError('VALIDATION', 'Daily structured output has invalid confidence.');
  if (
    !item.dataCompleteness ||
    typeof item.dataCompleteness !== 'object' ||
    Array.isArray(item.dataCompleteness)
  )
    throw new AIError('VALIDATION', 'Daily structured output has invalid completeness.');
  const completeness = item.dataCompleteness as Record<string, unknown>;
  exactKeys(completeness, ['level', 'reason'], 'completeness');
  if (!['low', 'medium', 'high'].includes(String(completeness.level)))
    throw new AIError('VALIDATION', 'Daily structured output has invalid completeness level.');
  if (!Array.isArray(item.keyPatterns) || item.keyPatterns.length > 8)
    throw new AIError('VALIDATION', 'Daily structured output has invalid patterns.');
  const keyPatterns = item.keyPatterns.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new AIError('VALIDATION', 'Daily structured output has invalid pattern.');
    const pattern = value as Record<string, unknown>;
    exactKeys(pattern, ['title', 'description', 'evidenceIds'], 'pattern');
    const evidenceIds = strings(pattern.evidenceIds, 'evidence IDs', 20);
    if (
      new Set(evidenceIds).size !== evidenceIds.length ||
      evidenceIds.some((id) => !allowedEvidenceIds.has(id))
    )
      throw new AIError('VALIDATION', 'Daily structured output references unavailable evidence.');
    return {
      title: string(pattern.title, 'pattern title', 160),
      description: string(pattern.description, 'pattern description', 800),
      evidenceIds
    };
  });
  return {
    schemaVersion: 1,
    periodId,
    summary: string(item.summary, 'summary', 4_000),
    keyPatterns,
    positiveChanges: strings(item.positiveChanges, 'positive changes'),
    difficulties: strings(item.difficulties, 'difficulties'),
    recurringDistractions: strings(item.recurringDistractions, 'recurring distractions'),
    activeProjects: strings(item.activeProjects, 'active projects'),
    reflectionQuestions: strings(item.reflectionQuestions, 'reflection questions'),
    suggestedNextSteps: strings(item.suggestedNextSteps, 'suggested next steps'),
    confidence: item.confidence as DailyAnalysisResultV1['confidence'],
    dataCompleteness: {
      level: completeness.level as DailyAnalysisResultV1['dataCompleteness']['level'],
      reason: string(completeness.reason, 'completeness reason', 500)
    }
  };
}

export function dailyAnalysisSchema(
  periodId: string,
  evidenceIds: ReadonlySet<string>
): RuntimeSchema<DailyAnalysisResultV1> {
  return {
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'schemaVersion',
        'periodId',
        'summary',
        'keyPatterns',
        'positiveChanges',
        'difficulties',
        'recurringDistractions',
        'activeProjects',
        'reflectionQuestions',
        'suggestedNextSteps',
        'confidence',
        'dataCompleteness'
      ],
      properties: {
        schemaVersion: { const: 1 },
        periodId: { const: periodId },
        summary: { type: 'string' },
        keyPatterns: { type: 'array' },
        positiveChanges: { type: 'array' },
        difficulties: { type: 'array' },
        recurringDistractions: { type: 'array' },
        activeProjects: { type: 'array' },
        reflectionQuestions: { type: 'array' },
        suggestedNextSteps: { type: 'array' },
        confidence: { enum: ['low', 'medium', 'high'] },
        dataCompleteness: { type: 'object' }
      }
    },
    parse: (value) => parseDailyAnalysisResultV1(value, periodId, evidenceIds)
  };
}
