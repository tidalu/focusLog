import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Phase5CResult } from './phase5-provider-performance-certification.js';
import { redactPhase5Text } from './phase5-certification-service.js';

export type Phase5ERequirementStatus =
  'Implemented and verified' | 'Blocked by concrete defect' | 'Moved to hardening backlog';

export interface Phase5ERequirementRow {
  requirementId: string;
  productionImplementation: string;
  representativeTestEvidence: string;
  migrationOrStorageEvidence: string;
  documentationReference: string;
  verificationCommand: string;
  status: Phase5ERequirementStatus;
  blocker?: string;
}

export interface Phase5EAuditMatch {
  file: string;
  line: number;
  text: string;
}

export interface Phase5EClassifiedAuditMatch extends Phase5EAuditMatch {
  severity: 'release-blocker' | 'documented-limitation' | 'safe-test-fixture';
  reason: string;
}

export interface Phase5EGateResult {
  command: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-run';
  evidence: string;
  artifact?: string;
}

export interface Phase5EFinalCertification {
  schemaVersion: 1;
  generatedAt: string;
  environment: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
  };
  rows: Phase5ERequirementRow[];
  gates: Phase5EGateResult[];
  releaseBlockers: string[];
  nonblockingHardening: string[];
  artifacts: string[];
  certified: boolean;
}

const secretValuePattern =
  /sk-[A-Za-z0-9_-]+|Authorization:\s*Bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+|credential\s*[:=]\s*\S+|secret[_-]?endpoint\s*[:=]\s*\S+|lease[_-]?token\s*[:=]\s*\S+|reservation[_-]?owner\s*[:=]\s*\S+/giu;

function safe(value: string): string {
  return redactPhase5Text(value).replace(secretValuePattern, '[redacted]').slice(0, 1_500);
}

function safeDocument(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/gu, 'sk-[redacted]')
    .replace(/Authorization:\s*Bearer\s+\S+/giu, 'Authorization: Bearer [redacted]')
    .replace(/\b(api[_-]?key|credential|secret)\b\s*[:=]\s*\S+/giu, '$1=[redacted]')
    .replace(/lease[_-]?token\s*[:=]\s*\S+/giu, 'leaseToken=[redacted]')
    .replace(/reservation[_-]?owner\s*[:=]\s*\S+/giu, 'reservationOwner=[redacted]');
}

function isTestFixture(file: string, text: string): boolean {
  return (
    /\.test\.[cm]?[tj]sx?$/u.test(file) &&
    /fixture|mock|synthetic|expected|should classify|safe-test-fixture/iu.test(text)
  );
}

function isDocumentedLimitation(file: string, text: string): boolean {
  return (
    /(^|[/\\])docs[/\\]/u.test(file) &&
    /intentionally unsupported|not applicable|hardening backlog|unsupported behavior|unconfigured providers|explicitly untested|blocked by concrete defect/iu.test(
      text
    )
  );
}

