import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertPhase5DSecretFree,
  Phase5UXDiagnosticsPackagingService,
  redactPhase5DDiagnosticText
} from './phase5-ux-diagnostics-packaging-service.js';

const desktopRoot = join(import.meta.dirname, '..', '..');
const workspaceRoot = join(desktopRoot, '..', '..');

function workspaceSource(path: string): string {
  return readFileSync(join(workspaceRoot, path), 'utf8');
}

function desktopSource(path: string): string {
  return readFileSync(join(desktopRoot, path), 'utf8');
}

function service(): Phase5UXDiagnosticsPackagingService {
  return new Phase5UXDiagnosticsPackagingService(
    desktopRoot,
    () => new Date('2026-07-29T00:00:00.000Z')
  );
}

describe('Phase 5-D UX recovery, diagnostics, packaging, and CI release gates', () => {
  it('certifies representative UX recovery states with actionable safe messages', () => {
    const result = service().certify();
    expect(result.passed).toBe(true);
    expect(result.uxStates.length).toBeGreaterThanOrEqual(18);
    for (const state of [
      'empty provider list',
      'invalid config',
      'missing local model',
      'consent required',
      'budget exceeded',
      'queue delay',
      'dead letter',
      'stale result',
      'rebuild in progress',
      'streaming',
      'cancelled',
      'import rejected'
    ]) {
      expect(result.uxStates.some((item) => item.state === state)).toBe(true);
    }
    expect(
      result.uxStates.every((item) => item.dataSafety.length > 0 && item.nextAction.length > 0)
    ).toBe(true);
    expect(JSON.stringify(result.uxStates)).not.toMatch(
      /stack trace|sk-PHASE5D|Authorization:\s*Bearer|raw provider response body/iu
    );
  });

  it('exports diagnostics without credentials, private prompts, provider responses, leases, or secret endpoints by default', () => {
    const exported = service().diagnosticExport({
      diagnostics: [
        {
          code: 'PROVIDER_UNAVAILABLE',
          message:
            'Authorization: Bearer SECRET api_key=sk-PHASE5D_SECRET raw provider response lease_token=LEASE reservation_owner=OWNER secret_endpoint=https://secret.example'
        }
      ],
      settledMicros: '123',
      reservedMicros: '45'
    });
    expect(exported.schemaVersion).toBe(1);
    expect(exported.generatedAt).toBe('2026-07-29T00:00:00.000Z');
    expect(exported.usage).toMatchObject({
      exactMoneyFormat: 'micro-usd-string',
      settledMicros: '123',
      reservedMicros: '45'
    });
    expect(exported.providers).toMatchObject({
      credentialValuesIncluded: false,
      rawProviderResponsesIncluded: false
    });
    expect(exported.exclusions).toEqual(
      expect.arrayContaining([
        'credentials',
        'authorization headers',
        'raw private logs',
        'full private prompts',
        'raw provider responses',
        'lease tokens',
        'reservation-owner tokens',
        'secret endpoints'
      ])
    );
    expect(exported.userContentIncluded).toBe(false);
    expect(assertPhase5DSecretFree(exported)).toBe(true);
    expect(JSON.stringify(exported)).not.toMatch(
      /PHASE5D_SECRET|Authorization: Bearer SECRET|lease_token=LEASE|reservation_owner=OWNER|secret\.example/iu
    );
  });

  it('requires explicit warning when private diagnostic content is selected', () => {
    const exported = service().diagnosticExport({ includePrivateContent: true });
    expect(exported.userContentIncluded).toBe(true);
    expect(exported.privateContentWarning).toContain('explicitly selected');
    expect(assertPhase5DSecretFree(exported)).toBe(true);
  });

  it('certifies accessibility, packaging scenarios, and protected CI lanes', () => {
    const result = service().certify();
    expect(result.accessibility.map((item) => item.category)).toEqual(
      expect.arrayContaining([
        'keyboard operation',
        'visible focus',
        'screen-reader names',
        'status announcements',
        'accessible tables and errors',
        'streaming and cancellation controls'
      ])
    );
    expect(result.packaging.map((item) => item.scenario)).toEqual(
      expect.arrayContaining([
        'clean install',
        'upgrade from latest stable',
        'large database upgrade',
        'uninstall/reinstall',
        'missing local model software',
        'native vector/database dependency',
        'unsafe shipment exclusions'
      ])
    );
    expect(result.ci.map((item) => item.lane)).toEqual(['fast-pr', 'nightly', 'release-candidate']);
    expect(result.ci.every((item) => item.protectedSecrets)).toBe(true);
  });

  it('validates production IPC, renderer, packaging config, and CI workflow evidence', () => {
    const main = desktopSource('electron/main.ts');
    const preload = desktopSource('electron/preload.cts');
    const rendererTypes = desktopSource('src/renderer/vite-env.d.ts');
    const settingsPage = desktopSource('src/renderer/AISettingsPage.tsx');
    const packageJson = desktopSource('package.json');
    const workflow = workspaceSource('.github/workflows/desktop-ai-release-gates.yml');
    const windowsWorkflow = workspaceSource('.github/workflows/windows-desktop.yml');

    expect(main).toContain('Phase5UXDiagnosticsPackagingService');
    expect(main).toContain('focuslog:ai-phase5d-certification');
    expect(main).toContain('focuslog:ai-diagnostic-export');
    expect(preload).toContain('aiPhase5DCertification');
    expect(preload).toContain('aiDiagnosticExport');
    expect(rendererTypes).toContain('aiPhase5DCertification');
    expect(settingsPage).toContain('AI recovery, accessibility, packaging, and diagnostic export');
    expect(settingsPage).toContain('Preview safe diagnostic export');
    expect(settingsPage).toContain('raw provider responses');
    expect(settingsPage).not.toMatch(/api[_-]?key\s*[:=]|Authorization:\s*Bearer|sk-PHASE5D/iu);

    expect(packageJson).toContain('"package:win"');
    expect(packageJson).toContain('"files"');
    expect(packageJson).toContain('"dist/renderer/**"');
    expect(packageJson).toContain('"dist-electron/**"');
    expect(packageJson).not.toContain('"artifacts/**"');
    expect(packageJson).not.toContain('*.map');

    expect(workflow).toContain('fast-pr');
    expect(workflow).toContain('nightly');
    expect(workflow).toContain('release-candidate');
    expect(workflow).toContain('pnpm --filter @focuslog/desktop package:win');
    expect(workflow).toContain("github.event_name != 'pull_request'");
    expect(workflow).toContain('FOCUSLOG_PHASE5C_LIVE');
    expect(windowsWorkflow).toContain('Clean-install smoke test');
  });

  it('updates Phase 5-D acceptance and hardening documentation with no secret leakage', () => {
    const acceptance = workspaceSource('docs/AI_PHASE5_ACCEPTANCE.md');
    const hardening = workspaceSource('docs/AI_PHASE5_HARDENING_BACKLOG.md');
    const troubleshooting = workspaceSource('docs/AI_TROUBLESHOOTING.md');
    const setup = workspaceSource('docs/AI_SETUP.md');
    const security = workspaceSource('docs/AI_SECURITY.md');
    const performance = workspaceSource('docs/AI_PERFORMANCE.md');
    const releaseChecklist = workspaceSource('docs/AI_RELEASE_CHECKLIST.md');

    for (const row of ['5D-1', '5D-2', '5D-3', '5D-4']) {
      expect(acceptance).toContain(`| ${row} |`);
    }
    expect(hardening).toContain('Formal third-party accessibility audit');
    expect(troubleshooting).toContain('Phase 5-D UX recovery');
    expect(setup).toContain('Desktop AI packaging and release gates');
    expect(security).toContain('Phase 5-D diagnostics');
    expect(performance).toContain('Phase 5-D resource controls');
    expect(releaseChecklist).toContain('Phase 5-D UX, diagnostics, packaging, and CI gates');
    expect(
      redactPhase5DDiagnosticText(
        `${acceptance}\n${hardening}\n${troubleshooting}\n${setup}\n${security}\n${performance}\n${releaseChecklist}`
      )
    ).not.toMatch(/sk-[A-Za-z0-9_-]+|Authorization:\s*Bearer\s+\S+/u);
  });
});
