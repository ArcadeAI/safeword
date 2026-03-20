---
id: 045
type: task
phase: intake
status: pending
created: 2026-03-20T05:33:00Z
last_modified: 2026-03-20T05:33:00Z
parent: 044
---

# Per-Session Quality State

**Goal:** Isolate quality gate state per Claude session to prevent cross-session interference.

**Why:** `quality-state.json` is a single shared file. When two sessions run in the same repo, gates from one session block the other, LOC counts from both sessions get summed, and commits in one session clear gates the other triggered.

## Problem

The hook input includes `session_id` but it's unused. All sessions share one state file.

**Failure modes:**

- Gate cross-contamination: Session A triggers phase gate → Session B can't edit code
- State clobbering: Two post-tool hooks fire near-simultaneously → last write wins
- False gate clearing: Session A commits → clears gate Session B triggered
- LOC inflation: Both sessions' uncommitted changes counted together

## Design

State file per session: `quality-state-{session_id}.json`

**Per-session (isolated):** `gate`, `locSinceCommit`, `lastKnownTddStep`
**Global (shared):** `lastCommitHash`, `lastKnownPhase`, `activeTicket`

Split into two files:

- `quality-state-{session_id}.json` — session-local gate enforcement
- `quality-global.json` — shared facts about repo state

Pre-tool reads session-specific file. Post-tool reads/writes both.

### Open questions

- Stale session cleanup: session files accumulate. Garbage collect on age? On session end?
- LOC counting: `git diff --stat HEAD` is inherently global. Per-session LOC requires tracking which files each session touched — significantly more complex. Acceptable to keep LOC global?
- ~~Resumed sessions~~: **Resolved** — session_id is preserved across `--resume`/`--continue`/`/resume`. Only changes on fresh `claude` start or `/clear`. No orphaning risk from resumes.

## Scope

**Files changed:**

- `.safeword/hooks/pre-tool-quality.ts` — read session-specific state file
- `.safeword/hooks/post-tool-quality.ts` — write session-specific + global state
- `.safeword/hooks/lib/quality-state.ts` — split state types
- `packages/cli/tests/integration/quality-gates.test.ts` — multi-session test scenarios

## Work Log

- 2026-03-20 05:33 UTC — Ticket created. Design sketched. Open questions on stale cleanup and LOC isolation.
