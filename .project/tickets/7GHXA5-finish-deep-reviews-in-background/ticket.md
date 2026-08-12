---
id: 7GHXA5
slug: finish-deep-reviews-in-background
type: feature
phase: done
status: done
phase_anchors:
  - "define-behavior: .project/tickets/7GHXA5-finish-deep-reviews-in-background/spec.md"
  - "scenario-gate: packages/cli/features/durable-independent-review.feature"
  - "plan-implementation: .project/tickets/7GHXA5-finish-deep-reviews-in-background/impl-plan.md"
  - "implement: packages/cli/src/review/job.ts"
  - "verify: .project/tickets/7GHXA5-finish-deep-reviews-in-background/test-definitions.md"
  - "done: .project/tickets/7GHXA5-finish-deep-reviews-in-background/verify.md"
scope: Durable local review jobs, foreground courtesy waiting, status collection, source-staleness detection, and agent guidance for collecting pending results.
out_of_scope: Remote job infrastructure, cross-machine persistence, fabricated percentage progress, and automatic application of findings.
done_when: Fast reviews still return inline; healthy slow reviews return a durable pending result and survive the caller; status returns the final typed result; changed sources make the result stale; background reviewer work has a bounded absolute deadline.
phase_skips:
  - "intake: the preceding product discussion established the user, pain, prior art, and selected experience"
  - "define-behavior: the user approved the concrete lifecycle before asking for implementation"
  - "scenario-gate: scenarios restate the already-reviewed lifecycle decision and are proved outside-in below"
  - "plan-implementation: the durable worker and persisted-result boundary were selected during the figure-it-out design discussion"
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T16:16:43.148Z
last_modified: 2026-08-12T16:16:43.148Z
---

# Finish deep reviews without blocking developers

**Goal:** Let independent reviews continue durably after the foreground caller stops waiting and make their final result safely collectable.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-12T16:16:43.148Z Started: Created ticket 7GHXA5
- 2026-08-12T16:20:00.000Z Resumed at implementation from the accepted durable-review proposal; recording executable lifecycle scenarios before code.
- 2026-08-12T21:10:00.000Z Verification audit corrected transient-state cleanup, context freshness binding, proof provenance, and foreground progress; focused regressions and parity contracts are green.
- 2026-08-12T22:06:00.000Z Verified: final Node 22 and Node 24 CI matrices, lint, CLI contract, dogfood parity, build, typecheck, dependency audit, and diff-scoped audit are green.
