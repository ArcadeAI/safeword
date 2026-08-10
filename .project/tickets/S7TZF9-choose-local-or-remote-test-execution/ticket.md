---
id: S7TZF9
slug: choose-local-or-remote-test-execution
type: feature
phase: done
status: done
phase_anchors:
  - define-behavior: .project/tickets/S7TZF9-choose-local-or-remote-test-execution/spec.md
  - scenario-gate: packages/cli/features/choose-local-or-remote-test-execution.feature
  - plan-implementation: .project/tickets/S7TZF9-choose-local-or-remote-test-execution/impl-plan.md
  - implement: packages/cli/src/commands/test-execution.ts
  - verify: .project/tickets/S7TZF9-choose-local-or-remote-test-execution/test-definitions.md
  - done: .project/tickets/S7TZF9-choose-local-or-remote-test-execution/verify.md
scope:
  - `test-execution` status and contributor preference precedence
  - Optional gitignored worktree-local personal config
  - Per-run local override and proven-no-dispatch local fallback
out_of_scope:
  - Installing or dispatching a remote workflow
  - GitHub API calls, pending records and remote result observation
done_when:
  - A contributor can select local or remote-preferred without changing shared project state
  - Invalid personal configuration fails closed and never starts either execution plane
  - Status explains the winning mode and its origin
parent: BBNZ68
created: 2026-08-09T21:20:26.567Z
last_modified: 2026-08-10T12:22:00Z
---

# Choose local or remote test execution per contributor

**Goal:** Let contributors choose a safe local or remote-preferred test default, including an optional private worktree config and graceful local fallback.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T21:20:26.567Z Started: Created ticket S7TZF9
- 2026-08-09T21:20:59Z Scoped: First child of BBNZ68. It owns preference selection and local safety only; later children own installation and remote dispatch.
- 2026-08-09T21:59:02Z Defined behavior: Added seven scenarios covering precedence, worktree isolation, strict personal-config rejection, status visibility, and real local-plan fallback. The user directed progress without waiting on the unavailable independent reviewer; the scenario gate is therefore explicitly pending that later review route, not approved.
- 2026-08-09T21:59:02Z Planned: Reuse the real test-plan resolver behind public status/test commands. The user-directed reviewer exception remains recorded; implementation starts after this plan is reviewed or explicitly carried forward without the unavailable route.
- 2026-08-10T02:03:00Z Plan review requested changes: The independent Claude route timed out; a fresh headless Codex review found undefined project-preference, remote-availability, personal-file lifecycle and local-process contracts. Revised the plan and spec to define those boundaries before implementation.
- 2026-08-10T02:10:00Z Supplemental plan review requested changes after both coordinator routes timed out. Added enforced Git-ignore privacy, strict duplicate/schema validation proofs, an explicit portable filesystem threat boundary, and corrected the Safeword CLI persona codes.
- 2026-08-10T02:12:00Z Began implementation: All degraded-review findings were incorporated. No independent stamp was written because both coordinator routes were exhausted; continuing under the configured prefer policy and the user's explicit direction to proceed without Indy review.
- 2026-08-10T06:10:00Z Quality review requested changes through the degraded Codex route after Claude timed out. Declared repository-runner network capability, refused offline execution before spawn, preserved per-runner JSON output, and added bounded noisy-output handling with explicit spawn errors. Retained successful empty plans and permissive invalid project preference handling because both are explicit approved plan contracts; strict validation remains reserved for personal config.
- 2026-08-10T11:50:00Z Final quality re-review approved the implementation and executable behavior steps. Claude timed out again, so the coordinator completed through its permitted fresh headless Codex fallback and recorded degraded independence with no findings. The diff audit also passed after replacing prose-only principle proofs with resolvable evidence paths.
- 2026-08-10T12:02:00Z Remote CI run 31385029999 passed lint, dogfood parity, and the CLI contract, then both Node matrices found the same generated-architecture freshness failure after merging main (7,354 tests passed; one documentation assertion failed). Reconciled the still-accurate module descriptions to the merged fingerprint; `project architecture --check` is green before rerunning CI.
- 2026-08-10T12:22:00Z Entered verification: Remote CI run 31385930373 passed lint, dogfood parity, the CLI contract, both full Node matrices, physical-install proof, the repository-wide Cucumber lane, and release gates. Recorded the audit, scope, surface, dependency, and persona-walk evidence in verify.md.
- 2026-08-10T12:23:00Z Completed: All done-gate evidence is recorded and the contributor-preference slice is ready for the remote-workflow installation child.
