# Fit the same acceptance proof into the completion budget

**Historical, rejected experiment.** The immutable 600-second constraint below
was an incorrect assumption. The complete parallel run failed two scenarios and
did not fit that budget. All experimental implementation was reverted. The
shipping decision and corrected source documentation are in timeout-final-budget.md.

## Frame and investigation plan

The normal adapter retry took 536.646 seconds and rejected BDD at 480 seconds.
Deduplication and error recognition worked; the serial suite is still too slow
on this busy host. A complete serial run passed all 596 scenarios / 11118 steps
in 712.41 seconds. Keep all scenarios, proof-manifest checks, test assertions,
the live lane, the 480-second BDD allowance and 600-second host cap.

Investigate three domains before changing execution:

1. Runtime compatibility: how Cucumber 13.2.1 starts parallel workers and how
   TypeScript registration reaches them after world.ts clears NODE_OPTIONS.
2. Isolation and integrity: which setup/cleanup hooks execute per worker, whether
   scenario directories and host profiles are distinct, and whether every
   scenario and proof check still executes.
3. Scheduling and measurement: bound resource use and compare the same complete
   workload's elapsed time, rather than dropping cases or retrying failures away.

## Options and evidence

- **More serial time:** simple, but the observed serial run exceeds the host's
  fixed 600 seconds even without the other lanes. It cannot meet the constraint.
- **A durable asynchronous verification job:** could span host events reliably,
  but adds persisted state, stale-evidence binding and multiple recovery flows.
  That is a separate architecture change, beyond this surgical prerequisite.
- **Two deterministic BDD workers:** the smallest supported concurrency above
  serial. Keep the command's complete scenario selection and proof-manifest
  successor. Bound resources at two workers; leave live execution unchanged.

Primary evidence checked 2026-10-17:

- [Cucumber 13.2.1 parallel execution](https://github.com/cucumber/cucumber-js/blob/v13.2.1/docs/parallel.md)
  documents `--parallel`, worker threads and per-worker environment copies.
  BeforeAll/AfterAll execute per worker by default. Context7 independently
  confirms the v13 worker-thread change and worker-scoped hook behavior.
- [Node 24.18.1 worker threads](https://github.com/nodejs/node/blob/v24.18.1/doc/api/worker_threads.md)
  inherit the parent's execArgv. Therefore register tsx with
  explicit `node --import tsx`, not solely NODE_OPTIONS, which world.ts clears
  before subprocess execution. The pinned package exposes its executable as
  `bin/cucumber.js` in package.json.
- Inspection found that host-profile BeforeAll uses stable shared temporary
  caches, not random per-worker profiles. Four native-process RED cases confirmed
  collisions and missing worker-ID validation. Give parallel workers separate
  stable cache names; ordinary runners keep their existing paths. Fixture
  cleanup arrays are module-local and scenario projects use temporary
  directories. Full parallel execution must prove isolation and completeness.

## Decision

Choose two workers for the CLI's deterministic acceptance command only. Explicit
Node loader arguments make registration inheritable by workers; live scripts
retain their current behavior. A script-policy regression test will fail first,
then the complete parallel suite and normal adapter must pass without changing
any deadline or scenario filter.

Premortem: worker-local setup or TypeScript loading could break; retain sandbox
guards and require the complete real suite, not merely a dry-run or speed claim.

Next: test the deterministic acceptance command's bounded worker/loader contract,
change that command, then measure all scenarios and retry normal completion.
