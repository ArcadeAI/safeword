---
id: BE7C7B
slug: gate-js-toolchain-by-language
type: task
phase: intake
status: in_progress
created: 2026-06-16T13:07:38.895Z
last_modified: 2026-06-16T13:07:38.895Z
---

# Stop installing JS tooling into non-JS projects

**Goal:** A pure Python/Go/Rust/SQL project should not receive a `package.json`, npm dev-deps, or a TypeScript BDD lane it cannot run.

**Why:** This is the deepest JS-coupling in the product. `ensurePackageJson()` forces a manifest into every repo _before_ language detection, so `languages.javascript` is always true and the JS toolchain installs unconditionally — the per-file language guards become no-ops.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 2-A. Decision-bearing: the current behavior is intentional (ticket 102b). This ticket is to **decide and implement** the policy, not assume it.

## Findings (file:line)

- `src/commands/setup.ts:146-159` — `ensurePackageJson()` writes `package.json` into every project. Comment: _"needs a JS home even in pure Go/Rust/Python repos."_
- `src/commands/setup.ts:460-462` — _"every project is a JS project now"_; `setupJavaScriptProject()` runs unconditionally.
- `schema.ts` `cucumber/*` managed/owned files (`cucumber.mjs`, `steps/world.ts`, `steps/shared.steps.ts`, `features/safeword-lane.feature`) — installed with no language gate; step defs are TypeScript (`tsx/esm`, `@cucumber/cucumber`).
- `src/packs/typescript/files.ts` base packages → `schema.ts` `packages` — `eslint`, `prettier`, `knip`, `dependency-cruiser`, `@cucumber/cucumber`, `tsx`, `@types/node` installed unconditionally.
- `src/packs/typescript/files.ts` generators for `eslint.config.mjs` / `.prettierrc` / `knip.json` guard on `ctx.languages?.javascript`, which is always true post-`ensurePackageJson` → guards never skip.
- `schema.ts` `.jscpd.json` — owned file, no generator/guard at all.

## Acceptance criteria

- [ ] Decide the policy: either (a) gate the JS toolchain + BDD lane on real JS detection, or (b) consciously keep "every project is a JS project" and document it as a stated product stance.
- [ ] If (a): a pure-Python/Go/Rust setup produces no `package.json`, no npm deps, no `eslint.config.mjs`/`.prettierrc`/`knip.json`/`.jscpd.json`, and either a language-appropriate BDD lane or none.
- [ ] Whichever path: the `ctx.languages?.javascript` guards in `typescript/files.ts` actually take effect (no always-true flag).
- [ ] Golden-path tests for a non-JS-only project assert the absence (or presence) of JS artifacts per the chosen policy.

## Decision (revalidation + figure-it-out, 2026-06-16)

**Revalidated:** the JS-ification is **deliberate and documented** — `ARCHITECTURE.md:374` = _"Option A, ticket 102b"_: `safeword setup` puts a minimal `package.json` + the cucumber TS lane (`@cucumber/cucumber` + `tsx`) + the TS toolchain into every project on purpose, so Gherkin acceptance testing works in any language and the lane's `.ts` step files are linted. So this ticket = **trim a deliberate decision**, not decide an open one. Option (b) is already largely satisfied by ARCHITECTURE.md.

**Chosen: B — partial trim** (not full-gate C, which reverses 102b and kills the non-JS acceptance lane; not A, which leaves real noise):

- **Keep** (102b-justified): minimal `package.json`, the cucumber lane (`cucumber.mjs`/`steps`/`.feature`, `@cucumber/cucumber`, `tsx`, `@types/node`), and **eslint + prettier** (they lint the lane's own `.ts` step files) — plus **jscpd** (genuinely multi-language).
- **Gate off for projects with no real JS source**: **`knip`** and **`dependency-cruiser`** — these scan JS **application** code/deps that don't exist in a pure Python/Go/Rust repo. Drop `knip.json`, the `knip` script, the `dependency-cruiser`/`knip` npm deps, and the `.dependency-cruiser.cjs`/`.safeword/depcruise-config.cjs` configs.

**Honest-JS signal (revalidated):** `packageJsonCreated` only exists at first `setup`; on `upgrade` the stub `package.json` is already present, so it can't tell a stubbed non-JS repo from a real one. The TypeScript pack's `detect()` is package.json-only (no source signal). Durable signal instead: **`projectType.hasJsSource`** — real JS/TS source exists outside the lane scaffolding (`steps/`, `features/`, `cucumber.mjs`, the safeword-owned `eslint.config.mjs`/`.prettierrc`) and the usual excludes. Computed in `detectProjectType`, so both `computePackagesToInstall(projectType,…)` and the generators (via `ctx.projectType`) consume it. Stable across setup + upgrade, no config-schema migration.

### Implementation plan

1. `detectProjectType` (`utils/project-detector.ts`): add `hasJsSource` (scan for real JS/TS source, excluding lane scaffolding + standard excludes); add the field to `ProjectType`.
2. `typescript/files.ts`: move `dependency-cruiser` + `knip` from `base` → a conditional key gated on `hasJsSource`; gate the `knip.json` generator and the `knip` script on `ctx.projectType.hasJsSource`.
3. `setup.ts`: skip `buildArchitecture` (depcruise config) when `!projectType.hasJsSource`.
4. `reconcile.ts` `getConditionalPackages`: honor the new `hasJsSource` conditional.
5. Tests (~15 files): update golden-path/setup expectations for python/go/rust — assert knip/dependency-cruiser/depcruise **absent**, lane + eslint **present**; new unit assertion pinning the trim.

### Scope/risk note

This inverts a deliberate, deeply-embedded behavior across the install/reconcile flow and ~15 test files. It is a focused schema-level build (TDD, golden-path updates), not a quick patch — recommend building it as its own session step. Reclassify task→**feature** at build (new install behavior + multiple flows).

## Work Log

- 2026-06-16T13:07:38.895Z Started: Created ticket BE7C7B
