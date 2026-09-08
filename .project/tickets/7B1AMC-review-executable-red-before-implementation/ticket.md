---
id: 7B1AMC
slug: review-executable-red-before-implementation
type: feature
subtype: bug-investigated
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/7B1AMC-review-executable-red-before-implementation/spec.md'
  - 'scenario-gate: packages/cli/features/review-executable-red-before-implementation.feature'
  - 'plan-implementation: .project/tickets/7B1AMC-review-executable-red-before-implementation/impl-plan.md'
  - 'implement: .project/tickets/7B1AMC-review-executable-red-before-implementation/impl-plan.md'
  - 'verify: .project/tickets/7B1AMC-review-executable-red-before-implementation/test-definitions.md'
  - 'done: .project/tickets/7B1AMC-review-executable-red-before-implementation/verify.md'
scope: 'Trusted execution plus independent review of each distinct new or changed primary executable RED proof, with a hard freshness gate before GREEN credit'
out_of_scope: 'Reviewing every reused step, requiring one test per Gherkin row, mandating a framework, universal mutation testing, replacing scenario coverage, TDD review, or final verification, or duplicating existing host installation and reconciliation contracts'
done_when: 'A trusted execution attestation and fresh independent review prove the intended missing behavior fails for the right reason at the actor boundary, and every supported agent host blocks GREEN credit when that evidence is missing, stale, fabricated, incomplete, or bound to another proof'
parent: AK0QJR
depends_on: [BX1T7H]
relates_to: [NMSD94, QZAFT2, 1698, BFCWDB, ZA0JQR, Y9P3ZC]
external_issue: https://github.com/ArcadeAI/safeword/issues/2336
created: 2026-08-10T07:58:17.735Z
last_modified: 2026-09-07T23:15:21Z
---

# Stop hollow acceptance proofs before implementation

**Goal:** Require an independent review of each new or changed primary executable RED proof before production implementation begins.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-10T07:58:17.735Z Started: Created ticket 7B1AMC
- 2026-08-10T08:00:27Z Planned: Scoped a lightweight independent RED receipt with explicit freshness and reuse rules.
- 2026-09-06T15:30:00Z Resumed: Adopted the issue's design correction: authenticate exact RED execution with a trusted attestation, then review failure attribution independently; keep rollout advisory pending FY1NHB evidence.
- 2026-09-06T15:30:00Z Intake complete: Existing product intent remains accepted; added the Safeword CLI execution boundary and advanced to behavior definition.
- 2026-09-06T15:45:00Z Defined behavior: Derived seven dimensions and authored fourteen representative scenarios covering eight Rules, all supported agent surfaces, intended and wrong-reason RED, freshness, reuse, bounded evidence, and advisory failure handling.
- 2026-09-06T17:24:57Z Verified: Full Vitest and Cucumber suites, lint, typecheck, package builds, generated contracts, documentation diagnostics, and diff-scoped audit passed. Added one rejection scenario surfaced by source-install validation. Independent external review remains unavailable under the host approval policy, so the ticket remains in verify pending user confirmation.
- 2026-09-06T16:00:00Z Scenario review requested changes: Added distinct-proof execution, tampered-attestation rejection, and unrelated actor-boundary failure coverage. Corrected the packet summary's Rule count from nine to eight; the spec itself was consistent.
- 2026-09-06T16:15:00Z Scenario gate complete: Configured reviewer routes were exhausted; under `prefer`, a clean bounded supplemental review found no remaining issues in fourteen scenarios. No independent stamp is claimed.
- 2026-09-06T16:30:00Z Planned implementation: Four slices reuse the durable review coordinator, add one trusted execution attestation, bind freshness and reuse to canonical proof inputs, and roll out through host-parity workflow guidance without a hard gate.
- 2026-09-06T16:45:00Z Plan review complete: Configured reviewer routes were exhausted; under `prefer`, a fresh-context supplemental review approved the parse-valid plan with no findings. Independence is degraded and no independent stamp is claimed.
- 2026-09-06T16:55:00Z Implemented: Added the structured executable-RED CLI contract, trusted bounded process attestation, HMAC-sealed job binding and freshness, exact receipt reuse and retry reconstruction, fixed wrong-reason rubric, and generated Claude/Codex workflow parity.
- 2026-09-06T17:00:00Z Focused verification: 145 tests passed with 2 skipped across the executor, job, packet, runtime, rubric, retry, and public CLI suites; typecheck, targeted lint, and generated Claude/Codex freshness checks passed.
- 2026-09-06T17:10:00Z Quality review correction: Current Node documentation confirmed that terminating a parent does not necessarily terminate descendants. Added a failing regression and contained timed-out proof trees with POSIX process groups and Windows `taskkill /t`.
- 2026-09-07T05:07:09Z Completed: User confirmed the delivery after rebase onto current `origin/main`. Regenerated host artifacts and origin-main fixtures, then passed 9,211 Vitest tests, 592 Cucumber scenarios, lint, typecheck, package builds, and deterministic generated-artifact checks. PR readiness remains Draft because configured independent AI review is unavailable under the host approval policy.
- 2026-09-07T15:04:49Z CI repair: Confirmed the 25-millisecond timeout test coupled process termination to child startup and stderr scheduling. Removed only the unrelated expected-output assertion; the test still proves the configured timeout and `SIGKILL`, while the adjacent real-process test independently proves output capture and matching.
- 2026-09-07T23:04:35Z Scope correction: The issue's final decision requires a blocking pre-GREEN gate rather than advisory reporting. Returned the PR to Draft and reopened the ticket at scenario-gate; retained the existing trusted executor and receipt lifecycle, and limited the delta to exact-request admission plus OpenCode parity.
- 2026-09-07T23:04:35Z Scenario gate complete: 17 scenario definitions retain the existing trusted-execution contract and add only the accepted passing-proof rejection, fail-closed GREEN admission, plain recovery, and OpenCode parity boundaries. Configured independent routes were exhausted; a bounded exact-file fallback found and resolved two false-pass gaps, and Gherkin lint passes.
- 2026-09-07T23:15:21Z Plan correction complete: A fresh-context fallback review found that skill-only repetition could be skipped. Replaced it with one public receipt-check command enforced by the existing cross-host edit hook at the actual GREEN ledger transition. Kept undeclared dependency-closure inference out of scope and advanced the parse-valid plan to implementation.
- 2026-09-07T23:45:00Z Quality review correction: A fresh-context fallback found that proof commands inherited internal review credentials and that scenario-only admission could cross ticket boundaries. Removed all `SAFEWORD_REVIEW_*` variables from proof environments, invalidated preemptive job completion, bound receipts to the exact ledger, and documented the deliberate same-user process trust boundary instead of expanding this issue into OS sandboxing.

## Root Cause

The timeout integration test required a spawned Node process to emit its expected-failure text within
25 milliseconds even though the behavior under test was forced termination at the configured
deadline. Process startup and scheduling can consume that entire interval under CI load, so the
executor can correctly report `timed_out: true` and `SIGKILL` before the child emits any output.

Confirmed by both Node CI lanes and an 80-run local reproduction that missed the expected text once
while still timing out correctly. Ruled out a termination defect because both CI failures recorded
the configured timeout and `SIGKILL`; ruled out stream-drain loss because Node's `close` event occurs
after child stdio closes and the separate real-failure test consistently captures and matches stderr.
