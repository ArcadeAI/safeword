# Verify: retro auto-trigger (Claude-first) — FTCQGD

## Verify Checklist

**Test Suite:** ✓ 3915/3915 tests pass (5 skipped — env-gated live tests; 276 files)
**Gherkin:** ✅ Acceptance lane passes (159 scenarios / 2837 steps; the new `@manual` feature is excluded, proven by vitest)
**Build:** ✅ Success (ESM + DTS)
**Lint:** ✅ Clean (eslint + lint-gherkin + tsc --noEmit + prettier)
**Scenarios:** All 9 scenarios marked complete (27/27 R/G/R checkboxes)
**PR Scope:** ✅ Diff matches ticket scope (stop-retro hook + lib/retro-trigger core + tests + schema/config/settings registration + byte mirrors + the smoke-guard exemption). See Decision below re: PR #543 composition (RV9JT4 + FTCQGD on one branch).
**Dep Drift:** ✅ Clean (no new dependencies — node builtins only)
**Parent Epic:** RV9JT4-retro-transcript-mining (done) — siblings: 1FGE1C todo, 7ZCKS6 todo, 53DQJZ blocked (this), KHYXY4 blocked (this)
**Reconcile:** ✅ No pattern deviation — new consumer of established patterns (modular hook + fact-phrased self-report surfacing + byte-parity mirrors); impl-plan reconciled to `implemented`
**Experience:** ✅ Net friction reduced — see walk

Audit passed — config in sync, 0 circular deps, 0 layer violations, 0 dead exports (knip), 0 duplication (jscpd), no outdated/dep-drift (no new deps).

### Experience walk (SM + TB)

Walked the Safeword Maintainer through "retro fires itself": worst step = the
nudge is a *fact* the agent may not act on (the Q1 weak link — `additionalContext`
is read reliably but acting is softer). New steps vs before = **−1**: it *removes*
the "remember to run /retro" step rather than adding one. If the agent ignores the
nudge, retro silently doesn't run that session — but that degrades to the prior
manual state, never worse, and the fallback is the user typing `/retro`. The
mitigation (gate on real substance, point at one concrete command) is in place.
**Live confirmation:** the hook fired its nudge on this very session's Stop.

## Decisions needed

- **PR #543 composition (combined vs split).** The branch
  `claude/safeword-self-reporting-2tdjta` now carries RV9JT4 (retro pipeline) and
  FTCQGD (auto-trigger) plus follow-on planning stubs. Within each ticket the diff
  is on-scope. Decision: ship #543 as one epic PR (pipeline + how it fires — my
  lean, they're one coherent story), or split FTCQGD into its own PR. Proceeding
  combined unless told otherwise.
