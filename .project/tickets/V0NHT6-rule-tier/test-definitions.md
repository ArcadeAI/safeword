# Test Definitions: Numbered Rule tier between JTBD and scenarios

Feature source: `features/rule-tier.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A JTBD can carry Rules in place of ACs

### Scenario: R-only JTBD satisfies the intake-exit gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JTBD with neither criteria kind is denied naming Rules as an option

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JTBD with a skip line still satisfies the gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A JTBD declares one criteria kind, never both

### Scenario: Mixed AC and Rule JTBD is flagged as a check issue

- [x] RED 5c4e0d9
- [x] GREEN de2fe00
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Mixed JTBD still passes the intake-exit gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Rule blocks carry authoritative tags and scenarios inherit exactly one lineage reference

### Scenario: Scenarios under an ID-tagged Rule block pass lineage lint by inheritance

- [x] RED 4cce165
- [x] GREEN 74238fe
- [x] REFACTOR skip: pure parser extension; structure stayed clean at GREEN, no per-scenario refactor

### Scenario: A scenario carrying a rule lineage tag directly passes lineage lint

- [x] RED 4cce165
- [x] GREEN 74238fe
- [x] REFACTOR skip: pure parser extension; structure stayed clean at GREEN, no per-scenario refactor

### Scenario: A second lineage reference under an ID-tagged Rule block is rejected

- [x] RED 4cce165
- [x] GREEN 74238fe
- [x] REFACTOR skip: pure parser extension; structure stayed clean at GREEN, no per-scenario refactor

### Scenario: A tag ending in an AC segment parses as an AC reference, never a rule reference

- [x] RED 205f30e
- [x] GREEN d567582
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Rule block whose name token disagrees with its tag is rejected

- [x] RED 31defdf
- [x] GREEN 6dfe1fb
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: A tag expression on a rule ID runs exactly that rule's scenarios

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Check reports rule drift against the spec catalog

### Scenario: Spec rule with no referencing scenario is reported uncovered

- [x] RED 5c4e0d9
- [x] GREEN de2fe00
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Rule reference with a missing rule number is reported stale

- [x] RED 5c4e0d9
- [x] GREEN de2fe00
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Rule reference whose JTBD is absent is reported orphan

- [x] RED 5c4e0d9
- [x] GREEN de2fe00
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

## Rule: A rule with no rejection path is visible

### Scenario: Numbered rule with no rejection scenario draws an advisory

- [x] RED ca0b68f
- [x] GREEN 8a69816
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Numbered rule with a rejection scenario is silent

- [x] RED 5c4e0d9
- [x] GREEN de2fe00
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Unnumbered Rule block draws no zero-rejection advisory

- [x] RED ca0b68f
- [x] GREEN 8a69816
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

## Rule: Non-adopters see zero change

### Scenario: AC-only project output is unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An existing rule-numbered corpus is expressible

### Scenario: Per-JTBD numbered Rule corpus passes lint without restructuring

- [x] RED 4cce165
- [x] GREEN 74238fe
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

### Scenario: Per-JTBD numbered Rule corpus resolves every reference in coverage

- [x] RED 205f30e
- [x] GREEN d567582
- [x] REFACTOR skip: pure parser/report extension; structure stayed clean at GREEN

## Rule: Rule warnings are plain-language and actionable

### Scenario: Rule-tier message names the id, the problem, and the next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
