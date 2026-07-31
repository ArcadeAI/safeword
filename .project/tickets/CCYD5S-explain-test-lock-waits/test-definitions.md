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

Given a live lock has readable but incomplete owner metadata
When another runner reports its wait
Then it prints the fields that are available
And it continues waiting or reaches the configured wait cap without crashing

- [x] RED skip: focused runner suite failed because incomplete metadata emitted no details
- [x] GREEN fa16069cb
- [x] REFACTOR skip: no additional structure was needed

## Rule: Wait diagnostics remain safely rate-limited

### Scenario: CCYD5S.SM1.AC4.clamps_an_unsafe_status_interval

Given a live package-test lock and a one-millisecond status interval setting
When the runner waits for its configured wait cap
Then it reports status no more often than the supported minimum interval
And malformed interval settings fall back to the default interval

- [x] RED 09ac816ab
- [x] GREEN 09ac816ab
- [x] REFACTOR 09ac816ab

## Patch-level refactor

- [x] cross-scenario skip: both scenarios use the same metadata reader and wait reporter
