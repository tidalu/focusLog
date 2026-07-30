export type ProviderId =
  'ollama' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'lm-studio' | 'openai-compatible';

export type PrivacyMode = 'DISABLED' | 'LOCAL' | 'CLOUD' | 'HYBRID';
export type ProviderKind = 'LOCAL' | 'CLOUD';
export type AIErrorCode =
  | 'AUTHENTICATION'
  | 'PERMISSION'
  | 'INVALID_CONFIGURATION'
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNSUPPORTED_JOB_TYPE'
  | 'MODEL_UNAVAILABLE'
  | 'VALIDATION'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'BUDGET_EXCEEDED'
  | 'TIMEOUT'
  | 'CANCELLATION'
  | 'NETWORK_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'SAFETY_REFUSAL'
  | 'CONTEXT_TOO_LARGE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export interface ProviderCapabilities {
  generation: boolean;
  streaming: boolean;
  cancellation: boolean;
  structuredOutput: boolean;
  nativeStructuredOutput: boolean;
  jsonMode: boolean;
  promptJsonFallback: boolean;
  embeddings: boolean;
  modelDiscovery: boolean;
  usage: boolean;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  defaultEndpoint?: string;
  documentationUrl: string;
  credentialLabel?: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderProfile {
  id: string;
  ownerId: string;
  name: string;
  providerId: ProviderId;
  enabled: boolean;
  endpoint: string | null;
  generationModel: string | null;
  embeddingModel: string | null;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  timeoutMs: number;
  retryLimit: number;
  concurrencyLimit: number;
  automaticAnalysis: boolean;
  priority: number;
  monthlyBudgetUsd: number | null;
  credentialConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedProviderConfig {
  profile: ProviderProfile;
  endpoint: string;
  apiKey?: string;
}

export interface ModelDescriptor {
  id: string;
  displayName: string;
  contextWindow?: number;
  deprecated?: boolean;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reported: boolean;
}

export interface GenerationRequest {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface GenerationResult {
  text: string;
  finishReason: 'STOP' | 'LENGTH' | 'SAFETY' | 'CANCELLED' | 'UNKNOWN';
  usage: TokenUsage;
  providerMetadata?: Record<string, string | number | boolean | null>;
}

export type GenerationEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'complete'; finishReason: GenerationResult['finishReason'] }
  | { type: 'error'; error: { code: AIErrorCode; message: string } };

export type RuntimeSchema<T> = {
  readonly jsonSchema: Record<string, unknown>;
  parse(value: unknown): T;
};

export interface EmbeddingResult {
  vectors: number[][];
  usage: TokenUsage;
}

export interface HealthResult {
  ok: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: { code: AIErrorCode; message: string };
}

export interface AIProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  healthCheck(signal?: AbortSignal): Promise<HealthResult>;
  listModels(signal?: AbortSignal): Promise<ModelDescriptor[]>;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  stream(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  generateStructured<T>(
    request: GenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<{ value: T; result: GenerationResult; repaired: boolean }>;
  embed?(model: string, input: string[], signal?: AbortSignal): Promise<EmbeddingResult>;
}

export interface ConnectionTestResult extends HealthResult {
  provider: ProviderDescriptor;
  endpoint: string;
  selectedModel: string | null;
  capabilities: ProviderCapabilities;
  models: ModelDescriptor[];
  modelsStale: boolean;
}

export interface AISettings {
  mode: PrivacyMode;
  maxContextTokens: number;
  maxOutputTokens: number;
  monthlyCloudBudgetUsd: number | null;
  requestCostCapUsd: number | null;
  dataSharingPreview: boolean;
  automaticAnalysis: boolean;
  featureFlags: Record<'analyses' | 'facts' | 'graph' | 'embeddings' | 'playground', boolean>;
}
