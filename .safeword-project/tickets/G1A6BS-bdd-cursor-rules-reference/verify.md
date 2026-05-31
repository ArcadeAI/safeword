# Verify — G1A6BS (bdd cursor rules → @reference + reconcile to 7-phase set)

## Verify Checklist

**Test Suite:** ✓ 2291/2291 tests pass (138 files, 1 skipped — out-of-scope `setup-python-phase2`; 670s)
**Build:** ✅ Success (`packages/cli` ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** ⏭️ Skipped — task ticket, doc-only, no `test-definitions.md`
**Dep Drift:** ✅ Clean (no dependency-manifest changes in this ticket)
**Parent Epic:** N/A

## done_when evidence

- **grep clean:** `grep -rnE "Phase[ -]?[0-9]" .cursor/rules/bdd-*.mdc packages/cli/templates/cursor/rules/bdd-*.mdc` returns nothing (exit 1, no matches) across both trees.
- **Thin rules:** all 8 `bdd-*.mdc` (both trees) are `description`/`alwaysApply` frontmatter + a single `@.claude/skills/bdd/<FILE>.md` line. New `bdd-verify.mdc` → `@.claude/skills/bdd/VERIFY.md`; `bdd-done.mdc` repointed close-only → `@.claude/skills/bdd/DONE.md`.
- **7-phase set:** verify is its own rule (`bdd-verify.mdc`); done is close-only. Descriptions are mutually exclusive — bdd-verify keys on "verify phase OR all scenarios marked [x]", bdd-done on "done phase (verify.md exists)".
- **Byte-identity:** `diff` clean for all 8 rules between `.cursor/rules/` and `packages/cli/templates/cursor/rules/`.
- **Registration:** `bdd-verify.mdc` added to `SAFEWORD_SCHEMA.ownedFiles` (`packages/cli/src/schema.ts`, phase order between bdd-tdd and bdd-done) and to `tests/fixtures/skill-cursor-pairs.ts` (bdd skill's cursorRules). `safeword check` → "Configuration is healthy" (no unregistered-template drift).
- **Parity green:** `schema.test.ts` + `skills-commands-validation.test.ts` → 539 passed.

## Audit

Audit passed with warnings (all pre-existing, unrelated to this doc-only change).
