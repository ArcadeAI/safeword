# Verify — G9BXE9 (Hook JTBD gate accepts derived persona codes)

## Verify Checklist

**Test Suite:** ✓ 2361/2361 tests pass (1 skipped) — full `bun run test` suite, 146 files
**Build:** ✅ Success (tsup, via `pretest`)
**Lint:** ✅ Clean (`eslint .` + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (inline tests, no test-definitions.md)
**Dep Drift:** ✅ Clean — no dependency changes in this ticket; the eslint plugins flagged against ARCHITECTURE.md are bundled-config tooling, exempt per the tooling rule
**Parent Epic:** EECVXB (siblings: 0/5 done)
**Reconcile:** ✅ No pattern deviation — ported the existing cross-runtime-copy pattern already documented in jtbd.ts; introduced no new pattern

## Evidence

- Targeted: `tests/hooks/jtbd.test.ts` (+3 cases: derived-code in `knownPersonaRefs`, gate resolves a derived code against a bare-named persona, unknown persona still denies), `tests/hooks/ac-gate.test.ts`, `tests/integration/jtbd-gate.test.ts` — 32/32 pass.
- Full suite: 2361 passed / 1 skipped across 146 files.
- Parity: template `packages/cli/templates/hooks/lib/jtbd.ts` == dogfood `.safeword/hooks/lib/jtbd.ts` (verified post-commit); `parity-check` clean (116 pairs + 3 contracts).
- Commits: `3c50502d` (fix, RED→GREEN), `ae28d7d9` (refactor — extract `addCodeForms`).

Ready to mark done (task gate: tests + verify.md). Awaiting user confirmation per the no-auto-close rule.
