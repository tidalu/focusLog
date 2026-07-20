# FocusLog

FocusLog is a single-owner, local-first activity journal for Windows and Android. The repository includes desktop and Android foundations, a Fastify/PostgreSQL backend, synchronization primitives, offline reporting, and production deployment configuration. It is not yet a security-audited public release.

## Applications

- `apps/backend` - Fastify, Prisma, PostgreSQL API, and migration service.
- `apps/desktop` - Electron, React, TypeScript, local SQLite, and reminder shell.
- `apps/mobile` - Flutter, Drift SQLite, Android notification, and offline sync shell.

## Prerequisites

- Node.js 22 LTS
- pnpm 11
- Docker Desktop
- Flutter SDK for mobile analysis, tests, and APK builds

## Quick start

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up --build
pnpm --filter @focuslog/backend dev
```

The backend exposes `GET /health`, `/health/live`, and `/health/ready`; readiness verifies PostgreSQL connectivity.

## Validation commands

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:check
pnpm --filter @focuslog/backend test:migrations
pnpm --filter @focuslog/desktop test:database
pnpm mobile:analyze
pnpm mobile:test
pnpm mobile:build
```

See [DEVELOPMENT.md](DEVELOPMENT.md), [reporting behavior](docs/REPORTING.md), and the [production deployment runbook](docs/DEPLOYMENT.md) for architecture, operations, backups, and updates.
