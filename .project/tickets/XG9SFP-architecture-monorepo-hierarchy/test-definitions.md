# Test Definitions: Architecture monorepo hierarchy (Slice 3)

Feature source: `features/architecture-monorepo-hierarchy.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A monorepo gets a derived root index over its packages

### Scenario: The root index lists every package with a purpose and the dependency edges

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The root index is still written when no package has a src tree

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adding a package updates the root index without hand-editing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Removing a package drops it from the root index

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Each package's structure is a colocated, independently-fingerprinted leaf

### Scenario: A package with a src tree gets a colocated leaf doc with its own fingerprint

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A package with no modules gets a root entry but no leaf doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Freshness is attributed per node

### Scenario: A change in one package re-syncs only that package's leaf

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A change moves only the fingerprint of the node that owns it (outline ×3)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Editing the shared boundary config re-syncs the root and no leaf

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Enforcement fans out across root and every leaf

### Scenario: The check fails when any single leaf is stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The check passes when the root and every leaf are fresh

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Staging refreshes and stages every changed node at once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A foreign doc at a node path is left untouched and does not fail the check

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Opting out passes the check even when a leaf is stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Single-repo behavior is unchanged

### Scenario: A project with no workspaces produces exactly the single-repo doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
