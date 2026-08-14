---
id: 07VEZF
slug: resume-closeout-after-upgrade
type: feature
phase: scenario-gate
status: in_progress
scope:
  - persist an observed closeout PR identity when the current Codex task cannot supply a protected closeout binding
  - surface and atomically claim the repository-bound handoff in the next matching protected Codex SessionStart
  - expire stale handoffs and remove them only after successful guarded cleanup
  - prove real persistence, restart discovery, repository binding, single-consumer behavior, and fresh target revalidation
out_of_scope:
  - carrying merge or cleanup authority across tasks
  - selecting or impersonating the original task transcript
  - general Codex task persistence or handoff of arbitrary work
  - Claude Code, Cursor, or cloud-agent restart semantics
  - defending profile-owned advisory files from an active same-user process racing filesystem operations after validation
  - power-loss durability beyond atomic visibility of one complete old or new record
done_when:
  - a matching new Codex task discovers the exact pending PR without user-supplied identifiers
  - foreign, expired, malformed, or already-claimed handoffs do not authorize or trigger cleanup
  - resumed closeout uses the existing guard to re-observe every target and authority boundary
  - successful cleanup clears the handoff while failed attempts remain recoverable until expiry
inspiration_contract: v1
inspiration_contract_scaffold: v1
parent: KMB053
created: 2026-08-13T18:15:59.751Z
last_modified: 2026-08-13T18:15:59.751Z
---

# Resume interrupted closeout after a Codex upgrade

**Goal:** Carry exact pending closeout targets safely into the next protected Codex task.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-13T18:15:59.751Z Started: Created ticket 07VEZF
- 2026-08-13T18:26:00.000Z Intake: Confirmed NTB and TBU restart-continuation jobs, repository-bound single-consumer rules, expiry, fresh target revalidation, and no transferred authority; advanced to define behavior.
- 2026-08-13T18:35:00.000Z Scenario gate: Defined restart, expiry, repository isolation, atomic claim, target drift, and recovery behaviors for independent review.
- 2026-08-13T19:00:00.000Z Scenario gate: Cross-agent review requested stronger single-deviation rejection proofs, exact expiry, stale-claim recovery, normal-path non-persistence, and observable non-destructive reporting; revised the feature and ledger.
- 2026-08-13T19:05:00.000Z Scenario gate: Added current-profile provenance, hostile identity rejection, protected-host isolation, exact contention and split-brain outcomes, unambiguous target drift observations, dedup boundaries, and claim cleanup after two further adversarial passes.
- 2026-08-14T07:20:00.000Z Scenario gate: Cross-agent Opus review requested explicit invalid-record replacement, lowercase and integer identity boundaries, non-mutating expiry, atomic cleanup-failure scenarios, and mechanical scenario-to-proof binding; revised the behavior source and proof requirements.
- 2026-08-14T07:25:00.000Z Scenario gate: Clarified write-authorization precedence, missing-marker startup behavior, malformed-record repository matching, absent provenance, and the bounded resource-exhaustion threat model after cross-agent review.
- 2026-08-14T07:48:00.000Z Scenario gate: Unified unprotected startup output and specified current-owner idempotence, atomic multi-record replacement, and recovery after cleanup already completed.
- 2026-08-14T07:55:00.000Z Scenario gate: Closed the final ambiguity fixture, current-owner identity-conflict, discovery precedence, cleanup precedence, and store-key mismatch cells identified by independent review.
- 2026-08-14T08:08:00.000Z Scenario gate: Made foreign-claim absence observable, distinguished claimed idempotence from conflicts, isolated unrelated malformed records on read and write, and specified partial-cleanup recovery state.
- 2026-08-14T09:03:00.000Z Scenario gate: Proved foreign-unusable silence, every adjacent discovery and cleanup precedence boundary, discovery integer boundaries, and removed the last vacuous or duplicated steps before remote verification.
