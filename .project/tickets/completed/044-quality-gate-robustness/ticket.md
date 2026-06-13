---
id: 044
type: epic
phase: done
status: done
created: 2026-03-20T05:33:00Z
last_modified: 2026-03-20T05:33:00Z
children: [043, 045, 046, 047]
---

# Quality Gate Robustness

**Goal:** Fix quality gate failure modes discovered in production use — deadlocks on project artifacts and cross-session state contamination.

**Why:** Quality gates shipped in ticket 041. Real-world use in the overlord project exposed two categories of failure: circular dependencies blocking project artifact edits, and shared state causing cross-session interference.

## Children

### 043 — Quality Gate Deadlock Fix (bugfix, in_progress)

Pre-tool blocks edits to `.safeword-project/` files, creating unrecoverable deadlocks. Fix: exempt project artifacts from gates + skip null→phase on ticket creation.

### 045 — Per-Session Quality State (task, pending)

`quality-state.json` is a single shared file. Parallel sessions clobber each other's state, cross-contaminate gates, and falsely clear gates on unrelated commits. Fix: per-session state files keyed by `session_id`.

### 046 — Phase-Based Access Control (task, in_progress)

Pre-tool hook restricts edits by ticket phase. Planning phases only allow `.safeword-project/` edits; implement allows everything. Makes phases self-enforcing.

### 047 — Smarter Stop Hook Guard (task, pending)

Replace one-shot `stopHookActive` boolean with edit-aware check. Re-fire review when review triggers new code edits. Low priority — defense-in-depth.

## Work Log

- 2026-03-20 15:08 UTC — Added 047 (smarter stop hook guard). Architecture docs updated. 043 and 046 done.
- 2026-03-20 06:03 UTC — Added 046 (phase access control). Discovered during 043 implementation that gates alone don't enforce phases.
- 2026-03-20 05:33 UTC — Epic created. 043 already in progress (partial implementation exists). 045 scoped.
