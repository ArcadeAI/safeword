---
id: 044
type: epic
phase: intake
status: in_progress
created: 2026-03-20T05:33:00Z
last_modified: 2026-03-20T05:33:00Z
children: [043, 045]
---

# Quality Gate Robustness

**Goal:** Fix quality gate failure modes discovered in production use — deadlocks on project artifacts and cross-session state contamination.

**Why:** Quality gates shipped in ticket 041. Real-world use in the overlord project exposed two categories of failure: circular dependencies blocking project artifact edits, and shared state causing cross-session interference.

## Children

### 043 — Quality Gate Deadlock Fix (bugfix, in_progress)

Pre-tool blocks edits to `.safeword-project/` files, creating unrecoverable deadlocks. Fix: exempt project artifacts from gates + skip null→phase on ticket creation.

### 045 — Per-Session Quality State (task, pending)

`quality-state.json` is a single shared file. Parallel sessions clobber each other's state, cross-contaminate gates, and falsely clear gates on unrelated commits. Fix: per-session state files keyed by `session_id`.

## Work Log

- 2026-03-20 05:33 UTC — Epic created. 043 already in progress (partial implementation exists). 045 scoped.
