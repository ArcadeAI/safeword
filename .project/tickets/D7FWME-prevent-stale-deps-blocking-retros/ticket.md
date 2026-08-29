---
id: D7FWME
slug: prevent-stale-deps-blocking-retros
type: task
phase: verification
subtype: bug-investigated
status: in_progress
created: 2026-08-29T15:54:29.285Z
last_modified: 2026-08-29T17:25:00.000Z
---

# Keep routine retros running after tool-list changes

**Goal:** Let routine retro submission proceed without unrelated manual dependency-fingerprint recovery.

**Why:** Project-local Claude retros should remain invisible and nonblocking when the installed tool inputs drift.

## Work Log

- 2026-08-29T15:54:29.285Z Started: Created ticket D7FWME
- 2026-08-29T16:00:00.000Z Reproduced: the manual retro skill selected `bun run safeword`, and the dependency-readiness guard correctly denied that project-toolchain command while its fingerprint was stale.
- 2026-08-29T17:25:00.000Z Implemented: manual retros use a versioned independent `bunx` carrier; pinned `retro run` is available during stale readiness; a successful later install now supersedes durable failed-install state.
- 2026-08-29T17:25:00.000Z Verified: changed-path tests, generated plugin integrity, lifecycle fixtures, lint, typecheck, build, and 38 acceptance scenarios are green. The full 8,731-test CLI run had one unrelated 30-second closeout receipt timeout; that exact test passed in isolation.

## Root Cause

The manual retro skill tells agents to fall back to `bun run safeword` when the bare binary is unavailable. That route depends on the project's `node_modules`, so the dependency-readiness guard correctly blocks it after dependency inputs change. The independent `bunx safeword@<version>` carrier is already used by automatic retro hooks, but `retro run` is not in the guard's narrow set of Safeword commands allowed while project dependencies are stale.

Confirmed by tracing the live failure through `retro/SKILL.md` into `isDependencyBackedCommand`: `bun run safeword …` is classified as dependency-backed, and pinned `bunx safeword@<version> … retro run` was also guarded because only doctor, plan, setup, and status were exempt.

Ruled out:

- Corrupt or falsely stale marker: the checkout was more than a thousand commits behind current main and had changed dependency inputs, so stale classification was correct.
- Relay or retro-pipeline failure: the same retro filed successfully as soon as the command became runnable.
- A need to weaken the general dependency guard: automatic Claude and Codex retro hooks already avoid project dependencies by spawning `bunx safeword@latest` directly.

## Tests

- A pinned `bunx --bun safeword@<version> retro run` remains runnable with stale project dependencies.
- The shipped manual retro skill selects the independent package carrier and does not recommend `bun run safeword`.
- Ordinary project-backed Safeword commands remain guarded.
- Unversioned `bunx safeword` remains guarded because it may resolve the stale local package.
- A matching install marker clears durable state left by an earlier failed install.
