---
id: 3F5Z6P
slug: send-cloud-retros-silently
type: feature
phase: implement
status: in_progress
scope:
  - one versioned sanitized public-retro envelope and source-profile builder shared by local Claude Code and local Codex
  - a locally generated, project-persisted UUID and allowlisted source metadata
  - an explicit local CLI path to turn public retro collection off or on
  - a project-persisted public-collection opt-out that prevents network attempts
  - one transport-independent request identity, deterministic versioned envelope, durable public quarantine intake, receipt, and conflict-safe raw-body deduplication isolated from private authenticated GitHub filing
  - one synchronous TypeScript lifecycle carrier with a 1000 ms preparation budget and a separate 2000 ms handoff budget
  - a physically separate public collector process, SQLite volume, and operator credential
out_of_scope:
  - OAuth or remote MCP services, scheduled commands, and agent-chosen network commands
  - automatic retry for ephemeral Cloud hosts after a failed receipt attempt
  - enabling any cloud or unsupported host before it has its own live direct-carrier receipt proof
  - changing the existing private authenticated relay filing contract
  - public-intake abuse controls beyond v1 schema validation, its 64 KiB raw-envelope boundary, and the relay's deployment boundary; per-source throttling and retention quotas require a separate operational contract
  - collected-record retention, deletion, and removal workflows; they are follow-up operational work and do not gate initial carrier readiness
done_when:
  - local Claude Code and local Codex each submit at most one sanitized versioned envelope per substantial session without user narration, registration, or approval
  - preparation completes strictly before 1000 ms and public handoff completes strictly before its separate 2000 ms deadline; byte-identical retries return the same receipt and conflicting reuse of a request identity is rejected
  - the source profile contains only the specified allowlist and omits unavailable values
  - public records cannot reach private GitHub filing through any code path
  - unsupported and cloud hosts make no attempt until their own direct carrier has live outbound receipt proof
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T02:51:38.122Z
last_modified: 2026-08-12T02:51:38.122Z
phase_anchors:
  - "define-behavior: .project/tickets/3F5Z6P-send-cloud-retros-silently/spec.md"
  - "scenario-gate: features/send-cloud-retros-silently.feature"
  - "implement: .project/tickets/3F5Z6P-send-cloud-retros-silently/impl-plan.md"
---

# Send cloud retros silently without approval prompts

**Goal:** Let SafeWord quietly submit a sanitized retrospective from local Claude Code and local Codex, and call it preserved only when the durable receipt arrives — without interrupting the user or requiring signup.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-24T22:30:00Z Final independent quality review found four material
  boundary gaps that were fixed: receipt JSON is shape-validated, linked
  worktree pointers require a backlink before repository config is read,
  allowlisted source strings are trimmed consistently, and every duplicate or
  disabled lifecycle run must exit successfully before its negative assertion
  counts. The accepted default-on/project-opt-out decision and explicit
  post-launch status of retention, quotas, and rate limits were retained; the
  strict handoff deadline, no automatic retry, and versioned canonical-byte
  contract were also retained. Focused re-verification passed 39 tests.
- 2026-08-24T21:30:00Z Closed the material independent-review findings without
  expanding launch scope: both real local lifecycle carriers now prove
  once-only delivery and project opt-out against the SQLite collector; client
  rendering and receipt handoff failures are contained and temporary receipts
  are cleaned up; the collector closes its store on startup/shutdown failures,
  compares operator credentials by byte length, and returns operator JSON with
  `nosniff`. Focused CLI typecheck and 11 delivery/lifecycle tests passed;
  collector typecheck and all 66 collector tests passed. Retention, deletion,
  rate limiting, opt-in, and a non-root Railway image remain rejected as either
  explicit post-launch work, contrary to the accepted default-on contract, or
  incompatible with Railway's root-owned mounted volume.
- 2026-08-24T20:13:00Z Production collector launched at
  `https://retro-collector-production.up.railway.app` as a physically separate
  Railway service with a persistent `/data` volume. Synthetic proof receipt
  `757e7cd6-444b-43cc-81d5-fb0556c14eee` confirmed 201 intake, byte-identical
  retry returning the same receipt, credentialed raw-byte operator read, and
  409 rejection for conflicting reuse of the request identity.
- 2026-08-24T20:05:00Z Launch critical path fixed: prove both installed local
  lifecycle adapters against the real collector, deploy that collector as a
  separate Railway service with one persistent `/data` volume and an operator
  credential, obtain a live synthetic receipt and operator read, then compile
  the verified stable origin into the CLI and complete review/verification.
  Retention and deletion remain explicit follow-up work, not launch gates.
