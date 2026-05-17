# Verify — Ticket #147

## Verify Checklist

**Test Suite:** ✓ 1704/1704 tests pass (1 skipped, 0 failures)
**Build:** ✅ Success (`bun run --cwd packages/cli build` — ESM + DTS)
**Lint:** ✅ Clean (`bun run lint` after `rm -rf packages/cli/dist`, exit 0)
**Scenarios:** ⏭️ Skipped — task ticket, no scenarios
**Dep Drift:** ⏭️ Skipped — `jiti` is tooling (ESLint TS-config loader), not architectural
**Parent Epic:** N/A
**Audit passed:** ✓ no dependency violations (185 modules, 486 deps cruised), no new dead code introduced

## Done-When evidence

- [x] **Fresh worktree commits without pre-build.** Verified: `rm -rf packages/cli/dist && bun run lint` exits 0. The pre-commit hook itself just ran on this commit and passed every gate (parity contracts, version sync, lint-staged with eslint+prettier).
- [x] **No `dist/` reference in either eslint config.** Verified by release-gate test `eslint-config-no-distribution.release.test.ts` (2 assertions, both pass). Test prevents regression.
- [x] **No `packages/cli/dist/` build required for lint.** Verified end-to-end: dist removed, lint passes.
- [x] **CI still passes (lint, typecheck, test).** Lint clean, typecheck clean, 1704 tests pass.

## What landed

- Renamed `eslint.config.mjs` → `eslint.config.ts` at root and in `packages/cli/`
- Both configs now import from `packages/cli/src/presets/typescript/index.js` (source, with `.js`-suffix-references-`.ts` TS+ESM convention)
- Promoted `jiti@^2.7.0` from transitive (via knip, vite, etc.) to direct devDependency
- Stripped the `test -f .../dist/... || bun run build` guard from root `lint` script — now just `eslint .`
- Added release-gate test guarding the invariant

## Notes

- jiti is **already in the lockfile** via knip/vite/postcss-load-config — promoting to direct dep adds zero bytes on disk.
- Bun handles `.ts` natively; jiti is the Node fallback. ESLint declares jiti as an optional peer (`optionalPeers: ["jiti"]`) and picks it up automatically.
- The TS source files use the standard `from './foo.js'` convention to reference `.ts` siblings; jiti resolves these transparently.
- Knip correctly does NOT flag jiti as unused — it understands ESLint's optional peer.

## Pre-existing audit findings (out of scope for #147)

- `prettier-plugin-sh` flagged as unused devDep — pre-existing, separate cleanup.
- `UpdateCache` unused exported type in templates — pre-existing, separate cleanup.
- ESLint 10, knip 6.14, lint-staged 17.0.5 available — pre-existing, ticket #099 owns ESLint 10.

> Ready to mark done.
