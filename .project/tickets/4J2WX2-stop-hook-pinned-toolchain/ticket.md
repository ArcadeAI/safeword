---
id: 4J2WX2
slug: stop-hook-pinned-toolchain
type: task
phase: implement
status: in_progress
created: 2026-11-19T06:39:33.097Z
last_modified: 2026-11-19T06:39:33.097Z
scope:
  - The Stop hook's test runner puts the project's mise-pinned tool directories (`mise -C <project> bin-paths`) ahead of the inherited PATH, for both the test-plan lookup and the test commands, when `mise config ls` reports a config inside the project that pins tools (any file name mise supports, such as `mise.toml`, `mise.local.toml`, `.tool-versions`).
  - When only parent or global configs pin tools, or `mise` is not installed, the test run's PATH is unchanged.
  - If mise cannot list configs or resolve `bin-paths` (for example an untrusted config), the run falls back to the inherited PATH and the test output says the pin was not applied and why, even when the suite prints more than the output budget.
out_of_scope:
  - Repo-specific launchers such as this repo's `scripts/dev`; it is a mise wrapper, so the mise rule covers it.
  - asdf, nvm, volta, proto and other version managers.
  - Other hooks (lint, dependency bootstrap) that also run tools from PATH.
  - Changing anyone's shell profile or the pinned versions.
done_when:
  - A test proves, for a pin only in `mise.local.toml`, that pinned directories come before a stale PATH entry in the test command's environment and that the test-plan lookup runs on the pinned `bun`.
  - A test proves PATH and the lookup's `bun` are unchanged, and `bin-paths` is not called, when only configs outside the project pin tools.
  - A test proves a failing `mise bin-paths` leaves PATH unchanged and reports why past a verbose suite's output.
  - The dogfood Stop hook passes the acceptance lane in the desktop app (PATH Bun 1.3.14).
---

# Run end-of-turn tests with the project's pinned toolchain

**Goal:** The Stop hook's test run uses the project's mise-pinned tools when mise is installed, and is unchanged otherwise

**Why:** The app's PATH Bun (1.3.14) cannot read this repo's bun.lock, so every turn end reported 4 false acceptance failures that pass under scripts/dev (Bun 1.4.4)

## Decision

Detect a mise pin, not `scripts/dev`. `scripts/dev` exists only in this repo and is itself a mise wrapper; mise is the general mechanism customers use to pin tools per project. Only a config inside the project that pins tools gates the lookup, so a global or parent mise default never changes the PATH of a project that pins nothing. mise itself reports which configs it loads (`mise config ls --json`), so the hook keeps no list of file names to drift from mise's. `bin-paths` (only the tool directories) is narrower than `mise env`, which would also bring in `[env]` variables and virtualenv activation.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-19T06:39:33.097Z Started: Created ticket 4J2WX2
- 2026-11-19T06:41:09.092Z Phase: intake → implement
- 2026-11-19T06:41:09.167Z Phase: intake → implement
