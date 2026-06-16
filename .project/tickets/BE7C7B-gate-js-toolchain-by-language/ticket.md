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

**Why:** This is the deepest JS-coupling in the product. `ensurePackageJson()` forces a manifest into every repo *before* language detection, so `languages.javascript` is always true and the JS toolchain installs unconditionally — the per-file language guards become no-ops.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 2-A. Decision-bearing: the current behavior is intentional (ticket 102b). This ticket is to **decide and implement** the policy, not assume it.

## Findings (file:line)

- `src/commands/setup.ts:146-159` — `ensurePackageJson()` writes `package.json` into every project. Comment: *"needs a JS home even in pure Go/Rust/Python repos."*
- `src/commands/setup.ts:460-462` — *"every project is a JS project now"*; `setupJavaScriptProject()` runs unconditionally.
- `schema.ts` `cucumber/*` managed/owned files (`cucumber.mjs`, `steps/world.ts`, `steps/shared.steps.ts`, `features/safeword-lane.feature`) — installed with no language gate; step defs are TypeScript (`tsx/esm`, `@cucumber/cucumber`).
- `src/packs/typescript/files.ts` base packages → `schema.ts` `packages` — `eslint`, `prettier`, `knip`, `dependency-cruiser`, `@cucumber/cucumber`, `tsx`, `@types/node` installed unconditionally.
- `src/packs/typescript/files.ts` generators for `eslint.config.mjs` / `.prettierrc` / `knip.json` guard on `ctx.languages?.javascript`, which is always true post-`ensurePackageJson` → guards never skip.
- `schema.ts` `.jscpd.json` — owned file, no generator/guard at all.

## Acceptance criteria

- [ ] Decide the policy: either (a) gate the JS toolchain + BDD lane on real JS detection, or (b) consciously keep "every project is a JS project" and document it as a stated product stance.
- [ ] If (a): a pure-Python/Go/Rust setup produces no `package.json`, no npm deps, no `eslint.config.mjs`/`.prettierrc`/`knip.json`/`.jscpd.json`, and either a language-appropriate BDD lane or none.
- [ ] Whichever path: the `ctx.languages?.javascript` guards in `typescript/files.ts` actually take effect (no always-true flag).
- [ ] Golden-path tests for a non-JS-only project assert the absence (or presence) of JS artifacts per the chosen policy.

## Work Log

- 2026-06-16T13:07:38.895Z Started: Created ticket BE7C7B
