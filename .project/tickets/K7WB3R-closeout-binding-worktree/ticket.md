---
id: K7WB3R
slug: closeout-binding-worktree
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5467
created: 2026-11-17T15:29:46.000Z
last_modified: 2026-11-17T15:29:46.000Z
---

# Let closeout confirm its session from inside a worktree

**Goal:** Closeout finds the session binding the hook recorded, whichever folder it runs in. Each worktree has its own binding.

**Why:** The pre-tool hook writes the binding into the launch checkout, but closeout reads it from the git root of its own cwd. Run inside a worktree, closeout finds nothing (#5467 part 3a; plan in `.project/designs/5467-project-directory-resolution.md`, "Closeout binding").

## Scope

- Writer and reader derive the same directory: the git working tree where the closeout command runs. That is the reported shell cwd, following a leading literal `cd <path>`.
- The binding file is named per working tree (`closeout-session-binding-<hash>.json`), so worktrees sharing an absolute namespace root keep separate bindings. The gitignore pattern covers it.
- All three writers move together: Claude `pre-tool-quality`, Codex `pre-tool-quality`, Cursor `before-shell-execution`.
- When the hook cannot tell where closeout will run (`cd "$DIR" && …`), it denies that call with the exact command to run instead.

## Out of scope

- Retro spool relocation (part 3b), and the CLI and adapter resolvers (part 4).

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T15:29:46.000Z Started: Created ticket K7WB3R
