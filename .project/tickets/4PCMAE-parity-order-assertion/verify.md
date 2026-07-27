# Verify: plan-gh-parity asserts plan order against live order (4PCMAE / #1463)

_Test-strength fix only — no production code changed. The two paths already agreed;
the test that claimed to prove it could not fail on divergence._

_Second pass. The first close was premature: I ran the verification commands by hand
instead of invoking `/verify`, and skipped `/audit` entirely on my own reasoning that a
test-only diff had nothing for it to inspect. That was wrong — `/audit` found four
defects in the changed file, including a duplicated ticket id. Both skills have now been
genuinely invoked and logged, and every number below is from a re-run against the final
tree._

## Verify Checklist

**Test Suite:** ✓ 5458/5458 tests pass (7 skipped; 369 files; 2 failures excluded — see Evidence limits). Ticket coverage: `bun run test tests/tracker-sync/` is **138 green across 18 files**, including the assertions in `plan-gh-parity.test.ts` this ticket strengthened.
**Mutation evidence (the point of the ticket):** re-proved against the cleaned fixture after the audit fixes — each mutant applied, run isolated, then reverted, with a guard that fails loudly if the mutation pattern misses (so a silently-unapplied mutant cannot read as a pass). All five fail:

| # | Mutant | Pre-fix | Post-fix |
|---|--------|---------|----------|
| A | Rotate `plan.intents` (order differs from live; parent-before-child preserved) | **passed** — the bug in #1463 | fails |
| B | Reverse the projection sort on the plan side only | passed | fails |
| C | Reverse the shared `orderTicketsForProjection` sort | passed | fails |
| E | Make the sort ignore `dependsOn`/`blockedOn` edges | passed | fails |
| H | Drift a fixture title so a name lookup misses | passed (`3 > -1`) | fails |

