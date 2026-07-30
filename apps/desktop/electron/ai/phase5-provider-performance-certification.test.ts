import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  certifyProviderCandidate,
  runPhase5CProviderAndPerformanceCertification,
  runPhase5PerformanceCertification
} from './phase5-provider-performance-certification.js';
import { createProviderAdapter } from './providers.js';
import type { ProviderProfile, ResolvedProviderConfig } from './types.js';

const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function openAICompatibleConfig(): ResolvedProviderConfig {
  const profile: ProviderProfile = {
    id: 'phase5c-openai-compatible',
    ownerId: 'owner',
    name: 'Phase 5-C OpenAI-compatible',
    providerId: 'openai-compatible',
    enabled: true,
    endpoint: 'https://api.example.test/v1',
    generationModel: 'gpt-smoke',
    embeddingModel: 'embed-smoke',
    temperature: 0,
    topP: 1,
    maxOutputTokens: 64,
    timeoutMs: 30_000,
    retryLimit: 0,
    concurrencyLimit: 1,
    automaticAnalysis: false,
    priority: 100,
    monthlyBudgetUsd: null,
    credentialConfigured: true,
    createdAt: '2026-07-29',
    updatedAt: '2026-07-29'
  };
  return { profile, endpoint: 'https://api.example.test/v1', apiKey: 'sk-PHASE5C_SECRET' };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function streamResponse(): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"pong"},"finish_reason":null}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3},"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
          )
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}

describe('Phase 5-C live provider and performance certification', () => {
  it('keeps unconfigured providers explicitly untested and writes a secret-free certification artifact', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focuslog-phase5c-'));
    roots.push(root);
    const artifactPath = join(root, 'phase5c.json');
    const result = await runPhase5CProviderAndPerformanceCertification({
      live: false,
      includePerformance: false,
      artifactPath,
      now: new Date('2026-07-29T00:00:00.000Z'),
      env: {}
    });
    expect(result.summary.untestedProviders).toContain('openai');
    expect(result.summary.certifiedProviders).toBe(1);
    expect(result.summary.certifiedLocalPath).toBe(false);
    expect(result.summary.certifiedDirectCloudPath).toBe(false);
    expect(result.summary.certifiedOpenAICompatiblePath).toBe(false);
    expect(result.providers.find((provider) => provider.providerId === 'openai')?.status).toBe(
      'untested'
    );
    expect(
      result.providers.find((provider) => provider.generationModel === 'synthetic-error-fixture')
        ?.status
    ).toBe('certified');
    expect(result.secretFree).toBe(true);
    expect(existsSync(artifactPath)).toBe(true);
    expect(readFileSync(artifactPath, 'utf8')).not.toMatch(
      /PHASE5C_SECRET|Authorization|api[_-]?key/iu
    );
  });

  it('certifies a configured OpenAI-compatible path with discovery, generation, streaming, cancellation, structured output, usage, and embeddings', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(json({ data: [{ id: 'gpt-smoke' }] }))
      .mockResolvedValueOnce(json({ data: [{ id: 'gpt-smoke' }] }))
      .mockResolvedValueOnce(
        json({
          choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 }
        })
      )
      .mockResolvedValueOnce(streamResponse())
      .mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'))
      .mockResolvedValueOnce(
        json({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
        })
      )
      .mockResolvedValueOnce(
        json({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 4, total_tokens: 4 }
        })
      );

    const row = await certifyProviderCandidate(
      {
        config: openAICompatibleConfig(),
        path: 'openai-compatible',
        generationModel: 'gpt-smoke',
        embeddingModel: 'embed-smoke'
      },
      '2026-07-29',
      createProviderAdapter
    );

    expect(row.status).toBe('certified');
    expect(row.checks.health.status).toBe('passed');
    expect(row.checks.modelDiscovery.status).toBe('passed');
    expect(row.checks.generation.status).toBe('passed');
    expect(row.checks.streaming.status).toBe('passed');
    expect(row.checks.cancellation.status).toBe('passed');
    expect(row.checks.structuredOutput.status).toBe('passed');
    expect(row.checks.embeddings.status).toBe('passed');
    expect(row.usage.reported).toBe(true);
    expect(JSON.stringify(row)).not.toMatch(/PHASE5C_SECRET|Authorization|api[_-]?key|Bearer/u);
  });

  it('runs the focused performance certification, checks resource controls, and saves benchmark artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focuslog-phase5c-perf-'));
    roots.push(root);
    const artifactPath = join(root, 'performance.json');
    const result = runPhase5PerformanceCertification({
      performanceLogCount: 2_000,
      releaseLikePerformance: false,
      performanceArtifactPath: artifactPath,
      now: new Date('2026-07-29T00:00:00.000Z')
    });
    expect(result.harness.logCount).toBe(2_000);
    expect(result.harness.counts.logsAfterReopen).toBe(2_000);
    expect(result.thresholdsPassed).toBe(true);
    expect(result.resourceControls).toEqual({
      rendererSafeProjectionBounded: true,
      startupDoesNotProcessBacklogSynchronously: true,
      queueBackpressureDocumented: true,
      importContextResponseLimitsDocumented: true,
      indexesJustified: true
    });
    expect(existsSync(artifactPath)).toBe(true);
    expect(readFileSync(artifactPath, 'utf8')).toContain('"seed": "focuslog-phase3-f-200k-v1"');
  }, 300_000);
});
