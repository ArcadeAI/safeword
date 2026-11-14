---
id: 0FA865
slug: preserve-intermediate-edits
type: task
phase: verify
status: in_progress
created: 2026-11-08T23:27:33.769Z
last_modified: 2026-11-14T15:32:32.131Z
---

# Preserve unfinished edits for coding agents

**Goal:** Resolve #2810 and #2809 by making post-edit JS/TS diagnostics non-mutating

**Why:** Whole-file fixes between edits rewrite unrelated lines and delete imports before later edits use them.

## Scope

Post-edit JS/TS checks preserve files across Claude, Codex (shared Claude lint hook), and Cursor. Claude/Codex surface diagnostics; Cursor retains its existing marker and silent diagnostic handling. Explicit helper fix mode and other languages retain existing behavior.

Completion follow-up: isolate project test subprocesses from the invoking hook's project and plugin routing variables, so existing acceptance fixtures exercise their own projects and runtimes.

## Done when

- Hook entry tests preserve pending imports and unrelated formatting for ESLint, Biome, and Ultracite.
- Claude receives diagnostics and Cursor retains its existing marker behavior.
- Existing explicit fix-mode tests pass; generated surfaces, lint, types, and test lanes have recorded results.

## Root Cause

The hook invokes whole-file fix commands immediately after each edit. This removes temporarily unused imports and changes untouched code. Mutation timing is the cause; import resolution is not involved. The existing test preset disables some unused-import rules, narrowing but not removing the risk in host configurations.

Completion failure investigation: Codex exports CLAUDE_PROJECT_DIR and SAFEWORD_PLUGIN_CLI to its hook. The test runner removed runtime identity but retained these routing overrides. CLAUDE_PROJECT_DIR redirects the profile fixture to this checkout; SAFEWORD_PLUGIN_CLI overrides the lockfile fixture's runtime. Each acceptance failure reproduced by injecting its corresponding variable. A real runTests fixture failed with HOOK_ENV_LEAKED before the fix and passed afterward, ruling out formatter logic and random timeout as the cause of these failures. The fix extends the existing child-environment boundary while preserving parent state and ordinary application variables.

## Design decision

Post-edit JS/TS checks become observational; explicit lint actions retain mutation. Changed-line filtering cannot safely distinguish imports spanning multiple edits; scheduling delayed fixes requires new state. The local check-only option avoids both failure classes. Tradeoff: automatic JS/TS Prettier formatting is deferred to explicit formatting or commit tooling. Real hook-entry tests cover Claude and Cursor; Codex invokes the shared Claude hook.

## Test evidence

User-authorized test-quality follow-up (November 13): strengthen the four installed-hook preservation tests to require successful startup and a real ESLint no-var diagnostic; require checker execution evidence for both Claude and Cursor hook subprocess tests; replace the Biome BDD missing-tool allowance with an executable fixture checker and required diagnostic. Validate the strengthened assertions against both skipped checking and restored mutating entrypoints, then restore production sources and rerun GREEN. This is present-day regression validation, not historical RED evidence for the original implementation.

- Historical focused GREEN before this follow-up: 34 tests passed across host-toolchain and post-edit-preservation suites; the current follow-up passes 38/38 surrounding tests.
- Tests mock external tool processes only and assert preserved bytes and diagnostic delivery.
- Initial implementation preceded recorded RED evidence; no historical RED commit is claimed.
- Project-wide typecheck passed after a frozen-lockfile forced reinstall repaired missing AJV files.
- Independent Claude review approved both passes, including strengthened diagnostic and marker assertions.
- User approved updating existing tests to require check-only behavior and preserved contents. Codex hook assertions and matching integration assertions now reflect that requirement.
- Codex wiring confirmed: collectPostToolLintContexts executes post-tool-lint.ts with tool_input.file_path.
- Approved Codex tests now require check-only argv and exact preservation of a pending import and unrelated unformatted code.
- Root formatter acceptance was reconciled with the new contract. Positive process/diagnostic checks prevent startup failures from falsely satisfying preservation assertions; targeted acceptance passes 10/10.
- Independent Claude approved the expanded code/test packet (5e6ec2bf-abb6-48c3-95a3-98cde606f479) and the strengthened acceptance packet (c5e4eb8d-4a26-46c3-a10e-5dede07b96c0).
- Historical review noted that root Biome acceptance could exercise an unavailable-tool warning. The test-quality follow-up replaces that allowance with an executable fixture checker and required structured findings. Real Biome/Ultracite version compatibility remains bounded to subprocess doubles and command-contract coverage. Cursor preserves its prior silent diagnostic handling; other-language mutation policy is separate work.
- All five generated surfaces regenerated and lifecycle fixtures verified before the final stable-source full-suite run. Parity: 276 pairs and 11 contracts in sync.

## Out of scope

