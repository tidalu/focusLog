import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import type { AIService } from './ai-service.js';
import { providerDescriptor } from './providers.js';
import type { PrivacyMode } from './types.js';
import {
  chunkEmbeddingSource,
  EMBEDDING_CHUNKING_POLICY_V1,
  type DeterministicEmbeddingChunk,
  type EmbeddingChunkingPolicy,
  type EmbeddingSource,
  type EmbeddingSourceType
} from './embedding-chunking.js';

export type EmbeddingDistanceMetric = 'cosine' | 'dot' | 'l2';
export type EmbeddingNamespaceStatus = 'building' | 'active' | 'deprecated' | 'failed' | 'deleted';
export type EmbeddingCoverageStatus = 'not_started' | 'incomplete' | 'verified' | 'failed';

export interface CreateEmbeddingNamespaceInput {
  name: string;
  providerProfileId: string;
  modelId?: string | null;
  dimensions: number;
  distanceMetric?: EmbeddingDistanceMetric;
  privacyMode?: PrivacyMode;
  sourceTypes?: EmbeddingSourceType[];
  rebuildOfNamespaceId?: string | null;
  chunkingPolicy?: EmbeddingChunkingPolicy;
}

export interface SafeEmbeddingNamespace {
  id: string;
  name: string;
  providerProfileId: string;
  providerName: string | null;
  providerId: string;
  modelId: string;
  dimensions: number;
  distanceMetric: EmbeddingDistanceMetric;
  privacyMode: Exclude<PrivacyMode, 'DISABLED'>;
  privacyClass: 'local' | 'cloud';
  chunkingVersion: string;
  chunkingSchemaVersion: number;
  sourceTypes: EmbeddingSourceType[];
  status: EmbeddingNamespaceStatus;
  coverageStatus: EmbeddingCoverageStatus;
  coverageExpectedChunks: number;
  coverageIndexedChunks: number;
  storageBytes: string;
  lastRebuildStartedAt: string | null;
  lastRebuildCompletedAt: string | null;
  activeAt: string | null;
  deprecatedAt: string | null;
  replacementNamespaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

type NamespaceRow = Omit<SafeEmbeddingNamespace, 'sourceTypes' | 'storageBytes'> & {
  sourceTypesJson: string;
  storageBytes: number;
};

const allowedSourceTypes: EmbeddingSourceType[] = [
  'check_in_revision',
  'daily_analysis',
  'analysis_result'
];
const allowedMetrics: EmbeddingDistanceMetric[] = ['cosine', 'dot', 'l2'];

function timestamp(): string {
  return new Date().toISOString();
}

function hashVector(vector: number[]): string {
  return createHash('sha256').update(JSON.stringify(vector)).digest('hex');
}

function safeName(value: string): string {
  const trimmed = value.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,79}$/u.test(trimmed))
    throw new AIError('VALIDATION', 'Choose a valid embedding namespace name.');
  return trimmed;
}

function safeDimensions(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100_000)
    throw new AIError('VALIDATION', 'Embedding dimensions must be a positive integer.');
  return value;
}

function safeMetric(value: EmbeddingDistanceMetric | undefined): EmbeddingDistanceMetric {
  const metric = value ?? 'cosine';
  if (!allowedMetrics.includes(metric))
    throw new AIError('VALIDATION', 'Choose a valid embedding distance metric.');
  return metric;
}

function safeSourceTypes(value: EmbeddingSourceType[] | undefined): EmbeddingSourceType[] {
  const sourceTypes: EmbeddingSourceType[] = value?.length ? value : ['check_in_revision'];
  if (!sourceTypes.every((item) => allowedSourceTypes.includes(item)))
    throw new AIError('VALIDATION', 'Choose valid embedding source types.');
  return [...new Set<EmbeddingSourceType>(sourceTypes)].sort();
}

function safePrivacyMode(value: PrivacyMode): Exclude<PrivacyMode, 'DISABLED'> {
  if (value === 'DISABLED')
    throw new AIError('INVALID_CONFIGURATION', 'AI embeddings are disabled.');
  return value;
}

