# Test Definitions: Monorepo coverage honesty (ZRW21K)

Feature source: `features/monorepo-coverage-honesty.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A pnpm monorepo is discovered, without changing existing discovery

### Scenario: A pnpm monorepo produces a root index and per-package leaf docs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A single repo with no workspace config stays a single-repo doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An npm-workspaces monorepo is still discovered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: package.json workspaces win when both config files are present

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pnpm-workspace.yaml the parser cannot read degrades gracefully

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The root index is honest about packages it cannot introspect

### Scenario: A package with no recognized source layout is marked, not placeholdered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: In a mixed monorepo, only the un-introspected package carries the marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
