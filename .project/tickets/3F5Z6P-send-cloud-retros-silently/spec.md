# Spec: Send retros silently from supported local harnesses

<!-- safeword:inspiration-contract:v1 -->

## Intent

Let SafeWord quietly preserve a sanitized retrospective from local Claude Code
and local Codex without signup, registration, approval prompts, or user-visible
failure. Both harnesses use the same envelope and request identity. Unsupported
and cloud hosts remain disabled until their own direct carrier is proven.

## Intake Brief

- **Requested by:** Alex, for SafeWord projects using local Claude Code or Codex.
- **Cost of inaction:** useful retros remain trapped in local session state and
  never reach the durable relay.
- **Reversibility:** the local carrier is easy to disable; accepted public
  records are durable and therefore require a separately scoped future
  retention/removal policy.

## References

- GitHub issue #1479 is the canonical filing-boundary contract.
- #834 is not superseded until the relay is deployed, all real harnesses use it,
  and GitHub-native fallback is retired.
- #1495 is a readiness gate only if client credential helpers are reused. This
  slice does not reuse them; the collector has a separate server credential.

## Personas

- Non-Technical Builder (NTB)
- SafeWord Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- SafeWord CLI
- Railway Public Retro Collector

Unaffected:

- Claude Code Cloud, OpenAI Codex Cloud, Cursor, and other hosts — `skip: no
  supported completion carrier with outbound proof yet`.
- Existing private authenticated GitHub filing — public collection has no path
  to it.

## Contract

**Project UUID.** Install generates a random UUID locally without contacting the
server and stores it in project config. Reinstall preserves it. A clone carries
it as project identity. It is correlation metadata, never a secret or credential.

**Eligible session.** A readable host transcript containing at least three
completed tool-use events. Missing, malformed, or smaller sessions make no
network attempt. Each eligible session is claimed once by an atomic local marker.
A completed tool-use event has both the host's tool invocation and its matching
terminal result. An enabled session means an installed local Claude Code or
local Codex completion entrypoint is running, project identity/config are valid,
and collection is not explicitly disabled. Install owns whether that entrypoint
exists; the hook does not maintain a second harness-selection registry.
Harness identity comes from the installed host-specific entrypoint, never from
self-reported transcript or payload metadata.

**Extraction boundary.** Existing host-specific retrospective extraction remains
unchanged and outside this slice's delivery budgets. It may use its existing
transcript eligibility check and model subprocess before candidate handoff.
Only exactly one extracted candidate from that pipeline can enter the new
public delivery stage. Zero or multiple candidates make no public attempt; the
existing private/spool handling remains unchanged. Raw transcripts never become
public payloads.

**Preparation.** One inline, fully awaited TypeScript delivery stage validates
the extracted candidate, runs the existing sanitizer, collects
Git/repository/source metadata, and builds canonical bytes. It also rejects canonical bytes over 65,536 bytes so
the adapters can transmit those bytes as the exact raw REST body. After every
other preparation step succeeds, it atomically claims the session as the final
preparation operation. The complete phase, including that claim, has an
exclusive 1000 ms budget. The delivery stage introduces no child process,
background task, IPC service, or durable client queue.
The atomic claim is a synchronous exclusive-create operation: before it is
issued no marker exists, and when it returns the complete claim exists. The
delivery stage exposes no in-flight or uncommitted claim state.
The existing sanitizer's pre-transmission validation remains authoritative: a
candidate it cannot cleanly validate is abandoned before claim or network use.
Installation rejects unreadable or malformed selected-harness completion
configuration without changing it or any other harness configuration. This is
deliberately different from malformed generated project identity, which install
can safely replace locally. That rejection is atomic: install exits nonzero and
leaves the project tree unchanged.

**Handoff.** After preparation claims the session, the same process submits the prepared bytes
and atomically records the opaque durable receipt within a separate exclusive
2000 ms budget. Because both phase deadlines are exclusive, the total hook budget
is strictly less than 3000 ms. Failure, timeout, or an invalid response exits
successfully with empty stdout/stderr and never delays ordinary work beyond that
budget. There is no automatic client retry in this slice.

**Local preservation record.** A scope-only local attempt marker is claimed
atomically as the final preparation operation, immediately before the single
handoff. Failure before that claim creates no marker, so a later completion may try again. A
crash or failure after claim never releases it. After a valid durable receipt arrives, the hook atomically
records that opaque receipt beside the scope. Only that receipt-bearing local
state means preserved. A crash after claim but before submission may silently
lose the attempt; a crash can never release the claim and create a second one.
An unreadable or malformed marker store fails closed without attempting.

**Source profile allowlist.** Harness, local/cloud host class, project UUID, and
SafeWord CLI version are required. Normalized repository host/path, agent
version, exposed model identifier, SafeWord plugin version, operating-system
family, and one user identity are optional and omitted when unavailable. User
identity precedence is a documented runtime
GitHub identity, then repository-local Git `user.email`, then global Git
`user.email`; otherwise omit it. Optional values are omitted, never guessed.
Raw transcripts, credentials, environment dumps, network addresses, hardware
identifiers, and hostnames are forbidden.
The closed harness literals are `claude-code` and `codex`; the only enabled host
class in this slice is `local`.

**Repository normalization.** The remote host is always lowercased. Protocol,
userinfo, port, query, fragment, trailing slash, and `.git` suffix are removed.
The path is lowercased only for exact host `github.com`; other hosts preserve
path case. Local-path, `file:`, malformed, and unavailable remotes are omitted.

