---
id: FFXB81
slug: upgrade-remote-test-workflows-safely
type: feature
phase: implement
phase_skips:
  - define-behavior: Intake confirmation and the behavior artifacts were captured atomically while activating this previously deferred compatibility ticket.
phase_anchors:
  - define-behavior: .project/tickets/FFXB81-upgrade-remote-test-workflows-safely/spec.md
  - scenario-gate: packages/cli/features/upgrade-remote-test-workflows-safely.feature
status: in_progress
scope:
  - Recognize every previously released remote-test workflow identity
  - Replace an admitted historical workflow with the current workflow without exposing partial bytes
  - Prove interruption, residue, retry, and packaged-CLI migration behavior
out_of_scope:
  - First-time workflow setup and current-byte disable (HWZZJ8)
  - Workflow authority and dependency admission (GRDXXA)
  - Remote dispatch and result handling (S2TF4J)
done_when:
  - Every superseded released workflow remains an immutable admitted identity
  - Packaged setup upgrades each admitted predecessor without overwriting customer bytes
  - Failure or interruption leaves a complete old or new workflow and retry converges
  - A release contract blocks changing current workflow bytes until this migration lane is green
parent: HWZZJ8
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-17T02:59:47.682Z
last_modified: 2026-08-17T02:59:47.682Z
---

# Upgrade remote-test workflows safely

**Goal:** Let customers upgrade previously released Safeword test workflows without overwriting their CI or leaving partial workflow files.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-17T02:59:47.682Z Started: Created ticket FFXB81
- 2026-08-16 Deferred deliberately: no released predecessor exists. Activate before proposing the second workflow version; HWZZJ8's v1 fixture and release-contract test are the tripwire.
- 2026-08-18 Activated: the stack-neutral workflow revision is v2. The released v1 bytes are frozen in `tests/fixtures/remote-workflow-v1.yml` and admitted by normalized SHA-256 only.
- 2026-08-18 Implemented: setup atomically replaces only an exact admitted predecessor; current and customer-owned bytes retain their existing behavior. Focused config, CLI, contract, state, filesystem, lifecycle, and catalogue verification passed (6 files, 115 tests).
- 2026-08-18 Intake confirmed: exact released identities are the ownership boundary; customer edits remain customer-owned; migration and retry are the only added behaviors.
- 2026-08-18 Defined five scenarios across exact ownership, setup/disable, interruption, and retry; two interruption scenarios remain for outside-in TDD.
- 2026-08-18 Scenario review requested changes: made v1→v2 identity explicit, added customer-owned disable coverage, and bound interruption/retry to revalidation, private preparation, and foreign-residue outcomes.
- 2026-08-18 Revised scenario review narrowed the feature to historical-only behavior, added complete revalidation partitions, and made atomic visibility directly observable; base lifecycle boundaries remain with HWZZJ8.
- 2026-08-18 Final scenario revisions replaced free-running sampling with a deterministic publication witness, drove revalidation through real concurrent path changes, added CLI refusal outcomes, and removed the unowned execution-sandbox surface.
- 2026-08-18 Scenario gate passed: 11 scenario instances received an independent cross-agent AODI review; no blocking findings remain.
- 2026-08-18 Plan review found historical disable lacked commit-time revalidation; returned to the scenario gate with a concurrent-edit rejection case before implementation.
- 2026-08-18 Revised scenario gate passed independently with 11 scenario titles and 16 example instances; no blocking findings remain.
- 2026-08-18 Plan review found the commit-time current-workflow state unowned; returned to the scenario gate so setup converges and disable remains authorized when another process installs current bytes.
- 2026-08-19 Behavior-only scenario gate passed independently with 12 scenario titles and 17 example instances; no blocking findings remain.
- 2026-08-19 Plan review resolved commit-time absence explicitly: setup publishes the prepared successor and disable succeeds because absence is already its goal state.
- 2026-08-19 Scenario review closed the CRLF ownership boundary: setup and disable now prove that a customer-added lone carriage return remains customer-owned on both LF and CRLF checkouts.
- 2026-08-19 Scenario gate passed independently with 12 scenario titles and 19 example instances; no blocking findings remain.
- 2026-08-19 Plan review assigned the line-ending fixture guard to the load-bearing integration step: tests seed explicit runtime bytes and fail before execution if CRLF was normalized away.
- 2026-08-19 Implementation plan passed independent cross-agent review; advanced to TDD with the commit-time revalidation proof first.
