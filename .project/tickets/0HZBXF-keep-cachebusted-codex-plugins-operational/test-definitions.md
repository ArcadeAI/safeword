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
- [ ] REFACTOR

### Scenario: Profile status accepts the cachebusted bundle identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cachebusted-codex.SWM1.R1 — Default generation remains deterministic at the package version

### Scenario: Generation without an override reproduces the checked-in release bundle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cachebusted-codex.SWM1.R2 — Claude Code and Cursor artifacts remain independent of the Codex effective version

### Scenario: A Codex cachebuster does not alter other host catalogues

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cachebusted-codex.SWM1.R3 — The upstream design records a task-bound plugin-root contract without making delivery depend on it

### Scenario: The host proposal is explicit and independently adoptable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
