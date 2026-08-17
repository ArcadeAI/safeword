# Test Definitions: Keep reviews focused on authored changes

Feature source:
`packages/cli/features/keep-reviews-focused-on-authored-inputs.feature`

R/G/R ledger. Given/When/Then live in the feature source. Focused Vitest
packet and command tests provide the deterministic seams; Cucumber proves the
builder-visible command path with a real temporary project and fake reviewer.

## Rule: focused-review.TBU1.R1

### Scenario: Generated artifacts one byte over the per-target packet limit leave authored input reviewable and visible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repeated generated target has one ordered exclusion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated path aliases have one canonical ordered exclusion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A generated target at the individual packet boundary remains reviewable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A generated target below the individual packet limit remains reviewable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repeated eligible target is reviewed and aggregate-counted once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible lexical alias is reviewed and aggregate-counted once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Lexical normalization defines target identity before intermediate symlink traversal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible target at the packet boundary does not require Git attribute resolution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: focused-review.TBU1.R2

### Scenario: A non-true generated attribute does not launch a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable Git attribute resolution does not permit omission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A bounded Git attribute lookup failure does not permit omission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible target changed after bounded capture does not reach attribute lookup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible target changed after oversized classification cannot reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A generated marker cannot bypass non-regular target validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized generated sparse target is omitted without reading or decoding its bytes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized generated target changed after metadata validation fails before omission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-attribute target failures are reported in supplied order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Successful generated classification does not change the first supplied target failure

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Full preflight classifies a valid oversized target after an earlier invalid target

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Malformed Git attribute output does not permit omission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A multi-target attribute failure is atomic in either supplied order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Attribute-resolution failure takes precedence over an unmarked oversized target in either order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The public CLI reports each preflight failure as a JSON envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Mixed marked and unmarked oversized targets fail atomically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated omission retains a review exactly at the aggregate packet limit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated omission cannot weaken the aggregate packet limit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: focused-review.SWM1.R1

### Scenario: All generated oversized targets stop before reviewer launch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty submitted target list stops before reviewer launch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: focused-review.SWM1.R2

### Scenario: A Git-marked generated target is selected without a path heuristic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Git attribute lookup safely keeps generated paths project-relative

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Git attribute lookup preserves special generated paths as one literal NUL-delimited stdin value

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Git attribute lookup preserves a generated filename containing an actual newline code point

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Project Git info attributes cannot override a committed generated marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Attribute classification ignores a working-tree marker removal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Attribute classification ignores an uncommitted marker addition

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: External Git attributes cannot create a generated exception

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hostile project Git configuration and inherited environment cannot redirect committed classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct hard-linked generated targets remain distinct exclusions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The CLI returns the reduced scope in its JSON stdout envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer failure after packet finalization reports the reduced scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A target outside the project cannot reach Git attribute lookup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project-relative symlink escaping the project cannot reach Git attribute lookup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Safeword's generated plugin runtime declares the same marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
