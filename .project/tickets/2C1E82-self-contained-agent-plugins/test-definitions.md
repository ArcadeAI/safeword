# Test Definitions: Make each agent plugin fully self-contained

Feature source: `packages/cli/features/self-contained-agent-plugins.feature`

test-definitions.md is the R/G/R ledger.

## Rule: self-contained-plugins.TBU1.R1 — Every agent workflow executes from its declared authority without borrowing runtime

### Scenario: A packaged shared-shell helper executes without project runtime

- [x] RED 07b075cf7
- [x] GREEN 1143df8bc
- [x] REFACTOR skip: the command emits the existing sourceable shell contract

### Scenario: A sourced helper failure preserves the caller shell

- [x] RED 07b075cf7
- [x] GREEN 1143df8bc
- [x] REFACTOR skip: success and failure share the same sourced-shell return contract

### Scenario: A packaged shared-shell helper exports an empty changed-file list

- [x] RED 13cf4010d
- [x] GREEN d5b0ecdde
- [x] REFACTOR skip: the populated and empty diff cases share the same sourced-shell contract

### Scenario: Legacy project runtime cannot regain native workflow authority

- [x] RED f2b511ef1
- [x] GREEN a81f5897d
- [x] REFACTOR skip: packaged resolution does not inspect project runtime completeness

### Scenario: A packaged OpenCode workflow executes without project runtime

- [x] RED 2b4fc15c4
- [x] GREEN a81f5897d
- [x] REFACTOR skip: generated OpenCode workflows reuse the self-contained Codex catalogue with host-native frontmatter

### Scenario: Legacy project hooks cannot regain OpenCode workflow authority

- [x] RED e049463cb
- [x] GREEN c63507821
- [x] REFACTOR skip: packaged template lookup now has one authority for every native hook

### Scenario: A Cursor workflow executes from its complete project authority

- [x] RED 62067afe1
- [x] GREEN 07b5b7632
- [x] REFACTOR skip: Cursor retains the existing sourceable project audit helper contract

### Scenario: A sourced Cursor helper failure preserves the caller shell

- [x] RED 0cd8244e9
- [x] GREEN 2308a9595
- [x] REFACTOR skip: Cursor success and failure share one installed sourceable-shell helper

### Scenario: A sourced Cursor helper exports an empty changed-file list

- [x] RED 0cd8244e9
- [x] GREEN 2308a9595
- [x] REFACTOR skip: populated and empty Cursor diffs share the same installed helper contract

### Scenario: An unavailable pinned package never falls back to project runtime

- [x] RED d5d6f60ad
- [x] GREEN a81f5897d
- [x] REFACTOR skip: the pinned package invocation has no project-runtime fallback branch

### Scenario: A packaged Claude workflow executes without project runtime

- [x] RED 62067afe1
- [x] GREEN b42085119
- [x] REFACTOR skip: the generated Claude catalogue already owns skill references and packaged resources

## Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

### Scenario: Every host lazily creates missing workflow state and its precise ignore rule

- [x] RED 59be6e503
- [x] GREEN d107eff97
- [x] REFACTOR skip: every host reaches the same schema-shipped hook helper

### Scenario: First workflow state write reuses an existing framework directory

- [x] RED 59be6e503
- [x] GREEN d107eff97
- [x] REFACTOR skip: recursive directory creation converges for present and absent parents

### Scenario: Lazy state never invents missing authored knowledge or configuration

- [x] RED 59be6e503
- [x] GREEN d107eff97
- [x] REFACTOR skip: lazy initialization is restricted to the framework state path

### Scenario: Lazy state initialization preserves customer ignore policy

- [x] RED 8c9a07fe2
- [x] GREEN d4c7836da
- [x] REFACTOR skip: append-only editing preserves existing bytes

### Scenario: Existing effective ignore policy is not duplicated

- [x] RED 0f0af79d6
- [x] GREEN 33b649380
- [x] REFACTOR skip: Git remains the ignore-semantics authority

### Scenario: Existing framework state is updated without reinitialization