**Canonical envelope and identity.** Deterministic v1 JSON contains exactly four
top-level fields: `version`, sanitized `finding`, closed `source` profile, and
`sessionScope`: the 64-character lowercase hexadecimal SHA-256 digest of UTF-8
`safeword-retro-session-scope:v1`, a NUL byte, the closed harness literal, a NUL
byte, project UUID, a NUL byte, and the stable host session identifier. The raw
identifier is not sent. The shared builder generates one canonical lowercase,
unbraced random request UUID per prepared attempt and hands the same opaque value and canonical bytes to either
adapter; request identity is never embedded in the envelope or scoped by
harness. Both adapters carry it only in the `X-Safeword-Request-Id` HTTP header.
This slice adds no client retry or durable draft queue.
Canonical object keys use the declared contract order: top level `version`,
`finding`, `source`, `sessionScope`; source uses the allowlist order above,
required fields first and optional fields only when present. Serialization adds
no insignificant whitespace or trailing byte.

The project UUID is parsed and serialized in canonical lowercase form before
scope derivation. The finding must contain non-whitespace sanitized content.
Envelope limits are measured from encoded UTF-8 bytes, never string characters.

**Public collector.** A physically separate service/process owns its SQLite WAL
database, Railway volume, and operator credential. The public route can only
append validated quarantine records and requires no caller credential. It
rejects credential-bearing public submissions rather than accepting accidental
secrets: any `Authorization`, `Cookie`, or `X-Api-Key` header, or any query
string, is rejected by presence rather than secret heuristics. Operator reads require the separate operator credential. Public data
cannot call, import, or authenticate the private GitHub filing path.
An accepted submission returns exactly its request identity and an opaque,
non-empty receipt string; the client accepts a receipt only when the echoed
request identity matches its attempt.

**Egress destination.** Both adapters use the one built-in HTTPS public
collector origin. Project config, environment, proxy state, redirects, and host
input cannot replace that destination.

**Duplicate authority.** The public collector validates and persists the exact
raw REST body. Unique constraints cover the globally unique persisted request
UUID and opaque session scope; other public source values are untrusted metadata
and never become identity or authority. An exact retry returns the original
receipt. Concurrent attempts converge. Reusing either uniqueness value with
different bytes is rejected. A fresh request UUID may not reuse an accepted
session scope even with identical bytes; only the original request UUID is an
exact retry. Raw REST bodies are the sole duplicate authority.
Sanitized MCP reads, formatted views, and semantic similarity never authorize or
suppress a duplicate decision.

**Inherited #1479 private filing context (out of scope).** The existing relay contract remains SQLite
WAL with one process and lock, migrating before multi-host/network-filesystem
operation. Automatic retries use 24 hours plus one hour dispatch grace. Filed
payload may compact after 30 days; identity tombstones live indefinitely;
ambiguous and unresolved dead-letter records do not compact. An uncertain GitHub
create becomes `ambiguous`, never auto-creates again, and reconciles only against
the exact marker in raw REST issue bodies. Credentials map to tenant,
installation, repository ACL, roles, and audit identity; harness is audit only,
not dedupe scope.

The public CLI surface stores `projectUUID` and
`publicRetrospectiveCollection` in `.safeword/config.json`. Users can explicitly
disable or re-enable collection without network access through
`safeword project public-retros off|on`.

**Public schema boundary.** The collector accepts only the known v1 envelope and
a canonical lowercase UUID request identity. In `source`, harness, host class,
project UUID, and SafeWord CLI version are required; repository, agent version,
model, SafeWord plugin version, operating-system family, and user identity are
optional. The raw REST body may be at most 65,536 bytes. These
checks are deliberately small schema protection, not throttling or retention.

**Host allowlist.** This slice permanently enables only local Claude Code and
local Codex. Adding any other host is a separate reviewed change with its own
live direct-carrier proof; there is no runtime attestation mechanism in this
slice.

**Launch scope.** Retention/deletion workflows and volume-abuse controls are not
initial launch gates. They remain explicit follow-up operational work.

## Jobs To Be Done

### send-cloud-retros-silently.NTB1 — Keep the quality loop invisible

When I finish meaningful work with a supported local agent, I want SafeWord to
preserve useful sanitized feedback without asking me to operate telemetry, so I
can keep working without losing the quality loop.

#### send-cloud-retros-silently.NTB1.R1 — Each eligible supported local session makes at most one silent bounded attempt

#### send-cloud-retros-silently.NTB1.R2 — A retrospective contains only the approved sanitized body and source allowlist

#### send-cloud-retros-silently.NTB1.R3 — Project identity needs no signup and an explicit project opt-out prevents collection

### send-cloud-retros-silently.SWM1 — Preserve public retros without weakening private filing

When supported harnesses submit retros, I want one durable untrusted collection
boundary with stable identity and strict quarantine, so I can inspect feedback
without creating duplicates or granting public callers GitHub authority.

#### send-cloud-retros-silently.SWM1.R1 — Every supported harness uses one deterministic envelope and transport-independent request identity

#### send-cloud-retros-silently.SWM1.R2 — Public intake deduplicates transactionally from exact raw REST bytes

#### send-cloud-retros-silently.SWM1.R3 — Public records remain physically and authoritatively quarantined from private filing

#### send-cloud-retros-silently.SWM1.R4 — Preparation and handoff obey separate exclusive deadlines and fail invisibly

#### send-cloud-retros-silently.SWM1.R5 — This slice enables only local Claude Code and local Codex

## Recorded Decisions

- Local Claude Code and local Codex are the first end-to-end slice.
- One synchronous TypeScript process is the carrier for both; no MCP server or
  shell wrapper is required.
- Cloud support is disabled rather than simulated through delayed jobs.
- The public collector is a separate deployment boundary, not a mode on private
  filing.
- Retention/removal is follow-up work, not a launch blocker.

## Open Questions

None for the initial slice.
