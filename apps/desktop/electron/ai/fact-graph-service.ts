import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import type { AIJobHandler } from './job-worker.js';
import { AIJobQueue } from './job-queue.js';

type FactType =
  | 'identity'
  | 'preference'
  | 'project'
  | 'habit'
  | 'goal'
  | 'relationship'
  | 'status'
  | 'temporal'
  | 'custom';
type FactStatus =
  | 'proposed'
  | 'active'
  | 'reinforced'
  | 'superseded'
  | 'contradicted'
  | 'stale'
  | 'rejected'
  | 'corrected';
type EntityType =
  | 'person'
  | 'project'
  | 'habit'
  | 'goal'
  | 'place'
  | 'organization'
  | 'topic'
  | 'feature'
  | 'custom';
type RelationPredicate =
  | 'related_to'
  | 'works_on'
  | 'prefers'
  | 'blocked_by'
  | 'supports'
  | 'contradicts'
  | 'alias_of'
  | 'custom';

export interface FactCandidate {
  subject: string;
  predicate: string;
  objectValue: string;
  factType: FactType;
  confidence: number;
  evidenceRevisionIds: string[];
  validFrom?: string | null;
  validTo?: string | null;
  temporalQualifier?: string | null;
  normalizedValue?: Record<string, unknown>;
}

export interface GraphRelationCandidate {
  sourceName: string;
  sourceType: EntityType;
  predicate: RelationPredicate;
  targetName: string;
  targetType: EntityType;
  confidence: number;
  factId?: string | null;
  evidenceRevisionIds: string[];
}

export interface SafeFactProjection {
  id: string;
  subject: string;
  predicate: string;
  objectValue: string;
  factType: FactType;
  status: FactStatus;
  confidence: number;
  validFrom: string | null;
  validTo: string | null;
  temporalQualifier: string | null;
  origin: string;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafeGraphProjection {
  entities: Array<{
    id: string;
    canonicalName: string;
    nodeType: EntityType;
    status: string;
    confidence: number;
  }>;
  relations: Array<{
    id: string;
    sourceEntityId: string;
    predicate: RelationPredicate;
    targetEntityId: string;
    status: string;
    confidence: number;
    evidenceCount: number;
  }>;
}

type EvidenceRow = {
  checkInId: string;
  revisionId: string;
  body: string;
  deletedAt: string | null;
};
type FactRow = SafeFactProjection & { evidenceCount: number };

const allowedFactPredicates = new Set([
  'is',
  'prefers',
  'works_on',
  'supports',
  'blocked_by',
  'related_to',
  'has_status',
  'custom'
]);

function now(): string {
  return new Date().toISOString();
}
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function redact(value: string): string {
  return value
    .replace(/(bearer|authorization|api[_-]?key|x-api-key)\s*[:=]?\s*[^\s,;]+/giu, '$1 [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, 'sk-[redacted]')
    .slice(0, 220);
}
function assertIdentifier(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 160)
    throw new AIError('VALIDATION', `${label} is invalid.`);
  return trimmed;
}
function assertConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new AIError('VALIDATION', 'Confidence must be between 0 and 1.');
  return value;
}