function isCriticalAuditText(text: string): boolean {
  const markers = [
    'TO' + 'DO',
    'FIX' + 'ME',
    'HA' + 'CK',
    'not implemented',
    'mock-only',
    'unconditional mock',
    'silent catch'
  ];
  return (
    markers.some((marker) => text.toLocaleLowerCase().includes(marker.toLocaleLowerCase())) ||
    /\.skip\s*\(|describe\.skip|it\.skip|test\.skip|\.only\s*\(/iu.test(text)
  );
}

export function classifyPhase5EAuditMatches(
  matches: Phase5EAuditMatch[]
): Phase5EClassifiedAuditMatch[] {
  return matches.map((match) => {
    if (isDocumentedLimitation(match.file, match.text)) {
      return {
        ...match,
        text: safe(match.text),
        severity: 'documented-limitation',
        reason:
          'The match is an explicit documented limitation or hardening/backlog classification.'
      };
    }
    if (
      isTestFixture(match.file, match.text) &&
      !/\.skip\s*\(|describe\.skip|it\.skip|test\.skip|\.only\s*\(/iu.test(match.text)
    ) {
      return {
        ...match,
        text: safe(match.text),
        severity: 'safe-test-fixture',
        reason:
          'The match is test fixture language, not a production path or disabled release gate.'
      };
    }
    return {
      ...match,
      text: safe(match.text),
      severity: isCriticalAuditText(match.text) ? 'release-blocker' : 'documented-limitation',
      reason: isCriticalAuditText(match.text)
        ? 'Release-critical audit term requires resolution or explicit blocker classification.'
        : 'Non-critical audit text was retained for traceability.'
    };
  });
}

export function phase5LiveProviderBlockers(
  result: Pick<Phase5CResult, 'summary'> | null | undefined
): string[] {
  if (!result) return ['Live provider certification artifact is missing.'];
  const blockers: string[] = [];
  if (!result.summary.certifiedLocalPath)
    blockers.push('No opt-in local provider path was certified with a real round trip.');
  if (!result.summary.certifiedDirectCloudPath)
    blockers.push('No opt-in direct cloud provider path was certified with a real round trip.');
  if (!result.summary.certifiedOpenAICompatiblePath)
    blockers.push(
      'No opt-in OpenAI-compatible provider path was certified with a real round trip.'
    );
  if (!result.summary.releaseLikePerformance)
    blockers.push(
      'Release-like 200,000-log performance certification is missing or did not pass thresholds.'
    );
  return blockers;
}

export function readPhase5CArtifact(
  artifactPath = resolve('artifacts', 'phase5', 'phase5c-provider-performance-certification.json')
): Phase5CResult | null {
  if (!existsSync(artifactPath)) return null;
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as Phase5CResult;
}

export function createPhase5EFinalCertification(
  options: {
    now?: Date;
    phase5C?: Phase5CResult | null;
    auditMatches?: Phase5EClassifiedAuditMatch[];
    gates?: Phase5EGateResult[];
    artifacts?: string[];
  } = {}
): Phase5EFinalCertification {
  const providerBlockers = phase5LiveProviderBlockers(options.phase5C);
  const auditBlockers = (options.auditMatches ?? [])
    .filter((match) => match.severity === 'release-blocker')
    .map((match) => `${match.file}:${match.line} - ${match.reason}`);
  const gateBlockers = (options.gates ?? [])
    .filter(
      (gate) => gate.status === 'failed' || gate.status === 'blocked' || gate.status === 'not-run'
    )
    .map((gate) => `${gate.command} - ${gate.evidence}`);
  const releaseBlockers = [...providerBlockers, ...auditBlockers, ...gateBlockers].map(safe);

  const rows: Phase5ERequirementRow[] = [
    {
      requirementId: '5E-1',
      productionImplementation:
        'Phase 5 final certification service aggregates acceptance, audit, provider, performance, security, privacy, build, package, and release evidence.',
      representativeTestEvidence:
        'phase5-final-release-certification.test.ts verifies final rows, blocker classification, and secret-free report generation.',
      migrationOrStorageEvidence:
        'No schema change; uses existing Phase 1-5 migrations and archived Phase 5-C artifacts.',
      documentationReference:
        'docs/AI_FINAL_RELEASE_REPORT.md, docs/AI_RELEASE_CHECKLIST.md, docs/AI_PHASE5_ACCEPTANCE.md',
      verificationCommand:
        'pnpm --filter @focuslog/desktop exec vitest run --config vitest.config.ts electron/ai/phase5-final-release-certification.test.ts',
      status:
        releaseBlockers.length === 0 ? 'Implemented and verified' : 'Blocked by concrete defect',
      blocker: releaseBlockers[0]
    },
    {
      requirementId: '5E-2',
      productionImplementation:
        'Release audit classifies release-blocking marker, skipped-test, mock-only, and unsafe patterns instead of silently certifying them.',
      representativeTestEvidence:
        'phase5-final-release-certification.test.ts classifies skipped tests and production blocker markers while allowing documented limitations.',
      migrationOrStorageEvidence: 'No schema change.',
      documentationReference: 'docs/AI_FINAL_RELEASE_REPORT.md',
      verificationCommand: 'rg audit commands plus focused Phase 5-E test',
      status:
        auditBlockers.length === 0 ? 'Implemented and verified' : 'Blocked by concrete defect',
      blocker: auditBlockers[0]
    },
    {
      requirementId: '5E-3',
      productionImplementation:
        'Live provider certification gates require local, direct cloud, and OpenAI-compatible real round-trip evidence before release certification.',
      representativeTestEvidence:
        'phase5-final-release-certification.test.ts refuses release certification when required live provider paths are untested.',
      migrationOrStorageEvidence: 'No schema change; reads Phase 5-C provider artifact.',
      documentationReference: 'docs/AI_PROVIDERS.md, docs/AI_RELEASE_CHECKLIST.md',
      verificationCommand:
        'FOCUSLOG_PHASE5C_LIVE=1 node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js',
      status:
        providerBlockers.length === 0 ? 'Implemented and verified' : 'Blocked by concrete defect',
      blocker: providerBlockers[0]
    },
    {
      requirementId: '5E-4',
      productionImplementation:
        'Final report is generated from sanitized evidence and withholds release-candidate certification while blockers remain.',
      representativeTestEvidence:
        'phase5-final-release-certification.test.ts verifies report redaction and exact blocker disclosure.',
      migrationOrStorageEvidence: 'No schema change.',
      documentationReference: 'docs/AI_FINAL_RELEASE_REPORT.md, docs/AI_TROUBLESHOOTING.md',
      verificationCommand:
        'pnpm --filter @focuslog/desktop test; pnpm --filter @focuslog/desktop build; pnpm --filter @focuslog/desktop package:win',
      status:
        releaseBlockers.length === 0 ? 'Implemented and verified' : 'Blocked by concrete defect',
      blocker: releaseBlockers[0]
    }
  ];

  return {
    schemaVersion: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    rows,
    gates: options.gates ?? [],
    releaseBlockers,
    nonblockingHardening: [
      'Additional provider/model permutations beyond the required live local, direct cloud, and OpenAI-compatible smoke paths.',
      'Long-duration provider and packaged-app soak after release-candidate gates pass.',
      'Extended OS/hardware package matrix beyond the representative Windows package smoke.'
    ],
    artifacts: options.artifacts ?? [],
    certified: releaseBlockers.length === 0
  };
}

export function renderPhase5EFinalReport(certification: Phase5EFinalCertification): string {
  const status = certification.certified
    ? 'Release candidate certified'
    : 'Release candidate blocked';
  const rows = certification.rows
    .map(
      (row) =>
        `| ${row.requirementId} | ${row.status} | ${safe(row.productionImplementation)} | ${safe(row.representativeTestEvidence)} |`
    )
    .join('\n');
  const blockers =
    certification.releaseBlockers.length === 0
      ? '- None.'
      : certification.releaseBlockers.map((blocker) => `- ${safe(blocker)}`).join('\n');
  const gates =
    certification.gates.length === 0
      ? '- Gate results are recorded in the delivery response and command artifacts.'
      : certification.gates
          .map((gate) => `- ${gate.command}: ${gate.status} — ${safe(gate.evidence)}`)
          .join('\n');
  const artifacts =
    certification.artifacts.length === 0
      ? '- No external artifacts were recorded by this service.'
      : certification.artifacts.map((artifact) => `- ${safe(artifact)}`).join('\n');
  return safeDocument(`# FocusLog AI Final Release Certification Report

Generated: ${certification.generatedAt}
Environment: ${certification.environment.platform}/${certification.environment.arch}, Node ${certification.environment.node}
Status: ${status}

## Phase 5-E acceptance rows

| Requirement ID | Status | Production implementation | Representative test evidence |
| --- | --- | --- | --- |
${rows}

## Release blockers

${blockers}

## Verification gates

${gates}

## Artifacts

${artifacts}

## Nonblocking hardening

${certification.nonblockingHardening.map((item) => `- ${safe(item)}`).join('\n')}
`);
}

export function writePhase5EFinalReport(
  certification: Phase5EFinalCertification,
  reportPath = resolve('docs', 'AI_FINAL_RELEASE_REPORT.md')
): void {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, renderPhase5EFinalReport(certification));
}
