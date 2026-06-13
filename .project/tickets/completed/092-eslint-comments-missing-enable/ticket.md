---
id: '092'
slug: eslint-comments-missing-enable
title: 'Fix eslint-comments/disable-enable-pair errors in hierarchy tests'
type: Bug
status: done
---

# Task: Fix eslint-comments/disable-enable-pair errors in hierarchy tests

**Type:** Bug

**Scope:** Two test files use file-wide `/* eslint-disable unicorn/no-null */` without a matching `eslint-enable`. The `eslint-comments/disable-enable-pair` rule (added in `dce1521`) now flags these.

**Out of Scope:** Removing the `unicorn/no-null` disable — these tests legitimately use `null` in ticket frontmatter.

**Root Cause:** The disables are intentionally file-wide (every test in the file creates tickets with `null` values). The new `eslint-comments` governance requires paired enable directives.

**Fix options:**

1. Add `/* eslint-enable unicorn/no-null */` at end of file
2. Switch to inline disables per-line (verbose — many lines use null)
3. Add `allowWholeFile: true` to the rule config for test files

Option 1 is simplest and correct.

## Files

- `packages/cli/tests/hooks/hierarchy.test.ts:26`
- `packages/cli/tests/integration/hierarchy-navigation.test.ts:28`

**Done When:**

- [ ] Both files have matching `eslint-enable` directives
- [ ] `bun run lint` passes with 0 errors on these files
