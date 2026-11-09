---
id: 920BVH
slug: preserve-review-during-progress
type: task
phase: implement
status: in_progress
created: 2026-11-09T22:08:06.551Z
last_modified: 2026-11-09T22:08:06.551Z
---

# Keep valid approval while builders record progress

**Goal:** Preserve owned planning approvals when the ticket work log records progress, while behavior and design changes still invalidate dependent approval

**Why:** Current-main identity controls reproduce work-log-only invalidation; original epic requires semantic approval currency

**Tracking:** #5766. This is one confirmed cause, not every reported symptom.

## Scope and proof

Preserve owned planning review after updates confined to the standard Work Log section. Keep accepted scope, decisions, requirements, adjacent sections and plans bound. No route, qualification, host, ledger or general fingerprint-policy change.

Use the existing actual CLI review/status fixture with its private reviewer stub: progress retains approval; changed scope and non-log decisions stale it. A section after Work Log remains bound. This fixture is not qualification or native-host acceptance.

## Root Cause

At main e00ea1e65, semanticTicketIdentity excludes phase/status/last_modified metadata but hashes the complete body, including automatic Work Log entries. Direct controls show phase-only identity unchanged, log-only identity changed, scope identity changed. Existing 85 planning tests pass; their progress control changes only phase, not the log.

Ruled out phase alone: its direct control preserves identity. Ruled out provider or qualification failures for this identity difference: no reviewer/network runs in the control. The trial changed other inputs too, so this does not explain every historical invalidation.

## Work Log

- 2026-11-09T22:08:06.551Z Started: Created ticket 920BVH
