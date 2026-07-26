---
id: N30CKR
slug: retry-safe-retro-filing
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/N30CKR-retry-safe-retro-filing/spec.md'
  - 'scenario-gate: features/retry-safe-retro-filing.feature'
  - 'plan-implementation: features/retry-safe-retro-filing.feature'
  - 'implement: .project/tickets/N30CKR-retry-safe-retro-filing/impl-plan.md'
scope:
  - one relay HTTP filing operation and named adapters for Claude, Cursor, and Codex
  - durable SQLite request records keyed by tenant, installation, repository, and requestId
  - request mismatch, concurrency, receipt retry, and ambiguous-create behavior
  - GitHub App installation-token use inside the relay with repository authorization
  - raw REST marker migration and ambiguous-create reconciliation
out_of_scope:
  - heuristic deduplication when exact canonical and legacy marker evidence drifts
  - deployment, horizontal multi-host availability, and production dashboard UI
  - cross-session client spool claiming and draining
  - removal of the current GitHub-native fallback before rollout evidence exists
  - claiming GitHub issue #1479 complete before deployment and real harness routing
  - implementing the maintenance worker for automatic retries, deadlines, dead letters, and compaction
done_when:
  - every named harness adapter sends the same request shape and the same persisted requestId returns one issue
  - concurrent first attempts cause one GitHub create
  - a post-create persistence fault becomes ambiguous without acknowledgement or automatic recreation
  - only raw REST bodies can seed or reconcile marker identity
  - unauthorized repositories are rejected before GitHub and credentials never enter durable request state
created: 2026-07-26T22:35:51.595Z
last_modified: 2026-07-26T22:35:51.595Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1479
---

# Prove the retry-safe retro relay foundation across harness adapters

**Goal:** Build the durable relay slice that production harness routing can adopt without changing request identity.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-26T22:35:51.595Z Started: Created ticket N30CKR
- 2026-07-26 Design contract adopted from the live #1479 body and latest comments; user explicitly requested implementation against that canonical contract.
- 2026-07-26 Independent scenario and plan reviews narrowed this ticket to the relay foundation; #1479 stays open through deployment and production harness routing.
- 2026-07-26 Destination retry/dead-letter/tombstone policy is resolved in design.md but its maintenance worker is a later implementation slice.
- 2026-07-26 Phase: intake → define-behavior after capturing the live issue contract and resolving the destination design.
- 2026-07-26 Phase: define-behavior → plan-implementation after Gherkin lint and independent scenario review passed.
- 2026-07-26 Phase: plan-implementation → implement after independent plan review passed with the durable payload, receipt addressing, restart recovery, marker grammar, and proof boundaries made explicit.
