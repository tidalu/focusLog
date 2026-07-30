import type { DesktopDatabase } from '../database/database.js';
import { providerDescriptors } from './providers.js';

export type Phase5TraceabilityStatus =
  | 'implemented'
  | 'tested'
  | 'documented'
  | 'intentionally unsupported'
  | 'nonblocking limitation'
  | 'release blocker';

export interface Phase5TraceabilityRow {
  requirement: string;
  area: string;
  code: string[];
  tests: string[];
  documents: string[];
  status: Phase5TraceabilityStatus;
  notes: string;
}

export interface Phase5Finding {
  code: string;
  message: string;
}

export interface Phase5CertificationResult {
  passed: boolean;
  findings: Phase5Finding[];
}

export interface Phase5ReleaseCertification {
  traceability: {
    total: number;
    implemented: number;
    tested: number;
    documented: number;
    intentionallyUnsupported: number;
    nonblockingLimitations: number;
    releaseBlockers: number;
  };
  credentials: Phase5CertificationResult;
  electron: Phase5CertificationResult;
  network: Phase5CertificationResult;
  prompts: Phase5CertificationResult;
  privacy: Phase5CertificationResult;
  export: Phase5CertificationResult;
  adversarial: Phase5CertificationResult;
  passed: boolean;
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{6,}/u,
  /Authorization:\s*Bearer\s+(?!\[redacted\])[A-Za-z0-9._-]+/iu,
  /\bapi[_-]?key\b\s*[:=]\s*(?!\[redacted\])[^\s,;"'}]+/iu,
  /\bcredential\b\s*[:=]\s*(?!\[redacted\])[^\s,;"'}]+/iu,
  /\bencryptedCredential\b/iu,
  /\bdatabase-key\.bin\b/iu,
  /\bbackup-recovery-key\.bin\b/iu,
  /\blease[_-]?token\b/iu,
  /\breservation[_-]?owner\b/iu,
  /https:\/\/[^/\s]+:[^@\s]+@/iu
];

const requiredTraceabilityAreas = [
  'providers',
  'queue',
  'fallback',
  'budgets',
  'analyses',
  'usage',
  'embeddings',
  'search',
  'facts',
  'graph',
  'retrieval',
  'memory-ui',
  'playground',
  'evaluation',
  'import-export',
  'switches',
  'adversarial',
  'performance'
];

export const phase5TraceabilityRows: Phase5TraceabilityRow[] = [
  {
    requirement:
      'Provider profile configuration, model discovery, capability disclosure, endpoint validation, and credential redaction',
    area: 'providers',
    code: [
      'apps/desktop/electron/ai/ai-service.ts',
      'apps/desktop/electron/ai/providers.ts',
      'apps/desktop/electron/ai/url-security.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/ai-platform.test.ts',
      'apps/desktop/electron/ai/phase5-certification-service.test.ts'
    ],
    documents: ['docs/AI_PROVIDERS.md', 'docs/AI_SECURITY.md'],
    status: 'tested',
    notes: 'Cloud endpoints require HTTPS and local HTTP is restricted to explicit local providers.'
  },
  {
    requirement:
      'Durable queue leasing, startup recovery, cancellation, stale completion protection, diagnostics, and lifecycle cleanup',
    area: 'queue',
    code: [
      'apps/desktop/electron/ai/queue-runtime.ts',
      'apps/desktop/electron/ai/job-queue.ts',
      'apps/desktop/electron/ai/job-worker.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/queue-runtime-process-loss.test.ts',
      'apps/desktop/electron/ai/queue-runtime-lifecycle.test.ts'
    ],
    documents: ['docs/AI_QUEUE.md', 'docs/AI_TROUBLESHOOTING.md'],
    status: 'tested',
    notes: 'Queue ownership tokens stay internal and are excluded from safe projections.'
  },
  {
    requirement: 'Provider fallback chains, structured repair, cancellation, and attempt history',
    area: 'fallback',
    code: [
      'apps/desktop/electron/ai/provider-execution-coordinator.ts',
      'apps/desktop/electron/ai/fallback-chain-service.ts'
    ],
    tests: ['apps/desktop/electron/ai/provider-execution-coordinator.test.ts'],
    documents: ['docs/AI_PROVIDERS.md', 'docs/AI_QUEUE.md'],
    status: 'tested',
    notes: 'Fallback decisions are policy-gated and preserve sanitized attempt history.'
  },
  {
    requirement:
      'Request/month budgets, reservations, exact micro-unit accounting, and financial recovery',
    area: 'budgets',
    code: [
      'apps/desktop/electron/ai/budget-service.ts',
      'apps/desktop/electron/ai/provider-execution-coordinator.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/budget-service.test.ts',
      'apps/desktop/electron/ai/provider-execution-coordinator.test.ts'
    ],
    documents: ['docs/AI_BUDGETS.md', 'docs/AI_PRIVACY.md'],
    status: 'tested',
    notes: 'Safe projections expose costs as exact strings, not floating-point approximations.'
  },
  {
    requirement:
      'Daily-to-yearly analyses, dependencies, scheduler/manual execution, IPC, UI, staleness, and regeneration',
    area: 'analyses',
    code: [
      'apps/desktop/electron/ai/hierarchical-analysis-handler.ts',
      'apps/desktop/electron/ai/analysis-scheduler.ts',
      'apps/desktop/src/renderer/AISettingsPage.tsx'
    ],
    tests: [
      'apps/desktop/electron/ai/hierarchical-analysis.test.ts',
      'apps/desktop/electron/ai/analysis-scheduler.test.ts'
    ],
    documents: ['docs/AI_ANALYSES.md', 'docs/AI_ARCHITECTURE.md'],
    status: 'tested',
    notes: 'The queue remains the sole provider-execution mechanism.'
  },
  {
    requirement:
      'Usage records, result linkage, cost disclosure, and export-safe usage purpose labels',
    area: 'usage',
    code: [
      'apps/desktop/electron/ai/daily-analysis-handler.ts',
      'apps/desktop/electron/ai/playground-chat-service.ts',
      'apps/desktop/electron/ai/playground-evaluation-service.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/queue-runtime-process-loss.test.ts',
      'apps/desktop/electron/ai/playground-chat-service.test.ts'
    ],
    documents: ['docs/AI_BUDGETS.md', 'docs/AI_PLAYGROUND.md'],
    status: 'tested',
    notes: 'Usage is linked to attempts/results and deduplicated across recovery.'
  },
  {
    requirement:
      'Embedding namespaces, chunking, activation, deletion, privacy, and incremental indexing',
    area: 'embeddings',
    code: [
      'apps/desktop/electron/ai/embedding-namespace-service.ts',
      'apps/desktop/electron/ai/embedding-chunking.ts',
      'apps/desktop/electron/ai/memory-retrieval-service.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/embedding-namespace-service.test.ts',
      'apps/desktop/electron/ai/memory-retrieval-service.test.ts'
    ],
    documents: ['docs/AI_EMBEDDINGS.md', 'docs/AI_MEMORY.md'],
    status: 'tested',
    notes: 'Playground namespaces are isolated from production activation.'
  },
  {
    requirement:
      'Semantic and hybrid search with FTS, metadata filters, deleted-source exclusion, and no generation call',
    area: 'search',
    code: ['apps/desktop/electron/ai/memory-retrieval-service.ts'],
    tests: [
      'apps/desktop/electron/ai/memory-retrieval-service.test.ts',
      'apps/desktop/electron/ai/phase3-performance-harness.test.ts'
    ],
    documents: ['docs/AI_RETRIEVAL.md', 'docs/AI_PERFORMANCE.md'],
    status: 'tested',
    notes: 'Search returns safe excerpts and retrieval-mode disclosure only.'
  },
  {
    requirement:
      'Evidence-backed facts, lifecycle states, corrections, deletion propagation, and privacy',
    area: 'facts',
    code: ['apps/desktop/electron/ai/fact-graph-service.ts'],
    tests: ['apps/desktop/electron/ai/fact-graph-service.test.ts'],
    documents: ['docs/AI_FACTS_GRAPH.md', 'docs/AI_MEMORY.md'],
    status: 'tested',
    notes: 'Automated facts require evidence and user corrections are overlays.'
  },
  {
    requirement:
      'Knowledge graph nodes/edges, provenance, conservative entity resolution, merge/split, and unsupported-edge cleanup',
    area: 'graph',
    code: ['apps/desktop/electron/ai/fact-graph-service.ts'],
    tests: ['apps/desktop/electron/ai/fact-graph-service.test.ts'],
    documents: ['docs/AI_FACTS_GRAPH.md', 'docs/AI_ARCHITECTURE.md'],
    status: 'tested',
    notes: 'Graph records remain derived data and retain provenance.'
  },
  {
    requirement:
      'Deterministic retrieval planner, evidence-backed Q&A, stale disclosure, and prompt-injection resistance',
    area: 'retrieval',
    code: ['apps/desktop/electron/ai/memory-retrieval-service.ts'],
    tests: ['apps/desktop/electron/ai/memory-retrieval-service.test.ts'],
    documents: ['docs/AI_RETRIEVAL.md', 'docs/AI_SECURITY.md'],
    status: 'tested',
    notes: 'Retrieved content is untrusted and cannot authorize application actions.'
  },
  {
    requirement:
      'Memory overview, semantic search UI, facts/graph controls, rebuild/delete actions, and safe IPC',
    area: 'memory-ui',
    code: [
      'apps/desktop/src/renderer/AIMemoryPage.tsx',
      'apps/desktop/electron/main.ts',
      'apps/desktop/electron/preload.cts'
    ],
    tests: ['apps/desktop/src/renderer/AIMemoryPage.test.ts'],
    documents: ['docs/AI_MEMORY.md', 'docs/AI_PRIVACY.md'],
    status: 'tested',
    notes:
      'Renderer receives safe projections without vectors, leases, credentials, or hidden prompts.'
  },
  {
    requirement:
      'Playground isolation, persistent chat, streaming/cancellation, branching, prompt/context tooling, comparison, inspectors, and UI',
    area: 'playground',
    code: [
      'apps/desktop/electron/ai/playground-chat-service.ts',
      'apps/desktop/electron/ai/playground-prompt-context-service.ts',
      'apps/desktop/electron/ai/playground-inspection-service.ts',
      'apps/desktop/src/renderer/AIPlaygroundPage.tsx'
    ],
    tests: [
      'apps/desktop/electron/ai/playground-chat-service.test.ts',
      'apps/desktop/electron/ai/playground-prompt-context-service.test.ts',
      'apps/desktop/electron/ai/playground-inspection-service.test.ts',
      'apps/desktop/src/renderer/AIPlaygroundPage.test.ts'
    ],
    documents: ['docs/AI_PLAYGROUND.md', 'docs/AI_PROMPTING.md'],
    status: 'tested',
    notes:
      'Playground data is excluded from production analyses, memory, facts, graph, and schedules.'
  },
  {
    requirement:
      'Evaluation datasets, deterministic evaluators, reproducible runs, model-evaluator labeling, and benchmark history',
    area: 'evaluation',
    code: ['apps/desktop/electron/ai/playground-evaluation-service.ts'],
    tests: ['apps/desktop/electron/ai/playground-evaluation-service.test.ts'],
    documents: ['docs/AI_EVALUATION.md'],
    status: 'tested',
    notes: 'Model-based evaluation is optional and labeled as subjective with its own cost record.'
  },
  {
    requirement:
      'Safe import/export for Playground artifacts, production-data consent, path validation, secret exclusion, and collision rejection',
    area: 'import-export',
    code: ['apps/desktop/electron/ai/playground-evaluation-service.ts'],
    tests: [
      'apps/desktop/electron/ai/playground-evaluation-service.test.ts',
      'apps/desktop/electron/ai/phase5-certification-service.test.ts'
    ],
    documents: ['docs/AI_IMPORT_EXPORT.md', 'docs/AI_SECURITY.md'],
    status: 'tested',
    notes: 'Exports omit credentials and production data requires explicit selection.'
  },
  {
    requirement: 'Independent subsystem switches and exact blocked-state disclosure',
    area: 'switches',
    code: [
      'apps/desktop/electron/ai/playground-evaluation-service.ts',
      'apps/desktop/electron/ai/ai-service.ts'
    ],
    tests: ['apps/desktop/electron/ai/playground-evaluation-service.test.ts'],
    documents: ['docs/AI_PLAYGROUND.md', 'docs/AI_TROUBLESHOOTING.md'],
    status: 'tested',
    notes:
      'A disabled subsystem reports the blocking switch without disabling unrelated local functionality.'
  },
  {
    requirement:
      'Adversarial prompt/content corpus for instruction override, credential exfiltration, cloud escalation, mutation, citation, delimiter, Unicode, and cost attacks',
    area: 'adversarial',
    code: [
      'apps/desktop/electron/ai/playground-evaluation-service.ts',
      'apps/desktop/electron/ai/phase5-certification-service.ts'
    ],
    tests: [
      'apps/desktop/electron/ai/phase5-certification-service.test.ts',
      'apps/desktop/electron/ai/playground-evaluation-service.test.ts'
    ],
    documents: ['docs/AI_SECURITY.md', 'docs/AI_RELEASE_CHECKLIST.md'],
    status: 'tested',
    notes:
      'Application boundaries sanitize diagnostics and prevent retrieved/imported content from changing policy.'
  },
  {
    requirement:
      'Phase 3 200,000-log performance harness, benchmark documentation, and release threshold evidence',
    area: 'performance',
    code: [
      'apps/desktop/electron/ai/phase3-performance-harness.ts',
      'apps/desktop/electron/ai/phase3-performance-harness-runner.ts'
    ],
    tests: ['apps/desktop/electron/ai/phase3-performance-harness.test.ts'],
    documents: ['docs/AI_PERFORMANCE.md', 'docs/AI_RELEASE_CHECKLIST.md'],
    status: 'tested',
    notes:
      'The deterministic large-data harness is retained as a release gate rather than rerun inside every PR.'
  }
];

export function redactPhase5Text(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/gu, 'sk-[redacted]')
    .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/giu, 'Authorization: Bearer [redacted]')
    .replace(/\b(api[_-]?key|credential|secret)\b\s*[:=]\s*[^\s,;"'}]+/giu, '$1=[redacted]')
    .replace(/https:\/\/([^/\s]+):([^@\s]+)@/giu, 'https://[redacted]@')
    .slice(0, 8_000);
}

function textContainsSecret(value: string): boolean {
  return secretPatterns.some((pattern) => pattern.test(value));
}

function result(findings: Phase5Finding[]): Phase5CertificationResult {
  return { passed: findings.length === 0, findings };
}

function hasPattern(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

export class Phase5CertificationService {
  constructor(
    private readonly database: DesktopDatabase | undefined,
    private readonly ownerId: string
  ) {}

  traceabilitySummary(
    rows: Phase5TraceabilityRow[] = phase5TraceabilityRows
  ): Phase5ReleaseCertification['traceability'] {
    const covered = new Set(rows.map((row) => row.area));
    const missing = requiredTraceabilityAreas.filter((area) => !covered.has(area));
    const implemented = rows.filter((row) => row.status === 'implemented').length;
    const tested = rows.filter((row) => row.status === 'tested').length;
    const documented = rows.filter((row) => row.status === 'documented').length;
    const intentionallyUnsupported = rows.filter(
      (row) => row.status === 'intentionally unsupported'
    ).length;
    const nonblockingLimitations = rows.filter(
      (row) => row.status === 'nonblocking limitation'
    ).length;
    const releaseBlockers =
      rows.filter((row) => row.status === 'release blocker').length + missing.length;
    return {
      total: rows.length,
      implemented,
      tested,
      documented,
      intentionallyUnsupported,
      nonblockingLimitations,
      releaseBlockers
    };
  }

  certifySafeProjection(name: string, projection: unknown): Phase5CertificationResult {
    const text = JSON.stringify(projection);
    const findings: Phase5Finding[] = [];
    if (textContainsSecret(text))
      findings.push({
        code: 'secret_exposure',
        message: `${name} contains a credential-shaped or internal ownership token.`
      });
    return result(findings);
  }

  certifyCredentials(projections: unknown[]): Phase5CertificationResult {
    const findings = projections.flatMap(
      (projection, index) =>
        this.certifySafeProjection(`credential_projection_${index + 1}`, projection).findings
    );
    if (this.database) {
      const tables = this.database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ai_provider_profiles','ai_cloud_consents')"
        )
        .all() as Array<{ name: string }>;
      const names = new Set(tables.map((row) => row.name));
      if (!names.has('ai_provider_profiles'))
        findings.push({
          code: 'missing_profile_table',
          message: 'Provider profile table is unavailable for credential certification.'
        });
      if (!names.has('ai_cloud_consents'))
        findings.push({
          code: 'missing_consent_table',
          message: 'Consent evidence table is unavailable for privacy certification.'
        });
    }
    return result(findings);
  }

  certifyElectronSecurity(sources: {
    main: string;
    preload: string;
    renderer?: string;
  }): Phase5CertificationResult {
    const findings: Phase5Finding[] = [];
    if (!hasPattern(sources.main, /contextIsolation:\s*true/u))
      findings.push({
        code: 'context_isolation_missing',
        message: 'BrowserWindow must enable context isolation.'
      });
    if (
      hasPattern(sources.main, /nodeIntegration:\s*true/u) ||
      !hasPattern(sources.main, /nodeIntegration:\s*false/u)
    )
      findings.push({
        code: 'node_integration_enabled',
        message: 'Renderer Node integration must remain disabled.'
      });
    if (!hasPattern(sources.main, /sandbox:\s*true/u))
      findings.push({
        code: 'sandbox_missing',
        message: 'BrowserWindow sandbox must remain enabled.'
      });
    if (
      !hasPattern(sources.main, /Content-Security-Policy/u) ||
      !hasPattern(sources.main, /frame-ancestors 'none'/u)
    )
      findings.push({
        code: 'csp_missing',
        message: 'Main process must register a restrictive Content-Security-Policy.'
      });
    if (!hasPattern(sources.preload, /contextBridge\.exposeInMainWorld\('focuslog'/u))
      findings.push({
        code: 'preload_allowlist_missing',
        message: 'Preload must expose a single allowlisted focuslog bridge.'
      });
    if (hasPattern(sources.preload, /ipcRenderer\.send\(/u))
      findings.push({
        code: 'unsafe_ipc_send',
        message: 'Preload must use request/response invoke APIs, not open fire-and-forget sends.'
      });
    if (
      hasPattern(
        sources.main + sources.preload + (sources.renderer ?? ''),
        /child_process|execFile|spawn\(/u
      )
    )
      findings.push({
        code: 'arbitrary_execution_surface',
        message:
          'AI renderer/preload/main security surface must not expose arbitrary command execution.'
      });
    if (textContainsSecret(sources.preload))
      findings.push({
        code: 'preload_secret_literal',
        message: 'Preload source contains credential-shaped content.'
      });
    return result(findings);
  }

  certifyNetworkSecurity(): Phase5CertificationResult {
    const findings: Phase5Finding[] = [];
    for (const descriptor of providerDescriptors) {
      if (
        descriptor.kind === 'CLOUD' &&
        descriptor.defaultEndpoint &&
        !descriptor.defaultEndpoint.startsWith('https://')
      )
        findings.push({
          code: 'cloud_endpoint_not_https',
          message: `${descriptor.id} default endpoint is not HTTPS.`
        });
      if (
        descriptor.kind === 'LOCAL' &&
        descriptor.defaultEndpoint &&
        !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)/u.test(descriptor.defaultEndpoint)
      )
        findings.push({
          code: 'local_endpoint_not_loopback',
          message: `${descriptor.id} local endpoint is not loopback or HTTPS.`
        });
    }
    return result(findings);
  }

  certifyPromptContentSecurity(sources: string[]): Phase5CertificationResult {
    const joined = sources.join('\n');
    const findings: Phase5Finding[] = [];
    if (
      !hasPattern(
        joined,
        /untrusted|delimiter|retrieved content is untrusted|Treat .* as untrusted/iu
      )
    )
      findings.push({
        code: 'untrusted_delimiter_missing',
        message: 'Prompt/retrieval documentation or code must declare untrusted-content boundaries.'
      });
    if (!hasPattern(joined, /structured|schema|validate/iu))
      findings.push({
        code: 'structured_validation_missing',
        message: 'Prompt/content flow must include structured validation or schema checks.'
      });
    if (textContainsSecret(joined))
      findings.push({
        code: 'prompt_secret_literal',
        message: 'Prompt/security source contains credential-shaped content.'
      });
    return result(findings);
  }

  certifyPrivacyLifecycle(): Phase5CertificationResult {
    const findings: Phase5Finding[] = [];
    if (!this.database) return result(findings);
    const settings = this.database
      .prepare('SELECT mode FROM ai_settings WHERE owner_id = ?')
      .get(this.ownerId) as { mode: string } | undefined;
    if (!settings)
      findings.push({
        code: 'missing_privacy_settings',
        message: 'AI privacy mode settings are not initialized.'
      });
    const consentColumns = this.database
      .prepare('PRAGMA table_info(ai_cloud_consents)')
      .all() as Array<{ name: string }>;
    const columnNames = new Set(consentColumns.map((column) => column.name));
    for (const required of ['owner_id', 'provider_profile_id', 'mode', 'consented_at'])
      if (!columnNames.has(required))
        findings.push({
          code: 'missing_consent_evidence',
          message: `Consent evidence is missing ${required}.`
        });
    for (const unsafe of ['prompt', 'raw_response', 'api_key', 'credential'])
      if (columnNames.has(unsafe))
        findings.push({
          code: 'overlogged_consent',
          message: `Consent evidence must not store ${unsafe}.`
        });
    return result(findings);
  }

  certifyAdversarialDiagnostics(inputs: string[]): Phase5CertificationResult {
    const findings: Phase5Finding[] = [];
    const sanitized = inputs.map((input) => redactPhase5Text(input));
    if (sanitized.some(textContainsSecret))
      findings.push({
        code: 'adversarial_secret_leak',
        message: 'Sanitized adversarial diagnostics still contain credential-shaped content.'
      });
    if (sanitized.some((message) => message.length > 8_000))
      findings.push({
        code: 'adversarial_unbounded',
        message: 'Adversarial diagnostics are not bounded.'
      });
    return result(findings);
  }

  certifyRelease(input: {
    mainSource: string;
    preloadSource: string;
    rendererSource?: string;
    promptSources: string[];
    safeProjections: unknown[];
    exportBundles: unknown[];
    adversarialInputs: string[];
  }): Phase5ReleaseCertification {
    const traceability = this.traceabilitySummary();
    const credentials = this.certifyCredentials(input.safeProjections);
    const electron = this.certifyElectronSecurity({
      main: input.mainSource,
      preload: input.preloadSource,
      renderer: input.rendererSource
    });
    const network = this.certifyNetworkSecurity();
    const prompts = this.certifyPromptContentSecurity(input.promptSources);
    const privacy = this.certifyPrivacyLifecycle();
    const exportResult = result(
      input.exportBundles.flatMap(
        (bundle, index) => this.certifySafeProjection(`export_${index + 1}`, bundle).findings
      )
    );
    const adversarial = this.certifyAdversarialDiagnostics(input.adversarialInputs);
    const passed =
      traceability.releaseBlockers === 0 &&
      [credentials, electron, network, prompts, privacy, exportResult, adversarial].every(
        (item) => item.passed
      );
    return {
      traceability,
      credentials,
      electron,
      network,
      prompts,
      privacy,
      export: exportResult,
      adversarial,
      passed
    };
  }
}
