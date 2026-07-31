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

Given the lock metadata is incomplete or changes while my command reads it
When the wait status is rendered
Then the command reports the available details without crashing or weakening
lock serialization.

#### CCYD5S.SM1.AC4 - Diagnostic configuration stays safe

Given a maintainer supplies an invalid or excessively small diagnostic interval
When a command waits for the package-test lock
Then the runner uses a safe minimum interval and keeps wait output readable.
