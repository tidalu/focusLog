import { createHash } from 'node:crypto';

export type EmbeddingSourceType = 'check_in_revision' | 'daily_analysis' | 'analysis_result';

export interface EmbeddingChunkingPolicy {
  schemaVersion: number;
  chunkingVersion: string;
  maxCharacters: number;
  overlapCharacters: number;
  shortLogBehavior: 'single_chunk';
}

export interface EmbeddingSource {
  sourceType: EmbeddingSourceType;
  sourceId: string;
  sourceRevisionId?: string | null;
  text: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface DeterministicEmbeddingChunk {
  id: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  sourceRevisionId: string | null;
  chunkIndex: number;
  text: string;
  contentHash: string;
  sourceHash: string;
  tokenEstimate: number;
  charStart: number;
  charEnd: number;
  metadata: Record<string, string | number | boolean | null>;
}

export const EMBEDDING_CHUNKING_POLICY_V1: EmbeddingChunkingPolicy = {
  schemaVersion: 1,
  chunkingVersion: 'focuslog-chunking-v1',
  maxCharacters: 3_200,
  overlapCharacters: 480,
  shortLogBehavior: 'single_chunk'
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
}

function stableMetadata(
  value: Record<string, string | number | boolean | null> | undefined
): string {
  if (!value) return '{}';
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  );
}

export function deterministicChunkId(input: {
  namespaceId: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  sourceRevisionId: string | null;
  chunkIndex: number;
  contentHash: string;
  chunkingVersion: string;
}): string {
  return `chunk_${hash(JSON.stringify(input)).slice(0, 48)}`;
}

export function chunkEmbeddingSource(
  namespaceId: string,
  source: EmbeddingSource,
  policy: EmbeddingChunkingPolicy = EMBEDDING_CHUNKING_POLICY_V1
): DeterministicEmbeddingChunk[] {
  const text = normalizeText(source.text);
  if (!text) return [];
  if (
    policy.maxCharacters <= 0 ||
    policy.overlapCharacters < 0 ||
    policy.overlapCharacters >= policy.maxCharacters
  )
    throw new Error('Embedding chunk policy is invalid.');
  const sourceRevisionId = source.sourceRevisionId ?? null;
  const metadata = source.metadata ?? {};
  const sourceHash = hash(
    `${source.sourceType}:${source.sourceId}:${sourceRevisionId ?? ''}:${text}:${stableMetadata(metadata)}`
  );
  const chunks: DeterministicEmbeddingChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + policy.maxCharacters);
    const content = text.slice(start, end);
    const contentHash = hash(`${policy.chunkingVersion}:${content}`);
    chunks.push({
      id: deterministicChunkId({
        namespaceId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceRevisionId,
        chunkIndex: index,
        contentHash,
        chunkingVersion: policy.chunkingVersion
      }),
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceRevisionId,
      chunkIndex: index,
      text: content,
      contentHash,
      sourceHash,
      tokenEstimate: Math.max(1, Math.ceil(content.length / 4)),
      charStart: start,
      charEnd: end,
      metadata
    });
    if (end === text.length) break;
    start = end - policy.overlapCharacters;
    index += 1;
  }
  return chunks;
}
