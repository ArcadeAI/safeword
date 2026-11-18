---
id: Q8RD2N
slug: retro-spool-durable
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5467
created: 2026-11-18T14:45:00.000Z
last_modified: 2026-11-18T14:45:00.000Z
---

# Keep a session's unfiled retro findings when its worktree is deleted

**Goal:** A session's retro findings are still filed after its worktree is deleted, however the worktree was removed.

**Why:** Drafts are spooled in the worktree's own `.safeword/retro-drafts/`. Deleting the worktree deletes the drafts that haven't been filed yet (#5467 part 3b; plan in `.project/designs/5467-project-directory-resolution.md`, "Retro spool").

## Scope

- The retro writer spools each draft to a durable copy at `<git common dir>/safeword/retro-drafts/`, which every worktree of the repository shares. Outside git, the durable copy is the project's own folder.
- The working copy stays in the project's `.safeword/retro-drafts/`. Before Safeword hands a spool to the filer (Stop gate, nudge, closeout), it brings in durable drafts that aren't in the working copy and haven't been acknowledged there. So the filer never reads or writes inside `.git`.
- A draft removal (filed, or accepted by the server) applies to both copies. A durable copy that can't be written (an agent sandbox) is pruned at the next handoff, using the working copy's acknowledgements.
- If the durable copy can't be written, the writer falls back to the working copy, which is today's behavior.
- Acks are copied to a durable ledger beside the durable copy (by the drain, and by the next hook-side handoff), so a filed draft stays filed after its worktree is deleted.
- If the working copy can't take the pending drafts, nothing is dispatched and no filing attempt is spent.
- Known limit: a sandboxed filer whose worktree is deleted before its turn's Stop hook runs (and without closeout) leaves its acks only in the deleted worktree. The finding can then be dispatched again, and the filer's marker dedup is the backstop.

## Decision (deviates from the plan)

The plan had the filer read and write the shared folder directly. Claude Code treats `.git` as a protected path, and writes outside the working directories need approval (code.claude.com/docs/en/permissions). Codex's sandbox also limits writes to the workspace. So filing from `.git` would prompt the user on every filing, or fail. The working copy keeps the filer unchanged, and the shared folder only has to be written by hook and CLI code. The plan's one-release transition and parity guard are no longer needed: the legacy folder is the working copy.

## Out of scope

- Filing drafts for a session that has ended (the cross-session sweep).
- The relay outbox, which already lives in an external configured directory.
- The CLI and adapter resolvers (part 4).

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-18T14:45:00.000Z Started: Created ticket Q8RD2N