- Changing Python, Rust, SQL, shell, or document post-edit mutation policy.
- Installing or activating global Claude/Codex profiles.
- Unrelated UTF-8 diagnostic truncation behavior.

## November 14 delivery refresh

The user authorized proceeding through publication and readiness. Publishing the two completed evaluation commits exposed conflicts with newer main. Merged origin/main through 07d01d3fe as 8a280a919; only generated plugin identity/inventory conflicted, and all five delivery surfaces were regenerated from combined sources. The five production preservation hook/helper files and the evaluation source are byte-identical to pre-merge 69f7e7f53. Incoming dependency-security and plan-approval changes are main ancestry, not this fix's authored scope. The related opt-in evaluation is the separately completed 3J0QCR task.

Frozen dependency installation completed and its readiness marker was refreshed through the supported post-install writer. Post-merge targeted verification passed 172 tests in nine files, including the incoming plan-approval regression. Full lint/Gherkin validation, all-package typechecks, and generated-surface checks passed. Scoped audit found no dependency violations across 545 modules and 925 edges; learning/domain checks passed. The initial domain audit extraction truncated a four-backtick shell block and failed to parse; the complete verbatim block then passed. Principle trace remains N/A for this task without an implementation plan. The native source CLI completion passed and closed this ticket at 2026-11-14T15:32:32.131Z; a fresh no-model hook probe also passed on the merged dependencies, while final-head hosted CI awaits publication; the intentionally cancelled stale-head CI is not a passing result. No additional paid eval run is needed because its exercised production and experiment source did not change.

## Work Log

- 2026-11-08T23:27:33.769Z Started: Created ticket 0FA865
- 2026-11-11: Resumed final verification after PR #7158 passed CI at f1be248a7. Merged newer main through e49310a74 as 4c548cc99; only generated metadata conflicted, and all five surfaces were regenerated. Post-merge focused verification passed 95 tests, formatter acceptance passed 10 scenarios, and lint/types/parity passed. Full verification and new-head CI are being collected before closure.
- Baseline acceptance triage: the planning-review fixture in approve-coherent-implementation-plans.feature failed identically on untouched main e00ea1e65 and this branch; a baseline dry run also reproduced 1,786 undefined steps across six unchanged planning features. Those planning-suite problems are outside #2810/#2809 and are not represented as passing checks.
- Final results on 4c548cc99: both Node CI jobs and every reported CI check passed. Local full CLI verification had 11,637 passes and one timeout; that single test passed on the one isolated retry. Package acceptance passed 599 scenarios and 11,786 steps; the lock-blocked proof-tag check passed 52/52 on retry. The aggregate verification exit 75 from shared-lock contention remains documented rather than overwritten. No product changes were needed after the main merge.
- Scoped audit passed with disclosed coverage warnings: no dependency violations, config drift, or broken changed references. Corrected stale automatic-fix descriptions in the README and two website pages; the website built nine pages successfully. Clarified three existing test titles without changing callbacks or assertions. Final CI will validate this documentation/test-label-only follow-up.
- 2026-11-13: Merged current main through fd784a2fd as 4ea11f5e5 and regenerated six conflicting generated files. Fix sources remained unchanged; 171 focused tests, types, parity, generated surfaces, scoped audit, and the repeated installed-hook walkthrough passed. After pinned dependency refresh, the real source CLI Codex Stop check passed every configured completion lane and changed this ticket to done at 14:43:35 UTC. Earlier lock-blocked attempts remain historical evidence, not a claim of success for those runs.
- 2026-11-13T23:02Z: User authorized strengthening the weak tests and validating them against broken behavior. Reopened this ticket at implement/in_progress; the earlier completion above is historical. BDD baseline passes 10/10; the installed-hook Vitest baseline is queued behind another worktree. No mutation result or renewed completion is claimed yet. Independent implementation review approved with actionable fixture/restoration notes, which were addressed before experiments.
- Test-quality validation: fixed baseline passed 10 targeted tests and 10 BDD scenarios. Restoring the original mutating entrypoints caused all 10 targeted tests and the five affected BDD scenarios to fail by assertions. Skipping the checker and returning a missing-tool warning caused all 10 targeted tests and all eight TypeScript scenarios to fail. Review found that the BDD checker tokens also needed to be distinct; after fixing that, bypassing only Biome while real ESLint ran correctly failed both Biome TypeScript scenarios. Integration byte checks now run before diagnostic checks, and the two broken behaviors independently fail the two different assertions. The final harness reran all three controls, generated its summary from raw reports, restored every production hook/mirror byte, and checked the full working-tree diff/status against its baseline. The restored implementation passed all 38 surrounding Vitest tests without filtering or skips and all 10 BDD scenarios (476 steps). All generated surfaces remained current. This validates regression sensitivity today; the original missing RED history remains disclosed.
