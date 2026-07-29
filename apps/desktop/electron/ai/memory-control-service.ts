import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import { FactGraphService, type FactCandidate } from './fact-graph-service.js';
import { MemoryRetrievalService } from './memory-retrieval-service.js';

export interface IpcMainLike {
  handle(channel: string, listener: (_event: unknown, ...args: unknown[]) => unknown): void;
}

export type MemoryMode = 'semantic' | 'hybrid' | 'keyword';
export type MemorySubsystem = 'embeddings' | 'facts' | 'graph' | 'retrieval';

export interface MemorySearchInput {
  query: string;
  mode?: MemoryMode;
  limit?: number;
  sourceType?: 'fact' | 'graph_relation' | 'summary' | 'raw_log';
  dateStart?: string;
  dateEnd?: string;
  entity?: string;
}

export interface MemoryOverview {
  activeNamespace: {
    id: string;
    name: string;
    providerId: string;
    modelId: string;
    dimensions: number;
    coverageStatus: string;
    coverageExpectedChunks: number;
    coverageIndexedChunks: number;
    storageBytes: string;
    lastIndexingAt: string | null;
  } | null;
  indexing: { pending: number; failed: number };
  counts: { facts: number; graphNodes: number; graphEdges: number; staleMemory: number };
  subsystems: Record<MemorySubsystem, boolean>;
  diagnostics: Array<{ code: string; message: string; createdAt: string }>;
}

export interface MemoryFactListItem {
  id: string;
  subject: string;
  predicate: string;
  objectValue: string;
  status: string;
  confidence: string;
  origin: string;
  validFrom: string | null;
  validTo: string | null;
  evidenceCount: number;
  providerProfileId: string | null;
  modelId: string | null;
}

export interface MemoryGraphProjection {
  nodes: Array<{ id: string; name: string; type: string; status: string; confidence: string }>;
  edges: Array<{
    id: string;
    source: string;
    predicate: string;
    target: string;
    status: string;
    confidence: string;
    evidenceCount: number;
  }>;
}

function redact(value: string): string {
  return value
    .replace(/authorization\s*:\s*bearer\s+\S+/giu, '[redacted auth header]')
    .replace(/(bearer|authorization|api[_-]?key|x-api-key)\s*[:=]?\s*[^\s,;]+/giu, '$1 [redacted]')
    .replace(/authorization \[redacted\]/giu, '[redacted auth header]')
    .replace(/\bSECRET\b/gu, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, 'sk-[redacted]')
    .slice(0, 700);
}

function assertId(value: unknown, label = 'identifier'): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/u.test(value))
    throw new AIError('VALIDATION', `Choose a valid ${label}.`);
  return value;
}

function assertQuery(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 500)
    throw new AIError('VALIDATION', 'Choose a valid memory search query.');
  return value.trim();
}

function objectInput(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AIError('VALIDATION', message);
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 500)
    throw new AIError('VALIDATION', `${label} is invalid.`);
  return value;
}

function limitValue(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max)
    throw new AIError('VALIDATION', `Limit must be between 1 and ${max}.`);
  return parsed;
}

function memoryMode(value: unknown): MemoryMode | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!['semantic', 'hybrid', 'keyword'].includes(String(value)))
    throw new AIError('VALIDATION', 'Choose a valid memory search mode.');
  return value as MemoryMode;
}

function sourceType(value: unknown): MemorySearchInput['sourceType'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (!['fact', 'graph_relation', 'summary', 'raw_log'].includes(String(value)))
    throw new AIError('VALIDATION', 'Choose a valid memory source type.');
  return value as MemorySearchInput['sourceType'];
}

function factStatus(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    ![
      'proposed',
      'active',
      'reinforced',
      'superseded',
      'contradicted',
      'stale',
      'rejected',
      'corrected'
    ].includes(String(value))
  )
    throw new AIError('VALIDATION', 'Choose a valid fact status.');
  return String(value);
}

function subsystem(value: unknown): MemorySubsystem {
  if (!['embeddings', 'facts', 'graph', 'retrieval'].includes(String(value)))
    throw new AIError('VALIDATION', 'Choose a valid memory subsystem.');
  return value as MemorySubsystem;
}

