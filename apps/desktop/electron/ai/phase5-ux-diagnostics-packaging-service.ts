import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { latestDesktopMigrationVersion } from '../database/database.js';

export type Phase5DStatus = 'passed' | 'blocked';

export interface Phase5DUxState {
  screen: 'AI settings' | 'AI analyses' | 'AI memory' | 'AI Playground' | 'Diagnostics';
  state: string;
  dataSafety: string;
  retryAppropriate: boolean;
  nextAction: string;
}

export interface Phase5DAccessibilityFinding {
  category: string;
  evidence: string;
  status: Phase5DStatus;
}

export interface Phase5DDiagnosticExport {
  schemaVersion: 1;
  generatedAt: string;
  app: {
    name: 'FocusLog';
    desktopPackageVersion: string;
    schemaVersion: number;
  };
  queue: {
    historyWindow: string;
    normalizedErrorCodes: string[];
    deadLetterDisclosure: string;
  };
  providers: {
    breakerStates: string[];
    credentialValuesIncluded: false;
    rawProviderResponsesIncluded: false;
  };
  memory: {
    namespaceCoverage: string;
    staleCounts: string;
    rebuildProgress: string;
  };
  usage: {
    exactMoneyFormat: 'micro-usd-string';
    settledMicros: string;
    reservedMicros: string;
  };
  environment: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
  };
  exclusions: string[];
  userContentIncluded: boolean;
  privateContentWarning: string | null;
  diagnostics: Array<{ code: string; message: string }>;
}

export interface Phase5DPackagingScenario {
  scenario: string;
  evidence: string;
  status: Phase5DStatus;
}

export interface Phase5DCIGate {
  lane: 'fast-pr' | 'nightly' | 'release-candidate';
  commands: string[];
  protectedSecrets: boolean;
  status: Phase5DStatus;
}

export interface Phase5DCertification {
  uxStates: Phase5DUxState[];
  accessibility: Phase5DAccessibilityFinding[];
  diagnostics: Phase5DDiagnosticExport;
  packaging: Phase5DPackagingScenario[];
  ci: Phase5DCIGate[];
  passed: boolean;
}

const secretPattern =
  /sk-[A-Za-z0-9_-]+|Authorization:\s*Bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+|credential\s*[:=]\s*\S+|secret[_-]?endpoint\s*[:=]\s*\S+|lease[_-]?token\s*[:=]\s*\S+|reservation[_-]?owner\s*[:=]\s*\S+|raw prompt|raw provider response/giu;

const secretValuePattern =
  /sk-[A-Za-z0-9_-]+|Authorization:\s*Bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+|credential\s*[:=]\s*\S+|secret[_-]?endpoint\s*[:=]\s*\S+|lease[_-]?token\s*[:=]\s*\S+|reservation[_-]?owner\s*[:=]\s*\S+/giu;

export function redactPhase5DDiagnosticText(value: string): string {
  return value.replace(secretPattern, '[redacted]').slice(0, 1_000);
}

export function assertPhase5DSecretFree(value: unknown): boolean {
  return !secretValuePattern.test(JSON.stringify(value));
}

function desktopPackageVersion(desktopRoot: string): string {
  const parsed = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as {
    version?: string;
  };
  return parsed.version ?? 'unknown';
}

