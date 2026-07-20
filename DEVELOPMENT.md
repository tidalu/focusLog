# Development Guide

## Repository layout

```text
apps/       Deployable backend, desktop, and mobile applications
packages/   Shared TypeScript foundation packages
contracts/  Platform-neutral API and event contracts
docs/       Architecture, data, synchronization, security, and ADR records
infra/      Docker and future deployment assets
scripts/    Repository validation scripts
```

## Setup

1. Install Node.js 22 LTS, pnpm 11, Docker Desktop, and Flutter.
2. Run `pnpm install` from the repository root.
3. Copy `.env.example` to `.env` and change values for a non-local environment.
4. Run `docker compose up --build` to start PostgreSQL and the backend container.

## Common commands

| Command                                 | Purpose                                        |
| --------------------------------------- | ---------------------------------------------- |
| `pnpm --filter @focuslog/backend dev`   | Start the Fastify foundation server            |
| `pnpm --filter @focuslog/backend test`  | Run backend unit tests                         |
| `pnpm --filter @focuslog/desktop build` | Build Electron main and React renderer bundles |
| `pnpm mobile:analyze`                   | Analyze the Flutter application                |
| `pnpm mobile:test`                      | Run Flutter tests                              |
| `pnpm mobile:build`                     | Build a debug Android APK                      |
| `docker compose up --build`             | Build and start backend/PostgreSQL services    |

## Environment rules

- Never commit `.env`, keys, backups, or signing files.
- Keep `.env.example` non-secret and synchronized with backend configuration.
- Docker defaults are development-only and must be replaced by deployment-managed secrets.

## Quality gates

Git hooks run formatting and linting for staged TypeScript/Markdown/configuration changes. GitHub Actions runs formatting, linting, type checks, tests, backend build, desktop build, contract checks, and Flutter validation when Flutter is available on the runner.

## Foundation boundary

This milestone intentionally contains only a health endpoint and empty UI shells. Do not add domain entities, pairing flow, reminder behavior, synchronization protocol, or reports without first adding their contracts and tests according to the approved architecture documentation.
