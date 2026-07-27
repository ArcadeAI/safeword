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

## Production runtime

The production process is `node dist/main.js`. It fails before opening storage
unless every required runtime variable is valid, binds only to
`HOST=0.0.0.0` and Railway's positive `PORT`, and exposes `GET /health`.
Health returns 200 only when the SQLite schema can be read and includes the
non-secret `RAILWAY_REPLICA_ID`.

Run exactly one replica with a persistent volume mounted at `/data` and set
`RELAY_DATA_DIR=/data`. SQLite WAL is intentionally a single-host deployment;
moving to multiple replicas requires replacing the store with PostgreSQL.

```sh
bun run --cwd packages/retro-relay test
bun run --cwd packages/retro-relay typecheck
bun run --cwd packages/retro-relay build
```

The package currently proves the relay boundary, production composition root,
and fault behavior. Real harness spool routing, the timed
retry/dead-letter/compaction worker, and fallback retirement remain rollout
gates tracked by GitHub issue #1479.
