import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import type { AIService } from './ai-service.js';
import { providerDescriptor } from './providers.js';
import { loadBuiltinPrompt } from './prompts.js';
import type { PrivacyMode } from './types.js';

type PromptOrigin = 'playground' | 'production_copy' | 'imported';
type PromptStatus = 'active' | 'archived';
type ContextSourceType =
  | 'manual_text'
  | 'selected_log'
  | 'date_range'
  | 'category'
  | 'project'
  | 'daily_summary'
  | 'weekly_summary'
  | 'monthly_summary'
  | 'quarterly_summary'
  | 'yearly_summary'
  | 'fact'
  | 'graph_neighbor'
  | 'semantic_result'
  | 'imported_document'
  | 'synthetic_fixture';

export interface PromptVersionInput {
  systemInstructions: string;
  developerInstructions?: string | null;
  userTemplate: string;
  variables?: string[];
  structuredSchema?: Record<string, unknown> | null;
  delimiters?: { untrustedStart: string; untrustedEnd: string };
  metadata?: Record<string, unknown>;
}

export interface SafePromptDefinition {
  id: string;
  name: string;
  status: PromptStatus;
  origin: PromptOrigin;
  productionPromptId: string | null;
  latestVersion: number;
  validation: PromptValidation;
  createdAt: string;
  updatedAt: string;
}

export interface SafePromptVersion extends PromptVersionInput {
  id: string;
  promptId: string;
  version: number;
  variables: string[];
  structuredSchema: Record<string, unknown> | null;
  delimiters: { untrustedStart: string; untrustedEnd: string };
  metadata: Record<string, unknown>;
  validation: PromptValidation;
  createdAt: string;
}

export interface PromptValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContextRequest {
  promptVersionId?: string | null;
  privacyMode?: PrivacyMode;
  maxContextTokens: number;
  reservedOutputTokens: number;
  evidenceLimit?: number;
  recencyWeighting?: { nowIso: string; halfLifeDays: number; weight: number };
  sourceTypeLimits?: Partial<Record<ContextSourceType, number>>;
  items: Array<{
    sourceType: ContextSourceType;
    sourceId?: string | null;
    sourceRevisionId?: string | null;
    title?: string;
    content?: string;
    retrievalScore?: number | null;
    privacyClass?: 'local' | 'cloud' | 'playground';
    staleState?: 'current' | 'stale' | 'deleted' | 'unavailable';
    metadata?: Record<string, unknown>;
  }>;
  variables?: Record<string, string>;
}

export interface SafeContextSnapshot {
  id: string;
  promptVersionId: string | null;
  maxContextTokens: number;
  reservedOutputTokens: number;
  totalTokens: number;
  providerUploadRequired: boolean;
  privacyMode: PrivacyMode;
  finalPromptRedacted: string;
  truncation: { truncatedItems: number; omittedItems: number };
  items: SafeContextItem[];
  createdAt: string;
}

