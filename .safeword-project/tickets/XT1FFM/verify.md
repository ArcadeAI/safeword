# Verify: XT1FFM — Scenario-lineage numbering

## Verify Checklist

**Test Suite:** ✓ 2284/2284 tests pass (1 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 9 scenarios marked complete
**Dep Drift:** ✅ Clean — no new dependencies (only `node:fs` / `node:path` + internal modules)
**Parent Epic:** DZ2NM5 / epic bdd-phase-zero-merge (no parent/children frontmatter to tally)

## Audit

Audit passed with warnings.

- **Architecture (depcruise):** ✅ no violations (118 modules, 340 dependencies).
- **Dead code (knip):** ✅ no new unused exports. The 2 flagged
  (`MAX_CODE_LENGTH` / `MIN_NAME_LENGTH` in `personas.ts`) predate this ticket
  and are deliberately exported.
- **Duplication (jscpd):** ⚠️ `computeSkipMask` + comment-skip mirror across
  `scenario-coverage.ts` / `personas.ts` / `glossary.ts` — the deliberate
  "5th section-walk consumer, not unified" decision; unification is owned by
  M6D315.
- **Learnings:** ✅ all conform (`Covers:` present).
- **Test quality:** ✅ new tests assert specific values (`toEqual` / `toBe` /
  `toBeUndefined`), use fresh per-test fixtures, and are named by behavior.

## Scope → evidence

- **Scheme as scenario title:** `test-definitions.md` titles use
  `cross-reference-numbering.DEV1.AC1|AC2.<snake>` (dogfooded);
  `parseAcReferenceFromTitle` proves the title→ref parse (R1).
- **`safeword check` coverage report (advisory, three buckets):**
  `buildCoverageReport` + `check.ts` wiring, scoped to in-progress spec-bearing
  tickets; unit + integration tests green (R2 uncovered/stale/orphan, R3
  degradation).
- **Docs:** SCENARIOS.md (scheme + worked example), SAFEWORD.md (one-line ref),
  test-definitions template (numbered title) — canonical `templates/` and the
  `.safeword//.claude/` mirrors edited together and verified in sync.
- **No gate:** `pre-tool-quality.ts` untouched; hook-side `parseAcsByJtbd`
  untouched (its AC counts still feed the AC gate).

**Next:** Mark XT1FFM done.
