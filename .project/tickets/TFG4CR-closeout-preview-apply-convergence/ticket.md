---
id: TFG4CR
slug: closeout-preview-apply-convergence
type: feature
phase: done
status: done
phase_anchors:
  - done: .project/tickets/TFG4CR-closeout-preview-apply-convergence/verify.md
phase_skips:
  - intake: The user supplied the primary issues, binding edge cases, regression contract, JTBD, scope, and explicit delivery process before this ticket artifact was created.
  - define-behavior: The committed spec and feature capture the user-provided behavior contract, including bounded transcript evidence, exact task binding, fallback filing, and fail-closed cleanup.
  - scenario-gate: The work log records adversarial cross-agent review of the scenario contract before implementation was finalized.
  - plan-implementation: Implementation followed the reviewed behavior slices across closeout cleanup, retro filing, Codex binding, generated surfaces, and regression tests.
  - implement: The work log and verification record identify the completed implementation and its focused executable proof.
created: 2026-08-11T14:14:42.015Z
last_modified: 2026-08-11T14:14:42.015Z
---

# Make closeout preview and apply converge for merge sessions

**Goal:** Allow the current merged session to preview and apply closeout safely even when transcript progress changes or binding support was installed during the session.

scope:

  - Bound retrospective evidence across preview and apply
  - Codex Desktop current-task binding across linked worktrees and bootstrap upgrades
  - Authenticated retro-filer recovery across worktrees and sessions
  - Exact-target fail-closed cleanup checks
out_of_scope:
  - Weakening merge, verification, or cleanup authorization
  - Reopening issue 1942 unless its regression reproduces
done_when:
  - Preview reporting can advance the transcript and the approved apply still converges
  - Bootstrap and linked-worktree Codex sessions have an exact binding or executable recovery
  - Pending drafts expose an authenticated spool path and acknowledged filing converges
  - Changed repository state or cleanup targets still block mutation

Motivation and user behavior are defined in `spec.md`.

## Work Log

- 2026-08-11T14:14:42.015Z Started: Created ticket TFG4CR
- 2026-08-11T14:20:00.000Z Defined: Adopted the user's full BDD contract for #2431, #1852, #1826, with #1942 as a closed regression contract.
- 2026-08-11T15:05:00.000Z Reviewed: Cross-agent scenario gate approved the 18-scenario contract after adversarial revisions.
- 2026-08-11T23:05:00.000Z Verified: Changed-scope proof passed 115 tests; generated release contracts, audit, lint, build, and typecheck passed. Repository-wide review-process fixtures remain host-probe limited and are recorded in verify.md.
- 2026-08-12T09:10:00.000Z Improved BDD proof: Added an enforced 27-scenario evidence map plus real concurrency, linked-worktree ownership, separate-clone rejection, and noncanonical fallback tests; focused proof passed 121 tests.
- 2026-08-12T14:30:00.000Z Complete: Rebased onto current main, closed every quality-review finding, and passed 7,593 Vitest tests plus 1,519 BDD scenarios. Ready-PR CI now carries the verified ticket as done.
