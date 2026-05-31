# Verify — 8BNSTE: install-time prettier config detection

Pinned to commit `412005e3` (feat(8BNSTE): GREEN). Verified on branch `arcade-pipeline-sync`.

## Verify Checklist

**Test Suite:** ✓ 2312/2312 tests pass (1 skipped, unrelated; 140 files; `npx vitest run` from `packages/cli/`)
**Build:** ✅ Success (`tsup` — ESM + DTS build clean)
**Lint:** ✅ Clean (`eslint .` no errors; `tsc --noEmit` exit 0 from `packages/cli/`; prettier formatted)
**Scenarios:** ⏭️ Skipped — task with inline TDD tests (no test-definitions.md)
**Dep Drift:** ✅ Clean — change adds no dependencies
**Parent Epic:** N/A
**Audit:** Audit passed with warnings — architecture clean (depcruise: 0 violations, 120 modules); no dead code introduced; knip warnings are pre-existing and unrelated to this ticket (eslint-plugin unused deps, `personas.ts`/template-hook exports).

## Evidence against done_when

- **Existing prettier config → no safeword writes.** `reconcile.test.ts` gate test: a `prettier.config.mjs` project with `existingPrettierConfig: true` gets neither `.prettierrc` nor `.safeword/.prettierrc`; `prettier.config.mjs` is left untouched. PASS.
- **Detection across forms.** `detect.test.ts` `hasExistingPrettierConfig`: true for `.prettierrc`, `.prettierrc.yaml`, `prettier.config.mjs`, `package.json#prettier`; false for none / Biome-only. PASS.
- **Threading.** `project-detector.test.ts`: `detectProjectType` surfaces `existingPrettierConfig` true/false from cwd. PASS.
- **Bare `.prettierrc` additive merge unchanged.** No edit to the JSON-merge path (`files.ts:367`); existing merge tests stay green. PASS.
- **No-config project still gets safeword's `.prettierrc`.** Existing reconcile install tests unchanged and green. PASS.

## Root-cause closure

A `prettier.config.mjs` project previously classified as `existingFormatter: false`, so install dropped a `.prettierrc` (`singleQuote: true`) that resolves ahead of `prettier.config.mjs` in prettier's search order and flipped the customer's quote style. The new `existingPrettierConfig` signal gates both prettier-config writes, so safeword never shadows a config it cannot merge into. `existingFormatter` / `eslint-config-prettier` semantics are left intact (out of scope).

**Next:** Awaiting user confirmation to mark 8BNSTE done.
