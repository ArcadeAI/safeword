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

Clients do not install or run SQLite. The relay uses Node's built-in SQLite
runtime, so neither users nor server operators install SQLite separately;
Railway stores its database on the mounted volume. The
CLI persists each sanitized request once as immutable bytes, uses that same
UUID and body from every harness, and gives the entire spool drain a 750 ms
budget while reserving a complete 500 ms budget before starting each attempt.
A missing response leaves the request retryable; it never authorizes a second
GitHub-native create.

## Production runtime

The production process is `node dist/main.js`. It fails before opening storage
unless every required runtime variable is valid, binds only to
`HOST=0.0.0.0` and Railway's positive `PORT`, and exposes `GET /health`.
Health returns 200 only when the SQLite schema can be read and includes the
non-secret `RAILWAY_REPLICA_ID`.

Run exactly one replica with a persistent volume mounted at `/data` and set
`RELAY_DATA_DIR=/data`. SQLite WAL is intentionally a single-host deployment;
moving to multiple replicas requires replacing the store with PostgreSQL.
Railway mounts volumes as root. The container entrypoint therefore starts as
root only long enough to create and migrate ownership of the mounted data
directory, then execs the Node process as the image's unprivileged `node` user.
Do not replace the entrypoint with a bare `USER node`: it cannot write a fresh
Railway volume.
The runtime image resolves its exact `gosu` package from a dated Debian
snapshot, so the pinned package cannot disappear when the mutable Bookworm
archive rotates.

Node 22 documents `node:sqlite` as active development and Node 24 documents it
as release candidate. The relay keeps the API behind `src/sqlite.ts`, qualifies
the built artifact on the deployed runtime, and may emit Node's experimental
SQLite warning on supported Node 22 releases.

Set `RELAY_MODE=production` and provide `RELAY_CREDENTIALS_BASE64` as strict
base64-encoded JSON containing exactly four independently rotatable principals:
Claude, Codex, and Cursor with only the `file` role, plus an operator with only
the `reconcile` and `operate` roles. Every principal is bound to the configured
GitHub App installation and repository. GitHub App credentials and installation
tokens remain server-side. `RELAY_MODE=spike` accepts the legacy single
credential variables but makes every route except `GET /health` unavailable.
The production listener caps filing bodies at 256 KiB, validates bounded fields
and UUIDv4 request identities, uses ten-second inbound and GitHub deadlines,
bounds concurrent GitHub work, and permits 60 authenticated API requests per
principal per minute, including filing, reconciliation, recovery, status, and
operations reads. These in-process limits match the supported
single-replica topology; a multi-replica deployment must move both storage and
rate limiting to shared infrastructure.

`RELAY_PAYLOAD_KEY` remains the single-key compatibility form. For rotation,
set `RELAY_PAYLOAD_KEYRING_BASE64` to strict base64-encoded JSON:

```json
{
  "activeKeyId": "2026-07",
  "keys": {
    "2026-06": "<32-byte key in strict base64>",
    "2026-07": "<32-byte key in strict base64>"
  }
}
```

New envelopes use `activeKeyId`; retained keys decrypt older queued envelopes.
Databases migrated from schema v3 identify their former encryption key as
`legacy`, so the first configured keyring must retain that key under the
`legacy` ID.
Never remove a key while an uncompacted database row references it. Startup
fails with the exact missing key IDs instead of letting queued requests churn
to dead letter.

The maintenance loop persists exponential retry scheduling against the
client-supplied absolute deadline (capped at 24 hours after acceptance), stops
new dispatches at that deadline, resolves an already-started dispatch for one
additional hour, then creates an alerted ambiguous record if the outcome is
still unknown. Filed and rejected payload envelopes become application-inaccessible
after 30 days; request identity remains non-reusable indefinitely. This is an
application-retention promise, not forensic erasure of SQLite pages, WAL files,
or provider backups.

