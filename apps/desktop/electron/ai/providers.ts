import { AIError, errorForHttpStatus, normalizeProviderError } from './errors.js';
import type {
  AIProviderAdapter,
  EmbeddingResult,
  GenerationEvent,
  GenerationRequest,
  GenerationResult,
  HealthResult,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderId,
  ResolvedProviderConfig,
  RuntimeSchema,
  TokenUsage
} from './types.js';
import { validateProviderEndpoint } from './url-security.js';

const noUsage: TokenUsage = { reported: false };

export const providerDescriptors: readonly ProviderDescriptor[] = [
  {
    id: 'ollama',
    label: 'Ollama',
    kind: 'LOCAL',
    defaultEndpoint: 'http://127.0.0.1:11434',
    documentationUrl: 'https://docs.ollama.com/api',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: true,
      jsonMode: true,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'CLOUD',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    documentationUrl: 'https://ai.google.dev/gemini-api/docs',
    credentialLabel: 'Gemini API key',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: true,
      jsonMode: true,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'CLOUD',
    defaultEndpoint: 'https://api.openai.com/v1',
    documentationUrl: 'https://platform.openai.com/docs/api-reference',
    credentialLabel: 'OpenAI API key',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: true,
      jsonMode: true,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    kind: 'CLOUD',
    defaultEndpoint: 'https://api.anthropic.com',
    documentationUrl: 'https://docs.anthropic.com/en/api',
    credentialLabel: 'Anthropic API key',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: false,
      jsonMode: false,
      promptJsonFallback: true,
      embeddings: false,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'CLOUD',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    documentationUrl: 'https://openrouter.ai/docs',
    credentialLabel: 'OpenRouter API key',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: true,
      jsonMode: true,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'lm-studio',
    label: 'LM Studio',
    kind: 'LOCAL',
    defaultEndpoint: 'http://127.0.0.1:1234/v1',
    documentationUrl: 'https://lmstudio.ai/docs/developer/core',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: true,
      jsonMode: true,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible API',
    kind: 'CLOUD',
    documentationUrl: 'https://platform.openai.com/docs/api-reference',
    credentialLabel: 'API key (if required)',
    capabilities: {
      generation: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      nativeStructuredOutput: false,
      jsonMode: false,
      promptJsonFallback: true,
      embeddings: true,
      modelDiscovery: true,
      usage: true
    }
  }
];

export function providerDescriptor(id: ProviderId): ProviderDescriptor {
  const descriptor = providerDescriptors.find((candidate) => candidate.id === id);
  if (!descriptor)
    throw new AIError('INVALID_CONFIGURATION', 'The selected AI provider is not registered.');
  return descriptor;
}

function parseUsage(value: unknown): TokenUsage {
  if (!value || typeof value !== 'object') return noUsage;
  const usage = value as Record<string, unknown>;
  const number = (key: string): number | undefined =>
    typeof usage[key] === 'number' ? usage[key] : undefined;
  const inputTokens =
    number('prompt_tokens') ?? number('input_tokens') ?? number('promptTokenCount');
  const outputTokens =
    number('completion_tokens') ?? number('output_tokens') ?? number('candidatesTokenCount');
  const totalTokens = number('total_tokens') ?? number('totalTokenCount');
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reported: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
  };
}

async function jsonResponse(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 2_000_000)
    throw new AIError(
      'MALFORMED_RESPONSE',
      'The AI provider returned an unexpectedly large response.'
    );
  const body = await response.text();
  if (!response.ok) throw errorForHttpStatus(response.status, body.slice(0, 500));
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AIError('MALFORMED_RESPONSE', 'The AI provider returned invalid JSON.');
  }
}

abstract class HttpAdapter implements AIProviderAdapter {
  abstract readonly descriptor: ProviderDescriptor;
  protected readonly endpoint: string;

  constructor(protected readonly config: ResolvedProviderConfig) {
    this.endpoint = validateProviderEndpoint(
      config.endpoint,
      providerDescriptor(config.profile.providerId).kind === 'LOCAL'
    );
  }

