---
id: QRX2DN
slug: codex-done-gate-auto-transition
type: feature
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1388
phase_anchors:
  - 'define-behavior: .project/tickets/QRX2DN-codex-done-gate-auto-transition/spec.md'
  - 'scenario-gate: packages/cli/features/codex-done-gate-auto-transition.feature'
  - 'plan-implementation: packages/cli/features/codex-done-gate-auto-transition.feature'
  - 'implement: .project/tickets/QRX2DN-codex-done-gate-auto-transition/impl-plan.md'
phase_skips:
  - 'intake: Issue #1388 was revalidated and scoped before the isolated delivery branch was created; the resulting intake evidence is recorded in ticket.md and spec.md.'
  - 'define-behavior: The existing spec.md records the user jobs, boundaries, and acceptance outcomes completed before this ticket artifact was committed.'
  - 'scenario-gate: The Gherkin feature and test-definition ledger were reviewed before this ticket artifact was committed.'
  - 'plan-implementation: The implementation plan was reviewed before the isolated delivery branch was created; its reconciliation is recorded in impl-plan.md.'
scope:
  - Evaluate a Codex session's in-progress done-phase ticket with the shared evidence predicate already used by the Cursor close-edit gate.
  - Bind Codex Desktop PostToolUse work to the same durable session identity that Codex Stop evaluates when the hook payload omits `session_id`.
  - Atomically change that ticket to status and phase done only after all applicable shared evidence succeeds.
  - Preserve Codex Stop's retro extraction, filing, and architecture-nudge composition while preventing a failed evidence check from closing a ticket.
  - Cover the real Codex Stop adapter with passing and failing done-evidence fixtures.
out_of_scope:
  - Relaxing the PR ready-state gate or allowing a ready PR with an in-progress ticket.
  - Changing the Claude Code done gate, Cursor close-edit enforcement, ticket evidence requirements, or Git staging/commit ownership.
  - Auto-closing GitHub issues or creating commits from a hook.
done_when:
  - A Codex Stop for a session-bound in-progress done-phase ticket closes it before PR readiness when the shared evidence predicate passes.
  - A Codex Desktop PostToolUse payload without `session_id` still binds through its durable thread identity, so its subsequent Stop can evaluate that ticket.
  - Invalid or absent evidence leaves the ticket in progress and returns a remediation continuation without hiding the failure.
  - Existing Codex retro and architecture Stop behavior stays ordered and functional, and the template/dogfood regression suites pass.
created: 2026-07-24T16:17:08.104Z
last_modified: 2026-07-25T05:04:56Z
---

# Close Codex tickets when evidence passes

**Goal:** Let Codex complete verified tickets before a ready PR needs a manual done-flip commit.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-24T16:17:44Z Revalidated GitHub issue #1388 on origin/main: Codex Stop has no done transition while CI rejects a ready PR whose ticket remains in_progress; PRs #1365 and #1092 required the manual flip.
- 2026-07-24T16:17:44Z `/figure-it-out`: rejected weakening CI and a reminder-only continuation; selected a shared evidence predicate plus atomic status transition in Codex Stop, preserving commit ownership and the existing gate.
- 2026-07-24T16:31:14Z Scenario-gate PASS: fresh review confirmed response shape, eligibility boundaries, evidence partitions, extraction ordering, and continuation priority. Entering implementation planning.
- 2026-07-24T16:41:00Z Plan-gate PASS: fresh review accepted cached-advisory sequencing, retro ordering proof, and advisory-only global fallback. Entering TDD implementation.
- 2026-07-24T16:50:00Z RED/GREEN: real Codex Stop proof added for bound success, exact missing-verify blocking, evidence-over-filer priority, and filer continuation after success. Focused tests, package typecheck, and lint passed; remaining scenario partitions are in the implementation ledger.
- 2026-07-24T17:05:00Z Resumed on a clean branch/worktree from origin/main. The primary checkout’s unrelated ticket index and triage log remain excluded.
- 2026-07-24T18:14:00Z Scenario implementation complete: 30 focused real-adapter Codex Stop tests pass. Coverage includes session-only success, all shared-evidence failure partitions (including stale dependencies and a real failed test command), continuation priority, extraction-before-transition observation, global advisory fallback, and Git ownership boundary. Entering review and verification.
- 2026-07-24T19:02:00Z Review and audit complete: root lint, typecheck, formatting, template parity (192 pairs/8 contracts), and focused Codex Stop plus parity suites pass. Audit found and corrected public Stop-hook documentation that still described advisory-only behavior; no scoped refactor improved the small sequencing operation. The all-repository verification attempt hit three unrelated fixture timeouts under concurrent workspace load (golden-path, Go golden-path, and check-reconcile); the TypeScript golden-path and check-reconcile cases then passed in isolation. See audit.md. This desktop session cannot log the required real /quality-review, /audit, or /verify invocation identity, so the feature remains in_progress and no verify.md substitute was written.
- 2026-07-25T05:04:56Z Desktop identity regression RED/GREEN: a real Codex PostToolUse payload without `session_id` wrote no state at the durable Stop key; resolving the Codex runtime identity in the shared state writer now binds `CODEX_THREAD_ID` consistently. The real PostToolUse → Stop adapter test passes (31 focused tests total). Re-review, full audit, and refactor assessment found no further scoped improvement; their current-run invocation proofs are recorded.
- 2026-07-24T16:17:08.104Z Started: Created ticket QRX2DN
