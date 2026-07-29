export type CrossPlatformGateStatus =
  | 'implemented_and_verified'
  | 'blocked_by_concrete_release_defect'
  | 'not_applicable_platform_absent'
  | 'moved_to_cross_platform_hardening_backlog';

export interface CrossPlatformGateRow {
  readonly id: string;
  readonly platform: string;
  readonly requirement: string;
  readonly implementation: string;
  readonly evidence: readonly string[];
  readonly verificationCommands: readonly string[];
  readonly status: CrossPlatformGateStatus;
}

export interface CrossPlatformReleaseSnapshot {
  readonly architecture: 'desktop_owned_authoritative_execution';
  readonly androidRuntimeCertification: 'blocked_flutter_unavailable';
  readonly iosCertification: 'not_applicable_platform_absent';
  readonly completionDeclarationPermitted: false;
  readonly rows: readonly CrossPlatformGateRow[];
}

export const crossPlatformReleaseSnapshot: CrossPlatformReleaseSnapshot = {
  architecture: 'desktop_owned_authoritative_execution',
  androidRuntimeCertification: 'blocked_flutter_unavailable',
  iosCertification: 'not_applicable_platform_absent',
  completionDeclarationPermitted: false,
  rows: [
    {
      id: 'X-FINAL-ARCH',
      platform: 'Desktop, backend, Android',
      requirement: 'One documented AI execution owner per job family',
      implementation:
        'Desktop/backend remain authoritative executors; Android synchronizes safe projections and outbox requests.',
      evidence: [
        'docs/AI_MOBILE_ARCHITECTURE.md',
        'contracts/ai/mobile-ai-v1.json',
        'apps/mobile/lib/ai/mobile_ai_repository.dart'
      ],
      verificationCommands: ['pnpm contracts:check', 'pnpm --filter @focuslog/shared-types test'],
      status: 'implemented_and_verified'
    },
    {
      id: 'X-FINAL-CONTRACTS',
      platform: 'Desktop, backend, Android',
      requirement:
        'Shared contracts preserve exact money, provenance, policy, deletion, and unknown-version safety',
      implementation:
        'Generated TypeScript and Dart contracts are produced from one JSON source; mobile source tests reject direct-provider execution and unsafe fields.',
      evidence: [
        'contracts/ai/mobile-ai-v1.json',
        'packages/shared-types/src/generated-contracts.ts',
        'apps/mobile/lib/generated/contracts.dart'
      ],
      verificationCommands: ['pnpm contracts:check', 'pnpm --filter @focuslog/shared-types test'],
      status: 'implemented_and_verified'
    },
    {
      id: 'X-FINAL-DESKTOP',
      platform: 'Desktop',
      requirement: 'Desktop lint, typecheck, tests, FTS benchmark, and production build pass',
      implementation:
        'Desktop AI queue, provider, budget, analysis, memory, Playground, security, and release-gate code remains the authoritative execution surface.',
      evidence: ['docs/AI_RELEASE_CHECKLIST.md', 'apps/desktop'],
      verificationCommands: [
        'pnpm --filter @focuslog/desktop lint',
        'pnpm --filter @focuslog/desktop typecheck',
        'pnpm --filter @focuslog/desktop test',
        'pnpm --filter @focuslog/desktop build'
      ],
      status: 'implemented_and_verified'
    },
    {
      id: 'X-FINAL-BACKEND',
      platform: 'Backend',
      requirement: 'Backend sync, API, and Prisma validation gates pass where configured',
      implementation:
        'Backend remains the synchronization authority for mobile-safe envelopes and owner/device/profile isolation.',
      evidence: ['apps/backend', 'docs/AI_MOBILE_SYNC.md'],
      verificationCommands: [
        'pnpm --filter @focuslog/backend lint',
        'pnpm --filter @focuslog/backend typecheck',
        'pnpm --filter @focuslog/backend test',
        'pnpm --filter @focuslog/backend build',
        'pnpm --filter @focuslog/backend prisma:validate'
      ],
      status: 'implemented_and_verified'
    },
    {
      id: 'X-FINAL-ANDROID-RUNTIME',
      platform: 'Android',
      requirement:
        'Android analyze, tests, build, install/launch, upgrade, and offline lifecycle smoke pass',
      implementation:
        'Android source paths, repository services, UI surfaces, lifecycle adapter, and CI lanes exist, but runtime verification cannot run without Flutter.',
      evidence: ['docs/AI_MOBILE_COMMANDS.md', 'docs/AI_MOBILE_RELEASE_REPORT.md', 'apps/mobile'],
      verificationCommands: ['pnpm mobile:analyze', 'pnpm mobile:test', 'pnpm mobile:build'],
      status: 'blocked_by_concrete_release_defect'
    },
    {
      id: 'X-FINAL-IOS',
      platform: 'iOS',
      requirement: 'iOS mobile AI release certification',
      implementation:
        'Not applicable because this repository has no iOS app target, Xcode project, workspace, Podfile, archive command, or simulator/device launch path.',
      evidence: ['docs/AI_MOBILE_COMMANDS.md', 'docs/AI_MOBILE_ARCHITECTURE.md'],
      verificationCommands: ['Not applicable - platform absent'],
      status: 'not_applicable_platform_absent'
    }
  ]
};
