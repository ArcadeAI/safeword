# Design: Attach useful runtime context to retros without signup

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Widen the existing `v1` public-retro `source` authority for Cursor and honest
unknown execution class while preserving released submissions at the collector
boundary. The CLI derives a closed, privacy-bounded
source snapshot before canonical serialization. The collector independently
validates that closed shape, then stores and returns the original request bytes.
No new transport, database entity, telemetry stream, or retry mechanism is
introduced.

```text
runtime facts -> CLI source builder -> canonical v1 envelope
                    -> public collector validator -> existing raw-byte SQLite row
```

## Components

### CLI source builder

**What:** Derives optional runtime facts independently and omits invalid or
unavailable values.

**Where:** `packages/cli/src/retro/public-source.ts`

**Interface:** `buildPublicRetroSource(input): PublicRetroSource`

**Dependencies:** Existing Git-origin reader, process runtime facts, and the
running SafeWord package version.

**Tests:** Source parity, privacy exclusions, byte boundaries, repository
normalization, and partial-reader failures.

### Public delivery composition

**What:** Selects Claude Code, Codex, and Cursor with honest `unknown` execution
class, while
preserving the existing preparation deadline, exclusive session claim, and
recovery lane. Existing `CLAUDE_CODE_REMOTE_SESSION_ID` evidence suppresses only
Claude; it does not suppress Codex or Cursor.

**Where:** `packages/cli/src/commands/retro.ts` and
`packages/cli/src/retro/public-delivery.ts`

**Interface:** Existing `retro run` command and canonical `v1` envelope.

**Dependencies:** CLI source builder and existing public collector client.

**Tests:** Real CLI-to-collector lifecycle, dedupe authority, silence, and fault
injection.

### Collector validation boundary

**What:** Validates one closed harness/host-class matrix: `local` only for
Claude Code and Codex envelopes, and `unknown` for Claude Code, Codex,
and Cursor. It retains released source-value rules, rejects unknown or malformed
shapes, and preserves accepted bytes unchanged.

**Where:** `packages/retro-collector/src/index.ts`

**Interface:** Existing public submission and operator-read HTTP endpoints.

**Dependencies:** Existing canonical JSON parser and SQLite store.

**Tests:** Real collector integration and packaged collector tests.

## Data Model

The envelope remains `version: "v1"`. Required `source` fields remain
`harness`, `hostClass`, `projectUUID`, and `safewordCliVersion`. Optional current fields
are `repository`, `agentVersion`, `model`, `safewordPluginVersion`, `osFamily`,
and legacy `userIdentity`. The new producer omits `userIdentity`; the collector
retains it for installed clients. Storage is unchanged because the collector
already persists the canonical request bytes.

`sessionScope` remains a required top-level envelope field beside `version`,
`finding`, and `source`; it is not part of the closed `source` key set. The
collector validates the complete top-level envelope and the closed source object
before persistence.

## Component Interaction

The existing `retro run` command selects a local harness, asks the source
builder for one snapshot, passes it to canonical envelope serialization, and
submits those bytes to the collector. Collector validation precedes the
existing SQLite insertion; reads return the stored bytes without reconstruction.

## User Flow

1. A supported SafeWord retro reaches the existing `retro run` delivery boundary.
2. Available allowlisted facts enrich its source snapshot; any failed fact is
   omitted silently.
3. The existing public collector validates and stores the canonical envelope.
4. An operator reads the exact accepted bytes with useful runtime context.

## Key Decisions

### Widen the existing source authority

**What:** Add Cursor to the existing v1 closed `source`; do not add a `context`
wrapper or another schema version.

**Why:** `source` already owns harness, host class, project identity, and version
facts. A second object would create two authorities for the same concepts.

**Trade-off:** Collector value rules remain permissive enough for released
clients; stricter optional-value hygiene is enforced by the new producer.

### Keep producer and collector validation independent

**What:** Share semantics, not a runtime package dependency.

**Why:** The collector is the untrusted-input boundary and must not trust the
producer's normalization. Its independent exact validation is useful defense in
depth.

**Trade-off:** A small amount of deliberate validation duplication remains.

### Report only proven execution class

**What:** Preserve released `hostClass: "local"` at ingestion and emit
`hostClass: "unknown"` from every new producer.

**Why:** None of the harnesses can prove local execution without registration or
host attestation. `unknown` is truthful and keeps zero-signup delivery useful.

**Trade-off:** Exact local/cloud grouping waits for #3430.

## Implementation Notes

**Constraints:** The current producer uses ECMAScript `String.prototype.trim`, then
rejects empty values, C0/C1 control characters, and values over 256 UTF-8 bytes.
The v1 collector retains its original nonempty/body-size rules for every
released optional source field. Git email, `GITHUB_ACTOR`, and active identity
discovery are excluded from the local producer. Git-origin enrichment parses trusted local config without
spawning `git`, following only the existing backlink-verified `.git` file
relationship for linked worktrees. Hostile, delegated, and unsupported Git
config shapes and non-allowlisted Git hosts omit repository. The producer's
public-host allowlist is `github.com` and `gitlab.com`. Optional enrichment stays inside the existing
preparation flow. Private recovery is persisted before the public attempt. Cursor
also binds the hook-stashed transcript and conversation identity to the current
project before public egress. The attempt uses one two-second abort timer inside
the existing overall retro boundary.

**Error handling:** Each optional reader fails closed by omitting only its own
field. A failed handoff releases only its uncommitted local claim so a later
invocation may try again; no in-process retry, worker, or background task is added.

**Gotchas:** Cursor has no supported version/model signal today, so both remain
absent. Plugin version is omitted for all new producers because Claude and Codex
do not share a trustworthy runtime carrier. All three harnesses report `unknown`; actor attribution and exact cloud
classification remain #3430.

**Open questions:** None for the local slice. Cloud proof is #3430.

## References

- [PostHog Identify specification](https://github.com/PostHog/sdk-specs/blob/main/openspec/specs/identify/spec.md)
- [OpenTelemetry resource guidance](https://opentelemetry.io/docs/concepts/resources/)
- [GitHub issue #3430](https://github.com/ArcadeAI/safeword/issues/3430)
