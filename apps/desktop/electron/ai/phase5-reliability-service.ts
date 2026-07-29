import { ulid } from 'ulid';

import { latestDesktopMigrationVersion, type DesktopDatabase } from '../database/database.js';
import { desktopMigrations } from '../database/migrations.js';

export interface Phase5MigrationAudit {
  latestVersion: number;
  migrationCount: number;
  sequential: boolean;
  uniqueVersions: boolean;
  deterministicStatements: boolean;
  canonicalTablesProtected: boolean;
  aiBoundaryVersions: number[];
  findings: Array<{ code: string; message: string }>;
}

export interface Phase5RepairResult {
  failedNamespaces: number;
  staleFacts: number;
  unsupportedGraphRelations: number;
  interruptedPlaygroundRuns: number;
  diagnostics: Array<{ code: string; message: string }>;
}

export interface Phase5BackupPreflight {
  ok: boolean;
  requiredBytes: string;
  availableBytes: string;
  message: string;
}

export interface Phase5RecoveryMessage {
  code: string;
  title: string;
  message: string;
  retryAppropriate: boolean;
  nextAction: string;
}

const secretPattern =
  /sk-[A-Za-z0-9_-]{6,}|Authorization:\s*Bearer\s+(?!\[redacted\])\S+|\b(api[_-]?key|credential|secret|lease[_-]?token|reservation[_-]?owner)\b\s*[:=]?\s*[^\s,;]+/iu;

function now(): string {
  return new Date().toISOString();
}

function sanitize(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/giu, 'sk-[redacted]')
    .replace(/Authorization:\s*Bearer\s+\S+/giu, 'Authorization: Bearer [redacted]')
    .replace(
      /\b(api[_-]?key|credential|secret|lease[_-]?token|reservation[_-]?owner)\b\s*[:=]?\s*[^\s,;]+/giu,
      '$1 [redacted]'
    )
    .slice(0, 500);
}

function tableExists(database: DesktopDatabase, table: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?")
      .get(table)
  );
}

function recordQueueDiagnostic(
  database: DesktopDatabase,
  ownerId: string,
  code: string,
  message: string
): void {
  if (!tableExists(database, 'ai_queue_diagnostics')) return;
  database
    .prepare(
      'INSERT INTO ai_queue_diagnostics (id, owner_id, job_id, code, message, created_at) VALUES (?, ?, NULL, ?, ?, ?)'
    )
    .run(ulid(), ownerId, code, sanitize(message), now());
  database
    .prepare(
      `DELETE FROM ai_queue_diagnostics WHERE owner_id = ? AND id NOT IN
       (SELECT id FROM ai_queue_diagnostics WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 100)`
    )
    .run(ownerId, ownerId);
}

export class Phase5ReliabilityService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  auditMigrations(): Phase5MigrationAudit {
    const versions = desktopMigrations.map((migration) => migration.version);
    const findings: Phase5MigrationAudit['findings'] = [];
    const uniqueVersions = new Set(versions).size === versions.length;
    if (!uniqueVersions)
      findings.push({
        code: 'duplicate_migration_version',
        message: 'Migration versions must be unique.'
      });
    const sequential = versions.every((version, index) => version === index + 1);
    if (!sequential)
      findings.push({ code: 'migration_gap', message: 'Migration versions must be sequential.' });
    const deterministicStatements = desktopMigrations.every((migration) =>
      migration.statements.every(
        (statement) =>
          !/\bMath\.random\b|\bDate\.now\b|\bnew Date\b|\bulid\(/u.test(statement) &&
          statement.trim().length > 0
      )
    );
    if (!deterministicStatements)
      findings.push({
        code: 'nondeterministic_migration',
        message: 'Migrations must be deterministic SQL.'
      });
    const joined = desktopMigrations.flatMap((migration) => migration.statements).join('\n');
    const canonicalTablesProtected =
      !/\bDROP\s+TABLE\s+(owners|check_ins|check_in_revisions|devices|settings)\b/iu.test(joined);
    if (!canonicalTablesProtected)
      findings.push({
        code: 'canonical_drop',
        message: 'A migration attempts to drop canonical user data.'
      });
    const aiBoundaryVersions = desktopMigrations
      .filter((migration) => migration.statements.some((statement) => /\bai_/u.test(statement)))
      .map((migration) => migration.version);
    return {
      latestVersion: latestDesktopMigrationVersion,
      migrationCount: desktopMigrations.length,
      sequential,
      uniqueVersions,
      deterministicStatements,
      canonicalTablesProtected,
      aiBoundaryVersions,
      findings
    };
  }

