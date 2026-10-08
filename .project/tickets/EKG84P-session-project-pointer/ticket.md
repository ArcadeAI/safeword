---
id: EKG84P
slug: session-project-pointer
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5467
created: 2026-10-08T22:36:01.878Z
last_modified: 2026-10-08T22:36:01.878Z
---

# Run Stop's done gate in the worktree a session edited

**Goal:** Stop and session-level hooks read the session's state from the tree its last edit landed in

**Why:** PostToolUse writes worktree state but Stop read the launch checkout, so done gates and phase checks were skipped (#5467, #5256, #5346)

## Scope

- Session pointer in `templates/hooks/lib/project-directory.ts`: PostToolUse records the tree each edit resolved to, keyed by session in the OS temp directory; `resolveSessionProjectDirectory` follows it, else applies the rule to the host `cwd`.
- `stop-quality.ts` resolves its project after reading input; `stop-self-report`, `prompt-questions`, `session-compact-context`, `session-cleanup-quality` use the session pointer; `post-tool-skill-nudge` resolves like `post-tool-quality`.
- `lib/test-runner.ts` drops its launch-checkout default; callers pass the project.

## Out of scope (later PRs under #5467)

- Remaining per-tool and SessionStart hooks (part 2b); retro spool and closeout binding (part 3); CLI resolvers and Codex/Cursor adapters (part 4).

Depends on PR #5655 (part 1). Design: `.project/designs/5467-project-directory-resolution.md`.

## Work Log

- 2026-10-08T22:36:01.878Z Started: Created ticket EKG84P
