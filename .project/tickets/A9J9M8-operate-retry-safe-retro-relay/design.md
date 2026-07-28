# Design: Operate the retry-safe retro relay

**Related:** [spec.md](./spec.md) ·
[feature source](../../../features/operate-retry-safe-retro-relay.feature) ·
[foundation design](../N30CKR-retry-safe-retro-filing/design.md)

## Boundary

This slice connects the existing relay to the shared `safeword retro` command,
executes its already-resolved lifecycle policy, and makes that lifecycle
operable. It does not change request uniqueness, semantic evidence,
ambiguous-create reconciliation, or raw-REST marker authority.

```text
Claude / Codex / Cursor
          │
          └─ shared safeword retro command
                    │
                    ├─ persist exact request bytes + UUIDv4
                    ├─ acquire fenced file claim
                    └─ drain relay spool (750ms aggregate deadline)
                              │
                              ├─ existing filing service + raw REST GitHub
                              ├─ SQLite lifecycle maintenance
                              └─ authenticated operations route + alerts
```

## Client spool protocol

The existing per-session JSONL spool remains unchanged and continues to
represent the GitHub-native path. Relay mode uses a separate directory of
immutable per-request files:

```text
.safeword/retro-drafts/relay/
  <requestId>.json
  <requestId>.claim.<claimId>.<expiresEpochMs>.json
  <requestId>.ack.json
```

`<requestId>.json` contains the exact UTF-8 JSON request bytes sent over HTTP.
The request ID is UUIDv4 generated with the platform CSPRNG before the atomic
temporary-file-to-final-file rename. Retries read and transmit that file
verbatim. An existing request ID with different bytes is rejected locally.
Because each request owns one immutable file, persisting request B cannot race
with draining request A through a shared-file rewrite.

Claiming is an atomic rename from the primary filename to a filename containing
a random claim ID and expiry. Only the process holding that exact filename may
deliver. Recovery atomically renames an expired claim back to the primary name
and then performs a new claim rename. The old process is fenced: immediately
before acknowledging, releasing, or deleting, it must prove its exact claim
path still exists. Lease renewal, if needed, is another claim-ID-conditional
rename; this slice normally finishes within the short network deadline.

The existence check is not a transactional network fence. If an old owner
receives a valid receipt exactly while takeover renames its claim, its ack is
still safe because the unguessable receipt is request-ID-bound and relay submit
is idempotent for those exact bytes. Both owners may attempt the same request,
but the relay can create at most one issue. Cleanup/release stays conditional on
each owner's exact filename, so an old owner cannot delete its successor's
payload. The takeover race is fault-tested.

`<requestId>.ack.json` is the authoritative local commit record. After a
shape-valid durable receipt, the current owner atomically writes the ack and
then removes its claimed payload as idempotent compaction. Recovery always
deletes any primary or claim payload that has a valid ack and never resubmits
it. Thus crashes before ack retry the exact bytes; crashes after ack merely
repeat cleanup. Tests inject crashes before and after every rename, ack, and
cleanup boundary, including expiry while the old POST remains in flight.

A monotonic 750ms deadline bounds the entire drain, not each request. Every
request receives at most the remaining aggregate budget; untouched drafts stay
durable for the next run. Expired claims are recovered and the directory is
enumerated once before request-specific atomic claims, avoiding an O(n²) scan.
A timeout, connection failure, malformed response, lost response, or lost claim writes no ack. After any relay attempt,
the request remains relay-owned: it is never sent through GitHub-native
fallback because response loss may mean the relay already accepted it.

Delivery reports newly dead-lettered drafts separately from the standing
dead-letter backlog. Only a failure from this drain requests agent fallback; a
historical dead letter does not make the signal permanently sticky.

Routing is fail-closed. A repository-controlled, reviewable readiness manifest
is compiled with `enabled: false` in this slice. Environment variables cannot
override it. A later change may set it true only while recording closed #1474,
closed #1481, and both required measurement artifacts. Until then—including
this branch—the existing filing path is byte-for-byte unchanged and no live
relay request can be sent. Tests exercise relay wiring through an injected
readiness dependency that the public CLI does not expose.

The version-1 manifest schema is:

```typescript
interface RelayReadinessManifest {
  version: 1;
  enabled: boolean;
  evidenceCommit: string;
  reviewedAt: string;
  prerequisites: [
    {
      issue: 1474;
      url: 'https://github.com/ArcadeAI/safeword/issues/1474';
      state: 'closed';
      closedAt: string;
      mergedCommit: string;
    },
    {
      issue: 1481;
      url: 'https://github.com/ArcadeAI/safeword/issues/1481';
      state: 'closed';
      closedAt: string;
      mergedCommit: string;
    },
  ];
  measurements: {
    sameSignatureCollisions: MeasurementArtifact;
    spooledNeverFiled: MeasurementArtifact;
  };
}

interface MeasurementArtifact {
  path: string;
  sha256: string;
  measuredAt: string;
  sampleSize: number;
}
```

Validation requires exact version, issue IDs, and ArcadeAI/safeword issue URLs,
40-hex merged/evidence commits, and proof from the local Git object graph that
each merged commit is an ancestor of `evidenceCommit`. It also requires ISO
timestamps, nonnegative sample sizes, repository-relative artifact paths, and
matching hashes for those artifact blobs at `evidenceCommit`,
measurements taken after both prerequisites closed, and review/measurement
timestamps no older than 30 days at build time. Disabled manifests do not
require fabricated evidence. Enabled malformed, stale, unlanded,
wrong-repository, missing, or hash-mismatched manifests fail closed. Unit tests
prove a valid injected manifest selects relay mode; the checked-in disabled
manifest proves this branch cannot do so.

`evidenceCommit` must be an ancestor of immutable `SAFEWORD_BUILD_COMMIT`,
embedded by the CLI build from `git rev-parse HEAD`; neither value is read from
runtime environment. This avoids a self-referential manifest hash: evidence and
measurement artifacts land first, then a later commit enables the manifest,
then that revision is built. A manifest citing evidence not reachable from the
exact built revision cannot enable the binary.

## Runtime principals

Production supports `RELAY_CREDENTIALS_BASE64`, a strict base64-encoded JSON
array of credential records. Each record has a unique credential ID and secret,
tenant, subject, harness, installation, canonical repository, and roles.
Secrets remain Railway variables rather than arguments or files.

The role matrix is exact:

| Principal | Roles |
| --- | --- |
| Claude, Codex, Cursor | `file` |
| Operator | `reconcile`, `operate` |

Production rejects missing harnesses, duplicate credential IDs, extra roles,
and single-credential variables. The disposable Railway proof may use the
legacy variables only with `RELAY_MODE=spike`; spike mode cannot load an enabled
readiness manifest. The server itself exposes only `/health` in spike mode and
rejects filing, reconciliation, status, and operations before authentication,
durable access, or GitHub access. Non-CLI callers therefore cannot turn spike
compatibility into a filing service.

The registry loads all principals before opening the listener. Harness
principals receive only `file`; the operator receives only `reconcile` and
`operate`. Tests deny every excluded role. Credential rotation is a
configuration replacement: removing one ID invalidates it on restart without
changing any durable request namespace. Repository authorization stays before
database or GitHub access.

GitHub installation tokens are opaque strings. Neither the classic nor dotted
stateless `ghs_` form is parsed, logged, persisted, or returned. This does not
reuse the CLI credential helpers, so #1495 remains a readiness gate only if
that implementation boundary changes.

The headless Claude/Codex extractor receives a constructed minimal environment,
not `process.env`. Relay client secrets, relay server secrets, GitHub App keys,
and installation tokens are excluded. Wiring tests scan child argv,
environment, output, durable files, HTTP responses, logs, and metrics.

## Durable lifecycle

Schema version 2 adds durable scheduling and lifecycle fields rather than
rewriting the version-1 table:

- `dead_lettered_at`
- `tombstoned_at`
- `payload_compacted_at`
- `next_attempt_at`
- `attempt_count`
- `dispatch_started_at`
- `retry_deadline_at` (the client deadline, capped at acceptance plus 24 hours)
- a durable alert outbox keyed by stable `event_id`