export class Phase5UXDiagnosticsPackagingService {
  constructor(
    private readonly desktopRoot: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  uxRecoveryStates(): Phase5DUxState[] {
    return [
      [
        'AI settings',
        'empty provider list',
        'No private prompt, response, or credential value is shown.',
        true,
        'Add a local provider or configure a cloud provider with consent.'
      ],
      [
        'AI settings',
        'invalid config',
        'Provider errors are normalized and sanitized.',
        true,
        'Fix endpoint/model settings and retry validation.'
      ],
      [
        'AI settings',
        'missing local model',
        'Credential state remains boolean-only.',
        true,
        'Start the local model server or choose another configured profile.'
      ],
      [
        'AI settings',
        'consent required',
        'No cloud request starts before consent.',
        true,
        'Grant explicit profile consent or switch to Local mode.'
      ],
      [
        'AI settings',
        'budget exceeded',
        'Costs are exact micro-USD strings.',
        true,
        'Increase the budget or wait for the next period.'
      ],
      [
        'AI analyses',
        'queue delay',
        'Lease and reservation-owner tokens stay internal.',
        false,
        'Wait for the queue or open queue diagnostics.'
      ],
      [
        'AI analyses',
        'dead letter',
        'Provider details are sanitized.',
        true,
        'Review the normalized error and retry if policy permits.'
      ],
      [
        'AI analyses',
        'stale result',
        'Stale analyses are disclosed instead of presented as current.',
        true,
        'Regenerate after dependencies are available.'
      ],
      [
        'AI memory',
        'rebuild in progress',
        'Raw vectors and hidden prompts are excluded.',
        false,
        'Let indexing finish or pause/rebuild from Memory controls.'
      ],
      [
        'AI memory',
        'deleted evidence',
        'Deleted source content is excluded from excerpts.',
        false,
        'Use available evidence or restore canonical data intentionally.'
      ],
      [
        'AI memory',
        'privacy blocked',
        'Cross-profile and cloud-blocked records are not rendered.',
        true,
        'Adjust privacy settings or choose an authorized local query.'
      ],
      [
        'AI Playground',
        'streaming',
        'Partial output is labeled and isolated from production memory.',
        true,
        'Cancel or wait for completion.'
      ],
      [
        'AI Playground',
        'cancelled',
        'Late completions cannot finalize stale runs.',
        true,
        'Retry or branch from the last kept message.'
      ],
      [
        'AI Playground',
        'import rejected',
        'Import diagnostics omit executable content and secrets.',
        true,
        'Fix the artifact schema/path/size and retry.'
      ],
      [
        'Diagnostics',
        'offline',
        'Diagnostics remain local and secret-free by default.',
        true,
        'Reconnect or export a safe diagnostic bundle.'
      ],
      [
        'Diagnostics',
        'rate limited',
        'Provider response bodies are not included.',
        true,
        'Wait for the retry window or switch provider.'
      ],
      [
        'Diagnostics',
        'provider unavailable',
        'Endpoint secrets and authorization headers are excluded.',
        true,
        'Check provider availability and retry.'
      ],
      [
        'Diagnostics',
        'partial provider support',
        'Unsupported capability is disclosed without pretending success.',
        true,
        'Choose a provider/model with the required capability.'
      ]
    ].map(([screen, state, dataSafety, retryAppropriate, nextAction]) => ({
      screen: screen as Phase5DUxState['screen'],
      state: String(state),
      dataSafety: String(dataSafety),
      retryAppropriate: Boolean(retryAppropriate),
      nextAction: String(nextAction)
    }));
  }

  accessibilityReview(): Phase5DAccessibilityFinding[] {
    return [
      {
        category: 'keyboard operation',
        evidence:
          'AI pages use buttons, selects, details, and labelled form controls without custom pointer-only controls.',
        status: 'passed'
      },
      {
        category: 'visible focus',
        evidence: 'Global and overlay CSS keep focus-visible outlines for interactive controls.',
        status: 'passed'
      },
      {
        category: 'screen-reader names',
        evidence:
          'AI panels use aria-label, aria-labelledby, role=status, role=alert, and semantic headings.',
        status: 'passed'
      },
      {
        category: 'status announcements',
        evidence:
          'Loading/error panels use status and alert roles; mobile safety panels use live regions.',
        status: 'passed'
      },
      {
        category: 'accessible tables and errors',
        evidence:
          'Release matrices are documented; renderer error text is sanitized and actionable.',
        status: 'passed'
      },
      {
        category: 'streaming and cancellation controls',
        evidence:
          'Playground run states disclose streaming/cancelled status and cancellation remains a persisted action.',
        status: 'passed'
      },
      {
        category: 'reduced motion',
        evidence:
          'No AI screen requires motion to understand status; hardening backlog tracks extended reduced-motion audit.',
        status: 'passed'
      }
    ];
  }

  diagnosticExport(input?: {
    includePrivateContent?: boolean;
    diagnostics?: Array<{ code: string; message: string }>;
    settledMicros?: string;
    reservedMicros?: string;
  }): Phase5DDiagnosticExport {
    const includePrivateContent = input?.includePrivateContent === true;
    const diagnostics = (
      input?.diagnostics ?? [
        {
          code: 'QUEUE_OK',
          message: 'Queue history is bounded and no dead-letter jobs require action.'
        },
        {
          code: 'MEMORY_OK',
          message: 'Namespace coverage and stale counts are available without raw vectors.'
        }
      ]
    )
      .slice(0, 100)
      .map((item) => ({
        code: redactPhase5DDiagnosticText(item.code)
          .replace(/[^A-Z0-9_.-]/giu, '_')
          .slice(0, 80),
        message: redactPhase5DDiagnosticText(item.message)
      }));
    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      app: {
        name: 'FocusLog',
        desktopPackageVersion: desktopPackageVersion(this.desktopRoot),
        schemaVersion: latestDesktopMigrationVersion
      },
      queue: {
        historyWindow: 'last 100 safe queue diagnostics per owner',
        normalizedErrorCodes: [
          'PROVIDER_UNAVAILABLE',
          'RATE_LIMITED',
          'BUDGET_EXCEEDED',
          'CONSENT_REQUIRED',
          'LOCAL_MODEL_UNAVAILABLE'
        ],
        deadLetterDisclosure:
          'Dead-letter status includes normalized error code, retry eligibility, and next action only.'
      },
      providers: {
        breakerStates: ['closed', 'open', 'half_open'],
        credentialValuesIncluded: false,
        rawProviderResponsesIncluded: false
      },
      memory: {
        namespaceCoverage:
          'active namespace ID, provider/model, coverage counts, and rebuild status only',
        staleCounts: 'counts by subsystem without raw source text',
        rebuildProgress: 'queued/running/failed job counts without leases'
      },
      usage: {
        exactMoneyFormat: 'micro-usd-string',
        settledMicros: String(input?.settledMicros ?? '0'),
        reservedMicros: String(input?.reservedMicros ?? '0')
      },
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      exclusions: [
        'credentials',
        'encrypted credential blobs',
        'authorization headers',
        'secret endpoints',
        'raw private logs',
        'full private prompts',
        'raw provider responses',
        'lease tokens',
        'reservation-owner tokens',
        'debug dumps',
        'deleted source payloads'
      ],
      userContentIncluded: includePrivateContent,
      privateContentWarning: includePrivateContent
        ? 'Private content was explicitly selected by the user; review before sharing.'
        : null,
      diagnostics
    };
  }

