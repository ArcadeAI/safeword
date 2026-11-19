---
id: 4J2WX2
slug: stop-hook-pinned-toolchain
type: task
phase: implement
status: in_progress
created: 2026-11-19T06:39:33.097Z
last_modified: 2026-11-19T06:39:33.097Z
scope:
  - The Stop hook's test runner puts the project's mise-pinned tool directories (`mise -C <project> bin-paths`) ahead of the inherited PATH, for both the test-plan lookup and the test commands, when the project has a mise config file and `mise` is installed.
  - Without a project mise config, or without `mise`, the test run's PATH is unchanged.
  - If `mise bin-paths` fails (for example an untrusted config), the run falls back to the inherited PATH and the test output says the pin was not applied and why.
out_of_scope:
  - Repo-specific launchers such as this repo's `scripts/dev`; it is a mise wrapper, so the mise rule covers it.
  - asdf, nvm, volta, proto and other version managers.
  - Other hooks (lint, dependency bootstrap) that also run tools from PATH.
  - Changing anyone's shell profile or the pinned versions.
done_when:
  - A test proves pinned directories come before a stale PATH entry in the test command's environment when the project has `mise.toml`.
  - A test proves PATH is unchanged, and mise is not called, without a project mise config.
  - A test proves a failing `mise bin-paths` leaves PATH unchanged and reports why.
  - The dogfood Stop hook passes the acceptance lane in the desktop app (PATH Bun 1.3.14).
---

# Run end-of-turn tests with the project's pinned toolchain

**Goal:** The Stop hook's test run uses the project's mise-pinned tools when mise is installed, and is unchanged otherwise

**Why:** The app's PATH Bun (1.3.14) cannot read this repo's bun.lock, so every turn end reported 4 false acceptance failures that pass under scripts/dev (Bun 1.4.4)

## Decision

Detect a mise pin, not `scripts/dev`. `scripts/dev` exists only in this repo and is itself a mise wrapper; mise is the general mechanism customers use to pin tools per project. A project config file gates the lookup so that a global mise default never changes the PATH of a project that pins nothing. `bin-paths` (only the tool directories) is narrower than `mise env`, which would also bring in `[env]` variables and virtualenv activation.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-19T06:39:33.097Z Started: Created ticket 4J2WX2
- 2026-11-19T06:41:09.092Z Phase: intake → implement
- 2026-11-19T06:41:09.167Z Phase: intake → implement
