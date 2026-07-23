---
id: 36PD6T
slug: resilient-skill-proof-recording
type: feature
phase: verify
status: in_progress
scope:
  - Recognize the exact documented relative invocation-helper path as well as the existing installed absolute path.
  - Preserve a short-lived, session-bound proof for every requested skill in one shell command.
  - Cover Codex and Cursor bridge behavior with unit and end-to-end tests.
out_of_scope:
  - Changing Claude Code's environment-based proof path.
  - Making arbitrary helper-like paths trusted.
  - Broadening the shell tokenizer or changing review-stamp behavior.
done_when:
  - A documented relative-path invocation records a session-bound proof on Codex and Cursor.
  - A chained invocation records proof for each requested valid skill in its shell-command order.
  - A repeated valid skill in one chain records one proof per invocation.
  - Lookalike or foreign-root paths, missing or stale identities, out-of-order requests, and short-circuited chain tails remain rejected without writing proof.
created: 2026-07-17T14:08:00.500Z
last_modified: 2026-07-22T07:00:26Z
phase_anchors:
  - "define-behavior: .project/tickets/36PD6T-resilient-skill-proof-recording/spec.md"
  - "scenario-gate: features/resilient-skill-proof-recording.feature"
  - "implement: .project/tickets/36PD6T-resilient-skill-proof-recording/impl-plan.md"
---

# Keep skill verification proof working in normal shell commands

**Goal:** Let Codex and Cursor record each requested quality skill when users invoke the installed helper by its documented relative path or in a chained shell command.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-17T14:08:00.500Z Started: Created ticket 36PD6T
- 2026-07-17T14:10:00Z Framed: chose exact relative-path recognition plus per-skill short-lived identity entries; this preserves fail-closed proof binding while allowing normal chained commands.
- 2026-07-18T08:47:00Z Approved: user confirmed the behavior contract; independent review confirmed repeated helper commands are in scope.
- 2026-07-18T08:50:00Z Intake complete: self-review stamped; advancing to executable scenarios.
- 2026-07-18T08:55:00Z Defined: five behavior scenarios across Codex and Cursor; Gherkin lint passed. The source is @manual because Vitest integration tests are the executable harness for hook payloads.
- 2026-07-18T09:05:00Z Scenario gate passed: independent review required two strengthening passes; final review found 0 must-fix and confirmed all seven scenario families cover both runtime bridges.
- 2026-07-18T09:10:00Z Scope decision: retain sequential-command reliability only. The helper receives no current Codex/Cursor session identity, so concurrent cross-session isolation cannot be truthfully guaranteed; defer that capability until a runtime provides a per-command handoff token.
- 2026-07-18T09:20:00Z Revised scenario gate passed: independent review confirmed seven AODI scenario families cover the bounded sequential behavior and both runtime bridges.
- 2026-07-18T09:30:00Z Plan review found two safety cases that require behavior revisions: a short-circuited chain tail must never retain proof, and an absolute helper path must bind to the current project root. Returning to scenario review.
- 2026-07-18T09:40:00Z Safety scenario gate passed: independent review confirmed the short-circuit and foreign-root cases replay the real hook-to-helper failure paths across both runtimes.
- 2026-07-18T09:45:00Z Implementation plan approved independently and stamped. Riskiest proof is the real runtime hook plus two helper runs for a contiguous `verify && audit` chain.
- 2026-07-22T03:45:00Z RED: Added a real packaged Codex dispatcher → two relative installed-helper shell commands regression. It failed as required: `verify` recorded but the succeeding `audit` helper had no run identity, proving the single-entry bridge cannot retain both receipts.
- 2026-07-22T04:13:23Z Implemented: the Codex/Cursor bridge now queues each trusted helper invocation, rejects foreign/lookalike paths, preserves expiry and ordering, and canonicalizes macOS `/var`/`/private/var` aliases. Focused unit and real adapter-to-helper tests pass for both runtimes.
- 2026-07-22T04:37:55Z Quality review: approved the shared queue and real-adapter wiring. Follow-up parity BDD exposed an established same-root `$CLAUDE_PROJECT_DIR` form that the hardened parser had rejected; the parser now accepts it only when the hook environment resolves it to the active root and rejects variable reassignment.
- 2026-07-22T05:17:13Z Verify: focused bridge tests (57), full Codex BDD (83 scenarios / 986 steps), lint, format, typecheck, template↔dogfood parity, and all 28 test-definition entries pass. The full Vitest suite has one unrelated Go lint-fallback failure (5,282 passed, 5 skipped); leave the feature in verify until that repository failure is resolved or independently waived.
- 2026-07-22T07:00:26Z Re-verified: SQ5KFS resolved the Go fallback blocker. The project-generated verification plan now passes 5,284 Vitest tests, 484 BDD scenarios / 15,000 steps, and typecheck. Extracted the BDD bridge-file assertions into shared helpers to satisfy the complexity gate; the exact scenario passes. The feature remains in verify pending user confirmation.
