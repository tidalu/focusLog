import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { AIError, normalizeProviderError } from './errors.js';
import { ExecutionPolicyService } from './execution-policy-service.js';
import {
  ProviderExecutionCoordinator,
  type CoordinatorEntry
} from './provider-execution-coordinator.js';
import { createProviderAdapter } from './providers.js';
import type { GenerationRequest, GenerationResult, TokenUsage } from './types.js';

type RunStatus =
  'queued' | 'running' | 'streaming' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
type SessionStatus = 'active' | 'archived' | 'deleted';

export interface PlaygroundChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  status: 'active' | 'edited' | 'regenerated' | 'cancelled' | 'deleted';
  runId: string | null;
  parentMessageId: string | null;
  branchId: string;
  createdAt: string;
}

export interface PlaygroundChatRun {
  id: string;
  sessionId: string;
  status: RunStatus;
  providerProfileId: string;
  providerId: string;
  modelId: string;
  fallbackUsed: boolean;
  promptSnapshotId: string | null;
  contextSnapshotId: string | null;
  outputText: string | null;
  partialOutputText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: string;
  stopReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface PlaygroundChatSession {
  id: string;
  title: string;
  status: SessionStatus;
  currentBranchId: string;
  createdAt: string;
  updatedAt: string;
  messages: PlaygroundChatMessage[];
  runs: PlaygroundChatRun[];
}

export interface SendPlaygroundMessageInput {
  sessionId?: string;
  content: string;
  providerProfileId: string;
  modelId?: string;
  fallbackEntries?: Array<{ providerProfileId: string; modelId?: string }>;
  promptSnapshotId?: string;
  contextSnapshotId?: string;
  parameters?: Record<string, unknown>;
  stream?: boolean;
}

export interface PlaygroundProviderInvokeContext {
  prompt: string;
  request: GenerationRequest;
  onChunk(chunk: string): void;
}

export type PlaygroundProviderInvoker = (
  entry: CoordinatorEntry,
  signal: AbortSignal | undefined,
  context: PlaygroundProviderInvokeContext
) => Promise<GenerationResult>;

interface RowSession {
  id: string;
  title: string;
  status: SessionStatus;
  currentBranchId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RowRun {
  id: string;
  sessionId: string;
  status: RunStatus;
  providerProfileId: string;
  providerId: string;
  modelId: string;
  fallbackUsed: number;
  promptSnapshotId: string | null;
  contextSnapshotId: string | null;
  outputText: string | null;
  partialOutputText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: string;
  stopReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const controllers = new WeakMap<DesktopDatabase, Map<string, AbortController>>();

function now(): string {
  return new Date().toISOString();
}

function safeText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/api[_-]?key\s*[:=]\s*\S+/gi, 'api_key [redacted]')
    .slice(0, 2_000);
}

function usageTotal(usage: TokenUsage): number | null {
  return usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) || null);
}

