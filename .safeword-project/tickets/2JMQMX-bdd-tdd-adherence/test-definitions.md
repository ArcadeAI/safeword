# Test Definitions — status-close done-gate

Scenarios for the pure `resolveStopPhase` decision + one end-to-end gate proof.
Lineage: `bdd-tdd-adherence.SM1.AC<n>.<scenario>`.

## Rule: A build ticket closed by status:done is routed into the done-gate (AC1)

### Scenario: bdd-tdd-adherence.SM1.AC1.feature_with_scenarios_closed_by_status_resolves_to_done

Given a feature ticket with a test-definitions.md, status `done`, phase `intake`
When the stop phase is resolved
Then it resolves to phase `done` (so the done-gate runs) with the ticket's type and folder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: bdd-tdd-adherence.SM1.AC1.task_with_scenarios_closed_by_status_resolves_to_done

Given a task ticket with a test-definitions.md, status `done`, phase `implement`
When the stop phase is resolved
Then it resolves to phase `done`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: bdd-tdd-adherence.SM1.AC1.build_ticket_without_test_definitions_is_exempt

Given a feature ticket with NO test-definitions.md, status `done`, phase `intake`
When the stop phase is resolved
Then it resolves to empty (no phase context) — a not-yet-worked ticket keeps the escape hatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: bdd-tdd-adherence.SM1.AC1.full_hook_blocks_feature_status_close_missing_verify

Given a feature ticket with scenarios complete but no verify.md, closed by setting status `done`
When the Stop hook runs end to end
Then it blocks the stop and names the missing verify.md (the surfaced done-phase reaches the real gate)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An epic closed by status:done is gated proportionately (AC2)

### Scenario: bdd-tdd-adherence.SM1.AC2.epic_closed_by_status_resolves_to_done

Given an epic ticket (no test-definitions.md), status `done`, phase `intake`
When the stop phase is resolved
Then it resolves to phase `done` — the gate will require verify.md + passing tests but not scenarios or skills (epic is not a feature)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Legitimate states are untouched (AC3)

### Scenario: bdd-tdd-adherence.SM1.AC3.in_progress_passes_through_actual_phase

Given an in_progress feature ticket at phase `implement`
When the stop phase is resolved
Then it resolves to phase `implement` (real phase passthrough — no change to normal flow)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: bdd-tdd-adherence.SM1.AC3.already_done_ticket_is_not_re_gated

Given a feature ticket with status `done` AND phase `done`
When the stop phase is resolved
Then it resolves to empty — already gated, so no re-gate loop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: bdd-tdd-adherence.SM1.AC3.patch_and_typeless_closes_are_exempt

Given a patch ticket and a typeless ticket, each status `done`, phase `intake`
When the stop phase is resolved
Then both resolve to empty — non-build closes keep the escape hatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
