# Test Definitions: Qualify additional reviewer pairs without retiring the existing pair

Feature source: `features/qualify-additional-reviewer-pairs.feature`

Written 2026-11-03, after implementation. Tests and code landed together before this ticket existed, so no RED commit exists; each RED row records that, and each GREEN row is gated on an executable-red review that runs the bound test against pre-change `f211c4c30` (the new test files overlaid on the old code in `.project/tmp/red-base/`).

## Rule: qualify-additional-reviewer-pairs.SWM1.R1 — Each pinned pair has its own revision, and the shipped pair's revision is unchanged

### Scenario: The latest pinned pair gets its own settings revision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The shipped pair keeps its exact settings digest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: qualify-additional-reviewer-pairs.SWM1.R2 — A capability record counts only for the pinned pair it was qualified with

### Scenario: Each pinned pair is admitted at its own settings revision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second qualified pair is admitted through planning review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: qualify-additional-reviewer-pairs.SWM1.R3 — Only pairs with complete, matching sealed evidence enter the shipped catalogue

### Scenario: Partial, cross-pair or shared-model evidence is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Rescoring refuses partial or mismatched evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The catalogue emits only pinned pairs with complete evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
