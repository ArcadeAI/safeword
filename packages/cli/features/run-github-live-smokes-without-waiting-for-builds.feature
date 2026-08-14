@wip @surface.safeword-cli
Feature: Run GitHub live smokes without waiting for builds

  Rule: The proven source-only GitHub smokes stay a narrow exception to package-test serialization

    @github-live-smokes.TBU1.R1 @wiring
    Scenario: GitHub live smokes start while the normal package-test lock is held
      Given a normal package-test wrapper holds the shared lock with build and Vitest collaborators active
      When the builder runs `bun run test:smoke:live:github`
      Then only `retro-dedup.live.test.ts` and `reconcile.live.test.ts` start through Vitest with one worker and no file parallelism
      And the live-smoke command neither runs a build nor waits for or acquires the package-test lock

    @github-live-smokes.TBU1.R1 @rejection
    Scenario: GitHub live smokes reject arbitrary extra arguments
      Given the bounded GitHub live-smoke command is available
      When the builder appends an extra Vitest argument
      Then it exits 2 before starting Vitest and explains that the command accepts no arguments
