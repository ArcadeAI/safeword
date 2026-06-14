---
id: '093'
slug: unused-sonarjs-disable
title: 'Remove unused sonarjs/code-eval disable directive'
type: Bug
status: done
---

# Task: Remove unused sonarjs/code-eval disable directive

**Type:** Bug

**Scope:** One test file has an `eslint-disable-next-line sonarjs/code-eval` that no longer triggers. ESLint flags it as unused.

**Out of Scope:** Investigating sonarjs v4 rule changes broadly.

**Root Cause:** The directive was added in `51fa3be` to suppress a false positive on `expect(eslintConfig).toContain('javascript: configs.recommended')`. After the sonarjs v3→v4 bump (`fe16d58`), the rule still exists but no longer fires on this pattern — likely a fix in sonarjs v4's heuristics for string assertions. The disable is now dead.

**Fix:** Delete the `eslint-disable-next-line sonarjs/code-eval` comment on line 85.

## Files

- `packages/cli/tests/integration/conditional-setup.test.ts:85`

**Done When:**

- [ ] Unused disable directive removed
- [ ] `bun run lint` passes with 0 errors on this file
