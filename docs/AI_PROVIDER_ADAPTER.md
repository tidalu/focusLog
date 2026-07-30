# Adding an AI Provider Adapter

Add a `ProviderDescriptor` in `apps/desktop/electron/ai/providers.ts`, then implement the generic adapter contract: health check, model list, generation, and embeddings where supported. Keep SDK/HTTP code inside the adapter; analysis and memory services must not import provider code or hard-code model names.

Adapters must validate endpoint security, use request timeouts/cancellation, avoid redirects with credentials, bound responses, normalize errors, and have mocked conformance tests for success, malformed output, authentication failure, rate limiting, timeout and cancellation. Registering an adapter must be the only provider-specific change needed by generic Settings and execution flows.
