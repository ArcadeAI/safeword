# Verify: Keep dependencies out of commits in fresh Safeword projects

Verified: 2026-11-15 against `origin/main` merge base 02a996e7c on commit 1406434a1 (PR ArcadeAI/safeword#7516).

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: local full run 11722/11764 pass with 22 failures in 17 unrelated files (review-route probe timeouts under concurrent load from other worktrees, the known GOROOT 1.25.14 vs go 1.27.1 mismatch in `lint-go-context.test.ts`, and setup/reset/check tests). None touch the `.gitignore` block. CI's full suite on the same commit passes on node 22.23.2 and 24.18.1. Targeted runs: `reconcile.test.ts` 88/88, `schema` + `reconcile-namespace-root` + `dogfood-source-worktree` + `owned-paths` + `tests/claude-plugin` all pass.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint, Prettier)
**Typecheck:** ✅ Clean (`tsc --noEmit` for retro-relay, retro-collector, cli)
**Scenarios:** ⏭️ Skipped — patch ticket has no test-definitions.md; behavior is proven by four `reconcile.test.ts` cases, each mutation-checked to fail without the change
**Refactor:** ✅ Completed — 1406434a1 names the gitignore path in the fresh-install test; dead `untrackIgnoredFiles` deferred as out of scope
**PR Scope:** ✅ Diff matches ticket scope (schema.ts block and recognizer, reconcile tests, this repo's .gitignore, regenerated plugin bundles, this ticket)
**Dep Drift:** ✅ Clean (no dependencies changed; `bun audit`, `uv audit`, Go/Rust advisories clean)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked a new user through `safeword install` → `bun install` → `git add -A`; worst step before = dependencies staged, after = none; new steps vs before = 0
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (`safeword-cli` install/upgrade/uninstall via real `reconcile()` in `reconcile.test.ts`)
**Evidence limits:** ⚠️ Local concurrent-load timeouts and Go toolchain mismatch; affected failures are not product evidence and pass in CI on 1406434a1

Audit passed — 0 errors and 0 warnings. Diff-scoped sync-config healthy; dependency-cruiser 0 violations across 509 modules; no docs describe the block contents. Knip, clone and dependency-freshness discovery are outside diff-audit scope.

Quality review APPROVED by an independent Codex reviewer (cross-agent). First pass raised one error (an older block's trailing customer `node_modules/` rule was absorbed on upgrade and deleted on uninstall); fixed in fe0a2f60f with a regression test, and the second pass approved with no findings.
