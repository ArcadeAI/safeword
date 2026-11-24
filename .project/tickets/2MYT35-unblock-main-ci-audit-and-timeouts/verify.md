# Verify — 2MYT35

One full local verification run, started 2026-11-02T21:51:42Z at head `755584790` (tree `fc02277ff`) in the `safeword-combined` worktree; 3436 s wall clock including about 6 minutes waiting for another session's test lock. The aggregate exited 1 because of the dependency audit lane only; every other lane passed.

## Verify Checklist

**Test Suite:** ✓ CLI 11778/11778 tests pass (12 skipped, 727/727 files) in each of the two CLI passes the plan runs; retro-relay 198 pass (1 skipped); retro-collector 153 pass
**Gherkin:** ✅ Acceptance lane passes — 601 scenarios / 11825 steps; BDD proof bindings 52/52
**Build:** ✅ Success — CLI, retro-relay, retro-collector and website (`astro build`, 9 pages) builds completed
**Lint:** ✅ Clean — CI `lint` job passed on this head (run 41507437273) and on the identical tree (run 41366259506); no separate local `/lint` run in this verification
**Typecheck:** ✅ Clean — `tsc --noEmit` for every TypeScript package, `astro check` 0 errors/warnings/hints, Python mypy "no issues found in 5 source files"
**Scenarios:** ⏭️ Skipped — task ticket; no test-definitions.md (test-setup and dependency-resolution change, see ticket.md Tests)
**Refactor:** ✅ No change warranted — three small test-setup edits and two dependency overrides; nothing structural to improve
**PR Scope:** ✅ Diff matches ticket scope — root `package.json` overrides, `bun.lock`, three lifecycle/integration test files, and this ticket's own files
**Dep Drift:** ✅ Clean — no new dependencies; `undici` was already overridden (8.11.2 → 8.12.2) and `zod` is a new override of an existing transitive dependency, not a new architectural choice
**Dependency Audit:** ❌ JavaScript `bun audit`: 9 advisories (6 moderate, 3 low; 0 high) — minimatch, PostCSS, fast-uri and KaTeX via lint/markdown tooling. The 9239QM verification on main `f211c4c30` (2026-10-29) recorded 17 (5 high, 9 moderate, 3 low); the high undici/zod findings this ticket targets are gone. Python `uv audit`: 16 known advisories in certifi, filelock and msgpack, unchanged from main (Python manifests and lockfiles untouched). Go: govulncheck reports the code affected by 0 vulnerabilities (1 imported-package and 13 required-module findings not called). Audit policy unchanged; CI's `Dependency audit` job passed on this head.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the skip-install stub follows `setup-convergence.test.ts` (`vi.stubEnv`) and the subprocess `SKIP_INSTALL_ENV` helper in tests/helpers.ts
**Experience:** ⏭️ N/A — not persona-facing (CI and test setup)
**Surface Evidence:** ✅ CI is the affected surface: run 41366259506 (identical tree) and run 41507437273 on this head, all checks passing after the attempt-2 rerun of Node 22
**Evidence limits:** ⚠️ Two unexplained CI failures are retained, each not reproduced, cause unconfirmed: the Node 22 `packaged-collector.integration.test.ts` failure on #6367 run 41361927263, and the Node 22 `claude-plugin-release.release.test.ts` 30677 ms timeout on #6433 run 41507437273 attempt 1. The earlier local `job.test.ts` failure is likewise not reproduced; cause unconfirmed.

## Review

Codex cross-agent quality review on the PR diff: f4e74d78 requested zod compatibility evidence (answered with lockfile ranges, no code change); 61c0bf9a approved. Intake review on this ticket: 3e889f55 requested the `bun.lock` change (added `evidence/bun-lock-resolution.md`); 01c619a1 approved.

## Logs

Full verification log retained outside the repository at the session scratchpad `verify-2MYT35.log` (3368 lines, ANSI-stripped copy `verify-2MYT35.clean.log`).
