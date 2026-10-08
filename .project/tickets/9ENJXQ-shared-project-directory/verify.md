# Verify — 9ENJXQ (PR 1 of #5467)

## Verify Checklist

**Test Suite:** ✓ 10520/10520 tests pass (14 skipped; packages/cli 614 files, plus retro-relay 153/153 and retro-collector 198/198)
**Gherkin:** ✅ Acceptance lane passes (596 scenarios passed)
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint on every changed source and test file)
**Typecheck:** ✅ Clean (`tsc --noEmit`, 0 errors)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ No change warranted — the change is itself the consolidation of three resolvers into one module
**PR Scope:** ✅ Diff matches ticket scope (new `project-directory.ts`, five tool hooks migrated, old resolvers removed, parity guard, schema entry, regenerated mirrors and Cursor lifecycle fixtures)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (internal project resolution)
**Surface Evidence:** ⏭️ N/A — no affected surfaces
**Evidence limits:** ⚠️ The deps lane exits non-zero on advisories already on main (braces, fast-uri, katex, urllib3); this PR changes no dependency manifest or lockfile.

## Notes

- Cursor `cursor-install.json` / `cursor-uninstall.json` result hashes changed because a Cursor install now ships `.safeword/hooks/lib/project-directory.ts` (same effect PR #5571 had when adding `ticket-close.ts`).
- Behavior change: tools other than edits and Bash now resolve from the host `cwd` instead of always using the launch checkout.
