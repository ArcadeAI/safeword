---
id: H150ZW
slug: lazy-load-stack-eslint-configs
type: task
phase: done
status: done
created: 2026-05-26T18:34:00.000Z
last_modified: 2026-05-26T18:45:00.000Z
scope:
  - Convert eager top-level `import` of stack-specific ESLint plugins to `createRequire`-based lazy loads inside factory functions. Affects 7 config files: `storybook.ts`, `turbo.ts`, `astro.ts`, `playwright.ts`, `tanstack-query.ts`, `tailwind.ts`, `recommended-nextjs.ts`.
  - Expose each config in `eslintPlugin.configs` via a getter that calls the factory on first access and caches the result.
  - Keep the named re-exports (`storybookConfig`, `turboConfig`, etc.) at index.ts working — back them with the same lazy-factory machinery so customers importing them by name don't regress, but also don't pay load cost if they only use `configs.X`.
  - Add a unit test that asserts `import { eslintPlugin } from '../src/presets/typescript/index.js'` does NOT cause Node to load `eslint-plugin-storybook` (or the other 6 stack-specific plugins) into the module cache. Verifies the lazy load is real.
  - Add behavioral tests confirming accessing `configs.storybook` (after import) returns the same array shape and rule names as before — no semantic regression.
  - Universal plugins (react, react-hooks, typescript-eslint, jsdoc, unicorn, security, sonarjs, import-x, jsx-a11y, vitest, simple-import-sort, regexp, promise, eslint-comments) stay as eager imports. Lazy-loading them adds complexity without freeing measurable cost — every customer loads them anyway.
out_of_scope:
  - Moving any plugin from `dependencies` to `peerDependencies`. That's [ticket 7JDZFF](.safeword-project/tickets/7JDZFF/ticket.md)'s job — it's a breaking change, this is not.
  - Stack-detection-driven install of plugins. Plugins remain in `dependencies` and are always installed for every customer.
  - Touching customer-facing APIs. Customer's generated `eslint.config.mjs` continues to use `configs.X` exactly as today; the only change is when the underlying plugin module loads.
  - Telemetry. We're shipping based on principle (avoid loading unused modules) not measured pain.
done_when:
  - `bun run test` passes the full suite (or at least the targeted preset + integration tests pass; pre-existing storybook-plugin-related integration test failures from `bun install` issues remain pre-existing).
  - New unit test proves `eslint-plugin-storybook` is NOT in `require.cache` after `import { eslintPlugin } from '...'` and remains absent until `configs.storybook` is explicitly accessed.
  - New behavioral test confirms `configs.storybook` returns an array containing the expected rules (no shape regression).
  - safeword's own `bun run lint` still passes (sanity check that lazy loading doesn't break the dogfood eslint config).
  - Minor version bump (0.37.0 → 0.38.0). Non-breaking; customer-visible behavior unchanged.
---

# Lazy-load stack-specific ESLint plugins via createRequire

**Goal:** Stop loading 7 stack-specific ESLint plugins (~7 × ~20ms each = ~140ms saved) into Node memory on every ESLint invocation for customers whose stack doesn't include them. The customer's generated `eslint.config.mjs` already gates plugin _usage_ with `detect.hasStorybook(deps)` etc.; this ticket gates plugin _loading_ to match.

**Why:** Surfaced via /figure-it-out on 2026-05-26 while weighing whether to remove Storybook support or ship the full peer-deps migration (ticket 7JDZFF). Investigation found:

- Customer's generated eslint.config.mjs already conditionally spreads stack configs: `...(detect.hasStorybook(deps) ? configs.storybook : [])` ([config.ts:71-72](packages/cli/src/templates/config.ts:71-72)).
- But the eager top-level `import` of `storybookConfig` in [index.ts:37](packages/cli/src/presets/typescript/index.ts:37) causes `eslint-plugin-storybook` to load into Node memory regardless of whether the customer uses Storybook.
- Removing Storybook support is unsafe — it's actively advertised in [README.md:262](README.md:262) and [docs](packages/website/src/content/docs/reference/configuration.mdx:38), and has been published for 4.5 months across 3,205 monthly downloads.
- Full peer-deps migration ([ticket 7JDZFF](.safeword-project/tickets/7JDZFF/ticket.md)) is feature-sized and breaking, deferred.
- This ticket (H150ZW) captures the non-breaking startup-perf win in isolation.

