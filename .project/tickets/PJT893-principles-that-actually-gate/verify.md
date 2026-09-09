# Verify — PJT893

## Verify Checklist

**Test Suite:** ✓ 9097/9097 tests pass (packages/cli 554 files; retro-relay 194; retro-collector 146)
**Gherkin:** ✅ Acceptance lane passes — 1493 scenarios, 1489 passed, 3 skipped, 0 failed
**Build:** ✅ Success (retro-relay, retro-collector, cli; `packages/website` fails on the npm optional-dependency native-binding bug — environmental, unrelated to this ticket)
**Lint:** ✅ Clean — eslint, gherkin lint, `tsc --noEmit`, markdownlint (2314 files, 0 issues)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md ledger
**Refactor:** ✅ Completed — simplified the source-absent guard to the house optional-chain idiom (`names?.has(x) === false`); 26 tests green before and after
**PR Scope:** ✅ Diff matches ticket scope. No piggybacked changes.
**Dep Drift:** ✅ Clean — no dependency added or removed
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the checker is invoked from an existing gate seam (`evaluateImplementEntry`), no new mechanism introduced
**Experience:** ⚠️ Walked the NTB through authoring a first `principles.md`; worst step = the plan-gate block message, which names the principle, the defect and the file but still assumes the reader knows what a Design alignment table is. New steps vs before = 0 (the gate already ran; only its contents changed). Soft finding — does not hold done.
**Surface Evidence:** 2/2 affected surfaces proven — `safeword-cli` trace checker via `tests/hooks/principle-trace.test.ts`; Claude Code PreToolUse plan gate via `tests/hooks/plan-gate.test.ts` block-and-admit pair. Claude installs do not write `.safeword/hooks`, so its coverage rides the regenerated plugin bundle rather than the lifecycle fixture — verified by installing each agent into a clean temp repo.
**Evidence limits:** ⚠️ The `packages/website` build failure is an npm optional-dependency environment bug, not product evidence. An earlier full-suite run showed 18 failures across 5 files that all pass in isolation — concurrency flake from other worktrees under load, not a baseline.
**Audit passed** — dependency-cruiser clean (361 modules, 562 dependencies, no violations); config drift none; no doc drift; E010 clean for this ticket. Pre-existing E010 findings on CKWE2D and 3F5Z6P are unrelated active-ticket debt.

## Independent review

Eleven passes, cross-agent (headless Codex) throughout — `independence:
cross-agent`, never degraded. No pass returned clean; the loop was stopped by
judgment, not by a clean verdict. That is a property of an adversarial LLM
reviewer, not a measure of remaining defects, and it is recorded here rather
than presented as an approval.

**Two classes of real defect, and one expensive detour.**

*Conflict matching (2 fixes).* `explicit-conflict` was satisfied by a substring:
first by a longer principle whose name contains the cited one (`Ship reversible
changes safely` for `Ship reversible changes`), then by an ordinary word
containing it (`Latest` for `Test`). Both admit an unrecorded conflict.
`conflictRecorded` now strips longer known names, then requires a word-boundary
match. Both guards are needed; neither subsumes the other.

*Silent skips in table parsing (4 fixes).* Every rule that identified rows by
line shape turned out to hide content: dropping rows whose first cell read
`principle` hid a principle actually named `Principle`; requiring a leading `|`
hid whole tables, since GFM makes the outer pipes optional; requiring a
non-empty principle cell hid a row carrying a dead proof and an unrecorded
conflict; and reading only the first delimiter hid a second table. Each was a
fail-open: not a wrong verdict but **no verdict at all**, on a gate whose only
job is refusing unproven claims.

Parsing is now anchored on the delimiter row — the one structure GFM requires.
From each delimiter the reader walks down while lines still look like rows,
stopping at prose and at the next table's header. Verified against seven
competing cases at once, including the two that pull in opposite directions: a
data row legitimately named `Principle` must be judged, and prose in a section
with no table must not be.

**One capability removed.** Six passes returned the same class — a proof
reference resolving to an anchor no reader can follow — against successive
approximations of GitHub's anchor rules: headings inside fenced code and HTML
comments, `id="…"` in inline code, then in prose, then `data-id="…"`, then
over-normalized fragments, then missing duplicate-heading suffixes. Reproducing
a GitHub anchor requires github-slugger's ~8 KB generated Unicode table plus its
stateful duplicate suffixes (`#evidence-1`); a hook carries no third-party
dependencies. Every approximation either accepted dead links or rejected live
ones, and on a blocking gate the false rejection is the worse failure.

`proofResolves` now validates the file — existence, regular file, in-repo after
symlink resolution — and leaves the `#fragment` unjudged. Net effect on the
resolver is a deletion.

The removed check had real value: the repo's one authored fragment
(BR373S) is broken today, and the old collapsing resolver accepted it. That is
a repo-wide documentation-linting concern, not a gate concern — the same defect
can sit in any of ~2300 markdown files, and `markdownlint`'s MD051 is
same-document only. Carried to **J1GW31** with `lychee
--include-fragments=anchor-only` as the named approach and the broken link
recorded.