- 2026-08-24T06:11:00Z Implementation plan approved by Claude Sonnet
  (cross-agent) and advanced to implement. Six risk-ordered slices; no ADR
  emitted. Final simplification removed speculative multi-connection retry code
  and reserved a recognizable synthetic identity for the production proof.
- 2026-08-24T05:34:00Z Final scenario gate approved by Claude Sonnet
  (cross-agent): 97 scenarios and ledger entries are aligned. The revised gate
  now proves installed Claude/Codex lifecycle → exact HTTP route → real
  collector → durable local receipt, while every public rejection preserves the
  unchanged private/spool candidate.
- 2026-08-24T05:20:00Z Product decision retained from the user: the source
  allowlist may send available GitHub identity or Git email without signup or a
  prompt; collection remains default-on, silent, documented, and project-opt-out.
  Retention/deletion stay explicit follow-up operations rather than launch gates.
- 2026-08-24T04:35:00Z Independent plan review approved the six-slice direction
  but its material warnings reopened scenario details. Replaced an asserted
  400 ms support promise with measure-then-set evidence, removed unscoped
  diagnostics/liveness routes, and made deploy gaps and claim-before-submit
  loss explicit.
- 2026-08-23T19:55:00Z Reopened behavior after independent plan review proved
  the frozen 500 ms cold HTTPS handoff impossible for higher-latency users.
  Revised the exclusive handoff ceiling to 2000 ms (total strictly below 3000
  ms) and added `safeword project public-retros off|on` as the explicit local,
  network-free escape hatch; returning through scenario review before planning.
- 2026-08-23T20:02:00Z Define-behavior revision complete: 85 scenarios across
  eight rules. The revised timeout scenarios preserve exclusive-boundary
  arithmetic at 1999/2000 ms and 2998/2999 ms; the new CLI outline proves both
  off and on persist locally without network access. Advanced to scenario-gate.
- 2026-08-23T20:42:00Z Independent scenario review requested changes. Removed
  the vacuous escaping fixture and added five boundary scenarios for malformed
  install config, invalid CLI control, concurrent byte conflicts, claim
  completion at the preparation deadline, and receipt recording at the handoff
  deadline. The gate now covers 90 scenarios across eight rules.

- 2026-08-12T02:51:38.122Z Started: Created ticket 3F5Z6P
- 2026-08-12T Intake: confirmed a cross-harness product contract with
  host-native adapters; Claude Code Cloud is the first carrier candidate, not
  the only target. Quality review required per-host readiness gates and an
  explicit metadata boundary before behavior definition.
- 2026-08-12T Quality review revisions: defined local project UUID lifecycle,
  source-profile precedence, operator-only record reads, and
  transport-independent conflict-safe request deduplication; recorded the
  ephemeral outage decision rather than silently weakening durability.
- 2026-08-12T Decision: use the smallest carrier shape — a direct host-owned
  TypeScript lifecycle hook. MCP is not part of this feature unless later live
  evidence shows the direct hook cannot satisfy the approved behavior.
- 2026-08-12T Intake accepted: ephemeral Cloud attempts may be silently lost
  when no durable receipt arrives; ephemeral infrastructure is not a retry
  store. Scoped the shared contract, explicit exclusions, and observable
  500 ms receipt/readiness outcomes; advancing to define-behavior.
- 2026-08-12T Quality review follow-up: made the validated raw REST body the
  duplicate authority and required deterministic shared-envelope serialization,
  so a formatted or sanitized MCP read cannot alter a duplicate decision.
- 2026-08-12T Scenario quality review: added the non-substantial and successful
  500 ms boundaries, clone/reinitialization UUID behavior, and a raw-envelope
  conflict example; moved the direct-TypeScript choice into the technical
  delivery constraint so Gherkin remains outcome-focused.
- 2026-08-12T Behavior accepted and advanced to scenario-gate for adversarial
  validation.
- 2026-08-12T Independent scenario review (Claude, cross-agent) requested
  changes. Applied its material findings: inclusive deadline behavior,
  allowlist closure, raw-byte duplicate authority, private-filing control,
  normalized repository identity, and artifact-backed carrier readiness.
- 2026-08-12T Scenario-gate fallback review found and corrected additional
  boundary gaps: the exact deadline is exclusive, every public read surface is
  operator-only, version snapshots remain unprivileged, and carrier readiness
  requires a relay-verified attestation rather than a hand-authored claim.
- 2026-08-13T Independent scenario review (Claude Opus, cross-agent) requested
  changes. Split deadline abandonment from definitive failures; rejected
  unmarked or contaminated bodies before envelope creation; preserved valid
  UUIDs on reinstall; and pinned source, repository, and byte-identity edges.
