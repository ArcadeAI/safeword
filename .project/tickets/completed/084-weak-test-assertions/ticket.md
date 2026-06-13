---
id: '084'
slug: weak-test-assertions
title: 'Fix 8 no-op test assertions that can never fail'
type: Improvement
status: done
---

# Task: Fix 7 no-op test assertions that can never fail

**Type:** Improvement

**Scope:** Fix 8 assertions across 6 test files that are effectively no-ops — they pass regardless of behavior. Leave the 35 legitimate `toBeDefined()` existence checks and the 8 script-exists checks alone.

**Out of Scope:** Replacing all `toBeDefined()` with exact values, adding ESLint rules (too blunt — `no-restricted-matchers` would flag 35 legitimate uses), adding new test coverage. The original audit flagged 63 "weak assertions" but investigation revealed only 8 are actually problematic.

**Context:** The audit counted `toBeTruthy` + `toBeDefined` + `not.toThrow` together. Deeper analysis shows:

- Zero `toBeTruthy()`/`toBeFalsy()` in test files (only in docs)
- 35 `toBeDefined()` checking config key/hook/server existence — legitimate, leave alone
- 8 `toBeDefined()` checking script existence — legitimate (tests contract, not implementation)
- 1 `toBeDefined()` redundant with stronger assertion on next line
- **3 `expect(result.exitCode).toBeDefined()`** — no-op, exit codes are always defined
- **4 `expect(result).toBeDefined()`** — no-op, `execSync` throws on failure so result is always defined

## Fix

**`expect(result.exitCode).toBeDefined()` → `toBe(0)` (3 files):**

- `tests/commands/reset.test.ts:72`
- `tests/commands/setup-noninteractive.test.ts:64`
- `tests/commands/self-healing.test.ts:80`

**`expect(result).toBeDefined()` → assert output content (4 files):**

- `tests/integration/golden-path.test.ts:55,152`
- `tests/integration/mixed-project.test.ts:100`
- `tests/integration/mixed-project-golang.test.ts:115`

These run `execSync` which throws on non-zero exit. The result is always defined. Replace with assertion on output content (e.g., check stdout contains expected text).

**Redundant assertion (1 file):**

- `tests/commands/setup-linting.test.ts:159` — `toBeDefined()` immediately followed by `toContain('prettier')` on the same value. Delete the redundant line.

## Files

- `packages/cli/tests/commands/reset.test.ts`
- `packages/cli/tests/commands/setup-noninteractive.test.ts`
- `packages/cli/tests/commands/self-healing.test.ts`
- `packages/cli/tests/commands/setup-linting.test.ts`
- `packages/cli/tests/integration/golden-path.test.ts`
- `packages/cli/tests/integration/mixed-project.test.ts`
- `packages/cli/tests/integration/mixed-project-golang.test.ts`

## Why No ESLint Rule

`vitest/no-restricted-matchers` is a blanket ban per matcher name — can't scope it to "only flag `toBeDefined` on exit codes." Would create 35 false positives on legitimate existence checks. The 8 no-ops are a one-time cleanup, not a recurring pattern worth a rule for.

**Done When:**

- [ ] 3 exit code assertions replaced with `toBe(0)` or specific code
- [ ] 4 result assertions replaced with content checks
- [ ] 1 redundant assertion deleted
- [ ] All tests still pass
