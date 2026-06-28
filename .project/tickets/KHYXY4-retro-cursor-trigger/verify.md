# Verify: retro auto-trigger — Cursor (KHYXY4)

## Verify Checklist

**Test Suite:** ✓ 3944/3944 tests pass (5 skipped — env-gated live tests; 280 files)
**Gherkin:** ✅ Acceptance lane passes (159 scenarios / 2837 steps; the new `@manual` Cursor feature is excluded, proven by vitest)
**Build:** ✅ Success (ESM + DTS)
**Lint:** ✅ Clean (eslint + lint-gherkin + tsc --noEmit + prettier)
**Scenarios:** All 13 scenarios marked complete (39/39 R/G/R checkboxes)
**PR Scope:** ✅ Diff matches ticket scope (resolveCursorSessionId + conversation_id on RetroTriggerInput + the cursor/stop.ts retro path + byte mirrors + the brittle-import test fix). No piggybacked work.
**Dep Drift:** ✅ Clean (no new dependencies — node builtins + existing libs only)
**Parent Epic:** RV9JT4-retro-transcript-mining (done) — siblings: FTCQGD done, 53DQJZ done, KHYXY4 (this), 1FGE1C todo, 7ZCKS6 todo. With this, the cross-agent trigger set (Claude + Codex + Cursor) is complete.
**Reconcile:** ✅ impl-plan reconciled to `implemented`; third consumer of the per-agent trigger seam (no new pattern). One in-test fix (brittle exact-import → wiring regex) recorded.
**Experience:** ✅ Net friction reduced — see walk

Audit passed — config in sync, 0 circular deps, 0 layer violations, 0 dead exports (knip), 0 duplication (jscpd), no outdated/dep-drift.

### Experience walk (SM + TB on Cursor)

Walked the Safeword Maintainer through "the stream fills itself from Cursor sessions
too": worst step = the **coexistence starvation edge** — on a session where every
stop carries edits (quality-review always wins) and there's never a no-edit stop,
retro can be starved that session. New steps vs before = **−1** (removes "remember
to run retro" for Cursor users); the retro nudge also never clobbers the existing
quality-review prompt (it yields). The starvation edge is acceptable (most sessions
have ≥1 no-edit stop; sentinel + later-refire cover the common case) and recorded
as an assessment trigger. Residual transcript-shape unknown is fixture-proven +
gated on a live-Cursor spike.

## Decisions needed

- **Mark KHYXY4 done?** Gate is green; awaiting confirmation. The CI ticket-closure
  guard will require the done-flip once verify.md rides the PR.
- **PR #543 composition** stays combined (RV9JT4 + FTCQGD + 53DQJZ + KHYXY4) per
  the earlier call, unless you want KHYXY4 split out.