  protected async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
      this.config.profile.timeoutMs
    );
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        signal: controller.signal,
        redirect: 'manual'
      });
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400))
        throw new AIError(
          'INVALID_CONFIGURATION',
          'Provider redirects are blocked to protect credentials.'
        );
      return await jsonResponse(response);
    } catch (error) {
      throw normalizeProviderError(error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  protected async openStream(
    path: string,
    init: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
      this.config.profile.timeoutMs
    );
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        signal: controller.signal,
        redirect: 'manual'
      });
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400))
        throw new AIError(
          'INVALID_CONFIGURATION',
          'Provider redirects are blocked to protect credentials.'
        );
      if (!response.ok) await jsonResponse(response);
      if (!response.body)
        throw new AIError('MALFORMED_RESPONSE', 'The provider did not return a response stream.');
      return response;
    } catch (error) {
      throw normalizeProviderError(error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  protected async *lines(response: Response): AsyncIterable<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 2_000_000)
          throw new AIError(
            'MALFORMED_RESPONSE',
            'The provider streaming response exceeded the safe size limit.'
          );
        buffered += decoder.decode(next.value, { stream: true });
        const records = buffered.split(/\r?\n/u);
        buffered = records.pop() ?? '';
        for (const record of records) if (record) yield record;
      }
      buffered += decoder.decode();
      if (buffered) yield buffered;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  protected authHeaders(): Record<string, string> {
    return this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {};
  }

  async healthCheck(signal?: AbortSignal): Promise<HealthResult> {
    const started = performance.now();
    try {
      await this.listModels(signal);
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: { code: normalized.code, message: normalized.message }
      };
    }
  }

  stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    void request;
    throw new AIError(
      'UNSUPPORTED_CAPABILITY',
      'Streaming is not available for this provider adapter.'
    );
  }

  async generateStructured<T>(
    request: GenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<{ value: T; result: GenerationResult; repaired: boolean }> {
    const instruction = `${request.system ?? ''}\nReturn only JSON that conforms to this schema: ${JSON.stringify(schema.jsonSchema)}`;
    const result = await this.generate({ ...request, system: instruction });
    try {
      return { value: schema.parse(JSON.parse(result.text)), result, repaired: false };
    } catch {
      throw new AIError('VALIDATION', 'The provider did not return valid structured output.');
    }
  }

  abstract listModels(signal?: AbortSignal): Promise<ModelDescriptor[]>;
  abstract generate(request: GenerationRequest): Promise<GenerationResult>;
}

class OpenAICompatibleAdapter extends HttpAdapter {
  get descriptor(): ProviderDescriptor {
    return providerDescriptor(this.config.profile.providerId);
  }

