# Test Definitions: R6ARF5 monitor detection skeleton

## Scope

Validate the read-only upstream changelog monitor skeleton that compares live upstream content against committed reviewed snapshots and reports drift through GitHub Issues.

## Acceptance Tests

### R6ARF5.SM1.AC1 - No-change run is a clean no-op

Given a live source normalizes to the same body as its committed snapshot
When the monitor runs
Then no issue is created or updated
And no snapshot file is written.

### R6ARF5.SM1.AC2 - Changed source opens or updates one issue

Given a live source differs from its committed snapshot
When the monitor runs
Then it builds a source-keyed issue payload with a bounded diff
And it updates an existing open issue instead of creating a duplicate.

### R6ARF5.SM1.AC3 - Workflow is read-only on repository contents

Given the scheduled GitHub Actions workflow
When it runs
Then it has `contents: read` and `issues: write`
And it executes the monitor without committing snapshots.
