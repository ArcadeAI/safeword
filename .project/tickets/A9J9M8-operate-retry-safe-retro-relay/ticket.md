---
id: A9J9M8
slug: operate-retry-safe-retro-relay
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/A9J9M8-operate-retry-safe-retro-relay/spec.md'
  - 'scenario-gate: features/operate-retry-safe-retro-relay.feature'
  - 'plan-implementation: features/operate-retry-safe-retro-relay.feature'
  - 'implement: .project/tickets/A9J9M8-operate-retry-safe-retro-relay/impl-plan.md'
scope:
  - one bounded relay acceptance path used by the shared safeword retro command in Claude, Cursor, and Codex
  - persist an opaque requestId and the exact sanitized payload before the first delivery attempt
  - discover and atomically claim immutable per-request relay files across sessions without two drains racing
  - configure independently rotatable relay principals for every harness and an operator
  - enforce the 24-hour retry deadline, 1-hour dispatch grace, 30-day filed-payload retention, indefinite tombstones, and visible dead letters
  - expose authenticated operational state and emit structured alerts for ambiguous and dead-letter filings
out_of_scope:
  - modifying or promoting the uniqueness and raw-marker reconciliation machinery before GitHub issues 1474 and 1481 land and collision rates are re-measured
  - semantic deduplication across different requestIds when canonical and legacy evidence both drift
  - PostgreSQL, multiple relay replicas, or network-filesystem SQLite
  - provisioning real GitHub App or customer relay credentials in this branch
  - retiring the GitHub-native fallback or superseding GitHub issue 834
  - reusing the client GitHub credential validator or scrubber tracked by GitHub issue 1495
done_when:
  - each supported harness submits the same persisted requestId and exact payload through the shared CLI operation
  - relay unavailability returns control within one second and leaves the draft visibly retryable on disk
  - two sessions cannot simultaneously own the same spool claim and an expired claim is recoverable
  - persisting one request while another drains cannot lose either request
  - a durable relay acceptance is the only event that acknowledges a local draft
  - retry deadlines create alerted dead letters and filed records compact to non-reusable tombstones without deleting identity
  - production startup authenticates separate harness and operator principals and repository authorization remains independent of request identity
  - an authenticated operations read exposes accepted, retryable, ambiguous, dead-letter, filed, and tombstone counts
created: 2026-07-27T02:23:02.173Z
last_modified: 2026-07-27T02:23:02.173Z
---

# Deliver retry-safe retro findings across every harness

**Goal:** Route Claude, Cursor, and Codex through one bounded durable relay operation with production lifecycle enforcement and safe local fallback.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-27T02:23:02.173Z Started: Created ticket A9J9M8
- 2026-07-27 Canonical contract re-read from GitHub issue 1479 and all 22 comments. The body remains authoritative.
- 2026-07-27 Found GitHub issues 1474 and 1481 still open even though their defensive code is present in the current main lineage. Per the body, uniqueness promotion and collision re-measurement remain blocked.
- 2026-07-27 User explicitly directed planning and execution. Intake gates are treated as confirmed for the durability-and-routing slice captured in scope; the prerequisite gate is preserved rather than bypassed.
- 2026-07-27 Phase: intake → define-behavior with two confirmed jobs, six rules, and the unresolved uniqueness prerequisites held out of scope.
- 2026-07-27 Independent scenario review rejected the first draft because it mixed this slice with blocked uniqueness work, overclaimed surface wiring, bundled non-atomic behaviors, and left lifecycle durations implicit. The scenario contract is being narrowed and split before review repeats.
- 2026-07-27 Phase: define-behavior → scenario-gate after executable Gherkin and rejection coverage passed the project checker.
- 2026-07-27 Fresh scenario re-review passed after the slice stopped modifying uniqueness/reconciliation, enumerated every harness surface, split non-atomic behavior, and made all lifecycle durations explicit.
- 2026-07-27 Phase: scenario-gate → plan-implementation after the independent PASS was stamped.
- 2026-07-27 Independent implementation-plan reviews rejected the first draft:
  shared JSONL rewrite races, unfenced leases, non-recoverable ack/drain,
  reconstructed rather than exact bytes, destructive semantic-evidence
  compaction, non-atomic schema migration, credential inheritance by the
  headless extractor, non-idempotent alert claims, and a prose-only
  prerequisite gate all required correction before RED.
- 2026-07-27 A fresh combined gate rejected the second draft for a vacuous
  readiness positive path, undefined retry/deadline races, an overstated
  physical-erasure implication, production access to spike credentials, and a
  missing dimensions artifact. The design now defines manifest validation,
  durable backoff/CAS boundaries, application-level retention, an exact role
  matrix with spike isolation, and the full dimensions partition.
- 2026-07-27 The next fresh gate found the readiness proof did not establish
  landed code, one auth paragraph contradicted the exact matrix, spike isolation
  was only client-side, retry scheduling lacked an executable scenario, and
  schema rejection cases were bundled. The contract now requires Git ancestry
  evidence, denies every excluded role, makes spike HTTP health-only, executes
  durable retry scheduling, and splits migration rollback from startup refusal.
- 2026-07-27 The following gate found two remaining executable gaps: readiness
  was not bound to the running build, and spike/role exclusions were prose-only.
  The contract now requires an immutable embedded build SHA match and scenarios
  for spike health-only behavior plus operator/harness excluded-role denials.
- 2026-07-27 The final provenance review caught a circular manifest hash:
  requiring a checked-in manifest to name its own commit is impossible. The
  realizable flow now lands evidence first, enables the manifest in a descendant,
  and embeds the later build commit; Git ancestry and artifact blobs bind them.
- 2026-07-27 Phase: plan-implementation → implement after a fresh independent
  gate passed the corrected crash, readiness, retry, retention, auth, migration,
  alert, #834, and #1495 contracts.
