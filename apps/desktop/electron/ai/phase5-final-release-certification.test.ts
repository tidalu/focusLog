import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  classifyPhase5EAuditMatches,
  createPhase5EFinalCertification,
  phase5LiveProviderBlockers,
  renderPhase5EFinalReport,
  writePhase5EFinalReport
} from './phase5-final-release-certification.js';
import type { Phase5CResult } from './phase5-provider-performance-certification.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function phase5C(summary: Partial<Phase5CResult['summary']>): Phase5CResult {
  return {
    schemaVersion: 1,
    date: '2026-07-29',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    providers: [],
    summary: {
      configuredProviders: 0,
      certifiedProviders: 0,
      failedProviders: 0,
      untestedProviders: [],
      certifiedLocalPath: false,
      certifiedDirectCloudPath: false,
      certifiedOpenAICompatiblePath: false,
      releaseLikePerformance: false,
      ...summary
    },
    secretFree: true
  };
}

describe('Phase 5-E final release certification', () => {
  it('refuses final certification when required live provider paths are missing', () => {
    const blockers = phase5LiveProviderBlockers(phase5C({ releaseLikePerformance: true }));
    expect(blockers).toContain(
      'No opt-in local provider path was certified with a real round trip.'
    );
    expect(blockers).toContain(
      'No opt-in direct cloud provider path was certified with a real round trip.'
    );
    expect(blockers).toContain(
      'No opt-in OpenAI-compatible provider path was certified with a real round trip.'
    );

    const certification = createPhase5EFinalCertification({
      now: new Date('2026-07-29T12:00:00.000Z'),
      phase5C: phase5C({ releaseLikePerformance: true })
    });
    expect(certification.certified).toBe(false);
    expect(certification.rows.find((row) => row.requirementId === '5E-3')?.status).toBe(
      'Blocked by concrete defect'
    );
  });

  it('certifies only when live provider paths, performance, audit, and gates all pass', () => {
    const certification = createPhase5EFinalCertification({
      now: new Date('2026-07-29T12:00:00.000Z'),
      phase5C: phase5C({
        certifiedLocalPath: true,
        certifiedDirectCloudPath: true,
        certifiedOpenAICompatiblePath: true,
        releaseLikePerformance: true
      }),
      auditMatches: [],
      gates: [
        { command: 'pnpm --filter @focuslog/desktop lint', status: 'passed', evidence: '0 errors' },
        {
          command: 'pnpm --filter @focuslog/desktop typecheck',
          status: 'passed',
          evidence: '0 errors'
        }
      ]
    });
    expect(certification.certified).toBe(true);
    expect(certification.releaseBlockers).toEqual([]);
    expect(certification.rows.every((row) => row.status === 'Implemented and verified')).toBe(true);
  });

  it('classifies production TODOs and skipped tests as blockers while allowing documented limitations and fixtures', () => {
    const classified = classifyPhase5EAuditMatches([
      {
        file: 'apps/desktop/electron/ai/provider.ts',
        line: 10,
        text: 'TODO: wire real provider before release'
      },
      {
        file: 'apps/desktop/electron/ai/provider.test.ts',
        line: 20,
        text: 'it.skip("critical gate", () => {})'
      },
      {
        file: 'apps/desktop/electron/ai/provider.test.ts',
        line: 30,
        text: 'const mockFixture = "synthetic fixture text";'
      },
      {
        file: 'docs/AI_PROVIDERS.md',
        line: 40,
        text: 'Unconfigured providers are explicitly untested.'
      }
    ]);
    expect(classified.map((item) => item.severity)).toEqual([
      'release-blocker',
      'release-blocker',
      'safe-test-fixture',
      'documented-limitation'
    ]);
  });

  it('renders and writes a secret-free final report with blockers and artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'focuslog-phase5e-'));
    roots.push(root);
    const certification = createPhase5EFinalCertification({
      now: new Date('2026-07-29T12:00:00.000Z'),
      phase5C: phase5C({ releaseLikePerformance: true }),
      gates: [
        {
          command:
            'FOCUSLOG_PHASE5C_LIVE=1 node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js',
          status: 'blocked',
          evidence:
            'Missing opt-in endpoint with api_key=sk-SECRET and Authorization: Bearer abc123'
        }
      ],
      artifacts: ['artifacts/phase5/phase5c-provider-performance-certification.json']
    });
    const report = renderPhase5EFinalReport(certification);
    expect(report).toContain('Release candidate blocked');
    expect(report).toContain('artifacts/phase5/phase5c-provider-performance-certification.json');
    expect(report).not.toMatch(/sk-SECRET|Bearer abc123|api_key=sk/iu);

    const reportPath = join(root, 'AI_FINAL_RELEASE_REPORT.md');
    writePhase5EFinalReport(certification, reportPath);
    expect(existsSync(reportPath)).toBe(true);
    expect(readFileSync(reportPath, 'utf8')).toBe(report);
  });

  it('keeps Phase 5-E rows in the allowed acceptance-status vocabulary', () => {
    const certification = createPhase5EFinalCertification({
      phase5C: phase5C({
        certifiedLocalPath: true,
        certifiedDirectCloudPath: true,
        certifiedOpenAICompatiblePath: true,
        releaseLikePerformance: true
      })
    });
    const allowed = new Set([
      'Implemented and verified',
      'Blocked by concrete defect',
      'Moved to hardening backlog'
    ]);
    expect(certification.rows.length).toBeGreaterThanOrEqual(4);
    expect(certification.rows.every((row) => allowed.has(row.status))).toBe(true);
    expect(JSON.stringify(certification.rows)).not.toMatch(
      /raw provider response|Authorization:\s*Bearer\s+\S+|sk-[A-Za-z0-9_-]{6,}/iu
    );
  });
});
