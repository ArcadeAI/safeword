---
id: 140
type: patch
phase: implement
status: in_progress
created: 2026-05-04T15:35:00Z
last_modified: 2026-05-04T15:35:00Z
---

# Fix 3 pre-existing TypeScript errors blocking clean tsc baseline

**Goal:** Restore a clean `bunx tsc --noEmit` baseline so future verify passes don't have to triage these as out-of-scope.

**Why:** Surfaced during ticket #130's verify pass (see `verify.md` "Out-of-Scope Findings"). Excluded from #130 because they predate the branch (last touched in commits `38161c7`, `5123426`, `4a232f9`) — but they're real noise blocking a clean typecheck.

## Reproduce

```bash
cd /Users/alex/projects/safeword
bunx tsc --noEmit
```

## The errors

**1. `packages/cli/src/templates/config.test.ts` (lines ~167–178)**

- `TS7006: Parameter 'h' implicitly has an 'any' type`
- `TS7006: Parameter 'hook' implicitly has an 'any' type` (twice)
- `TS7006: Parameter 'c' implicitly has an 'any' type` (twice)
- `TS18046: 'entries' is of type 'unknown'`

Fix: explicit parameter types on the callbacks; type-assert `entries` based on `Object.values(SETTINGS_HOOKS)` shape (see `packages/cli/src/templates/config.ts`).

**2. `packages/cli/src/utils/project-detector.test.ts` (lines 13–15)**

`TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'`

Fix: append `.js` to relative imports.

**3. `packages/website/src/content.config.ts` (line 3)**

`TS2307: Cannot find module 'astro:content' or its corresponding type declarations`

Fix: check `packages/website/tsconfig.json` for missing astro types. Likely needs `"types": ["astro/client"]` in `compilerOptions`, OR `astro sync` to generate the types into `.astro/`. Verify how astro is integrated in `packages/website/package.json` first.

## Acceptance Criteria

- [ ] `bunx tsc --noEmit` from repo root reports 0 errors
- [ ] `bun run --cwd packages/cli test` still passes (no behavioral regressions)
- [ ] PR titled e.g. `fix: clean pre-existing TypeScript errors`

## Work Log

- 2026-05-04T15:35:00Z Created: spawned from ticket #130's verify pass; mechanical fix, ~15 min estimated.