  async listModels(signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const data = (await this.request('/models', { headers: this.authHeaders() }, signal)) as {
      data?: unknown;
    };
    if (!Array.isArray(data.data))
      throw new AIError('MALFORMED_RESPONSE', 'The provider did not return a model list.');
    return data.data.flatMap((item): ModelDescriptor[] => {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string')
        return [];
      const row = item as { id: string; name?: unknown; context_length?: unknown };
      return [
        {
          id: row.id,
          displayName: typeof row.name === 'string' ? row.name : row.id,
          contextWindow: typeof row.context_length === 'number' ? row.context_length : undefined
        }
      ];
    });
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const data = (await this.request(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature,
          top_p: request.topP,
          max_tokens: request.maxOutputTokens,
          stream: false
        })
      },
      request.signal
    )) as { choices?: unknown; usage?: unknown };
    const choice = Array.isArray(data.choices)
      ? (data.choices[0] as
          { message?: { content?: unknown }; finish_reason?: unknown } | undefined)
      : undefined;
    if (!choice || typeof choice.message?.content !== 'string')
      throw new AIError('MALFORMED_RESPONSE', 'The provider returned no generated text.');
    return {
      text: choice.message.content,
      finishReason: choice.finish_reason === 'length' ? 'LENGTH' : 'STOP',
      usage: parseUsage(data.usage)
    };
  }

  override async generateStructured<T>(
    request: GenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<{ value: T; result: GenerationResult; repaired: boolean }> {
    try {
      const data = (await this.request(
        '/chat/completions',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...this.authHeaders() },
          body: JSON.stringify({
            model: request.model,
            messages: [
              ...(request.system ? [{ role: 'system', content: request.system }] : []),
              { role: 'user', content: request.prompt }
            ],
            temperature: request.temperature,
            top_p: request.topP,
            max_tokens: request.maxOutputTokens,
            stream: false,
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'focuslog_response', strict: true, schema: schema.jsonSchema }
            }
          })
        },
        request.signal
      )) as { choices?: unknown; usage?: unknown };
      const choice = Array.isArray(data.choices)
        ? (data.choices[0] as
            | { message?: { content?: unknown; refusal?: unknown }; finish_reason?: unknown }
            | undefined)
        : undefined;
      if (typeof choice?.message?.refusal === 'string')
        throw new AIError('SAFETY_REFUSAL', 'The provider declined the structured request.');
      if (typeof choice?.message?.content !== 'string')
        throw new AIError('MALFORMED_RESPONSE', 'The provider returned no structured response.');
      const result: GenerationResult = {
        text: choice.message.content,
        finishReason: choice.finish_reason === 'length' ? 'LENGTH' : 'STOP',
        usage: parseUsage(data.usage)
      };
      return { value: schema.parse(JSON.parse(result.text)), result, repaired: false };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (
        !['UNKNOWN', 'VALIDATION', 'UNSUPPORTED_CAPABILITY', 'MALFORMED_RESPONSE'].includes(
          normalized.code
        )
      )
        throw normalized;
      return super.generateStructured(request, schema);
    }
  }

  async *stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const response = await this.openStream(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature,
          top_p: request.topP,
          max_tokens: request.maxOutputTokens,
          stream: true,
          stream_options: { include_usage: true }
        })
      },
      request.signal
    );
    for await (const line of this.lines(response)) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') break;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>;
          usage?: unknown;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === 'string' && text) yield { type: 'delta', text };
        if (chunk.usage) yield { type: 'usage', usage: parseUsage(chunk.usage) };
        const finish = chunk.choices?.[0]?.finish_reason;
        if (finish)
          yield { type: 'complete', finishReason: finish === 'length' ? 'LENGTH' : 'STOP' };
      } catch {
        throw new AIError(
          'MALFORMED_RESPONSE',
          'The provider returned an invalid streaming event.'
        );
      }
    }
  }

  async embed(model: string, input: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const data = (await this.request(
      '/embeddings',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ model, input })
      },
      signal
    )) as { data?: unknown; usage?: unknown };
    if (!Array.isArray(data.data))
      throw new AIError('MALFORMED_RESPONSE', 'The provider returned no embeddings.');
    const vectors = data.data
      .map((item) => (item as { embedding?: unknown }).embedding)
      .filter(
        (vector): vector is number[] =>
          Array.isArray(vector) && vector.every((value) => typeof value === 'number')
      );
    if (vectors.length !== input.length)
      throw new AIError('MALFORMED_RESPONSE', 'The provider returned incomplete embeddings.');
    return { vectors, usage: parseUsage(data.usage) };
  }
}

class OllamaAdapter extends HttpAdapter {
  get descriptor(): ProviderDescriptor {
    return providerDescriptor('ollama');
  }
  async listModels(signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const data = (await this.request('/api/tags', {}, signal)) as { models?: unknown };
    if (!Array.isArray(data.models))
      throw new AIError('MALFORMED_RESPONSE', 'Ollama did not return a model list.');
    return data.models.flatMap((item): ModelDescriptor[] =>
      typeof (item as { name?: unknown }).name === 'string'
        ? [{ id: (item as { name: string }).name, displayName: (item as { name: string }).name }]
        : []
    );
  }
  async healthCheck(signal?: AbortSignal): Promise<HealthResult> {
    const started = performance.now();
    try {
      const data = (await this.request('/api/version', {}, signal)) as { version?: unknown };
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - started),
        serverVersion: typeof data.version === 'string' ? data.version : undefined
      };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: { code: normalized.code, message: normalized.message }
      };
    }
  }
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const data = (await this.request(
      '/api/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          system: request.system,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: request.temperature,
            top_p: request.topP,
            num_predict: request.maxOutputTokens
          }
        })
      },
      request.signal
    )) as {
      response?: unknown;
      done_reason?: unknown;
      prompt_eval_count?: unknown;
      eval_count?: unknown;
    };
    if (typeof data.response !== 'string')
      throw new AIError('MALFORMED_RESPONSE', 'Ollama returned no generated text.');
    return {
      text: data.response,
      finishReason: data.done_reason === 'length' ? 'LENGTH' : 'STOP',
      usage: {
        inputTokens:
          typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined,
        outputTokens: typeof data.eval_count === 'number' ? data.eval_count : undefined,
        reported: typeof data.prompt_eval_count === 'number' || typeof data.eval_count === 'number'
      }
    };
  }
  override async generateStructured<T>(
    request: GenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<{ value: T; result: GenerationResult; repaired: boolean }> {
    try {
      const data = (await this.request(
        '/api/generate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: request.model,
            system: request.system,
            prompt: request.prompt,
            format: schema.jsonSchema,
            stream: false,
            options: {
              temperature: request.temperature,
              top_p: request.topP,
              num_predict: request.maxOutputTokens
            }
          })
        },
        request.signal
      )) as {
        response?: unknown;
        done_reason?: unknown;
        prompt_eval_count?: unknown;
        eval_count?: unknown;
      };
      if (typeof data.response !== 'string')
        throw new AIError('MALFORMED_RESPONSE', 'Ollama returned no structured response.');
      const result: GenerationResult = {
        text: data.response,
        finishReason: data.done_reason === 'length' ? 'LENGTH' : 'STOP',
        usage: {
          inputTokens:
            typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined,
          outputTokens: typeof data.eval_count === 'number' ? data.eval_count : undefined,
          reported:
            typeof data.prompt_eval_count === 'number' || typeof data.eval_count === 'number'
        }
      };
      return { value: schema.parse(JSON.parse(result.text)), result, repaired: false };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (!['UNKNOWN', 'VALIDATION', 'MALFORMED_RESPONSE'].includes(normalized.code))
        throw normalized;
      return super.generateStructured(request, schema);
    }
  }
  async *stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const response = await this.openStream(
      '/api/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          system: request.system,
          prompt: request.prompt,
          stream: true,
          options: {
            temperature: request.temperature,
            top_p: request.topP,
            num_predict: request.maxOutputTokens
          }
        })
      },
      request.signal
    );
    for await (const line of this.lines(response)) {
      try {
        const chunk = JSON.parse(line) as {
          response?: unknown;
          done?: unknown;
          done_reason?: unknown;
          prompt_eval_count?: unknown;
          eval_count?: unknown;
        };
        if (typeof chunk.response === 'string' && chunk.response)
          yield { type: 'delta', text: chunk.response };
        if (chunk.done === true) {
          yield {
            type: 'usage',
            usage: {
              inputTokens:
                typeof chunk.prompt_eval_count === 'number' ? chunk.prompt_eval_count : undefined,
              outputTokens: typeof chunk.eval_count === 'number' ? chunk.eval_count : undefined,
              reported:
                typeof chunk.prompt_eval_count === 'number' || typeof chunk.eval_count === 'number'
            }
          };
          yield {
            type: 'complete',
            finishReason: chunk.done_reason === 'length' ? 'LENGTH' : 'STOP'
          };
        }
      } catch {
        throw new AIError('MALFORMED_RESPONSE', 'Ollama returned an invalid streaming event.');
      }
    }
  }
  async embed(model: string, input: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const data = (await this.request(
      '/api/embed',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, input })
      },
      signal
    )) as { embeddings?: unknown; prompt_eval_count?: unknown };
    if (
      !Array.isArray(data.embeddings) ||
      !data.embeddings.every(
        (vector) => Array.isArray(vector) && vector.every((value) => typeof value === 'number')
      )
    )
      throw new AIError('MALFORMED_RESPONSE', 'Ollama returned invalid embeddings.');
    return {
      vectors: data.embeddings as number[][],
      usage: {
        inputTokens:
          typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined,
        reported: typeof data.prompt_eval_count === 'number'
      }
    };
  }
}

