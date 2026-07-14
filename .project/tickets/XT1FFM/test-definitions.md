# Test Definitions: Scenario-lineage numbering (XT1FFM)

<!-- Scenario titles dogfood the scheme this feature ships:
     <jtbd-id>.AC<#>.<scenario_name>, jtbd-id = cross-reference-numbering.TB1.
     AC1 = the title→AC-ref parse; AC2 = the `safeword check` coverage report. -->

## Rule: A scenario title parses to its AC reference, or to none

### Scenario: cross-reference-numbering.TB1.AC1.conformant_title_yields_ac_ref

Given a scenario title `oauth-flow.PO1.AC2.change_association_applies`
When the title is parsed for its AC reference
Then it yields the AC ref `oauth-flow.PO1.AC2`

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC1.free_text_title_yields_no_ref

Given a free-text scenario title `A JTBD with at least one AC passes`
When the title is parsed for its AC reference
Then it yields no AC ref

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

## Rule: `safeword check` reports coverage gaps in three buckets

> Rationale: uncovered / stale-ref / orphan are different defects with different
> fixes (write a scenario · correct the AC# · delete-or-repoint the scenario), so
> they surface as distinct findings rather than one undifferentiated "orphan".

### Scenario: cross-reference-numbering.TB1.AC2.covered_ac_not_flagged

Given a spec.md AC and a test-definitions.md with a conformant scenario referencing it
When `safeword check` builds the coverage report
Then that AC produces no finding

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC2.uncovered_ac_flagged

Given a spec.md AC that no scenario references
When `safeword check` builds the coverage report
Then it reports that AC in the uncovered bucket

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC2.stale_ac_ref_flagged

Given a scenario whose ref names a real JTBD but an AC number that JTBD does not have
When `safeword check` builds the coverage report
Then it reports that scenario in the stale-AC-ref bucket

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC2.orphan_scenario_flagged

Given a scenario whose ref names a JTBD absent from spec.md
When `safeword check` builds the coverage report
Then it reports that scenario in the orphan bucket

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC2.multiple_scenarios_per_ac_covered

Given a spec.md AC referenced by two distinct conformant scenarios
When `safeword check` builds the coverage report
Then the AC is counted once as covered and produces no finding

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

## Rule: The coverage report degrades quietly when inputs are absent

### Scenario: cross-reference-numbering.TB1.AC2.spec_acs_without_test_definitions_no_flags

Given a ticket whose spec.md has ACs but which has no test-definitions.md
When `safeword check` builds the coverage report
Then it produces no findings (coverage is not evaluated before scenarios exist)

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

### Scenario: cross-reference-numbering.TB1.AC2.no_acs_yields_empty_report

Given a ticket with no ACs (or no spec.md)
When `safeword check` builds the coverage report
Then the report is empty

- [x] RED 4e54813f
- [x] GREEN 6bf6b2cd
- [x] REFACTOR skip: pure parser/report; structural cleanup folded into GREEN, no per-scenario refactor

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [x] cross-scenario skip: scenarios already share buildCoverageReport + the parser helpers; no cross-scenario duplication left to extract
