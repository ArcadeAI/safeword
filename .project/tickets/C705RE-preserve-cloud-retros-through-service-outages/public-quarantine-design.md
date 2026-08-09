# Design: Public retro quarantine

**Related:** Feature Spec: `spec.md` | Test Definitions: `test-definitions.md`

## Architecture

The existing Railway relay gets a second, structurally isolated path. Public
`POST /v1/public-retros` validates a fixed v1 envelope, computes a canonical
fingerprint, and stores only an encrypted record in `public_quarantine`. It
cannot construct a filing principal or call `RelayService`. Existing operator
credentials may list, read, and explicitly delete a selected record; none of
these actions can enter the filing worker.

```text
public client -> public HTTP validator -> PublicQuarantineStore -> SQLite
operator token -> operator HTTP routes -> PublicQuarantineStore -> SQLite
private filing -> existing RelayService -> retro_requests -> GitHub
```

## Components

### Component 1: PublicQuarantineStore

**What:** Owns encrypted persistence, capacity, canonical dedupe, and explicit
operator deletion for public records.

**Where:** `packages/retro-relay/src/public-quarantine.ts`

**Interface:**

```ts
accept(input: PublicQuarantineInput): PublicQuarantineAccept;
list(cursor?: string): PublicQuarantineSummary[];
read(receiptId: string): PublicQuarantineRecord | undefined;
delete(receiptId: string): boolean;
```

**Dependencies:** Existing `Database`, `PayloadKeyring`, and encryption helpers.
**Tests:** TBU1.R1/R2, SWM2.R2/R3 store integration tests against real SQLite.

### Component 2: Public HTTP routes

**What:** Separates unauthenticated public submission from authenticated
operator queue access.

**Where:** `packages/retro-relay/src/http-server.ts`

**Interface:** `POST /v1/public-retros`; operator-only list/read/delete routes.

**Dependencies:** `PublicQuarantineStore`, public-ingest configuration, existing
operator authentication.
**Tests:** SWM2.R2 real-listener integration and fault-injection tests.

### Component 3: Local public-intake builder

**What:** Generates and preserves the project UUID, produces the allowlisted
public v1 envelope, and performs one bounded receipt request.

**Where:** `packages/cli/src/retro/` and the config installation path.

**Dependencies:** project config, Git remote reader, existing transport request
identity.
**Tests:** SWM2.R1 and TBU2.R1 CLI/config integration tests. No cloud adapter is
enabled until a provider-specific carrier is proven.

## Data Model

`public_quarantine` is a sibling of `retro_requests`, not a state within it.
Its primary key is `(project_installation_id, repository, request_id)` and it
stores `receipt_id`, canonical `payload_hash`, encrypted envelope fields,
accepted time, and no GitHub state. The canonical hash covers every accepted
public v1 field after sorted-key serialization; semantically equivalent JSON
deduplicates, while any accepted-field mutation returns a conflict. `receipt_id`
is the only operator delete selector.

Read/write policy: public callers may create or deduplicate only; existing
operator credentials may list/read/delete; the filing worker has no method or
table query for this entity. Capacity is checked with insertion in one existing
single-connection `BEGIN IMMEDIATE` transaction. A queue record remains until
an operator explicitly deletes it after using it.

## Component Interaction

1. The client generates a request UUID before payload construction and builds
   the allowlisted v1 body.
2. The public route validates its public format key, body, and global limiter.
   Existing-key dedupe runs before limiting and capacity checks.
3. `PublicQuarantineStore` encrypts and commits the record before a receipt is
   returned.
4. An operator later reads/export-copies the decrypted record and may delete it
   by receipt to recover capacity.

## User Flow

1. A builder installs Safe Word; config gets a UUID with no relay call.
2. A future proven cloud carrier sends one bounded public envelope at completion.
3. Success returns a receipt invisibly; timeout or rejection adds no task text.
4. A maintainer uses the operator API to inspect/export and, when appropriate,
   delete records.

## Key Decisions

### Separate quarantine table

**What:** A new public-only table/store rather than `retro_requests`.
**Why:** It makes GitHub filing structurally unreachable from unauthenticated
input while reusing the existing SQLite durability and keyring.
**Trade-off:** One small additional migration and store surface.

### Canonical public v1 fingerprint

**What:** Sorted-key serialization of the complete validated public envelope.
**Why:** It makes duplicate and mutation behavior independent of raw JSON key
order while binding every persisted field.
**Trade-off:** A v1 schema is a compatibility boundary; future fields require a
new version rather than a silent shape change.

### Manual, operator-only capacity recovery

**What:** Explicit delete by selected receipt; no TTL or automatic eviction.
**Why:** Low volume favors preserving data until a maintainer has inspected it,
while still providing in-band recovery from a full queue.
**Trade-off:** Public IDs and the public key do not prevent abuse; global rate
limiting and alerts buy response time rather than provide strong admission.

## Implementation Notes

**Constraints:** The 50 ms profile budget is inside the 500 ms total deadline;
only remaining time is available to the HTTP request. All provider routes remain
disabled pending live carrier evidence.

**Error handling:** malformed/oversize/key failures return no receipt; a
payload mutation returns an explicit conflict; a disconnect after commit retries
to the same receipt. Missing remote skips handoff locally.

**References:** [Node `DatabaseSync` documentation](https://nodejs.org/api/sqlite.html)
confirms the relay's single synchronous connection model, which makes the
existing transaction boundary the capacity/dedupe serialization point.
