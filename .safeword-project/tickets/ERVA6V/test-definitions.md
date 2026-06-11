# Test Definitions: Plan-vs-actual reconciliation at implement exit

## Rule: The stop-hook gate requires an implemented plan from verify onward

### Scenario: plan-reconciliation.SM1.AC1.planned_at_verify_blocks

Given a new-flow feature ticket at phase `verify` whose folder contains spec.md, a test-definitions.md with scenarios, and a valid impl-plan.md with `**Status:** planned`
When the stop hook runs its cumulative artifact checks
Then it hard-blocks with a message naming the reconciliation step and impl-plan.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: plan-reconciliation.SM1.AC1.missing_plan_at_verify_blocks

Given a new-flow feature ticket at phase `verify` whose folder contains spec.md and a test-definitions.md with scenarios but no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it hard-blocks requiring impl-plan.md (the existence gate extends to verify with this ticket)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: plan-reconciliation.SM1.AC1.implemented_at_verify_passes

Given a new-flow feature ticket at phase `verify` whose folder contains spec.md, a test-definitions.md with scenarios, and a valid impl-plan.md with `**Status:** implemented`
When the stop hook runs its cumulative artifact checks
Then it does not block on the impl-plan status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: plan-reconciliation.SM1.AC1.planned_at_implement_is_allowed

Given a new-flow feature ticket at phase `implement` with a valid impl-plan.md whose status is `planned`
When the stop hook runs its cumulative artifact checks
Then it does not block on the impl-plan status (the plan is legitimately planned during implementation)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: plan-reconciliation.SM1.AC1.planned_at_done_blocks

Given a new-flow feature ticket at phase `done` whose folder contains spec.md and a valid impl-plan.md with `**Status:** planned`
When the stop hook runs its cumulative artifact checks
Then it hard-blocks with a message naming the reconciliation step and impl-plan.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Exemptions mirror the impl-plan existence gate

### Scenario: plan-reconciliation.SM1.AC2.grandfathered_ticket_is_exempt

Given a feature ticket at phase `verify` whose folder contains a test-definitions.md with scenarios but no spec.md and no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it does not block on the impl-plan status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: plan-reconciliation.SM1.AC2.task_ticket_is_exempt

Given a task ticket at phase `verify` with no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it does not block on the impl-plan status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: TDD.md teaches the reconciliation procedure end to end

### Scenario: plan-reconciliation.DEV1.AC1.docs_show_reconciliation_in_both_copies

Given the canonical skill files (packages/cli/templates/skills/bdd) and the dogfood copies (.claude/skills/bdd)
When TDD.md is scanned in both copies
Then each copy contains, as separately-asserted markers: (a) the implement-exit reconciliation step walking Decisions, Arch alignment, and Assessment triggers, (b) the `**Status:** planned` → `implemented` flip, and (c) a worked example showing a planned decision that changed mid-implementation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [ ] cross-scenario
