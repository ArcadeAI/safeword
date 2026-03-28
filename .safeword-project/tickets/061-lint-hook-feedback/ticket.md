---
id: 061
slug: lint-hook-feedback
type: task
status: in_progress
phase: implement
---

# Task: Surface unfixable lint errors back to Claude via additionalContext

**Type:** Bug

**Scope:** After auto-fix, run linter in check-only mode and return remaining errors via `additionalContext` JSON so Claude can see and fix them. Currently all three languages (ESLint, ruff, golangci-lint) silently drop unfixable errors.

**Out of Scope:** Blocking (`decision: "block"`), iteration caps (not needed — additionalContext is non-blocking), /lint command changes, rule set changes.

**Context:** The post-tool-lint hook uses `.nothrow().quiet()` for all linters. After auto-fix, remaining errors are invisible to Claude. ESLint has a `console.error(stderr)` line that appears to surface errors but doesn't — stderr from exit-0 hooks is only visible in verbose mode. The official Claude Code mechanism is `additionalContext` in JSON on stdout.

**Done When:**

- [ ] `lintFile()` returns remaining errors (not just warnings) after auto-fix
- [ ] `post-tool-lint.ts` outputs `additionalContext` JSON when errors remain
- [ ] Works for all languages: ESLint, ruff, golangci-lint, clippy, sqlfluff, shellcheck
- [ ] ESLint's `console.error(stderr)` replaced with the shared mechanism
- [ ] Tests pass

**Tests:**

- [ ] Hook returns additionalContext JSON when lint errors remain
- [ ] Hook returns empty output when no errors remain (current behavior preserved)
- [ ] Auto-fix still happens before check (not regression)

## Work Log

- 2026-03-27 Created. Discovered during ruff/golangci-lint config audit. All languages have the same gap.