  certifyDatabase(): {
    ok: boolean;
    integrity: string;
    foreignKeyProblems: number;
    schemaVersion: number;
    findings: Array<{ code: string; message: string }>;
  } {
    const integrity =
      (this.database.pragma('integrity_check') as Array<{ integrity_check: string }>)[0]
        ?.integrity_check ?? 'unknown';
    const foreignKeyProblems = (this.database.pragma('foreign_key_check') as unknown[]).length;
    const versionRow = this.database
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as { version: number };
    const findings: Array<{ code: string; message: string }> = [];
    if (integrity !== 'ok')
      findings.push({
        code: 'integrity_check_failed',
        message: 'SQLite integrity check did not pass.'
      });
    if (foreignKeyProblems > 0)
      findings.push({
        code: 'foreign_key_check_failed',
        message: `${foreignKeyProblems} foreign-key issue(s) were detected.`
      });
    if (versionRow.version !== latestDesktopMigrationVersion)
      findings.push({
        code: 'schema_not_latest',
        message: `Schema is ${versionRow.version}; expected ${latestDesktopMigrationVersion}.`
      });
    return {
      ok: findings.length === 0,
      integrity,
      foreignKeyProblems,
      schemaVersion: versionRow.version,
      findings
    };
  }

  backupPreflight(requiredBytes: number, availableBytes: number): Phase5BackupPreflight {
    const required = Math.max(0, Math.ceil(requiredBytes * 1.2 + 1_048_576));
    const ok = availableBytes >= required;
    return {
      ok,
      requiredBytes: String(required),
      availableBytes: String(Math.max(0, availableBytes)),
      message: ok
        ? 'Enough free space is available for an atomic encrypted backup.'
        : 'Free disk space is too low to safely write the encrypted backup. Free space and retry.'
    };
  }

  repairDerivedData(): Phase5RepairResult {
    const diagnostics: Phase5RepairResult['diagnostics'] = [];
    const timestamp = now();
    return this.database.transaction(() => {
      let failedNamespaces = 0;
      if (tableExists(this.database, 'ai_vector_namespaces')) {
        failedNamespaces = this.database
          .prepare(
            `UPDATE ai_vector_namespaces
                SET status = 'failed',
                    coverage_status = 'failed',
                    last_error_code = 'DERIVED_CORRUPTION',
                    last_error_message = 'Derived vector data was incompatible and can be rebuilt safely.',
                    updated_at = ?
              WHERE owner_id = ?
                AND status IN ('building','active')
                AND EXISTS (
                  SELECT 1 FROM ai_vector_records record
                   WHERE record.namespace_id = ai_vector_namespaces.id
                     AND record.owner_id = ai_vector_namespaces.owner_id
                     AND (record.dimensions <> ai_vector_namespaces.dimensions
                       OR record.distance_metric <> ai_vector_namespaces.distance_metric)
                )`
          )
          .run(timestamp, this.ownerId).changes;
        if (failedNamespaces) {
          diagnostics.push({
            code: 'VECTOR_REBUILD_REQUIRED',
            message: `${failedNamespaces} embedding namespace(s) were marked failed for safe rebuild.`
          });
          recordQueueDiagnostic(
            this.database,
            this.ownerId,
            'VECTOR_REBUILD_REQUIRED',
            `${failedNamespaces} embedding namespace(s) were marked failed for safe rebuild.`
          );
        }
      }

      let staleFacts = 0;
      if (tableExists(this.database, 'ai_fact_records')) {
        staleFacts = this.database
          .prepare(
            `UPDATE ai_fact_records
                SET status = 'stale',
                    updated_at = ?
              WHERE owner_id = ?
                AND status IN ('proposed','active','reinforced','corrected')
                AND EXISTS (
                  SELECT 1 FROM ai_fact_record_evidence evidence
                   LEFT JOIN check_in_revisions revision ON revision.id = evidence.revision_id
                   LEFT JOIN check_ins source ON source.id = evidence.source_id
                   WHERE evidence.fact_id = ai_fact_records.id
                     AND evidence.owner_id = ai_fact_records.owner_id
                     AND (revision.id IS NULL OR source.deleted_at IS NOT NULL)
                )`
          )
          .run(timestamp, this.ownerId).changes;
        if (staleFacts) {
          diagnostics.push({
            code: 'FACT_EVIDENCE_STALE',
            message: `${staleFacts} fact(s) were marked stale because evidence is unavailable.`
          });
          recordQueueDiagnostic(
            this.database,
            this.ownerId,
            'FACT_EVIDENCE_STALE',
            `${staleFacts} fact(s) were marked stale because evidence is unavailable.`
          );
        }
      }

      let unsupportedGraphRelations = 0;
      if (tableExists(this.database, 'ai_graph_relations')) {
        unsupportedGraphRelations = this.database
          .prepare(
            `UPDATE ai_graph_relations
                SET status = 'unsupported',
                    updated_at = ?
              WHERE owner_id = ?
                AND status IN ('proposed','active')
                AND source_fact_id IS NOT NULL
                AND source_fact_id NOT IN (
                  SELECT id FROM ai_fact_records
                   WHERE owner_id = ?
                     AND status IN ('active','reinforced','corrected')
                )`
          )
          .run(timestamp, this.ownerId, this.ownerId).changes;
        if (unsupportedGraphRelations) {
          diagnostics.push({
            code: 'GRAPH_SUPPORT_STALE',
            message: `${unsupportedGraphRelations} graph relation(s) lost active support.`
          });
          recordQueueDiagnostic(
            this.database,
            this.ownerId,
            'GRAPH_SUPPORT_STALE',
            `${unsupportedGraphRelations} graph relation(s) lost active support.`
          );
        }
      }

      let interruptedPlaygroundRuns = 0;
      if (tableExists(this.database, 'ai_playground_runs')) {
        interruptedPlaygroundRuns = this.database
          .prepare(
            `UPDATE ai_playground_runs
                SET status = 'interrupted',
                    stop_reason = 'recovered_after_process_loss',
                    finished_at = ?,
                    updated_at = ?
              WHERE owner_id = ?
                AND status IN ('queued','running','streaming')`
          )
          .run(timestamp, timestamp, this.ownerId).changes;
        if (interruptedPlaygroundRuns) {
          this.database
            .prepare(
              `UPDATE ai_jobs
                  SET status = 'cancelled',
                      cancellation_requested = 1,
                      finished_at = ?,
                      updated_at = ?
                WHERE owner_id = ?
                  AND id IN (SELECT job_id FROM ai_playground_runs WHERE owner_id = ? AND status = 'interrupted')`
            )
            .run(timestamp, timestamp, this.ownerId, this.ownerId);
          diagnostics.push({
            code: 'PLAYGROUND_RUN_INTERRUPTED',
            message: `${interruptedPlaygroundRuns} Playground run(s) were reconciled after interruption.`
          });
          recordQueueDiagnostic(
            this.database,
            this.ownerId,
            'PLAYGROUND_RUN_INTERRUPTED',
            `${interruptedPlaygroundRuns} Playground run(s) were reconciled after interruption.`
          );
        }
      }

      return {
        failedNamespaces,
        staleFacts,
        unsupportedGraphRelations,
        interruptedPlaygroundRuns,
        diagnostics
      };
    })();
  }

