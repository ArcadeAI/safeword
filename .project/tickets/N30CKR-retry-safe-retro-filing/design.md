# Design: Retry-safe retro relay foundation

**Related:** [GitHub #1479](https://github.com/ArcadeAI/safeword/issues/1479)
· [feature source](../../../features/retry-safe-retro-filing.feature)
· [test ledger](./test-definitions.md)

## Slice boundary

This ticket builds a separately deployable relay package, its three named
harness adapters, and production-shaped contract/fault tests. It does not
deploy the relay or replace current harness filing instructions. GitHub #1479
stays open until shadowing, deployment, real spool routing, and fallback
retirement complete.

## Runtime and components

`packages/retro-relay` is a Node 22 service package, separate from the
published CLI. It uses `better-sqlite3` 13.0.1 on the repository's exact minimum
Node 22.22.3 runtime; it does not use experimental `node:sqlite`.

```text
named harness adapter → HTTP client → authenticated relay route
                                      │
                                      ├─ filing service → SQLite WAL store
                                      └─ GitHub collaborator → raw REST API
```

The integration harness starts the real HTTP server, auth registry, service,
two independent database connections, and file-backed store. Only GitHub HTTP
and the deterministic clock are test boundaries.

## Request, principal, and identity

```typescript
interface FileRetroDraftRequest {
  requestId: string;
  installationId: number;
  repository: string; // canonical lowercase owner/repo after validation
  canonicalKey: string;
  legacySignature: string;
  title: string;
  body: string;
  labels: string[];
}

interface Principal {
  tenantId: string;
  credentialId: string;
  subject: string;
  harness: 'claude' | 'cursor' | 'codex';
  repositories: Array<{ installationId: number; repository: string }>;
}
```

The primary key is `(tenant_id, installation_id, repository, request_id)`.
Harness and subject are audit fields, never identity fields. The versioned
payload hash covers canonical repository, semantic evidence, exact title/body,
and sorted unique labels. The stored hash version prevents later normalization
changes from reinterpreting tombstones.

The full request payload is necessary after a restart, so it is durably stored
as an AES-256-GCM envelope (`key_id`, random nonce, ciphertext, authentication
tag) under a deployment-held payload key. The database never stores plaintext
title or body. Associated data binds the envelope to the full primary key and
payload-hash version. Decryption or key lookup failure fails closed before
dispatch. Compaction deletes the envelope while retaining identity, versioned
hash, and issue receipt in the indefinite tombstone.

Named Claude/Cursor/Codex adapters all accept a persisted request object; they
cannot generate or replace `requestId`. Their public `file()` call POSTs the
same body, then follows the receipt status endpoint until a terminal caller
outcome. A 202 response never acknowledges a spool.

## Durable schema and concurrency

SQLite runs `journal_mode=WAL`, `synchronous=FULL`, `foreign_keys=ON`, a five
second busy timeout, STRICT tables, and a schema-version migration transaction.
The request primary key and exact semantic-evidence unique index are database
constraints. `BEGIN IMMEDIATE` plus compare-and-swap transitions elects one
creator across independent connections. `SQLITE_BUSY` within the bounded busy
timeout becomes a retryable relay result; uniqueness is never weakened.

The supported topology is one active relay process on one host. A process lock
prevents a second server from opening the production database. Tests open two
connections inside that process to prove database-level election rather than
event-loop serialization. A second active host or network filesystem requires
the store interface to move to PostgreSQL before deployment; SQLite documents
that WAL is same-host only.

## Slice state contract

```text
accepted → claimed → dispatching → filed
    │          │           │
    │          │           └─ uncertain response/restart → ambiguous → filed
    └───────────┴─ confirmed pre-dispatch failure → retryable → claimed
```

- Token acquisition and request construction happen in `claimed`. A confirmed
  failure there is pre-dispatch and may become `retryable`.
- Immediately before calling `fetch`, the relay durably enters `dispatching`.
  A crash in the tiny update→fetch window is conservatively ambiguous; safety
  wins over automatic delivery.
- Service-open recovery in this slice changes persisted `claimed` to
  `retryable` and persisted
  `dispatching` to `ambiguous`. A known issue number always wins: the receipt
  CAS from `dispatching|ambiguous` to `filed` is allowed after recovery.

| Source | Event / guard | Destination | CAS loser behavior |
| --- | --- | --- | --- |
| absent | durable submit | accepted | load existing row and compare payload hash |
| accepted or retryable | creator claim | claimed | return 202 receipt and poll status |
| claimed | credential/request preparation fails before dispatch commit | retryable | reload receipt |
| claimed | dispatch boundary commits | dispatching | reload receipt |
| dispatching or ambiguous | durable GitHub issue number is known | filed | return stored filed receipt |
| dispatching | response missing or process reopens | ambiguous | never dispatch again |
| ambiguous | admin raw-marker verification finds exactly one issue | filed | return stored filed receipt |

## Destination maintenance policy (resolved, not implemented in this slice)

A later `maintenance worker` owns periodic database sweeps. One process-local
timer wakes it; every transition is a database CAS, so shutdown/restart is
harmless and no timer state is trusted. Minimal service-open recovery of
`claimed` and `dispatching` is part of this slice because crash safety depends
on it; the worker later reuses the same idempotent recovery transaction.

- Server-persisted `accepted_at` derives
  `retry_deadline_at = accepted_at + 24h` and `grace_until = accepted_at + 25h`.
- At `now >= retry_deadline_at`, `accepted|retryable|claimed` becomes alerted
  `dead-letter`; creator claims require `now < retry_deadline_at`.
- A dispatch committed before the deadline may persist a known issue through
  `now < grace_until`. At `now >= grace_until`, unresolved `dispatching`
  becomes `ambiguous`. A known issue-number CAS wins and may move
  `ambiguous → filed`.
- `filed_at` is resolution time. At `now >= filed_at + 30d`, compaction CASes
  `filed → tombstone` and removes approved payload/evidence. A concurrent retry
  sees either state; same hash returns the issue and different hash is 409.
- `ambiguous` and unresolved `dead-letter` are never compacted. Tombstones are
  indefinite and non-reusable.

The maintenance slice must test deadline−ε/deadline, grace−ε/grace,
compaction−ε/compaction, and interleaved issue-number/ambiguity CAS races.

## Ambiguous and legacy reconciliation

The create body contains one reserved request marker. Its digest input is
versioned, length-prefixed UTF-8 fields—not concatenated strings:

```text
<!-- safeword-retro-request-v1: <sha256(canonical-v1 fields)> -->
```

`canonical-v1 fields`, in order, are the literal version `1`, tenant ID,
decimal installation ID, canonical lowercase `owner/repo`, and request ID.
Each field is encoded as an unsigned 32-bit big-endian byte length followed by
its UTF-8 bytes. The marker is exact, case-sensitive, and occupies its own line.

The parser exact-matches this grammar in raw Markdown. Reconciliation uses only
GitHub REST with `application/vnd.github.raw+json`, `state=all`, complete
pagination, and pull-request filtering.

- zero request-marker matches: remain ambiguous and alert;
- one: fetch that issue raw, re-verify marker and repository, then CAS to filed;
- multiple: remain ambiguous and alert.

For migration, canonical and legacy markers use the local source-of-truth
grammars already emitted by `packages/cli/src/retro/draft.ts`:
`<!-- safeword-retro-canonical: <canonicalSignature> -->` and
`<!-- safeword-retro-signature: <signature> -->`. The relay imports a shared
parser/formatter extracted from that module so the grammar is not duplicated.
A complete scan with one match atomically registers the semantic evidence and
adopts it. Scan failure, incomplete pagination, or multiple matches is
retryable and cannot authorize creation. A complete zero-match scan may create
only after the semantic-evidence reservation commits; concurrent different
requestIds sharing the evidence converge on that reservation. Different
semantic identities remain allowed to create different issues, per #1479's
explicit non-goal.

If canonical and legacy evidence resolve to different issues, or the evidence
reservation owner is ambiguous, the request is quarantined and alerted. No
precedence guess or create is allowed. An operator with the scoped `reconcile`
role invokes `POST /v1/retro-filings/{requestId}/reconcile`. Zero/multiple/
conflicting matches remain quarantined. For a true zero-match dispatch-window
case, the safe resolution is to manually create the reserved-marker issue and
re-run reconciliation; no fresh requestId escapes the durable record.

Sanitized MCP reads are absent from the service interface. Test fixtures may
provide an MCP representation only to prove it has no effect. Neither marker
presence nor absence there can authorize or suppress creation.

## HTTP and endpoint authorization

| Endpoint | Caller | Scope behavior |
| --- | --- | --- |
| `POST /v1/retro-filings` | active harness credential | authorize installation/repository before DB or token access |
| `GET /v1/retro-filings/{receiptId}` | active harness credential | opaque locator plus row-scope authorization; wrong scope is non-enumerating 404 |
| `POST /v1/retro-filings/{receiptId}/reconcile` | active operator credential with `reconcile` role | opaque locator plus row-scope authorization; every disposition is audit-recorded |

POST returns 201 for `filed|existing`, 202 with `Retry-After` for nonterminal
receipts, 409 for mismatch, 401 for missing/invalid/expired/revoked
authentication, and 403 for a known principal lacking repository permission.
Adapters poll only within a configured call budget; timeout leaves the spool
unacknowledged and returns the latest receipt.

`receiptId` is a random 256-bit URL-safe locator generated at first durable
acceptance and stored under a unique index. It is addressing material, not
request identity: retries still resolve exclusively by the
transport-independent primary key and return the same locator.

## Authentication, authorization, and secrets

Client credentials are `swc_<credential-id>_<256-bit secret>`. Configuration
stores the public credential ID and an HMAC-SHA-256 verifier using a
deployment-held pepper, plus tenant, subject, harness, status, expiry, and
repository ACL. Lookup is by ID; secret verification is constant-time.
Credentials support overlapping rotation windows and immediate revocation.
Rotation/revocation affects new calls; durable receipts remain tenant-owned and
may be read by a later active credential authorized for the same scope.

TLS termination is mandatory at a configured trusted proxy; forwarded identity
headers from other sources are ignored. Repository input must be canonical
`owner/repo`, and the installation-token provider verifies the installation
contains that repository. Authorization happens before database access or token
minting.

GitHub installation tokens are minted server-side with Issues read/write
permission narrowed to the repository, cached below GitHub's one-hour expiry,
invalidated on authentication failure, and treated as opaque. Neither classic
nor stateless `ghs_` formats are parsed. Structured logs, errors, metrics, and
plaintext database columns contain identifiers/dispositions only, never either
credential or issue-body content. The encrypted payload envelope is the sole
durable body representation.

GitHub #1495 is not a code dependency because this package does not reuse the CLI
validator/scrubber. Equivalent secret non-disclosure tests remain a merge gate;
if shared client helpers are introduced, #1495 becomes a readiness gate.

## Destination hardening and decisions

Metrics expose state counts, oldest queue age, busy retries, create latency,
and reconciliation results. Alerts fire on ambiguity, dead-letter, multiple raw
matches, and queue thresholds. Rate limits apply per credential and tenant;
request IDs, payload bytes, title/body, and label counts are bounded before DB
access.

This slice proves credential parsing/verification, repository ACL enforcement,
operator-role enforcement on reconciliation, non-enumerating receipt lookup,
server-side repository-scoped token use, encrypted payload persistence, and
secret-safe durable/log/metric evidence. Trusted-proxy deployment enforcement,
rotation administration, token-cache invalidation, rate limiting, production
input bounds, alert delivery, and dashboard plumbing are resolved destination
requirements but explicitly deferred to rollout hardening. They are not
claimed as verified by this ticket.

The destination policy is 24-hour retry, one-hour dispatch grace, 30-day filed
payload retention, and indefinite tombstones. This slice persists the required
timestamps but does not ship its maintenance worker.

GitHub #834 is the credential-absence problem this boundary is intended to replace.
It is not yet superseded operationally. Closure/supersession requires deployed
relay, all real harnesses routed, and the fallback retired.

## Assessment triggers

- second active host, failover SLO, or network filesystem → PostgreSQL;
- production queue contention or repeated busy timeout → PostgreSQL/queue;
- universal platform OIDC becomes available → replace client credentials
  without changing the principal or identity key;
- GitHub documents conditional issue creation/idempotency → reconsider
  ambiguous recovery only after new contract proof;
- client GitHub credential helpers are reused → #1495 blocks readiness.
