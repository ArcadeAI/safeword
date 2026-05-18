# Verify — Ticket 154

## Verify Checklist

**Test Suite:** ✓ 1779/1779 tests pass (1 skipped, unrelated)
**Build:** ✅ Success (ESM + DTS)
**Lint:** ✅ Clean (eslint, prettier, tsc --noEmit)
**Scenarios:** All 3 scenarios marked complete (inline tests in `ticket.md`, mapped to `tests/packs/packs.test.ts` and `tests/commands/upgrade.test.ts`)
**Dep Drift:** ⚠️ 1 undocumented dep (pre-existing, out of scope — see below)
**Parent Epic:** N/A

## Audit Results

**Architecture:** ✅ No dependency violations (depcruise — 96 modules, 267 deps cruised)
**Dead Code:** ✅ Clean (knip — no unused exports, files, deps, or binaries)
**Lint / Format / Typecheck:** ✅ Clean

**Dep drift detail:** `@tanstack/eslint-plugin-query` is in `devDependencies` but not mentioned in `ARCHITECTURE.md`. It is an ESLint plugin (tooling), pre-existing, and untouched by this ticket. Flagged for awareness — not blocking.

**Audit passed.**

## Done-When Verification (from ticket frontmatter)

- ✅ `SafewordConfig` interface has no `version` field — see [config.ts:14-17](packages/cli/src/packs/config.ts:14)
- ✅ Fresh projects get a `config.json` without a `version` key — see `tests/packs/packs.test.ts` "Test 1.6"
- ✅ Existing projects shed the `version` key on next `safeword upgrade` — see `tests/commands/upgrade.test.ts` "Ticket 154 › should remove `version` …"
- ✅ All tests pass (`bun run test` from `packages/cli/`) — 1779/1779
- ✅ Lint clean

## Commits

- `a9a53ca` refactor(packs): strip dead `version` field from .safeword/config.json
- `05317ac` test(helpers): match SafewordConfig helpers to post-ticket-154 shape

## Downstream

`arcade-deep-research`'s stale `version: "0.25.14"` in `.safeword/config.json` will be stripped automatically on its next `safeword upgrade` (which auto-fires via the session hook). No manual edit required.
