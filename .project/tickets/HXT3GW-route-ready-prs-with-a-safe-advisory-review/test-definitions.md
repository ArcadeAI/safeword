# Test Definitions: Route ready PRs with a safe advisory review

Feature source: `features/route-ready-prs-with-a-safe-advisory-review.feature`

Each scenario follows RED → GREEN → REFACTOR during implementation.

## Rule: Every eligible head receives exactly one automatic review

### Scenario: A ready revision is reviewed once at its exact head

- [x] RED c3cdd85e6
- [x] GREEN a5df1d4d9
- [x] REFACTOR skip: first orchestration slice is already minimal and cohesive

### Scenario: A draft revision creates no receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pending prerequisite publishes a visible non-run receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A scheduled sweep reviews a pending head after prerequisites settle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A prerequisite that never appears remains conservatively pending

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed prerequisite publishes a terminal non-run receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing prerequisite configuration gives one concrete next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicit empty prerequisite list proceeds immediately

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repeated trigger cannot produce another review attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ineligible scheduled candidate invalidates its existing receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ineligible scheduled candidate creates no receipt when none exists

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every changed text artifact receives the same technology-neutral integrity floor

### Scenario: Changed text is visibly covered without a technology-specific gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-text artifact is visibly excluded instead of falsely covered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A skipped binary does not poison an otherwise complete clean review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A binary-only change set cannot look complete or ready

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence over budget cannot look complete or ready

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence exactly at the total-byte budget remains reviewable

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

### Scenario: Competing run conditions use conservative state precedence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every new head invalidates the old conclusion and requires a fresh review

### Scenario: Converting a reviewed pull request to draft removes its advisory route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new head cannot inherit an earlier conclusion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new head updates the sole receipt instead of adding comment noise

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Publication reconciles duplicate marker-owned receipts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Receipt reconciliation preserves comments Safeword does not own

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The current receipt exposes what the review did and did not establish

### Scenario: Available evidence is reported with its actual values

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable evidence remains unknown instead of looking successful

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Receipt findings are actionable without claiming approval or tested remedies

### Scenario: A consequential finding gives one evidence-bounded next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A clean current review creates no reassuring comment noise

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-consequential finding remains visible on a looks-ready receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Inspection and publication remain split across least-privilege boundaries

### Scenario: An untrusted fork is reviewed as data without execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing audit evidence blocks publication

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
