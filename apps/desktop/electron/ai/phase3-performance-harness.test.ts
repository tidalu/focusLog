import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PHASE3_PERFORMANCE_LOG_COUNT,
  PHASE3_PERFORMANCE_SEED,
  runPhase3PerformanceHarness
} from './phase3-performance-harness.js';

describe('Phase 3-F performance and integrated memory gate harness', () => {
  it('defines the required deterministic 200,000-log release harness defaults', () => {
    expect(PHASE3_PERFORMANCE_LOG_COUNT).toBe(200_000);
    expect(PHASE3_PERFORMANCE_SEED).toBe('focuslog-phase3-f-200k-v1');
  });

  it('runs the production-composition harness, saves reproducible results, and enforces security/deletion/restart invariants', () => {
    const full = process.env.FOCUSLOG_PHASE3_FULL_BENCHMARK === '1';
    const artifactPath = join(
      process.cwd(),
      '..',
      '..',
      'artifacts',
      'phase3',
      full ? 'phase3-200k-benchmark.json' : 'phase3-harness-focused.json'
    );
    const result = runPhase3PerformanceHarness({
      logCount: full ? PHASE3_PERFORMANCE_LOG_COUNT : 2_000,
      artifactPath,
      cleanupDatabase: true
    });

    expect(result.logCount).toBe(full ? 200_000 : 2_000);
    expect(result.counts.logs).toBe(result.logCount);
    expect(result.counts.logsAfterReopen).toBe(result.logCount);
    expect(result.counts.chunks).toBe(result.logCount);
    expect(result.counts.activeVectors).toBeGreaterThan(result.logCount - 10);
    expect(result.counts.facts).toBeGreaterThanOrEqual(1);
    expect(result.counts.graphNodes).toBeGreaterThanOrEqual(2);
    expect(result.queryPlans.length).toBe(2);
    expect(result.security).toEqual({
      secretFreeDiagnostics: true,
      playgroundExcluded: true,
      deletedExcluded: true,
      noGenerationModelCall: true
    });
    expect(result.timingsMs.semanticHybridFilteredQueries).toBeLessThan(
      result.thresholds.semanticHybridFilteredQueries
    );
    expect(existsSync(artifactPath)).toBe(true);
    expect(readFileSync(artifactPath, 'utf8')).toContain('"seed": "focuslog-phase3-f-200k-v1"');
    expect(JSON.stringify(result)).not.toMatch(
      /Bearer SECRET|api[_-]?key=SECRET|raw prompt|raw provider/iu
    );
  }, 300_000);
});
