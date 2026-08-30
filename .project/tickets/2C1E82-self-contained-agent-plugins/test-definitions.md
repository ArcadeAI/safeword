# Test Definitions: Make each agent plugin fully self-contained

Feature source: `packages/cli/features/self-contained-agent-plugins.feature`

test-definitions.md is the R/G/R ledger.

## Rule: self-contained-plugins.TBU1.R1 — Native plugin workflows do not borrow project or cross-host runtime

### Scenario: A native agent selection resolves its profile entry point

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: selection is expressed by the existing schema projection rather than host branches

### Scenario: A packaged shared-shell helper executes without project runtime

- [x] RED 7d4d3af5b
- [x] GREEN b537aed65
- [x] REFACTOR skip: the command emits the existing sourceable shell contract

### Scenario: Legacy project runtime cannot regain native workflow authority

- [x] RED 7d4d3af5b
- [x] GREEN ee65a9dba
- [x] REFACTOR skip: packaged resolution does not inspect project runtime completeness

### Scenario: OpenCode owns its full workflow catalogue in the profile

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: identity digests are the existing profile ownership contract

### Scenario: A packaged Claude workflow executes without project runtime

- [x] RED 46918e4b0
- [x] GREEN a2cf1b82c
- [x] REFACTOR skip: the generated Claude catalogue already owns skill references and packaged resources

## Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

### Scenario: First workflow state write creates its missing parent and precise ignore rule

- [x] RED ccb60ea0d
- [x] GREEN ae4e417a5
- [x] REFACTOR skip: every host reaches the same schema-shipped hook helper

### Scenario: First workflow state write reuses an existing framework directory

- [x] RED ccb60ea0d
- [x] GREEN ae4e417a5
- [x] REFACTOR skip: recursive directory creation converges for present and absent parents

### Scenario: Lazy state initialization preserves customer ignore policy

- [x] RED c201d29c3
- [x] GREEN 82f0cacbd
- [x] REFACTOR skip: append-only editing preserves existing bytes

### Scenario: Existing effective ignore policy is not duplicated

- [x] RED 419a73696
- [x] GREEN 0cfc8ee95
- [x] REFACTOR skip: Git remains the ignore-semantics authority

### Scenario: Existing framework state is updated without reinitialization

- [x] RED skip: existing state-merge tests already cover preservation during workflow updates
- [x] GREEN ae4e417a5
- [x] REFACTOR skip: lazy initialization shares the existing read-update-write state path

### Scenario: Lifecycle state respects explicit enrollment

- [x] RED 37abbc8f1
- [x] GREEN bbfcd440e
- [x] REFACTOR skip: the existing enrollment marker is the single boundary

### Scenario: A direct workflow does not silently enroll a repository

- [x] RED 37abbc8f1
- [x] GREEN bbfcd440e
- [x] REFACTOR skip: packaged commands share the existing enrollment predicate

## Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

### Scenario: A native single-agent project schema excludes project delivery

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: schema projection already computes the selected consumer set

### Scenario: A Cursor-only project schema retains Cursor authority

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: Cursor remains the sole project-runtime consumer

### Scenario: Mixed selection preserves Cursor without copying native runtimes

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: mixed selection is the union of shared substrate and Cursor

### Scenario: Removing a native selection preserves Cursor and project content

- [x] RED skip: origin/main fixtures already covered selected uninstall preservation
- [x] GREEN 91c730e90
- [x] REFACTOR skip: accepted fixtures retain the public lifecycle seam

## Rule: self-contained-plugins.SWM1.R1 — Package and profile ownership is enforced at release and reconciliation boundaries

### Scenario: Complete agent catalogues pass executable-reference validation

- [x] RED d7fb488ee
- [x] GREEN f7f4cd053
- [x] REFACTOR skip: the three native catalogues share one narrow authority validator

### Scenario: An unpinned Codex helper blocks release

- [x] RED d7fb488ee
- [x] GREEN 6d13e53cc
- [x] REFACTOR skip: the release catalogue comparison already owns version-pin drift

### Scenario: OpenCode profile identity records the complete owned catalogue

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: the identity inventory is generated from the catalogue itself

### Scenario: A project-runtime reference blocks native plugin release

- [x] RED d7fb488ee
- [x] GREEN 6d13e53cc
- [x] REFACTOR skip: one diagnostic lists all offending assets

### Scenario: A cross-host executable reference blocks Cursor release

- [x] RED 46918e4b0
- [x] GREEN 90e1090b8
- [x] REFACTOR skip: Cursor parity derives executables only from its declared project authority

### Scenario: OpenCode upgrade removes only prior identity-owned catalogue bytes

- [x] RED 024bca4fe
- [x] GREEN f7f4cd053
- [x] REFACTOR skip: retirement and drift checks share the recorded identity inventory

### Scenario: OpenCode uninstall preserves drifted catalogue content

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: drift fails closed before any owned asset is removed

### Scenario: OpenCode uninstall removes its recognized catalogue

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: identity digests already bound the complete removal set

### Scenario: OpenCode upgrade preserves a drifted catalogue asset

- [x] RED 024bca4fe
- [x] GREEN 570f86734
- [x] REFACTOR skip: install and uninstall share the identity-bound drift predicate

## Feature-level cross-scenario refactor

- [x] cross-scenario ae4e417a5
