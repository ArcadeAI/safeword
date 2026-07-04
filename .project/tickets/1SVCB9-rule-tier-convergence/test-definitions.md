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

- [x] RED 6ef0a77
- [x] GREEN 6ef0a77
- [x] REFACTOR 6ef0a77

### Scenario: A mixed JTBD's criteria are still traced for coverage

- [x] RED 6ef0a77
- [x] GREEN 6ef0a77
- [x] REFACTOR 6ef0a77

## Rule: Coverage speaks one Rule vocabulary regardless of legacy spelling

### Scenario: An uncovered criterion is reported in Rule terms regardless of spelling

- [x] RED 6ef0a77
- [x] GREEN 6ef0a77
- [x] REFACTOR 6ef0a77

### Scenario: Coverage drift is worded identically for a Rule id and a legacy AC id

- [x] RED 6ef0a77
- [x] GREEN 6ef0a77
- [x] REFACTOR 6ef0a77

## Rule: The intake-exit gate requires a Rule and names Rules when none is present

### Scenario: A JTBD declaring a numbered Rule satisfies the intake-exit gate

- [x] RED 194caea
- [x] GREEN 194caea
- [x] REFACTOR 194caea

### Scenario: A JTBD with no criteria and no skip is denied, naming the Rule heading to add

- [x] RED 194caea
- [x] GREEN 194caea
- [x] REFACTOR 194caea

### Scenario: A JTBD carrying a skip reason satisfies the intake-exit gate

- [x] RED 194caea
- [x] GREEN 194caea
- [x] REFACTOR 194caea

### Scenario: A JTBD whose skip line has no reason is denied

- [x] RED 194caea
- [x] GREEN 194caea
- [x] REFACTOR 194caea

## Rule: Legacy AC still parses, gates, and traces coverage unchanged

### Scenario: An AC-only spec satisfies the intake-exit gate

- [x] RED skip: retained behavior, no code change — regression-locked by ac-gate.test.ts S1.1 (passes a JTBD with >=1 AC)
- [x] GREEN skip: retained — ac-gate.test.ts S1.1 green after slices 1-2
- [x] REFACTOR skip: retained — nothing to refactor

### Scenario: A legacy AC reference is traced as covered exactly as before

- [x] RED skip: retained behavior — regression-locked by scenario-coverage.test.ts covered_ac_not_flagged
- [x] GREEN skip: retained — green after slices 1-2 (68/68)
- [x] REFACTOR skip: retained — nothing to refactor

### Scenario: An AC-shaped tag under a persona-code-R JTBD parses as an AC, never a rule

- [x] RED skip: retained (AC-wins precedence unchanged) — gherkin-feature.test.ts + scenario-coverage.test.ts persona-code-R AC case
- [x] GREEN skip: retained — green after slices 1-2
- [x] REFACTOR skip: retained — nothing to refactor

### Scenario: A terminal R tag under a persona-code-R JTBD parses as that JTBD's rule

- [x] RED skip: retained (greedy-terminal .R anchor unchanged) — persona_code_r_rule_resolves_whole_id
- [x] GREEN skip: retained — green after slices 1-2
- [x] REFACTOR skip: retained — nothing to refactor

### Scenario: A legacy AC reference the spec never declared is still reported stale

- [x] RED 6ef0a77
- [x] GREEN 6ef0a77
- [x] REFACTOR 6ef0a77

## Rule: Using legacy AC surfaces a plain-language deprecation nudge, never a block

### Scenario: An in-progress spec using an AC heading draws a deprecation advisory

- [x] RED 5ae0da6
- [x] GREEN 5ae0da6
- [x] REFACTOR 5ae0da6

### Scenario: An in-progress feature using an AC tag draws a deprecation advisory

- [x] RED 5ae0da6
- [x] GREEN 5ae0da6
- [x] REFACTOR 5ae0da6

### Scenario: A Rule-only in-progress ticket draws no deprecation advisory

- [x] RED 5ae0da6
- [x] GREEN 5ae0da6
- [x] REFACTOR 5ae0da6

### Scenario: A completed ticket still using AC draws no deprecation advisory

- [x] RED 5ae0da6
- [x] GREEN 5ae0da6
- [x] REFACTOR 5ae0da6

### Scenario: The deprecation nudge is a zero-exit advisory, not a blocking issue

- [x] RED 5ae0da6
- [x] GREEN 5ae0da6
- [x] REFACTOR 5ae0da6

## Rule: The codemod rewrites .AC to .R across specs, feature tags, and ledger refs

### Scenario: migrate-ac rewrites an AC reference to the same-numbered Rule reference

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: A migrated declaration and its scenario reference stay linked

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: An AC tag carried on a Gherkin Rule block is rewritten like any other tag

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: Every AC under a JTBD with several criteria is migrated in one pass

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: The codemod leaves non-AC tokens untouched

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

## Rule: The codemod is idempotent, previewable, and refuses collisions

### Scenario: Re-running migrate-ac on already-migrated files changes nothing

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: A dry run previews the rewrites without writing any file

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: An AC that would collide with an existing Rule number refuses the whole file, not a rename

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d

### Scenario: A collision in one file does not block migrating other files

- [x] RED f4b5b5d
- [x] GREEN f4b5b5d
- [x] REFACTOR f4b5b5d
