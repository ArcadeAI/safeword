# Safeword Retro Relay

Private, separately deployable foundation for retry-safe retro filing. It is
not part of the published `safeword` CLI and is not production-routed yet.

The relay accepts the same persisted request identity from Claude, Codex, and
Cursor adapters; stores encrypted request payloads and durable receipts in a
single-host SQLite WAL database; authorizes repository-scoped relay
credentials; and mints GitHub App installation tokens behind the service
boundary.

Raw issue bodies read through GitHub REST are the only marker authority.
Sanitized MCP issue representations are intentionally absent from the service
interface.

Clients do not install or run SQLite. The native SQLite dependency belongs to
this server package and Railway stores its database on the mounted volume. The
CLI persists each sanitized request once as immutable bytes, uses that same
UUID and body from every harness, and gives the relay 750 ms to durably accept
it. A missing response leaves the request retryable; it never authorizes a
second GitHub-native create.

## Production runtime

The production process is `node dist/main.js`. It fails before opening storage
unless every required runtime variable is valid, binds only to
`HOST=0.0.0.0` and Railway's positive `PORT`, and exposes `GET /health`.
Health returns 200 only when the SQLite schema can be read and includes the
non-secret `RAILWAY_REPLICA_ID`.

Run exactly one replica with a persistent volume mounted at `/data` and set
`RELAY_DATA_DIR=/data`. SQLite WAL is intentionally a single-host deployment;
moving to multiple replicas requires replacing the store with PostgreSQL.

Set `RELAY_MODE=production` and provide `RELAY_CREDENTIALS_BASE64` as strict
base64-encoded JSON containing exactly four independently rotatable principals:
Claude, Codex, and Cursor with only the `file` role, plus an operator with only
the `reconcile` and `operate` roles. Every principal is bound to the configured
GitHub App installation and repository. GitHub App credentials and installation
tokens remain server-side. `RELAY_MODE=spike` accepts the legacy single
credential variables but makes every route except `GET /health` unavailable.
The production listener caps filing bodies at 256 KiB, validates bounded fields,
uses ten-second request/header timeouts, and permits 60 filing requests per
principal per minute. These in-process limits match the supported single-replica
topology; a multi-replica deployment must move both storage and rate limiting to
shared infrastructure.

The maintenance loop persists exponential retry scheduling, stops new
dispatches at 24 hours, resolves an already-started dispatch for one additional
hour, then creates an alerted ambiguous tombstone if the outcome is still
unknown. Filed payload envelopes become application-inaccessible after 30 days;
request identity and semantic evidence remain indefinitely. This is an
application-retention promise, not forensic erasure of SQLite pages, WAL files,
or provider backups.

Operators can read payload-free lifecycle counts at
`GET /v1/operations/retro-filings` and reconcile an ambiguous receipt at
`POST /v1/retro-filings/:receiptId/reconcile`. Terminal alerts use stable event
IDs and are delivered at least once, so the downstream alert sink must
deduplicate by event ID.

```sh
bun run --cwd packages/retro-relay test
bun run --cwd packages/retro-relay typecheck
bun run --cwd packages/retro-relay build
```

The implementation remains fail-closed in the published CLI. Production relay
routing cannot be enabled until issues #1474 and #1481 are closed, their commits
are ancestors of fresh collision-measurement evidence, the evidence artifacts
match their recorded hashes, and that evidence is an ancestor of the running
build. Issue #834 is not superseded. Issue #1495 becomes a readiness dependency
only if a later change reuses its client credential helpers; this slice does
not.
