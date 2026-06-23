# Test Definitions: Architecture monorepo hierarchy (Slice 3)

Feature source: `features/architecture-monorepo-hierarchy.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A monorepo gets a derived root index over its packages

### Scenario: The root index lists every package with a purpose and the dependency edges

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: The root index is still written when no package has a src tree

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: Adding a package updates the root index without hand-editing

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: Removing a package drops it from the root index

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

## Rule: Each package's structure is a colocated, independently-fingerprinted leaf

### Scenario: A package with a src tree gets a colocated leaf doc with its own fingerprint

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: A package with no modules gets a root entry but no leaf doc

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

## Rule: Freshness is attributed per node

### Scenario: A change in one package re-syncs only that package's leaf

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: A change moves only the fingerprint of the node that owns it (outline ×3)

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: Editing the shared boundary config re-syncs the root and no leaf

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

## Rule: Enforcement fans out across root and every leaf

### Scenario: The check fails when any single leaf is stale

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: The check passes when the root and every leaf are fresh

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: Staging refreshes and stages every changed node at once

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: A foreign doc at a node path is left untouched and does not fail the check

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

### Scenario: Opting out passes the check even when a leaf is stale

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed

## Rule: Single-repo behavior is unchanged

### Scenario: A project with no workspaces produces exactly the single-repo doc

- [x] RED c9e5df9
- [x] GREEN c9e5df9
- [x] REFACTOR f3766ed
