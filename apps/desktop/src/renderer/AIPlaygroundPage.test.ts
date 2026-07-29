import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AIPlaygroundPage,
  PlaygroundCertificationPanel,
  PlaygroundMetricGrid,
  PlaygroundSwitchPanel,
  PlaygroundWorkbenchPanel
} from './AIPlaygroundPage.js';

const gateStatus = {
  counts: {
    sessions: 2,
    prompts: 3,
    contextSnapshots: 4,
    comparisonGroups: 5,
    embeddingInspections: 6,
    retrievalInspections: 7,
    structuredWorkbenchRuns: 8,
    datasets: 9,
    evaluationRuns: 10,
    exchangeRecords: 11,
    benchmarkResults: 12
  },
  recentRuns: [
    {
      id: 'run',
      status: 'cancelled',
      provider: 'ollama',
      model: 'llama',
      totalTokens: 14,
      costMicros: '0',
      fallbackUsed: false,
      errorCode: 'CANCELLATION'
    }
  ],
  recentEvaluations: [
    {
      id: 'eval',
      status: 'completed',
      caseCount: 3,
      passed: 2,
      failed: 1,
      modelEvaluatorLabel: 'subjective'
    }
  ],
  switches: [
    {
      subsystem: 'playground_execution',
      disabled: false,
      reason: null,
      effectiveBlocked: false,
      blockingSwitch: null
    },
    {
      subsystem: 'cloud_execution',
      disabled: true,
      reason: 'api_key=SECRET Authorization: Bearer SECRET',
      effectiveBlocked: true,
      blockingSwitch: 'cloud_execution'
    }
  ],
  capabilities: [
    {
      providerId: 'ollama',
      label: 'Ollama',
      generation: true,
      streaming: true,
      structuredOutput: true,
      embeddings: true
    }
  ],
  states: [
    'loading',
    'empty',
    'error',
    'cancelled',
    'interrupted',
    'blocked',
    'streaming',
    'success'
  ]
} satisfies Awaited<ReturnType<Window['focuslog']['aiPlaygroundGateStatus']>>;

describe('AI Playground UI gate surface', () => {
  it('renders loading state without exposing control-plane secrets', () => {
    const markup = renderToStaticMarkup(
      createElement(AIPlaygroundPage, { notify: () => undefined })
    );
    expect(markup).toContain('AI Playground');
    expect(markup).toContain('Loading Playground workspace');
    expect(markup).not.toMatch(
      /api[_-]?key|authorization|lease|reservation|raw prompt|raw provider|sk-/iu
    );
  });

  it('renders artifact counts for chat, prompt, comparison, inspector, evaluation, exchange, and benchmark history', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaygroundMetricGrid, { status: gateStatus })
    );
    expect(markup).toContain('Sessions');
    expect(markup).toContain('Comparisons');
    expect(markup).toContain('Structured runs');
    expect(markup).toContain('Exchange records');
    expect(markup).toContain('Benchmarks');
  });

  it('renders complete Playground workspace navigation with keyboard focus targets and disclosure sections', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaygroundWorkbenchPanel, { status: gateStatus })
    );
    expect(markup).toContain('Playground session sidebar');
    expect(markup).toContain('Chat workspace');
    expect(markup).toContain('Prompt editor');
    expect(markup).toContain('Context builder');
    expect(markup).toContain('Model comparison');
    expect(markup).toContain('Retrieval inspector');
    expect(markup).toContain('Structured-output workbench');
    expect(markup).toContain('Datasets and evaluation');
    expect(markup).toContain('Import / export');
    expect(markup).toContain('14 tokens');
  });

  it('renders exact switch blockers while redacting secret-shaped reasons', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaygroundSwitchPanel, { status: gateStatus })
    );
    expect(markup).toContain('Blocked by cloud_execution');
    expect(markup).toContain('[redacted]');
    expect(markup).toContain('Available independently');
    expect(markup).not.toMatch(/SECRET|Authorization: Bearer/iu);
  });

  it('renders adversarial certification and isolation invariants safely', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaygroundCertificationPanel, {
        certification: {
          adversarialCases: 6,
          sanitized: true,
          isolation: {
            playgroundMessagesExcludedFromFacts: true,
            playgroundNamespacesNotProductionActive: true,
            scheduledJobsIgnorePlaygroundData: true
          },
          diagnostics: [{ code: 'adversarial_1', message: 'api_key=SECRET' }]
        }
      })
    );
    expect(markup).toContain('6 attacks');
    expect(markup).toContain('Diagnostics are credential-free');
    expect(markup).toContain('scheduledJobsIgnorePlaygroundData: passed');
    expect(markup).not.toContain('SECRET');
  });
});
