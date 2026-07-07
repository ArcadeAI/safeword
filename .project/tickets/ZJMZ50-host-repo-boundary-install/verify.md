# Verify: ZJMZ50 — Install the boundary gate into host repos via setup/upgrade

Verified 2026-07-07 on branch `claude/epic-808-safeword-7xlca2` (Node 24 session).

## Verify Checklist

**Test Suite:** ✓ 4936/4936 tests pass (346 files; 7 skipped by their own suites)
**Gherkin:** ✅ Acceptance lane passes (340/343 scenarios; 3 pre-existing skips — all 21 ZJMZ50 scenario runs green)
**Build:** ✅ Success (tsup + DTS)
**Typecheck:** ✅ Clean (`tsc --noEmit` via test-plan)
**Lint:** ✅ Clean (eslint + lint-gherkin + prettier)
**Scenarios:** All 20 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope — No piggybacked changes. Two gate fixes (schema drift-scan exclusion for `boundary-audit.jsonl`, `.husky` exemption in the EYRK34 ignore-dir check) were forced by this ticket's own artifacts; README/FAQ edits fix the "does not install git hooks" claim this ticket made stale.
**Dep Drift:** ✅ Clean — no new dependencies (detection + nudge are stdlib-only)
**Parent Epic:** N/A (upstream #810/#808; no local parent ticket)
**Reconcile:** ✅ No pattern deviation — emission rides the existing textPatch machinery; the three shipped deltas are recorded in impl-plan.md's reconciliation note
**Experience:** ⚠️ 1 friction point (accepted at intake) — Walked TB through "setup in a lefthook repo": worst step = hand-pasting the printed snippet into lefthook.yml (husky hosts get zero-step install; lefthook/pre-commit hosts get one paste). New steps vs before = 1 for non-husky worlds, 0 for husky. Nudge-only for those worlds was the intake-gate decision; revisit on TB friction reports (impl-plan assessment trigger).
**Evidence limits:** ✅ None (git-init probe passed; Node 24 session — no Node-22 `Error.isError` artifacts)

Audit passed — depcruise clean (598 modules, 0 violations); knip clean after fixes (un-exported `BOUNDARY_SHIM_MARKER`; `boundary` added to the ignoreBinaries baseline — same subcommand-name false-positive class as `verify`/`check`); Clones: 428 (8.34%) [repo minus .safeword,.project,.safeword-project] — flat vs the prior recorded 428 at the same scope; bun outdated clean; learnings W006 clean; docs drift found and fixed (README ×2 + website FAQ claimed "safeword does not install git hooks" — updated for the warn-only husky shims).
