# User Stories: Explain test-lock waits

## Story: Understand why a test run is waiting

As a Safeword maintainer,
I want a queued package-test command to identify the lock owner and report how
long it has waited,
so that legitimate cross-worktree serialization does not look like a hung test
suite.

### Acceptance Criteria

#### CCYD5S.SM1.AC1 - Wait output identifies the active owner

Given another package-test command owns the global lock
When my command waits for that lock
Then its status output includes the owner's process ID and checkout root.

#### CCYD5S.SM1.AC2 - A long wait remains visibly active

Given the owner continues running
When my command remains queued
Then it reports the elapsed wait after the initial delay and periodically
thereafter.

#### CCYD5S.SM1.AC3 - Missing owner metadata degrades safely

Given the lock metadata is incomplete, malformed, or changes while my command reads it
When the wait status is rendered
Then the command reports the available details without crashing or weakening
lock serialization.
And malformed stale metadata remains eligible for the existing stale-lock
recovery path.

#### CCYD5S.SM1.AC4 - Diagnostic configuration stays safe

Given a maintainer supplies an invalid, zero, or excessively small diagnostic interval
When a command waits for the package-test lock
Then invalid and zero values use the default interval
And a small positive value uses the safe minimum interval to keep wait output
readable.

#### CCYD5S.SM1.AC6 - Maximum-wait configuration remains safe

Given a maintainer supplies a negative maximum-wait value
When a command encounters a live package-test lock
Then the runner falls back to the default maximum wait and preserves lock
serialization.

#### CCYD5S.SM1.AC5 - Lock coordination stays readable

Given package-test locking needs both lock creation and wait coordination
When a maintainer reads or changes the runner
Then lock creation is named separately from the wait loop without changing
serialization, stale-lock recovery, or diagnostic behavior.
