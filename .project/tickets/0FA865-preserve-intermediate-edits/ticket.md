---
id: 0FA865
slug: preserve-intermediate-edits
type: task
phase: verify
status: in_progress
created: 2026-11-08T23:27:33.769Z
last_modified: 2026-11-08T23:27:33.769Z
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

- Focused GREEN: 34 tests passed across host-toolchain and post-edit-preservation suites.
- Tests mock external tool processes only and assert preserved bytes and diagnostic delivery.
- Initial implementation preceded recorded RED evidence; no historical RED commit is claimed.
- Project-wide typecheck passed after a frozen-lockfile forced reinstall repaired missing AJV files.
- Independent Claude review approved both passes, including strengthened diagnostic and marker assertions.
- User approved updating existing tests to require check-only behavior and preserved contents. Codex hook assertions and matching integration assertions now reflect that requirement.
- Codex wiring confirmed: collectPostToolLintContexts executes post-tool-lint.ts with tool_input.file_path.
- Approved Codex tests now require check-only argv and exact preservation of a pending import and unrelated unformatted code.
- Root formatter acceptance was reconciled with the new contract. Positive process/diagnostic checks prevent startup failures from falsely satisfying preservation assertions; targeted acceptance passes 10/10.
- Independent Claude approved the expanded code/test packet (5e6ec2bf-abb6-48c3-95a3-98cde606f479) and the strengthened acceptance packet (c5e4eb8d-4a26-46c3-a10e-5dede07b96c0).
- Review suggestions retained as non-blocking limits: root Biome acceptance may exercise unavailable-tool warnings; real local Biome/Ultracite mutation regression coverage is in hook-entry and host-toolchain suites. Cursor preserves its prior silent diagnostic handling. Other-language mutation policy is separate work.
- All five generated surfaces regenerated and lifecycle fixtures verified before the final stable-source full-suite run. Parity: 276 pairs and 11 contracts in sync.

## Out of scope

- Changing Python, Rust, SQL, shell, or document post-edit mutation policy.
- Installing or activating global Claude/Codex profiles.
- Unrelated UTF-8 diagnostic truncation behavior.

## Work Log

- 2026-11-08T23:27:33.769Z Started: Created ticket 0FA865
- 2026-11-11: Resumed final verification after PR #7158 passed CI at f1be248a7. Merged newer main through e49310a74 as 4c548cc99; only generated metadata conflicted, and all five surfaces were regenerated. Post-merge focused verification passed 95 tests, formatter acceptance passed 10 scenarios, and lint/types/parity passed. Full verification and new-head CI are being collected before closure.
- Baseline acceptance triage: the planning-review fixture in approve-coherent-implementation-plans.feature failed identically on untouched main e00ea1e65 and this branch; a baseline dry run also reproduced 1,786 undefined steps across six unchanged planning features. Those planning-suite problems are outside #2810/#2809 and are not represented as passing checks.
- Final results on 4c548cc99: both Node CI jobs and every reported CI check passed. Local full CLI verification had 11,637 passes and one timeout; that single test passed on the one isolated retry. Package acceptance passed 599 scenarios and 11,786 steps; the lock-blocked proof-tag check passed 52/52 on retry. The aggregate verification exit 75 from shared-lock contention remains documented rather than overwritten. No product changes were needed after the main merge.
- Scoped audit passed with disclosed coverage warnings: no dependency violations, config drift, or broken changed references. Corrected stale automatic-fix descriptions in the README and two website pages; the website built nine pages successfully. Clarified three existing test titles without changing callbacks or assertions. Final CI will validate this documentation/test-label-only follow-up.
