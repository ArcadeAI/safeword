---
id: 5JN5E4
slug: revalidate-ticket-on-pickup
type: feature
phase: intake
status: superseded
created: 2026-05-28T18:19:31.580Z
last_modified: 2026-06-02T20:36:00Z
---

# Re-validate a ticket's premise when it's picked up

**Goal:** When a ticket is picked up or resumed, re-validate its premise before doing the work — confirm the problem still reproduces, the scope is still current, dependencies still hold, and it hasn't been fixed or obsoleted by intervening changes (e.g. a merge) — and surface any drift to the user before proceeding.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-05-28T18:19:31.580Z Started: Created ticket 5JN5E4
- 2026-06-02T20:36:00Z Superseded by **153** (Boundary Resilience). Same intent — re-validate a ticket's premise on pickup/resume and surface drift before working — but 153's Mechanism 2 (replan-on-resume) already carries the fuller design (dimensions + 27 scenarios), so 153 is the canonical home. Closed via /figure-it-out reconciliation to avoid two implementations of the same mechanism.
