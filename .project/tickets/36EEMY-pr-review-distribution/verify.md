# Verify: pr-review-distribution (36EEMY)

Run 2026-07-21, implement exit. Evidence read from run logs, not from wrapper
exit codes — the two disagreed three times this session.

## Verify Checklist

**Test Suite:** ✓ 5398/5398 tests pass (370 files, 5 skipped, `VERIFY_PLAN_EXIT=0`)
**Gherkin:** ❌ Failed — 2 of 487 scenarios, both pre-existing and unrelated (see Evidence limits)
**Build:** ✅ Success (`BUILD_PLAN_EXIT=0`)
**Lint:** ✅ Clean (eslint exit 0, `tsc --noEmit` exit 0, prettier exit 0 on the touched docs)
**Scenarios:** All 24 scenarios marked complete (73/73 ledger checkboxes, 0 unchecked, cross-scenario refactor closed)
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no runtime dependency added; the runner is stdlib + existing seams
**Parent Epic:** WAWQA6 (siblings: 0/3 done — G5337S blocked on CWGYH0, CWGYH0 in_progress)
**Reconcile:** ✅ No pattern deviation — the runner reuses the established injected-seam shape (`retro-extract`'s spawn dependency), and `.github/workflows/` shipping follows the existing `ownedFiles`-into-a-`sharedDir` mechanism
**Experience:** ⚠️ Walked the Safeword Maintainer through enabling the reviewer on a fresh repo; worst step = **the reviewer cannot review** — a maintainer who reads the docs, sets `prReview.enabled`, and satisfies both repo settings gets a green job that says `no vendor configured`. New steps vs before = 2 (one config key, two repository settings). The docs now say this outright, so the failure is honest rather than mysterious, but the peak is not reachable yet — soft, does not block.
**Evidence limits:** ⚠️ The 2 Gherkin failures are `Codex plugin asset differs from the canonical transformation: skills/quality-review/SKILL.md` — both the same root cause, in `migrate-codex-plugin.steps.ts`'s release contract. Not product evidence for this ticket: `quality-review/SKILL.md` is untouched by any commit in this session, and the same failure reproduced at HEAD earlier with this ticket's changes stashed. Already filed as its own task. This ticket's own 24 scenarios are `@wip`-tagged and correctly excluded from the lane, so they contribute no undefined steps.

## Scope note

Every file in this session's commits serves the ticket: the runner
(`src/pr-review/`), its tests, the shipped workflow template and its `schema.ts`
entry, the two reference docs, the `ARCHITECTURE.md` ADR the plan called for,
and the ticket's own artifacts. `retro-extract.ts` was generalized as slice 0
because the runner reuses its headless spawn seams — a prerequisite, not a
drive-by.

## Known merge-time action

This branch is at 0.68.0; main has moved to 0.69.0. The workflow pins
`bunx --bun safeword@0.68.0`, and `tests/pr-review/workflow-contract.test.ts`
binds that pin to `VERSION` — so a rebase onto main turns it red until the pin
is bumped. That is the contract working. `CLAUDE.md` now lists the workflow as
the fifth release-tracked artifact so the next bump does not miss it.
