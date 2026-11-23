# Verify: stop-hook-pinned-toolchain (4J2WX2)

Run on 2026-11-23 at c73c2a34b (after merging main, which includes #7963) through `scripts/dev`, which pins Bun 1.4.4 and Node 24.18.1. Go lanes rerun with every mise-pinned tool first on PATH, the PATH the Stop hook now builds.

## Verify Checklist

**Test Suite:** ✓ 12035/12035 tests pass (14 skipped). The verify lane ran 12049 tests with 2 failures, both in `tests/hooks/lint-go-context.test.ts`, plus the Go checker build. All three came from this shell's Go mismatch (`GOROOT` Go 1.25.14, PATH `go` 1.27.1, since `scripts/dev` pins only Bun and Node). Under the pinned PATH (Go 1.25.14): lint-go-context and tooling-validation ✓ 29/29 tests pass, and the Go checker builds. The lane's automatic rerun also hit an npm registry 404 in tooling-validation, which passed on its first run and again in isolation.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (pre-commit eslint and prettier on every commit; shadowing fixed in c73c2a34b)
**Typecheck:** ✅ Clean (0 errors)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — 92324d5da removed the redundant empty bin-paths branch
**PR Scope:** ✅ Diff matches ticket scope (test runner template, its installed and generated copies, lifecycle fixture digests, one README sentence, ticket, evidence and test)
**Dep Drift:** ✅ Clean (no dependencies added; `bun audit`, `uv`/`pip` and `govulncheck` report no known vulnerabilities)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (end-of-turn test plumbing)
**Surface Evidence:** ⏭️ N/A — no affected surfaces in a spec
**Evidence limits:** ⚠️ This shell's Go toolchain mismatch (GOROOT vs PATH `go`) and one npm registry 404; both reproduce as passes under the pinned PATH, so neither is product evidence. CI on the PR is the clean full-suite run.

## Real-host proof

- Host PATH `bun` is 1.3.14; `PATH="$(mise -C . bin-paths):$PATH" bun --version` prints 1.4.4.
- The installed `.safeword/hooks/lib/test-runner.ts` `runTests(repo)` run under host Bun 1.3.14 reached the acceptance lane without the lockfile error. Its fast lane `bun run test:done` then hit the hook's 60 s cap. Run alone, that lane takes 56–60 s on this machine. The cap and lane length predate this change.
- 2026-11-23, after merging main (which includes #7963's faster fast lane): the installed `.safeword/hooks/lib/test-runner.ts` `runTests(repo)`, the function the Stop hook calls, run on host Bun 1.3.14 with the inherited PATH, returned `passed: true` in 532 s. That run covers both the test plan (`bun run test:done`, retro packages, Go checker) and the acceptance (bdd) plan, where the 4 `migrate-codex-to-plugin.feature` lockfile failures used to come from. Real `mise config ls --json` / `bin-paths` output for this repo is in `real-mise-evidence.txt`.
- `tests/hooks/lint-go-context.test.ts` fails in a shell where `GOROOT` (mise, Go 1.25.14) and the PATH `go` (1.27.1) differ. It passes 18/18 under the hook's pinned PATH, which puts Go 1.25.14 first.

## Audit

Audit passed — 0 errors, 0 warnings (2026-11-23, diff scope against origin/main 4614807724; depcruise: no violations; sync-config healthy; test file reviewed against the testing iron laws; README covers the behavior, website docs make no affected claim).

## Independent review

Five Codex (gpt-6.1-sol) cross-agent quality-review passes. Fixed:

1. Fallback note lost to output truncation (9b1bc6a80).
2. Test-plan lookup runtime not proven (fb2f3345b).
3. `mise.local.toml` and other config names missed, so mise now decides which configs count (67b3a7c21).
4. Proof bypassed the production CLI lookup (8727f8d7e).

The final pass asked only for this real-host proof.

2026-11-23 implement-phase reviews (Codex gpt-6.1-sol, cross-agent) fixed:

5. Fallback note dropped when the test plan is empty (8a8612e91 RED, d072bb5f1 GREEN).
6. Fallback tests did not prove PATH is unchanged; they now assert exact equality with the inherited PATH, and a PATH-appending mutant fails both (c73c2a34b).

Review 3dc5d34c-9cc7-4606-9e11-1100e7769b25 approved every file in the diff and is stamped for the implement phase.
