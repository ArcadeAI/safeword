# Test Definitions: Monorepo coverage honesty (ZRW21K)

Feature source: `features/monorepo-coverage-honesty.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A pnpm monorepo is discovered, without changing existing discovery

### Scenario: A pnpm monorepo produces a root index and per-package leaf docs

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

### Scenario: A single repo with no workspace config stays a single-repo doc

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

### Scenario: An npm-workspaces monorepo is still discovered

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

### Scenario: package.json workspaces win when both config files are present

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

### Scenario: A pnpm-workspace.yaml the parser cannot read degrades gracefully

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

## Rule: The root index is honest about packages it cannot introspect

### Scenario: A package with no recognized source layout is marked, not placeholdered

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4

### Scenario: In a mixed monorepo, only the un-introspected package carries the marker

- [x] RED 15702b4
- [x] GREEN 15702b4
- [x] REFACTOR 15702b4
