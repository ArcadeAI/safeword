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