Operators can read payload-free lifecycle counts at
`GET /v1/operations/retro-filings` and reconcile an ambiguous receipt at
`POST /v1/retro-filings/:receiptId/reconcile`. If a fresh complete raw scan has
zero matches, an operator may explicitly invoke recovery for either an
ambiguous receipt or a deadline dead letter at
`POST /v1/retro-filings/:receiptId/recover`; the relay serializes recovery,
reuses the encrypted original payload and reserved marker, and audit-records
the create. Harness credentials cannot invoke this route. Terminal alerts use stable event
IDs and are emitted at least once to the configured alert callback, so an
acknowledged downstream sink must deduplicate by event ID. The default stdout
callback is observable operational output, not proof that an external sink
persisted the event.

The manual CLI recovery command uses
`SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL` only when an expired local dead
letter already has an ambiguous or dead-letter receipt on the server. Normal
filing continues to use the harness-scoped
`SAFEWORD_RETRO_RELAY_CREDENTIAL`; the operator credential is never used by an
automatic retry or headless extractor.

An externally edited issue whose raw body no longer contains the exact request,
canonical, and legacy markers remains ambiguous. The relay never treats a
sanitized read or a lone request marker as duplicate authority. An operator
must inspect the raw REST body and either restore the two authority markers
before reconciling or resolve the conflicting issue manually; automatic
recovery will not create a second issue around that conflict.

Acknowledged local source reservations are compact identity tombstones and are
retained indefinitely so the same source cannot receive a fresh request ID.
The CLI first makes a new reservation's exact request bytes durable as a
claimable `*.materializing.json` state. Delivery may claim that state directly,
so concurrent first persistence and a crash between reservation and delivery
converge on one request identity without recreating a primary file.
Normal draft persistence does not scan those tombstones; it consults active
reservations only when isolating a corrupt durable record. Back up and restore
the entire `.safeword/retro-drafts/relay` directory as one unit. Selective or
partial restoration of individual spool files is outside the durability
contract.

If one durable identity is corrupt, inspect it first and then explicitly remove
only that identity with
`safeword retro-relay-discard <request-id> --confirm`. The command also removes
the matching active source reservation, never deletes acknowledged tombstones
or unrelated records, refuses identities owned by delivery/recovery, and writes
a non-expiring discard intent before its final foreign-owner check. Producers
and claims fail closed on that intent; recovery completes it only when no
foreign claim remains. Each intent is its own unique-token filename:
cancellation removes only that exact token, while terminal commit hard-links it
to the indefinite request tombstone. Concurrent discards therefore converge
without a shared alias, expiring lease, or ABA. A separate indefinite
source-acknowledgement file makes acknowledgement win even if discard
snapshotted the former active reservation filename. Discard is intentionally
irreversible.

Installation-token requests for the same repository scope are coalesced.
Ambiguous-create reconciliation uses raw REST bodies only and stops at both the
configured overall deadline and page budget; an incomplete scan never
authorizes a duplicate decision. Defaults are 30 seconds and 200 pages (up to
20,000 items only when latency permits). Operators may raise the fail-closed
ceilings with positive integer `RELAY_RECONCILIATION_TIMEOUT_MS` and
`RELAY_RECONCILIATION_MAX_PAGES` values.

```sh
bun run --cwd packages/retro-relay test
bun run --cwd packages/retro-relay typecheck
bun run --cwd packages/retro-relay build
```

The implementation remains fail-closed in the published CLI. Production relay
routing cannot be enabled until issues #1474 and #1481 are closed, their commits
are ancestors of fresh collision-measurement evidence, the evidence artifacts
match their recorded hashes, and that evidence is an ancestor of the running
build. Semantic marker adoption and cross-request aliasing are deliberately
deferred until that gate is satisfied. Issue #834 is not superseded. GitHub
issue #1495 becomes a readiness dependency
only if a later change reuses its client credential helpers; this slice does
not.
