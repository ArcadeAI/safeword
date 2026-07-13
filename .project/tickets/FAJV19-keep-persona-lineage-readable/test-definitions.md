# Test Definitions: Keep persona lineage readable for builders

Feature source: `packages/cli/features/keep-persona-lineage-readable.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Newly derived persona codes are canonical 3–4 letter identifiers

### Scenario: CLI and installed hooks derive the same canonical code

- [x] RED 83421c41
- [x] GREEN 91bdc3be
- [x] REFACTOR skip: duplicated derivation is the required installed-hook boundary and both copies are already concise

### Scenario: A first collision stays inside the canonical length

- [x] RED 21f535a2
- [x] GREEN a00663f6
- [x] REFACTOR skip: allocation is extended by the next exhaustion scenario, so extracting its final shape now would be premature

### Scenario: A name too short for a canonical code requests an explicit override

- [x] RED e0949b03
- [x] GREEN 7e2701d0
- [x] REFACTOR skip: the discriminator and validation branch are already the smallest clear representation

### Scenario: Exhausted collision suffixes request an explicit override

- [x] RED cdfe8581
- [x] GREEN f457a265
- [x] REFACTOR skip: bounded allocation is centralized in one helper at each required runtime boundary

## Rule: Existing explicit persona codes remain valid lineage anchors

### Scenario: A compatible explicit code resolves unchanged

- [x] RED skip: compatibility is existing behavior pinned with characterization coverage
- [x] GREEN 892683c7
- [x] REFACTOR skip: the persisted compatibility pattern remains the single explicit-code validator

### Scenario: A pre-existing legacy JTBD reference still resolves

- [x] RED 99c701ab
- [x] GREEN ac823076
- [x] REFACTOR skip: legacy derivation is isolated behind one compatibility helper per runtime boundary

### Scenario: A code outside the compatibility bounds is rejected

- [x] RED skip: the existing 2–6 character boundary tests already reject one and seven characters
- [x] GREEN 892683c7
- [x] REFACTOR skip: explicit compatibility bounds remain expressed by one anchored regular expression

## Rule: One resolved code flows unchanged from personas.md through JTBD and Gherkin lineage

### Scenario: Installed assets prescribe one canonical lineage code

- [x] RED c85a35d0
- [x] GREEN 3deafda9
- [x] REFACTOR skip: one documentation contract table covers source plus installed Claude, Codex, and Cursor assets

### Scenario: Installed assets do not present two-letter defaults as canonical

- [x] RED c85a35d0
- [x] GREEN 3deafda9
- [x] REFACTOR skip: canonical examples and the legacy note share the persona scaffold as their source of truth

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 03375975
