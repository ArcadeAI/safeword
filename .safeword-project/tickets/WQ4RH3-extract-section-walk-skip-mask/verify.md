# Verify: WQ4RH3 — Extract section-walk skip-mask

## Verify Checklist

**Test Suite:** ✓ 2284/2284 tests pass (1 skipped, 138 files)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint src tests + tsc)
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; behavior locked by existing personas/glossary/scenario-coverage unit tests)
**Dep Drift:** ✅ Clean — no new dependencies
**Parent Epic:** sibling cleanup under DZ2NM5 (no parent/children frontmatter)

## Audit

Audit passed.

- **Architecture (depcruise):** ✅ no violations (119 modules — +1 leaf util, no cycles; markdown-sections.ts imports nothing internal).
- **Duplication (jscpd):** clones among the trio dropped **3 → 1**. The remaining
  clone is `findDuplicates`/`groupByLine` shared by personas.ts ↔ glossary.ts —
  pre-existing validator-helper duplication, explicitly out of WQ4RH3's scope.
- **Behavior preservation:** each consumer migrated in its own commit with its
  suite green at the step — scenario-coverage 12/12, glossary 18/18,
  personas 65/65 — then the full suite green end-to-end.

## Scope → evidence

- **Extraction:** `computeSkipMask` + `stripInlineComments` now live once in
  `src/utils/markdown-sections.ts`; personas/glossary/scenario-coverage import
  them with zero private copies (net-negative LOC). Commits 951e19c8, a324e217,
  749204b8.
- **Hook boundary respected:** `.safeword/hooks/lib/jtbd.ts` keeps its own
  single-pass parser (deployed hooks can't import the CLI dist) — out of scope,
  documented as a deliberate cross-runtime copy.
- **Attribution corrected:** the false "shared extraction belongs to M6D315"
  claim is gone from live code (jtbd.ts header, both mirrors) and from XT1FFM's
  active verify.md. Commit 3456c083.

**Next:** Mark WQ4RH3 done.
