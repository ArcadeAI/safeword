## Verify Checklist

**Test Suite:** ✓ 11622/11622 tests pass across 719 CLI test files; 14 skipped. Relay: 198 passed, 1 skipped; collector: 153 passed. Final CLI run used stable generated sources.
**Gherkin:** ✅ Targeted root formatter acceptance passed 10/10; package acceptance passed 599/599. Supplementary root-wide acceptance was stopped after reporting failures/undefined steps and recursively launching other test suites; it is incomplete and is not counted as passing evidence. No baseline attribution is claimed for those unclassified failures.
**Build:** ✅ Success — root full verification build and final CLI test-wrapper build passed.
**Typecheck:** ✅ Success — root typecheck passed for all three packages.
**Lint:** ✅ Success — root lint passed, including Gherkin validation and CLI typecheck.
**Scenarios:** Task; hook-entry tests cover Claude and Cursor with ESLint, Biome, and Ultracite. Approved Codex tests cover file edits and apply_patch and require check-only argv and preserved contents. Root preservation scenarios include positive diagnostic checks.
**Dependencies:** No manifests or lockfiles changed. Forced frozen-lockfile reinstall repaired local missing files. Broad dependency audit reports existing JavaScript and Python advisories; those are outside this bug fix and are not claimed clean.
**PR Scope:** ✅ Only post-edit JS/TS preservation, supporting tests, generated mirrors, and evidence.
**Quality Review:** Approved independently by Claude for code, expanded Codex/integration tests, and strengthened root acceptance. Startup-failure, diagnostic-output, and marker coverage findings were fixed. Remaining optional warnings and scope limits are recorded in ticket.md.
**Generated surfaces:** All five regenerated and lifecycle fixtures verified; final full suite includes passing origin-main lifecycle contracts. Dogfood parity passed for 276 pairs and 11 contracts.
**Experience Peak:** No feature demo declared. Preservation demonstrated through actual Claude/Cursor hook subprocesses with external-tool boundary doubles.

The scoped fix passed the full CLI suite, targeted root acceptance, lint, types, build, generated checks, and independent review. Overall repository-wide verification is not claimed clean: dependency audit findings and incomplete supplementary root acceptance remain. No release or issue closure is claimed.