export class FactGraphService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  queueHandlers(): Record<
    | 'fact_extract_source'
    | 'fact_reconcile_subject'
    | 'fact_mark_stale'
    | 'fact_rebuild_range'
    | 'graph_update_from_fact'
    | 'graph_resolve_entity'
    | 'graph_rebuild_subject'
    | 'graph_remove_unsupported_edges',
    AIJobHandler
  > {
    return {
      fact_extract_source: async ({ payload, signal }) => {
        if (signal.aborted)
          throw new AIError('CANCELLATION', 'Fact extraction was cancelled.', false);
        const sourceId = String(payload.sourceId ?? '');
        const candidates = Array.isArray(payload.candidates)
          ? (payload.candidates as FactCandidate[])
          : [];
        const facts = this.extractFactsFromSource(sourceId, candidates, this.provenance(payload));
        return { resultReference: facts.map((fact) => fact.id).join(',') };
      },
      fact_reconcile_subject: async ({ payload }) => ({
        resultReference: this.reconcileSubject(String(payload.subject ?? ''))
          .map((fact) => fact.id)
          .join(',')
      }),
      fact_mark_stale: async ({ payload }) => ({
        resultReference: String(
          this.markSourceStale(
            String(payload.sourceId ?? ''),
            payload.revisionId ? String(payload.revisionId) : undefined
          )
        )
      }),
      fact_rebuild_range: async ({ payload }) => ({
        resultReference: this.rebuildRange(
          String(payload.start ?? ''),
          String(payload.end ?? ''),
          Array.isArray(payload.candidatesBySource)
            ? (payload.candidatesBySource as Array<{
                sourceId: string;
                candidates: FactCandidate[];
              }>)
            : []
        ).join(',')
      }),
      graph_update_from_fact: async ({ payload }) => ({
        resultReference: this.updateGraphFromFact(String(payload.factId ?? ''))
          .relations.map((relation) => relation.id)
          .join(',')
      }),
      graph_resolve_entity: async ({ payload }) => ({
        resultReference: this.resolveEntity(
          String(payload.entityId ?? ''),
          String(payload.alias ?? ''),
          Number(payload.confidence ?? 0.5)
        )
      }),
      graph_rebuild_subject: async ({ payload }) => ({
        resultReference: this.rebuildGraphSubject(String(payload.subject ?? ''))
          .relations.map((relation) => relation.id)
          .join(',')
      }),
      graph_remove_unsupported_edges: async ({ payload }) => ({
        resultReference: String(
          this.removeUnsupportedEdges(payload.factId ? String(payload.factId) : undefined)
        )
      })
    };
  }

  enqueue(
    queue: AIJobQueue,
    kind: Parameters<AIJobQueue['enqueue']>[0]['kind'],
    payload: Record<string, unknown>,
    key: string
  ) {
    return queue.enqueue({
      kind,
      idempotencyKey: `phase3c:${kind}:${key}`,
      payload,
      maxAttempts: 3,
      privacyMode: 'LOCAL'
    });
  }

  extractFactsFromSource(
    sourceId: string,
    candidates: FactCandidate[],
    provenance: {
      promptId?: string | null;
      promptVersion?: string | null;
      providerProfileId?: string | null;
      modelId?: string | null;
      schemaVersion?: string;
      extractionVersion?: string;
    } = {}
  ): SafeFactProjection[] {
    if (candidates.length === 0)
      throw new AIError(
        'VALIDATION',
        'Fact extraction requires at least one structured candidate.'
      );
    return this.database.transaction(() =>
      candidates.map((candidate) => this.insertFact(sourceId, candidate, provenance))
    )();
  }

  rejectFact(factId: string, reason: string): SafeFactProjection {
    this.transitionFact(factId, 'rejected', reason, 'user');
    this.database
      .prepare(
        'INSERT INTO ai_fact_corrections (id, owner_id, fact_id, action, correction_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, factId, 'reject', '{}', redact(reason), now());
    return this.fact(factId);
  }

  correctFact(
    factId: string,
    correction: Omit<FactCandidate, 'evidenceRevisionIds'> & { reason: string }
  ): SafeFactProjection {
    const original = this.fact(factId);
    const evidence = this.evidenceForFact(factId);
    if (evidence.length === 0)
      throw new AIError('VALIDATION', 'Corrected facts preserve original evidence.');
    return this.database.transaction(() => {
      const corrected = this.insertFact(
        evidence[0]!.sourceId,
        { ...correction, evidenceRevisionIds: evidence.map((row) => row.revisionId) },
        { schemaVersion: '3C-user', extractionVersion: 'user-correction' },
        'user_overlay',
        'corrected'
      );
      this.database
        .prepare(
          'UPDATE ai_fact_records SET status = ?, corrected_by_fact_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
        )
        .run('corrected', corrected.id, now(), original.id, this.ownerId);
      this.database
        .prepare(
          'INSERT INTO ai_fact_corrections (id, owner_id, fact_id, corrected_fact_id, action, correction_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          ulid(),
          this.ownerId,
          original.id,
          corrected.id,
          'correct',
          JSON.stringify(correction.normalizedValue ?? {}),
          redact(correction.reason),
          now()
        );
      this.history(original.id, original.status, 'corrected', correction.reason, 'user');
      return corrected;
    })();
  }

  reconcileSubject(subject: string): SafeFactProjection[] {
    const facts = this.factsBySubject(subject).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const activeByPredicate = new Map<string, SafeFactProjection>();
    this.database.transaction(() => {
      for (const fact of facts) {
        if (fact.status === 'rejected' || fact.status === 'stale') continue;
        const key = `${fact.predicate}:${fact.objectValue}`;
        const same = activeByPredicate.get(key);
        if (same) {
          const winner = fact.confidence > same.confidence ? fact : same;
          const loser = winner.id === fact.id ? same : fact;
          const confidence = Math.min(1, Math.max(same.confidence, fact.confidence) + 0.05);
          this.transitionFact(
            loser.id,
            'superseded',
            `Reinforced by ${winner.id}`,
            'system',
            winner.id
          );
          this.database
            .prepare(
              'UPDATE ai_fact_records SET status = ?, confidence = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
            )
            .run('reinforced', confidence, now(), winner.id, this.ownerId);
          activeByPredicate.set(key, { ...winner, status: 'reinforced', confidence });
        } else {
          activeByPredicate.set(key, fact);
          if (fact.status === 'proposed')
            this.transitionFact(
              fact.id,
              'active',
              'Initial reconciliation accepted supported fact.',
              'system'
            );
        }
      }
      const valuesByPredicate = new Map<string, SafeFactProjection[]>();
      for (const fact of this.factsBySubject(subject).filter((item) =>
        ['active', 'reinforced'].includes(item.status)
      )) {
        const group = valuesByPredicate.get(fact.predicate) ?? [];
        group.push(fact);
        valuesByPredicate.set(fact.predicate, group);
      }
      for (const group of valuesByPredicate.values()) {
        const values = new Set(group.map((fact) => fact.objectValue));
        if (values.size > 1)
          for (const fact of group)
            this.transitionFact(
              fact.id,
              'contradicted',
              'Conflicting active values coexist until user/system reconciliation.',
              'system'
            );
      }
    })();
    return this.factsBySubject(subject);
  }

  updateGraphFromFact(factId: string): SafeGraphProjection {
    const fact = this.fact(factId);
    const evidence = this.evidenceForFact(factId);
    const source = this.upsertEntity(
      fact.subject,
      this.entityTypeForFact(fact.factType),
      fact.confidence,
      'automated'
    );
    const target = this.upsertEntity(
      fact.objectValue,
      this.entityTypeForFact(fact.factType),
      fact.confidence,
      'automated'
    );
    const relation = this.upsertRelation(
      source.id,
      this.relationForFact(fact.predicate),
      target.id,
      fact.confidence,
      fact.id,
      evidence
    );
    this.graphEvent(
      source.id,
      relation.id,
      'graph_update_from_fact',
      `Updated graph relation from fact ${fact.id}.`
    );
    return this.graphProjection(fact.subject);
  }

  createRelation(candidate: GraphRelationCandidate): SafeGraphProjection {
    const evidence = this.validateEvidence(candidate.evidenceRevisionIds);
    const source = this.upsertEntity(
      candidate.sourceName,
      candidate.sourceType,
      candidate.confidence,
      'automated'
    );
    const target = this.upsertEntity(
      candidate.targetName,
      candidate.targetType,
      candidate.confidence,
      'automated'
    );
    this.upsertRelation(
      source.id,
      candidate.predicate,
      target.id,
      candidate.confidence,
      candidate.factId ?? null,
      evidence
    );
    return this.graphProjection(candidate.sourceName);
  }

  resolveEntity(entityId: string, alias: string, confidence: number): string {
    const entity = this.database
      .prepare('SELECT id FROM ai_graph_entities WHERE owner_id = ? AND id = ? AND status != ?')
      .get(this.ownerId, entityId, 'tombstoned') as { id: string } | undefined;
    if (!entity) throw new AIError('VALIDATION', 'Graph entity is unavailable.');
    const normalizedAlias = normalize(alias);
    if (normalizedAlias === normalize(entityId))
      throw new AIError('VALIDATION', 'Cyclic alias mapping is not allowed.');
    const existing = this.database
      .prepare(
        'SELECT entity_id AS entityId FROM ai_graph_aliases WHERE owner_id = ? AND normalized_alias = ? AND status = ?'
      )
      .get(this.ownerId, normalizedAlias, 'active') as { entityId: string } | undefined;
    if (existing && existing.entityId !== entityId)
      throw new AIError('VALIDATION', 'Alias already belongs to another entity.');
    const id = ulid();
    this.database
      .prepare(
        'INSERT INTO ai_graph_aliases (id, owner_id, entity_id, alias, normalized_alias, status, confidence, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, normalized_alias) DO UPDATE SET entity_id = excluded.entity_id, status = excluded.status, confidence = excluded.confidence, updated_at = excluded.updated_at'
      )
      .run(
        id,
        this.ownerId,
        entityId,
        assertIdentifier(alias, 'Alias'),
        normalizedAlias,
        'active',
        assertConfidence(confidence),
        confidence >= 0.95 ? 'automated' : 'user',
        now(),
        now()
      );
    this.graphEvent(
      entityId,
      null,
      'graph_resolve_entity',
      confidence >= 0.95
        ? 'Accepted high-confidence alias.'
        : 'Stored conservative alias without merging entities.'
    );
    return entityId;
  }

  splitEntity(entityId: string, newName: string, nodeType: EntityType): string {
    const entity = this.upsertEntity(newName, nodeType, 1, 'user_overlay');
    this.database
      .prepare(
        'UPDATE ai_graph_aliases SET status = ?, updated_at = ? WHERE owner_id = ? AND entity_id = ?'
      )
      .run('rejected', now(), this.ownerId, entityId);
    this.graphEvent(entity.id, null, 'graph_split_entity', `Split from ${entityId}.`);
    return entity.id;
  }

  markSourceStale(sourceId: string, revisionId?: string): number {
    return this.database.transaction(() => {
      const params: unknown[] = [this.ownerId, sourceId];
      const revisionClause = revisionId ? 'AND revision_id = ?' : '';
      if (revisionId) params.push(revisionId);
      const factIds = (
        this.database
          .prepare(
            `SELECT DISTINCT fact_id AS id FROM ai_fact_record_evidence WHERE owner_id = ? AND source_id = ? ${revisionClause}`
          )
          .all(...params) as Array<{ id: string }>
      ).map((row) => row.id);
      for (const factId of factIds)
        this.transitionFact(factId, 'stale', 'Source evidence was deleted or changed.', 'system');
      this.database
        .prepare(
          `UPDATE ai_graph_relations SET status = 'unsupported', updated_at = ? WHERE owner_id = ? AND id IN (SELECT relation_id FROM ai_graph_relation_evidence WHERE owner_id = ? AND source_id = ? ${revisionId ? 'AND revision_id = ?' : ''})`
        )
        .run(now(), this.ownerId, this.ownerId, sourceId, ...(revisionId ? [revisionId] : []));
      return factIds.length;
    })();
  }

  removeUnsupportedEdges(factId?: string): number {
    const params: unknown[] = [this.ownerId];
    const factClause = factId ? 'AND source_fact_id = ?' : '';
    if (factId) params.push(factId);
    return this.database
      .prepare(
        `UPDATE ai_graph_relations SET status = 'unsupported', updated_at = ? WHERE owner_id = ? ${factClause} AND source_fact_id NOT IN (SELECT id FROM ai_fact_records WHERE owner_id = ? AND status IN ('active','reinforced','corrected'))`
      )
      .run(now(), ...params, this.ownerId).changes;
  }

  rebuildRange(
    start: string,
    end: string,
    candidatesBySource: Array<{ sourceId: string; candidates: FactCandidate[] }>
  ): string[] {
    const sources = this.database
      .prepare(
        'SELECT id FROM check_ins WHERE owner_id = ? AND deleted_at IS NULL AND submitted_at >= ? AND submitted_at < ? ORDER BY submitted_at'
      )
      .all(this.ownerId, start, end) as Array<{ id: string }>;
    const sourceIds = new Set(sources.map((source) => source.id));
    const results: string[] = [];
    for (const entry of candidatesBySource)
      if (sourceIds.has(entry.sourceId))
        results.push(
          ...this.extractFactsFromSource(entry.sourceId, entry.candidates).map((fact) => fact.id)
        );
    return results;
  }

  rebuildGraphSubject(subject: string): SafeGraphProjection {
    for (const fact of this.factsBySubject(subject).filter((item) =>
      ['active', 'reinforced', 'corrected'].includes(item.status)
    ))
      this.updateGraphFromFact(fact.id);
    return this.graphProjection(subject);
  }

  fact(id: string): SafeFactProjection {
    const row = this.database
      .prepare(
        `SELECT fact.id, fact.subject, fact.predicate, fact.object_value AS objectValue, fact.fact_type AS factType, fact.status, fact.confidence, fact.valid_from AS validFrom, fact.valid_to AS validTo, fact.temporal_qualifier AS temporalQualifier, fact.origin, fact.created_at AS createdAt, fact.updated_at AS updatedAt, COUNT(evidence.revision_id) AS evidenceCount FROM ai_fact_records fact LEFT JOIN ai_fact_record_evidence evidence ON evidence.fact_id = fact.id WHERE fact.owner_id = ? AND fact.id = ? GROUP BY fact.id`
      )
      .get(this.ownerId, id) as FactRow | undefined;
    if (!row) throw new AIError('VALIDATION', 'Fact is unavailable.');
    return row;
  }

  factsBySubject(subject: string): SafeFactProjection[] {
    return this.database
      .prepare(
        `SELECT fact.id, fact.subject, fact.predicate, fact.object_value AS objectValue, fact.fact_type AS factType, fact.status, fact.confidence, fact.valid_from AS validFrom, fact.valid_to AS validTo, fact.temporal_qualifier AS temporalQualifier, fact.origin, fact.created_at AS createdAt, fact.updated_at AS updatedAt, COUNT(evidence.revision_id) AS evidenceCount FROM ai_fact_records fact LEFT JOIN ai_fact_record_evidence evidence ON evidence.fact_id = fact.id WHERE fact.owner_id = ? AND lower(fact.subject) = lower(?) GROUP BY fact.id ORDER BY fact.updated_at DESC`
      )
      .all(this.ownerId, subject) as FactRow[];
  }

  graphProjection(subject: string): SafeGraphProjection {
    const entities = this.database
      .prepare(
        'SELECT id, canonical_name AS canonicalName, node_type AS nodeType, status, confidence FROM ai_graph_entities WHERE owner_id = ? AND (lower(canonical_name) = lower(?) OR id IN (SELECT entity_id FROM ai_graph_aliases WHERE owner_id = ? AND lower(alias) = lower(?))) ORDER BY updated_at DESC'
      )
      .all(this.ownerId, subject, this.ownerId, subject) as SafeGraphProjection['entities'];
    const ids = entities.map((entity) => entity.id);
    if (ids.length === 0) return { entities, relations: [] };
    const placeholders = ids.map(() => '?').join(',');
    const relations = this.database
      .prepare(
        `SELECT relation.id, relation.source_entity_id AS sourceEntityId, relation.predicate, relation.target_entity_id AS targetEntityId, relation.status, relation.confidence, COUNT(evidence.revision_id) AS evidenceCount FROM ai_graph_relations relation LEFT JOIN ai_graph_relation_evidence evidence ON evidence.relation_id = relation.id WHERE relation.owner_id = ? AND (relation.source_entity_id IN (${placeholders}) OR relation.target_entity_id IN (${placeholders})) GROUP BY relation.id ORDER BY relation.updated_at DESC`
      )
      .all(this.ownerId, ...ids, ...ids) as SafeGraphProjection['relations'];
    return { entities, relations };
  }

  safeDiagnostics(): string {
    const rows = this.database
      .prepare(
        `SELECT event_type AS eventType, message FROM ai_graph_events WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50`
      )
      .all(this.ownerId) as Array<{ eventType: string; message: string }>;
    return JSON.stringify(rows);
  }

  private insertFact(
    sourceId: string,
    candidate: FactCandidate,
    provenance: {
      promptId?: string | null;
      promptVersion?: string | null;
      providerProfileId?: string | null;
      modelId?: string | null;
      schemaVersion?: string;
      extractionVersion?: string;
    },
    origin: 'automated' | 'user_overlay' | 'imported' = 'automated',
    initialStatus: FactStatus = 'proposed'
  ): SafeFactProjection {
    if (!allowedFactPredicates.has(candidate.predicate))
      throw new AIError('VALIDATION', 'Unsupported fact predicate.');
    if (
      candidate.factType === 'temporal' &&
      !candidate.temporalQualifier &&
      !candidate.validFrom &&
      !candidate.validTo
    )
      throw new AIError('VALIDATION', 'Temporal facts require temporal qualification.');
    const evidence = this.validateEvidence(candidate.evidenceRevisionIds, sourceId);
    const factId = ulid();
    const ts = now();
    this.database
      .prepare(
        `INSERT INTO ai_fact_records (id, owner_id, subject, predicate, object_value, normalized_value_json, fact_type, status, confidence, valid_from, valid_to, temporal_qualifier, origin, prompt_id, prompt_version, schema_version, provider_profile_id, model_id, extraction_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        factId,
        this.ownerId,
        assertIdentifier(candidate.subject, 'Subject'),
        candidate.predicate,
        assertIdentifier(candidate.objectValue, 'Object value'),
        JSON.stringify(
          candidate.normalizedValue ?? { normalized: normalize(candidate.objectValue) }
        ),
        candidate.factType,
        initialStatus,
        assertConfidence(candidate.confidence),
        candidate.validFrom ?? null,
        candidate.validTo ?? null,
        candidate.temporalQualifier ?? null,
        origin,
        provenance.promptId ?? null,
        provenance.promptVersion ?? null,
        provenance.schemaVersion ?? '3C-v1',
        provenance.providerProfileId ?? null,
        provenance.modelId ?? null,
        provenance.extractionVersion ?? 'fact-graph-v1',
        ts,
        ts
      );
    for (const row of evidence)
      this.database
        .prepare(
          'INSERT INTO ai_fact_record_evidence (fact_id, owner_id, source_type, source_id, revision_id, evidence_hash, excerpt_redacted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          factId,
          this.ownerId,
          'check_in_revision',
          row.checkInId,
          row.revisionId,
          hash(row.body),
          redact(row.body),
          ts
        );
    this.history(
      factId,
      null,
      initialStatus,
      'Fact candidate persisted with validated evidence.',
      origin === 'automated' ? 'system' : 'user'
    );
    return this.fact(factId);
  }

  private validateEvidence(revisionIds: string[], sourceId?: string): EvidenceRow[] {
    if (!Array.isArray(revisionIds) || revisionIds.length === 0)
      throw new AIError('VALIDATION', 'Automated facts require at least one evidence reference.');
    const placeholders = revisionIds.map(() => '?').join(',');
    const rows = this.database
      .prepare(
        `SELECT check_ins.id AS checkInId, revision.id AS revisionId, revision.body, check_ins.deleted_at AS deletedAt FROM check_in_revisions revision JOIN check_ins ON check_ins.id = revision.check_in_id WHERE check_ins.owner_id = ? AND revision.id IN (${placeholders})`
      )
      .all(this.ownerId, ...revisionIds) as EvidenceRow[];
    if (rows.length !== new Set(revisionIds).size)
      throw new AIError('VALIDATION', 'Fact evidence references unsupported source revisions.');
    if (rows.some((row) => row.deletedAt))
      throw new AIError('VALIDATION', 'Deleted source revisions cannot support active facts.');
    if (sourceId && rows.some((row) => row.checkInId !== sourceId))
      throw new AIError('VALIDATION', 'Fact evidence does not belong to the extraction source.');
    return rows;
  }

  private evidenceForFact(factId: string): Array<{ sourceId: string; revisionId: string }> {
    return this.database
      .prepare(
        'SELECT source_id AS sourceId, revision_id AS revisionId FROM ai_fact_record_evidence WHERE owner_id = ? AND fact_id = ? ORDER BY created_at'
      )
      .all(this.ownerId, factId) as Array<{ sourceId: string; revisionId: string }>;
  }

  private transitionFact(
    factId: string,
    status: FactStatus,
    reason: string,
    actor: 'system' | 'user' | 'recovery',
    linkedFactId?: string
  ): void {
    const prior = this.fact(factId).status;
    this.database
      .prepare(
        'UPDATE ai_fact_records SET status = ?, superseded_by_fact_id = COALESCE(?, superseded_by_fact_id), updated_at = ? WHERE id = ? AND owner_id = ?'
      )
      .run(status, linkedFactId ?? null, now(), factId, this.ownerId);
    this.history(factId, prior, status, reason, actor);
  }

  private history(
    factId: string,
    prior: string | null,
    resulting: string,
    reason: string,
    actor: 'system' | 'user' | 'recovery'
  ): void {
    this.database
      .prepare(
        'INSERT INTO ai_fact_status_history (id, owner_id, fact_id, prior_status, resulting_status, reason, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, factId, prior, resulting, redact(reason), actor, now());
  }

  private upsertEntity(
    name: string,
    type: EntityType,
    confidence: number,
    origin: 'automated' | 'user_overlay' | 'imported'
  ): { id: string } {
    const id = ulid();
    this.database
      .prepare(
        `INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 'fact-graph-v1', ?, ?) ON CONFLICT(owner_id, normalized_name, node_type) DO UPDATE SET confidence = MAX(confidence, excluded.confidence), status = CASE WHEN status = 'tombstoned' THEN status ELSE 'active' END, updated_at = excluded.updated_at`
      )
      .run(
        id,
        this.ownerId,
        assertIdentifier(name, 'Entity name'),
        type,
        normalize(name),
        assertConfidence(confidence),
        origin,
        now(),
        now()
      );
    return this.database
      .prepare(
        'SELECT id FROM ai_graph_entities WHERE owner_id = ? AND normalized_name = ? AND node_type = ?'
      )
      .get(this.ownerId, normalize(name), type) as { id: string };
  }

  private upsertRelation(
    sourceId: string,
    predicate: RelationPredicate,
    targetId: string,
    confidence: number,
    factId: string | null,
    evidence: Array<{ checkInId?: string; sourceId?: string; revisionId: string; body?: string }>
  ): { id: string } {
    if (sourceId === targetId && predicate === 'alias_of')
      throw new AIError('VALIDATION', 'Cyclic alias relation is not allowed.');
    const existing = this.database
      .prepare(
        "SELECT id FROM ai_graph_relations WHERE owner_id = ? AND source_entity_id = ? AND predicate = ? AND target_entity_id = ? AND COALESCE(valid_from, '') = '' AND COALESCE(valid_to, '') = '' ORDER BY updated_at DESC LIMIT 1"
      )
      .get(this.ownerId, sourceId, predicate, targetId) as { id: string } | undefined;
    const relation = existing ?? { id: ulid() };
    if (existing)
      this.database
        .prepare(
          'UPDATE ai_graph_relations SET confidence = MAX(confidence, ?), status = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
        )
        .run(assertConfidence(confidence), 'active', now(), existing.id, this.ownerId);
    else
      this.database
        .prepare(
          `INSERT INTO ai_graph_relations (id, owner_id, source_entity_id, predicate, target_entity_id, status, confidence, origin, extraction_version, source_fact_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, 'automated', 'fact-graph-v1', ?, ?, ?)`
        )
        .run(
          relation.id,
          this.ownerId,
          sourceId,
          predicate,
          targetId,
          assertConfidence(confidence),
          factId,
          now(),
          now()
        );
    for (const row of evidence)
      this.database
        .prepare(
          'INSERT OR IGNORE INTO ai_graph_relation_evidence (relation_id, owner_id, fact_id, source_type, source_id, revision_id, evidence_hash, excerpt_redacted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          relation.id,
          this.ownerId,
          factId,
          'check_in_revision',
          row.checkInId ?? row.sourceId ?? '',
          row.revisionId,
          hash(row.body ?? row.revisionId),
          redact(row.body ?? row.revisionId),
          now()
        );
    return relation;
  }

  private graphEvent(
    entityId: string | null,
    relationId: string | null,
    eventType: string,
    message: string
  ): void {
    this.database
      .prepare(
        'INSERT INTO ai_graph_events (id, owner_id, entity_id, relation_id, event_type, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, entityId, relationId, eventType, redact(message), now());
  }

  private entityTypeForFact(type: FactType): EntityType {
    if (type === 'project') return 'project';
    if (type === 'habit') return 'habit';
    if (type === 'goal') return 'goal';
    return 'topic';
  }

  private relationForFact(predicate: string): RelationPredicate {
    if (predicate === 'works_on') return 'works_on';
    if (predicate === 'prefers') return 'prefers';
    if (predicate === 'blocked_by') return 'blocked_by';
    if (predicate === 'supports') return 'supports';
    return 'related_to';
  }

  private provenance(payload: Record<string, unknown>) {
    return {
      promptId: payload.promptId ? String(payload.promptId) : null,
      promptVersion: payload.promptVersion ? String(payload.promptVersion) : null,
      providerProfileId: payload.providerProfileId ? String(payload.providerProfileId) : null,
      modelId: payload.modelId ? String(payload.modelId) : null,
      schemaVersion: payload.schemaVersion ? String(payload.schemaVersion) : '3C-v1',
      extractionVersion: payload.extractionVersion
        ? String(payload.extractionVersion)
        : 'fact-graph-v1'
    };
  }
}
