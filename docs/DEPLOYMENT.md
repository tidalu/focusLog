# Production deployment

## Scope

Deploy only the Fastify backend and PostgreSQL. Desktop and Android apps retain their local SQLite databases and synchronize over HTTPS. Terminate TLS at a managed provider or reverse proxy; set `REQUIRE_TLS=true` in every public production deployment.

## Environment

| Variable                      | Required                | Production value                                       |
| ----------------------------- | ----------------------- | ------------------------------------------------------ |
| `NODE_ENV`                    | Yes                     | `production`                                           |
| `DATABASE_URL`                | Yes                     | PostgreSQL connection URL; store only as a secret      |
| `BACKEND_HOST`                | Yes                     | `0.0.0.0`                                              |
| `BACKEND_PORT`                | No                      | `3000`; provider `PORT` is honored when this is absent |
| `LOG_LEVEL`                   | No                      | `info`                                                 |
| `API_RATE_LIMIT_MAX`          | No                      | `120` or a reviewed capacity value                     |
| `DEVICE_AUTH_MAX_AGE_SECONDS` | No                      | `300`                                                  |
| `REQUIRE_TLS`                 | Yes                     | `true`                                                 |
| `RUN_MIGRATIONS`              | One-service deployments | `true`                                                 |

Use `.env.production.example` only as a template. Do not commit `.env.production`, database URLs, backups, signing keys, or certificates. PostgreSQL passwords used inside a URL must be URL-encoded.

## Docker and VPS

1. Copy `.env.production.example` to `.env.production` and replace all credentials.
2. Put a TLS reverse proxy (Caddy, nginx, or Traefik) in front of `127.0.0.1:3000`; expose only ports 80/443 publicly. Do not publish PostgreSQL.
3. Start the release:

```sh
docker compose --env-file .env.production -f compose.production.yaml up -d --build
curl --fail https://api.example.com/health/ready
```

The `migrate` service runs `prisma migrate deploy` once and must exit successfully before `backend` starts. With multiple backend replicas, run migrations as a single release job before scaling; never rely on every replica to migrate at once.

## Render

`render.yaml` creates a Docker web service and managed PostgreSQL database. In the Render dashboard, add `LOG_LEVEL`, rate-limit settings, and any values omitted from the blueprint. The blueprint sets `RUN_MIGRATIONS=true`, appropriate only while using one service instance. For a horizontally scaled service, run `prisma migrate deploy` as a pre-deploy/release job and remove that variable.

Set `/health/ready` as the health check and use Render-managed TLS. Verify the deployed service can reach its private database before enabling clients.

## Railway

Railway does not execute Compose as a production stack. Create separate PostgreSQL and backend services, connect the backend repository, and use `railway.json` for the Dockerfile and readiness path. Set `DATABASE_URL` from Railway PostgreSQL, plus the production variables above; set `RUN_MIGRATIONS=true` only for a single backend instance. For a multi-instance service, execute `pnpm --filter @focuslog/backend prisma:migrate:deploy` as a one-off release operation.

## Fly.io

1. Run `fly launch --no-deploy` at the repository root and retain the provided `fly.toml`.
2. Set secrets rather than editing them into the file:

```sh
fly secrets set DATABASE_URL='postgresql://...' API_RATE_LIMIT_MAX=120 DEVICE_AUTH_MAX_AGE_SECONDS=300
fly deploy
```

`fly.toml` uses a release command for migrations, HTTPS enforcement, and `/health/ready`. Keep at least one machine running for reminder synchronization responsiveness.

## Backups and restore

Back up PostgreSQL daily, retain 30 daily/12 monthly backups, and test one restore every quarter. Store encrypted backups in a separate account or region. Capture the custom dump plus its SHA-256 sidecar:

```sh
DATABASE_URL='postgresql://...' BACKUP_DIR=/secure/backups ./scripts/backup-postgres.sh
```

Restore only into a new, isolated database first:

```sh
createdb focuslog_restore
pg_restore --clean --if-exists --no-owner --dbname=focuslog_restore /secure/backups/focuslog-YYYYMMDDTHHMMSSZ.dump
psql focuslog_restore -c 'SELECT COUNT(*) FROM devices;'
```

Point a staging backend at that restored database, run `/health/ready`, and validate a signed device request before approving replacement of production. Record the backup checksum, restore time, schema migration status, and operator in the incident log.

## Monitoring and alerts

- Probe `/health/live` for process liveness and `/health/ready` for PostgreSQL readiness.
- Collect structured backend logs; alert on 5xx spikes, repeated `TLS_REQUIRED`, database readiness failures, and sync retry growth.
- Monitor PostgreSQL disk, connections, slow queries, backup age, and failed restore drills.
- Use provider deployment logs and uptime monitoring from a separate region. Do not include request signatures or check-in text in alert payloads.

## Update and rollback

1. Require CI lint, tests, build, migration status, and Docker image build to pass.
2. Create and verify a database backup.
3. Review pending Prisma SQL for locking/data-loss risk; deploy backwards-compatible migrations first.
4. Deploy one backend instance, wait for `/health/ready`, then roll out remaining instances.
5. If application rollback is required, roll back the image only. Do not reverse a database migration without an explicit, tested restoration plan.

After every update, verify device registration, signed API access, sync push/pull, daily report output, and backup job status.
