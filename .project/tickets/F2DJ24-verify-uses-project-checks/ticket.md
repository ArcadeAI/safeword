---
id: F2DJ24
slug: verify-uses-project-checks
type: task
phase: verify
status: in_progress
parent: KJAM82-verify-safeword-in-any-project
epic: verify-safeword-in-any-project
created: 2026-06-16T05:40:08.181Z
last_modified: 2026-06-23T22:38:41-07:00
scope:
  - Make installed `/verify` choose target-project checks from available scripts and package-manager evidence instead of hardcoding Bun monorepo commands.
  - Run first-class verification checks for supported installed project stacks: JavaScript, Python, Rust, and Go.
  - Document explicit skips/manual-evidence fallbacks only for unsupported stacks or absent stack-specific automation evidence.
  - Keep template sources and dogfood installed copies aligned for the changed verification surfaces.
out_of_scope:
  - Implementing verification runners for ecosystems safeword does not currently support.
  - Removing Bun as safeword's installed hook/helper runtime.
  - Closing the parent epic or changing unrelated done-gate semantics.
done_when:
  - `/verify` guidance uses detected package-manager commands for npm, pnpm, yarn, and Bun projects.
  - `/verify` guidance runs Python, Rust, and Go checks from stack-native project evidence instead of treating non-JavaScript projects as manual fallback.
  - `/verify` skips absent `build`, `test`, and `test:bdd` scripts with explicit evidence requirements instead of emitting false failures.
  - Regression tests cover no-build JavaScript, non-Bun JavaScript, Python, Rust, and Go installed-project shapes.
  - Template and dogfood installed copies are byte-aligned for changed files.
---

# Run installed verification with project checks

**Goal:** Make installed `/verify` prove work with the customer's available project checks instead of assuming safeword's Bun monorepo scripts.

**Why:** Arbitrary customer projects should not fail verification because `bun run test`, `bun run test:bdd`, or `bun run build` is missing.

## Task Spec

**Type:** Improvement

**Scope:** Update `/verify` command and skill templates, plus their dogfood outputs, so verification instructions detect package-manager/script evidence before choosing commands. Add regression coverage for no-build JS, non-Bun JS, and non-JS installed projects.

**Out of Scope:** Unsupported language ecosystems, Bun hook runtime changes, and parent epic closure.

**Done When:**

- [x] `/verify` names npm/pnpm/yarn/Bun command selection from lockfiles and scripts.
- [x] `/verify` runs stack-native checks for Python, Rust, and Go projects instead of treating them as generic non-JS skips.
- [x] `/verify` treats missing `test`, `test:bdd`, and `build` scripts as explicit skips/manual-evidence gaps, not command failures.
- [x] Regression fixtures prove non-Bun JS, no-build JS, Python, Rust, and Go installed projects are represented.
- [x] Changed templates and installed dogfood copies are byte-identical.

**Tests:**

- [x] Unit/template: verify surfaces contain package-manager-aware npm/pnpm/yarn/Bun command guidance.
- [x] Unit/template: verify surfaces contain skip/manual-evidence guidance for missing `test`, `test:bdd`, and `build`.
- [x] Unit/template: verify surfaces cover no-build JS, non-Bun JS, Python, Rust, and Go regression fixtures.
- [x] Parity: changed command/skill templates match `.agents`, `.claude`, and `.cursor` dogfood copies.

## Work Log

- 2026-06-16T05:40:08.181Z Started: Created ticket F2DJ24
- 2026-06-16T05:40:21Z Scoped: Child of KJAM82 for `/verify` package-manager/script-aware guidance plus regression fixtures and dogfood alignment.
- 2026-06-16T05:42:36Z RED: Focused verify/audit template tests failed with 18 expected assertions against Bun-hardcoded guidance.
- 2026-06-16T05:49:50Z GREEN: Focused verify/audit template tests pass (49 tests) after template-first edits and dogfood upgrade refresh.
- 2026-06-16T06:13:06Z VALIDATED: `bun run lint`, `bun run --cwd packages/cli test -- --reporter=dot` (200 files, 3012 passed, 3 skipped), `bun run test:bdd` (31 scenarios, 237 steps), release dogfood parity, targeted verify/audit template checks, `safeword check`, and `git diff --check` passed.
- 2026-06-16T06:16:30Z Ready for close review: Ticket remains `in_progress` per rule requiring user confirmation before marking done.
- 2026-06-16T12:17:58Z Scope correction: User clarified Python, Rust, and Go are supported stacks and must get equal first-class verification, not generic non-JS manual fallback.
- 2026-06-16T12:17:58Z RED: Added failing template tests for Python/Rust/Go `/verify` checks and `/audit` Yarn-modern/Rust stack awareness.
- 2026-06-16T16:00:26Z GREEN: `/verify` templates now run JS package scripts plus Python pytest/build, Go test/build, and Rust test/build from project manifests; `/audit` templates now gate JS checks, branch Yarn Classic vs modern, and include Rust-specific checks.
- 2026-06-16T16:00:26Z VALIDATED: Focused verify/audit tests pass, dogfood parity passes, bash/zsh syntax checks pass, lint/typecheck passes, BDD passes, safeword check passes, and `git diff --check` passes.
- 2026-06-16T16:00:26Z VALIDATION CAVEAT: Full CLI Vitest suite was run and failed in existing slow setup/reconcile integration paths outside this change (`rust-golden-path` setup install timeout/exit and `check-reconcile` timeout). Standalone npm install of the same generated deps succeeded but took about 3 minutes.
- 2026-06-23T22:38:41-07:00 MAIN CATCH-UP: Fast-forwarded to `origin/main` (`cad9f13e`), which already contains `BKTTZA` (`safeword test-plan`) and `5FF0ZD` (`/verify` consumes test-plan). Resolved `/verify` toward that single-source resolver instead of restoring the older inline language shell; retained `/audit` package-manager/native-stack improvements and re-ran focused validation.
- 2026-06-23T22:59:35-07:00 REVALIDATED: Focused verify/audit/test-plan tests pass (84 tests), dogfood parity passes, `bun run lint` passes, `safeword check` passes, `git diff --check` passes, and the full CLI Vitest suite passes (240 files, 3507 passed, 3 skipped).
