---
id: 9ENJXQ
slug: shared-project-directory
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5467
created: 2026-10-08T05:12:13.595Z
last_modified: 2026-10-08T05:12:13.595Z
---

# Pick the right checkout from one shared rule for worktree sessions

**Goal:** Every hook, script and CLI command picks the project through one resolveProjectDirectory rule, guarded by a parity test

**Why:** Five one-off resolvers keep diverging, so worktree sessions read and write the wrong checkout (#5467)

## Scope

- `templates/hooks/lib/project-directory.ts`: `resolveProjectDirectory` (edited file's enrolled tree → cwd's enrolled tree → launch checkout; real paths; stops at the first git tree).
- The existing resolvers in `namespace-root.ts` delegate to it; non-edit tools now resolve from cwd instead of the launch checkout.
- Parity guard: a static test that fails when hooks, scripts or CLI code pick a project some other way, with a shrinking allowlist of not-yet-migrated sites.

## Out of scope (later PRs under #5467)

- Stop/session hooks and the session pointer; retro spool and closeout binding durable home; CLI resolvers and Cursor/Codex adapters.

Design: `.project/designs/5467-project-directory-resolution.md`.

## Work Log

- 2026-10-08T05:12:13.595Z Started: Created ticket 9ENJXQ
- 2026-10-08T05:13:46.303Z Phase: intake → implement
