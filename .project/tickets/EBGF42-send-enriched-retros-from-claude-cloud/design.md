# Design: Send enriched retros from Claude Cloud

**Guide:** `.safeword/guides/design-doc-guide.md`
**Related:** Feature Spec: `spec.md` | Test Definitions: `test-definitions.md`

## Architecture

Extend the existing public-retro path in place. The CLI converts all sanitized
findings for one session into one deterministic v2 body. The existing HTTP
client posts those exact bytes to the existing route. The collector accepts
exact v1 or v2 shapes and gives the unchanged SQLite store the raw body and
session scope.

Claude's installed Stop carrier remains the only new entry point. The route
resolver binds its source to `claude-code` / `cloud` only when
`CLAUDE_CODE_REMOTE` is exactly `true` and
`CLAUDE_CODE_REMOTE_SESSION_ID` is non-empty. The resolver fails closed for a
partial or malformed pair and for `GITHUB_ACTIONS=true` regardless of the pair;
both absent otherwise retains local Claude's `unknown` host class. Generic CI variables never enable
cloud delivery. No payload field, new service, or new credential participates.

```text
Claude Stop → retro extraction → ordered sanitized findings → v2 builder
            → existing HTTP client → v1 route / v1-or-v2 parser → raw-byte store
```

## Components

### Component 1: Public retro builder

**What:** Builds and claims one bounded deterministic request per session.
**Where:** `packages/cli/src/retro/public-delivery.ts`
**Interface:**

```typescript
interface PublicRetroEnvelopeInput {
  findings: Finding[];
  source: PublicRetroSource;
  sessionId: string;
}

function buildPublicRetroEnvelope(input: PublicRetroEnvelopeInput): BuiltPublicRetroEnvelope;
```

**Dependencies:** Existing sanitizer/renderer, SHA-256 session scope, fixed-shape
`JSON.stringify`, and attempt marker.
**Tests:** Cardinality, byte boundary, byte identity, session scope, request and
receipt correlation.

### Component 2: Retro command and carrier route

**What:** Hands every sanitized finding to the shared builder and binds native
host provenance.
**Where:** `packages/cli/src/commands/retro.ts`,
`packages/cli/src/retro/public-source.ts`, existing Stop hook tests.
**Interface:**

```typescript
function resolvePublicRetroRoute(input: RouteInput): PublicRetroRoute | undefined;
function deliverSanitizedPublicRetroFindings(input: BatchInput, deps: DeliveryDeps): Promise<Outcome>;
```

**Dependencies:** Claude Code 2.1.226's documented `CLAUDE_CODE_REMOTE` and
`CLAUDE_CODE_REMOTE_SESSION_ID` signals, project config,
existing source allowlist, real HTTP client.
**Tests:** Claude cloud/local discrimination, payload and CI spoof resistance,
unsupported hosts, eligibility, opt-out, silence, recovery.

### Component 3: Collector parser and raw-byte store

**What:** Accepts exact v1/v2 envelope shapes without changing stored bytes or
schema; returns the existing receipt for equal bytes under an existing session
scope.
**Where:** `packages/retro-collector/src/index.ts`,
`packages/retro-collector/src/store.ts`
**Interface:**

```typescript
type PublicRetroEnvelope = PublicRetroEnvelopeV1 | PublicRetroEnvelopeV2;
accept(requestId: string, sessionScope: string, rawBody: Uint8Array): AcceptedPublicRetro;
```

**Dependencies:** Node SQLite and existing receipt generation.
**Tests:** Released v1 raw fixture, v2 parser, exact field sets, same-scope equal
bytes, same-scope unequal bytes, packaged collector round trip.

## Data Model

```typescript
interface PublicRetroEnvelopeV1 {
  version: 'v1';
  finding: string;
  source: PublicRetroSource;
  sessionScope: string;
}

interface PublicRetroEnvelopeV2 {
  version: 'v2';
  findings: [string, ...string[]];
  source: PublicRetroSource;
  sessionScope: string;
}
```

The SQLite schema does not change. One row still owns `request_id`,
`session_scope`, raw bytes, and receipt. A second request with the same scope
and identical bytes returns that row's receipt; different bytes remain a
conflict. The response echoes the current transport request ID so the existing
client can correlate the attempt, while the durable receipt remains stable.

## Component Interaction

1. Stop carrier resolves eligibility and native host identity.
2. Retro extraction produces sanitized findings in stable extraction order.
3. Builder constructs the v2 object once, encodes once, enforces 65,536 bytes,
   and claims the local attempt marker.
4. HTTP client sends the same `Uint8Array`; it never parses or reserializes it.
5. Collector validates the raw parsed shape, then stores or deduplicates using
   the original bytes.
6. Receipt preservation and private recovery continue independently.

## User Flow

1. A meaningful local or Claude Cloud session ends.
2. SafeWord silently extracts zero or more valid findings.
3. Zero findings or an oversized body make no public attempt; otherwise one
   bounded batch is sent.
4. The user sees no output or setup. Operators can later inspect the durable
   quarantine receipt with their existing credential.

## Key Decisions

### Decision 1: Version the body, not the transport

**What:** Keep `/v1/public-retros`; accept v1 and v2 bodies; emit v2 from updated
clients.
**Why:** Transport, isolation, authentication, storage, and receipts do not
change.
**Trade-off:** The URL major and body schema version differ, so exact parser
tests and architecture docs must make the distinction explicit.

### Decision 2: Deduplicate equal raw bytes by session scope

**What:** An existing scope plus byte-equal body returns the existing receipt.
**Why:** Local attempt state disappears when cloud workspaces are reclaimed;
raw REST bytes remain the canonical duplicate authority.
**Trade-off:** Any source-field nondeterminism correctly becomes a conflict
rather than semantic dedupe.

## Implementation Notes

**Constraints:** No dependency or schema migration; one request; existing
65,536-byte and deadline limits; exact source allowlist; v1 remains accepted.

**Error handling:** Validation, timeout, conflict, and receipt failures remain
silent best-effort abandonment. No retries are added. Private recovery is never
consumed by public acceptance or failure.

**Gotchas:** Request ID is a transport correlation header and must not enter the
body. Build source and envelope objects in one fixed order. Never make duplicate
decisions from sanitized operator/MCP reads.

**Open questions:** None.

## References

- `ARCHITECTURE.md` — Public Retro boundary
- https://tc39.es/ecma262/2025/multipage/#sec-json.stringify
- https://opentelemetry.io/docs/specs/otel/trace/sdk/