export class EmbeddingNamespaceService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService
  ) {}

  create(input: CreateEmbeddingNamespaceInput): SafeEmbeddingNamespace {
    const profile = this.ai.profile(input.providerProfileId);
    const descriptor = providerDescriptor(profile.providerId);
    const settings = this.ai.getSettings();
    if (!settings.featureFlags.embeddings)
      throw new AIError(
        'UNSUPPORTED_CAPABILITY',
        'embeddings is disabled by its AI feature switch.'
      );
    if (!profile.enabled)
      throw new AIError('INVALID_CONFIGURATION', 'This provider profile is disabled.');
    if (!descriptor.capabilities.embeddings)
      throw new AIError('UNSUPPORTED_CAPABILITY', 'This provider does not support embeddings.');
    const privacyMode = safePrivacyMode(input.privacyMode ?? settings.mode);
    if (privacyMode === 'LOCAL' && descriptor.kind !== 'LOCAL')
      throw new AIError(
        'PERMISSION',
        'Local privacy mode never sends embedding data to cloud providers.'
      );
    if (descriptor.kind === 'CLOUD') {
      const consent = this.database
        .prepare(
          'SELECT 1 FROM ai_cloud_consents WHERE owner_id = ? AND provider_profile_id = ? AND mode = ?'
        )
        .get(this.ownerId, profile.id, privacyMode);
      if (!consent)
        throw new AIError(
          'PERMISSION',
          'Cloud consent is required before FocusLog can create cloud embeddings.'
        );
    }
    const modelId = input.modelId ?? profile.embeddingModel;
    if (!modelId)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'Select an embedding model for this provider profile.'
      );
    const dimensions = safeDimensions(input.dimensions);
    const distanceMetric = safeMetric(input.distanceMetric);
    const sourceTypes = safeSourceTypes(input.sourceTypes);
    const policy = input.chunkingPolicy ?? EMBEDDING_CHUNKING_POLICY_V1;
    const id = ulid();
    const now = timestamp();
    this.database
      .prepare(
        `INSERT INTO ai_vector_namespaces (id, owner_id, name, provider_profile_id, provider_id, model_id, dimensions, distance_metric,
          privacy_mode, privacy_class, chunking_version, chunking_schema_version, source_types_json, status, coverage_status,
          rebuild_of_namespace_id, last_rebuild_started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'building', 'not_started', ?, ?, ?, ?)`
      )
      .run(
        id,
        this.ownerId,
        safeName(input.name),
        profile.id,
        profile.providerId,
        modelId,
        dimensions,
        distanceMetric,
        privacyMode,
        descriptor.kind === 'LOCAL' ? 'local' : 'cloud',
        policy.chunkingVersion,
        policy.schemaVersion,
        JSON.stringify(sourceTypes),
        input.rebuildOfNamespaceId ?? null,
        now,
        now,
        now
      );
    this.recordEvent(id, null, 'building', 'created');
    return this.get(id);
  }

  inspect(id: string): SafeEmbeddingNamespace {
    return this.get(id);
  }

  list(): SafeEmbeddingNamespace[] {
    return (
      this.database
        .prepare(
          `SELECT namespace.id, namespace.name, namespace.provider_profile_id AS providerProfileId, profile.name AS providerName,
          namespace.provider_id AS providerId, namespace.model_id AS modelId, namespace.dimensions, namespace.distance_metric AS distanceMetric,
          namespace.privacy_mode AS privacyMode, namespace.privacy_class AS privacyClass, namespace.chunking_version AS chunkingVersion,
          namespace.chunking_schema_version AS chunkingSchemaVersion, namespace.source_types_json AS sourceTypesJson, namespace.status,
          namespace.coverage_status AS coverageStatus, namespace.coverage_expected_chunks AS coverageExpectedChunks,
          namespace.coverage_indexed_chunks AS coverageIndexedChunks, namespace.storage_bytes AS storageBytes,
          namespace.last_rebuild_started_at AS lastRebuildStartedAt, namespace.last_rebuild_completed_at AS lastRebuildCompletedAt,
          namespace.active_at AS activeAt, namespace.deprecated_at AS deprecatedAt, namespace.replacement_namespace_id AS replacementNamespaceId,
          namespace.created_at AS createdAt, namespace.updated_at AS updatedAt
         FROM ai_vector_namespaces namespace
         LEFT JOIN ai_provider_profiles profile ON profile.id = namespace.provider_profile_id AND profile.owner_id = namespace.owner_id
         WHERE namespace.owner_id = ? AND namespace.status <> 'deleted'
         ORDER BY namespace.updated_at DESC`
        )
        .all(this.ownerId) as NamespaceRow[]
    ).map((row) => this.project(row));
  }

  rebuild(namespaceId: string): SafeEmbeddingNamespace {
    const source = this.get(namespaceId);
    return this.create({
      name: source.name,
      providerProfileId: source.providerProfileId,
      modelId: source.modelId,
      dimensions: source.dimensions,
      distanceMetric: source.distanceMetric,
      privacyMode: source.privacyMode,
      sourceTypes: source.sourceTypes,
      rebuildOfNamespaceId: source.id,
      chunkingPolicy: {
        ...EMBEDDING_CHUNKING_POLICY_V1,
        chunkingVersion: source.chunkingVersion,
        schemaVersion: source.chunkingSchemaVersion
      }
    });
  }

  resumeInterruptedBuild(namespaceId: string): SafeEmbeddingNamespace {
    const namespace = this.get(namespaceId);
    if (namespace.status !== 'building' && namespace.status !== 'failed')
      throw new AIError('VALIDATION', 'Only an incomplete embedding namespace can be resumed.');
    this.database
      .prepare(
        "UPDATE ai_vector_namespaces SET status = 'building', last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(timestamp(), namespace.id, this.ownerId);
    this.recordEvent(namespace.id, namespace.status, 'building', 'resume');
    return this.get(namespace.id);
  }

  upsertChunks(namespaceId: string, sources: EmbeddingSource[]): DeterministicEmbeddingChunk[] {
    const namespace = this.get(namespaceId);
    if (namespace.status !== 'building')
      throw new AIError('VALIDATION', 'Chunks can only be written to a building namespace.');
    const policy: EmbeddingChunkingPolicy = {
      ...EMBEDDING_CHUNKING_POLICY_V1,
      schemaVersion: namespace.chunkingSchemaVersion,
      chunkingVersion: namespace.chunkingVersion
    };
    const chunks = sources.flatMap((source) => {
      if (!namespace.sourceTypes.includes(source.sourceType))
        throw new AIError(
          'VALIDATION',
          'This source type is not compatible with the embedding namespace.'
        );
      return chunkEmbeddingSource(namespace.id, source, policy);
    });
    const now = timestamp();
    const insert = this.database.prepare(
      `INSERT INTO ai_vector_chunks (id, namespace_id, owner_id, source_type, source_id, source_revision_id, chunk_index,
        chunking_version, content_hash, source_hash, text_length, token_estimate, char_start, char_end, metadata_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
       ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash, source_hash=excluded.source_hash, text_length=excluded.text_length,
        token_estimate=excluded.token_estimate, char_start=excluded.char_start, char_end=excluded.char_end, metadata_json=excluded.metadata_json,
        status='pending', invalidated_at=NULL, failure_code=NULL, failure_message=NULL, updated_at=excluded.updated_at`
    );
    this.database.transaction(() => {
      for (const chunk of chunks)
        insert.run(
          chunk.id,
          namespace.id,
          this.ownerId,
          chunk.sourceType,
          chunk.sourceId,
          chunk.sourceRevisionId,
          chunk.chunkIndex,
          namespace.chunkingVersion,
          chunk.contentHash,
          chunk.sourceHash,
          chunk.text.length,
          chunk.tokenEstimate,
          chunk.charStart,
          chunk.charEnd,
          JSON.stringify(chunk.metadata),
          now,
          now
        );
      this.refreshCoverage(namespace.id);
    })();
    return chunks;
  }

  storeVectors(
    namespaceId: string,
    vectors: Array<{ chunkId: string; vector: number[]; usageRecordId?: string | null }>
  ): SafeEmbeddingNamespace {
    const namespace = this.get(namespaceId);
    if (namespace.status !== 'building')
      throw new AIError('VALIDATION', 'Vectors can only be written to a building namespace.');
    const now = timestamp();
    const insert = this.database.prepare(
      `INSERT INTO ai_vector_records (id, namespace_id, chunk_id, owner_id, dimensions, distance_metric, vector_json, vector_hash, usage_record_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(namespace_id, chunk_id) DO UPDATE SET vector_json=excluded.vector_json, vector_hash=excluded.vector_hash,
        usage_record_id=excluded.usage_record_id, status='active', failure_code=NULL, failure_message=NULL, updated_at=excluded.updated_at`
    );
    this.database.transaction(() => {
      for (const item of vectors) {
        if (item.vector.length !== namespace.dimensions)
          throw new AIError(
            'VALIDATION',
            'Embedding vector dimensions do not match the namespace.'
          );
        const chunk = this.database
          .prepare(
            'SELECT 1 FROM ai_vector_chunks WHERE id = ? AND namespace_id = ? AND owner_id = ?'
          )
          .get(item.chunkId, namespace.id, this.ownerId);
        if (!chunk)
          throw new AIError('VALIDATION', 'Embedding chunk is unavailable for this namespace.');
        insert.run(
          `vector_${item.chunkId.slice(6)}`,
          namespace.id,
          item.chunkId,
          this.ownerId,
          namespace.dimensions,
          namespace.distanceMetric,
          JSON.stringify(item.vector),
          hashVector(item.vector),
          item.usageRecordId ?? null,
          now,
          now
        );
        this.database
          .prepare(
            "UPDATE ai_vector_chunks SET status = 'embedded', updated_at = ? WHERE id = ? AND namespace_id = ?"
          )
          .run(now, item.chunkId, namespace.id);
      }
      this.refreshCoverage(namespace.id);
    })();
    return this.get(namespace.id);
  }

  verifyCoverage(namespaceId: string): SafeEmbeddingNamespace {
    this.refreshCoverage(namespaceId);
    const namespace = this.get(namespaceId);
    if (
      namespace.coverageExpectedChunks < 1 ||
      namespace.coverageExpectedChunks !== namespace.coverageIndexedChunks
    )
      throw new AIError('VALIDATION', 'Embedding namespace coverage is incomplete.');
    this.database
      .prepare(
        "UPDATE ai_vector_namespaces SET coverage_status = 'verified', last_rebuild_completed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(timestamp(), timestamp(), namespace.id, this.ownerId);
    this.recordEvent(namespace.id, namespace.status, namespace.status, 'coverage verified');
    return this.get(namespace.id);
  }

  activate(namespaceId: string): SafeEmbeddingNamespace {
    const namespace = this.verifyCoverage(namespaceId);
    const now = timestamp();
    this.database.transaction(() => {
      const active = this.database
        .prepare(
          "SELECT id, status FROM ai_vector_namespaces WHERE owner_id = ? AND name = ? AND status = 'active'"
        )
        .get(this.ownerId, namespace.name) as
        { id: string; status: EmbeddingNamespaceStatus } | undefined;
      if (active) {
        this.database
          .prepare(
            "UPDATE ai_vector_namespaces SET status = 'deprecated', deprecated_at = ?, replacement_namespace_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
          )
          .run(now, namespace.id, now, active.id, this.ownerId);
        this.recordEvent(active.id, 'active', 'deprecated', 'replaced by verified namespace');
      }
      this.database
        .prepare(
          "UPDATE ai_vector_namespaces SET status = 'active', active_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'building'"
        )
        .run(now, now, namespace.id, this.ownerId);
      this.recordEvent(namespace.id, 'building', 'active', 'activated');
    })();
    return this.get(namespace.id);
  }

  deprecate(
    namespaceId: string,
    replacementNamespaceId: string | null = null
  ): SafeEmbeddingNamespace {
    const namespace = this.get(namespaceId);
    const now = timestamp();
    this.database
      .prepare(
        "UPDATE ai_vector_namespaces SET status = 'deprecated', deprecated_at = COALESCE(deprecated_at, ?), replacement_namespace_id = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status <> 'deleted'"
      )
      .run(now, replacementNamespaceId, now, namespace.id, this.ownerId);
    this.recordEvent(namespace.id, namespace.status, 'deprecated', 'deprecated');
    return this.get(namespace.id);
  }

  delete(namespaceId: string): void {
    const namespace = this.get(namespaceId);
    const now = timestamp();
    this.database.transaction(() => {
      this.database
        .prepare('DELETE FROM ai_vector_records WHERE namespace_id = ? AND owner_id = ?')
        .run(namespace.id, this.ownerId);
      this.database
        .prepare('DELETE FROM ai_vector_chunks WHERE namespace_id = ? AND owner_id = ?')
        .run(namespace.id, this.ownerId);
      this.database
        .prepare(
          "UPDATE ai_vector_namespaces SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
        )
        .run(now, now, namespace.id, this.ownerId);
      this.recordEvent(namespace.id, namespace.status, 'deleted', 'deleted derived vectors');
    })();
  }

  private refreshCoverage(namespaceId: string): void {
    const row = this.database
      .prepare(
        `SELECT COUNT(chunk.id) AS chunks,
          COALESCE(SUM(CASE WHEN record.status = 'active' THEN 1 ELSE 0 END), 0) AS vectors,
          COALESCE(SUM(LENGTH(record.vector_json)), 0) AS storage
         FROM ai_vector_chunks chunk
         LEFT JOIN ai_vector_records record ON record.chunk_id = chunk.id AND record.namespace_id = chunk.namespace_id
         WHERE chunk.namespace_id = ? AND chunk.owner_id = ? AND chunk.status <> 'invalidated'`
      )
      .get(namespaceId, this.ownerId) as { chunks: number; vectors: number; storage: number };
    const coverage: EmbeddingCoverageStatus =
      row.chunks === 0 ? 'not_started' : row.chunks === row.vectors ? 'verified' : 'incomplete';
    this.database
      .prepare(
        'UPDATE ai_vector_namespaces SET coverage_expected_chunks = ?, coverage_indexed_chunks = ?, coverage_status = ?, storage_bytes = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
      )
      .run(row.chunks, row.vectors, coverage, row.storage, timestamp(), namespaceId, this.ownerId);
  }

  private get(id: string): SafeEmbeddingNamespace {
    if (!/^[A-Za-z0-9_-]{6,80}$/u.test(id))
      throw new AIError('VALIDATION', 'Choose a valid embedding namespace.');
    const row = this.database
      .prepare(
        `SELECT namespace.id, namespace.name, namespace.provider_profile_id AS providerProfileId, profile.name AS providerName,
          namespace.provider_id AS providerId, namespace.model_id AS modelId, namespace.dimensions, namespace.distance_metric AS distanceMetric,
          namespace.privacy_mode AS privacyMode, namespace.privacy_class AS privacyClass, namespace.chunking_version AS chunkingVersion,
          namespace.chunking_schema_version AS chunkingSchemaVersion, namespace.source_types_json AS sourceTypesJson, namespace.status,
          namespace.coverage_status AS coverageStatus, namespace.coverage_expected_chunks AS coverageExpectedChunks,
          namespace.coverage_indexed_chunks AS coverageIndexedChunks, namespace.storage_bytes AS storageBytes,
          namespace.last_rebuild_started_at AS lastRebuildStartedAt, namespace.last_rebuild_completed_at AS lastRebuildCompletedAt,
          namespace.active_at AS activeAt, namespace.deprecated_at AS deprecatedAt, namespace.replacement_namespace_id AS replacementNamespaceId,
          namespace.created_at AS createdAt, namespace.updated_at AS updatedAt
         FROM ai_vector_namespaces namespace
         LEFT JOIN ai_provider_profiles profile ON profile.id = namespace.provider_profile_id AND profile.owner_id = namespace.owner_id
         WHERE namespace.owner_id = ? AND namespace.id = ? AND namespace.status <> 'deleted'`
      )
      .get(this.ownerId, id) as NamespaceRow | undefined;
    if (!row) throw new AIError('VALIDATION', 'The embedding namespace is unavailable.');
    return this.project(row);
  }

  private project(row: NamespaceRow): SafeEmbeddingNamespace {
    return {
      ...row,
      sourceTypes: JSON.parse(row.sourceTypesJson) as EmbeddingSourceType[],
      storageBytes: String(row.storageBytes)
    };
  }

  private recordEvent(
    namespaceId: string,
    prior: string | null,
    resulting: string,
    message: string
  ): void {
    this.database
      .prepare(
        'INSERT INTO ai_vector_namespace_events (id, owner_id, namespace_id, event_type, prior_status, resulting_status, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        ulid(),
        this.ownerId,
        namespaceId,
        message.split(' ')[0] || 'event',
        prior,
        resulting,
        message,
        timestamp()
      );
  }
}
