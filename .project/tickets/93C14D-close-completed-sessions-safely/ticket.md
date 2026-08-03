---
id: 93C14D
slug: close-completed-sessions-safely
type: feature
phase: implement
status: in_progress
phase_skips:
  - intake: Completed before the first feature checkpoint; the scoped spec and intake work log are committed with this ticket.
  - define-behavior: Completed before the first feature checkpoint; the dimensions and scenario ledger are committed with this ticket.
  - scenario-gate: Completed before the first feature checkpoint; the approved feature and review work log are committed with this ticket.
  - plan-implementation: Completed before the first feature checkpoint; the reviewed implementation plan and phase anchor are committed with this ticket.
scope:
  - add one canonical closeout skill that orchestrates verification, GitHub merge state, mandatory retro, exact cleanup, and final reporting
  - ship generated Claude Code, OpenAI Codex, and Cursor entry points from the canonical contract
  - register every shipped artifact in the schema and production wrapper catalogues
  - prove authority boundaries, merge queues and partial success, fail-closed retro, safe cleanup, idempotence, and host parity
out_of_scope:
  - a new safeword closeout CLI command or state machine
  - non-GitHub pull-request providers
  - cloud-agent session cleanup semantics
  - force-removing dirty or locked worktrees
  - inferring administrative merge authority or offering a retro bypass
done_when:
  - one closeout request drives the documented workflow without requiring the user to remember its steps
  - cleanup cannot begin until verification is current, the pull request independently reports merged, and retro completed
  - normal and administrative merges occur only under their explicitly documented authority conditions
  - rerunning after any partial success safely continues without repeating completed destructive effects
  - unsafe or ambiguous cleanup targets remain untouched and appear in the final unresolved-items report
  - canonical, dogfood, Cursor, and Codex artifacts are synchronized and covered by real-collaborator parity tests
phase_anchors:
  - define-behavior: .project/tickets/93C14D-close-completed-sessions-safely/spec.md
  - scenario-gate: features/close-completed-sessions-safely.feature
created: 2026-08-02T20:41:09.906Z
last_modified: 2026-08-02T20:41:09.906Z
---

# Close completed sessions safely

**Goal:** Turn a green delivery into a confirmed merge and a verified clean session with retro and branch/worktree cleanup.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-02T20:41:09.906Z Started: Created ticket 93C14D
- 2026-08-02T22:35:00.000Z Intake: Confirmed the NTB and TBU jobs after a
  source-grounded quality review; carried applicable principles into seven
  observable closeout invariants.
- 2026-08-02T22:42:00.000Z Intake: Confirmed all seven Rules and narrowed the
  implementation to a canonical skill plus generated host adapters; kept a new
  CLI state machine, cloud lifecycle semantics, force cleanup, and bypasses out
  of scope.
- 2026-08-02T22:48:00.000Z Transition: Engineering scope confirmed; advanced
  from intake to define-behavior with spec.md as the phase anchor.
- 2026-08-02T23:05:00.000Z Define behavior: Derived ten state dimensions and
  authored 21 scenario declarations across all seven Rules, including merge
  queues, partial success, mandatory retro, exact cleanup, and host parity.
- 2026-08-02T23:12:00.000Z Transition: User confirmed the scenario set covers
  intended behavior and important boundaries; advanced to scenario-gate.
- 2026-08-02T23:25:00.000Z Scenario gate: Independent review found four
  must-fix and three strengthening gaps; applied all seven, adding explicit PR
  identity rejection, branch-only cleanup, and real installed-host wiring.
- 2026-08-02T23:36:00.000Z Scenario gate: Fresh re-review found one remaining
  gap in the every-unresolved-item invariant; added a simultaneous-blockers
  scenario and returned to define-behavior for confirmation.
- 2026-08-02T23:41:00.000Z Transition: User confirmed the expanded 25-scenario
  set; re-entered scenario-gate for the clean pass.
- 2026-08-02T23:48:00.000Z Scenario gate: Final review caught the exit-zero
  counterexample; expanded the unconfirmed-result scenario to prove that both
  successful and failed merge commands require independent merged-state
  observation, then returned to define-behavior.
- 2026-08-02T23:52:00.000Z Define behavior: User confirmed the exit-zero case
  and declined the >15-scenario split suggestion; keeping one feature because
  all behavior forms one ordered closeout contract implemented by one skill.
- 2026-08-02T21:41:11.000Z Scenario gate: Fresh independent review approved
  all 25 scenario declarations with zero must-fix findings and no build-only
  kill-risk; advanced to implementation planning without a spike.
- 2026-08-02T22:05:42.000Z Plan implementation: Independent challenge drove
  destructive cleanup into a digest-bound guard with current verification,
  hook-bound retro identity, exact PR/repository/ref checks, and hash-bound
  semantic review evidence. Fresh final review approved with zero must-fix
  findings; seven build tasks, four components, no ADR, split still declined.
- 2026-08-02T23:35:30.000Z Implement: Shipped the canonical closeout contract,
  deterministic guard, exact-session bindings, generated host adapters,
  schema/catalogue registration, documentation, real-Git and installed-profile
  integration coverage, and a hash-bound independent manual-review gate.
- 2026-08-02T23:50:30.000Z Implement: Hash-bound review failed closed on
  generic retro recovery, an unbound outside-worktree case, and insufficiently
  bound parity evidence. Added typed recovery causes, delivery-worktree identity,
  and production parity mutations; corrected one stale evidence SHA. Fresh review
  recomputed all ten hashes and approved all 55 expanded examples.
- 2026-08-03T00:17:00.000Z Implement: Final quality review reproduced a
  destructive newline-path worktree omission and rejected an over-strong host
  proof claim. Switched to NUL-delimited Git porcelain with a real adversarial
  worktree, narrowed the claim to the exercised evidence, and completed the
  leaf-first refactor ledger with every remaining entry resolved or justified.