class GeminiAdapter extends HttpAdapter {
  get descriptor(): ProviderDescriptor {
    return providerDescriptor('gemini');
  }
  private path(path: string): string {
    return `${path}?key=${encodeURIComponent(this.config.apiKey ?? '')}`;
  }
  async listModels(signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const data = (await this.request(this.path('/models'), {}, signal)) as { models?: unknown };
    if (!Array.isArray(data.models))
      throw new AIError('MALFORMED_RESPONSE', 'Gemini did not return a model list.');
    return data.models.flatMap((item): ModelDescriptor[] => {
      const row = item as { name?: unknown; displayName?: unknown; inputTokenLimit?: unknown };
      if (typeof row.name !== 'string') return [];
      const id = row.name.replace(/^models\//u, '');
      return [
        {
          id,
          displayName: typeof row.displayName === 'string' ? row.displayName : id,
          contextWindow: typeof row.inputTokenLimit === 'number' ? row.inputTokenLimit : undefined
        }
      ];
    });
  }
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const data = (await this.request(
      this.path(`/models/${encodeURIComponent(request.model)}:generateContent`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: request.temperature,
            topP: request.topP,
            maxOutputTokens: request.maxOutputTokens
          }
        })
      },
      request.signal
    )) as { candidates?: unknown; usageMetadata?: unknown };
    const candidate = Array.isArray(data.candidates)
      ? (data.candidates[0] as
          { content?: { parts?: Array<{ text?: unknown }> }; finishReason?: unknown } | undefined)
      : undefined;
    const text = candidate?.content?.parts
      ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
    if (!text) throw new AIError('MALFORMED_RESPONSE', 'Gemini returned no generated text.');
    return {
      text,
      finishReason: candidate?.finishReason === 'MAX_TOKENS' ? 'LENGTH' : 'STOP',
      usage: parseUsage(data.usageMetadata)
    };
  }
  override async generateStructured<T>(
    request: GenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<{ value: T; result: GenerationResult; repaired: boolean }> {
    try {
      const data = (await this.request(
        this.path(`/models/${encodeURIComponent(request.model)}:generateContent`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
            contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
            generationConfig: {
              temperature: request.temperature,
              topP: request.topP,
              maxOutputTokens: request.maxOutputTokens,
              responseMimeType: 'application/json',
              responseSchema: schema.jsonSchema
            }
          })
        },
        request.signal
      )) as { candidates?: unknown; usageMetadata?: unknown };
      const candidate = Array.isArray(data.candidates)
        ? (data.candidates[0] as
            { content?: { parts?: Array<{ text?: unknown }> }; finishReason?: unknown } | undefined)
        : undefined;
      const text = candidate?.content?.parts
        ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
      if (!text) throw new AIError('MALFORMED_RESPONSE', 'Gemini returned no structured response.');
      const result: GenerationResult = {
        text,
        finishReason: candidate?.finishReason === 'MAX_TOKENS' ? 'LENGTH' : 'STOP',
        usage: parseUsage(data.usageMetadata)
      };
      return { value: schema.parse(JSON.parse(result.text)), result, repaired: false };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (!['UNKNOWN', 'VALIDATION', 'MALFORMED_RESPONSE'].includes(normalized.code))
        throw normalized;
      return super.generateStructured(request, schema);
    }
  }
  async *stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const response = await this.openStream(
      this.path(`/models/${encodeURIComponent(request.model)}:streamGenerateContent&alt=sse`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: request.temperature,
            topP: request.topP,
            maxOutputTokens: request.maxOutputTokens
          }
        })
      },
      request.signal
    );
    for await (const line of this.lines(response)) {
      if (!line.startsWith('data:')) continue;
      try {
        const chunk = JSON.parse(line.slice(5).trim()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: unknown }> };
            finishReason?: unknown;
          }>;
          usageMetadata?: unknown;
        };
        const text = chunk.candidates?.[0]?.content?.parts
          ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
          .join('');
        if (text) yield { type: 'delta', text };
        if (chunk.usageMetadata) yield { type: 'usage', usage: parseUsage(chunk.usageMetadata) };
        const finish = chunk.candidates?.[0]?.finishReason;
        if (finish)
          yield { type: 'complete', finishReason: finish === 'MAX_TOKENS' ? 'LENGTH' : 'STOP' };
      } catch {
        throw new AIError('MALFORMED_RESPONSE', 'Gemini returned an invalid streaming event.');
      }
    }
  }
  async embed(model: string, input: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const vectors: number[][] = [];
    for (const text of input) {
      const data = (await this.request(
        this.path(`/models/${encodeURIComponent(model)}:embedContent`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text }] } })
        },
        signal
      )) as { embedding?: { values?: unknown } };
      if (
        !Array.isArray(data.embedding?.values) ||
        !data.embedding.values.every((value) => typeof value === 'number')
      )
        throw new AIError('MALFORMED_RESPONSE', 'Gemini returned invalid embeddings.');
      vectors.push(data.embedding.values);
    }
    return { vectors, usage: noUsage };
  }
}

