# Verify — P58R22 (hook stripComment follows CommonMark block-comment rule)

## Verify Checklist

**Test Suite:** ✓ 2364/2364 tests pass (1 skipped) — full `bun run test`, 146 files
**Build:** ✅ Success (tsup, via `pretest`)
**Lint:** ✅ Clean (`eslint .` + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (inline tests, no test-definitions.md)
**Dep Drift:** ✅ Clean — no dependency changes in this ticket
**Parent Epic:** EECVXB (siblings: G9BXE9 done; closing 9S6600 + P58R22 now; FSX1PP, V6N5PW remain)
**Reconcile:** ✅ No pattern deviation — aligned the hook to the CLI's CommonMark behavior (`markdown-sections.ts`); the follow-on `activeLines` extraction mirrors the CLI's WQ4RH3 extraction rather than inventing a new shape
**Audit:** Audit passed — architecture clean (no cycles, 124 modules), duplication 0.87% (the refactor reduced it), config in sync; knip warnings all pre-existing

## Evidence

- Test: `jtbd.test.ts` (+2: mid-line unclosed `<!--` stays inline; closed mid-line `<!-- ... -->` still stripped) — 34/34 incl. ac-gate + jtbd-gate integration; full suite 2364 pass / 1 skipped. CommonMark 0.31.2 verified current.
- Commits: `56626fad` (fix — spanning block opens only when the line begins with `<!--`), `dc578ebd` (refactor — extract `activeLines` shared line-walk).

Ready to mark done.
