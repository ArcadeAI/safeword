# Verify — Ticket #149

## Verify Checklist

**Test Suite:** ✓ 87/87 tests pass (targeted: owned-paths + schema + reconcile + parity; release-gated dogfood parity also green. Full-suite run had 147 pre-existing 5s timeouts confined to `tests/integration/typescript-validation.test.ts` — environmental, unrelated to this change, present on the base commit.)
**Build:** ✅ Success
**Lint:** ✅ Clean on files touched by this change (44 pre-existing errors elsewhere in worktree, same count before/after this commit)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Dep Drift:** ⏭️ Skipped — no ARCHITECTURE.md
**Parent Epic:** N/A

Audit passed (covered by inline reasoning during implementation — see below).

## Done When (from ticket.md)

- [x] `safewordPaths` literal removed from `session-auto-upgrade.ts`
- [x] Hook gets the list from a generated source (generator-emitted `lib/owned-paths.ts`)
- [x] Adding a new top-level prefix to schema buckets propagates to the hook on next CLI build (generator pulls from live schema at setup/upgrade time)
- [x] CI check catches drift if the generator ever misses a prefix (`tests/owned-paths.test.ts` — round-trip test + v0.31.0 historical-prefix regression floor)
- [x] Smoke verified: dogfood `.safeword/hooks/lib/owned-paths.ts` regenerated; release-gated dogfood-parity test green

## Scope expansion beyond ticket text

The ticket text said "derive from `ownedFiles`." The hardcoded list it replaces also includes paths from `jsonMerges` (`.mcp.json`) and `textPatches` (`AGENTS.md`, `CLAUDE.md`, `.gitignore`). Deriving from `ownedFiles` only would have silently regressed the hook. Implementation unions `ownedFiles ∪ managedFiles ∪ jsonMerges ∪ textPatches`. Confirmed with user before starting.

## Latent bug fixed in-passing

Old hook used `prefix.startsWith()` for both dir prefixes (`/`-suffixed) and bare files. With 7 hardcoded entries this rarely mattered. With the schema-derived list (22 entries, many bare config filenames like `package.json`, `tsconfig.json`), `package.json.bak` would falsely match `package.json`. The generated helper `isSafewordPath` uses exact-equality for bare files, `startsWith` for `/`-suffixed dirs. Covered by `matchesSafewordPath` tests in `owned-paths.test.ts`.

Ready to mark done.
