# Test Definitions: plan-implementation phase before TDD

Feature source: `features/plan-implementation-phase.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementation-phase.TB1.R1 — a new-flow feature cannot enter implement without a valid implementation plan

### Scenario: Feature with a valid plan advances into implement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Feature without a plan is denied entry to implement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Feature with an incomplete plan is denied entry to implement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plan still marked implemented from a replan loop is denied entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy feature without spec.md is grandfathered past the plan gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Task tickets reach implement without a plan requirement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

## Rule: plan-implementation-phase.TB1.R2 — a ticket interrupted mid-planning resumes into planning work, not scenario re-validation

### Scenario: Resume guidance routes a planning-phase ticket to the planning doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prompt guidance during planning names the planning work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB1.R3 — the scenario-gate exit judges only scenario quality

### Scenario: Scenario-gate exit contains only scenario-quality steps

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The planning phase doc owns the impl-plan authoring steps

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No shipped surface still claims the plan is authored at scenario-gate exit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.NTB1.R1 — application code stays untouched while a feature ticket is in the planning phase

### Scenario: Application-code edit during planning is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ticket artifacts stay editable during planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

## Rule: plan-implementation-phase.NTB1.R2 — a planning-gate denial names the missing artifact and the concrete next action in plain language

### Scenario: Transition denial explains what is missing and what to do next

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R1 — every phase-keyed surface carries a plan-implementation entry

### Scenario: Canonical phase order places plan-implementation between scenario-gate and implement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A feature at scenario-gate advances one step into plan-implementation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Jumping from scenario-gate straight to implement is denied as a skipped phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A justified skip past plan-implementation is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

### Scenario: A jump from intake to done names all five skipped phases

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stopping at plan-implementation without the scenario ledger is blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stopping mid-planning without a plan yet is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

### Scenario: Splitting guidance is remapped to the planning phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R2 — the phase doc ships with full cross-harness parity

### Scenario: The planning phase doc ships to all three harnesses

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R3 — the decomposition-retirement ADR is superseded on the record

### Scenario: The architecture record supersedes the decomposition retirement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
