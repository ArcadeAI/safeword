# Test Definitions: Converge spec grammar on a single Rule tier

Feature source: `features/rule-tier-convergence.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source.

## Rule: New authoring surfaces present only the Rule tier

### Scenario: The scaffolded spec template offers Rule headings as the criteria tier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No authoring surface still offers Acceptance Criteria as a co-equal tier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No authoring surface still states the one-criteria-kind-never-both doctrine

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A JTBD mixing AC and Rule headings is no longer an error

### Scenario: A JTBD declaring both an AC heading and a Rule heading raises no check issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A mixed JTBD's criteria are still traced for coverage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Coverage speaks one Rule vocabulary regardless of legacy spelling

### Scenario: An uncovered criterion is reported in Rule terms regardless of spelling

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Coverage drift is worded identically for a Rule id and a legacy AC id

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The intake-exit gate requires a Rule and names Rules when none is present

### Scenario: A JTBD declaring a numbered Rule satisfies the intake-exit gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A JTBD with no criteria and no skip is denied, naming the Rule heading to add

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A JTBD carrying a skip reason satisfies the intake-exit gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A JTBD whose skip line has no reason is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Legacy AC still parses, gates, and traces coverage unchanged

### Scenario: An AC-only spec satisfies the intake-exit gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A legacy AC reference is traced as covered exactly as before

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An AC-shaped tag under a persona-code-R JTBD parses as an AC, never a rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A terminal R tag under a persona-code-R JTBD parses as that JTBD's rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A legacy AC reference the spec never declared is still reported stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Using legacy AC surfaces a plain-language deprecation nudge, never a block

### Scenario: An in-progress spec using an AC heading draws a deprecation advisory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An in-progress feature using an AC tag draws a deprecation advisory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Rule-only in-progress ticket draws no deprecation advisory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed ticket still using AC draws no deprecation advisory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The deprecation nudge is a zero-exit advisory, not a blocking issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The codemod rewrites .AC to .R across specs, feature tags, and ledger refs

### Scenario: migrate-ac rewrites an AC reference to the same-numbered Rule reference

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A migrated declaration and its scenario reference stay linked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An AC tag carried on a Gherkin Rule block is rewritten like any other tag

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every AC under a JTBD with several criteria is migrated in one pass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The codemod leaves non-AC tokens untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The codemod is idempotent, previewable, and refuses collisions

### Scenario: Re-running migrate-ac on already-migrated files changes nothing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A dry run previews the rewrites without writing any file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An AC that would collide with an existing Rule number refuses the whole file, not a rename

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A collision in one file does not block migrating other files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
