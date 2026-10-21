# Verification

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: another worktree's live test held the shared package-test lock. Relay: 198 passed, 1 skipped; collector: 153 passed. Final CLI Vitest suite did not start. Final real-linter manual checks: 24/24 passed across v2.0.0 and v2.13.2.
**Gherkin:** ⚠️ Local environment limitation: 601/601 acceptance scenarios and 11821/11821 steps passed; the separate Vitest proof-tag check could not acquire the shared lock.
**Build:** ✅ Success — all resolved project build lanes passed.
**Lint:** ✅ Clean — repository ESLint/Gherkin lint passed; changed-source ESLint and formatting passed again after the compatibility correction, including normal commit hooks.
**Typecheck:** ✅ Clean — all resolved TypeScript typecheck lanes passed after the final source changes.
**Scenarios:** ⏭️ Skipped — this bug-investigated task uses regression tests and a manual proof matrix, with no separate scenario artifact.
**Refactor:** ✅ No change warranted — configuration policy and cleanup each have one owner; no unrelated restructuring was needed.
**PR Scope:** ✅ Diff matches ticket scope — Go package loading, configuration preservation, feedback, host wiring, regression proof, generated carriers and directly affected documentation only.
**Dep Drift:** ✅ Clean — no dependency manifests or lockfiles changed; existing YAML/TOML runtime dependencies are documented in ARCHITECTURE.md.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing CLI resolver and hook result protocol retained. See version-compatibility.md for the interpolation correction.
**Experience:** ✅ No new friction — walked a Go developer through editing package tests and nested-module source via the actual source hook; worst step = package feedback can include pre-existing sibling lint debt; new manual steps vs before = 0. No killer demo was declared.
**Surface Evidence:** ⚠️ Limited — final shared source-hook process proof passed on both linter versions. Codex/Cursor boundary tests passed earlier; their final Vitest rerun was lock-limited. No live editor was exercised.
**Evidence limits:** ⚠️ Full CLI, smoke and proof-tag Vitest checks could not start while another worktree owned the lock. Ruleguard located its normalized resource file but could not import its unavailable DSL dependency. No full-suite or successful ruleguard-execution claim is made.

**Dependency Audit:** ❌ Existing dependency advisories: Bun reported 7 findings
(2 high, 2 moderate, 3 low); uv reported 2 advisory records for certifi. The
other Python scan reported none. Go found no reachable vulnerable calls, while
noting advisories in imported/required modules. Dependency files are unchanged
from origin/main; remediation is outside this fix.

Audit passed with warnings; see audit.md, review-notes.md and the independent
approval receipts. The compatibility correction was approved separately in
compatibility-review.json.

## Commands and results

The packaged verify skill's complete shell block ran as one bash invocation
through scripts/dev. Aggregate exit status: 75, preserving the first test-lock
failure. The first CLI attempt waited 15 minutes without starting tests. Later
duplicate CLI and proof-tag waiters from that workflow were terminated after
confirming their PID and this worktree's cwd. The other worktree's runner and
lock were not modified.

Acceptance completed before its separate proof-tag check waited. Build,
typecheck and dependency lanes all executed. verification-output.txt preserves
the console output with only bundle listings and progress dots removed.

`scripts/dev bun run test:smoke:fast` waited one minute and exited 75 without
starting tests; see smoke-output.txt.

Parity passed all 277 pairs and 11 contracts. The generated-surface checker
reported all five surfaces current after regeneration. Its additional lifecycle
Vitest invocation was lock-limited; the earlier lifecycle run and template
digest check passed. Final compatibility changes did not edit templates.

Final direct checks and reproducible probes are in manual-evidence.md. The 88
focused automated tests and 28 compatibility tests in the work log are
historical runs before the final compatibility correction.

## Affected surfaces

| Affected surface | Proof | Result |
| --- | --- | --- |
| Shared Go executor | Nine policy probes per version | 18/18 passed on final source |
| Claude shared hook entry | Three package/module probes per version | 6/6 passed; no live client |
| Codex packaged-hook boundary | Earlier codex-hook.test.ts warning-plus-findings check | Passed earlier; final rerun lock-limited |
| Cursor after-file-edit boundary | Earlier lifecycle.test.ts launch/workspace check | Passed earlier; final rerun lock-limited; no new feedback delivery claimed |
| Generated/dogfood copies | Parity and generated-surface checks | Current; final lifecycle Vitest rerun lock-limited |
| CI compatibility lane | Tool-required v2.0.0/Go 1.24 and v2.13.2/Go 1.27 matrix | Added; CI has not run locally |

## Remaining verification

Run full CLI, smoke and proof-tag checks once the shared runner finishes.
Resolve dependency advisories separately. The ticket is not marked done.
