# Test Definitions: Keep cachebusted Codex plugins operational

Feature source: `features/keep-cachebusted-codex-plugins-operational.feature`

test-definitions.md is the R/G/R ledger. Scenario Outline rows in the feature
source share one ledger entry.

## Rule: cachebusted-codex.TBU1.R1 — Every generated Codex artifact uses one validated effective plugin version

### Scenario: An accepted effective version is stamped throughout the bundle

- [x] RED 9dfc12648
- [x] GREEN daa6b7764
- [x] REFACTOR skip: generation and publication responsibilities are already separated

### Scenario: An invalid or incompatible effective version is rejected before output changes

- [x] RED skip: validation and atomic publication landed in the preceding coherent-generator slice
- [x] GREEN 4ddd53898
- [x] REFACTOR skip: pure validation and publisher seams require no further structural change

## Rule: cachebusted-codex.TBU1.R2 — A cachebusted bundle executes and identifies itself from its exact installed directory

### Scenario: A cachebusted workflow resolves its own installed runtime

- [x] RED skip: effective-version runtime wiring landed in the coherent-generator slice
- [x] GREEN dddfa62a3
- [x] REFACTOR skip: the existing real-install harness remains the simplest host boundary

### Scenario: Profile status accepts the cachebusted bundle identity

- [x] RED skip: cachebusted identity injection landed in the coherent-generator slice
- [x] GREEN dddfa62a3
- [x] REFACTOR skip: status proof shares the real-install fixture without added abstractions

## Rule: cachebusted-codex.SWM1.R1 — Default generation remains deterministic at the package version

### Scenario: Generation without an override reproduces the checked-in release bundle

- [x] RED skip: deterministic default generation predates this change and is regression-only
- [x] GREEN c182340db
- [x] REFACTOR skip: the existing check mode is already the narrow deterministic contract

## Rule: cachebusted-codex.SWM1.R2 — Claude Code and Cursor artifacts remain independent of the Codex effective version

### Scenario: A Codex cachebuster does not alter other host catalogues

- [x] RED skip: Claude and Cursor isolation is an unchanged regression contract
- [x] GREEN c182340db
- [x] REFACTOR skip: direct before-and-after tree digests are clearer than a shared abstraction

## Rule: cachebusted-codex.SWM1.R3 — The upstream design records a task-bound plugin-root contract without making delivery depend on it

### Scenario: The host proposal is explicit and independently adoptable

- [x] RED skip: the approved design record existed before its regression assertion
- [x] GREEN c182340db
- [x] REFACTOR skip: exact heading and contract phrases are the intended stable interface

## Feature-level cross-scenario refactor

- [x] cross-scenario 392b4437f
