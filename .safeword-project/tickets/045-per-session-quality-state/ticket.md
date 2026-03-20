---
id: 045
type: task
phase: done
status: done
created: 2026-03-20T05:33:00Z
last_modified: 2026-03-20T15:21:00Z
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

**Single file per session:** `quality-state-{session_id}.json`

No global file split needed. Each session tracks its own full state independently. This is simpler than the original two-file design and avoids read-modify-write races on a shared global file.

**What each session file contains:** All 6 existing fields (`locSinceCommit`, `lastCommitHash`, `activeTicket`, `lastKnownPhase`, `gate`, `lastKnownTddStep`).

**LOC stays global by nature:** `git diff --stat HEAD` returns all uncommitted changes regardless of which session made them. Per-session LOC would require tracking per-session file ownership — not worth the complexity. If Session A writes 300 LOC and Session B writes 200 LOC, both see 500 LOC. This is correct — "the repo has too many uncommitted changes" is a repo-level fact.

**Gate isolation is the core value:** Session A's phase gate won't block Session B. Each session enforces its own gates against its own state.

### Session lifecycle

- `session_id` is a UUID, present in every hook event
- Preserved across: `--resume`, `--continue`, `/resume`, `/clear`, `/compact`
- New ID on: fresh `claude` start, `--fork-session`
- **Cleanup:** SessionEnd hook deletes the session's state file (1.5s timeout, configurable)

### Resolved questions

- ~~Stale cleanup~~: **Resolved** — SessionEnd hook deletes per-session state file
- ~~LOC isolation~~: **Resolved** — keep LOC global (git diff is inherently global)
- ~~Resumed sessions~~: **Resolved** — session_id preserved across resume/continue/clear/compact

## Implementation

1. **Pre-tool hook:** Read `session_id` from hook input, construct state file path as `quality-state-{session_id}.json`, read only that file
2. **Post-tool hook:** Same — read `session_id`, write to session-specific state file
3. **SessionEnd hook:** Delete `quality-state-{session_id}.json` on session end
4. **Gitignore:** Pattern `quality-state-*.json` (already covered by existing `quality-state.json` entry — verify)
5. **Migration:** First run with no session file → initialize fresh state (existing behavior for missing file)

## Scope

**Files changed:**

- `.safeword/hooks/pre-tool-quality.ts` — read session_id, use per-session state file
- `.safeword/hooks/post-tool-quality.ts` — read session_id, write per-session state file
- `.safeword/hooks/lib/quality-state.ts` — add state file path helper
- `packages/cli/templates/hooks/` — sync all changed templates
- `packages/cli/tests/integration/quality-gates.test.ts` — multi-session test scenarios
- `.gitignore` — verify pattern covers `quality-state-*.json`

**New file:**

- `.safeword/hooks/session-cleanup-quality.ts` — SessionEnd hook to delete state file

## Work Log

- 2026-03-20 15:21 UTC — Spec updated with research findings. SessionEnd cleanup, LOC-stays-global, single-file-per-session design. Moving to implement.
- 2026-03-20 05:33 UTC — Ticket created. Design sketched. Open questions on stale cleanup and LOC isolation.
