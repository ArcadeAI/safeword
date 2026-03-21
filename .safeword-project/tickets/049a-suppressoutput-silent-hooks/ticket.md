---
id: 049a
slug: suppressoutput-silent-hooks
type: patch
status: pending
phase: implement
parent: 049-stop-hook-quality-improvements
---

# Return `suppressOutput: true` from silent observer hooks

**Goal:** Add `suppressOutput: true` to the JSON output of silent observer hooks (PostToolUse quality, SessionEnd cleanup) to reduce false "hook error" noise injected into Claude's context.

## Why

Claude Code bug #34713: all hook executions generate `"hook error"` labels unconditionally, regardless of exit code. This injects noise into Claude's context that can cause it to abandon multi-step tasks. Silent hooks (PostToolUse observer, SessionEnd cleanup) never produce meaningful stdout — adding `suppressOutput: true` tells Claude Code to hide their output.

## What to Change

`suppressOutput: true` is a field in the **JSON output returned by a hook**, not a settings.json config field (confirmed by docs).

Hooks to update:

- `packages/cli/templates/hooks/post-tool-quality.ts` (+ working copy)
- `packages/cli/templates/hooks/session-cleanup-quality.ts` (+ working copy)

These hooks currently `process.exit(0)` with no stdout. To use `suppressOutput`, they must instead output a JSON object. Change their exit path to `console.log(JSON.stringify({ suppressOutput: true })); process.exit(0)` rather than bare `process.exit(0)`.

**Note:** Verify the exact field behavior against current docs before implementing — confirm `suppressOutput` applies to Stop hook output or PostToolUse output specifically.

## Work Log

- 2026-03-21 Ticket created as child of 049.
