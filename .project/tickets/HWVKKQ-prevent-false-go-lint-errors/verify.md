# Verification

Final remote result: **SUCCESS** for e4a3b079997efa91df1fad43d27e3026c7d5e258.
Run: https://github.com/ArcadeAI/safeword/actions/runs/39667499218
Machine result: remote-result.json. Audit/refactor detail: remote-verification.md.

## Verify Checklist

**Test Suite:** ✓ 11626/11626 CLI tests pass on both Node 22.23.2 and 24.18.1, with 10 explicit skips per lane. Relay and collector suites pass; both physical-install proofs pass; 83/83 release tests pass per lane. Both Go compatibility lanes pass 30/30 tests.
**Gherkin:** ✅ Acceptance lane passes — 601/601 scenarios, 11821/11821 steps, and 51/51 proof-tag tests.
**Build:** ✅ Success — all resolved project build lanes passed.
**Lint:** ✅ Clean — remote ESLint, Gherkin lint, formatting, Shellcheck and generated-plugin checks pass.
**Typecheck:** ✅ Clean — remote typechecks pass after the final source changes.
**Scenarios:** ⏭️ Skipped — this bug-investigated task uses regression tests and a manual proof matrix, with no separate scenario artifact.
**Refactor:** ✅ Completed — 731e56450 extracts YAML parsing; 258accff3 names stream character limits. Each was independently tested and committed. The scout ledger records declined extractions.
**PR Scope:** ✅ Diff matches ticket scope — Go package loading, configuration preservation, feedback, host wiring, regression proof, generated carriers and directly affected documentation only.
**Dep Drift:** ✅ Clean — no dependency manifests or lockfiles changed; existing YAML/TOML runtime dependencies are documented in ARCHITECTURE.md.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing CLI resolver and hook result protocol retained. See version-compatibility.md for the interpolation correction.
**Experience:** ✅ No new friction — walked a Go developer through editing package tests and nested-module source via the actual source hook; worst step = package feedback can include pre-existing sibling lint debt; new manual steps vs before = 0. No killer demo was declared.
**Surface Evidence:** ✅ 3/3 affected hook process boundaries have recorded proof — shared post-edit entry, packaged Codex entry, and Cursor after-file-edit entry pass in the final automated runs. No live editor session is claimed.
**Evidence limits:** ⚠️ Successful execution of the separate offline ruleguard DSL probe remains unproven; its normalized file was located but the DSL dependency was unavailable. Live editor sessions were not exercised. Earlier local lock limitations are superseded by the passing remote suites.

**Dependency Audit:** ⚠️ The configured remote dependency-policy gate passes.
The earlier unrestricted local audit reported 7 existing Bun findings
(2 high, 2 moderate, 3 low); uv reported 2 advisory records for certifi. The
other Python scan reported none. Go found no reachable vulnerable calls, while
noting advisories in imported/required modules. Dependency files are unchanged
from origin/main; remediation is outside this fix.

Audit passed with warnings; see audit.md, review-notes.md and the independent
approval receipts. The compatibility correction was approved separately in
compatibility-review.json.

## Earlier local commands and results

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
| Codex packaged-hook boundary | Final full suite and parameterized warning-plus-findings / oversized-warning checks | Passes remotely on Node 22 and 24 |
| Cursor after-file-edit boundary | Final lifecycle.test.ts launch/workspace check | Passes remotely; no new feedback delivery claimed |
| Generated/dogfood copies | Final CI parity, plugin freshness, release and lifecycle tests | Passes remotely |
| CI compatibility lane | Tool-required v2.0.0/Go 1.24 and v2.13.2/Go 1.25 matrix | 30/30 tests pass in each lane |

## Completion state

Remote verification is complete. Existing dependency advisories remain outside
this fix. The ticket is not marked done; no merge or release was performed.