**Gherkin:** ✅ Acceptance lane passes — 497 scenarios (494 passed, 3 skipped), 15317 steps (15313 passed, 4 skipped). This ticket adds no `.feature`; the tracker feature stays `@wip`-excluded (#363, no live tracker in tests) and is proven by the vitest units above.
**Build:** ✅ Success — tsup ESM build 248ms, DTS build 4730ms.
**Lint:** ✅ Clean — full-repo `bun run lint` (eslint `.` + `lint:gherkin` + `tsc --noEmit`) produced zero error/warning output; `tsc --noEmit` also ran clean inside the verify plan's typecheck lane.
**Scenarios:** ⏭️ Skipped — type `task`, no scenario ledger.
**PR Scope:** ✅ Diff matches ticket scope exactly — `packages/cli/tests/tracker-sync/plan-gh-parity.test.ts` plus this ticket's own artifacts. Zero production files touched, which is itself the scope claim: `computePlan` and the `gh` path already shared `orderTicketsForProjection`, so nothing needed fixing but the assertion. No piggybacked changes.
**Dep Drift:** ✅ Clean — no new dependencies, no import-graph change.
**Parent Epic:** KKNFZA (off-board local ticketing) — follow-on to CBTDK8 (shipped via #1424), raised by that PR's review lens.
**Reconcile:** ✅ No pattern deviation. The recording writers keep the same fake-only-at-the-network-boundary shape; the change is that they now record **one ordered call log** (`WriteCall[]`) instead of separate `creates`/`updates` arrays, so the live path's true interleaved sequence is *recorded* rather than reconstructed by concatenation.
**Experience:** ⏭️ N/A — not persona-facing; the reader served is a future maintainer of the test, for whom the ordering test's name now matches what its assertions establish. — soft, never blocks.
**Evidence limits:** ⚠️ Two failures in the final run. Neither is caused by this change — the diff is test-only and confined to `tests/tracker-sync/`, nowhere near either.

- **Deterministic, environmental:** `tests/hooks/self-report.test.ts` › "reports failure when the marker cannot be written" — `chmod 0o555` then expects the write to fail; container **root bypasses permission bits**, so it succeeds and the assertion flips. Fails identically on clean `main` (`b68d2d7`).
- **Flaky, demonstrated in-run:** `tests/integration/python-golden-path.test.ts` › "lint hook formats files without safeword Ruff config" **failed here but passed in the immediately preceding full run on this same branch**. Its rust sibling (`rust-golden-path.test.ts` › "lint hook formats .rs files without safeword config") did the inverse: both failed in a targeted 3-file run on clean `main`, and both passed in the earlier full run. `ruff`, `rustfmt`, and `cargo` are all installed, so this is not a missing-toolchain artifact — the shape points to a race between the lint hook's write and the test's read.

The golden-path flakiness is a real pre-existing defect deserving its own ticket. Recorded here rather than re-run until green.

**Audit:** Audit passed with findings — **4 errors found and fixed, 0 remaining**. Diff scope (merge-base `b68d2d7`, 3 files). Clean: depcruise **0 dependency violations**; `sync-config --check` in sync (no W007); no learning-file W006; domain-docs check not applicable (no changed personas/surfaces/glossary/`.feature`/spec.md). Knip, jscpd, and dependency-freshness are deliberately deferred to repository scope by the skill's diff mode. The test-quality review found four defects **in this ticket's own changed file**, all now closed in `46687c2`:

- **Duplicate `BLOCKED1` ticket id** in the parity corpus — residue from the abandoned mutant-E attempts, left behind when the working pair landed. A repeated id makes the tracker-map lookup and any graph edge naming it ambiguous, silently changing what the fixture means. Removing it required re-proving every mutant (done above): the duplicate sat in the shared corpus, so it could have propped up any of the five, not only the one it resembled. It had not — mutant E fails on the `BLOCKED1`/`BLOCKER1` pair alone.
- **Doubled `expect(parentTicketId).toBeDefined()`** — copy-paste residue.
- **The `indexOf`/-1 rationale written twice** in one comment block.
- **The join-key docstring attached to `PENDING_REF`**, which it does not describe — moved onto the `ticket()` factory and extended to state the id-uniqueness requirement the duplicate had violated.

**Quality-review:** An independent fresh-context reviewer returned **REQUEST CHANGES** on the first cut and was right on every count — recorded because the finding is the interesting part: my refactor had *dropped* a vacuity guard `main` already had (`expect(parentIndex).toBeGreaterThanOrEqual(0)`), so a drifted parent title would read as `3 > -1` and silently pass. On that one axis my "strengthening" was weaker than what it replaced. Closed in `45e6539` with three lesser findings (a stale ORDER comment on the set-comparison test, a dependency-first comment describing a hazard the fixture never exercised because its parent was pre-recorded, and an overstated `recordingWriter` docstring).

## Notes

- The reviewer's suggested fixture for mutant E (add a `dependsOn` ticket) was **insufficient on its own** and survived three attempts. Parity is symmetric: both sides share the sort, so dropping blocker edges moves plan and live together and the equality assertion stays green. An absolute assertion didn't close it either — corpus position already satisfied the ordering — nor did repositioning, because the parent edge from `FCHILD1` was already pulling `FPARENT1` to index 0. Closing it required a blocker pair (`BLOCKED1` listed before `BLOCKER1`) whose target ordering is reachable **only** via the `dependsOn` edge.
- Generalization worth carrying: **a parity assertion between two paths that share a helper cannot detect a bug in that helper.** Equivalence tests need at least one absolute anchor, not only a cross-path comparison.
- Process note, twice-corrected: this file first said the `tracker-sync` suite was "138 green", then I "corrected" it to "167 across 22 files". **The correction was the error.** `bun run test tests/tracker-sync/` is 138 across 18 files — the directory holds exactly 18 test files. The 167/22 figure came from `node scripts/run-vitest-with-build-lock.mjs run tests/tracker-sync/`, where the wrapper sweeps in four files that are not in the directory at all (`tests/commands/hook-shim-runtime`, `tests/hooks/run-identity`, `tests/hooks/test-runner`, `tests/test-runner-lock`). Caught in review on #1468. The lesson is narrower than "check your numbers": a count is only meaningful next to the exact command that produced it, and two different runners for the "same" selection can disagree.
