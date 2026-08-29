# Impl Plan: Deliver every eligible local retro finding in one bounded batch

**Status:** planned
**Planned on:** 2026-08-29

## Approach

The riskiest assumption is that one serializer can produce bytes accepted unchanged by both the local size guard and the real collector. Author that failing shipped-carrier-to-real-intake integration proof first; it turns green after the client and collector slices land.

Build order:

1. Add failing delivery and collector tests for a strict v2 envelope (`version`, ordered string `findings`, `source`, `sessionScope`), including one/many/zero findings and exact 65,536/65,537-byte boundaries for v2 and released v1. Unit tests cover deterministic serialization; `packages/retro-collector/tests/public-retro.integration.test.ts` pins both versions at the collector limit; the existing lifecycle integration test covers Claude, Codex, Cursor, the real HTTP client, intake, SQLite, and operator readback.
2. Keep `prepareEncounters` as the validity partition: it drops invalid raw findings and returns valid normalized `findings` in extraction order. Pass that complete array to a generalized public delivery function. A command test proves valid-invalid-valid input emits exactly the two valid sanitized strings in original order; all-invalid emits nothing. Build the canonical bytes once, claim one session marker/request ID, make one bounded attempt, and leave private spooling untouched. The existing lifecycle opt-out assertion remains and is expanded to the batch fixture, proving zero requests and intact private recovery. Fault-injection tests separately cover refusal, timeout, rejection, malformed response, duplicate, and conflict without retries or output.
3. Extend the collector parser to accept released v1 or exact v2, requiring a non-empty v2 `findings` array of non-empty strings and rejecting unknown fields, mixed versions, or non-string entries. Both versions retain the released `source` allowlist and the existing `sessionScope`, derived client-side from harness + project UUID + session identity; therefore v1 and v2 for the same session collide in the same store scope. Keep the raw request BLOB as stored authority. Store tests prove same-scope identical bytes reuse the receipt even with a new request ID, unequal bytes conflict, and distinct scopes remain distinct.
4. Update the real-collaborator lifecycle assertion to inspect every ordered batch finding and update `ARCHITECTURE.md` to document v1/v2 intake and raw-byte replay. Merge deploys the collector change to Railway from `main` before any later tagged CLI release can publish v2-emitting clients; locally built clients during that brief deploy window may be silently rejected but retain private recovery by contract. Then run targeted tests, the full repository verification, audit, quality review, and refactor gates.

Surface proof: the lifecycle outline covers Claude Code, Codex, and Cursor installed carriers; public-delivery unit/integration tests cover the SafeWord CLI shared carrier; collector integration tests cover the Railway public collector. TBU diagnostics are explicitly out of scope in `spec.md`.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://opentelemetry.io/docs/specs/otel/protocol/exporter/ | 2026-08-29 | Stable OTLP exporter specification | SafeWord 0.81.x | Defines maximum request-size and timeout controls for a batch export | Measure the whole serialized request and bound the export wait | Design evidence only; its retry policy is not borrowed; ticket scope independently requires no new retries or dependencies |
| https://sqlite.org/lang_conflict.html | 2026-08-29 | SQLite documentation updated 2025-11-22 | Node 24 `node:sqlite` | Documents transaction and uniqueness conflict behavior used by the current durable store | Keep the database uniqueness boundary and resolve replay by reading authoritative stored bytes | SQLite-specific behavior; no copied code or new license obligation |

**Decision impact:** changed: replace the v1 single-finding client envelope with a strict v2 ordered batch while retaining the existing bounded one-attempt transport and SQLite store.
**Decision informed:** Serialize one strict v2 batch once and compare stored raw bytes within session scope.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Serialize one strict v2 batch once and compare stored raw bytes within session scope. | `{version:"v2", findings:[...], source, sessionScope}`; the exact bytes drive size, transport, storage, replay, and conflict. | Concatenate findings into v1; send an array of repeated v1 envelopes. | Concatenation loses structure; repeated v1 metadata bloats the request and creates multiple identity interpretations. |
| Preserve the existing SQLite schema and transaction. | On a scope collision, compare the stored BLOB: equal returns the stored receipt; unequal throws conflict. | Add a body hash/index or migrate to one row per finding. | The body is already bounded to 65,536 bytes and authoritative; another digest or table adds no correctness value for this volume. |
| Keep one best-effort public attempt after private spooling. | Reuse the existing deadline, abort signal, marker, HTTPS transport, and silent error boundary. | Queue, retry loop, background worker, or new carrier. | Explicitly out of scope and unnecessary for the local exactly-one suppression defect. |

Figure It Out evidence: the chosen design is correct because the same canonical bytes cross every boundary; elegant because it changes only the envelope cardinality and scope-collision comparison; and smallest because it adds no dependency or migration. Premortem: failure would most likely come from client and collector serializers drifting, mitigated by the real client-to-intake byte-identical integration test.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Delivery remains silent, bounded, opt-out aware, and unable to consume private recovery. | `packages/cli/src/retro/public-delivery.test.ts`; `packages/cli/tests/integration/public-retro-lifecycle.test.ts` | |
| 1. Structure enforces; instructions suggest | One typed v2 builder owns ordering, exact fields, byte measurement, and transport bytes. | `packages/cli/tests/integration/public-retro-lifecycle.test.ts` proves emitted bytes survive the real intake unchanged. | |
| 3. Add, never replace | Released v1 intake remains accepted while v2 is added. | `packages/retro-collector/tests/public-retro.integration.test.ts` | |
| 5. Correct and safe; then clear; then simple | Reuse the existing transport, bounded body, SQLite row, and raw BLOB instead of adding infrastructure. | Delivery, collector integration, and store tests prove the reused boundaries together. | |

Architecture record: `ARCHITECTURE.md` already assigns credential-free intake to `packages/retro-collector/`; no conflicting ADR is recorded and no new structural decision warrants one.

## Known deviations

skip: no deviations planned

## Doc impact

Update the maintainer-facing `ARCHITECTURE.md` public retrospective collector boundary from v1-only intake to released v1 plus strict v2 ordered batches, including same-scope raw-byte replay semantics. Customer README and website docs remain unchanged because the transport is intentionally invisible and exposes no new user control.

## Assessment triggers

Revisit the raw-BLOB comparison only if the request limit grows enough to make bounded byte comparison material, concurrency evidence defeats the existing SQLite transaction/unique scope boundary, or another public envelope version needs different same-scope semantics. Revisit v1 acceptance only after production evidence shows no released v1 traffic for an explicitly agreed compatibility window. Revisit the one-attempt carrier only in the separately scoped cloud-carrier work.
