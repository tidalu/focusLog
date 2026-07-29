import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AISettingsPage, AnalysisResultCard } from './AISettingsPage.js';

describe('AI analysis controls surface', () => {
  it('renders a safe loading state without rendering control-plane secrets', () => {
    const markup = renderToStaticMarkup(createElement(AISettingsPage, { notify: () => undefined }));
    expect(markup).toContain('Loading AI settings');
    expect(markup).not.toMatch(/api[_-]?key|authorization|lease[_-]?token|raw prompt/iu);
  });

  it('renders stale result disclosure, provenance, tokens, and cost accessibly', () => {
    const markup = renderToStaticMarkup(
      createElement(AnalysisResultCard, {
        result: {
          id: 'result',
          level: 'weekly',
          periodId: '2026-W30',
          timezone: 'UTC',
          version: 2,
          status: 'stale',
          staleReason: 'Daily changed',
          summary: 'Weekly summary',
          confidence: 'high',
          completeness: 'medium',
          providerProfileId: 'profile',
          providerName: 'Local',
          providerId: 'ollama',
          modelId: 'qwen',
          fallbackUsed: true,
          promptVersion: '1.0.0',
          schemaVersion: '1',
          inputTokens: 11,
          outputTokens: 12,
          totalTokens: 23,
          costMicros: '42',
          jobId: 'job',
          createdAt: '2026-07-21',
          structured: {
            result: {
              patterns: [{ title: 'Pattern', detail: 'Detail', evidenceIds: ['check'] }],
              nextSteps: ['Plan']
            }
          },
          children: [
            { id: 'child', level: 'daily', periodId: '2026-07-21', version: 1, status: 'current' }
          ],
          evidence: [
            {
              evidenceId: 'check',
              checkInId: 'check',
              revisionId: 'rev',
              occurredAt: '2026-07-21',
              available: false,
              preview: null
            }
          ],
          history: []
        }
      })
    );
    expect(markup).toContain('Analysis result');
    expect(markup).toContain('stale');
    expect(markup).toContain('Local / qwen');
    expect(markup).toContain('23 total');
    expect(markup).toContain('42 micro-USD');
    expect(markup).toContain('Evidence unavailable or unauthorized');
    expect(markup).not.toMatch(
      /api[_-]?key|authorization|lease[_-]?token|raw prompt|raw provider/iu
    );
  });
});
