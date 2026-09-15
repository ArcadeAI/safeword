# Test Definitions: Finish accepted changes before asking for PR review

Feature source: `features/finish-delivery-before-pr-readiness.feature`

test-definitions.md is the R/G/R ledger.

## Rule: prodigy-flow.TBU1.PY73VN.R1 — Successful TDD steps advance without routine prompts

### Scenario: RED advances directly into implementation

- [x] RED b2778dec4
- [x] GREEN 2fe761182
- [x] REFACTOR skip: one canonical transition sentence is already the smallest shared contract

### Scenario: GREEN advances through refactor to the next incomplete scenario

- [x] RED 95b8df382
- [x] GREEN 1b1bca038
- [x] REFACTOR skip: adjacent transition sentences already form the smallest canonical contract

### Scenario: An unsuccessful TDD step remains at the failing step

- [x] RED db7842358
- [x] GREEN 3bb26177e
- [x] REFACTOR skip: explicit outcome rows are the smallest clear failure contract

## Rule: prodigy-flow.TBU1.PY73VN.R2 — Completed scenarios trigger whole-ticket closeout

### Scenario: Final scenario advances through verified ticket closure on every installed host

- [x] RED e3dcb6589
- [x] GREEN e8f5a7ff2
- [x] REFACTOR skip: one ordered transition sentence is already the smallest shared contract

## Rule: prodigy-flow.TBU1.PY73VN.R3 — Verified done precedes PR readiness

### Scenario: Safeword installation ships the Ready gate to each enabled host

- [x] RED a7fb4bbd3
- [x] GREEN 6bb92a6a6
- [x] REFACTOR skip: generated Claude payload is the single-source template output and adds no handwritten duplication

### Scenario: Ready promotion is rejected across unfinished ticket states

- [x] RED e2f3a1f58
- [x] GREEN cfca2afad
- [x] REFACTOR skip: the shared evaluator already isolates state partitions behind thin host adapters

### Scenario: Unreadable verification evidence fails Ready promotion closed

- [x] RED e2f3a1f58
- [x] GREEN cfca2afad
- [x] REFACTOR skip: unreadable evidence is one explicit evaluator branch with no duplicate host logic

### Scenario: Missing or unresolvable ticket state fails Ready promotion closed

- [x] RED e2f3a1f58
- [x] GREEN cfca2afad
- [x] REFACTOR skip: ticket resolution and recovery wording remain centralized in the shared evaluator

### Scenario: Ready-by-default creation is rejected before verified done

- [x] RED 514440a98
- [x] GREEN 7ad6e09a0
- [x] REFACTOR skip: shared classifier and evaluator are already isolated behind thin host adapters

### Scenario: Ready denial gives a Non-Technical Builder a plain next action

- [x] RED 53a7cec47
- [x] GREEN 7cdcda727
- [x] REFACTOR skip: one optional human-facing channel flag keeps readiness-specific text precise

### Scenario: Draft creation remains available for evidence before done

- [x] RED skip: preservation scenario was already green before the readiness gate and cannot honestly expose missing behavior
- [x] GREEN 38d18528f
- [x] REFACTOR skip: the two-branch classifier is the smallest explicit Draft carve-out

### Scenario: Draft creation returns delivery to the unfinished step

- [x] RED 8cbf6390d
- [x] GREEN f4d5d10a8
- [x] REFACTOR skip: one canonical directive and generated copies need no structural cleanup

### Scenario: Ready promotion is allowed after verified done

- [x] RED 2e759cf60
- [x] GREEN cad831b23
- [x] REFACTOR skip: the evaluator's single successful terminal return is already minimal

### Scenario: Verified closure advances to PR-readiness classification without automatic promotion

- [x] RED 0c926e7c2
- [x] GREEN b76663412
- [x] REFACTOR skip: one transition sentence extends the existing ordered closeout chain without duplication

## Rule: prodigy-flow.TBU1.PY73VN.R4 — Genuine boundaries interrupt resumably

### Scenario: A locally repairable missing dependency is restored without asking to continue

- [x] RED 39c65db1d
- [x] GREEN 044f4100b
- [x] REFACTOR skip: one manifest-authority sentence is the smallest workflow contract

### Scenario: A genuine boundary stops at the blocked step with exact recovery

- [x] RED e4fdb55bb
- [x] GREEN 47c73c4e2
- [x] REFACTOR skip: one compact recovery matrix distinguishes all four boundary types

### Scenario: A genuine boundary stops at implementation instead of verification

- [x] RED 691edcfff
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