class AnthropicAdapter extends HttpAdapter {
  get descriptor(): ProviderDescriptor {
    return providerDescriptor('anthropic');
  }
  protected authHeaders(): Record<string, string> {
    return this.config.apiKey
      ? { 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' }
      : { 'anthropic-version': '2023-06-01' };
  }
  async listModels(signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const data = (await this.request('/v1/models', { headers: this.authHeaders() }, signal)) as {
      data?: unknown;
    };
    if (!Array.isArray(data.data))
      throw new AIError('MALFORMED_RESPONSE', 'Anthropic did not return a model list.');
    return data.data.flatMap((item): ModelDescriptor[] => {
      const row = item as { id?: unknown; display_name?: unknown };
      return typeof row.id === 'string'
        ? [
            {
              id: row.id,
              displayName: typeof row.display_name === 'string' ? row.display_name : row.id
            }
          ]
        : [];
    });
  }
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const data = (await this.request(
      '/v1/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          model: request.model,
          system: request.system,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          top_p: request.topP,
          messages: [{ role: 'user', content: request.prompt }]
        })
      },
      request.signal
    )) as { content?: unknown; stop_reason?: unknown; usage?: unknown };
    const text = Array.isArray(data.content)
      ? data.content
          .map((item) => (item as { text?: unknown }).text)
          .filter((value): value is string => typeof value === 'string')
          .join('')
      : '';
    if (!text) throw new AIError('MALFORMED_RESPONSE', 'Anthropic returned no generated text.');
    return {
      text,
      finishReason: data.stop_reason === 'max_tokens' ? 'LENGTH' : 'STOP',
      usage: parseUsage(data.usage)
    };
  }
  async *stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const response = await this.openStream(
      '/v1/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          model: request.model,
          system: request.system,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          top_p: request.topP,
          messages: [{ role: 'user', content: request.prompt }],
          stream: true
        })
      },
      request.signal
    );
    let event = '';
    for await (const line of this.lines(response)) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as {
          delta?: { text?: unknown; stop_reason?: unknown };
          usage?: unknown;
        };
        if (event === 'content_block_delta' && typeof payload.delta?.text === 'string')
          yield { type: 'delta', text: payload.delta.text };
        if (event === 'message_delta') {
          if (payload.usage) yield { type: 'usage', usage: parseUsage(payload.usage) };
          if (payload.delta?.stop_reason)
            yield {
              type: 'complete',
              finishReason: payload.delta.stop_reason === 'max_tokens' ? 'LENGTH' : 'STOP'
            };
        }
      } catch {
        throw new AIError('MALFORMED_RESPONSE', 'Anthropic returned an invalid streaming event.');
      }
    }
  }
}

export function createProviderAdapter(config: ResolvedProviderConfig): AIProviderAdapter {
  switch (config.profile.providerId) {
    case 'ollama':
      return new OllamaAdapter(config);
    case 'gemini':
      return new GeminiAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'openai':
    case 'openrouter':
    case 'lm-studio':
    case 'openai-compatible':
      return new OpenAICompatibleAdapter(config);
  }
}
