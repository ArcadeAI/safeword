---
id: 026
type: task
phase: done
status: done
created: 2026-03-01T00:00:00Z
last_modified: 2026-03-01T00:00:00Z
---

# Extract shared vitest base config

**Goal:** Eliminate ~75% duplication between vitest.config.ts and vitest.slow.config.ts by extracting shared settings into a base config.

**Why:** Both configs duplicate env.PATH, pool, hookTimeout, maxWorkers, globals, and environment. Changes to shared settings require editing two files.

## Files

- `packages/cli/vitest.config.ts` (default test run)
- `packages/cli/vitest.slow.config.ts` (slow integration tests)

## Approach

Extract shared test options into a `vitest.base.ts` module. Both configs import and spread it, overriding only what differs (include/exclude, testTimeout).

## Work Log

- 2026-03-01T00:00:00Z Complete: Extracted vitest.base.ts, both configs now spread shared settings (refs: 8b77fc8)