- [x] RED 59be6e503
- [x] GREEN d107eff97
- [x] REFACTOR skip: lazy initialization shares the existing read-update-write state path

### Scenario: Enrolled lifecycle state initializes lazily

- [x] RED 5229869ac
- [x] GREEN 919504dd0
- [x] REFACTOR skip: the existing enrollment marker is the single positive boundary

### Scenario: Unenrolled lifecycle state remains absent without blocking

- [x] RED 5229869ac
- [x] GREEN 919504dd0
- [x] REFACTOR skip: the absent enrollment marker is the single rejection boundary

### Scenario: A direct workflow does not silently enroll a repository

- [x] RED 5229869ac
- [x] GREEN 919504dd0
- [x] REFACTOR skip: packaged commands share the existing enrollment predicate

## Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

### Scenario: OpenCode installation delivers no project runtime

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: identity digests are the existing profile ownership contract

### Scenario: A native single-agent project schema excludes project delivery

- [x] RED 62067afe1
- [x] GREEN 07b5b7632
- [x] REFACTOR skip: schema projection already computes the selected consumer set

### Scenario: A Cursor-only project schema retains Cursor authority

- [x] RED 62067afe1
- [x] GREEN 07b5b7632
- [x] REFACTOR skip: Cursor remains the sole project-runtime consumer

### Scenario: Mixed selection preserves Cursor without copying native runtimes

- [x] RED 62067afe1
- [x] GREEN 07b5b7632
- [x] REFACTOR skip: mixed selection is the union of shared substrate and Cursor

### Scenario: Removing a native selection preserves Cursor and project content

- [x] RED 62067afe1
- [x] GREEN a81f5897d
- [x] REFACTOR skip: accepted fixtures retain the public lifecycle seam

### Scenario: Reconciliation preserves selected authorities without restoring native project runtime

- [x] RED 62067afe1
- [x] GREEN a81f5897d
- [x] REFACTOR skip: reconciliation preserves the selected schema projection without inventing retired runtime

## Rule: self-contained-plugins.NTB1.R2 — Profile lifecycle preserves customer content by identity

### Scenario: OpenCode profile identity records the complete owned catalogue

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: the identity inventory is generated from the catalogue itself

### Scenario: OpenCode install preserves an unrecognized catalogue collision

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: profile collision handling is shared across all identity-owned catalogue paths

### Scenario: OpenCode upgrade removes only prior identity-owned catalogue bytes

- [x] RED 2b4fc15c4
- [x] GREEN 48bf33de2
- [x] REFACTOR skip: retirement and drift checks share the recorded identity inventory

### Scenario: OpenCode upgrade preserves a drifted catalogue asset

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: upgrade fails closed through the identity-bound drift predicate

### Scenario: OpenCode uninstall removes its recognized catalogue

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: identity digests already bound the complete removal set

### Scenario: OpenCode uninstall preserves drifted catalogue content

- [x] RED 2b4fc15c4
- [x] GREEN 00b372ea1
- [x] REFACTOR skip: drift fails closed before any owned asset is removed

## Rule: self-contained-plugins.SWM1.R1 — Package authority is enforced at release boundaries

### Scenario: Complete agent catalogues pass executable-reference validation

- [x] RED d5d6f60ad
- [x] GREEN a81f5897d
- [x] REFACTOR skip: the three native catalogues share one narrow authority validator

### Scenario: An unpinned Codex helper blocks release

- [x] RED d5d6f60ad
- [x] GREEN 273a45ab4
- [x] REFACTOR skip: the release catalogue comparison already owns version-pin drift

### Scenario: A project-runtime reference blocks native plugin release

- [x] RED d5d6f60ad
- [x] GREEN 273a45ab4
- [x] REFACTOR skip: one diagnostic lists all offending assets

### Scenario: A cross-host executable reference blocks Cursor release

- [x] RED 62067afe1
- [x] GREEN 07b5b7632
- [x] REFACTOR skip: Cursor parity derives executables only from its declared project authority

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: the shared state helper and profile reconciler already provide the narrow common seams
