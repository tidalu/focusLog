import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AIMemoryPage,
  MemoryFactCard,
  MemoryGraphPanel,
  MemoryOverviewPanel,
  MemorySearchPanel
} from './AIMemoryPage.js';

describe('AI Memory UI surface', () => {
  it('renders loading and safe disclosure states without control-plane secrets', () => {
    const markup = renderToStaticMarkup(createElement(AIMemoryPage, { notify: () => undefined }));
    expect(markup).toContain('AI Memory');
    expect(markup).toContain('Loading AI memory controls');
    expect(markup).not.toMatch(
      /api[_-]?key|authorization|lease[_-]?token|reservation[_-]?owner|raw prompt|raw provider/iu
    );
  });

  it('renders overview namespace, progress, subsystem, and redacted diagnostic details', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryOverviewPanel, {
        overview: {
          activeNamespace: {
            id: 'ns',
            name: 'Memory',
            providerId: 'ollama',
            modelId: 'embed',
            dimensions: 768,
            coverageStatus: 'verified',
            coverageExpectedChunks: 10,
            coverageIndexedChunks: 9,
            storageBytes: '4096',
            lastIndexingAt: '2026-07-21'
          },
          indexing: { pending: 1, failed: 2 },
          counts: { facts: 3, graphNodes: 4, graphEdges: 5, staleMemory: 6 },
          subsystems: { embeddings: true, facts: true, graph: false, retrieval: true },
          diagnostics: [
            {
              code: 'check_in_revision',
              message: 'api_key=SECRET Authorization: Bearer SECRET',
              createdAt: '2026-07-21'
            }
          ]
        }
      })
    );
    expect(markup).toContain('Memory');
    expect(markup).toContain('ollama / embed');
    expect(markup).toContain('9 / 10 chunks');
    expect(markup).toContain('6');
    expect(markup).not.toMatch(/SECRET|Authorization: Bearer|raw prompt|lease/iu);
  });

  it('renders search evidence, stale/deleted disclosure, namespace/model, and open-source affordance safely', () => {
    const markup = renderToStaticMarkup(
      createElement(MemorySearchPanel, {
        search: {
          planId: 'plan',
          mode: 'hybrid',
          namespace: { id: 'ns', modelId: 'embed' },
          explanation: ['facts_graph_first', 'deleted_sources_excluded'],
          results: [
            {
              id: 'item',
              sourceType: 'raw_log',
              sourceId: 'log-a',
              sourceRevisionId: 'rev-a',
              sourceVersion: null,
              staleState: 'stale',
              classification: 'canonical',
              title: 'FocusLog memory',
              excerptRedacted: 'Safe excerpt',
              tokenEstimate: 12,
              score: 0.75,
              metadata: {},
              openSource: { checkInId: 'log-a', revisionId: 'rev-a' }
            }
          ]
        }
      })
    );
    expect(markup).toContain('Namespace ns');
    expect(markup).toContain('Model embed');
    expect(markup).toContain('deleted_sources_excluded');
    expect(markup).toContain('stale');
    expect(markup).toContain('open source log-a');
    expect(markup).not.toMatch(/api[_-]?key|authorization|raw provider/iu);
  });

  it('distinguishes automated facts from user-curated overlays with evidence and provider disclosure', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryFactCard, {
        fact: {
          id: 'fact',
          subject: 'FocusLog',
          predicate: 'supports',
          objectValue: 'AI memory',
          status: 'corrected',
          confidence: '1.00',
          origin: 'user_overlay',
          validFrom: null,
          validTo: null,
          evidenceCount: 2,
          providerProfileId: 'profile',
          modelId: 'local'
        }
      })
    );
    expect(markup).toContain('User-curated overlay');
    expect(markup).toContain('2 evidence');
    expect(markup).toContain('profile / local');
  });

  it('renders graph nodes and edge evidence without requiring animated graph visualization', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryGraphPanel, {
        graph: {
          nodes: [
            {
              id: 'entity',
              name: 'FocusLog',
              type: 'project',
              status: 'active',
              confidence: '0.90'
            }
          ],
          edges: [
            {
              id: 'edge',
              source: 'FocusLog',
              predicate: 'supports',
              target: 'Memory',
              status: 'active',
              confidence: '0.80',
              evidenceCount: 1
            }
          ]
        }
      })
    );
    expect(markup).toContain('Graph inspection');
    expect(markup).toContain('FocusLog supports Memory');
    expect(markup).toContain('1 evidence');
  });
});
