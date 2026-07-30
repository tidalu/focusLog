# FocusLog Mobile AI Release Report

Date: 2026-07-29

## Scope

This report covers Mobile Phase M-I: the mobile-only release gate for migrations, verification, builds, installation, upgrade, documentation, and certification.

Android is present as a Flutter application. iOS is not applicable because this repository has no `apps/mobile/ios` directory, Xcode project, workspace, Podfile, entitlement file, or iOS command.

## Architecture certified by source evidence

- Mobile AI execution remains desktop-owned.
- Android stores synchronized, mobile-safe AI projections in encrypted SQLite/SQLCipher-backed Drift storage.
- Provider credentials are not synchronized to Android.
- Mobile actions use durable outbox operations and shared AI contracts.
- Playground remains desktop-only/read-only on Android.
- Mobile network clients enforce HTTPS with only localhost development exceptions.
- Mobile diagnostics, exports, notification intents, and deep links exclude credentials, raw prompts, raw provider responses, authorization headers, lease tokens, and reservation ownership tokens.

## Migrations and data compatibility

Current mobile schema version: 8.

Schema version 8 includes:

- canonical mobile tables and durable outbox.
- AI result, job, usage, settings, memory, tombstone, lifecycle, notification, Playground projection, and diagnostic export tables.
- FTS and scoped indexes initialized idempotently in `beforeOpen`.

Fresh install and repeated initialization are covered by source and Flutter tests. In this local environment, Flutter migration tests cannot execute because the Flutter toolchain is unavailable.

Unsupported downgrade behavior is explicit in documentation and must remain data-preserving: newer schemas are not to be opened as fully compatible by older mobile releases.

## Verification summary

Source-level and shared-platform gates passed in this environment:

- `pnpm contracts:check`
- `pnpm --filter @focuslog/shared-types test`
- `pnpm --filter @focuslog/shared-types lint`
- `pnpm --filter @focuslog/shared-types typecheck`
- `pnpm --filter @focuslog/shared-types build`
- desktop/backend preservation lint, typecheck, test, and build gates

Android gates are blocked locally:

- `pnpm mobile:analyze`
- `pnpm mobile:test`
- `pnpm mobile:build`

All three fail because `flutter` is not recognized as a command in the current Windows environment. Therefore Android cannot be release-certified from this machine.

## Build, install, launch, and upgrade certification

Release artifact: not built in this environment.

Install/launch smoke: not executed in this environment.

Upgrade smoke: not executed in this environment.

Required external gate to close Android release certification:

1. Install Flutter and Android SDK or run the configured CI/mobile runner.
2. Run `pnpm mobile:analyze`.
3. Run `pnpm mobile:test`.
4. Run `pnpm mobile:build`.
5. Build a signed or release-candidate Android artifact according to `docs/AI_MOBILE_COMMANDS.md`.
6. Install and launch on an emulator or physical device.
7. Execute fresh install, upgrade, offline/reconnect, protected-data cleanup, and AI route smoke checks.

## Performance and security

Mobile M-H introduced the synthetic `synthetic_mobile_ai_mh_v1` performance/resource snapshot. M-I treats those thresholds as source-verified but not Android-runtime certified until Flutter tests and a release-like build can run.

Security source gates cover endpoint policy, response-size caps, manifest security, CI secret protection, redaction, import/export validation, Playground isolation, and no mobile direct-provider execution.

## Acceptance result

Rows that can be verified without Flutter are implemented and verified.

Android runtime/build/install rows remain blocked by concrete defect: missing Flutter toolchain in the current environment.

iOS rows are not applicable - platform absent.

Do not describe FocusLog mobile AI as complete, production-ready, or certified on Android until the Android commands, artifact build, and install/launch smoke have passed.
