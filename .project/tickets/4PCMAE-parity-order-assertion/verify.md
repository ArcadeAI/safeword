# Verify: plan-gh-parity asserts plan order against live order (4PCMAE / #1463)

_Test-strength fix only — no production code changed. The two paths already agreed;
the test that claimed to prove it could not fail on divergence._

## Verify Checklist

**Test Suite:** ✓ 5459 pass, 7 skipped, 369 files (1 environment-limited failure excluded — see Evidence limits). Ticket coverage: the full `tracker-sync` suite is **138 green**, including the five assertions in `plan-gh-parity.test.ts` this ticket strengthened.
**Mutation evidence (the point of the ticket):** the fix is non-vacuous by construction — five mutants, each of which the *pre-fix* test either passed or could not see, now fail:

| # | Mutant | Pre-fix | Post-fix |
|---|--------|---------|----------|
| A | Rotate `plan.intents` (order differs from live; parent-before-child preserved) | **passed** — the bug in #1463 | fails |
| B | Reverse the projection sort on the plan side only | passed | fails |
| C | Reverse the shared `orderTicketsForProjection` sort | passed | fails |
| E | Make the sort ignore `dependsOn`/`blockedOn` edges | passed | fails |
| H | Drift a fixture title so a name lookup misses | passed (`3 > -1`) | fails |

**Gherkin:** ✅ `lint-gherkin` clean. No `.feature` change — this ticket adds no behavior; the tracker `.feature` remains `@wip`-excluded (#363, no live tracker in tests).
**Build:** ✅ The vitest build-lock wrapper rebuilt `dist/` before the run; tsup ESM + DTS succeeded.
**Lint:** ✅ Clean — full-repo `bun run lint` (eslint `.` + `lint:gherkin` + `tsc --noEmit`) produced zero error/warning output.
**Scenarios:** N/A — type `task`, no scenario ledger.
**PR Scope:** ✅ Diff matches ticket scope exactly — two files, `packages/cli/tests/tracker-sync/plan-gh-parity.test.ts` and this ticket's own artifacts. Zero production files touched, which is itself the scope claim: `computePlan` and the `gh` path already shared `orderTicketsForProjection`, so nothing needed fixing but the assertion. No piggybacked changes.
**Dep Drift:** ✅ Clean — no new dependencies, no import-graph change.
**Parent Epic:** KKNFZA (off-board local ticketing) — follow-on to CBTDK8 (shipped via #1424), raised by that PR's review lens.
**Reconcile:** ✅ No pattern deviation. The recording writers keep the same fake-only-at-the-network-boundary shape; the change is that they now record **one ordered call log** (`WriteCall[]`) instead of separate `creates`/`updates` arrays, so the live path's true interleaved sequence is *recorded* rather than reconstructed by concatenation.
**Experience:** The reader of `plan-gh-parity.test.ts` is the one served here — the ordering test's name now describes what its assertions establish ("emits intents in the exact sequence the live path wrote them"), so a future maintainer trusting the title is not misled. Worst step: none added; this removes a false signal. — soft, never blocks.
**Evidence limits:** ⚠️ One failure in the final full run, plus two flaky tests observed and run to ground. None caused by this change — the diff is test-only and confined to `tests/tracker-sync/`.

- **Deterministic, environmental:** `tests/hooks/self-report.test.ts` › "reports failure when the marker cannot be written" — `chmod 0o555` then expects the write to fail; container **root bypasses permission bits**, so it succeeds and the assertion flips. Fails identically on clean `main` (`b68d2d7`).
- **Flaky (not deterministic):** `tests/integration/python-golden-path.test.ts` › "lint hook formats files without safeword Ruff config" and `tests/integration/rust-golden-path.test.ts` › "lint hook formats .rs files without safeword config". Both **failed** in a targeted 3-file run against clean `main`, and both **passed** in the full 369-file run on this branch. Same code, opposite outcomes, so the failure is not a property of either tree. `ruff`, `rustfmt`, and `cargo` are all installed, so it is not a missing-toolchain artifact — the likely shape is a timing race between the lint hook's write and the test's read, surfacing only under some load profiles.

The flakiness is a real pre-existing defect in those two tests and deserves its own ticket; it is not evidence about this change either way. Recording it here rather than silently re-running until green.

**Audit:** Not re-run — the audit surfaces it inspects (dependency graph, config sync, dead exports, duplication, outdated deps, docs) have no input from a test-only diff that adds no module, no export, and no dependency. CBTDK8's audit (0 errors, 0 warnings) covered every production file in this area and none of them changed.

**Quality-review:** An independent fresh-context reviewer returned **REQUEST CHANGES** on the first cut of this fix and was right on every count — recorded because the finding is the interesting part: my refactor had *dropped* a vacuity guard `main` already had (`expect(parentIndex).toBeGreaterThanOrEqual(0)`), so a drifted parent title would read as `3 > -1` and silently pass. On that one axis my "strengthening" was weaker than what it replaced. Closed in `45e6539` along with three lesser findings (a stale ORDER comment on the set-comparison test, a dependency-first comment describing a hazard the fixture never exercised because its parent was pre-recorded, and an overstated `recordingWriter` docstring).

## Notes

- The reviewer's suggested fixture for mutant E (add a `dependsOn` ticket) was **insufficient on its own** and survived three attempts. Parity is symmetric: both sides share the sort, so dropping blocker edges moves plan and live together and the equality assertion stays green. An absolute assertion didn't close it either — corpus position already satisfied the ordering — nor did repositioning, because the parent edge from `FCHILD1` was already pulling `FPARENT1` to index 0. Closing it required a blocker pair (`BLOCKED1` listed before `BLOCKER1`) whose target ordering is reachable **only** via the `dependsOn` edge.
- Generalization worth carrying: a parity assertion between two paths that share a helper cannot detect a bug in that helper. Equivalence tests need at least one absolute anchor, not only a cross-path comparison.
