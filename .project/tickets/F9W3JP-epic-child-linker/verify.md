# Verify: ticket new --parent links epic and child (F9W3JP)

## Verify Checklist

**Test Suite:** ✓ 4651/4651 tests pass (327 files, 5 skipped; full suite over final HEAD after review fixes + refactors)
**Gherkin:** ✅ Acceptance lane passes (28 scenarios / 217 steps, including the 5 new epic-child-linker scenarios)
**Build:** ✅ Success (tsup build precedes each suite run; dist-driven cucumber lane green)
**Lint:** ✅ Clean (eslint + `tsc --noEmit` green on all touched files)
**Scenarios:** All 7 scenarios marked complete (5 black-box acceptance + 2 vitest-only white-box: navigation S2, idempotency S7 — lane split recorded in impl-plan.md)
**PR Scope:** ✅ Diff matches ticket scope (every commit since branch reset serves F9W3JP: linker, CLI wiring, index grouping, tests, review fixes, refactors, ticket artifacts)
**Dep Drift:** ✅ Clean (zero new dependencies — inline parsing per the zero-dep hooks ADR)
**Parent Epic:** N/A
**Reconcile:** ⚠️ 1 deviation, documented — INDEX grouping key moved from `epic:` to `parent:` (single source of truth), backward-compatible fallback retained; recorded in impl-plan.md Known deviations (soft, never blocks)
**Experience:** ⚠️ Walked TB through epic decomposition: `--parent` removes both hand-edits (new steps vs before = −2); worst step = INDEX shows children under the bare epic id heading while the epic itself lists under "(no epic)" — recorded follow-up (soft, never blocks)
**Evidence limits:** ✅ None

Audit passed — sync-config ✓, depcruise 0 violations (568 modules), knip 0 findings, jscpd 581 clones (−10 vs the 591 baseline; refactors reduced duplication).

## Quality gates run

- Scenario-gate: independent /review-spec — PASS after 1 vacuous-scenario fix.
- /quality-review (cross-model, Opus reviewer): REQUEST CHANGES → both criticals fixed
  (block-sequence `children:` corruption; ignored LinkResult) → re-review PASS.
- /refactor: 3 resolved (dead export, test parser reuse, slug-helper hoist), 3 struck with reasons.

## Follow-ups (recorded, out of scope)

- INDEX nesting: epic ticket itself groups under "(no epic)"; child group heading is the bare epic id, not the title.
- Standalone `ticket link` / re-parent command (deferred at intake).
