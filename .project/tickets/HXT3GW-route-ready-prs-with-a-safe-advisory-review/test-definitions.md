# Test Definitions: Route ready PRs with a safe advisory review

Feature source: `features/route-ready-prs-with-a-safe-advisory-review.feature`

Each scenario follows RED → GREEN → REFACTOR during implementation.

## Rule: Every eligible head receives exactly one automatic review

### Scenario: A ready revision is reviewed once at its exact head

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ineligible revision cannot acquire an advisory route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated triggers cannot produce another review attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every changed text artifact receives the same technology-neutral integrity floor

### Scenario: Changed text reaches the integrity reviewer without a technology-specific gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A consequential unfamiliar-artifact finding routes to a human

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The unfamiliar Flux policy regression routes to a human

_Selected live-model evaluation; excluded from deterministic CI._

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Only a complete clean current review may report looks ready

### Scenario: Evidence state conservatively determines the advisory route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every new head invalidates the old conclusion and requires a fresh review

### Scenario: A new head cannot inherit an earlier conclusion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The current receipt exposes what the review did and did not establish

### Scenario: Available and missing evidence remain distinguishable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Receipt findings are actionable without claiming approval or tested remedies

### Scenario: A consequential finding gives one evidence-bounded next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A no-finding result creates no reassuring comment noise

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Inspection and publication remain split across least-privilege boundaries

### Scenario: An untrusted fork is reviewed as data without execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adversarial pull-request text cannot expand authority or suppress human routing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The receipt cannot approve a PR or satisfy a required check

### Scenario: Publishing the receipt leaves GitHub merge eligibility unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] Shared contracts, fixtures, and helpers are coherent after all scenarios pass.
