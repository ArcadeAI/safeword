# Verify — Ticket 154

## Verify Checklist

**Test Suite:** ✓ 1779/1779 tests pass (1 skipped, unrelated)
**Build:** ✅ Success (ESM + DTS)
**Lint:** ✅ Clean (eslint, prettier, tsc --noEmit)
**Scenarios:** All 3 scenarios marked complete (inline tests in `ticket.md`, mapped to `tests/packs/packs.test.ts` and `tests/commands/upgrade.test.ts`)
**Dep Drift:** ⚠️ 19 undocumented deps in ARCHITECTURE.md (all eslint plugins / tooling, pre-existing) + 1 self-caused doc fix (see below)
**Parent Epic:** N/A

## Audit Results (full pass)

**Architecture:** ✅ No dependency violations (depcruise — 96 modules, 267 deps cruised)
**Dead Code (knip):** ✅ Clean — no unused exports, files, deps, or binaries
**Lint / Format / Typecheck:** ✅ Clean
**Duplication (jscpd):** 96 clones, 2.36% of lines (2.1% of tokens) — informational; pre-existing baseline, not affected by this ticket.

**Dead refs in agent configs:** ✅ Clean. `AGENTS.md` mentions `reconcile.ts` in a section heading but the file exists at `packages/cli/src/reconcile.ts` — false positive on the strict-path matcher.

**Agent config sizes:** ✅ All within limits. CLAUDE.md 20L, AGENTS.md 176L, Cursor rules max 276L.

**Staleness:** ✅ None flagged. CLAUDE.md / AGENTS.md last touched 14d ago (threshold is 30d). README 0d. ARCHITECTURE 3d.

**Learning files:** ✅ All `.safeword-project/learnings/*.md` carry the `Covers:` line on row 3.

**Outdated deps:**

| Package | Current | Latest | Type | Bump  | Risk                           |
| ------- | ------- | ------ | ---- | ----- | ------------------------------ |
| eslint  | 9.39.4  | 10.4.0 | dev  | major | Medium (per matrix: dev/major) |

Verdict: defer — ESLint 10 work is already in flight (see commit `8f29b2b` "fix(eslint): unblock ESLint 10 + install-time peer-dep guard"). Not blocking ticket 154.

**ARCHITECTURE.md drift caught by this audit:** the documented `config.json` example carried `"version": "0.15.0"` — directly contradicted by this ticket's change. Updated as part of this commit. This was the one substantive finding the partial first-pass audit had missed.

**Undocumented deps (pre-existing tooling — not blocking):** `@tanstack/eslint-plugin-query`, `eslint-import-resolver-typescript`, `eslint-plugin-{astro,better-tailwindcss,import-x,jsdoc,jsx-a11y,playwright,promise,react,react-hooks,regexp,security,simple-import-sort,sonarjs,storybook,turbo,unicorn}`, `@vitest/coverage-v8`. All are ESLint plugins or test tooling — out of scope for ticket 154.

**Test quality sample (8 files):** 5 weak assertions across 3 files:

- `tests/schema.test.ts` — 2 `toBeTruthy`/`toBeDefined`
- `tests/quality.test.ts` — 2 `toBeTruthy`/`toBeDefined`
- `tests/integration/sql-golden-path.test.ts` — 1 weak assertion

Pre-existing. Not blocking ticket 154 — flag for a follow-up.

**Audit passed** (one finding remediated inline: ARCHITECTURE.md `config.json` example).

## Done-When Verification (from ticket frontmatter)

- ✅ `SafewordConfig` interface has no `version` field — see [config.ts:14-17](packages/cli/src/packs/config.ts:14)
- ✅ Fresh projects get a `config.json` without a `version` key — `tests/packs/packs.test.ts` "Test 1.6"
- ✅ Existing projects shed the `version` key on next `safeword upgrade` — `tests/commands/upgrade.test.ts` "Ticket 154 › should remove …"
- ✅ All tests pass (1779/1779)
- ✅ Lint clean

## Commits

- `a9a53ca` refactor(packs): strip dead `version` field from .safeword/config.json
- `05317ac` test(helpers): match SafewordConfig helpers to post-ticket-154 shape
- `6c409ed` docs(ticket-154): mark tests complete + add verify.md
- (next) docs(arch): update ARCHITECTURE.md config.json example + honest verify.md

## Downstream

`arcade-deep-research`'s stale `version: "0.25.14"` in `.safeword/config.json` will be stripped automatically on its next `safeword upgrade` (which auto-fires via the session hook). No manual edit required.

## Honest note on the audit

The first pass of this verify.md was written on a partial audit (depcruise + knip only) with the verdict "Audit passed." That was misleading. This rewrite is the full pass — and it caught a real doc-drift bug (ARCHITECTURE.md example mismatch) that the partial audit missed. The fix is included in this commit.
