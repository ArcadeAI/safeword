# Verification: Give Codex users the full Safe Word workflow

## Verify Checklist

**Test Suite:** ✓ 5210/5210 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes: 484 scenarios (3 skipped), 15,000 steps (4 skipped)
**Build:** ⏭️ Skipped - no standalone build step; package build runs through the canonical test plan
**Lint:** ✅ Clean
**Scenarios:** All 61 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction - Walked Technical Builder (TBU) through setup -> migrate -> /hooks -> explicit cleanup; worst step = Codex's manual `/hooks` trust review; new steps vs before = 1, intentionally retained as the required explicit safety boundary.
**Evidence limits:** ⚠️ GitHub's REST tag endpoint returned HTTP 503 during the unrelated reconcile live smoke; Codex cache and migration live smokes passed, and `git ls-remote` confirmed the fixture tag remains available.
**Audit:** Audit passed with warnings - expected generated/parity clones remain; `markdownlint-cli2` 0.23.1 is an available development-only patch outside this ticket's scope, and pre-existing persona aliases `SM` and `TB` require a separate human-domain documentation follow-up.

## Refactor Ledger (2026-07-17)

This post-implementation cleanup is limited to behavior-preserving structure in
the Codex plugin migration and hook-dispatch path. Entries are ordered
leaf-first; each completed item receives its own focused verification and
commit.

- [x] R1. Characterize then centralize the removable-file predicate in
  `reconcile.ts` so plan and execution share the "regular file or symlink,
  never directory" safety rule.
- [x] R2. Share the Codex catalogue frontmatter reader while retaining
  source-specific and generated-asset-specific validation at their callers.
- [ ] R3. Normalize the packaged-template lookup in `codex-hook.ts` so
  instructions and hooks share one ordered source/distribution lookup helper.
- [ ] R4. Extract the Codex hook CLI subprocess runner in `codex-hook.test.ts`
  to make each behavior test describe only its event-specific inputs.
- [ ] R5. Extract the migration CLI subprocess runner in
  `migrate-codex-plugin.test.ts` to centralize fixture runtime environment
  setup.
- [ ] R6. Unify root Git-repository fixture setup in
  `steps/test-codex-plugin-migration.steps.ts`.
- [ ] R7. Route every root packaged-Codex-hook fixture invocation through its
  existing executor, including raw malformed input.
- [ ] R8. Centralize the repeated package-BDD contract-error capture helper
  without changing each scenario world's stored error state.
- [deferred] D1. Do not consolidate legacy-command recognition in
  `migrate-codex-plugin.ts`: the current narrow predicates document the
  fail-closed ownership boundary, and a smaller call graph would not reduce
  removal risk.
- [deferred] D2. Do not extract the common Codex event bootstrap yet:
  PostToolUse and Stop fallbacks need characterization coverage before changing
  their stdin/project-directory ordering.
- [deferred] D3. Do not split the BDD parity fixture module: its helpers encode
  scenario-specific state rather than repeatable infrastructure, so an
  extraction would add indirection without removing duplication.
- [deferred] D4. Do not reuse the production hook-manifest type in the schema
  parity test: the duplicate test-local shape is a deliberately independent
  oracle, and the payoff from a type-only import is negligible.
- [deferred] D5. Do not combine package pack/extract helpers: the call sites
  intentionally retain different archive lifetimes and cleanup boundaries.
