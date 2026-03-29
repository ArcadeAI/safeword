---
id: '084'
slug: weak-test-assertions
title: 'Fix 7 no-op test assertions that can never fail'
type: Improvement
status: open
---

# Task: Fix 7 no-op test assertions that can never fail

**Type:** Improvement

**Scope:** Fix 7 assertions across 5 test files that are effectively no-ops — they pass regardless of behavior. Leave the 35 legitimate `toBeDefined()` existence checks alone, and the 9 borderline script-exists checks.

**Out of Scope:** Replacing all `toBeDefined()` with exact values, adding new test coverage, refactoring test structure. The original audit flagged 63 "weak assertions" but investigation revealed only 7 are actually problematic.

**Context:** The audit counted `toBeTruthy` + `toBeDefined` + `not.toThrow` together. Deeper analysis shows:

- Zero `toBeTruthy()`/`toBeFalsy()` in test files (only in docs)
- 35 `toBeDefined()` checking config key/hook/server existence — legitimate, leave alone
- 9 `toBeDefined()` checking script existence — borderline, leave alone
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

## Files

- `packages/cli/tests/commands/reset.test.ts`
- `packages/cli/tests/commands/setup-noninteractive.test.ts`
- `packages/cli/tests/commands/self-healing.test.ts`
- `packages/cli/tests/integration/golden-path.test.ts`
- `packages/cli/tests/integration/mixed-project.test.ts`
- `packages/cli/tests/integration/mixed-project-golang.test.ts`

**Done When:**

- [ ] 3 exit code assertions replaced with `toBe(0)` or specific code
- [ ] 4 result assertions replaced with content checks
- [ ] All tests still pass
