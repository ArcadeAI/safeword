# Verify: stop-hook-pinned-toolchain (4J2WX2)

Run at 8727f8d7e with every lane under the project's mise-pinned PATH (`mise bin-paths`), the PATH the Stop hook now builds.

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: load average ~5.5 from other sessions' suites. The full suite ran twice in the verify lane. Run 1: 11971 passed, 3 failed. Run 2: 8 files failed. Each run failed a different set, nearly all at the 60 s test timeout, in reset, setup, upgrade and review-wiring tests this change does not touch. All 11 failing files then passed together in isolation (✓ 250/250 tests pass). The ticket's own tests: ✓ 24/24 tests pass (test-runner-pinned-toolchain, test-runner, test-runner-environment, done-gate-toolchain-missing, done-gate-failing-suite).
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps, under pinned Bun 1.4.4; these 4 scenarios in `migrate-codex-to-plugin.feature` failed under host Bun 1.3.14 before the change)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean (tsc --noEmit in all three packages, astro check 0 errors)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — 92324d5da removed the redundant empty bin-paths branch
**PR Scope:** ✅ Diff matches ticket scope (test runner template, its installed and generated copies, lifecycle fixture digests, one README sentence, ticket and test)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (end-of-turn test plumbing)
**Surface Evidence:** ⏭️ N/A — no affected surfaces in a spec
**Evidence limits:** ⚠️ Shared machine under load; full-suite timeouts are not product evidence. CI on the PR is the clean full-suite run.

## Real-host proof

- Host PATH `bun` is 1.3.14; `PATH="$(mise -C . bin-paths):$PATH" bun --version` prints 1.4.4.
- The installed `.safeword/hooks/lib/test-runner.ts` `runTests(repo)` run under host Bun 1.3.14 reached the acceptance lane without the lockfile error. Its fast lane `bun run test:done` then hit the hook's 60 s cap. Run alone, that lane takes 56–60 s on this machine. The cap and lane length predate this change.
- 2026-11-23, after merging main (which includes #7963's faster fast lane): the installed `.safeword/hooks/lib/test-runner.ts` `runTests(repo)`, the function the Stop hook calls, run on host Bun 1.3.14 with the inherited PATH, returned `passed: true` in 532 s. That run covers both the test plan (`bun run test:done`, retro packages, Go checker) and the acceptance (bdd) plan, where the 4 `migrate-codex-to-plugin.feature` lockfile failures used to come from. Real `mise config ls --json` / `bin-paths` output for this repo is in `real-mise-evidence.txt`.
- `tests/hooks/lint-go-context.test.ts` fails in a shell where `GOROOT` (mise, Go 1.25.14) and the PATH `go` (1.27.1) differ. It passes 18/18 under the hook's pinned PATH, which puts Go 1.25.14 first.

## Audit

Audit passed — 0 errors, 0 warnings (diff scope; README updated in d356a9bca for the documentation-impact finding).

## Independent review

Five Codex (gpt-6.1-sol) cross-agent quality-review passes. Fixed:

1. Fallback note lost to output truncation (9b1bc6a80).
2. Test-plan lookup runtime not proven (fb2f3345b).
3. `mise.local.toml` and other config names missed, so mise now decides which configs count (67b3a7c21).
4. Proof bypassed the production CLI lookup (8727f8d7e).

The final pass asked only for this real-host proof.
