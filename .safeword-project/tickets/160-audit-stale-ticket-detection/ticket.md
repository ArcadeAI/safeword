---
id: 160
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Add a safeword-conditional pass to /audit that surfaces ticket-system rot:
  - Tickets in `.safeword-project/tickets/*/` with status: in_progress AND
    last_modified > N days ago (likely abandoned)
  - Tickets in `completed/` that still say status: in_progress (move/state mismatch)
  - Tickets with type: feature AND phase: implement AND no test-definitions.md
    (broken state — should have been caught by hook, surfaces gate-bypass)
  Conditional on `.safeword/` presence so non-safeword projects skip the section.
out_of_scope: |
  - Auto-cleaning or auto-moving tickets (read-only flagging)
  - Frontmatter enum validation (covered by ticket 161 — hook layer)
  - Stale threshold tuning beyond a single default + override
done_when: |
  - /audit "Safeword Tickets" section appears when .safeword/ present
  - On a project with a 60+ day in_progress ticket, surfaces as W-tier
  - On a clean project, zero noise
  - Threshold configurable (e.g., .safeword/config.json key)
---

# /audit: detect stale and broken-state safeword tickets

**Goal:** Catch ticket-system rot — abandoned in_progress tickets, mis-located completed tickets, and broken-state tickets that escaped the real-time hooks.

**Why:** Safeword users accumulate tickets over time. Some get abandoned mid-flow without status updates. The current /audit doesn't notice. This is a periodic-detection problem (not real-time) so it belongs in /audit, not a hook.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate
