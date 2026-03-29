---
id: 086
type: task
phase: intake
status: backlog
created: 2026-03-29T17:11:00Z
last_modified: 2026-03-29T17:11:00Z
---

# Suppression Scope Enforcement Across All Checkers

**Goal:** Enforce narrowest-scope suppressions across all code quality tools, not just ESLint.

**Why:** File-level and project-level suppressions silently disable checks for code that doesn't need the exception. Discovered during audit when a file-level `eslint-disable` covered 7 unrelated functions — caught only on manual self-review.

## Context

The bypass-warn hook (`post-tool-bypass-warn.ts`) already detects suppression patterns being added, but its warning is generic and doesn't distinguish scope. The principle — "match suppression scope to problem scope" — applies across all checkers:

| Checker    | Narrow (good)                            | Broad (risky)                      |
| ---------- | ---------------------------------------- | ---------------------------------- |
| ESLint     | `eslint-disable-next-line rule`          | `eslint-disable rule` (file-level) |
| TypeScript | `@ts-expect-error` (line, self-removing) | `@ts-nocheck` (file)               |
| knip       | Explicit package name in ignore          | `eslint-plugin-*` wildcard         |
| Tests      | `it.skipIf(condition)`                   | `it.skip()` / `describe.skip()`    |

## Scope

### In scope

- Add `eslint-plugin-eslint-comments` (or `@eslint-community/eslint-plugin-eslint-comments`) to the ESLint preset with rules: `no-unlimited-disable`, `require-description`, `no-unused-disable`
- Update bypass-warn hook message to include scope guidance: `"Scope suppressions to the problem: line > block > file > project."`
- Audit existing suppressions in safeword codebase against new rules
- Add suppression scope check to `/audit` command (count file-level vs inline disables, flag broad ones)

### Out of scope

- Writing a standalone suppression guide (the tooling enforces; the hook message educates)
- Changing knip wildcard patterns (separate ticket if needed)
- Modifying test skip detection (bypass-warn already handles this)

## Research

- `eslint-plugin-eslint-comments` provides governance: `no-unlimited-disable`, `require-description`, `no-unused-disable`, `disable-enable-pair`
- ESLint native `reportUnusedInlineConfigs` catches dead suppression comments
- TypeScript: `@ts-expect-error` > `@ts-ignore` (errors when suppression becomes unnecessary)
- Google style guide: "narrowly-scoped directives" preferred
- SonarSource: multi-level suppression hierarchy (line > block > file > project)

## Work Log

- 2026-03-29T17:11:00Z Created: from audit session finding — file-level eslint-disable was too broad, caught on self-review

---
