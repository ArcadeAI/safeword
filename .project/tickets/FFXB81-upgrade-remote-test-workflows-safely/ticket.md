---
id: FFXB81
slug: upgrade-remote-test-workflows-safely
type: feature
phase: intake
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
