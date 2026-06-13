# Verify — JYWZG1 stale tooling-config warning

Date: 2026-06-13 · Branch: feat/migration-stale-config-warning · Fresh build, frozen tree.

## Verify Checklist

**Test Suite:** ✓ 2795/2795 tests pass (1 skipped; full suite on fresh dist)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** All 14 scenarios marked complete (42/42 R/G/R boxes)
**Dep Drift:** ✅ Clean (zero dependency changes; node builtins only)
**Parent Epic:** project-namespace-default / AQJ95G (epic already done; this is a post-ship follow-up to 9MMWS7)
**Reconcile:** ✅ No pattern deviation (models the warn-don't-edit vendored-ignores precedent; 2 deviations recorded in impl-plan.md — tsconfig fixture vs eslint, outline trimmed to 2 behavioral classes)

## Audit

Audit passed (0 errors).

- Architecture: 0 errors; 9 pre-existing `no-orphans` baseline warnings (cucumber.mjs lane + the dogfood-migrated repo's own `.project/hooks/post-tool-guide-check.ts`).
- Dead code: knip's lone finding from this ticket — a speculative `LEGACY_REFERENCE` export with no consumer — un-exported (committed). The rest (eslint plugins, personas constants) is pre-existing baseline.
- Duplication: 0.65% (10 clones, unchanged baseline).
- Config drift: sync-config clean.

## Done-when evidence

- After a real `--migrate-namespace` move, a `tsconfig.json` still referencing `.safeword-project/` is named in the upgrade output with the `.safeword-project/ → .project/` mapping; the file is byte-identical afterward (nothing edited).
- A clean repo, a managed-only `.prettierignore` block, and documentary refs under `.project/` produce no warning; a `.safeword-projectile/` substring near-miss and refs under `.safeword/` are not flagged; a customer `.safeword-project/` line outside the managed block IS flagged.
- The warning fires only on an actual move: silent on `--no-migrate-namespace` and both-dirs; the other no-move classes (custom-root, already-current) return before the scan by construction.
- Detection is a pure unit-tested scanner; the warning is a read-only diagnostic on the migration's successful-move path.
