# Test Definitions: {feature name}

<!--
Feature source: `features/<slug>.feature`.

test-definitions.md is the R/G/R ledger, not a second copy of the scenarios —
keep executable Given/When/Then steps in the `.feature` file, and keep only
scenario progress here so hooks can derive the active RED/GREEN/REFACTOR
step.

One `## Rule:` block per business rule, one `### Scenario:` entry per
scenario that proves it (names must match the `.feature` file). Fill in each
`{brace}` placeholder, then delete this comment — but leave every
`- [ ] RED` / `- [ ] GREEN` / `- [ ] REFACTOR` checkbox bare. Those aren't
placeholders to fill in now: hooks parse them literally, and they get their
real content (a commit SHA, or `skip: <reason>`) only as you actually work
through RED, GREEN, and REFACTOR for that scenario.
-->

## Rule: {business rule the scenarios below cover}

### Scenario: {scenario name from the feature file}

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: {second scenario name}

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: {another business rule}

### Scenario: {scenario name}

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at implement-exit (the whole-ticket quality-review + refactor pass): either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks a ticket with **two or more RGR loops** whose row is missing or has an empty skip reason; a single-loop ticket has nothing to cross and may leave it unmarked.

- [ ] cross-scenario