## Context anchor

- Eager imports in index.ts: [packages/cli/src/presets/typescript/index.ts:30-42](packages/cli/src/presets/typescript/index.ts:30-42)
- Configs object construction: [packages/cli/src/presets/typescript/index.ts:89-104](packages/cli/src/presets/typescript/index.ts:89-104)
- Named re-exports: [packages/cli/src/presets/typescript/index.ts:118-122](packages/cli/src/presets/typescript/index.ts:118-122) (approx)
- Per-config eager plugin imports:
  - [storybook.ts:13](packages/cli/src/presets/typescript/eslint-configs/storybook.ts:13) — `import storybookPlugin from 'eslint-plugin-storybook'`
  - [turbo.ts:12](packages/cli/src/presets/typescript/eslint-configs/turbo.ts:12)
  - [astro.ts:10](packages/cli/src/presets/typescript/eslint-configs/astro.ts:10)
  - [playwright.ts:15](packages/cli/src/presets/typescript/eslint-configs/playwright.ts:15)
  - [tanstack-query.ts](packages/cli/src/presets/typescript/eslint-configs/tanstack-query.ts)
  - [tailwind.ts](packages/cli/src/presets/typescript/eslint-configs/tailwind.ts)
  - [recommended-nextjs.ts](packages/cli/src/presets/typescript/eslint-configs/recommended-nextjs.ts)

## Implementation sketch

Each stack config file gets the same shape transformation:

```ts
// Before — eager
import storybookPlugin from 'eslint-plugin-storybook';
export const storybookConfig: any[] = [...storybookPlugin.configs['flat/recommended'], ...];
```

```ts
// After — lazy via createRequire
import { createRequire } from 'node:module';
const requireFromHere = createRequire(import.meta.url);

let cached: any[] | undefined;
function buildStorybookConfig(): any[] {
  const storybookPlugin = requireFromHere('eslint-plugin-storybook');
  return [...storybookPlugin.configs['flat/recommended'], ...];
}
export const storybookConfig: any[] = new Proxy([], {
  get(_target, prop) { cached ??= buildStorybookConfig(); return cached[prop as any]; },
  has(_target, prop) { cached ??= buildStorybookConfig(); return prop in cached; },
  ownKeys() { cached ??= buildStorybookConfig(); return Object.keys(cached); },
  getOwnPropertyDescriptor(_target, prop) { cached ??= buildStorybookConfig(); return Object.getOwnPropertyDescriptor(cached, prop); },
});
```

Proxy wrapper preserves the named export API (`storybookConfig` is still an array-like with spreadable semantics) while deferring the plugin load until first access. `index.ts` `configs` object stays the same shape (just spreads the proxy-backed export).

Alternative: switch `eslintPlugin.configs` to a plain getter map. Less surface change but doesn't help the named re-exports.

Choosing Proxy for both reach (named export + configs access both lazy) and minimum diff at the consumer site.

## Risk + verification

- Plugin output that holds non-spreadable behavior (e.g., one of the plugins exports a Promise or async config) → Proxy traps would need to forward more. ESLint flat configs are sync arrays, so this should be fine.
- TypeScript types on the Proxy — the cast to `any[]` already exists in the original code, so type compatibility is preserved.
- Verification: a unit test inspecting `require.cache` (or hooking `Module._load`) after import.

## Work Log

- 2026-05-26T18:34:00Z Created ticket H150ZW. Decided via /figure-it-out: ship the lazy-load portion as a non-breaking task today; defer the peer-deps migration (7JDZFF) until urgency or 1.0-prep justifies it. Phase: intake — scope/out-of-scope/done-when bounded.
