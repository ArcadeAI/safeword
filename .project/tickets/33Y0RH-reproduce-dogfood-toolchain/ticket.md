---
id: 33Y0RH
slug: reproduce-dogfood-toolchain
type: task
phase: verification
status: in_progress
created: 2026-09-11T00:16:46.739Z
last_modified: 2026-09-11T01:42:00Z
---

# Reproduce the development toolchain for Safeword contributors

**Goal:** Make a fresh Safeword worktree select the repository's intended runtimes and Python verification tools without relying on one contributor's global environment.

**Why:** Dogfood closeout reached different tools than CI and lacked mypy, making local verification depend on machine state.

## Scope

- Declare the Bun, Node.js, Go, Python, and uv versions used for local Safeword development.
- Move the pinned Python verification tools into a root uv project and lock them.
- Make CI consume that same uv lock instead of a separate pip requirements file.
- Keep JavaScript dependencies owned by Bun and its existing lockfile.

## Out of Scope

- Requiring Safeword customers to use mise.
- Teaching closeout to install dependencies silently.
- Changing which Python checks this repository opts into.

## Done When

- A fresh contributor environment can select the repository runtimes from `mise.toml`.
- `uv run mypy .` uses the repository lock and passes.
- CI installs the same locked Python verification dependencies used locally.
- A contract test prevents the dogfood runtime and dependency declarations from drifting.

## Test Plan

- Extend the dogfood source-worktree contract test to verify the pinned runtime and Python-tool declarations.
- Resolve the real typecheck plan and prove it selects `uv run mypy .`.
- Run `uv sync --frozen` and `uv run mypy .`.

## Work Log

- 2026-09-11T00:16:46.739Z Started: Created ticket 33Y0RH
- 2026-09-11 Defined: Chose project-local mise runtime pins plus a uv-locked Python development group shared with CI.
- 2026-09-11 Implemented: Added repository runtime pins, replaced the standalone pip requirements file with a uv project lock, and wired CI to the same lock.
- 2026-09-11 Verified: `mise exec -- uv sync --frozen` and `mise exec -- uv run mypy .` pass; focused contract and resolver tests pass.
- 2026-09-11 Hardened: Configured mise to source uv's existing environment so repository-owned Python tools cannot be shadowed by unrelated global binaries.
- 2026-09-11 Verified: Recorded final focused, typecheck, parity, and audit evidence in verify.md.
