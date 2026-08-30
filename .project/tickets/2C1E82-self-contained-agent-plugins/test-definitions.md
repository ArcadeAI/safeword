# Test Definitions: Make each agent plugin fully self-contained

Feature source: `packages/cli/features/self-contained-agent-plugins.feature`

test-definitions.md is the R/G/R ledger.

## Rule: self-contained-plugins.TBU1.R1 — Native plugin workflows do not borrow project or cross-host runtime

### Scenario: A native agent selection installs no project executable runtime

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: selection is expressed by the existing schema projection rather than host branches

### Scenario: Cursor retains its complete selected project authority

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: Cursor remains the sole project-runtime consumer

### Scenario: Codex helpers resolve through version-pinned package commands

- [x] RED 7d4d3af5b
- [x] GREEN ee65a9dba
- [x] REFACTOR skip: one allowlisted packaged runtime command serves the remaining helpers

### Scenario: OpenCode owns its full workflow catalogue in the profile

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: identity digests are the existing profile ownership contract

## Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

### Scenario: First workflow state write creates its precise ignore rule before state

- [x] RED ccb60ea0d
- [x] GREEN ae4e417a5
- [x] REFACTOR skip: every host reaches the same schema-shipped hook helper

### Scenario: Lazy state initialization preserves customer ignore policy

- [x] RED c201d29c3
- [x] GREEN 82f0cacbd
- [x] REFACTOR skip: append-only editing preserves existing bytes

### Scenario: A broader customer ignore rule is not duplicated

- [x] RED 419a73696
- [x] GREEN 0cfc8ee95
- [x] REFACTOR skip: Git remains the ignore-semantics authority

### Scenario: An unenrolled repository remains untouched by lifecycle state

- [x] RED 37abbc8f1
- [x] GREEN bbfcd440e
- [x] REFACTOR skip: the existing enrollment marker is the single boundary

### Scenario: A direct workflow does not silently enroll a repository

- [x] RED 37abbc8f1
- [x] GREEN bbfcd440e
- [x] REFACTOR skip: packaged commands share the existing enrollment predicate

## Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

### Scenario: A single-agent project schema excludes unselected hosts

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: schema projection already computes the selected consumer set

### Scenario: Mixed selection preserves Cursor without copying native runtimes

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: mixed selection is the union of shared substrate and Cursor

### Scenario: Selected-agent lifecycle contracts remain deterministic

- [x] RED skip: origin/main fixtures already covered install, check, upgrade, and uninstall
- [x] GREEN 91c730e90
- [x] REFACTOR skip: accepted fixtures retain the public lifecycle seam

## Rule: self-contained-plugins.SWM1.R1 — Package and profile ownership is enforced at release and reconciliation boundaries

### Scenario: Complete native catalogues pass executable-reference validation

- [x] RED d7fb488ee
- [x] GREEN 6d13e53cc
- [x] REFACTOR skip: Codex and OpenCode share one narrow validator

### Scenario: A project-runtime reference blocks native plugin release

- [x] RED d7fb488ee
- [x] GREEN 6d13e53cc
- [x] REFACTOR skip: one diagnostic lists all offending assets

### Scenario: OpenCode upgrade removes only prior identity-owned catalogue bytes

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: upgrade uses the recorded identity inventory

### Scenario: OpenCode uninstall preserves drifted catalogue content

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: drift fails closed before any owned asset is removed

## Feature-level cross-scenario refactor

- [x] REFACTOR ae4e417a5: moved state initialization into one schema-shipped helper shared by packaged commands and every real host adapter
