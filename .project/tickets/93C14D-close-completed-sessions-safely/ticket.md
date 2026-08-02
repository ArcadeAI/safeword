---
id: 93C14D
slug: close-completed-sessions-safely
type: feature
phase: implement
status: in_progress
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
