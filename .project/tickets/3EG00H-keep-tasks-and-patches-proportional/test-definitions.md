# Test Definitions: Keep tasks and patches proportional

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU3.3EG00H.R1 — Formal planning phases remain feature-only

### Scenario Outline: Planning ceremony follows work type

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Installed hosts apply feature ceremony only after classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R2 — Work classification has explicit precedence

### Scenario Outline: The first applicable work contract wins

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R3 — Patches exclude feature triggers

### Scenario: A tiny public-contract change cannot be labeled a patch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R4 — Consequential unresolved choices make work a feature

### Scenario Outline: Feature classification follows unresolved decision risk

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R5 — Tasks are the total residual classification

### Scenario: Broad residual work remains task work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unfamiliar residual work still receives a task classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R6 — Size signals trigger reevaluation rather than decide type

### Scenario Outline: File count cannot override semantic work type

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Crossing a size signal triggers semantic reevaluation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R7 — Tasks use inline test specifications

### Scenario: Installed task planning writes inline test specifications

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R8 — Behavior-changing tasks begin with meaningful RED

### Scenario: Production changes are blocked before meaningful RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Meaningful RED permits the production change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed lifecycle dispatch enforces meaningful RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R9 — Proof method follows the kind of small work

### Scenario: A behavior-preserving task reuses adequate existing proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A behavior-preserving task creates characterization proof when coverage is absent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An existing but inadequate test does not replace characterization proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-behavioral patch uses targeted verification without forced RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R10 — TDD may settle reversible local implementation choices

### Scenario: A local reversible choice does not promote a task

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R11 — TDD stops when it exposes a feature-triggering decision

### Scenario: Promotion preserves completed proof instead of guessing a contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Promotion before RED stops without inventing evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R12 — Newly discovered decisions return to the right layer

### Scenario Outline: A promoted task resumes at the layer that owns its new choice

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Out-of-scope discoveries route by consequence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ordinary feature work uses the same decision return routes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU3.3EG00H.R13 — Structural enforcement does not claim semantic classification

### Scenario: Installed checks distinguish structural validity from semantic classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed classification failure cannot silently bypass feature ceremony

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
