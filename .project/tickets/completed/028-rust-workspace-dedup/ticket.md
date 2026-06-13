---
id: 028
type: task
phase: done
status: done
created: 2026-03-01T00:00:00Z
last_modified: 2026-03-01T00:00:00Z
---

# Merge duplicate Rust workspace test helpers

**Goal:** Merge createRustWorkspace and createRustWorkspaceWithGlob into a single function with a parameter for member format.

**Why:** Both functions are 44 lines, nearly identical. The only difference is how the `members` field is written in the root Cargo.toml (explicit list vs glob pattern).

## Files

- `packages/cli/tests/helpers.ts` (lines 480-523, 730-773)

## Approach

Add a `useGlob?: boolean` parameter to createRustWorkspace. When true, use `members = ["crates/*"]`; when false, use explicit `members = ["crates/alpha", "crates/beta"]`.

## Work Log

- 2026-03-01T00:00:00Z Complete: Merged into createRustWorkspace({ useGlob }), -49 lines (refs: 330d460)
