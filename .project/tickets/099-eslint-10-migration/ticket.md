---
id: '099'
type: task
phase: implement
status: in_progress
created: 2026-04-11
last_modified: 2026-06-18T03:20:00Z
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
- Update `engines.node` from `>=22.12` to an ESLint-10-compatible runtime floor. As of `eslint@10.5.0`, ESLint requires `^20.19.0 || ^22.13.0 || >=24`; Safeword's current Node 22-only floor implies `>=22.13` when production ESLint moves to v10.
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
- [ ] `engines.node` updated to a runtime range compatible with the installed ESLint 10 version

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

Compat-ready versions landed across multiple dependabot PRs in April–May. Current main has all 18 plugins at ESLint-10-ready versions (verified 2026-05-14 via `npm view` on each package's peerDeps).

PR #83 specifically bumped: `typescript-eslint` 8.59.1 → 8.59.3, `@tanstack/eslint-plugin-query` 5.100.9 → 5.100.10, `@next/eslint-plugin-next` 16.2.4 → 16.2.6, `eslint-plugin-turbo` 2.9.8 → 2.9.12, plus `knip` and `@astrojs/starlight`. The `eslint-plugin-react-hooks 7.1.1` and `@vitest/eslint-plugin 1.6.17` bumps landed via earlier PRs (notably #66).

Remaining Phase 2 action: confirm `eslint-plugin-jsx-a11y` peerDep override is wired up (it's still at 6.10.2 with peerDeps capped at `^9`, but per ticket the rules work at runtime).

### Impact analysis if we bump to ESLint 10 anyway (rejected)

Verified via PR #3979 diff + reading safeword's `recommended-react.ts` preset:

- **`eslint-plugin-react` failure mode:** hard crash at rule load. `lib/util/version.js` calls removed `context.getFilename()`. Most rules become unusable. Losing 7 error-severity LLM-targeting rules safeword ships (`jsx-key`, `jsx-no-duplicate-props`, `no-direct-mutation-state`, `no-children-prop`, `jsx-no-target-blank` security autofix, `no-unknown-property` `class→className` autofix, `no-unescaped-entities` XSS prevention).
- **`eslint-plugin-jsx-a11y` failure mode:** soft. peerDep warning at install only; rules work at runtime. Negligible impact.
- **Migration tools:** `eslint-transforms` codemod (rewrites source) and `@eslint/compat` 2.1.0 (`fixupRule()` / `fixupPluginRules()` / `fixupConfigRules()` wrappers) exist. Compat's README says "fixes the most common issues but can't fix everything" and doesn't enumerate which RuleContext methods it patches. Source-level audit needed to confirm whether `fixupRule()` would make `eslint-plugin-react@7.37.5` work under ESLint 10 — untested. Probably worth a 30-min spike before assuming "no compat shim available."
- **Concrete crash surface in 7.37.5:** `lib/util/eslint.js` wrapper provides fallbacks for `getSourceCode`/`getAncestors`/`getScope`/`markVariableAsUsed`/`getFirstTokens`/`getText` — but **NOT `getFilename`**. 9 source files reference removed methods directly: `propTypesSort.js`, `usedPropTypes.js`, `pragma.js`, `makeNoMethodSetStateRule.js`, `version.js`, `Components.js`, `propTypes.js`, `componentUtil.js`, `variable.js`. Breakage is at shared-util level (deep imports), so rule-count failure cascades broadly.

**Conclusion:** Bumping ESLint 10 without `eslint-plugin-react` upstream fix is a regression for safeword's React/Next.js users. Stay on ESLint 9 until upstream chain ships.

### Revised plan

- ~~Phase 1: vendor promise rules~~ → trivial peerDep verification + version bump (the bump may already be in main)
- ~~Phase 2: compat-bump deps~~ → already shipped via dependabot bumps across April–May (multiple PRs, not just #83)
- **Phase 3 (the only remaining work): ESLint 10 install** — blocked on `eslint-plugin-react` upstream, which is itself blocked on `eslint-plugin-import#3227`. Monitor upstream weekly.

## Status refresh 2026-05-18

### Phase 2 was NOT actually done — vitest migration just landed today

The 2026-05-14 claim "Current main has all 18 plugins at ESLint-10-ready versions (verified via `npm view` on each package's peerDeps)" was wrong on one entry. PR #66's announcement listed `@vitest/eslint-plugin 1.6.17` as bumped but the actual diff shows it did not — and the legacy package name `eslint-plugin-vitest@0.5.4` remained in `packages/cli/package.json` and was still being imported in `packages/cli/src/presets/typescript/eslint-configs/vitest.ts`. The `npm view` verification passed because every entry that existed in package.json had a compatible peer range; the audit missed that the package itself was the abandoned name.

**Real-world impact surfaced:** a separate session (2026-05-17, `www` project at `wonderful-bassi-e4f6b7`) hit the `@typescript-eslint/utils@7.18.0` `LegacyESLint` crash during a lint run after a clean `safeword@0.30.3` install on top of pre-existing ESLint 10.0.0. Stack trace verbatim: `TypeError: Class extends value undefined is not a constructor or null at .../@typescript-eslint+utils@7.18.0+.../LegacyESLint.js:12:51`. That session worked around it by downgrading ESLint to 9.39.4. Root cause was in safeword.

**Fixed in commit `b93b696`:** `eslint-plugin-vitest@0.5.4` → `@vitest/eslint-plugin@1.6.17`. Drop-in replacement (same repo `vitest-dev/eslint-plugin-vitest`, rule names unchanged, plugin object key `vitest` unchanged, flat-config registration unchanged). Verified single `@typescript-eslint/utils@8.59.3` resolution across the whole lockfile (was two: 7.18.0 + 8.59.3). 1764/1764 CLI tests pass. Also removed the speculative `@vitest/eslint-plugin` entry from `deprecatedPackages` in `schema.ts` — that line was added in Dec 2025 anticipating this migration, but the import migration never landed, so it was telling customers to uninstall a package safeword never told them to install.

**`peerDependencies.eslint` intentionally left at `^9.22.0`** — not expanded to include `^10.0.0` because `eslint-plugin-react@7.37.5` still crashes on v10 (see Phase 3 below). Honesty over a clean-looking peer range.

### `eslint-plugin-jsx-a11y` empirically verified clean on ESLint 10

The 2026-04-19 ticket entry asserted "all rules work at runtime" but the verification was source-level audit only. Done empirically today: downloaded `eslint-plugin-jsx-a11y@6.10.2` tarball from npm, grepped all 184 `.js` files for any of the seven removed-in-ESLint-10 RuleContext methods (`getFilename`, `getSourceCode`, `getScope`, `getAncestors`, `markVariableAsUsed`, `getDeclaredVariables`, `getFirstTokens`). **Zero matches.** The only `context.*` access is `context.settings`, which is not on the removal list. Confirms the "soft blocker, override peerDep" decision.

### Phase 3 upstream chain unchanged

Re-checked 2026-05-18:

- `eslint-plugin-react` — still 7.37.5 on npm latest (the `next` dist-tag points at `7.8.0-rc.0`, a numerically older 2014-era RC unrelated to ESLint 10 — stale tag, ignore). PR [#3979](https://github.com/jsx-eslint/eslint-plugin-react/pull/3979) **OPEN, last update 2026-05-15** (3 days ago — active but not merged). PR #3972 still open, last update 2026-05-12.
- `eslint-plugin-import#3227` — **OPEN, last update 2026-05-15**.

### Phase 3 runtime floor note

Re-checked 2026-06-15 while replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin` in ticket `71Q4DV-eslint-10-react-plugin-path`: the replacement removes the React plugin blocker, but the production ESLint 10 bump still has a Node runtime implication. `@eslint-react/eslint-plugin@5.9.0` requires Node `>=22.0.0`, which is compatible with Safeword's current `>=22.12` floor. `eslint@10.5.0` itself requires `^20.19.0 || ^22.13.0 || >=24`, so ticket 099 must update `packages/cli/package.json` `engines.node` when it expands `peerDependencies.eslint` to include `^10.0.0`. If Safeword keeps a Node-22-only floor, use `>=22.13`.

### Outdated audit note 2026-06-15

`bun outdated` reports `eslint` as the only outdated root package: current `9.39.4`, latest `10.5.0`. Keep that major bump in this ticket rather than blocking unrelated React-plugin-path PRs once their ESLint 10 compatibility tests pass through the `eslint-v10` alias.

### Genuinely remaining Phase 2 work

- Wire `eslint-plugin-jsx-a11y` peerDep override (still 6.10.2, peer caps at `^9`). Defensive — only matters once Phase 3 lands and ESLint 10 is the install target.

### Full plugin bundle audit (2026-05-18)

Audited all 24 packages safeword ships against npm: latest version, latest-release date, repo activity, archive/deprecation status. None archived, none `npm deprecate`d. The one abandoned plugin (`eslint-plugin-vitest@0.5.4`, last released April 2024) was the cause of this whole thread and is gone as of `b93b696`.

**Watch-list (not action items, but worth a recheck in ~6 months):**

- `eslint-plugin-jsx-a11y@6.10.2` — **19 months since last release** (Oct 2024). Repo not archived; last commit Jan 6, 2026 (dev-dep pins + JSDoc tweaks, no rule work, no v10 prep). ARIA semantics are genuinely stable so the release gap isn't disqualifying, and we've verified empirically that the rules don't touch any removed-in-v10 RuleContext methods. **This is the most "asleep" plugin in safeword's bundle.** If it ever does become a problem, the live alternative is `@eslint-react/eslint-plugin` (jsx-a11y subset).
- `eslint-plugin-react@7.37.5` — release stale (13mo) but **repo is very active** (5 commits in the last week as of 2026-05-18, including ESLint-v10 RuleTester work). Slow to release, not abandoned. Already tracked above as the Phase 3 upstream blocker.

Everything else: active maintenance within 3 months. `eslint-config-prettier` (10mo) and `eslint-import-resolver-typescript` (11mo) are quiet but stable — a pure rule-disabler and a resolver respectively, both genuinely "done."

## Status refresh 2026-06-18 — UNBLOCKED; reframed to an additive minor

### The blocker is gone

Ticket [71Q4DV](../71Q4DV-eslint-10-react-plugin-path/ticket.md) landed on `main` (commit `762be9c3`), replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin@5.9.0`. Safeword no longer depends on `eslint-plugin-react`, so the upstream chain (`eslint-plugin-react` → `eslint-plugin-import` → ESLint 10) that froze this ticket since April no longer gates us. `eslint-plugin-react` is now in `deprecatedPackages` (`schema.ts`), telling customers to uninstall it.

### ESLint 10 is a clean drop-in (empirical)

Ran both majors against the real codebase via the `eslint-v10` alias:

| target                                   | eslint 9.39.4 | eslint 10.5.0   |
| ---------------------------------------- | ------------- | --------------- |
| `eslint src tests` (canonical CI target) | exit 0        | exit 0          |
| `eslint .`                               | 137 problems  | 137 — identical |

The 137 are pre-existing `templates/**` issues present under both majors (not in the CI lint target). ESLint 10 introduces **zero** new problems. All 105 preset/schema tests pass, including the in-process ESLint-10 `Linter` load test.

### Decision: additive minor, not semver-major (supersedes the 2026-04-11 "semver-major" assumption)

The original framing assumed ESLint 10 forces a major because it changes the shipped peer-dependency range. That held only under the abandoned "drop v9, install v10 as the sole version" plan. Revalidation shows safeword's shipped config works under **both** majors, so the honest move is **additive**:

- `peerDependencies.eslint`: `^9.22.0` → **`^9.22.0 || ^10.0.0`**. Widening a peer range forbids nothing and permits more — strictly additive, so this ships as a **minor** (auto-upgradeable, strands no v9 customer). Matches the `typescript-eslint` precedent (`^8.57.0 || ^9.0.0 || ^10.0.0`).
- `engines.node`: **unchanged at `>=22.12`.** ESLint 10's higher Node floor (`^20.19.0 || ^22.13.0 || >=24`) is self-enforced by eslint's own `package.json` when a customer installs v10. Safeword's `engines` can't express "22.13 only if on eslint 10," and a v9 customer doesn't need 22.13 — so the floor stays. Node 20 is EOL as of 2026-04-30, so we do not widen toward eslint's `^20.19.0`.
- `@eslint/js`: **kept at `^9.39.4`** (bundled dependency). Its v9 recommended ruleset is valid under both runtimes; bundling v10's recommended could surface rules a v9 customer's engine lacks.
- **Legacy `.eslintrc` template (`getSafewordEslintConfigLegacy`): kept.** `@eslint/eslintrc`/`FlatCompat` still functions under v10 (per the ESLint 10 migrate guide), and v9 customers with legacy configs still rely on it. Deleting it removes support — belongs in the future major.

The legacy-template deletion, `@eslint/js` bump, and engines bump are all **deferred to the eventual major that drops ESLint 9** — each with a concrete changelog reason then, rather than smuggled into this additive release. Concrete trigger for scheduling that major: **ESLint v9 EOL is 2026-08-06** (per eslint.org/version-support, verified 2026-06-18). Until then v9 is still upstream-maintained and widely deployed, so additive support strands no one; after it, the v9-drop major has a real reason to point at.

### Implemented 2026-06-18 (v0.52.0)

- `packages/cli/package.json`: peer range → `^9.22.0 || ^10.0.0`; version `0.51.0` → `0.52.0`; added `lint:eslint:v10` script (`node ./node_modules/eslint-v10/bin/eslint.js src tests`).
- `marketplace.json`: plugin version → `0.52.0`.
- `.github/workflows/ci.yml`: added a "Lint (ESLint 10 forward-compat)" step running `lint:eslint:v10`, so the dual-major claim is enforced in CI, not just one in-process test. The ticket's history of "verified but actually wasn't" misses (e.g. the 2026-05-18 vitest entry) is exactly why this gate exists.
- `bun.lock`: resynced (only the cli eslint peer-range line changed).

Verified: `eslint src tests` exit 0 under both 9.39.4 and 10.5.0; 105/105 preset+schema tests; DTS build clean; lockfile synced. Full `/verify` (whole suite, scenarios, dep drift) still owed before merge.

### Revised Done-When (additive minor)

- [x] Compatible plugins at ESLint-10-ready versions (dependabot + 71Q4DV)
- [x] `typescript-eslint` supports ESLint 10 (8.61.0)
- [x] All preset configs load without errors under ESLint 10
- [x] `peerDependencies.eslint` includes v10 (`^9.22.0 || ^10.0.0`)
- [x] ESLint 10 lints the CI target clean (dual-major CI gate added)
- [x] Preset + schema tests pass under the change
- [x] `engines.node` decision recorded (intentionally unchanged — see above)
- [ ] Full `/verify` (whole suite, scenarios, dep drift) before merge
- [ ] Merge + minor release (0.52.0)

~~Promise rules vendored~~ — obsolete; `eslint-plugin-promise@7.3.0` supports v10, no vendoring.

### Sequencing

- **7JDZFF** (optional peer-deps, in_progress) also rewrites `packages/cli/package.json` dependency structure and is where ESLint 10's "move plugins from peerDeps to deps" guidance belongs. This ticket lands first (smaller, unblocks the freeze); 7JDZFF rebases on the new peer range.
- **051 / 087** were superseded prior attempts — this additive framing is deliberately narrower than their "replace the version outright" approach.
