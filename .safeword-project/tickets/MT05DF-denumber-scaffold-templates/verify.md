# Verify — MT05DF (de-number bdd lifecycle refs in scaffolding templates)

## Verify Checklist

**Test Suite:** ✓ 2284/2284 tests pass (138 files, 1 skipped — out-of-scope `setup-python-phase2`)
**Build:** ✅ Success (`packages/cli` ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** ⏭️ Skipped — task ticket, inline verification, no `test-definitions.md`
**Dep Drift:** ✅ Clean (no dependency-manifest changes in this ticket)
**Parent Epic:** N/A

## Evidence

- `done_when` grep clean: `grep -rnE "Phase[ -][0-9]"` across all 4 surfaces (`.safeword/templates/spec-template.md`, `packages/cli/templates/spec-template.md`, `packages/cli/templates/glossary-template.md`, `packages/cli/templates/personas-template.md`) returns nothing.
- `spec-template.md` byte-identical across both trees (`diff -q` clean — template-parity contract holds).
- All 5 occurrences de-numbered: spec-template line 6 "bdd Phase 0 flow" → "bdd intake flow" (+ the intake/intake echo reworded to "authors it before engineering scope"), line 53 "Each Phase-3 scenario" → "Each define-behavior scenario"; glossary-template line 6 "`bdd` Phase 0 flow" → "`bdd` intake flow"; personas-template line 6 "during Phase 0" → "during intake".
- All changes already landed: commits `0c59a0f6` (de-number) + `d1b7993c` (echo reword).

## Audit

- Config drift: ✓ `.safeword/depcruise-config.cjs` in sync (no W007).
- Architecture: ✔ no dependency violations (250 modules, 687 deps cruised).
- Dead code / duplication: knip + jscpd findings (7 unused eslint-plugin deps, 3 unused exports, 108 clones @ 1.96%) are all pre-existing and unrelated to this doc-only change — not in this ticket's diff.
- Learning files: all conform (`Covers:` present).
- Audit passed with warnings (all pre-existing).
