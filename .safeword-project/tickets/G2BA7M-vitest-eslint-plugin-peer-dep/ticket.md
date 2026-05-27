---
id: G2BA7M
slug: vitest-eslint-plugin-peer-dep
type: patch
phase: intake
status: in_progress
created: 2026-05-27T11:44:58.292Z
last_modified: 2026-05-27T11:44:58.292Z
scope: |
  Install or otherwise resolve the missing `@vitest/eslint-plugin` peer-dependency
  in `packages/cli` so that two currently-broken paths work again:
    1. `bun run build` completes its DTS (TypeScript declaration) phase. Today
       it fails with `Cannot find module '@vitest/eslint-plugin'` because
       `packages/cli/src/presets/typescript/eslint-configs/vitest.ts:10` imports
       the plugin to define a vitest-aware ESLint preset for downstream
       consumers. The ESM build succeeds; only DTS fails.
    2. `bun run lint` (or `npx eslint`) loads the ESLint config without
       erroring. Today it fails with the same Cannot-find-module error chain
       because the eslint config transitively imports the vitest preset.

  The fix is to make `@vitest/eslint-plugin` resolvable from `packages/cli` —
  most likely as a direct dev-dep entry in `packages/cli/package.json`, but
  whoever takes this should first check whether the project's design intends
  it as a peer-dep that consumers install (in which case the fix is to
  conditionally import / lazy-load it, mirroring H150ZW's pattern for the
  seven other stack-specific plugins).

  Decide which of those two is the correct architectural answer before
  installing — both are valid, and the choice should follow whatever
  precedent exists for the other ESLint configs in
  `packages/cli/src/presets/typescript/eslint-configs/`.
out_of_scope: |
  - Reverting H150ZW's lazy-load pattern for the other seven plugins.
  - Migrating off Vitest, restructuring the ESLint config, or changing
    how presets are exposed to consumers.
  - Fixing the seven knip false-positives that are also flagged on the
    H150ZW plugins (that's [G8PBE6-knip-dynamic-load-false-positives](../G8PBE6-knip-dynamic-load-false-positives/ticket.md)).
  - Bumping unrelated dependencies.
  - Suppressing the DTS error with `--skip-peer` or similar — the root cause
    needs fixing, not hiding.
done_when: |
  - `bun run build` completes both ESM and DTS phases successfully on a
    clean install (`bun install` from scratch in a fresh worktree).
  - `bun run lint` (or `npx eslint` from `packages/cli/`) loads its config
    and runs without `Cannot find module '@vitest/eslint-plugin'`.
  - A short note in the ticket work log records the architectural decision
    (direct dev-dep vs lazy-load like H150ZW) and why.
  - Version pinned to match the project's Vitest major (currently 4.x per
    the test output) — confirm against the plugin's peer-dep declarations.
  - No regressions in the existing test suite.
---

# Install missing @vitest/eslint-plugin peer-dep

**Goal:** Make `@vitest/eslint-plugin` resolvable from `packages/cli` so both the DTS build and the full ESLint config load work again.

**Why:** Two real developer flows are currently broken: anyone trying to run the type-definition build (e.g. for npm publishing) or lint the codebase hits the same missing-peer-dep wall. The bug was surfaced during F14BG2/QSNKBB's verify pass — the SAFEWORD session-start hook even warned about it at session open ("⚠️ ESLint config not found - run 'bun run lint' may fail"). Pre-existing, not introduced by recent work.

## Repro

From the worktree root:

```
cd packages/cli
bun run build  # DTS phase fails with: Cannot find module '@vitest/eslint-plugin'
npx eslint .   # config load fails with the same error chain
```

Failure trace points at [packages/cli/src/presets/typescript/eslint-configs/vitest.ts:10](../../../packages/cli/src/presets/typescript/eslint-configs/vitest.ts) which does `import vitest from '@vitest/eslint-plugin'`.

## Open questions for the implementer

- Is the vitest preset supposed to be available unconditionally (direct dev-dep) or only when the consumer's project actually uses Vitest (lazy via `createRequire`, like H150ZW did for the seven other stack-specific plugins)?
- If lazy-load is the right answer, does it need the same `ignoreDependencies` entry in knip config that [G8PBE6](../G8PBE6-knip-dynamic-load-false-positives/ticket.md) is investigating?

## Work Log

- 2026-05-27T11:44:58Z Started: Created ticket G2BA7M after F14BG2/QSNKBB verify pass surfaced this as a pre-existing blocker on lint + DTS build. Bounded scope (one decision: direct dep vs lazy-load; one install; verification). Sized patch.
