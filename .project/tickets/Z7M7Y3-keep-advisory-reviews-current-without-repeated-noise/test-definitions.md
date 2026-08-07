# Test Definitions: Keep advisory reviews current without repeated noise

Feature source: `features/keep-advisory-reviews-current-without-repeated-noise.feature`

## Rule: Inert exclusions and no-review outcomes carry explicit evidence

### Scenario: An excluded artifact records why it is inert

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An all-inert change set produces an evidence-rich no-review receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Only proven immaterial updates may reuse a prior conclusion

### Scenario: A proven immaterial update creates an explicit freshness bridge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Uncertain materiality forces a fresh review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Finding identity suppresses unchanged noise and removes resolved findings

### Scenario: Cross-revision finding lifecycle reflects current evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Inline findings bind to the exact reviewed SHA and diff location

### Scenario: A consequential finding is published at its exact changed evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
