export const ANALYSIS_BOUNDARY_POLICY_VERSION = 'calendar-v1' as const;
export type AnalysisLevel = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface AnalysisPeriod {
  level: AnalysisLevel;
  timezone: string;
  localStart: string;
  localEnd: string;
  periodId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  boundaryPolicyVersion: typeof ANALYSIS_BOUNDARY_POLICY_VERSION;
}
export interface AnalysisEvidence {
  sourceId: string;
  revisionId: string;
  kind: 'check_in';
  occurredAt: string;
  untrustedContent: string;
}
export interface AnalysisProvenance {
  sourceRevisionIds: string[];
  evidenceIds: string[];
  sourceRange: { startUtc: string; endUtc: string };
}
export interface AnalysisPromptMetadata {
  id: string;
  version: string;
  level: AnalysisLevel;
  outputSchemaVersion: string;
  privacyClassification: 'local-derived';
  expectedContext: string;
  changeNotes: string;
  variables: string[];
}
export interface AnalysisGenerationMetadata {
  providerProfileId: string;
  providerId: string;
  model: string;
  promptId: string;
  promptVersion: string;
  fallbackUsed: boolean;
}
export interface StructuredAnalysisEnvelope<T> {
  schemaVersion: 1;
  level: AnalysisLevel;
  periodId: string;
  result: T;
}
export interface SafeAnalysisReadModel {
  id: string;
  level: AnalysisLevel;
  periodId: string;
  timezone: string;
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  completeness: 'low' | 'medium' | 'high';
  createdAt: string;
}
