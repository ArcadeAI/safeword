---
id: 064
type: task
phase: done
status: done
created: 2026-03-28T15:22:00Z
last_modified: 2026-03-28T15:22:00Z
---

# Separate dogfood parity check from main test suite

**Goal:** Move the dogfood parity test out of `vitest run` so the main suite stays green during template iteration.

**Why:** The byte-for-byte parity check in `schema.test.ts` fails whenever a dogfood file diverges from its canonical template, poisoning test signal from 1,323 other tests during normal development.

## Context

The dogfood parity test (`packages/cli/tests/schema.test.ts:162`) compares 80+ files between `packages/cli/templates/` and the repo root. Any divergence = instant failure. This is valuable for release integrity but brittle during development — you can't iterate on a dogfood file without breaking the entire suite.

### Options Considered

| Approach                                       | Verdict                       |
| ---------------------------------------------- | ----------------------------- |
| A. `it.skipIf(!process.env.CI)`                | Loses local signal entirely   |
| B. **Separate `test:release` script**          | Clean split, CI catches drift |
| C. Env var allow-list (`DOGFOOD_SKIP=lint.md`) | Clunky, easy to forget        |
| D. Warn instead of fail                        | Defeats the purpose           |
| E. Keep as-is                                  | Accepts the workflow tax      |

**Decision: Option B** — separate `test:release` script.

### Implementation Plan

Follow the existing `*.slow.test.ts` precedent:

1. Extract the `dogfood parity` describe block from `schema.test.ts` into `tests/dogfood-parity.release.test.ts`
2. Add `'tests/**/*.release.test.ts'` to the exclude list in `vitest.config.ts`
3. Create `vitest.release.config.ts` (mirrors `vitest.slow.config.ts`) that includes only `*.release.test.ts`
4. Add `"test:release": "vitest run --config vitest.release.config.ts"` to `package.json`
5. Verify: `bun run test` passes with dogfood divergence, `bun run test:release` catches it

### Files

- `packages/cli/tests/schema.test.ts` — remove dogfood parity block
- `packages/cli/tests/dogfood-parity.release.test.ts` — new file, extracted parity test
- `packages/cli/vitest.release.config.ts` — new config for release-gate tests
- `packages/cli/vitest.config.ts` — add `*.release.test.ts` to exclude
- `packages/cli/package.json` — add `test:release` script

## Work Log

---

- 2026-03-28T15:22:00Z Created: Ticket from analysis of failing dogfood parity test

---
