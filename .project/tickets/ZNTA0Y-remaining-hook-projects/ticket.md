---
id: ZNTA0Y
slug: remaining-hook-projects
type: task
phase: intake
status: in_progress
created: 2026-11-17T08:26:03.255Z
last_modified: 2026-11-17T08:26:03.255Z
---

# Run every per-tool and SessionStart hook in the worktree a session works in

**Goal:** The remaining per-tool and SessionStart hooks pick their project through the shared rule, so worktree sessions lint, guard and check the worktree

**Why:** These hooks still read the launch checkout (CLAUDE_PROJECT_DIR), so a worktree session linted with the wrong configs and checked the wrong project (#5467 part 2b)

## Scope

- Per-tool hooks `post-tool-bypass-warn`, `post-tool-lint`, `post-tool-sync-learnings`, `post-tool-work-log` and `pre-tool-config-guard` resolve like `post-tool-quality`; the Bash hooks `pre-tool-stale-main` and `pre-tool-architecture-stage` start from the shell's cwd.
- SessionStart hooks `session-architecture-heal`, `session-auto-upgrade`, `session-dependency-readiness`, `session-lint-check` and `session-version` read their input and use the session pointer.
- `lib/lint` lints with the `.safeword` configs of the project it is given, not a root fixed at import from `CLAUDE_PROJECT_DIR`.
- `installCrashCapture` returns `setProject`; hooks point it at the project they resolve.
- Relative edit paths in the lint, learnings-sync and work-log hooks resolve against the reported cwd.
- Parity guard: the migrated files leave `PENDING`; legitimate uses are recorded with reasons.

## Out of scope (later parts of #5467)

- Retro spool and closeout binding (part 3, including `prompt-retro-nudge`); CLI resolvers and the Codex/Cursor adapters (part 4, including `lib/safeword-context`).
- `stop-reentry` / `session-start-reentry` keep their own git-root anchor by design.

PR: #5664. Design: `.project/designs/5467-project-directory-resolution.md`.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T08:26:03.255Z Started: Created ticket ZNTA0Y
- 2026-11-17T10:30:00.000Z Complete: cross-agent review approved (1a5e9a94, f7cfb41e); verify recorded in verify.md
