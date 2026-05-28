---
id: 7JDZFF
slug: eslint-plugins-as-peer-deps
type: feature
phase: intake
status: in_progress
created: 2026-05-26T18:24:00.000Z
last_modified: 2026-05-26T18:24:00.000Z
scope:
  - Move stack-specific ESLint plugins from `dependencies` to `peerDependencies` + `peerDependenciesMeta.<name>.optional: true` in `packages/cli/package.json`. Initial candidates: `eslint-plugin-storybook`, `eslint-plugin-turbo`, `eslint-plugin-astro`, `eslint-plugin-playwright`, `@tanstack/eslint-plugin-query`, `eslint-plugin-better-tailwindcss`, `@next/eslint-plugin-next`.
  - Universal plugins stay as direct deps. Keep `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import-x`, `typescript-eslint`, `eslint-plugin-jsdoc`, `eslint-plugin-unicorn`, `eslint-plugin-security`, `eslint-plugin-sonarjs`, `eslint-plugin-promise`, `eslint-plugin-simple-import-sort`, `eslint-plugin-regexp`, `eslint-plugin-jsx-a11y`, `@vitest/eslint-plugin`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-import-resolver-typescript`, `eslint-config-prettier`, `@eslint/js` as direct deps — they apply broadly enough that lazy-loading them adds complexity without freeing measurable disk.
  - Convert affected configs (`storybook.ts`, `turbo.ts`, `astro.ts`, `playwright.ts`, `tanstack-query.ts`, `tailwind.ts`, `recommended-nextjs.ts`) from static `import` at top-of-file to lazy loaders (async getter or deferred import). The `eslintPlugin.configs` map exposes each as a getter, not a property, so importing `safeword` doesn't trigger module resolution for plugins the customer doesn't use.
  - Update setup's stack detection (`packages/cli/src/utils/project-detector.ts` + `packages/cli/src/packs/typescript/files.ts`) to inspect customer's `package.json` for stack markers (`storybook` / `@storybook/*` → install `eslint-plugin-storybook`; `turbo` → `eslint-plugin-turbo`; etc.) and add the matching plugins to the customer's devDeps via the existing `installDependencies` flow.
  - Add a runtime guard: if a customer references a config whose plugin isn't installed (e.g., manually wires `safeword.configs.storybook` without having storybook installed), throw a clear error pointing to the install command — modeled on antfu's `ensurePackages()`. Don't auto-install at lint time; setup is the canonical install path.
  - Tests: `tests/integration/peer-deps-storybook.test.ts` (storybook customer gets plugin installed); `tests/integration/peer-deps-no-storybook.test.ts` (backend-only customer gets zero unused stack plugins); `tests/unit/lazy-config-loading.test.ts` (importing safeword doesn't resolve eslint-plugin-storybook).
  - Migration doc + CHANGELOG entry calling out the breaking change. Bump to v1.0.0 (if other 1.0-prep work bundles) or v0.38.0 with explicit major-style notification (per safeword's pre-1.0 strict-semver policy).
out_of_scope:
  - Restructuring how the customer's `eslint.config.mjs` looks. Their import line (`import safeword from 'safeword/eslint'` or similar) stays the same — only the internals of how `safeword.configs.X` is populated change.
  - Moving universal plugins to peer-deps. The marginal disk savings don't justify the migration complexity for plugins every safeword customer would install anyway.
  - Auto-install at lint time. Antfu prompts interactively; safeword's CI-friendly position is "setup installs everything, lint never installs." Runtime guard throws a clear error instead.
  - Telemetry on actual customer install-size pain. Tempting but separate scope — and we're confident from antfu's precedent that the architecture is correct even without our own data.
  - The original "storybook plugin install bug" from this session's investigation. That premise didn't hold up — it was a harness-created-worktree-without-bun-install artifact, not a safeword bug. See `feat/storybook-eager-import` branch (closed unmerged) for the investigation trail.
done_when:
  - Customer installing safeword into a backend-only Node service ends up with zero of {storybook, turbo, astro, playwright, tanstack-query, better-tailwindcss, next} ESLint plugins in their `node_modules`. Verified by a fresh-install integration test against a fixture project.
  - Customer with `storybook` in their `package.json` running `safeword setup` ends up with `eslint-plugin-storybook` in their devDeps AND a working storybook config. Verified by integration test.
  - `import safeword from 'safeword/eslint'` (or current entry path) does not trigger Node module resolution for stack-specific plugins. Verified by a unit test that hooks `Module._resolveFilename` or uses `import.meta.resolve` checks.
  - Customer who manually invokes `safeword.configs.storybook` without `eslint-plugin-storybook` installed gets a clear, actionable error pointing to the install command. No silent failure, no generic "Cannot find module" stack trace.
  - Full test suite green, including the existing setup / integration / preset tests; no behavior regression for customers whose stack matches the detection rules.
  - Migration doc lives at `packages/website/src/content/docs/migrations/v1-eslint-peer-deps.md` (or equivalent path), linked from CHANGELOG.
  - safeword's own repo dogfooded: safeword's dev deps shrink (we don't use Storybook ourselves), and `bun run lint` still passes.
  - `bunx knip` reports zero "unused dependency" false-positives for the 7 stack-specific plugins (next, tanstack-query, astro, better-tailwindcss, playwright, storybook, turbo) after the peer-dep migration. Optional peer-deps aren't flagged by knip as unused, so this should hold without any `ignoreDependencies` entries. Closes the concern from superseded ticket G8PBE6.
---

# Move stack-specific ESLint plugins to optional peer-deps (antfu pattern)

**Goal:** Customers install only the ESLint plugins their stack actually uses. Backend-only Node services stop carrying `eslint-plugin-storybook`, `eslint-plugin-turbo`, `eslint-plugin-astro`, etc. as transitive deps. Matches the modern modular flat-ESLint-config convention (antfu/eslint-config, eslint-config-canonical).

**Why:** Surfaced via /figure-it-out on 2026-05-26 while investigating a non-bug (the original "storybook plugin install" report turned out to be a harness-created-worktree-without-`bun install` artifact). The real architectural question: safeword's `packages/cli/package.json` lists 24 ESLint plugins as direct `dependencies`, including 6-7 stack-specific ones (Storybook, Turbo, Astro, Playwright, TanStack Query, Tailwind, Next.js). Every customer pays for the union of all stacks regardless of which they use. Estimated bloat: 50-100MB of unused `node_modules`, plus install-time penalty.

The standard pattern in the ecosystem is optional peer-deps + auto-detect during setup + lazy-load configs. Antfu's eslint-config uses this exact shape (verified via web research 2026-05-26). Bun v1.0.7+ supports `peerDependenciesMeta.optional: true` correctly; npm and pnpm have supported it for years.

## Context anchor

- All-plugins-as-direct-deps: [packages/cli/package.json](packages/cli/package.json) `dependencies` block (24 ESLint plugins listed).
- Eager imports of all configs: [packages/cli/src/presets/typescript/index.ts:30-42](packages/cli/src/presets/typescript/index.ts:30-42). Configs imported with static `import`, exposed via `eslintPlugin.configs.<name>`.
- Eager plugin imports inside config files: [packages/cli/src/presets/typescript/eslint-configs/storybook.ts:13](packages/cli/src/presets/typescript/eslint-configs/storybook.ts:13) (and equivalents in `turbo.ts`, `astro.ts`, `playwright.ts`, `tanstack-query.ts`, `tailwind.ts`, `recommended-nextjs.ts`).
- Existing stack detection (limited): [packages/cli/src/packs/typescript/files.ts:36](packages/cli/src/packs/typescript/files.ts:36) — already checks for `storybook` / `@storybook/react` in customer deps for `.storybook/` ignore patterns. The auto-install detection lives in setup; needs extending.

## Prior art

- [antfu/eslint-config](https://github.com/antfu/eslint-config) — canonical modular flat-config preset. Framework plugins as optional peer-deps. `ensurePackages()` utility prompts to install missing plugins when a framework config is explicitly enabled. Mix of auto-detection (Vue auto-enables) and opt-in (other frameworks).
- [Bun v1.0.7 release notes](https://bun.com/blog/bun-v1.0.7) — confirmed correct `peerDependenciesMeta.optional` handling.

## Design sketch

Three changes, in order:

1. **Lazy config loading.** Convert `eslintPlugin.configs` from a plain object to a Proxy or getter-based map. `eslintPlugin.configs.storybook` does `await import('eslint-plugin-storybook')` on first access, with a try/catch that throws an actionable error if the plugin isn't resolvable. Universal configs (`recommendedTypeScript`, `recommendedTypeScriptReact`) load eagerly as today.

2. **Setup auto-detect + install.** Extend `project-detector.ts` (or wherever stack detection lives) with predicates for each stack-specific plugin: `hasStorybook(pkg)`, `hasTurbo(pkg)`, etc. During `setupJavaScriptProject`, collect matching plugins into the `packagesToInstall` list that already flows into `installDependencies`. Output a clear "Detected: Storybook → adding `eslint-plugin-storybook` to your devDeps" line per the 2GPM47 pattern.

3. **Runtime guard.** Each lazy config wraps its import in `ensurePlugin(name)`:

   ```ts
   async function ensurePlugin<T>(name: string): Promise<T> {
     try {
       return (await import(name)) as T;
     } catch {
       throw new Error(
         `safeword: ESLint plugin "${name}" is not installed. ` +
           `Run \`bun add -d ${name}\` or re-run \`safeword setup\` to auto-install ` +
           `based on your detected stack.`,
       );
     }
   }
   ```

## Migration story

Existing customers upgrading to this version: their lint config breaks if they rely on a stack-specific config that's no longer transitively installed. Mitigation paths:

- **Auto-detection at setup re-run.** If customer re-runs `safeword setup` after upgrade, their package.json is inspected and matching plugins are installed.
- **Auto-upgrade hint.** First lint failure post-upgrade emits the actionable error from `ensurePlugin()` naming exactly which plugin to install.
- **Migration doc.** Step-by-step: "If your project uses Storybook/Turbo/etc., run `safeword setup` again or `bun add -d eslint-plugin-X`."

This is **major-bump territory** per safeword's strict-semver policy. Either bundle with other 1.0-prep work for a v1.0.0 release, or ship as v0.38.0 with explicit "manual upgrade required" notification (since 0.x minors auto-apply, a breaking change can't be a minor).

## Open questions (deferred, not blocking intake)

- **Q1:** Bundle with v1.0.0 release, or ship as standalone v0.38.0 with major-style upgrade UX? Depends on other 1.0-prep tickets in flight.
- **Q2:** Should runtime guard auto-prompt to install in interactive contexts (TTY detected)? Antfu does. Leaning no for safeword to keep CI behavior simple — let setup own all installs.
- **Q3:** Are there safeword customers on shared monorepo node_modules where a sibling package's deps already provide the plugins? If so, the lazy loader's `import()` will succeed and they get correct behavior for free. No mitigation needed.

## Work Log

- 2026-05-26T18:24:00Z Created ticket 7JDZFF as feature-level deferred work. Investigation trail lives at `feat/storybook-eager-import` worktree (no PR opened — closed as no-bug after /figure-it-out concluded the original premise was wrong). Architecture decision documented above. Phase: intake — scope/out-of-scope/done-when bounded, prior art cited, design sketch committed, migration story drafted, three open questions captured as non-blocking.