- 2026-08-13T Follow-up review clarified that request identity travels beside,
  not inside, canonical envelope bytes; local remotes are omitted; and the
  bounded lifecycle clock starts at retrospective-work entry.
- 2026-08-15T Scenario-gate revisions: constrained readiness-attestation
  issuance to the existing operator boundary and matching hosted proof;
  tightened raw-session privacy, contamination, clock, source, remote, and
  key-verification boundaries. Collection remains deliberately invisible at
  install and runtime; the persisted opt-out is the power-user escape hatch.
- 2026-08-15T Follow-up scenario review revisions: added concrete forbidden
  value sentinels, malformed-transcript fail-closed behavior, exact lifecycle
  clock anchoring, public-credential isolation, and both valid and invalid
  concurrent identity paths. Readiness evidence stays pinned-key-only and
  cannot be enabled by an artifact credential or a local override.
- 2026-08-15T Dedupe decision: retain one opaque session scope alongside each
  durable raw record. Exact bytes and request identity prove a retry; a
  byte-different envelope with that scope is rejected, so source drift cannot
  create a second session record. Retention and removal of the record and scope
  are separate operational follow-up work and do not block initial launch.
- 2026-08-15T Product decision: collection stays silent and default-on for
  eligible enabled sessions, with the documented project opt-out as the sole
  user control. The separate privacy/legal owner must confirm applicable notice
  and lifecycle obligations before production readiness is issued; this does
  not add a user prompt or registration flow. A synthetic release-proof run is
  the only bootstrap for the first carrier readiness entry.
- 2026-08-15T Scenario-gate follow-up: readiness evidence now binds the exact
  receipt observed in the synthetic release proof, not forgeable public
  runtime/carrier attribution. Added the focused marker-crash and
  receipt-recording failure cases; avoided new credentials, endpoints, or
  runtime policy machinery.
- 2026-08-15T Scenario gate approved by Claude (cross-agent): the behavior
  contract is fixed; next is a minimal implementation plan before code.
- 2026-08-23T Recovery: the uncommitted local-first revision was lost with its
  temporary worktree. Re-read canonical issue #1479 and rebuilt the accepted
  launch slice in a persistent worktree: local Claude Code plus local Codex,
  one synchronous TypeScript carrier, separate 1000 ms preparation and 500 ms
  handoff budgets, a physically separate public collector, and cloud disabled.
  Returned to scenario-gate because the recovered Cloud-first phase marker and
  implementation plan were stale.
- 2026-08-23T Scenario-gate revision: closed the real-client/minimal-source
  collector gap; placed atomic claim overhead inside the total deadline while
  keeping preparation and handoff independently bounded; pinned request identity
  to `X-Safeword-Request-Id`; and added coexistence, retry-after-ineligibility,
  contamination, canonical-UUID, and concurrent-marker coverage. Retention and
  abuse controls remain intentionally outside the initial launch gate.
- 2026-08-23T Scenario gate approved by Claude Opus (cross-agent): 61 scenarios
  and their RED/GREEN/REFACTOR ledger align; canonical full-profile bytes,
  exact raw-body dedupe, supported-host wiring, quarantine, and the exclusive
  1000 ms preparation/500 ms handoff budgets are fixed. Advancing to the
  smallest implementation plan.
- 2026-08-23T Plan-time repository survey found the existing local retro flow
  already owns model extraction. Returned to scenario-gate to clarify that the
  new 1000/500 ms direct TypeScript boundary begins with an extracted candidate;
  this slice neither replaces extraction with transcript telemetry nor adds a
  second child process.
- 2026-08-23T Clarified scenario gate approved by Claude Opus (cross-agent):
  74 scenarios pass AODI with exact ledger alignment and no blocking issues.
  Existing extraction/eligibility stays outside the new delivery clock; the
  direct TypeScript delivery phase alone owns the exclusive 1000/500 ms budgets.
- 2026-08-23T Product decision confirmed: retention, deletion, and separate
  privacy/legal review are follow-up operational work, not initial launch gates.
  Launch documentation must accurately disclose durable quarantine and the lack
  of a removal workflow; no user prompt, registration, or hidden promise is added.
- 2026-08-23T Plan review correction: the public path accepts exactly one
  sanitized extracted candidate. Multiple candidates keep existing private or
  spool behavior but make no public attempt, avoiding a new aggregation format.
- 2026-08-23T Reopened scenario gate approved by Claude Opus (cross-agent): 82
  scenarios and their ledger align. The review independently confirmed the
  445/287/288-byte canonical fixtures, exclusive timing boundaries, public
  credential rejection, raw-body authority, and separate collector surface.
