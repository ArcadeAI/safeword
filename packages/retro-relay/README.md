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

Filing clients send `x-safeword-relay-api-version: 1`. A missing header is
accepted as legacy v1; any other value is rejected before the request reaches
the filing service. Version 1 freezes the durable receipt vocabulary to
`accepted`, `claimed`, `dispatching`, `filed`, `ambiguous`, `retryable`,
`dead-letter`, `rejected`, and `tombstone`. Filing clients deliberately do not
acknowledge `ambiguous`; they retain local ownership for explicit
reconciliation. Clients fail closed on unknown states instead of guessing
whether durable ownership transferred.

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

### Recovering an incompatible Railway volume

If startup reports that the SQLite schema is partial or incompatible, leave the
affected volume intact. Do not delete database files or selectively restore
SQLite, WAL, or spool files: the relay's receipts are its duplicate-prevention
authority.

For a health-only `spike`, retain and detach the failed volume, then attach a
[new empty persistent volume](https://docs.railway.com/volumes) at `/data` and
redeploy. Confirm `GET /health` returns 200 and `POST /v1/retro-filings` returns 503. For `production`, do not resume routing on a blank replacement volume.
Keep filing disabled and restore the complete compatible volume (or follow an
explicit, reviewed migration and recovery plan) before allowing requests again.

Node 22 documents `node:sqlite` as active development and Node 24 documents it
as release candidate. The relay keeps the API behind `src/sqlite.ts`, qualifies
the built artifact on the deployed runtime, and may emit Node's experimental
SQLite warning on supported Node 22 releases.

Set `RELAY_MODE=production` and provide `RELAY_CREDENTIALS_BASE64` as strict
base64-encoded JSON containing exactly five independently rotatable principals:
Claude, Codex, and Cursor with only the `file` role, an operator with only
the `reconcile` and `operate` roles, and a collector worker with only the
`ingest` role. Every principal is bound to the configured
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

### Automated deployment

Merges to `main` automatically deploy relevant relay and Docker build inputs
through [the Retro Relay deployment workflow](../../.github/workflows/deploy-retro-relay.yml).
The workflow is intentionally independent of Railway's GitHub integration, so
it is auditable and can also be run manually.

Before enabling it, a repository administrator must configure:

- `RAILWAY_TOKEN` as a GitHub Actions repository secret containing a
  project-scoped Railway token for the production environment;
- `RAILWAY_RETRO_RELAY_PROJECT_ID`, `RAILWAY_RETRO_RELAY_ENVIRONMENT`, and
  `RAILWAY_RETRO_RELAY_SERVICE` as GitHub Actions repository variables.

The workflow validates all four values before invoking Railway and does not
print the token. Deployment configuration stays out of version control; relay
runtime secrets continue to live only in Railway.

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

Relay routing also requires `SAFEWORD_RETRO_RELAY_OUTBOX` to name an absolute
directory outside the disposable project workspace. Local installations can
point every harness at the same user-data directory. A cloud operator must map
that path to storage the cloud platform actually preserves; without such a
mapping the CLI keeps the existing native filing path. The setting is explicit
because another directory on an ephemeral VM is not durable merely because it
sits outside the repository.

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
the entire `$SAFEWORD_RETRO_RELAY_OUTBOX/.safeword/retro-drafts/relay`
directory as one unit. Selective or partial restoration of individual spool
files is outside the durability contract. New files are flushed and every
durable-state entry, link, rename, and unlink is followed by a
containing-directory sync before success is reported. A writer that finds an
existing target also synchronizes that directory before accepting the
concurrent winner. Removing an atomic-write
temporary after its durable target is linked is best-effort cleanup, not a
state transition; a crash may leave that temporary behind, and recovery removes
only relay-owned UUID temporaries older than one minute. The configured outbox
is resolved to its physical path; symlink aliases into the disposable project
are rejected.

If one durable identity is corrupt, inspect it first and then explicitly remove
only that identity with
`safeword retro-relay-discard <request-id> --confirm`. The command compacts the
matching active source reservation into an indefinite discarded-source
tombstone, never deletes acknowledged tombstones or unrelated records, refuses
identities owned by delivery/recovery, and writes a leased discard intent before
its final foreign-owner check. The source tombstone prevents the same source
from acquiring a new request ID after explicit discard. Producers and
claims fail closed on that intent; recovery cancels it around a foreign claim,
leaves an unexpired live owner alone, and completes an expired uncontested
intent. Each intent is its own unique-token filename: cancellation removes only
that exact token, while terminal commit hard-links it to the indefinite request
tombstone. A late owner accepts only an exact matching tombstone as successful
convergence. Concurrent discards therefore converge without a shared alias or
ABA. A separate indefinite source-acknowledgement file makes acknowledgement
win even if discard snapshotted the former active reservation filename.
Acknowledgement removes that redundant active filename, retaining one source
tombstone rather than two permanent copies. Acknowledgement takes precedence
over a concurrent discarded-source tombstone. Discard is intentionally
irreversible and does not authorize a replacement identity.

`safeword retro-relay-retry` with no request ID lists payload-free IDs and
their active, materializing, delivery-claim, dead-letter, or recovery-claim
state. A retry-deadline renewal is compatible only when the request ID, source,
creation time, and approved payload digest remain unchanged. Compatible renewed
bytes reconcile from every durable client state; only a typed invalid-request
response or identity/payload conflict restores the prior bytes, while
authentication, rate-limit, timeout, and server uncertainty preserve the exact
bytes the relay may already have accepted.

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

The implementation remains fail-closed in the published CLI. Issues 1474 and
1481 are now closed on `main`, but production relay routing remains disabled
until their implementation commits are ancestors of fresh measurement
evidence, each versioned metric-specific artifact has a nonempty sample and
matches its recorded hash, and that evidence is an ancestor of the running
build. The required drain-throughput artifact is a regression floor, not a
catch-up guarantee: it must exercise at least 300 queued requests with at least
80 ms relay latency, accept at least two requests in one bounded drain, and
finish that drain in less than one second. Semantic marker adoption and
cross-request aliasing are deliberately deferred until that gate is satisfied.
Produce the drain artifact with
`bun run --cwd packages/cli measure:relay-drain --output <artifact.json>`.
The producer persists 300 real spool requests and drains them through the real
client state machine against an 80 ms fault-injected transport. This is
reproducible client regression evidence, not a production capacity or catch-up
claim; readiness still requires review, hashing, ancestry, and build
attestation of the resulting artifact.
Issue #834 is not superseded. Issue #1495 is also closed, but it would become a
readiness dependency only if a later change reused its client credential
helpers; this slice does not.
