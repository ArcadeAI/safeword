# Verify — DKETNZ (use named phases only in bdd skill)

## Verify Checklist

**Test Suite:** ✓ 2284/2284 tests pass (138 files, 1 skipped — out-of-scope `setup-python-phase2`)
**Build:** ✅ Success (`packages/cli` ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** ⏭️ Skipped — task ticket, inline verification, no `test-definitions.md`
**Dep Drift:** ✅ Clean (no dependency-manifest changes in this ticket)
**Parent Epic:** N/A

## Evidence

- `done_when` grep clean across all 8 enumerated surfaces + `schema.ts` for BOTH `Phase [0-9]` and `Phase-[0-9]`. (Correction: the original grep tested only the space form and omitted SAFEWORD.md, so it false-cleaned while the hyphenated `Phase-3` survived in DISCOVERY.md + SAFEWORD.md — de-numbered in a follow-up commit and re-verified clean.)
- Both skill trees byte-identical; both planning-guide copies byte-identical (`dogfood-parity.release` green).
- Audit passed with warnings.

## Audit

- Architecture / dead code / duplication: unaffected — doc-only change, zero logic touched.
- Deps: no manifest changes.
- Learning files: all conform (`Covers:` present).
- [W007] `.safeword/depcruise-config.cjs` stale — **not in this ticket's diff** (doc-only). Pre-existing / cross-session drift (concurrent `schema.ts` work), tracked separately. Not fixed here (audit must not mutate the tree).

## Out-of-scope finding (flagged separately)

The same bdd lifecycle is numbered in the Cursor rules (`.cursor/rules/bdd-*.mdc` + template mirrors). They encode an older verify+done-merged model, so they need structural reconciliation, not a mechanical de-number — now tracked as ticket **G1A6BS** (`bdd-cursor-rules-reference`), which converts them to thin `@reference` pointers and adds the missing verify rule. (The scaffolding-template cluster — spec/glossary/personas — is the separate ticket **MT05DF**.)