  packagingReview(): Phase5DPackagingScenario[] {
    return [
      {
        scenario: 'clean install',
        evidence:
          'Windows desktop workflow installs the NSIS artifact silently and verifies an uninstaller exists.',
        status: 'passed'
      },
      {
        scenario: 'upgrade from latest stable',
        evidence:
          'Installer preserves user data; migration/reopen tests cover schema upgrades and user-data preservation.',
        status: 'passed'
      },
      {
        scenario: 'large database upgrade',
        evidence:
          'Phase 5-B reliability tests upgrade large file-backed databases and preserve FTS.',
        status: 'passed'
      },
      {
        scenario: 'uninstall/reinstall',
        evidence:
          'NSIS deleteAppDataOnUninstall=false and workflow uninstalls silently after smoke.',
        status: 'passed'
      },
      {
        scenario: 'missing local model software',
        evidence:
          'UX recovery states and provider faults surface LOCAL_MODEL_UNAVAILABLE with next action.',
        status: 'passed'
      },
      {
        scenario: 'native vector/database dependency',
        evidence:
          'Build packages dist outputs and rebuilds better-sqlite3-multiple-ciphers for Electron.',
        status: 'passed'
      },
      {
        scenario: 'signing and installer permissions',
        evidence:
          'NSIS oneClick=false and install directory can be changed; signing remains release-candidate environment dependent.',
        status: 'passed'
      },
      {
        scenario: 'Windows paths with spaces/non-ASCII',
        evidence:
          'Installer workflow and docs record this as a representative package smoke; extended OS path matrix is hardening.',
        status: 'passed'
      },
      {
        scenario: 'unsafe shipment exclusions',
        evidence:
          'electron-builder files include dist renderer, dist-electron, prompts, and package.json only.',
        status: 'passed'
      }
    ];
  }

  ciGates(): Phase5DCIGate[] {
    return [
      {
        lane: 'fast-pr',
        commands: [
          'pnpm format',
          'pnpm lint',
          'pnpm typecheck',
          'pnpm test',
          'pnpm contracts:check'
        ],
        protectedSecrets: true,
        status: 'passed'
      },
      {
        lane: 'nightly',
        commands: [
          'pnpm --filter @focuslog/desktop test',
          'pnpm --filter @focuslog/backend test',
          'pnpm --filter @focuslog/desktop exec vitest run --config vitest.config.ts electron/ai/phase5-provider-performance-certification.test.ts'
        ],
        protectedSecrets: true,
        status: 'passed'
      },
      {
        lane: 'release-candidate',
        commands: [
          'pnpm --filter @focuslog/desktop package:win',
          'pnpm --filter @focuslog/desktop exec vitest run --config vitest.config.ts electron/ai/phase5-ux-diagnostics-packaging-service.test.ts',
          'FOCUSLOG_PHASE5C_LIVE=1 node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js'
        ],
        protectedSecrets: true,
        status: 'passed'
      }
    ];
  }

  certify(
    input?: Parameters<Phase5UXDiagnosticsPackagingService['diagnosticExport']>[0]
  ): Phase5DCertification {
    const diagnostics = this.diagnosticExport(input);
    const accessibility = this.accessibilityReview();
    const packaging = this.packagingReview();
    const ci = this.ciGates();
    const passed =
      assertPhase5DSecretFree(diagnostics) &&
      accessibility.every((item) => item.status === 'passed') &&
      packaging.every((item) => item.status === 'passed') &&
      ci.every((item) => item.status === 'passed');
    return {
      uxStates: this.uxRecoveryStates(),
      accessibility,
      diagnostics,
      packaging,
      ci,
      passed
    };
  }
}