  recoveryMessage(code: string, detail: string): Phase5RecoveryMessage {
    const safeDetail = sanitize(detail);
    if (code === 'DB_LOCKED')
      return {
        code,
        title: 'FocusLog database is busy',
        message:
          'FocusLog could not complete the local database operation because another local operation is holding the database lock.',
        retryAppropriate: true,
        nextAction: 'Close other FocusLog windows or wait a moment, then retry.'
      };
    if (code === 'DISK_FULL')
      return {
        code,
        title: 'Not enough disk space',
        message: 'FocusLog did not finish writing local AI state because disk space is too low.',
        retryAppropriate: true,
        nextAction:
          'Free disk space. FocusLog will retry or recover derived AI state on the next start.'
      };
    if (code === 'PROVIDER_FAULT')
      return {
        code,
        title: 'AI provider request failed',
        message: `The provider failed safely: ${safeDetail}`,
        retryAppropriate: true,
        nextAction:
          'Check provider settings, local model availability, network connection, consent, and budget before retrying.'
      };
    if (code === 'DERIVED_CORRUPTION')
      return {
        code,
        title: 'Derived AI memory needs repair',
        message:
          'Canonical FocusLog logs are safe. Derived AI memory can be rebuilt from local source records.',
        retryAppropriate: true,
        nextAction: 'Use the AI Memory rebuild action or restart FocusLog to continue recovery.'
      };
    return {
      code,
      title: 'AI recovery needed',
      message:
        safeDetail || 'FocusLog detected an AI reliability issue and preserved canonical data.',
      retryAppropriate: true,
      nextAction:
        'Review the sanitized diagnostics and retry after correcting the indicated configuration.'
    };
  }

  certifyDiagnosticsSafe(value: unknown): boolean {
    return !secretPattern.test(JSON.stringify(value));
  }
}
