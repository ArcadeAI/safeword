# Verify — F2QZB4

## Verify Checklist

**Test Suite:** ✓ 2518/2518 tests pass (1 skipped) — the full-suite run flaked once on `python-golden-path` (30s timeout under load); re-ran in isolation 11/11 ✓, a timing flake unrelated to this change (no Python/lint-hook code touched).
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit — validates the schema.ts + fixture + test edits)
**Scenarios:** All 0 scenarios marked complete — structural extraction (new skill + wiring), no runtime behavior to scenario-ize; verified by the schema + parity tests.
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** 0AWSY8 (siblings: 6/7 done)
**Reconcile:** N/A — follows the existing action-skill pattern (self-review / verify / audit): skill pair + cursor command pair + ACTION_SKILLS + fixture entry.

## Audit Results

**Architecture (depcruise):** ✅ No violations (124 modules, 352 deps)
**Dead code (knip):** baseline only (7 stack ESLint plugins + `templates/hooks/**` false positives + 2 `personas.ts` constants) — identical to before; the schema entry is used, the new templates are registered.
**Parity:** ✅ 122 pairs + 3 contracts; review-spec skill + cursor command both template↔dogfood identical; markdownlint 0.

**Audit passed** — no new findings from this change.

## Done-When Verification

- ✅ `/review-spec` skill exists with the full gate procedure (vacuous-pass, AODI, determinism, adversarial + negative-case, cross-cutting, findings format) — **moved** from SCENARIOS.md (single source, no duplication).
- ✅ SCENARIOS.md's Scenario Quality Gate now references `/review-spec` (thin pointer) and keeps the bdd-flow exit (test layers, phase→implement, work-log).
- ✅ Both modes documented: auto-fire from the bdd scenario-gate, and manual re-run (allowed post-`done`).
- ✅ Action-skill wiring complete so the new skill passes all parity tests: cursor command (`commands/review-spec.md` ↔ `.cursor/commands/review-spec.md`), schema registration, `SKILL_CURSOR_PAIRS` fixture (action), `ACTION_SKILLS` set, usage-context description disambiguated from self-review.
- Compact: no separate worked-example block (the mode descriptions + the findings-format example suffice) — consistent resident-cost call.

## Commits

- (this commit) feat(F2QZB4) — extract the scenario-gate into the /review-spec skill + action-skill wiring
