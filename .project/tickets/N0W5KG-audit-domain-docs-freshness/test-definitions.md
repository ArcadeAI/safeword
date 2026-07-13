# Test Definitions: Audit checks namespace domain docs for emptiness and drift

Feature source: `features/audit-domain-docs-freshness.feature`

test-definitions.md is the R/G/R ledger.

## Rule: audit-domain-docs.TB1.R1 — Surface drift is an error (E008)

### Scenario: Surface tag with no matching inventory entry is reported

- [x] RED 55efd801
- [x] GREEN 55efd801
- [x] REFACTOR 55efd801

### Scenario: Every referenced surface tag resolves, including multi-word headings

- [x] RED 55efd801
- [x] GREEN 55efd801
- [x] REFACTOR 55efd801

### Scenario: A surface defined in the inventory but referenced by no tag is not reported

- [x] RED 55efd801
- [x] GREEN 55efd801
- [x] REFACTOR 55efd801

### Scenario: A surface slug that appears only in prose is not treated as a reference

- [x] RED 55efd801
- [x] GREEN 55efd801
- [x] REFACTOR 55efd801

## Rule: audit-domain-docs.TB1.R2 — Persona drift is an error (E009)

### Scenario: Persona code named in a live spec Persona line but undefined is reported

- [x] RED 53b3f63a
- [x] GREEN 53b3f63a
- [x] REFACTOR 53b3f63a

### Scenario: Every persona code referenced in a live spec line resolves to an inventory entry

- [x] RED 53b3f63a
- [x] GREEN 53b3f63a
- [x] REFACTOR 53b3f63a

### Scenario: A persona code appearing only in a commented-out spec example is not reported

- [x] RED 53b3f63a
- [x] GREEN 53b3f63a
- [x] REFACTOR 53b3f63a

## Rule: audit-domain-docs.TB1.R3 — Empty domain doc is a warning with a fill offer (W008)

### Scenario: A verbatim surfaces scaffold is reported empty

- [x] RED be88ad48
- [x] GREEN be88ad48
- [x] REFACTOR be88ad48

### Scenario: A verbatim glossary scaffold is reported empty

- [x] RED be88ad48
- [x] GREEN be88ad48
- [x] REFACTOR be88ad48

### Scenario: A populated domain doc is not reported empty

- [x] RED be88ad48
- [x] GREEN be88ad48
- [x] REFACTOR be88ad48

### Scenario: An absent domain doc is skipped, not reported empty

- [x] RED be88ad48
- [x] GREEN be88ad48
- [x] REFACTOR be88ad48

### Scenario: An empty domain doc suppresses its own drift codes

- [x] RED 55efd801
- [x] GREEN 55efd801
- [x] REFACTOR 55efd801

## Rule: audit-domain-docs.TB1.R4 — Human-curated content is advisory only, never an error

### Scenario: A fully-populated, in-sync docs set produces no domain-doc findings

- [x] RED b599c826
- [x] GREEN b599c826
- [x] REFACTOR b599c826

### Scenario: Editing a curated definition changes no finding

- [x] RED b599c826
- [x] GREEN b599c826
- [x] REFACTOR b599c826

### Scenario: The skill instructs that glossary and description prose is advisory, never an error

- [x] RED b599c826
- [x] GREEN b599c826
- [x] REFACTOR b599c826
