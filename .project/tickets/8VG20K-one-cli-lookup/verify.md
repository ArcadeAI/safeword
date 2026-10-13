# Verify: Run the same Safeword CLI from every hook on every host (8VG20K)

**Verified on:** 2026-10-13 · **Head:** `bb19d7597`

## Verify Checklist

**Test Suite:** ✓ 10554/10554 tests pass (614 files, 14 skipped)
**Gherkin:** ✅ Acceptance lane passes — 596/596 scenarios (dedicated lane and a confirming rerun)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no scenario ledger
**Refactor:** ✅ Completed — `bd73986aa` one containment check; `9b19185bc` each trusted env name listed once; `c27920b46` one package.json reader; `5c928ee50` one GREEN-tick hook helper in tests. Deferred: the retrospective gate's two spawn blocks predate this ticket.
**PR Scope:** ✅ Diff matches ticket scope — the shared lookup module, the hooks moved onto it, the fail-closed test-plan fix and learnings stamp fix in functions this change touched, their tests, regenerated plugin/installed copies, and the ARCHITECTURE.md decision. No unrelated changes.
**Dep Drift:** ✅ Clean — no dependency manifest changed
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the change removes nine divergent lookups in favor of one
**Experience:** ⏭️ N/A — not persona-facing (hook plumbing; users see only fewer false "could not find its local CLI" blocks)
**Surface Evidence:** ✅ 3/3 affected hosts have recorded proof
**Evidence limits:** ⚠️ One acceptance scenario ("Nothing a reviewer emits reaches the explanation") failed once inside the full test-suite lane under machine load and passed alone twice and in both dedicated Gherkin runs; a duplicate test-suite invocation and one proof-lane run could not start because another session held the machine-wide test lock (exit 75). Neither is product evidence. Dependency audit reports 8 pre-existing advisories (2 high, 3 moderate, 3 low); this PR changes no manifests.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude Code (plugin and project-local hooks) | `tests/integration/write-time-annotation-gate.test.ts` real GREEN-guard processes: plugin bundle, pinned `bun x --bun` via local npm registry, preload/symlink/shim/cache forgeries denied | pass |
| OpenAI Codex | `tests/integration/codex-stop-retro.test.ts`; Codex plugin hook-parity acceptance scenario "Packaged Stop runs retro extraction invisibly" | pass |
| Cursor / project-local delivery | `tests/integration/action-hook-cli-version.test.ts` real session hook + real `bunx` against a local registry; `tests/hooks/retrospective-gate.test.ts` | pass |

## Reviews and audit

- Intake: independent review `6e8dbcb3` (Codex, cross-agent) approved.
- TDD test-quality review: fixed stale test names, an unsafe env restore, and a proof gap (the test runner's real lookup had no test without the suite-wide `SAFEWORD_CLI` override) in `8c62c3be2`.
- Quality review: earlier passes requested changes on trust-boundary and fail-closed defects, each fixed with a test that fails against the previous code; final review `d332d63e` (Codex, cross-agent) approved; its timeout warning fixed in `bb19d7597`.
- Audit passed — diff scope on the final code: 0 errors, no dependency violations (428 modules), no learning, principle-trace, or domain-doc findings.

## Known limits

- A first `bun x` needs network or a warm cache; trust checks fail closed when it cannot run (30s download budget).
- Closeout (`templates/scripts/closeout-cleanup.ts`) keeps its own lookup with an unpinned `bunx safeword`; out of scope, flagged as a follow-up.
