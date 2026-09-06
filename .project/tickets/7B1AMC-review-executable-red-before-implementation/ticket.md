---
id: 7B1AMC
slug: review-executable-red-before-implementation
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/7B1AMC-review-executable-red-before-implementation/spec.md'
  - 'scenario-gate: packages/cli/features/review-executable-red-before-implementation.feature'
  - 'plan-implementation: .project/tickets/7B1AMC-review-executable-red-before-implementation/impl-plan.md'
  - 'implement: .project/tickets/7B1AMC-review-executable-red-before-implementation/impl-plan.md'
  - 'verify: .project/tickets/7B1AMC-review-executable-red-before-implementation/test-definitions.md'
scope: 'Proof-plan self-check plus trusted execution attestation and independent review of each distinct new or changed primary executable RED proof, shipped as advisory guidance'
out_of_scope: 'Blocking GREEN or done before FY1NHB evidence, reviewing every reused step, requiring one test per Gherkin row, mandating a framework, universal mutation testing, or replacing scenario coverage, TDD review, and final verification'
done_when: 'A trusted executor records a bounded attestation for the exact primary proof against a sealed pre-implementation snapshot; independent review rejects fabricated, stale, unrelated, and wrong-reason RED evidence, accepts intended behavior RED, preserves genuine shared-proof reuse, and reports route exhaustion with an actionable next step'
parent: AK0QJR
depends_on: [BX1T7H]
relates_to: [NMSD94, QZAFT2, 1698, BFCWDB, ZA0JQR, Y9P3ZC]
external_issue: https://github.com/ArcadeAI/safeword/issues/2336
created: 2026-08-10T07:58:17.735Z
last_modified: 2026-09-06T17:24:57Z
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
