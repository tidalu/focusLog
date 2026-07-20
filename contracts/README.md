# FocusLog Contracts

This directory is the source of truth for platform-neutral REST and event contracts.

- `openapi/focuslog-v1.json` is the complete REST API v1 contract served by the backend.
- `events/focuslog-ws-v1.schema.json` defines every WebSocket v1 frame.
- `json-schema/` contains shared authentication schemas.
- `examples/` contains non-sensitive protocol examples.

Run `pnpm contracts:generate` after changing a source contract. CI runs
`pnpm contracts:check`, which also compares the OpenAPI paths to the actual Fastify
routes and WebSocket message names to the gateway implementation.
