# Test Definitions: Explain test-lock waits

The executable proof is the existing Vitest integration coverage around
`run-vitest-with-build-lock.mjs`. Tests use isolated temporary locks and fake
build/test binaries; they do not contend for the repository's real global lock.

## Rule: A queued package-test command explains its wait

### Scenario: CCYD5S.SM1.AC1-2.reports_owner_and_elapsed_wait_periodically

Given one runner owns a package-test lock from a known checkout
And a second runner is queued behind it
When the wait lasts across multiple status intervals
Then the queued runner reports the owner's process ID
And it reports the owner's checkout root
And it emits increasing elapsed-wait status more than once

- [x] RED skip: focused runner suite failed because no periodic owner status existed
- [x] GREEN fa16069cb
- [x] REFACTOR skip: shared status formatting and scheduling remained local to the runner

### Scenario: CCYD5S.SM1.AC3.tolerates_incomplete_owner_metadata

Given a live lock has readable but incomplete owner metadata, or stale non-object
owner metadata
When another runner reports its wait
Then it prints the fields that are available, or marks unavailable fields clearly
And it continues waiting or reaches the configured wait cap without crashing
And stale non-object metadata is reaped through the normal mtime fallback

- [x] RED skip: focused runner suite failed because incomplete metadata emitted no details
- [x] GREEN fa16069cb
- [x] REFACTOR skip: no additional structure was needed

## Rule: Wait diagnostics remain safely rate-limited

### Scenario: CCYD5S.SM1.AC4.clamps_an_unsafe_status_interval

Given a live package-test lock and a one-millisecond status interval setting
When the runner waits for its configured wait cap
Then it reports status no more often than the supported minimum interval
And malformed and zero interval settings fall back to the default interval

### Scenario: CCYD5S.SM1.AC6.negative_maximum_wait_uses_the_default

Given another runner owns a live package-test lock
When a waiting runner sets its maximum wait to a negative value
Then it waits for the owner under the default maximum wait
And it does not proceed without the lock or overlap the owner's build and test

- [x] RED skip: unsafe-interval test failed before the minimum clamp
- [x] GREEN 09ac816ab
- [x] REFACTOR skip: shared helpers are the completed cleanup

## Refactoring ledger

- [x] CCYD5S.RF1 skip: Extracted lock creation from `acquireLock()` in
  `packages/cli/scripts/run-vitest-with-build-lock.mjs`; existing integration
  scenarios cover successful creation, contention, stale-lock recovery, and
  wait-cap behavior.

### Scenario: CCYD5S.SM1.AC5.preserves_lock_behavior_after_extracting_creation

Given the existing lock-runner integration scenarios
When lock creation is extracted from the wait loop
Then successful acquisition, serialization, stale-lock recovery, and wait-cap
behavior remain unchanged

- [x] REFACTOR f4195b63e

## Patch-level refactor

- [x] cross-scenario skip: both scenarios use the same metadata reader and wait reporter