- 2026-08-23T Reopened the behavior contract after live latency evidence showed
  the 500 ms cold-network handoff ceiling was not portable. Replaced it with an
  exclusive 2000 ms handoff ceiling and exclusive 3000 ms delivery ceiling,
  and added the explicit `safeword project public-retros off|on` escape hatch.
- 2026-08-23T Independent scenario review requested concrete escaping,
  installation, identity, concurrency, contamination, authorization, and exact
  deadline cases. The revised suite and its RED/GREEN/REFACTOR ledger cover
  those boundaries; a fresh cross-agent approval is still required.
- 2026-08-23T Cross-agent review rejected an invented value-contamination
  heuristic and a private-spool preservation contradiction. Removed the
  heuristic, scoped non-interference to public delivery, anchored malformed
  harness installation behavior, and pinned canonical generated UUIDs, command
  case sensitivity, identity fallback, and claim-deadline classification. The
  resulting 91 scenarios preserve the smallest explicit contract.
- 2026-08-23T Follow-up review exposed the real first-time opt-out path and a
  possible cross-harness scope collision. Added absent-key off/on transitions,
  explicit-true hook consumption, and harness-namespaced session scopes while
  keeping request identity transport-independent. Recomputed the three pinned
  envelope oracles independently; the 95-scenario suite and ledger remain exact.
- 2026-08-23T Removed the identity-reinitialization command from the launch
  slice after review proved it could bypass session-scope dedupe. Install-time
  local identity generation and preservation remain; avoiding marker migration
  keeps the launch contract smaller and preserves one attempt per session.
- 2026-08-23T Degraded fallback review tightened selected-harness reinstall
  idempotency, required-string whitespace rejection, and separate unreadable
  versus malformed fixtures. Runtime quarantine was already covered by real
  no-private-collaborator scenarios, so no duplicate isolation layer was added.
  The final 95-scenario ledger is healthy and exact.
- 2026-08-23T Approved cross-agent review prompted four small surface fixes:
  distinct project/request UUID fixtures, symmetric harness attribution,
  explicit CLI exit behavior including a missing argument, and removal of a
  redundant hook-side selection registry. The leaner final suite has 94
  scenarios; install wiring remains the sole harness-selection authority.
- 2026-08-23T Final consent-boundary review added atomic preservation of the
  collection setting across install/upgrade, explicit rollback on malformed
  harness config, positive private/spool handoff, redirect rejection, JSON
  content type, and deterministic claim-deadline timing. The 96-scenario suite
  is healthy with exact ledger parity.
- 2026-08-23T Independent plan review corrected preparation ownership and the
  risk order: sanitizer/validator and byte limits stay inside preparation;
  completed-pair eligibility is reconciled; the real cold client round trip is
  proved before install work; cancellation/temp-file semantics are explicit;
  schema/dedupe belongs to the first collector slice; disclosure precedes release.
- 2026-08-23T Follow-up plan review made feasibility evidence representative:
  worst-case 64 KiB cold handoffs run locally and on a real >=200 ms path with
  margin, full sanitizer/Git/profile preparation is benchmarked cross-platform,
  Git metadata uses bounded file reads without a child process, schema/install
  precede hook wiring, and dark storage can never become production storage.
- 2026-08-23T Third plan review pinned remaining real seams: worker-thread tests
  exercise actual SQLite writer serialization; operator health exposes capacity
  and write failure without adding quotas; linked worktrees resolve `commondir`;
  public-only eligibility leaves private triggers unchanged; deployment is
  stop-before-start on a stable DNS name with growth remeasurement triggers.
- 2026-08-23T Fourth plan review moved public eligibility before extraction
  handoff and outside the delivery clock, defined claim-versus-receipt deadline
  semantics, pinned `GITHUB_ACTOR` as the optional runtime identity, separated
  anonymous liveness from credentialed diagnostics, and added concurrent latency
  evidence without changing the project-scoped opt-out decision.
- 2026-08-23T Fifth plan review aligned the proof with production: dark access
  control sits outside HTTP, full shipped-stage timing is repeated before install
  work, synchronous claims use measured headroom with no orphaned promise,
  SQLite has a 500 ms busy policy and 20 concurrent pairs, local hosts omit the
  unavailable runtime GitHub tier, and operator response ownership is named.
- 2026-08-23T Scenario gate approved by Claude Sonnet (cross-agent): all 96
  scenarios pass AODI with exact ledger alignment and no correctness defects.
  Advancing to a minimal implementation plan; deselected-host cleanup remains
  governed by existing install reconciliation rather than new hook state.
