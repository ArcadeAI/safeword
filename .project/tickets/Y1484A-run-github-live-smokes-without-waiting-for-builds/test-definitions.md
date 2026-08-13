# Test Definitions: Run GitHub live smokes without waiting for builds

Feature source: `packages/cli/features/run-github-live-smokes-without-waiting-for-builds.feature`

## Rule: github-live-smokes.TBU1.R1

### Scenario: GitHub live smokes start while the normal package-test lock is held

- [x] RED skip: the runner and regression proof were added before this ticket ledger existed, so no pre-change failure can be reconstructed honestly.
- [x] GREEN 896b049b0
- [x] REFACTOR skip: the fixed-argument launcher is already a single-purpose boundary; review found no behavior-preserving simplification.

### Scenario: GitHub live smokes reject arbitrary extra arguments

- [x] RED skip: the runner and regression proof were added before this ticket ledger existed, so no pre-change failure can be reconstructed honestly.
- [x] GREEN 896b049b0
- [x] REFACTOR skip: the fixed-argument launcher is already a single-purpose boundary; review found no behavior-preserving simplification.

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: both scenarios exercise the same intentionally tiny launcher; review found no shared abstraction or cleanup worth adding.
