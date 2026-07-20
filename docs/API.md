# FocusLog Backend API

## Base URL and documentation

All product endpoints are versioned under `/api/v1`. Runtime OpenAPI documentation is available at `/documentation`; its machine-readable document is `/documentation/json`.

## Device authentication

FocusLog has no user login or bearer token. After pairing, each request supplies:

- `x-focuslog-device-id`
- `x-focuslog-timestamp` (UTC RFC 3339)
- `x-focuslog-nonce` (single-use)
- `x-focuslog-signature` (base64url Ed25519 signature)

The signature is made over `METHOD`, request URL, timestamp, nonce, and the SHA-256 hash of the JSON request body, joined by newlines. The server rejects invalid, expired, replayed, revoked, and non-active device requests.

Bootstrap and candidate-pairing routes instead require proof of possession of the submitted public key. Pairing approval requires a signed owner-device request.

## Endpoint groups

| Group           | Routes                                                    |
| --------------- | --------------------------------------------------------- |
| Health          | `GET /health`, `GET /health/live`, `GET /health/ready`    |
| Devices         | bootstrap, pairing request/approval/consume, list, revoke |
| Focus modes     | list, create, update, tombstone delete                    |
| Focus sessions  | list, create, update                                      |
| Reminders       | list occurrences, append lifecycle transition             |
| Check-ins       | list, create, tombstone delete                            |
| Synchronization | operation push and cursor pull                            |
| Reports         | daily aggregate over explicit UTC bounds                  |
| Backups         | create/list encrypted-backup manifests                    |

All input is validated with Zod. Errors use `{ "error": { "code", "message", "details" } }`, never expose an internal stack trace, and are logged as structured redacted events.

## Transport and operational controls

TLS terminates at the deployment reverse proxy. Set `REQUIRE_TLS=true` in production so the backend rejects requests not marked HTTPS by the trusted proxy. Fastify Helmet applies security headers and rate limiting is global with stricter limits on bootstrap/pairing endpoints.