export interface SafeContextItem {
  id: string;
  position: number;
  sourceType: ContextSourceType;
  sourceId: string | null;
  sourceRevisionId: string | null;
  classification: 'canonical' | 'derived' | 'playground';
  staleState: 'current' | 'stale' | 'deleted' | 'unavailable';
  retrievalScore: number | null;
  privacyClass: 'local' | 'cloud' | 'playground';
  tokenEstimate: number;
  truncated: boolean;
  providerUploadRequired: boolean;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

type PromptRow = {
  id: string;
  name: string;
  status: PromptStatus;
  origin: PromptOrigin;
  productionPromptId: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion: number | null;
  validationJson: string | null;
};

type VersionRow = {
  id: string;
  promptId: string;
  version: number;
  systemInstructions: string;
  developerInstructions: string | null;
  userTemplate: string;
  variablesJson: string;
  structuredSchemaJson: string | null;
  delimitersJson: string;
  metadataJson: string;
  validationJson: string;
  createdAt: string;
};

function timestamp(): string {
  return new Date().toISOString();
}
function tokenEstimate(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
function redact(value: string): string {
  return value
    .replace(/(bearer|authorization|api[_-]?key|x-api-key)\s*[:=]?\s*[^\s,;]+/giu, '$1 [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, 'sk-[redacted]');
}
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function templateVariables(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/gu)].map((match) => match[1]!);
}
function blockDelimiterEscape(value: string, delimiter: string): string {
  return value.replaceAll(delimiter, '[blocked delimiter]');
}
function safeName(value: string): string {
  const trimmed = value.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,79}$/u.test(trimmed))
    throw new AIError('VALIDATION', 'Choose a valid Playground prompt name.');
  return trimmed;
}
function validatePromptInput(
  input: PromptVersionInput,
  ai?: AIService,
  providerProfileId?: string
): PromptValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.systemInstructions.trim()) errors.push('System instructions are required.');
  if (!input.userTemplate.trim()) errors.push('User template is required.');
  if (
    tokenEstimate(
      `${input.systemInstructions}\n${input.developerInstructions ?? ''}\n${input.userTemplate}`
    ) > 20_000
  )
    errors.push('Prompt template is too large for Playground editing.');
  if (/\{\{\{/u.test(input.userTemplate))
    errors.push('Unsafe triple-brace interpolation is not allowed.');
  const delimiters = input.delimiters ?? {
    untrustedStart: '<untrusted_content>',
    untrustedEnd: '</untrusted_content>'
  };
  if (
    !delimiters.untrustedStart ||
    !delimiters.untrustedEnd ||
    delimiters.untrustedStart === delimiters.untrustedEnd
  )
    errors.push('Untrusted-content delimiters must be distinct.');
  if (input.userTemplate.includes(delimiters.untrustedEnd))
    errors.push('User template contains a closing untrusted-content delimiter.');
  if ((input.developerInstructions ?? '').includes(delimiters.untrustedEnd))
    errors.push('Developer instructions contain a closing untrusted-content delimiter.');
  const declared = new Set(input.variables ?? []);
  const used = new Set(templateVariables(input.userTemplate));
  for (const variable of declared)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(variable))
      errors.push(`Variable ${variable} is invalid.`);
  for (const variable of used)
    if (!declared.has(variable)) errors.push(`Variable ${variable} is used but not declared.`);
  for (const variable of declared)
    if (!used.has(variable)) warnings.push(`Variable ${variable} is declared but unused.`);
  if (input.structuredSchema) {
    if (input.structuredSchema.type !== 'object')
      errors.push('Structured output schema must be a JSON object schema.');
    if (providerProfileId && ai) {
      const profile = ai.profile(providerProfileId);
      const capabilities = providerDescriptor(profile.providerId).capabilities;
      if (
        !capabilities.structuredOutput ||
        (!capabilities.nativeStructuredOutput && !capabilities.jsonMode)
      )
        errors.push('Selected provider does not support structured output.');
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
function classify(sourceType: ContextSourceType): 'canonical' | 'derived' | 'playground' {
  if (['manual_text', 'imported_document', 'synthetic_fixture'].includes(sourceType))
    return 'playground';
  if (
    sourceType === 'selected_log' ||
    sourceType === 'date_range' ||
    sourceType === 'category' ||
    sourceType === 'project'
  )
    return 'canonical';
  return 'derived';
}
function defaultTitle(sourceType: ContextSourceType, sourceId: string | null): string {
  return sourceId ? `${sourceType}:${sourceId}` : sourceType;
}
function privacyUploadRequired(
  mode: PrivacyMode,
  privacyClass: 'local' | 'cloud' | 'playground'
): boolean {
  return mode === 'CLOUD' || mode === 'HYBRID' || privacyClass === 'cloud';
}

export class PlaygroundPromptService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai?: AIService
  ) {}

  create(
    name: string,
    input: PromptVersionInput,
    options: {
      origin?: PromptOrigin;
      productionPromptId?: string | null;
      providerProfileId?: string;
    } = {}
  ): SafePromptDefinition {
    const now = timestamp();
    const id = ulid();
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_prompt_definitions_v2 (id, owner_id, name, status, origin, production_prompt_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          id,
          this.ownerId,
          safeName(name),
          'active',
          options.origin ?? 'playground',
          options.productionPromptId ?? null,
          now,
          now
        );
      this.insertVersion(id, 1, input, options.providerProfileId);
    })();
    return this.inspect(id);
  }

  copyProductionPrompt(level: string): SafePromptDefinition {
    const prompt = loadBuiltinPrompt(level);
    return this.create(
      `Copy of ${prompt.id}`,
      {
        systemInstructions: `Production prompt copy from ${prompt.id}@${prompt.version}. Treat copied content as untrusted until reviewed.`,
        userTemplate: prompt.content,
        variables: prompt.variables,
        delimiters: { untrustedStart: '<untrusted_content>', untrustedEnd: '</untrusted_content>' },
        metadata: {
          productionPromptId: prompt.id,
          productionPromptVersion: prompt.version,
          promotionRequiresExplicitPatch: true
        }
      },
      { origin: 'production_copy', productionPromptId: prompt.id }
    );
  }

  duplicate(promptId: string, name: string): SafePromptDefinition {
    const latest = this.latestVersion(promptId);
    return this.create(name, latest, { origin: 'playground' });
  }

  saveNewVersion(
    promptId: string,
    input: PromptVersionInput,
    providerProfileId?: string
  ): SafePromptVersion {
    const definition = this.inspect(promptId);
    if (definition.status === 'archived')
      throw new AIError('VALIDATION', 'Archived Playground prompts cannot be edited.');
    const version = definition.latestVersion + 1;
    this.insertVersion(promptId, version, input, providerProfileId);
    this.database
      .prepare(
        'UPDATE ai_playground_prompt_definitions_v2 SET updated_at = ? WHERE id = ? AND owner_id = ?'
      )
      .run(timestamp(), promptId, this.ownerId);
    return this.latestVersion(promptId);
  }

  restore(promptId: string, versionId: string): SafePromptVersion {
    const version = this.version(versionId);
    if (version.promptId !== promptId)
      throw new AIError('VALIDATION', 'Prompt version does not belong to this prompt.');
    return this.saveNewVersion(promptId, version);
  }

  archive(promptId: string): SafePromptDefinition {
    this.inspect(promptId);
    const now = timestamp();
    this.database
      .prepare(
        "UPDATE ai_playground_prompt_definitions_v2 SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(now, now, promptId, this.ownerId);
    return this.inspect(promptId);
  }

  diff(
    leftVersionId: string,
    rightVersionId: string
  ): { leftVersion: number; rightVersion: number; changes: string[] } {
    const left = this.version(leftVersionId);
    const right = this.version(rightVersionId);
    const changes: string[] = [];
    for (const key of ['systemInstructions', 'developerInstructions', 'userTemplate'] as const)
      if ((left[key] ?? '') !== (right[key] ?? '')) changes.push(key);
    if (JSON.stringify(left.variables) !== JSON.stringify(right.variables))
      changes.push('variables');
    if (JSON.stringify(left.structuredSchema) !== JSON.stringify(right.structuredSchema))
      changes.push('structuredSchema');
    if (JSON.stringify(left.delimiters) !== JSON.stringify(right.delimiters))
      changes.push('delimiters');
    return { leftVersion: left.version, rightVersion: right.version, changes };
  }

  exportPrompt(promptId: string): Record<string, unknown> {
    const definition = this.inspect(promptId);
    const versions = this.versions(promptId);
    return {
      schemaVersion: 1,
      definition,
      versions,
      productionPromotion: { silentUpdateAllowed: false, requiresExplicitPatchReview: true }
    };
  }

  inspect(promptId: string): SafePromptDefinition {
    const row = this.database
      .prepare(
        `SELECT definition.id, definition.name, definition.status, definition.origin, definition.production_prompt_id AS productionPromptId,
        definition.created_at AS createdAt, definition.updated_at AS updatedAt, MAX(version.version) AS latestVersion,
        (SELECT validation_json FROM ai_playground_prompt_versions_v2 latest WHERE latest.prompt_id = definition.id ORDER BY latest.version DESC LIMIT 1) AS validationJson
       FROM ai_playground_prompt_definitions_v2 definition
       LEFT JOIN ai_playground_prompt_versions_v2 version ON version.prompt_id = definition.id
       WHERE definition.owner_id = ? AND definition.id = ?
       GROUP BY definition.id`
      )
      .get(this.ownerId, promptId) as PromptRow | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground prompt is unavailable.');
    return {
      ...row,
      latestVersion: row.latestVersion ?? 0,
      validation: JSON.parse(
        row.validationJson ?? '{"ok":false,"errors":["No versions"],"warnings":[]}'
      ) as PromptValidation
    };
  }

  latestVersion(promptId: string): SafePromptVersion {
    const row = this.database
      .prepare(
        `SELECT id, prompt_id AS promptId, version, system_instructions AS systemInstructions, developer_instructions AS developerInstructions,
        user_template AS userTemplate, variables_json AS variablesJson, structured_schema_json AS structuredSchemaJson, delimiters_json AS delimitersJson,
        metadata_json AS metadataJson, validation_json AS validationJson, created_at AS createdAt
       FROM ai_playground_prompt_versions_v2 WHERE owner_id = ? AND prompt_id = ? ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, promptId) as VersionRow | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground prompt version is unavailable.');
    return this.projectVersion(row);
  }

  getVersion(versionId: string): SafePromptVersion {
    return this.version(versionId);
  }

  versions(promptId: string): SafePromptVersion[] {
    return (
      this.database
        .prepare(
          `SELECT id, prompt_id AS promptId, version, system_instructions AS systemInstructions, developer_instructions AS developerInstructions,
        user_template AS userTemplate, variables_json AS variablesJson, structured_schema_json AS structuredSchemaJson, delimiters_json AS delimitersJson,
        metadata_json AS metadataJson, validation_json AS validationJson, created_at AS createdAt
       FROM ai_playground_prompt_versions_v2 WHERE owner_id = ? AND prompt_id = ? ORDER BY version`
        )
        .all(this.ownerId, promptId) as VersionRow[]
    ).map((row) => this.projectVersion(row));
  }

  private insertVersion(
    promptId: string,
    version: number,
    input: PromptVersionInput,
    providerProfileId?: string
  ): void {
    const validation = validatePromptInput(input, this.ai, providerProfileId);
    if (!validation.ok) throw new AIError('VALIDATION', validation.errors.join(' '));
    const now = timestamp();
    this.database
      .prepare(
        `INSERT INTO ai_playground_prompt_versions_v2 (id, owner_id, prompt_id, version, system_instructions, developer_instructions, user_template,
        variables_json, structured_schema_json, delimiters_json, metadata_json, validation_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ulid(),
        this.ownerId,
        promptId,
        version,
        input.systemInstructions,
        input.developerInstructions ?? null,
        input.userTemplate,
        JSON.stringify(input.variables ?? []),
        input.structuredSchema ? JSON.stringify(input.structuredSchema) : null,
        JSON.stringify(
          input.delimiters ?? {
            untrustedStart: '<untrusted_content>',
            untrustedEnd: '</untrusted_content>'
          }
        ),
        JSON.stringify(input.metadata ?? {}),
        JSON.stringify(validation),
        now
      );
  }

  private version(id: string): SafePromptVersion {
    const row = this.database
      .prepare(
        `SELECT id, prompt_id AS promptId, version, system_instructions AS systemInstructions, developer_instructions AS developerInstructions,
        user_template AS userTemplate, variables_json AS variablesJson, structured_schema_json AS structuredSchemaJson, delimiters_json AS delimitersJson,
        metadata_json AS metadataJson, validation_json AS validationJson, created_at AS createdAt
       FROM ai_playground_prompt_versions_v2 WHERE owner_id = ? AND id = ?`
      )
      .get(this.ownerId, id) as VersionRow | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground prompt version is unavailable.');
    return this.projectVersion(row);
  }

  private projectVersion(row: VersionRow): SafePromptVersion {
    return {
      id: row.id,
      promptId: row.promptId,
      version: row.version,
      systemInstructions: row.systemInstructions,
      developerInstructions: row.developerInstructions,
      userTemplate: row.userTemplate,
      variables: JSON.parse(row.variablesJson) as string[],
      structuredSchema: row.structuredSchemaJson
        ? asObject(JSON.parse(row.structuredSchemaJson))
        : null,
      delimiters: JSON.parse(row.delimitersJson) as {
        untrustedStart: string;
        untrustedEnd: string;
      },
      metadata: asObject(JSON.parse(row.metadataJson)),
      validation: JSON.parse(row.validationJson) as PromptValidation,
      createdAt: row.createdAt
    };
  }
}

export class PlaygroundContextService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly prompts?: PlaygroundPromptService
  ) {}

  build(request: ContextRequest): SafeContextSnapshot {
    if (!Number.isInteger(request.maxContextTokens) || request.maxContextTokens < 1)
      throw new AIError('VALIDATION', 'Context token budget is invalid.');
    if (!Number.isInteger(request.reservedOutputTokens) || request.reservedOutputTokens < 0)
      throw new AIError('VALIDATION', 'Reserved output token budget is invalid.');
    if (request.reservedOutputTokens >= request.maxContextTokens)
      throw new AIError('VALIDATION', 'Reserved output tokens must leave room for context.');
    if (request.maxContextTokens > 128_000)
      throw new AIError('VALIDATION', 'Context token budget is too large.');
    if (
      request.evidenceLimit !== undefined &&
      (!Number.isInteger(request.evidenceLimit) || request.evidenceLimit < 1)
    )
      throw new AIError('VALIDATION', 'Evidence count limit is invalid.');
    const available = Math.max(0, request.maxContextTokens - request.reservedOutputTokens);
    let remaining = available;
    let truncatedItems = 0;
    let omittedItems = 0;
    const mode = request.privacyMode ?? 'LOCAL';
    const finalItems: Array<Omit<SafeContextItem, 'id' | 'position' | 'createdAt'>> = [];
    const counts = new Map<ContextSourceType, number>();
    const source = [...request.items]
      .map((item) => this.applyRecencyWeight(item, request.recencyWeighting))
      .sort((left, right) => (right.retrievalScore ?? 0) - (left.retrievalScore ?? 0));
    for (const item of source) {
      if (request.evidenceLimit !== undefined && finalItems.length >= request.evidenceLimit) {
        omittedItems += 1;
        continue;
      }
      const usedForType = counts.get(item.sourceType) ?? 0;
      const limit = request.sourceTypeLimits?.[item.sourceType] ?? Number.POSITIVE_INFINITY;
      if (usedForType >= limit) {
        omittedItems += 1;
        continue;
      }
      const resolved = this.resolveItem(item);
      if (resolved.staleState === 'deleted' || resolved.staleState === 'unavailable') {
        omittedItems += 1;
        continue;
      }
      const estimate = tokenEstimate(resolved.content);
      if (remaining <= 0) {
        omittedItems += 1;
        continue;
      }
      let content = resolved.content;
      let tokens = estimate;
      let truncated = false;
      if (tokens > remaining) {
        content = content.slice(0, Math.max(0, remaining * 4));
        tokens = tokenEstimate(content);
        truncated = true;
        truncatedItems += 1;
      }
      remaining -= tokens;
      counts.set(item.sourceType, usedForType + 1);
      const privacyClass = resolved.privacyClass;
      finalItems.push({
        ...resolved,
        content,
        tokenEstimate: tokens,
        truncated,
        providerUploadRequired: privacyUploadRequired(mode, privacyClass)
      });
    }
    const prompt =
      request.promptVersionId && this.prompts
        ? this.prompts.getVersion(request.promptVersionId)
        : null;
    const rendered = this.renderPrompt(prompt, finalItems, request.variables ?? {});
    const now = timestamp();
    const id = ulid();
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_context_snapshots (id, owner_id, prompt_version_id, max_context_tokens, reserved_output_tokens, total_tokens, provider_upload_required, privacy_mode, final_prompt_redacted, truncation_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          id,
          this.ownerId,
          request.promptVersionId ?? null,
          request.maxContextTokens,
          request.reservedOutputTokens,
          finalItems.reduce((sum, item) => sum + item.tokenEstimate, 0),
          Number(finalItems.some((item) => item.providerUploadRequired)),
          mode,
          redact(rendered),
          JSON.stringify({ truncatedItems, omittedItems }),
          now
        );
      const insert = this.database.prepare(
        `INSERT INTO ai_playground_context_items (id, owner_id, snapshot_id, position, source_type, source_id, source_revision_id, classification, stale_state, retrieval_score, privacy_class, token_estimate, truncated, provider_upload_required, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      finalItems.forEach((item, index) =>
        insert.run(
          ulid(),
          this.ownerId,
          id,
          index,
          item.sourceType,
          item.sourceId,
          item.sourceRevisionId,
          item.classification,
          item.staleState,
          item.retrievalScore,
          item.privacyClass,
          item.tokenEstimate,
          Number(item.truncated),
          Number(item.providerUploadRequired),
          item.title,
          item.content,
          JSON.stringify(item.metadata),
          now
        )
      );
    })();
    return this.inspect(id);
  }

  inspect(id: string): SafeContextSnapshot {
    const row = this.database
      .prepare(
        'SELECT id, prompt_version_id AS promptVersionId, max_context_tokens AS maxContextTokens, reserved_output_tokens AS reservedOutputTokens, total_tokens AS totalTokens, provider_upload_required AS providerUploadRequired, privacy_mode AS privacyMode, final_prompt_redacted AS finalPromptRedacted, truncation_json AS truncationJson, created_at AS createdAt FROM ai_playground_context_snapshots WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, id) as
      | {
          id: string;
          promptVersionId: string | null;
          maxContextTokens: number;
          reservedOutputTokens: number;
          totalTokens: number;
          providerUploadRequired: number;
          privacyMode: PrivacyMode;
          finalPromptRedacted: string;
          truncationJson: string;
          createdAt: string;
        }
      | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground context snapshot is unavailable.');
    const items = (
      this.database
        .prepare(
          'SELECT id, position, source_type AS sourceType, source_id AS sourceId, source_revision_id AS sourceRevisionId, classification, stale_state AS staleState, retrieval_score AS retrievalScore, privacy_class AS privacyClass, token_estimate AS tokenEstimate, truncated, provider_upload_required AS providerUploadRequired, title, content, metadata_json AS metadataJson FROM ai_playground_context_items WHERE owner_id = ? AND snapshot_id = ? ORDER BY position'
        )
        .all(this.ownerId, id) as Array<
        Omit<SafeContextItem, 'metadata' | 'truncated' | 'providerUploadRequired'> & {
          metadataJson: string;
          truncated: number;
          providerUploadRequired: number;
        }
      >
    ).map((item) => ({
      ...item,
      content: redact(item.content),
      metadata: asObject(JSON.parse(item.metadataJson)),
      truncated: item.truncated === 1,
      providerUploadRequired: item.providerUploadRequired === 1
    }));
    return {
      id: row.id,
      promptVersionId: row.promptVersionId,
      maxContextTokens: row.maxContextTokens,
      reservedOutputTokens: row.reservedOutputTokens,
      totalTokens: row.totalTokens,
      providerUploadRequired: row.providerUploadRequired === 1,
      privacyMode: row.privacyMode,
      finalPromptRedacted: row.finalPromptRedacted,
      truncation: JSON.parse(row.truncationJson) as {
        truncatedItems: number;
        omittedItems: number;
      },
      items,
      createdAt: row.createdAt
    };
  }

  private resolveItem(
    item: ContextRequest['items'][number]
  ): Omit<
    SafeContextItem,
    'id' | 'position' | 'tokenEstimate' | 'truncated' | 'providerUploadRequired'
  > & { tokenEstimate?: never; truncated?: never; providerUploadRequired?: never } {
    if (item.sourceType === 'selected_log' && item.sourceId) {
      const row = this.database
        .prepare(
          `SELECT check_ins.id AS id, check_ins.current_revision_id AS revisionId, check_ins.deleted_at AS deletedAt, check_ins.submitted_at AS submittedAt, revision.body FROM check_ins JOIN check_in_revisions revision ON revision.id = check_ins.current_revision_id WHERE check_ins.owner_id = ? AND check_ins.id = ?`
        )
        .get(this.ownerId, item.sourceId) as
        | {
            id: string;
            revisionId: string;
            deletedAt: string | null;
            submittedAt: string;
            body: string;
          }
        | undefined;
      if (!row || row.deletedAt)
        return {
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceRevisionId: item.sourceRevisionId ?? null,
          classification: 'canonical',
          staleState: row?.deletedAt ? 'deleted' : 'unavailable',
          retrievalScore: item.retrievalScore ?? null,
          privacyClass: 'local',
          title: item.title ?? defaultTitle(item.sourceType, item.sourceId),
          content: '',
          metadata: {}
        };
      return {
        sourceType: item.sourceType,
        sourceId: row.id,
        sourceRevisionId: row.revisionId,
        classification: 'canonical',
        staleState: 'current',
        retrievalScore: item.retrievalScore ?? null,
        privacyClass: item.privacyClass ?? 'local',
        title: item.title ?? `Log ${row.submittedAt}`,
        content: row.body,
        metadata: { submittedAt: row.submittedAt, ...item.metadata }
      };
    }
    if (
      item.sourceType === 'date_range' ||
      item.sourceType === 'category' ||
      item.sourceType === 'project'
    ) {
      const resolved = this.resolveLogCollection(item);
      if (resolved) return resolved;
    }
    if (
      [
        'daily_summary',
        'weekly_summary',
        'monthly_summary',
        'quarterly_summary',
        'yearly_summary'
      ].includes(item.sourceType)
    ) {
      const resolved = this.resolveSummary(item);
      if (resolved) return resolved;
    }
    if (item.sourceType === 'fact' && item.sourceId) {
      const resolved = this.resolveFact(item);
      if (resolved) return resolved;
    }
    if (item.sourceType === 'graph_neighbor' && item.sourceId) {
      const resolved = this.resolveGraphNeighbor(item);
      if (resolved) return resolved;
    }
    const staleState = item.staleState ?? 'current';
    return {
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? null,
      sourceRevisionId: item.sourceRevisionId ?? null,
      classification: classify(item.sourceType),
      staleState,
      retrievalScore: item.retrievalScore ?? null,
      privacyClass:
        item.privacyClass ?? (classify(item.sourceType) === 'playground' ? 'playground' : 'local'),
      title: item.title ?? defaultTitle(item.sourceType, item.sourceId ?? null),
      content: item.content ?? '',
      metadata: item.metadata ?? {}
    };
  }

  private resolveLogCollection(
    item: ContextRequest['items'][number]
  ): ReturnType<PlaygroundContextService['resolveItem']> | null {
    const metadata = item.metadata ?? {};
    const clauses = ['check_ins.owner_id = ?', 'check_ins.deleted_at IS NULL'];
    const params: unknown[] = [this.ownerId];
    if (item.sourceType === 'date_range') {
      const start = typeof metadata.start === 'string' ? metadata.start : null;
      const end = typeof metadata.end === 'string' ? metadata.end : null;
      if (!start || !end) return null;
      clauses.push('check_ins.submitted_at >= ?', 'check_ins.submitted_at < ?');
      params.push(start, end);
    } else if (item.sourceType === 'category') {
      if (!item.sourceId) return null;
      clauses.push('check_ins.category_id = ?');
      params.push(item.sourceId);
    } else {
      if (!item.sourceId) return null;
      clauses.push('check_ins.focus_session_id = ?');
      params.push(item.sourceId);
    }
    const rows = this.database
      .prepare(
        `SELECT check_ins.id, check_ins.current_revision_id AS revisionId, check_ins.submitted_at AS submittedAt, revision.body
       FROM check_ins JOIN check_in_revisions revision ON revision.id = check_ins.current_revision_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY check_ins.submitted_at, check_ins.id LIMIT 50`
      )
      .all(...params) as Array<{
      id: string;
      revisionId: string;
      submittedAt: string;
      body: string;
    }>;
    if (rows.length === 0)
      return {
        sourceType: item.sourceType,
        sourceId: item.sourceId ?? null,
        sourceRevisionId: item.sourceRevisionId ?? null,
        classification: 'canonical',
        staleState: 'unavailable',
        retrievalScore: item.retrievalScore ?? null,
        privacyClass: 'local',
        title: item.title ?? defaultTitle(item.sourceType, item.sourceId ?? null),
        content: '',
        metadata
      };
    return {
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? null,
      sourceRevisionId: rows.map((row) => row.revisionId).join(','),
      classification: 'canonical',
      staleState: 'current',
      retrievalScore: item.retrievalScore ?? null,
      privacyClass: item.privacyClass ?? 'local',
      title:
        item.title ??
        defaultTitle(
          item.sourceType,
          item.sourceId ?? `${metadata.start ?? ''}-${metadata.end ?? ''}`
        ),
      content: rows.map((row) => `[${row.submittedAt}] ${row.body}`).join('\n'),
      metadata: { ...metadata, sourceCount: rows.length, capped: rows.length === 50 }
    };
  }

  private resolveSummary(
    item: ContextRequest['items'][number]
  ): ReturnType<PlaygroundContextService['resolveItem']> | null {
    if (!item.sourceId) return null;
    const level = item.sourceType.replace('_summary', '');
    const result = this.database
      .prepare(
        `SELECT id, version, status, readable_summary AS summary, updated_at AS updatedAt
       FROM ai_analysis_results WHERE owner_id = ? AND level = ? AND (id = ? OR period_id = ?) ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, level, item.sourceId, item.sourceId) as
      | { id: string; version: number; status: string; summary: string; updatedAt: string }
      | undefined;
    if (result)
      return {
        sourceType: item.sourceType,
        sourceId: result.id,
        sourceRevisionId: String(result.version),
        classification: 'derived',
        staleState: result.status === 'stale' ? 'stale' : 'current',
        retrievalScore: item.retrievalScore ?? null,
        privacyClass: item.privacyClass ?? 'local',
        title: item.title ?? `${level} summary ${item.sourceId}`,
        content: result.summary,
        metadata: { updatedAt: result.updatedAt, status: result.status, ...item.metadata }
      };
    if (level === 'daily') {
      const memory = this.database
        .prepare(
          'SELECT id, version, status, content, created_at AS createdAt FROM ai_memories WHERE owner_id = ? AND period_kind = ? AND (id = ? OR period_key = ?) ORDER BY version DESC LIMIT 1'
        )
        .get(this.ownerId, level, item.sourceId, item.sourceId) as
        | { id: string; version: number; status: string; content: string; createdAt: string }
        | undefined;
      if (memory)
        return {
          sourceType: item.sourceType,
          sourceId: memory.id,
          sourceRevisionId: String(memory.version),
          classification: 'derived',
          staleState: memory.status === 'stale' ? 'stale' : 'current',
          retrievalScore: item.retrievalScore ?? null,
          privacyClass: item.privacyClass ?? 'local',
          title: item.title ?? `daily summary ${item.sourceId}`,
          content: memory.content,
          metadata: { createdAt: memory.createdAt, status: memory.status, ...item.metadata }
        };
    }
    return null;
  }

  private resolveFact(
    item: ContextRequest['items'][number]
  ): ReturnType<PlaygroundContextService['resolveItem']> | null {
    const row = this.database
      .prepare(
        'SELECT id, subject, predicate, object_value AS objectValue, status, confidence, updated_at AS updatedAt FROM ai_facts WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, item.sourceId) as
      | {
          id: string;
          subject: string;
          predicate: string;
          objectValue: string;
          status: string;
          confidence: number | null;
          updatedAt: string;
        }
      | undefined;
    if (!row) return null;
    return {
      sourceType: item.sourceType,
      sourceId: row.id,
      sourceRevisionId: row.updatedAt,
      classification: 'derived',
      staleState: row.status === 'STALE' ? 'stale' : 'current',
      retrievalScore: item.retrievalScore ?? row.confidence,
      privacyClass: item.privacyClass ?? 'local',
      title: item.title ?? `Fact ${row.subject}`,
      content: `${row.subject} ${row.predicate} ${row.objectValue}`,
      metadata: { status: row.status, confidence: row.confidence, ...item.metadata }
    };
  }

  private resolveGraphNeighbor(
    item: ContextRequest['items'][number]
  ): ReturnType<PlaygroundContextService['resolveItem']> | null {
    const rows = this.database
      .prepare(
        `SELECT edge.id, source.canonical_name AS sourceName, edge.predicate, target.canonical_name AS targetName, edge.status, edge.confidence, edge.updated_at AS updatedAt
       FROM ai_graph_edges edge
       JOIN ai_graph_nodes source ON source.id = edge.source_node_id
       JOIN ai_graph_nodes target ON target.id = edge.target_node_id
       WHERE edge.owner_id = ? AND (edge.source_node_id = ? OR edge.target_node_id = ?)
       ORDER BY edge.confidence DESC, edge.updated_at DESC LIMIT 20`
      )
      .all(this.ownerId, item.sourceId, item.sourceId) as Array<{
      id: string;
      sourceName: string;
      predicate: string;
      targetName: string;
      status: string;
      confidence: number | null;
      updatedAt: string;
    }>;
    if (rows.length === 0) return null;
    return {
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? null,
      sourceRevisionId: rows.map((row) => row.id).join(','),
      classification: 'derived',
      staleState: rows.some((row) => row.status === 'STALE') ? 'stale' : 'current',
      retrievalScore: item.retrievalScore ?? rows[0]?.confidence ?? null,
      privacyClass: item.privacyClass ?? 'local',
      title: item.title ?? `Graph neighbors ${item.sourceId}`,
      content: rows.map((row) => `${row.sourceName} ${row.predicate} ${row.targetName}`).join('\n'),
      metadata: { edgeCount: rows.length, ...item.metadata }
    };
  }

  private renderPrompt(
    prompt: SafePromptVersion | null,
    items: Array<{ title: string; content: string }>,
    variables: Record<string, string>
  ): string {
    const delimiters = prompt?.delimiters ?? {
      untrustedStart: '<untrusted_content>',
      untrustedEnd: '</untrusted_content>'
    };
    const context = items
      .map(
        (item) =>
          `${delimiters.untrustedStart} title="${item.title}"\n${blockDelimiterEscape(item.content, delimiters.untrustedEnd)}\n${delimiters.untrustedEnd}`
      )
      .join('\n\n');
    if (!prompt) return context;
    let user = prompt.userTemplate;
    for (const [key, value] of Object.entries(variables))
      user = user.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gu'),
        blockDelimiterEscape(value, delimiters.untrustedEnd)
      );
    return `${prompt.systemInstructions}\n\n${prompt.developerInstructions ?? ''}\n\n${user}\n\n${context}`;
  }

  private applyRecencyWeight(
    item: ContextRequest['items'][number],
    recency?: ContextRequest['recencyWeighting']
  ): ContextRequest['items'][number] {
    if (!recency) return item;
    if (recency.halfLifeDays <= 0 || recency.weight < 0)
      throw new AIError('VALIDATION', 'Recency weighting configuration is invalid.');
    const candidate =
      typeof item.metadata?.occurredAt === 'string'
        ? item.metadata.occurredAt
        : typeof item.metadata?.submittedAt === 'string'
          ? item.metadata.submittedAt
          : null;
    if (!candidate) return item;
    const nowMs = Date.parse(recency.nowIso);
    const itemMs = Date.parse(candidate);
    if (Number.isNaN(nowMs) || Number.isNaN(itemMs))
      throw new AIError('VALIDATION', 'Recency timestamp is invalid.');
    const ageDays = Math.max(0, (nowMs - itemMs) / 86_400_000);
    const boost = recency.weight * 0.5 ** (ageDays / recency.halfLifeDays);
    return {
      ...item,
      retrievalScore: (item.retrievalScore ?? 0) + boost,
      metadata: {
        ...item.metadata,
        originalRetrievalScore: item.retrievalScore ?? 0,
        recencyBoost: boost
      }
    };
  }
}
