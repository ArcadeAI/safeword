# Verify — pass-own-lint-and-run-real-architecture-check (4ZRS4P)

Verified at `4c06d8d04b93a119b32c4d257c0e749ba2fe3a8a` (the `main` merge), with no edits during the run.

## Verify Checklist

**Test Suite:** ✓ 11881/11883 tests pass (14 skipped). ⚠️ Local environment limitation: the 2 failures are `tests/hooks/lint-go-context.test.ts`, where this machine's Go 1.27.1 tool runs a 1.25.14 compiler ("compile: version go1.25.14 does not match go tool version go1.27.1"). This change touches no Go code, and CI's Go tests pass.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (0 errors on changed files; 2 warnings are intentionally ignored template files)
**Typecheck:** ✅ Clean (`tsc --noEmit -p packages/cli` exit 0)
**Scenarios:** ⏭️ Skipped — task ticket with inline proof; the done_when items map to named tests below
**Refactor:** ✅ Completed — 604e7b93a extracted the repeated typescript-request check in the gate test
**PR Scope:** ✅ Diff matches ticket scope (the fix, its tests, dogfood mirrors, generated surfaces, two doc lines, this ticket and two learnings; out-of-scope bugs routed to #7676, #7687, and a proposed follow-up)
**Dep Drift:** ✅ Clean — only dev tooling (`typescript` for scaffolded projects) is affected; no new architectural dependency
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked a new user through `safeword install --agents cursor` then `eslint .`, `tsc -p .`, `npm run test:bdd`; worst step = the install's package download; new steps vs before = 0, and 16 lint errors are gone
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (installed-project CLI: `tests/integration/typescript-validation.test.ts` fresh-install suite with real installs)
**Evidence limits:** ⚠️ Local Go toolchain mismatch (above); affected Go tests are not product evidence until reproduced elsewhere, and CI's Go tests pass

## done_when → proof

| done_when | Proof |
| --- | --- |
| Fresh TS install (Cursor) passes `eslint .`, `tsc --noEmit`, and the BDD lane; JS-only install gets typescript with no findings in Safeword's files | `typescript-validation.test.ts`: "E2E: Fresh TypeScript install passes its own checks" and "E2E: JavaScript-Only Project" (real installs) |
| A second identical install reports no change | Same suite: "reports no change on a second identical install"; `cli-protocol/setup-convergence.test.ts` |
| The audit never resolves the npm depcruise placeholder; missing, crashing, or zero-module runs are loud | `skills/audit-documentation-sources.test.ts` "audit diff scope" cases |
| Cross-agent review has no open in-scope errors; CI green | Codex reviews 3a1eb5f4 (intake, approved) and b624d755 (implement, approved); CI at the PR head |

## Audit

Audit passed — diff-scoped at this head: no dependency violations (591 modules, 1073 dependencies cruised), dependency-cruiser config in sync, no Python/Go/Rust changes.
