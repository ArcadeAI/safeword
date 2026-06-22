# Verify — explain-hint-reliably-visible (19E2XQ)

## Verify Checklist

**Test Suite:** ✓ 491/491 tests pass (done-gate lane) + 72/72 in the two block-output integration tests (quality-gates, status-close-gate) now asserting `systemMessage`
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps — unaffected; re-confirmed this session)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (eslint 0 errors; `templates/hooks/*.ts` are eslint-ignored by design as shipped template source — runtime-validated by the hook tests that spawn them)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 2/8 done)
**Reconcile:** N/A — followed the existing `deny()` / `hardBlockDone()` output pattern; additive field only

## What was verified

- **`systemMessage: EXPLAIN_HINT` added** to `pre-tool-quality.ts` `deny()` and
  `stop-quality.ts` `hardBlockDone()` — template + byte-identical dogfood copies
  (`diff -q` clean on both).
- **Augment, not replace** — `permissionDecisionReason` / `reason` left exactly
  as-is, so the model and the Codex adapter still read the hint from there. The
  new field is the user-facing channel Claude Code surfaces (issue #17356).
- **Codex unaffected** — `codex/pre-tool-quality.ts` reads only
  `permissionDecisionReason`; a new top-level field is ignored by its parse.
- **Tests** — extended the existing LOC-gate deny test and the done-gate block
  test to assert the hint now rides `systemMessage`; both green.

## Premortem follow-up (not blocking)

`systemMessage` rendering is **documented for PreToolUse** and asserted at the
output level here for both paths. Its rendering on the **Stop** hook is "every
event" per docs but unexampled — so the done-block hint is verified to be
_emitted_ on `systemMessage`, but its on-screen rendering in a live Claude Code
Stop should be eyeballed once. No regression risk: the `reason` field still
carries the hint as before. Codex remains **verify-only** (confirm stderr
surfacing in a live Codex block); no code change was needed there.

Ready to mark done.