export class PlaygroundChatService {
  private readonly activeControllers: Map<string, AbortController>;

  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService,
    private readonly invokeProvider?: PlaygroundProviderInvoker
  ) {
    let map = controllers.get(database);
    if (!map) {
      map = new Map();
      controllers.set(database, map);
    }
    this.activeControllers = map;
  }

  createSession(title = 'New Playground chat'): PlaygroundChatSession {
    const timestamp = now();
    const sessionId = ulid();
    const branchId = ulid();
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_sessions (id, owner_id, title, status, current_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          sessionId,
          this.ownerId,
          title.trim() || 'New Playground chat',
          'active',
          branchId,
          timestamp,
          timestamp
        );
      this.database
        .prepare(
          'INSERT INTO ai_playground_branches (id, owner_id, session_id, name, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(branchId, this.ownerId, sessionId, 'Main', timestamp);
    })();
    return this.getSession(sessionId);
  }

  listSessions(): PlaygroundChatSession[] {
    const rows = this.database
      .prepare(
        "SELECT id FROM ai_playground_sessions WHERE owner_id = ? AND status <> 'deleted' ORDER BY updated_at DESC"
      )
      .all(this.ownerId) as Array<{ id: string }>;
    return rows.map((row) => this.getSession(row.id));
  }

  getSession(id: string): PlaygroundChatSession {
    const row = this.database
      .prepare(
        'SELECT id, title, status, current_branch_id AS currentBranchId, created_at AS createdAt, updated_at AS updatedAt FROM ai_playground_sessions WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, id) as RowSession | undefined;
    if (!row || row.status === 'deleted')
      throw new AIError('VALIDATION', 'The Playground session is unavailable.');
    const messages = this.database
      .prepare(
        'SELECT id, role, content, status, run_id AS runId, parent_message_id AS parentMessageId, branch_id AS branchId, created_at AS createdAt FROM ai_playground_messages WHERE owner_id = ? AND session_id = ? AND status <> ? ORDER BY created_at'
      )
      .all(this.ownerId, id, 'deleted') as PlaygroundChatMessage[];
    const runs = (
      this.database
        .prepare(
          `SELECT id, session_id AS sessionId, status, provider_profile_id AS providerProfileId, provider_id AS providerId, model_id AS modelId, fallback_used AS fallbackUsed, prompt_snapshot_id AS promptSnapshotId, context_snapshot_id AS contextSnapshotId, output_text AS outputText, partial_output_text AS partialOutputText, input_tokens AS inputTokens, output_tokens AS outputTokens, total_tokens AS totalTokens, estimated_cost_micros AS estimatedCostMicros, stop_reason AS stopReason, error_code AS errorCode, error_message AS errorMessage, created_at AS createdAt FROM ai_playground_runs WHERE owner_id = ? AND session_id = ? ORDER BY created_at`
        )
        .all(this.ownerId, id) as RowRun[]
    ).map(toRun);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      currentBranchId: row.currentBranchId ?? '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages,
      runs
    };
  }

  renameSession(id: string, title: string): PlaygroundChatSession {
    this.assertSession(id);
    this.database
      .prepare(
        'UPDATE ai_playground_sessions SET title = ?, updated_at = ? WHERE owner_id = ? AND id = ?'
      )
      .run(title.trim() || 'Untitled Playground chat', now(), this.ownerId, id);
    return this.getSession(id);
  }

  archiveSession(id: string): PlaygroundChatSession {
    this.assertSession(id);
    const timestamp = now();
    this.database
      .prepare(
        "UPDATE ai_playground_sessions SET status = 'archived', archived_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
      )
      .run(timestamp, timestamp, this.ownerId, id);
    return this.getSession(id);
  }

  deleteSession(id: string): void {
    this.assertSession(id);
    const timestamp = now();
    this.database.transaction(() => {
      this.database
        .prepare(
          "UPDATE ai_playground_sessions SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
        )
        .run(timestamp, timestamp, this.ownerId, id);
      this.database
        .prepare(
          "UPDATE ai_playground_namespace_refs SET status = 'deleted', deleted_at = ? WHERE owner_id = ? AND session_id = ?"
        )
        .run(timestamp, this.ownerId, id);
      this.database
        .prepare(
          "UPDATE ai_playground_attachments SET status = 'deleted', deleted_at = ? WHERE owner_id = ? AND session_id = ?"
        )
        .run(timestamp, this.ownerId, id);
      this.database
        .prepare(
          "UPDATE ai_playground_messages SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE owner_id = ? AND session_id = ?"
        )
        .run(timestamp, timestamp, this.ownerId, id);
    })();
  }

  duplicateSession(id: string, title?: string): PlaygroundChatSession {
    const source = this.getSession(id);
    const copy = this.createSession(title ?? `${source.title} copy`);
    const insert = this.database.prepare(
      'INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, parent_message_id, role, content, status, run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const timestamp = now();
    for (const message of source.messages)
      insert.run(
        ulid(),
        this.ownerId,
        copy.id,
        copy.currentBranchId,
        null,
        message.role,
        message.content,
        message.status,
        null,
        timestamp,
        timestamp
      );
    return this.getSession(copy.id);
  }

  branchFromMessage(sessionId: string, messageId: string, name = 'Branch'): PlaygroundChatSession {
    this.assertMessage(sessionId, messageId);
    const branchId = ulid();
    const timestamp = now();
    this.database
      .prepare(
        'INSERT INTO ai_playground_branches (id, owner_id, session_id, parent_message_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(branchId, this.ownerId, sessionId, messageId, name, timestamp);
    this.database
      .prepare(
        'UPDATE ai_playground_sessions SET current_branch_id = ?, updated_at = ? WHERE owner_id = ? AND id = ?'
      )
      .run(branchId, timestamp, this.ownerId, sessionId);
    return this.getSession(sessionId);
  }

  async editAndResend(
    input: SendPlaygroundMessageInput & { messageId: string }
  ): Promise<PlaygroundChatRun> {
    const sessionId = input.sessionId ?? this.findMessageSession(input.messageId);
    this.assertMessage(sessionId, input.messageId);
    this.database
      .prepare(
        "UPDATE ai_playground_messages SET status = 'edited', content = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
      )
      .run(safeText(input.content), now(), this.ownerId, input.messageId);
    return this.sendMessage({ ...input, sessionId });
  }

  async regenerate(runId: string): Promise<PlaygroundChatRun> {
    const run = this.inspectRun(runId);
    const request = this.database
      .prepare(
        'SELECT content FROM ai_playground_messages WHERE owner_id = ? AND id = (SELECT request_message_id FROM ai_playground_runs WHERE id = ? AND owner_id = ?)'
      )
      .get(this.ownerId, runId, this.ownerId) as { content: string } | undefined;
    if (!request)
      throw new AIError('VALIDATION', 'The original Playground request is unavailable.');
    this.database
      .prepare(
        "UPDATE ai_playground_messages SET status = 'regenerated', updated_at = ? WHERE owner_id = ? AND run_id = ?"
      )
      .run(now(), this.ownerId, runId);
    return this.sendMessage({
      sessionId: run.sessionId,
      content: request.content,
      providerProfileId: run.providerProfileId,
      modelId: run.modelId,
      promptSnapshotId: run.promptSnapshotId ?? undefined,
      contextSnapshotId: run.contextSnapshotId ?? undefined
    });
  }

  async retryWithModel(
    runId: string,
    providerProfileId: string,
    modelId?: string
  ): Promise<PlaygroundChatRun> {
    const run = this.inspectRun(runId);
    const request = this.database
      .prepare(
        'SELECT content FROM ai_playground_messages WHERE owner_id = ? AND id = (SELECT request_message_id FROM ai_playground_runs WHERE id = ? AND owner_id = ?)'
      )
      .get(this.ownerId, runId, this.ownerId) as { content: string } | undefined;
    if (!request)
      throw new AIError('VALIDATION', 'The original Playground request is unavailable.');
    return this.sendMessage({
      sessionId: run.sessionId,
      content: request.content,
      providerProfileId,
      modelId,
      promptSnapshotId: run.promptSnapshotId ?? undefined,
      contextSnapshotId: run.contextSnapshotId ?? undefined
    });
  }

  async sendMessage(input: SendPlaygroundMessageInput): Promise<PlaygroundChatRun> {
    if (!input.content.trim())
      throw new AIError('VALIDATION', 'A Playground message cannot be empty.');
    this.assertPlaygroundEnabled();
    new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
      input.providerProfileId
    );
    const config = this.ai.requireExecution(input.providerProfileId, 'playground');
    const profile = config.profile;
    const model = input.modelId ?? profile.generationModel;
    if (!model)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The selected provider profile has no generation model.'
      );
    const fallbackEntries = (input.fallbackEntries ?? []).map((item) => {
      new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
        item.providerProfileId
      );
      const fallbackProfile = this.ai.profile(item.providerProfileId);
      const fallbackModel = item.modelId ?? fallbackProfile.generationModel;
      if (!fallbackModel)
        throw new AIError(
          'INVALID_CONFIGURATION',
          'A fallback provider profile has no generation model.'
        );
      return {
        providerProfileId: item.providerProfileId,
        providerType: fallbackProfile.providerId,
        model: fallbackModel,
        maxSameProviderRetries: fallbackProfile.retryLimit,
        allowFallback: true,
        concurrencyLimit: fallbackProfile.concurrencyLimit
      } satisfies CoordinatorEntry;
    });
    const session = input.sessionId ? this.getSession(input.sessionId) : this.createSession();
    const timestamp = now();
    const requestId = ulid();
    const assistantId = ulid();
    const runId = ulid();
    const jobId = ulid();
    const controller = new AbortController();
    this.activeControllers.set(runId, controller);
    const prompt = this.frozenPrompt(input.content, input.contextSnapshotId);
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, run_after, created_at, updated_at, schema_version, priority, max_attempts, started_at, requested_profile_id, requested_model_id, privacy_mode, prompt_version, parameters_json) VALUES (?, ?, ?, ?, ?, 'leased', 1, ?, ?, ?, 1, 100, 1, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          jobId,
          this.ownerId,
          'playground_chat',
          `playground:${runId}`,
          JSON.stringify({ playgroundRunId: runId }),
          timestamp,
          timestamp,
          timestamp,
          timestamp,
          input.providerProfileId,
          model,
          this.ai.getSettings().mode,
          input.promptSnapshotId ?? null,
          JSON.stringify(input.parameters ?? {})
        );
      this.database
        .prepare(
          'INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, parent_message_id, role, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          requestId,
          this.ownerId,
          session.id,
          session.currentBranchId,
          session.messages.at(-1)?.id ?? null,
          'user',
          safeText(input.content),
          'active',
          timestamp,
          timestamp
        );
      this.database
        .prepare(
          'INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, parent_message_id, role, content, status, run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          assistantId,
          this.ownerId,
          session.id,
          session.currentBranchId,
          requestId,
          'assistant',
          '',
          'active',
          runId,
          timestamp,
          timestamp
        );
      this.database
        .prepare(
          `INSERT INTO ai_playground_runs (id, owner_id, session_id, request_message_id, assistant_message_id, job_id, status, prompt_snapshot_id, context_snapshot_id, provider_profile_id, provider_id, model_id, parameters_json, input_snapshot_json, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          runId,
          this.ownerId,
          session.id,
          requestId,
          assistantId,
          jobId,
          input.promptSnapshotId ?? null,
          input.contextSnapshotId ?? null,
          input.providerProfileId,
          profile.providerId,
          model,
          JSON.stringify(input.parameters ?? {}),
          JSON.stringify({
            prompt: safeText(prompt),
            contextSnapshotId: input.contextSnapshotId ?? null
          }),
          timestamp,
          timestamp,
          timestamp
        );
      this.database
        .prepare('UPDATE ai_playground_messages SET run_id = ? WHERE id = ? AND owner_id = ?')
        .run(runId, requestId, this.ownerId);
      this.database
        .prepare(
          'UPDATE ai_playground_sessions SET root_message_id = COALESCE(root_message_id, ?), updated_at = ? WHERE id = ? AND owner_id = ?'
        )
        .run(requestId, timestamp, session.id, this.ownerId);
    })();
    try {
      const coordinator = new ProviderExecutionCoordinator(this.database, this.ownerId);
      const entry: CoordinatorEntry = {
        providerProfileId: input.providerProfileId,
        providerType: profile.providerId,
        model,
        maxSameProviderRetries: profile.retryLimit,
        allowFallback: fallbackEntries.length > 0,
        concurrencyLimit: profile.concurrencyLimit
      };
      const entries = [entry, ...fallbackEntries].map((candidate, index, all) => ({
        ...candidate,
        allowFallback: index + 1 < all.length
      }));
      const result = await coordinator.execute({
        jobId,
        queueAttempt: 1,
        entries,
        signal: controller.signal,
        enforceCurrentPolicy: true,
        budget: { requestCapMicros: 0, monthlyLimitMicros: null, estimateMicros: () => 0 },
        invoke: async (candidate, signal) =>
          this.invoke(candidate, signal, prompt, input.stream === true, runId)
      });
      return this.finishSuccess(
        runId,
        jobId,
        assistantId,
        result.value,
        result.providerProfileId,
        result.model,
        result.fallbackUsed
      );
    } catch (error) {
      return this.finishFailure(runId, jobId, error);
    } finally {
      this.activeControllers.delete(runId);
    }
  }

  stopRun(runId: string): PlaygroundChatRun {
    const run = this.inspectRun(runId);
    if (!['queued', 'running', 'streaming'].includes(run.status)) return run;
    this.activeControllers.get(runId)?.abort();
    const timestamp = now();
    this.database
      .prepare(
        "UPDATE ai_playground_runs SET status = 'cancelled', cancellation_requested = 1, stop_reason = 'cancelled_by_user', finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND status IN ('queued','running','streaming')"
      )
      .run(timestamp, timestamp, this.ownerId, runId);
    this.database
      .prepare(
        "UPDATE ai_jobs SET status = 'cancelled', cancellation_requested = 1, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = (SELECT job_id FROM ai_playground_runs WHERE id = ? AND owner_id = ?)"
      )
      .run(timestamp, timestamp, this.ownerId, runId, this.ownerId);
    this.recordEvent(runId, 'cancelled', 'Run cancelled by user.');
    return this.inspectRun(runId);
  }

  inspectRun(runId: string): PlaygroundChatRun {
    const row = this.database
      .prepare(
        `SELECT id, session_id AS sessionId, status, provider_profile_id AS providerProfileId, provider_id AS providerId, model_id AS modelId, fallback_used AS fallbackUsed, prompt_snapshot_id AS promptSnapshotId, context_snapshot_id AS contextSnapshotId, output_text AS outputText, partial_output_text AS partialOutputText, input_tokens AS inputTokens, output_tokens AS outputTokens, total_tokens AS totalTokens, estimated_cost_micros AS estimatedCostMicros, stop_reason AS stopReason, error_code AS errorCode, error_message AS errorMessage, created_at AS createdAt FROM ai_playground_runs WHERE owner_id = ? AND id = ?`
      )
      .get(this.ownerId, runId) as RowRun | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground run is unavailable.');
    return toRun(row);
  }

  reconcileStartup(): number {
    const timestamp = now();
    const rows = this.database
      .prepare(
        "SELECT id, job_id AS jobId FROM ai_playground_runs WHERE owner_id = ? AND status IN ('queued','running','streaming')"
      )
      .all(this.ownerId) as Array<{ id: string; jobId: string }>;
    this.database.transaction(() => {
      for (const row of rows) {
        this.database
          .prepare(
            "UPDATE ai_playground_runs SET status = 'interrupted', stop_reason = 'process_restarted', finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
          )
          .run(timestamp, timestamp, this.ownerId, row.id);
        this.database
          .prepare(
            "UPDATE ai_jobs SET status = 'cancelled', cancellation_requested = 1, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
          )
          .run(timestamp, timestamp, this.ownerId, row.jobId);
        this.recordEvent(
          row.id,
          'recovered',
          'Interrupted Playground run reconciled after restart.'
        );
      }
    })();
    return rows.length;
  }

  safeExportSession(id: string): Record<string, unknown> {
    const session = this.getSession(id);
    return {
      schema: 'focuslog.playground.session.v1',
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        createdAt: session.createdAt
      },
      messages: session.messages.map((message) => ({
        ...message,
        content: safeText(message.content)
      })),
      runs: session.runs.map((run) => ({
        ...run,
        errorMessage: run.errorMessage ? safeText(run.errorMessage) : null
      }))
    };
  }

  private assertSession(id: string): void {
    this.getSession(id);
  }

  private assertMessage(sessionId: string, messageId: string): void {
    const row = this.database
      .prepare(
        "SELECT 1 FROM ai_playground_messages WHERE owner_id = ? AND session_id = ? AND id = ? AND status <> 'deleted'"
      )
      .get(this.ownerId, sessionId, messageId);
    if (!row) throw new AIError('VALIDATION', 'The Playground message is unavailable.');
  }

  private findMessageSession(messageId: string): string {
    const row = this.database
      .prepare(
        'SELECT session_id AS sessionId FROM ai_playground_messages WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, messageId) as { sessionId: string } | undefined;
    if (!row) throw new AIError('VALIDATION', 'The Playground message is unavailable.');
    return row.sessionId;
  }

  private assertPlaygroundEnabled(): void {
    if (!this.ai.getSettings().featureFlags.playground)
      throw new AIError(
        'UNSUPPORTED_CAPABILITY',
        'Playground execution is disabled by its AI feature switch.'
      );
  }

  private frozenPrompt(content: string, contextSnapshotId?: string): string {
    const snapshot = contextSnapshotId
      ? (this.database
          .prepare(
            'SELECT final_prompt_redacted AS prompt FROM ai_playground_context_snapshots WHERE owner_id = ? AND id = ?'
          )
          .get(this.ownerId, contextSnapshotId) as { prompt: string } | undefined)
      : undefined;
    if (contextSnapshotId && !snapshot)
      throw new AIError('VALIDATION', 'The Playground context snapshot is unavailable.');
    return `${snapshot?.prompt ?? ''}\n<playground_user_message>\n${content}\n</playground_user_message>`.trim();
  }

  private async invoke(
    entry: CoordinatorEntry,
    signal: AbortSignal | undefined,
    prompt: string,
    stream: boolean,
    runId: string
  ): Promise<GenerationResult> {
    const profile = this.ai.profile(entry.providerProfileId);
    const request: GenerationRequest = {
      model: entry.model,
      prompt,
      temperature: profile.temperature,
      topP: profile.topP,
      maxOutputTokens: profile.maxOutputTokens,
      signal
    };
    const onChunk = (chunk: string) => {
      const current = this.inspectRun(runId);
      if (!['running', 'streaming'].includes(current.status))
        throw new AIError('CANCELLATION', 'The Playground run is no longer active.', false);
      const previous = current.partialOutputText ?? '';
      this.database
        .prepare(
          "UPDATE ai_playground_runs SET status = 'streaming', partial_output_text = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND status IN ('running','streaming')"
        )
        .run(previous + chunk, now(), this.ownerId, runId);
      this.recordEvent(runId, 'delta', safeText(chunk));
    };
    if (this.invokeProvider)
      return this.invokeProvider(entry, signal, { prompt, request, onChunk });
    const config = this.ai.requireExecution(entry.providerProfileId, 'playground');
    const adapter = createProviderAdapter(config);
    if (!stream) return adapter.generate(request);
    let text = '';
    let usage: TokenUsage = { reported: false };
    let finishReason: GenerationResult['finishReason'] = 'UNKNOWN';
    for await (const event of adapter.stream(request)) {
      if (event.type === 'delta') {
        text += event.text;
        onChunk(event.text);
      } else if (event.type === 'usage') usage = event.usage;
      else if (event.type === 'complete') finishReason = event.finishReason;
      else throw new AIError(event.error.code, event.error.message);
    }
    return { text, usage, finishReason };
  }

  private finishSuccess(
    runId: string,
    jobId: string,
    assistantId: string,
    result: GenerationResult,
    providerProfileId: string,
    modelId: string,
    fallbackUsed: boolean
  ): PlaygroundChatRun {
    const timestamp = now();
    const usageId = ulid();
    const duration = 0;
    const totalTokens = usageTotal(result.usage);
    const actualProviderId = this.ai.profile(providerProfileId).providerId;
    const changed = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, provider_profile_id, model_id, prompt_version, duration_ms, input_tokens, output_tokens, total_tokens, usage_reported, estimated_cost_usd, pricing_version, retry_index, fallback_chain_id, outcome, created_at) VALUES (?, ?, ?, 'playground_chat', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'playground-local-zero-v1', 0, NULL, 'SUCCESS', ?)`
        )
        .run(
          usageId,
          this.ownerId,
          jobId,
          providerProfileId,
          modelId,
          null,
          duration,
          result.usage.inputTokens ?? null,
          result.usage.outputTokens ?? null,
          totalTokens,
          Number(result.usage.reported),
          timestamp
        );
      const update = this.database
        .prepare(
          "UPDATE ai_playground_runs SET status = 'succeeded', provider_profile_id = ?, provider_id = ?, model_id = ?, fallback_used = ?, output_text = ?, partial_output_text = NULL, latency_ms = ?, input_tokens = ?, output_tokens = ?, total_tokens = ?, estimated_cost_micros = '0', usage_record_id = ?, stop_reason = ?, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND status IN ('running','streaming')"
        )
        .run(
          providerProfileId,
          actualProviderId,
          modelId,
          Number(fallbackUsed),
          safeText(result.text),
          duration,
          result.usage.inputTokens ?? null,
          result.usage.outputTokens ?? null,
          totalTokens,
          usageId,
          result.finishReason,
          timestamp,
          timestamp,
          this.ownerId,
          runId
        );
      if (update.changes === 0) return 0;
      this.database
        .prepare(
          "UPDATE ai_playground_messages SET content = ?, status = 'active', updated_at = ? WHERE owner_id = ? AND id = ?"
        )
        .run(safeText(result.text), timestamp, this.ownerId, assistantId);
      this.database
        .prepare(
          "UPDATE ai_jobs SET status = 'succeeded', actual_profile_id = ?, actual_model_id = ?, input_tokens = ?, output_tokens = ?, duration_ms = ?, completed_at = ?, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
        )
        .run(
          providerProfileId,
          modelId,
          result.usage.inputTokens ?? null,
          result.usage.outputTokens ?? null,
          duration,
          timestamp,
          timestamp,
          timestamp,
          this.ownerId,
          jobId
        );
      return 1;
    })();
    if (!changed)
      throw new AIError('CANCELLATION', 'A stale Playground completion was rejected.', false);
    return this.inspectRun(runId);
  }

  private finishFailure(runId: string, jobId: string, error: unknown): PlaygroundChatRun {
    const normalized = normalizeProviderError(error);
    const timestamp = now();
    const status: RunStatus = normalized.code === 'CANCELLATION' ? 'cancelled' : 'failed';
    this.database.transaction(() => {
      this.database
        .prepare(
          `UPDATE ai_playground_runs SET status = ?, error_code = ?, error_message = ?, stop_reason = ?, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND status IN ('queued','running','streaming')`
        )
        .run(
          status,
          normalized.code,
          safeText(normalized.message),
          normalized.code === 'CANCELLATION' ? 'cancelled' : 'error',
          timestamp,
          timestamp,
          this.ownerId,
          runId
        );
      this.database
        .prepare(
          `UPDATE ai_jobs SET status = ?, last_error_code = ?, last_error_message = ?, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?`
        )
        .run(
          status === 'cancelled' ? 'cancelled' : 'failed',
          normalized.code,
          safeText(normalized.message),
          timestamp,
          timestamp,
          this.ownerId,
          jobId
        );
      this.recordEvent(
        runId,
        status === 'cancelled' ? 'cancelled' : 'error',
        `${normalized.code}: ${safeText(normalized.message)}`
      );
    })();
    return this.inspectRun(runId);
  }

  private recordEvent(
    runId: string,
    eventType: 'delta' | 'usage' | 'complete' | 'error' | 'cancelled' | 'recovered',
    content: string
  ): void {
    const sequence =
      ((
        this.database
          .prepare(
            'SELECT COALESCE(MAX(sequence), 0) AS value FROM ai_playground_run_events WHERE run_id = ?'
          )
          .get(runId) as { value: number }
      ).value ?? 0) + 1;
    this.database
      .prepare(
        'INSERT OR IGNORE INTO ai_playground_run_events (id, owner_id, run_id, sequence, event_type, content_redacted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, runId, sequence, eventType, safeText(content), now());
  }
}

function toRun(row: RowRun): PlaygroundChatRun {
  return {
    ...row,
    fallbackUsed: row.fallbackUsed === 1
  };
}
