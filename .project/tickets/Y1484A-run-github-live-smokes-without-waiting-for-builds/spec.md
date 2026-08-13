# Run GitHub live smokes without waiting for builds

## Intent

Let a maintainer run the two proven GitHub API source-only smoke tests while an
unrelated normal package test owns the build-and-Vitest lock.

## Primary user

**TBU — maintainer validating GitHub provenance behavior.**

## Surface

Safeword CLI package scripts.

## Rules

- **github-live-smokes.TBU1.R1:** `bun run test:smoke:live:github` runs only
  `retro-dedup.live.test.ts` and `reconcile.live.test.ts`, with one Vitest
  worker and file parallelism disabled. It neither builds nor uses the normal
  package-test lock, and accepts no caller-supplied arguments.

## Out of scope

- General parallel test capacity, scheduling, cancellation, or remote test
  execution. Those remain the separate `2RZDMP` design.
