---
id: SFQ1EQ
slug: keep-default-tests-responsive
type: task
subtype: bug-investigated
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Identify default-suite tests that spawn real package-manager installs.
  - Move or gate slow setup/golden-path install coverage so `bun run test` stays responsive.
  - Preserve explicit coverage for real install flows in a documented slow or release lane.
  - Update Vitest config/script comments so the default/slow split matches reality.
out_of_scope:
  - Removing real install coverage entirely.
  - Weakening assertions in setup or golden-path tests.
  - Changing production setup behavior.
done_when:
  - `bun run test` no longer spends long quiet periods in real `npm install` subprocesses.
  - Slow install-backed coverage still runs through a named script.
  - Documentation/comments identify which lane maintainers should use for default, smoke, slow, and release validation.
created: 2026-06-15T14:11:50.893Z
last_modified: 2026-06-15T14:12:02Z
---

# Keep default tests responsive for maintainers

**Goal:** Keep the default Vitest suite fast and observable while retaining explicit coverage for real setup installs.

**Why:** The default suite currently includes setup/golden-path tests that spawn real `npm install` subprocesses, making `bun run test` look idle and run long even when the focused change path is unrelated.

## Work Log

- 2026-06-15T14:11:50.893Z Started: Created ticket SFQ1EQ
- 2026-06-15T14:12:02Z Scoped: Created from quality-review/Vitest investigation on `codex/skill-invocation-log-helper`; verbose full-suite output showed older setup/golden-path tests advancing slowly while package-manager subprocesses ran under Vitest workers.
- 2026-06-15T14:56:00Z Root cause confirmed: `setup-python.test.ts` took 76.7s in isolation because each scenario ran `safeword setup` without `SAFEWORD_SKIP_INSTALL`, so most assertions paid a real package-manager install cost. Re-running the same file with `SAFEWORD_SKIP_INSTALL=1` dropped runtime to 3.1s, with only the install-proof scenario failing as expected.
- 2026-06-15T15:00:00Z Fix path: keep non-install setup assertions in the default lane with `SAFEWORD_SKIP_INSTALL`, and gate real install-proof scenarios behind `SAFEWORD_RUN_INSTALL_TESTS` in `test:slow`.
- 2026-06-15T15:03:00Z Verification: default targeted setup batch (`setup-python`, `setup-golang`, `setup-workspaces`) passed in 8.7s with two install-proof scenarios skipped; slow-config targeted run passed in 22.4s and executed both real install-proof scenarios. Upgrade/check/namespace batch passed 67 tests in 51.2s; lint/typecheck passed.

## Root Cause

The default Vitest lane includes fixture tests that repeatedly run `safeword setup` and `safeword upgrade` without `SAFEWORD_SKIP_INSTALL`, even when the assertion only checks generated files, output text, or preserved configuration. `createConfiguredProject()` also ran a full setup install and declared only part of safeword's base dependency set, so later upgrade/check fixtures could still detect missing package declarations and attempt package-manager work.

This happens because install coverage and configuration-generation coverage share the same helpers. The test harness had no cheap default fixture path, so many non-install assertions accidentally paid the real install cost.

Confirmed by measuring `setup-python.test.ts`: normal run was 76.7s for 6 tests; `SAFEWORD_SKIP_INSTALL=1` run was 3.1s, and the only failure was the scenario that explicitly asserts `node_modules/eslint` and `node_modules/@cucumber/cucumber` exist.
