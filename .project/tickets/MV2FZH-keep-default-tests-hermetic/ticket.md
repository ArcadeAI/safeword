---
id: MV2FZH
slug: keep-default-tests-hermetic
type: patch
subtype: bug-investigated
phase: done
status: done
created: 2026-07-25T14:34:21.269Z
last_modified: 2026-07-31T03:25:00.000Z
---

# Keep default tests hermetic

**Goal:** Prevent the default Vitest suite from waiting on live package-manager installs.

**Why:** Reliable local and CI verification must not depend on registry availability.

## Work Log

- 2026-07-25T18:15:00Z Corrected: Removed the shared fixture dependency links after CI showed broad missing-peer failures. Default skipped-install fixtures now remain dependency-free; only integration suites that execute generated tooling explicitly opt into installation. Added a real-subprocess guard that default setup leaves no `node_modules`. Clean-CI verification pending because this worktree retains the earlier run's damaged Cucumber dependency link.
- 2026-07-25T16:30:00Z Fixed: CI showed that symlinking a skipped-install fixture's entire `node_modules` exposed package dependencies and binaries but not Safeword itself, because a package is not installed inside its own dependency directory. The fixture now links dependency entries, the local `safeword` package, and `.bin` separately. A regression test imports both `safeword` and `eslint` from the fixture. Ruled out: a host-toolchain failure (the failing config could not resolve its first import); a registry/network failure (the default setup had correctly skipped installation).
- 2026-07-25T15:53:30Z Improved: Recorded the three R/G/R loops with durable commit or skip evidence so the ticket ledger passes the boundary gate.
- 2026-07-25T15:51:00Z Fixed: CI exposed that skipped-install fixtures could not run generated BDD scripts. Successful skipped-install setup now links the CLI package's already-installed test dependencies, preserving offline fixture setup.
- 2026-07-25T14:34:21.269Z Started: Created ticket MV2FZH
- 2026-07-25T14:37:00.000Z Found: Default `setupOrThrow` fixtures launched live npm installs; the slow external-install lane is already excluded from the default Vitest config.
- 2026-07-25T14:37:00.000Z Implemented: Default fixture setup now sets `SAFEWORD_SKIP_INSTALL=1`, while caller-provided environment values take precedence.
- 2026-07-31T03:25:00.000Z Completed: Release review confirmed the hermetic fixture coverage; previously timeout-shaped full-suite failures pass in isolation and make no live install.
