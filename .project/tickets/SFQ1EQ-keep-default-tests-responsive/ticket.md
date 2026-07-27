---
id: SFQ1EQ
slug: keep-default-tests-responsive
type: task
subtype: bug-investigated
phase: implement
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
last_modified: 2026-07-26T04:19:46Z
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
- 2026-06-15T18:28:19Z Second cluster confirmed: after rebasing onto `origin/main`, a full default run still spent ~45s on the first `setup-python-phase2.test.ts` case and ~46s on the first SQL golden-path case. The remaining offenders were config-generation fixtures with bare package.json files, so setup/upgrade still attempted the JS/BDD lane package-manager install before assertions that only needed generated config files.
- 2026-06-15T18:28:19Z Fix path: added a reusable test helper that declares safeword's base JS/BDD devDependencies in fixtures that are not proving installation, then applied it to Python Phase 2 and SQL golden-path setup fixtures. Focused verification passed 30 tests in 13.1s.
- 2026-06-15T18:40:02Z Verification: the full default `bun run test -- --reporter=verbose` suite completed successfully: 199 files passed, 2915 tests passed, 3 skipped, in 605.6s. The run stayed chatty throughout; remaining runtime is broad integration-fixture cost rather than an idle hang.
- 2026-06-15T18:54:10Z CI follow-up: GitHub's default test job stayed chatty and reached the end of the suite, then failed one cleanup path in `tests/commands/upgrade-reconcile.test.ts` with `ENOTEMPTY` while removing a temp `node_modules/@testing-library/user-event/dist/types` directory. The test file used raw `rmSync` instead of the shared retrying `removeTemporaryDirectory()` helper, so a filesystem cleanup race could fail an otherwise-passing run.
- 2026-07-02T03:05:28Z Residual cluster confirmed during #597 verification: the default full suite timed out in `setup-core.test.ts`, `setup-architecture.test.ts`, and then `setup-linting.test.ts`. All three were config/script generation assertions using bare TypeScript fixtures, so setup could still enter package-manager work before reaching assertions that did not test installation.
- 2026-07-02T03:05:28Z Fix: added `createTypeScriptProjectReadyForSetup()` for config-only TypeScript setup fixtures. The helper predeclares safeword's base JS/BDD devDependencies while preserving each test's override behavior, then `setup-core`, `setup-architecture`, and `setup-linting` switched to that helper. Real install coverage remains in the existing install-proof paths instead of these config-only assertions.
- 2026-07-02T03:05:28Z Verification: the exact lint timeout repro passed in 4.18s; the affected setup batch (`setup-core`, `setup-architecture`, `setup-linting`, `setup-python-phase2`) passed 42 tests in 58.78s; `bun run lint`, `bun run typecheck`, full `bun run test`, and `bun run test:bdd` all passed. Full Vitest result: 280 files passed, 4097 tests passed, 3 skipped, in 945.02s. BDD result: 181 scenarios and 3414 steps passed in 1m 59.569s.
- 2026-07-26T03:56:32Z Reprofiled current main before changing the scheduler: 369 files / 5467 tests passed, with 449.27s runner wall time. The slowest files were `setup-cursor.test.ts` (95.47s), `conditional-setup.test.ts` (92.65s), and `setup-hooks.test.ts` (86.13s); 282 files completed in under one second.
- 2026-07-26T03:56:32Z `/figure-it-out`: rejected a higher worker cap and Vitest project split for this slice. A `SAFEWORD_SKIP_INSTALL=1` probe cut the three leading files to 3.51–4.42s; 39/40 tests passed, and the sole failure was the genuine non-git installation proof that belongs in `conditional-setup.slow.test.ts`. Decision: finish the default/slow boundary before revisiting CQJBSN scheduler work.
- 2026-07-26T04:19:46Z Implemented two profile-guided slices: six config-only suites now use an explicit no-install runner, the non-git physical-install proof runs in the slow lane, and a source contract prevents those audited files from regressing to raw setup calls. Final profile passed 370 files / 5474 tests in 321.79s runner wall, down 127.48s (28.4%) from the 449.27s baseline. Lint, typecheck, focused slow proof, and full BDD also passed. Ticket remains in progress: the next dominant file (`override-survival`, 68.27s) already skips installs and needs a separate root-cause slice.
- 2026-07-27T08:01:00Z Review hardening: caught the branch up to current `main`; made the no-install helper override-proof; strengthened the non-git proof to require installed ESLint and safeword package artifacts; added a focused `test:slow:install-proof` CI step; and closed the raw `runCliSync` boundary gap. The focused proof passed in 6.59s and failed when `SAFEWORD_SKIP_INSTALL=1`, confirming the physical-install assertion is sensitive to installation being disabled.
- 2026-07-27T09:20:00Z Full audit/refactor closeout: isolated the physical install proof into a dedicated slow file selected without title matching; made install opt-in explicit; shortened stale config-only timeouts; hardened the migrated-suite boundary with TypeScript import analysis for direct, aliased, and namespace calls; and updated authoritative lane documentation. Full Vitest (5556 passed, 5 skipped), BDD (505 passed, 3 skipped), lint, typecheck, build, audit, and focused install evidence passed.

## Root Cause

The default Vitest lane includes fixture tests that repeatedly run `safeword setup` and `safeword upgrade` without `SAFEWORD_SKIP_INSTALL`, even when the assertion only checks generated files, output text, or preserved configuration. `createConfiguredProject()` also ran a full setup install and declared only part of safeword's base dependency set, so later upgrade/check fixtures could still detect missing package declarations and attempt package-manager work.

This happens because install coverage and configuration-generation coverage share the same helpers. The test harness had no cheap default fixture path, so many non-install assertions accidentally paid the real install cost.

Confirmed by measuring `setup-python.test.ts`: normal run was 76.7s for 6 tests; `SAFEWORD_SKIP_INSTALL=1` run was 3.1s, and the only failure was the scenario that explicitly asserts `node_modules/eslint` and `node_modules/@cucumber/cucumber` exist.

A second full-suite attempt after rebasing confirmed the same pattern outside the original files: `setup-python-phase2.test.ts` and `sql-golden-path.test.ts` were not testing package installation, but their fixtures lacked safeword's base JS/BDD devDependency declarations. Setup therefore spawned package-manager work just to reach generated-file assertions. Predeclaring those dependencies in config-only fixtures removed the install work while preserving the real install-proof lane.

A July 2026 revalidation found the same residual fixture issue in TypeScript setup coverage: `setup-core.test.ts`, `setup-architecture.test.ts`, and `setup-linting.test.ts` used bare TypeScript package fixtures for assertions about generated directories, scripts, config files, and output. Those tests were not install-proof tests, but missing safeword base dependency declarations meant setup could still attempt package-manager work and hit Vitest's 60s per-test timeout.

The CI-only `upgrade-reconcile.test.ts` failure was a separate harness cleanup race: the test ran real package-manager work and then its `afterEach` called raw `rmSync` on the temp fixture. GitHub Actions still had a nested `node_modules` path in flux, producing `ENOTEMPTY`. The repository already has `removeTemporaryDirectory()` with retries for this exact class of temp cleanup race; using that helper in the failing file fixes the harness failure without changing product behavior.
