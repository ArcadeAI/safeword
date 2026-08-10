---
id: S7TZF9
slug: choose-local-or-remote-test-execution
type: feature
phase: implement
status: in_progress
phase_anchors:
  - define-behavior: .project/tickets/S7TZF9-choose-local-or-remote-test-execution/spec.md
  - scenario-gate: packages/cli/features/choose-local-or-remote-test-execution.feature
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
last_modified: 2026-08-10T02:10:00Z
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
