# Test Definitions: Finish accepted changes before asking for PR review

Feature source: `features/finish-delivery-before-pr-readiness.feature`

test-definitions.md is the R/G/R ledger.

## Rule: prodigy-flow.TBU1.PY73VN.R1 — Successful TDD steps advance without routine prompts

### Scenario: RED advances directly into implementation

- [x] RED b2778dec4
- [ ] GREEN
- [ ] REFACTOR

### Scenario: GREEN advances through refactor to the next incomplete scenario

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unsuccessful TDD step remains at the failing step

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prodigy-flow.TBU1.PY73VN.R2 — Completed scenarios trigger whole-ticket closeout

### Scenario: Final scenario advances through verified ticket closure on every installed host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Whole-ticket review advances into verification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Verification advances into recorded ticket closure

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed verification preserves the open ticket

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prodigy-flow.TBU1.PY73VN.R3 — Verified done precedes PR readiness

### Scenario: Safeword installation ships the Ready gate to each enabled host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ready-gate installation preserves existing lifecycle configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ready-gate installation leaves a disabled host untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed host rejects direct Ready promotion before done

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ready promotion is rejected across unfinished ticket states

- [x] RED e2f3a1f58
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unreadable verification evidence fails Ready promotion closed

- [x] RED e2f3a1f58
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing or unresolvable ticket state fails Ready promotion closed

- [x] RED e2f3a1f58
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ready-by-default creation is rejected before verified done

- [x] RED 514440a98
- [x] GREEN 7ad6e09a0
- [x] REFACTOR skip: shared classifier and evaluator are already isolated behind thin host adapters

### Scenario: Ready denial gives a Non-Technical Builder a plain next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Draft creation remains available for evidence before done

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Draft creation returns delivery to the unfinished step

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ready promotion is allowed after verified done

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prodigy-flow.TBU1.PY73VN.R4 — Genuine boundaries interrupt resumably

### Scenario: A locally repairable missing dependency is restored without asking to continue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A genuine boundary stops at the blocked step with exact recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A genuine boundary stops at implementation instead of verification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unauthorized missing dependency stops for a decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A boundary gives a Non-Technical Builder a plain recovery action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery state controls resumption at every established stop point

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
