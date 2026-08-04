# User Stories: Enforce dogfood parity in CI

## Story: Prevent template/mirror drift from merging

As a maintainer, I want pull requests to run an explicit parity check so that
the repository's dogfood configuration always matches the templates we ship.

### Acceptance criteria

- The CI workflow has a standalone `dogfood-parity` job.
- The job runs for pull requests and fails when `bun scripts/parity-check.ts --mode=all` finds drift.
- The current repository mirrors are synchronized before the pull request is updated.
