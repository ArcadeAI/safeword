---
id: KKNFZA
slug: offboard-local-ticketing
type: feature
phase: intake
status: in_progress
scope:
  - Tracker becomes system of record for identity + status (provider-neutral, GitHub/Linear)
  - issue-first ticket creation; status transitions written to the issue
  - local ticket folder becomes git-ignored ephemeral cache; gates read the cache
  - retire INDEX generation and dup-ID guard when tracker is canonical
  - persistArtifacts opt-in to commit spec/design to a docs path
  - session-boundary status reconciliation (issue = read-authority)
  - back-compat read of legacy tickets; provider:none unchanged
out_of_scope:
  - full field parity (assignee/priority/body two-way) — M1FGRJ
  - dependency-graph projection (sub-issues/relations/topo-sort) — M1FGRJ
  - new providers beyond GitHub/Linear (Jira/Slack)
  - live per-turn two-way sync
  - rewriting BDD/TDD gate mechanics themselves
done_when:
  - with a tracker connected, a full create→work→close session adds zero tracked ticket files
  - identity + status are observable in the tracker without running safeword
  - gates pass/fail identically offline (no per-turn network)
  - existing local tickets and provider:none installs are unaffected
created: 2026-06-27T21:35:47.369Z
last_modified: 2026-06-27T21:40:00.000Z
---

# Off-board local ticketing: external tracker as system of record, local plane as ephemeral cache

**Goal:** Make the customer's tracker canonical for ticket identity + status and turn the local
ticket plane into a git-ignored ephemeral cache, so safeword stops churning bookkeeping into the
repo while gates keep reading local files.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-27T22:52:00Z Intake: resolved artifact routing (TB1.AC5–AC7). Durable prose
  (spec/design) → docs path via persistArtifacts, never tracker. Gate-fuel (test-definitions,
  verify, impl-plan, dimensions) → ephemeral, never projected raw. Work log → local; summary to
  issue at Stop only. Legacy projects out of scope (user) → dropped legacy test-def carve-out.
- 2026-06-27T21:40:00Z Intake: wrote spec.md (intent, intake brief, 2 JTBDs / 8 ACs, outcomes)
  and set engineering scope. Decision via /figure-it-out: off-board coordination plane to tracker,
  demote execution plane to ephemeral cache. Decomposition (5 child tickets) in spec.md.
- 2026-06-27T21:35:47.369Z Started: Created ticket KKNFZA
