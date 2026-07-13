# Test Definitions: Keep persona lineage readable for builders

Feature source: `packages/cli/features/keep-persona-lineage-readable.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Newly derived persona codes are canonical 3–4 letter identifiers

### Scenario: CLI and installed hooks derive the same canonical code

- [x] RED 83421c41
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A first collision stays inside the canonical length

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A name too short for a canonical code requests an explicit override

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted collision suffixes request an explicit override

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Existing explicit persona codes remain valid lineage anchors

### Scenario: A compatible explicit code resolves unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pre-existing legacy JTBD reference still resolves

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A code outside the compatibility bounds is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: One resolved code flows unchanged from personas.md through JTBD and Gherkin lineage

### Scenario: Installed assets prescribe one canonical lineage code

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed assets do not present two-letter defaults as canonical

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
