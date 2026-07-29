import { describe, expect, it } from 'vitest';
import { parseDailyAnalysisResultV1 } from './daily-analysis-schema.js';

const valid = () => ({
  schemaVersion: 1,
  periodId: '2026-07-21',
  summary: 'A concise reflection.',
  keyPatterns: [
    { title: 'Focus', description: 'A focused block completed.', evidenceIds: ['check-in'] }
  ],
  positiveChanges: [],
  difficulties: [],
  recurringDistractions: [],
  activeProjects: [],
  reflectionQuestions: [],
  suggestedNextSteps: [],
  confidence: 'medium',
  dataCompleteness: { level: 'high', reason: 'The day has one complete check-in.' }
});

describe('daily structured result v1', () => {
  it('validates a strict versioned result and permitted evidence', () => {
    expect(parseDailyAnalysisResultV1(valid(), '2026-07-21', new Set(['check-in']))).toMatchObject({
      schemaVersion: 1,
      summary: 'A concise reflection.'
    });
  });
  it('rejects missing fields, unexpected fields, wrong types, and unavailable evidence without echoing source content', () => {
    const missing = valid();
    delete (missing as Partial<typeof missing>).summary;
    expect(() => parseDailyAnalysisResultV1(missing, '2026-07-21', new Set(['check-in']))).toThrow(
      'unexpected'
    );
    expect(() =>
      parseDailyAnalysisResultV1(
        { ...valid(), extra: 'SECRET_PROMPT' },
        '2026-07-21',
        new Set(['check-in'])
      )
    ).toThrow('unexpected');
    expect(() =>
      parseDailyAnalysisResultV1(
        { ...valid(), confidence: 'certain' },
        '2026-07-21',
        new Set(['check-in'])
      )
    ).toThrow('confidence');
    expect(() =>
      parseDailyAnalysisResultV1(
        { ...valid(), keyPatterns: [{ ...valid().keyPatterns[0], evidenceIds: ['not-supplied'] }] },
        '2026-07-21',
        new Set(['check-in'])
      )
    ).toThrow('unavailable');
  });
});
