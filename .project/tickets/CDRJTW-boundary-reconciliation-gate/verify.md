# Verify: Boundary reconciliation gate — engine + local hook (CDRJTW, #810 slice 1)

## Verify Checklist

**Test Suite:** ✓ 1385/1385 tests pass in the affected packages (tests/commands + tests/hooks, 113 files; includes the 27 boundary unit/command tests) — excluding 4 failures that are the documented Node-22 sandbox artifact, not product failures (see Evidence limits). Full monorepo suite exceeds the sandbox 10-minute ceiling; CI covers it on Node 24.
**Gherkin:** ✅ Acceptance lane passes — 301/302 scenarios (6861 steps), including all 24 boundary-reconciliation-gate scenarios; the single failure is the same Node-22 artifact (`recordCliCrash` in the trace — the crash handler calling `Error.isError`, absent below the v0.66.0 Node-24 floor).
**Build:** ✅ Success (tsup ESM + DTS clean)
**Lint:** ✅ Clean (eslint + gherkin lint + `tsc --noEmit`)
**Scenarios:** All 23 scenarios marked complete (RED/GREEN/REFACTOR with distinct SHAs or reasoned skips; cross-scenario refactor 6fc7c6c)
**PR Scope:** ✅ Diff matches ticket scope — src/boundary/engine.ts, src/commands/boundary.ts, cli.ts registration, 4 test suites + shared helper, feature + steps, .husky shims, gitignore entry, ticket artifacts. No piggybacked changes.
**Dep Drift:** ✅ Clean — zero dependencies added; engine composes existing template-lib checks.
**Parent Epic:** 808 (external; siblings: #809 shipped in #839, #810 children 2–3 pending)
**Reconcile:** ✅ No pattern deviation — CLI-command pattern, template-lib reuse (evaluateTicketWrite, detectUnanchoredPhaseTransition, validateLedger + createLedgerShaResolver, checkVerifyArtifact, parseImplPlan), jsonl append pattern for the audit record.
**Experience:** ✅ No new friction — walked Technical Builder through an ordinary source-only commit: zero output, zero new steps (worst step = none observable; the gate exits silently before any check runs); walked Safeword Maintainer through a finding commit: one warning line + exit 0, no re-entry, no block. New steps vs before = 0. Rave Moment: skip (inherited by the epic).
**Evidence limits:** ⚠️ This sandbox runs Node 22 while v0.66.0 raised the floor to 24 — error-path tests that traverse the crash-capture handler (`Error.isError`) die with exit 7: 4 vitest failures (check 1DT29X, codify ×3) + 1 cucumber scenario, all reproduced on pristine origin/main before this ticket existed and all green in CI's Node 24. Also: the full monorepo vitest run exceeds the sandbox's 10-minute command ceiling; affected areas were run directly instead.

## Dogfood evidence (done_when)

The gate ran live on this ticket's own commits via the new `.husky` shims:

- Commit `be37070` (shims landing): the gate **warned** — `[ledger-format] Cross-scenario refactor row is unchecked` — an honest finding on its own feature, recorded to `.safeword/boundary-audit.jsonl`, commit not blocked.
- Commit `1d69fa8` (ledger completed): the gate re-ran and recorded **all-pass verdicts** (`birth: pass`, `ledger-format: pass`). The warn → fix → clean arc happened on the artifact under development.

## Done-when reconciliation

- ✅ `--at commit` reconciles staged ticket artifacts, prints verdict warnings, appends audit entries, exit 0 with findings (command-tested against fixture repos).
- ✅ `--at push` verifies anchor + ledger SHAs via the injected rebase-aware resolver, entered-phase-only, canonicalization honored (command-tested with real git history incl. a real rebase).
- ✅ Non-ticket changes: no output, no audit entry, exit 0 (tested at commit, push, and non-safeword-project).
- ✅ Born-past-intake at rest (#675) detected at the boundary (command + engine tests; anchors count as traversal evidence, skips as justification).
- ✅ `.husky/pre-commit` / `pre-push` invoke the command; proven live (above).
- ✅ Audit entries accumulate in `.safeword/boundary-audit.jsonl`; gitignored.
- ✅ Parity: no templates/ files added or changed (engine lives in src/), parity suite green in the hook-test run.

## Audit

Audit passed with warnings — 0 errors.

- **Config drift:** ✅ sync-config in sync. **Architecture:** ✅ depcruise clean (584 modules, 1798 deps — the new src/boundary module included).
- **Dead code (knip):** 1 real finding fixed in-audit (`Verdict` type un-exported); 1 false positive of the pre-existing steps-file "unlisted binary" class (same as rule-tier's setup/check/lint-gherkin hints).
- **Duplication (jscpd):** Clones: 428 (8.91%) [repo minus .safeword,.project] — delta vs the #825 baseline (416 / 8.9%) = **+12 clones**, all boundary test fixtures; already minimized by the cross-scenario helper extraction (boundary-helpers.ts).
- **Outdated deps:** ⚠️ evidence limit — `bun outdated` cannot resolve through the sandbox proxy. No dependencies were added or changed by this ticket.
- **Learnings:** ✅ all carry `Covers:`. **Test quality:** boundary suites use specific assertions, real-git fixtures, `it.each` for the shape outline, error paths (unparseable, absent, unreachable, resolver-throw) and boundary cases (first-push, rebase, mixed change) covered.
