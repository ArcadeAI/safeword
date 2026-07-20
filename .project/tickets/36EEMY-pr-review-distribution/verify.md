# Verify: pr-review-distribution (36EEMY)

Run 2026-07-20, mid-`implement`. This is a checkpoint verification, **not** a
done-gate pass — 16 of 24 scenarios are complete and the remaining 8 need the
CLI entry point and execution machinery (slices 3, 7, 8).

## Verify Checklist

**Test Suite:** ✓ 5297/5297 tests pass (361 files, 5 skipped, exit 0) — full suite, measured BEFORE the quality-review fixes. After the fixes, 1246/1246 pass across every directly affected area (`tests/pr-review/` + all of `tests/hooks/` + `tests/commands/retro.test.ts`). A post-fix full re-run was still in flight when this was written; it is the one piece of evidence here that is not yet closed, and it should be confirmed before the ticket is marked done.
**Gherkin:** ✅ Acceptance lane passes (`lint-gherkin` exit 0; the root BDD lane is local-Stop-hook dogfooding, not CI)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint + lint-gherkin + `tsc --noEmit`)
**Scenarios:** ❌ 16/24 complete — R12 ×3, R13 ×2, R17, SM1.R3 fix-gate-degrades, SM1.R2 remain; all blocked on the CLI entry point and checkout/execution machinery, not on unknowns
**PR Scope:** ✅ Diff matches ticket scope — one deliberate exception noted below
**Dep Drift:** ✅ Clean — this ticket adds **zero** dependencies; `pr-review` and the pre-existing `boundary` module are now documented in ARCHITECTURE.md (both were [E006] structural gaps)
**Parent Epic:** WAWQA6 (siblings: 0/3 done — G5337S blocked on CWGYH0, CWGYH0 in progress)
**Reconcile:** ✅ No pattern deviation — `src/pr-review/` follows the existing feature-module shape (`boundary/`, `retro/`, `test-plan/`); the one deviation (shared tracker identity vs R6's "no service account") is recorded in impl-plan → Known deviations with an expiry condition
**Experience:** ⏭️ N/A — no persona-facing surface ships yet; the runner has no entry point until slice 3
**Evidence limits:** ⚠️ The first full-suite attempt was SIGTERM'd at the 10-minute tool timeout (exit 143) while a parallel worktree was testing — the build-lock is keyed per-checkout and does not serialize across worktrees. Re-run unbounded in the background: green. The SIGTERM was contention, not a regression.

## PR Scope — the one exception

`ARCHITECTURE.md` gained a line documenting `src/boundary/` (from PR #938),
which this ticket did not create. It is a one-line audit finding ([E006]) that
surfaced while fixing the same gap for `pr-review`, and leaving a known
structural gap undocumented to preserve scope purity seemed the worse trade.
Flagged rather than silently bundled.

## Audit result

Audit passed with warnings.

- **Architecture:** ✅ no dependency violations (644 modules, 2022 dependencies cruised); no circular deps
- **Config drift:** ✅ `sync-config --check` in sync (W007 clean)
- **Learnings:** ✅ all carry `Covers:` (W006 clean)
- **Domain docs:** ✅ personas 3 / surfaces 7 / glossary 27 entries; no surface or persona drift (E008/E009 clean)
- **Dead code (knip):** 2 dead exports in `pr-review` found and removed. Remaining unused exports are all in `src/upstream-monitor/` and pre-date this ticket. `CoverageState` / `RequiredSetTier` kept exported deliberately — field types on exported interfaces.
- **W005 config hints:** `@openai/codex` (ignoreDependencies) and `claude` (ignoreBinaries) reported stale. **Not acted on** — this is the recorded false-positive pattern: `templates/hooks/**` is outside knip's src graph, so the binaries those entries cover are invisible to it. Removing them would re-flag every audit.
- **Duplication (jscpd):** 470 clones [scope: repo minus `.safeword`, `.project`]. New baseline at this scope — no prior recorded count to diff against. **Zero clones in `src/pr-review/`.**
- **Outdated packages:** all dev/lint tooling, all pre-existing (this ticket adds no dependencies). Low risk: `@cucumber/messages` 34.1→34.2, `eslint-plugin-jsdoc` 63.0→63.2 (patch/minor, dev). Medium: `eslint-plugin-astro` 2→3, `eslint-plugin-simple-import-sort` 13→14, `@cucumber/gherkin` 41→42 (dev majors — review changelogs). None blocks this ticket.
- **Test quality:** 8 files / 112 tests reviewed. One weak assertion found and fixed (a receipt asserted merely "defined"; now asserts its shape). No sleeps, no shared mutable state, no duplicate tests (table-driven via `it.each`).

## Quality review result

An independent fresh-context reviewer returned **REQUEST CHANGES with 14
findings**. All 14 reproduced; 15 new tests failed before the fixes. All are
fixed — see commit `46d9bb1ee`. The consequential ones:

1. The check-run surface was an unconstrained **merge-gate primitive** — name was caller-supplied, `conclusion: 'neutral'` was erased at runtime, and GitHub counts neutral as *satisfying* a required check. The guard now constrains the body, not just the path.
2. `identityMode` failed **open** — absent config resolved to `per-author`, the mode that re-enables fork tracker reads.
3. `computeCiState` returned **green for an empty check set** (`[].every()` is true) — a repo reporting via the legacy commit-status API would have been reviewed while red.
4. A required check concluding `skipped`/`neutral` could never reach green — a permanent silent no-fire.
5. The receipt was written **before** the comments, so a 422 left a verdict claiming a review that never appeared.
6. Slice 0 had silently dropped retro's *"Use an empty findings array…"* prompt instruction, converting clean retro runs into extraction failures. Now pinned by a test.

## Next

Decide whether to cross the shipping threshold (registering the workflow in
`schema.ts` starts writing `.github/workflows/pr-review.yml` into every safeword
project on upgrade). That gates slices 3, 7 and 8, which own the remaining 8
scenarios.
