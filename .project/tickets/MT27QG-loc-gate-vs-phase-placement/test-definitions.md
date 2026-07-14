# Test Definitions — git-operation-aware LOC gate

Scenarios for the pure `isGitOperationInProgress` detector + two end-to-end gate
proofs. Lineage: `loc-gate-vs-phase-placement.TB1.AC<n>.<scenario>`.

## Rule: The detector identifies an in-progress git operation (AC1)

### Scenario: loc-gate-vs-phase-placement.TB1.AC1.merge_in_progress_is_detected

Given a git repo with a MERGE_HEAD marker present
When the detector runs
Then it returns true

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC1.rebase_in_progress_is_detected

Given a git repo with a rebase-merge (or rebase-apply) directory present
When the detector runs
Then it returns true

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC1.cherry_pick_in_progress_is_detected

Given a git repo with a CHERRY_PICK_HEAD marker present
When the detector runs
Then it returns true

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC1.revert_in_progress_is_detected

Given a git repo with a REVERT_HEAD marker present
When the detector runs
Then it returns true

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC1.loc_gate_does_not_arm_mid_merge

Given a repo with >400 lines of uncommitted non-meta changes AND a MERGE_HEAD marker
When the post-tool quality hook runs
Then the LOC gate is not armed (state.gate is not 'loc')

- [x] RED skip: end-to-end wiring proof written at GREEN; detector RED 999be3ed drove the logic
- [x] GREEN 5795409f
- [x] REFACTOR skip: integration test; no structural improvement needed

## Rule: The detector is false when nothing is in progress, and normal gating is unchanged (AC2)

### Scenario: loc-gate-vs-phase-placement.TB1.AC2.clean_repo_returns_false

Given a git repo with no operation markers
When the detector runs
Then it returns false

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC2.non_git_directory_returns_false

Given a directory that is not a git repo
When the detector runs
Then it returns false without throwing

- [x] RED 999be3ed
- [x] GREEN 5795409f
- [x] REFACTOR skip: pure detector; no structural improvement needed

### Scenario: loc-gate-vs-phase-placement.TB1.AC2.loc_gate_still_arms_with_no_operation

Given a repo with >400 lines of uncommitted non-meta changes AND no operation marker
When the post-tool quality hook runs
Then the LOC gate is armed (state.gate is 'loc') — blast-radius control unchanged

- [x] RED skip: end-to-end wiring proof written at GREEN; mirrors existing quality-gates LOC arming
- [x] GREEN 5795409f
- [x] REFACTOR skip: integration test; no structural improvement needed

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: one pure detector + two one-line guard clauses; nothing to factor across scenarios