export class AIMemoryControlService {
  private readonly facts: FactGraphService;
  private readonly retrieval: MemoryRetrievalService;

  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {
    this.facts = new FactGraphService(database, ownerId);
    this.retrieval = new MemoryRetrievalService(database, ownerId);
  }

  overview(): MemoryOverview {
    const namespace = this.database
      .prepare(
        `SELECT id, name, provider_id AS providerId, model_id AS modelId, dimensions, coverage_status AS coverageStatus, coverage_expected_chunks AS coverageExpectedChunks, coverage_indexed_chunks AS coverageIndexedChunks, storage_bytes AS storageBytes, COALESCE(last_rebuild_completed_at, last_rebuild_started_at, updated_at) AS lastIndexingAt FROM ai_vector_namespaces WHERE owner_id = ? AND status = 'active' ORDER BY active_at DESC, updated_at DESC LIMIT 1`
      )
      .get(this.ownerId) as MemoryOverview['activeNamespace'] | undefined;
    const indexing = this.database
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),0) AS pending, COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),0) AS failed FROM ai_vector_chunks WHERE owner_id = ?`
      )
      .get(this.ownerId) as { pending: number; failed: number };
    const counts = {
      facts: (
        this.database
          .prepare(
            "SELECT COUNT(*) AS count FROM ai_fact_records WHERE owner_id = ? AND status NOT IN ('rejected')"
          )
          .get(this.ownerId) as { count: number }
      ).count,
      graphNodes: (
        this.database
          .prepare(
            "SELECT COUNT(*) AS count FROM ai_graph_entities WHERE owner_id = ? AND status != 'tombstoned'"
          )
          .get(this.ownerId) as { count: number }
      ).count,
      graphEdges: (
        this.database
          .prepare(
            "SELECT COUNT(*) AS count FROM ai_graph_relations WHERE owner_id = ? AND status != 'tombstoned'"
          )
          .get(this.ownerId) as { count: number }
      ).count,
      staleMemory:
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_memories WHERE owner_id = ? AND status = 'STALE'"
            )
            .get(this.ownerId) as { count: number }
        ).count +
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_analysis_results WHERE owner_id = ? AND status = 'stale'"
            )
            .get(this.ownerId) as { count: number }
        ).count +
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_fact_records WHERE owner_id = ? AND status = 'stale'"
            )
            .get(this.ownerId) as { count: number }
        ).count +
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_graph_relations WHERE owner_id = ? AND status = 'unsupported'"
            )
            .get(this.ownerId) as { count: number }
        ).count
    };
    const settings = this.database
      .prepare(
        'SELECT embeddings_enabled AS embeddings, facts_enabled AS facts, graph_enabled AS graph FROM ai_settings WHERE owner_id = ?'
      )
      .get(this.ownerId) as { embeddings: number; facts: number; graph: number } | undefined;
    const diagnostics = this.database
      .prepare(
        'SELECT source_type AS code, reason AS message, created_at AS createdAt FROM ai_memory_staleness_events WHERE owner_id = ? ORDER BY created_at DESC LIMIT 5'
      )
      .all(this.ownerId) as MemoryOverview['diagnostics'];
    return {
      activeNamespace: namespace
        ? { ...namespace, storageBytes: String(namespace.storageBytes) }
        : null,
      indexing,
      counts,
      subsystems: {
        embeddings: settings?.embeddings !== 0,
        facts: settings?.facts !== 0,
        graph: settings?.graph !== 0,
        retrieval: true
      },
      diagnostics: diagnostics.map((row) => ({ ...row, message: redact(row.message) }))
    };
  }

  search(input: MemorySearchInput) {
    const query = assertQuery(input.query);
    const plan = this.retrieval.plan({
      query,
      queryType: input.mode === 'keyword' ? 'focused' : 'broad',
      tokenBudget: 240,
      evidenceRequired: input.mode === 'keyword',
      entities: input.entity ? [input.entity] : undefined,
      timeRange:
        input.dateStart && input.dateEnd
          ? { start: input.dateStart, end: input.dateEnd }
          : undefined
    });
    return {
      planId: plan.id,
      mode: input.mode ?? 'hybrid',
      namespace: this.overview().activeNamespace,
      explanation: [
        'facts_graph_first',
        'summaries_before_raw',
        ...(plan.exclusionReasons.length ? plan.exclusionReasons : ['no_exclusions'])
      ],
      results: plan.items
        .filter((item) => !input.sourceType || item.sourceType === input.sourceType)
        .slice(0, Math.min(Math.max(input.limit ?? 20, 1), 50))
        .map((item) => ({
          ...item,
          openSource:
            item.classification === 'canonical'
              ? { checkInId: item.sourceId, revisionId: item.sourceRevisionId }
              : null
        }))
    };
  }

  factsList(input: { query?: string; status?: string; limit?: number } = {}): MemoryFactListItem[] {
    const clauses = ['fact.owner_id = ?'];
    const params: unknown[] = [this.ownerId];
    if (input.status) {
      clauses.push('fact.status = ?');
      params.push(input.status);
    }
    if (input.query?.trim()) {
      clauses.push('(subject LIKE ? OR predicate LIKE ? OR object_value LIKE ?)');
      const like = `%${input.query.trim()}%`;
      params.push(like, like, like);
    }
    return (
      this.database
        .prepare(
          `SELECT fact.id, fact.subject, fact.predicate, fact.object_value AS objectValue, fact.status, fact.confidence, fact.origin, fact.valid_from AS validFrom, fact.valid_to AS validTo, fact.provider_profile_id AS providerProfileId, fact.model_id AS modelId, COUNT(evidence.revision_id) AS evidenceCount FROM ai_fact_records fact LEFT JOIN ai_fact_record_evidence evidence ON evidence.fact_id = fact.id WHERE ${clauses.join(' AND ')} GROUP BY fact.id ORDER BY fact.updated_at DESC LIMIT ?`
        )
        .all(...params, Math.min(Math.max(input.limit ?? 50, 1), 100)) as Array<
        Omit<MemoryFactListItem, 'confidence'> & { confidence: number }
      >
    ).map((row) => ({ ...row, confidence: row.confidence.toFixed(2) }));
  }

  factById(id: string): MemoryFactListItem {
    const fact =
      this.factsList({ limit: 100 }).find((item) => item.id === id) ??
      this.factsList({ status: 'rejected', limit: 100 }).find((item) => item.id === id);
    if (!fact) throw new AIError('VALIDATION', 'The fact is no longer available.');
    return fact;
  }

  graph(input: { query?: string; limit?: number } = {}): MemoryGraphProjection {
    const limit = Math.min(Math.max(input.limit ?? 80, 1), 150);
    const like = `%${input.query?.trim() ?? ''}%`;
    const nodes = (
      this.database
        .prepare(
          `SELECT id, canonical_name AS name, node_type AS type, status, confidence FROM ai_graph_entities WHERE owner_id = ? AND status != 'tombstoned' AND (? = '%%' OR canonical_name LIKE ?) ORDER BY updated_at DESC LIMIT ?`
        )
        .all(this.ownerId, like, like, limit) as Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        confidence: number;
      }>
    ).map((row) => ({ ...row, confidence: row.confidence.toFixed(2) }));
    const edges = (
      this.database
        .prepare(
          `SELECT relation.id, source.canonical_name AS source, relation.predicate, target.canonical_name AS target, relation.status, relation.confidence, COUNT(evidence.revision_id) AS evidenceCount FROM ai_graph_relations relation JOIN ai_graph_entities source ON source.id = relation.source_entity_id JOIN ai_graph_entities target ON target.id = relation.target_entity_id LEFT JOIN ai_graph_relation_evidence evidence ON evidence.relation_id = relation.id WHERE relation.owner_id = ? GROUP BY relation.id ORDER BY relation.updated_at DESC LIMIT ?`
        )
        .all(this.ownerId, limit) as Array<{
        id: string;
        source: string;
        predicate: string;
        target: string;
        status: string;
        confidence: number;
        evidenceCount: number;
      }>
    ).map((row) => ({
      id: row.id,
      source: row.source,
      predicate: row.predicate,
      target: row.target,
      status: row.status,
      confidence: row.confidence.toFixed(2),
      evidenceCount: row.evidenceCount
    }));
    return { nodes, edges };
  }

  rejectFact(id: string, reason = 'Rejected from Memory UI'): MemoryFactListItem {
    this.facts.rejectFact(assertId(id, 'fact'), reason);
    return this.factById(id);
  }

  correctFact(
    id: string,
    input: Omit<FactCandidate, 'evidenceRevisionIds'> & { reason: string }
  ): MemoryFactListItem {
    this.facts.correctFact(assertId(id, 'fact'), input);
    const corrected = this.factsList({ query: input.subject, limit: 10 }).find(
      (fact) => fact.origin === 'user_overlay'
    );
    if (!corrected) throw new AIError('VALIDATION', 'Corrected fact is unavailable.');
    return corrected;
  }

  splitGraphEntity(
    entityId: string,
    name: string,
    type:
      | 'person'
      | 'project'
      | 'habit'
      | 'goal'
      | 'place'
      | 'organization'
      | 'topic'
      | 'feature'
      | 'custom'
  ) {
    const id = this.facts.splitEntity(assertId(entityId, 'entity'), name, type);
    return { id };
  }

  setSubsystem(input: { subsystem: MemorySubsystem; enabled: boolean }): MemoryOverview {
    if (!['embeddings', 'facts', 'graph', 'retrieval'].includes(input.subsystem))
      throw new AIError('VALIDATION', 'Choose a valid memory subsystem.');
    if (typeof input.enabled !== 'boolean')
      throw new AIError('VALIDATION', 'Choose a valid subsystem state.');
    if (input.subsystem !== 'retrieval') {
      const column =
        input.subsystem === 'embeddings'
          ? 'embeddings_enabled'
          : input.subsystem === 'facts'
            ? 'facts_enabled'
            : 'graph_enabled';
      this.database
        .prepare(`UPDATE ai_settings SET ${column} = ?, updated_at = ? WHERE owner_id = ?`)
        .run(Number(input.enabled), new Date().toISOString(), this.ownerId);
    }
    return this.overview();
  }

  rebuildActiveNamespace(): { queued: boolean; namespaceId: string | null } {
    const active = this.overview().activeNamespace;
    return { queued: Boolean(active), namespaceId: active?.id ?? null };
  }

  deleteDerived(input: {
    target: 'embeddings' | 'facts_graph';
    confirmation: string;
  }): MemoryOverview {
    if (input.confirmation !== 'DELETE DERIVED MEMORY')
      throw new AIError('VALIDATION', 'Derived memory deletion confirmation did not match.');
    this.database.transaction(() => {
      if (input.target === 'embeddings') {
        this.database.prepare('DELETE FROM ai_vector_records WHERE owner_id = ?').run(this.ownerId);
        this.database.prepare('DELETE FROM ai_vector_chunks WHERE owner_id = ?').run(this.ownerId);
        this.database
          .prepare(
            "UPDATE ai_vector_namespaces SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE owner_id = ?"
          )
          .run(new Date().toISOString(), new Date().toISOString(), this.ownerId);
      } else if (input.target === 'facts_graph') {
        this.database.prepare('DELETE FROM ai_graph_events WHERE owner_id = ?').run(this.ownerId);
        this.database
          .prepare('DELETE FROM ai_graph_relation_evidence WHERE owner_id = ?')
          .run(this.ownerId);
        this.database
          .prepare('DELETE FROM ai_graph_relations WHERE owner_id = ?')
          .run(this.ownerId);
        this.database.prepare('DELETE FROM ai_graph_aliases WHERE owner_id = ?').run(this.ownerId);
        this.database.prepare('DELETE FROM ai_graph_entities WHERE owner_id = ?').run(this.ownerId);
        this.database
          .prepare('DELETE FROM ai_fact_corrections WHERE owner_id = ?')
          .run(this.ownerId);
        this.database
          .prepare('DELETE FROM ai_fact_status_history WHERE owner_id = ?')
          .run(this.ownerId);
        this.database
          .prepare('DELETE FROM ai_fact_record_evidence WHERE owner_id = ?')
          .run(this.ownerId);
        this.database.prepare('DELETE FROM ai_fact_records WHERE owner_id = ?').run(this.ownerId);
      } else throw new AIError('VALIDATION', 'Choose a valid derived memory target.');
    })();
    return this.overview();
  }

  exportSafe(): {
    schemaVersion: 1;
    overview: MemoryOverview;
    facts: MemoryFactListItem[];
    graph: MemoryGraphProjection;
  } {
    return {
      schemaVersion: 1,
      overview: this.overview(),
      facts: this.factsList({ limit: 100 }),
      graph: this.graph({ limit: 100 })
    };
  }
}

export function memorySearchInput(value: unknown): MemorySearchInput {
  const input = objectInput(value, 'Memory search request is invalid.');
  return {
    query: assertQuery(input.query),
    mode: memoryMode(input.mode),
    limit: limitValue(input.limit, 20, 50),
    sourceType: sourceType(input.sourceType),
    dateStart: optionalString(input.dateStart, 'Start date'),
    dateEnd: optionalString(input.dateEnd, 'End date'),
    entity: optionalString(input.entity, 'Entity filter')
  };
}

export function registerAIMemoryIpcHandlers({
  ipcMain,
  service
}: {
  ipcMain: IpcMainLike;
  service: AIMemoryControlService | (() => AIMemoryControlService);
}): void {
  const current = () => (typeof service === 'function' ? service() : service);
  ipcMain.handle('focuslog:ai-memory-overview', () => current().overview());
  ipcMain.handle('focuslog:ai-memory-search', (_event, input) =>
    current().search(memorySearchInput(input))
  );
  ipcMain.handle('focuslog:ai-memory-facts', (_event, input) => {
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    return current().factsList({
      query: optionalString(value.query, 'Fact query'),
      status: factStatus(value.status),
      limit: limitValue(value.limit, 50, 100)
    });
  });
  ipcMain.handle('focuslog:ai-memory-graph', (_event, input) => {
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    return current().graph({
      query: optionalString(value.query, 'Graph query'),
      limit: limitValue(value.limit, 80, 150)
    });
  });
  ipcMain.handle('focuslog:ai-memory-reject-fact', (_event, id, reason) =>
    current().rejectFact(
      assertId(id, 'fact'),
      optionalString(reason, 'Rejection reason') ?? 'Rejected from Memory UI'
    )
  );
  ipcMain.handle('focuslog:ai-memory-correct-fact', (_event, id, input) => {
    const value = objectInput(input, 'Fact correction is invalid.');
    return current().correctFact(assertId(id, 'fact'), {
      subject: optionalString(value.subject, 'Fact subject') ?? '',
      predicate: optionalString(value.predicate, 'Fact predicate') ?? '',
      objectValue: optionalString(value.objectValue, 'Fact value') ?? '',
      factType:
        (optionalString(value.factType, 'Fact type') as FactCandidate['factType']) ?? 'custom',
      confidence: Number(value.confidence ?? 1),
      reason: optionalString(value.reason, 'Correction reason') ?? 'Corrected from Memory UI',
      validFrom: optionalString(value.validFrom, 'Valid from'),
      validTo: optionalString(value.validTo, 'Valid to')
    });
  });
  ipcMain.handle('focuslog:ai-memory-split-entity', (_event, input) => {
    const value = objectInput(input, 'Graph split request is invalid.');
    return current().splitGraphEntity(
      assertId(value.entityId, 'entity'),
      optionalString(value.name, 'Entity name') ?? '',
      (optionalString(value.type, 'Entity type') as Parameters<
        AIMemoryControlService['splitGraphEntity']
      >[2]) ?? 'custom'
    );
  });
  ipcMain.handle('focuslog:ai-memory-set-subsystem', (_event, input) => {
    const value = objectInput(input, 'Memory subsystem request is invalid.');
    return current().setSubsystem({
      subsystem: subsystem(value.subsystem),
      enabled: Boolean(value.enabled)
    });
  });
  ipcMain.handle('focuslog:ai-memory-rebuild-namespace', () => current().rebuildActiveNamespace());
  ipcMain.handle('focuslog:ai-memory-delete-derived', (_event, input) => {
    const value = objectInput(input, 'Derived memory deletion request is invalid.');
    if (!['embeddings', 'facts_graph'].includes(String(value.target)))
      throw new AIError('VALIDATION', 'Choose a valid derived memory target.');
    return current().deleteDerived({
      target: value.target as 'embeddings' | 'facts_graph',
      confirmation: optionalString(value.confirmation, 'Confirmation') ?? ''
    });
  });
  ipcMain.handle('focuslog:ai-memory-export', () => current().exportSafe());
}
