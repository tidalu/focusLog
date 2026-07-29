# FocusLog AI Mobile Commands

These are the repository-supported commands for present targets in Mobile Phase M-A. Run commands separately so failures and timeouts identify the failing gate.

## Shared contracts

| Command                                          | Target                                                                          | Classification | Purpose                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm contracts:check`                           | Shared contracts, backend route documentation, desktop/mobile generated outputs | Package gate   | Verifies generated TS/Dart contracts are current and REST/WebSocket docs match backend routes                 |
| `pnpm contracts:generate`                        | Shared contracts                                                                | Maintenance    | Regenerates `packages/shared-types/src/generated-contracts.ts` and `apps/mobile/lib/generated/contracts.dart` |
| `pnpm --filter @focuslog/shared-types test`      | Shared TypeScript contracts                                                     | Package gate   | Runs AI mobile contract drift and vocabulary tests                                                            |
| `pnpm --filter @focuslog/shared-types typecheck` | Shared TypeScript contracts                                                     | Package gate   | Type-checks exported shared contract types                                                                    |
| `pnpm --filter @focuslog/shared-types build`     | Shared TypeScript contracts                                                     | Package gate   | Compiles distributable shared contract package                                                                |

## Desktop

| Command                                     | Target                    | Classification    | Purpose                    |
| ------------------------------------------- | ------------------------- | ----------------- | -------------------------- |
| `pnpm --filter @focuslog/desktop lint`      | Desktop Electron/renderer | Package gate      | ESLint over desktop source |
| `pnpm --filter @focuslog/desktop typecheck` | Desktop Electron/renderer | Package gate      | TypeScript compile checks  |
| `pnpm --filter @focuslog/desktop test`      | Desktop Electron/renderer | Package gate      | Full desktop Vitest suite  |
| `pnpm --filter @focuslog/desktop build`     | Desktop Electron/renderer | Release-candidate | Production desktop build   |

## Backend and synchronization

| Command                                                 | Target         | Classification                              | Purpose                                               |
| ------------------------------------------------------- | -------------- | ------------------------------------------- | ----------------------------------------------------- |
| `pnpm --filter @focuslog/backend lint`                  | Backend        | Package gate                                | ESLint over backend source/tests                      |
| `pnpm --filter @focuslog/backend typecheck`             | Backend        | Package gate                                | TypeScript compile checks                             |
| `pnpm --filter @focuslog/backend test`                  | Backend        | Package gate                                | Backend unit/integration tests                        |
| `pnpm --filter @focuslog/backend build`                 | Backend        | Package gate                                | Backend production TypeScript build                   |
| `pnpm --filter @focuslog/backend prisma:validate`       | Backend Prisma | Package gate when database URL is available | Validates Prisma schema                               |
| `pnpm --filter @focuslog/backend prisma:migrate:status` | Backend Prisma | Release-candidate with database             | Checks migration status against configured PostgreSQL |

## Android mobile

Run Flutter commands from the repository root through the root scripts where possible:

| Command               | Target              | Classification                             | Purpose                                                          |
| --------------------- | ------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `pnpm mobile:analyze` | Android Flutter app | Package gate                               | Static analysis for Dart/Flutter                                 |
| `pnpm mobile:test`    | Android Flutter app | Package gate                               | Flutter unit/widget tests, including generated AI contract tests |
| `pnpm mobile:build`   | Android debug APK   | Package gate when Android SDK is available | Builds debug Android APK from current Flutter project            |

Equivalent direct commands, used by CI inside `apps/mobile`, are:

- `flutter pub get`
- `dart run build_runner build --delete-conflicting-outputs`
- `flutter analyze`
- `flutter test --dart-define=FOCUSLOG_INTEGRATION_API_URL=http://127.0.0.1:3000`
- `flutter build apk --debug`

Android release builds require signing material and are release-candidate only:

```powershell
flutter build apk --release --dart-define=FOCUSLOG_API_URL=https://focuslog-backend.onrender.com
```

## iOS mobile

Not applicable - platform absent. There is no `apps/mobile/ios` directory, Xcode project, workspace, Podfile, or iOS build script in this repository.