The underlying filing state remains unchanged for compatibility; the public
receipt state is projected to `dead-letter` or `tombstone` when those timestamps
exist. Tombstone compaction zeroes the encrypted envelope while retaining
scope, request ID, receipt ID, payload hash, issue number, request marker, and
the non-reusable request identity indefinitely. Compaction cannot change
same-request behavior.

The 30-day promise is an application-access retention boundary, not forensic
secure deletion. At the boundary, normal store/API paths can no longer decrypt
or return the envelope, and a checkpoint is requested; old SQLite pages, volume
snapshots, or operator backups may retain encrypted bytes under their separate
retention policies. Secure deletion would require per-record external key
management and is explicitly not claimed by #1479.

Migration runs under one `BEGIN IMMEDIATE` transaction. It validates exactly
one version row, rebuilds the request table into the constrained version-four
layout while preserving rows and foreign-key references, adds envelope format
and key IDs, preserves version-three envelopes as legacy AAD, and updates the
schema version last. Any fault rolls back the entire transaction. Startup
validates column names, retry-deadline and key-metadata constraints, and every
uncompacted row's decrypt key before opening the listener.

One process-local maintenance timer invokes database-CAS operations:

1. claim accepted/retryable requests only when `next_attempt_at <= now` and
   `now < retry_deadline_at`; increment `attempt_count` and schedule exponential
   backoff of 1m, 2m, 4m … capped at 1h and at the deadline;
2. at `retry_deadline_at`, move unresolved accepted/retryable/claimed requests
   to dead letter and enqueue an alert;
3. permit `beginDispatch` only while `now < retry_deadline_at`; requests already
   dispatching may `markFiled` for one additional hour;
4. one hour after `retry_deadline_at`, CAS unresolved dispatching requests to ambiguous and
   enqueue an alert;
5. at `filed_at + 30d`, compact filed payloads into tombstones.

Every transition is idempotent and clock input is explicit for boundary tests.
The worker has no trusted in-memory schedule; restart simply runs the same
sweep again. The maintenance service operates only on previously authorized
durable scopes and uses the server-held GitHub App collaborator directly; it
does not synthesize a client principal. Every claim/dispatch/file/dead-letter/
ambiguity transition includes the expected prior state and deadline predicate
in one SQLite transaction. Boundary tests race maintenance against a worker at
deadline-minus-epsilon and the exact deadline, including request-marker reconciliation
versus the 25-hour ambiguity CAS.

## Operations and alerts

`GET /v1/operations/retro-filings` requires the `operate` role and returns only:

- counts for accepted/claimed/dispatching/retryable/ambiguous/dead-letter/filed/tombstone;
- oldest queued age in seconds;
- schema version and process boot identity.

The route never returns request payloads, credentials, or tokens. Each terminal
transition inserts one durable outbox event in the same transaction, keyed
deterministically by receipt and terminal state. Delivery to the structured
logger is at-least-once and carries that stable event ID, so an operator or log
sink can deduplicate a crash-after-write retry. The relay never claims
exactly-once delivery to an external logger.

## Existing guarantees retained

The full `retry-safe-retro-filing.feature` lane remains mandatory regression
evidence for:

- concurrent same-request convergence;
- post-create/pre-receipt ambiguity with no second create or acknowledgement;
- request-marker reconciliation using raw REST bodies only;
- sanitized MCP reads having no reconciliation authority.

Those behaviors are not extended or promoted here. Production uniqueness and
live relay routing remain hard-disabled until #1474 and #1481 close and both
required measurements are recorded. The new routing tests prove incomplete
readiness selects the unchanged native path. This ticket does not supersede
GitHub issue #834; the native path stays installed and supported.

## Assessment triggers

- More than one active relay process or any network filesystem → PostgreSQL
  before rollout.
- A one-second client budget causing sustained handoff failure → introduce a
  dedicated accept-only endpoint or queue; do not lengthen Stop-hook latency.
- Claim contention or stale claims above normal crash recovery → move local
  spool delivery into a standalone daemon.
- Reuse of CLI GitHub credential helpers → #1495 becomes a readiness gate.
- #1474 and #1481 closed plus post-fix nonzero collisions → separately review
  whether uniqueness promotion is justified.
