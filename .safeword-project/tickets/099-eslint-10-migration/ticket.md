---
id: '099'
type: task
phase: implement
status: in_progress
created: 2026-04-11
last_modified: 2026-05-14T16:35:00Z
---

# Task: ESLint 10 Migration

**Type:** Improvement

**Scope:** Upgrade ESLint from v9 to v10, along with `@eslint/js` and `typescript-eslint` to compatible versions. Verify all custom rules, preset configs, and tests work.

**Out of Scope:** New lint rules, config restructuring, upgrading other ESLint plugins beyond what's needed for v10 compat.

**Context:**

- Dependabot PR #55 (`@eslint/js` 9→10) was closed because upgrading `@eslint/js` alone creates a version split
- The root cause: `@typescript-eslint/utils@7.x` references `LegacyESLint` class removed in ESLint 10
- Need `typescript-eslint` version that supports ESLint 10's API
- Safeword ships ESLint config as a preset — users inherit our peer dependency range (`eslint: "^9.0.0"`)
- Bumping to ESLint 10 is a **semver-major** for the safeword package (changes peer dep range)

**Blocked By (updated 2026-04-17):**

- `eslint-plugin-react` — **HARD BLOCKER.** Crashes at rule load: `context.getFilename()` removed in ESLint 10, shared `version.js` utility calls it for React version detection. Most rules fail. PRs #3972 and #3979 open (last updated 2026-04-12), not merged. **Wait for upstream fix — no shim.**

Resolved:

- ~~`typescript-eslint`~~ — supports `eslint ^8.57.0 || ^9.0.0 || ^10.0.0` (PR #12057 merged)
- ~~`eslint-plugin-react-hooks`~~ — v7.1.0 supports ESLint 10 in peerDeps
- ~~`@tanstack/eslint-plugin-query`~~ — v5.99.0 supports ESLint 10; issue #10141 closed
- ~~`@vitest/eslint-plugin`~~ — v1.6.16 has `>=8.57.0` peer range, covers ESLint 10
- ~~`eslint-plugin-jsx-a11y`~~ — peerDep only, all rules work at runtime. Override peerDep.
- ~~`eslint-plugin-promise`~~ — vendor rules and drop dependency (see below)

**Decision: vendor promise rules (2026-04-17).**

`eslint-plugin-promise` is effectively unmaintained (no release in 17 months, no active maintainer with merge rights). The 6 rules safeword uses have zero alternatives in typescript-eslint, oxlint, or biome. Rather than depend on an abandoned package, vendor the 6 rules as safeword custom rules and drop the dependency. Rules to vendor: `no-multiple-resolved`, `no-callback-in-promise`, `no-nesting`, `no-promise-in-callback`, `no-return-in-finally`, `valid-params`.

**Implementation Plan (2026-04-17):**

Phase 1 — Vendor promise rules (can do now, independent of ESLint version):

- Extract 6 rules as safeword custom rules (MIT-licensed source)
- Remove `eslint-plugin-promise` dependency
- Update base config to use vendored rules
- Update tests

Phase 2 — Upgrade compatible packages (can do now):

- `typescript-eslint` → ESLint 10-compatible version
- `eslint-plugin-react-hooks` → v7.1.0
- `@tanstack/eslint-plugin-query` → v5.99.0
- `@vitest/eslint-plugin` → v1.6.16+
- Override `eslint-plugin-jsx-a11y` peerDep

Phase 3 — ESLint 10 upgrade (blocked on `eslint-plugin-react`):

- `eslint` → v10, `@eslint/js` → v10
- Update `peerDependencies.eslint` to include `^10.0.0`
- Semver-major release for safeword

**Done When:**

- [ ] Promise rules vendored, `eslint-plugin-promise` removed
- [ ] Compatible packages upgraded to ESLint 10-ready versions
- [ ] ESLint 10 and `@eslint/js` 10 installed (after `eslint-plugin-react` ships support)
- [ ] `typescript-eslint` upgraded to ESLint 10-compatible version
- [ ] All preset configs load without errors
- [ ] `bun run lint:eslint` passes
- [ ] All tests pass
- [ ] `peerDependencies.eslint` updated to include v10

**Tests:**

- [ ] Vendored promise rules pass existing tests
- [ ] Existing ESLint rule tests pass with ESLint 10
- [ ] Preset TypeScript config loads and lints sample files
- [ ] No `LegacyESLint` or `Class extends value undefined` errors

**Cross-references (added 2026-04-19):**

- **Ticket 138** (unified customer override contract, landed): flipped composition order in `getSafewordEslintConfigExtending` and `getSafewordEslintConfigLegacy`. Touches the same `packages/cli/src/templates/config.ts`.
- **Ticket 139** (planned follow-up to 138): will delete `getSafewordEslintConfigStandalone` and harden the extending template's catch. Recommended sequence: land 139 before 099 unblocks, so the v10 upgrade diffs against a simplified template set.
- **Legacy template deletion:** ESLint 10 removes `.eslintrc.*` support entirely. `getSafewordEslintConfigLegacy` becomes dead code on upgrade. Delete as part of 099 once it unblocks — don't route through 139.

## Status refresh 2026-05-14

### Blocker still alive, now with a transitive blocker

`eslint-plugin-react` still 7.37.5 (no new release; peerDeps still `... || ^9.7`). PRs [#3972](https://github.com/jsx-eslint/eslint-plugin-react/pull/3972) and [#3979](https://github.com/jsx-eslint/eslint-plugin-react/pull/3979) **still open**, but were last touched **2026-05-12** after a month of dormancy — there's renewed activity.

**New chain discovered:** #3979's recent comments show the ESLint 10 work is now transitively blocked on [`import-js/eslint-plugin-import#3227`](https://github.com/import-js/eslint-plugin-import/issues/3227) ("Compatibility with ESLint 10"), still open as of 2026-05-08. Maintainer `ljharb` rejected the suggestion to switch to `eslint-plugin-import-x` ("No."). So the gating chain is: `eslint-plugin-react` → `eslint-plugin-import` → ESLint 10.

### Outdated decision: vendor `eslint-plugin-promise`

The Apr-17 decision to vendor 6 promise rules was based on the package being 17 months stale. **No longer true:** `eslint-plugin-promise@7.3.0` shipped **2026-04-27** with peerDeps `^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0`. Vendoring is now unnecessary work.

**Revised Phase 1:** simple peerDep verification + version bump to 7.3.x. Delete the vendoring plan.

### Phase 2 effectively done via dependabot

PR #83 (chore(deps): bun-minor-patch group, merged 2026-05-13) picked up:

- `typescript-eslint` 8.59.x (includes ^10.0.0 in peerDeps) ✓
- `eslint-plugin-react-hooks` 7.1.1 (includes ^10.0.0) ✓
- `@tanstack/eslint-plugin-query` 5.100.10 (includes ^10.0.0) ✓
- `@vitest/eslint-plugin` 1.6.17 (>=8.57.0, covers v10) ✓
- Other plugins already on ESLint-10-ready peerDeps (verified 2026-05-14)

Remaining Phase 2 action: confirm `eslint-plugin-jsx-a11y` peerDep override is wired up (it's still at 6.10.2 with peerDeps capped at `^9`, but per ticket the rules work at runtime).

### Impact analysis if we bump to ESLint 10 anyway (rejected)

Verified via PR #3979 diff + reading safeword's `recommended-react.ts` preset:

- **`eslint-plugin-react` failure mode:** hard crash at rule load. `lib/util/version.js` calls removed `context.getFilename()`. Most rules become unusable. Losing 7 error-severity LLM-targeting rules safeword ships (`jsx-key`, `jsx-no-duplicate-props`, `no-direct-mutation-state`, `no-children-prop`, `jsx-no-target-blank` security autofix, `no-unknown-property` `class→className` autofix, `no-unescaped-entities` XSS prevention).
- **`eslint-plugin-jsx-a11y` failure mode:** soft. peerDep warning at install only; rules work at runtime. Negligible impact.
- **Migration tools:** `eslint-transforms` codemod + `@eslint/compat` exist, but `@eslint/compat` only patches `SourceCode` methods — RuleContext method removals aren't covered. No drop-in shim.

**Conclusion:** Bumping ESLint 10 without `eslint-plugin-react` upstream fix is a regression for safeword's React/Next.js users. Stay on ESLint 9 until upstream chain ships.

### Revised plan

- ~~Phase 1: vendor promise rules~~ → trivial peerDep verification + version bump (the bump may already be in main)
- ~~Phase 2: compat-bump deps~~ → already shipped via PR #83
- **Phase 3 (the only remaining work): ESLint 10 install** — blocked on `eslint-plugin-react` upstream, which is itself blocked on `eslint-plugin-import#3227`. Monitor upstream weekly.
