---
id: 2RZDMP
slug: share-test-capacity-across-parallel-sessions
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: discovery and scope artifacts were completed before this branch first committed the ticket"
  - "define-behavior: dimensions, spec, feature source and ledger were completed before this branch first committed the ticket"
phase_anchors:
  - define-behavior: .project/tickets/2RZDMP-share-test-capacity-across-parallel-sessions/spec.md
  - scenario-gate: packages/cli/features/share-test-capacity-across-parallel-sessions.feature
scope:
  - Let participating package-test wrappers in separate worktrees share an operator-chosen capacity for focused runs while broad runs remain exclusive.
  - Keep participating wrappers in the same worktree and OS-user capacity domain serialized across their complete build and test lifetimes.
  - Persist one guarded capacity, FIFO queue, ownership, crash recovery, and conservative capacity-one fallback with native Linux, macOS, and Windows evidence.
out_of_scope:
  - Remote or GitHub-hosted test execution, which belongs to BBNZ68.
  - Arbitrary commands that bypass the package-test wrapper, deliberately detached POSIX descendants, and cross-user serialization of one shared checkout.
  - Automatic CPU, memory, or Vitest-worker sizing; the operator chooses capacity for the unchanged downstream command.
done_when:
  - Focused participating wrappers overlap only within canonical capacity, broad wrappers run exclusively without starvation, and same-domain same-worktree wrappers never overlap.
  - Durable admission, cancellation, release, and crash recovery fail closed without reclaiming a live or unverifiable process identity.
  - Capacity configuration and reset expose stable public contracts, capacity one restores serialized behavior, and required native evidence covers every supported platform boundary.
created: 2026-08-07T17:31:35.044Z
last_modified: 2026-08-10T19:50:00Z
---

# Let parallel sessions share test capacity safely

**Goal:** Let Safeword sessions in separate worktrees overlap focused tests within a safe machine limit while broad verification remains exclusive and same-worktree builds stay serialized.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

**Related:** [BBNZ68 — Offload tests without blocking local work](../BBNZ68-offload-tests-without-blocking-local-work/ticket.md)

## Work Log

- 2026-08-07T17:31:35.044Z Started: Created ticket 2RZDMP
- 2026-08-07T17:32:20Z Framed: Split bounded local test capacity from remote execution so its fairness, serialization, and crash-recovery contract can ship independently.
- 2026-08-07T18:06:43Z Quality-reviewed: Defined the participating-protocol boundary, FIFO weighted state machine, durable staged ownership, platform process identity, descendant limitations, and safe capacity-one compatibility path.
- 2026-08-07T18:34:23Z Quality-approved: Fresh review closed PGID incarnation and identity-loss split-brain behavior; degraded separate-process Codex reviewer found no remaining spec contradiction after Claude was unavailable.
- 2026-08-07T18:53:19Z Phase: intake → define-behavior; reconciled the proposal with 72WMQ5's hardened machine-wide mutex and saved the systematic behavior dimensions before scenario authoring.
- 2026-08-07T18:58:01Z Phase: define-behavior → scenario-gate; authored 15 scenarios across 6 rules with complete rejection, host-surface, dimension, and R/G/R-ledger coverage.
- 2026-08-08T03:42:01Z Scenario-quality approved: Expanded to 56 scenarios and a matching 56-entry ledger; closed initialization, parser, durability, process-lifecycle, native-provenance, recovery, and public-CLI proof gaps. Gherkin and diff checks pass. Review independence remained degraded because Claude was unavailable; a separate headless Codex reviewer approved with no findings.
- 2026-08-10T19:50:00Z CI follow-up: Marked the future implementation contract `@wip` until its executable steps are built. The scenarios remain canonical BDD source while the repository acceptance lane stays free of undefined steps; the exact Cucumber wiring test and Gherkin lint pass.
