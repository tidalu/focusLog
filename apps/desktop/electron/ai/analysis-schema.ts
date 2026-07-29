import { AIError } from './errors.js';
import type { AnalysisLevel, StructuredAnalysisEnvelope } from './analysis-contracts.js';

export interface AnalysisResultV1 {
  summary: string;
  patterns: Array<{ title: string; detail: string; evidenceIds: string[] }>;
  changes: string[];
  difficulties: string[];
  projects: string[];
  habits: string[];
  distractions: string[];
  reflectionQuestions: string[];
  nextSteps: string[];
  confidence: 'low' | 'medium' | 'high';
  completeness: 'low' | 'medium' | 'high';
}
const required = [
  'summary',
  'patterns',
  'changes',
  'difficulties',
  'projects',
  'habits',
  'distractions',
  'reflectionQuestions',
  'nextSteps',
  'confidence',
  'completeness'
] as const;
const text = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 4_000)
    throw new AIError('VALIDATION', `Analysis output has an invalid ${name}.`);
  return value.trim();
};
const texts = (value: unknown, name: string) => {
  if (!Array.isArray(value) || value.length > 12)
    throw new AIError('VALIDATION', `Analysis output has an invalid ${name}.`);
  return value.map((item) => text(item, name));
};
export function parseAnalysisResultV1(
  value: unknown,
  level: AnalysisLevel,
  periodId: string,
  allowedEvidence: ReadonlySet<string>
): StructuredAnalysisEnvelope<AnalysisResultV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AIError('VALIDATION', 'Analysis output must be an object.');
  const root = value as Record<string, unknown>;
  if (
    Object.keys(root).length !== 4 ||
    root.schemaVersion !== 1 ||
    root.level !== level ||
    root.periodId !== periodId ||
    !root.result ||
    typeof root.result !== 'object' ||
    Array.isArray(root.result)
  )
    throw new AIError('VALIDATION', 'Analysis output has an invalid envelope.');
  const result = root.result as Record<string, unknown>;
  if (Object.keys(result).length !== required.length || required.some((key) => !(key in result)))
    throw new AIError('VALIDATION', 'Analysis output has unexpected result fields.');
  if (!Array.isArray(result.patterns) || result.patterns.length > 8)
    throw new AIError('VALIDATION', 'Analysis output has invalid patterns.');
  const patterns = result.patterns.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new AIError('VALIDATION', 'Analysis output has invalid pattern.');
    const pattern = item as Record<string, unknown>;
    if (Object.keys(pattern).length !== 3 || !Array.isArray(pattern.evidenceIds))
      throw new AIError('VALIDATION', 'Analysis output has invalid pattern.');
    const evidenceIds = texts(pattern.evidenceIds, 'evidence IDs');
    if (
      new Set(evidenceIds).size !== evidenceIds.length ||
      evidenceIds.some((id) => !allowedEvidence.has(id))
    )
      throw new AIError('VALIDATION', 'Analysis output references unavailable evidence.');
    return {
      title: text(pattern.title, 'pattern title'),
      detail: text(pattern.detail, 'pattern detail'),
      evidenceIds
    };
  });
  if (
    !['low', 'medium', 'high'].includes(String(result.confidence)) ||
    !['low', 'medium', 'high'].includes(String(result.completeness))
  )
    throw new AIError('VALIDATION', 'Analysis output has invalid confidence or completeness.');
  return {
    schemaVersion: 1,
    level,
    periodId,
    result: {
      summary: text(result.summary, 'summary'),
      patterns,
      changes: texts(result.changes, 'changes'),
      difficulties: texts(result.difficulties, 'difficulties'),
      projects: texts(result.projects, 'projects'),
      habits: texts(result.habits, 'habits'),
      distractions: texts(result.distractions, 'distractions'),
      reflectionQuestions: texts(result.reflectionQuestions, 'reflection questions'),
      nextSteps: texts(result.nextSteps, 'next steps'),
      confidence: result.confidence as AnalysisResultV1['confidence'],
      completeness: result.completeness as AnalysisResultV1['completeness']
    }
  };
}
