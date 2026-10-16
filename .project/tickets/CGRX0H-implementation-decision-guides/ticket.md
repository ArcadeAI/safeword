---
id: CGRX0H
slug: implementation-decision-guides
type: task
phase: intake
status: in_progress
epic: 82T411
scope:
  - add concise reusable guidance for interface and authorization decisions, release and recovery decisions, and measurement design
  - route each guide from Implementation Planning only when its subject applies; keep the existing architecture, data, and testing guides as their subject authorities
  - reconcile conflicting architecture and data guide triggers with the accepted single Implementation Plan of record and significance-based durable records
  - keep exact commands, test files, rollout steps, and evidence collection in Execution Planning
out_of_scope:
  - adding another feature design plan or a new planning phase
  - prescribing one API style, security architecture, telemetry stack, or rollout mechanism to every project
  - changing Product Plan targets, scenarios, or the shared decision-conversation contract owned by ZSHVEB
done_when:
  - authors can use the new guides to decide each applicable interface, access, release, rollback, and measurement concern with a concrete contract and consequence
  - Implementation Planning loads only applicable subject guides and records a justified skip for non-applicable concerns
  - the existing architecture, data, and testing guide routes agree with the single-plan contract
  - every new template guide is registered in the schema and installed content matches its source
  - focused schema, route, and guide-contract checks pass
created: 2026-09-22T21:54:57.911Z
last_modified: 2026-09-22T21:54:57.911Z
---

# Guide builders through implementation decisions

**Goal:** Give Implementation Planning focused guidance for interface, trust, release, and measurement decisions without adding another plan of record.

**Why:** The review contract requires these choices but authors lack reusable guidance for making them.

## Work Log

- 2026-09-22T21:54:57.911Z Decision: use three focused guides rather than one broad implementation manual or a longer checklist in the plan template. Current primary API, OWASP, SRE, and telemetry guidance shows reusable design questions in three distinct domains; subject routing keeps irrelevant material out of a plan. The plan and review contract remain the authority for required decisions.
- 2026-09-22T21:54:57.911Z Started: Created ticket CGRX0H
- 2026-09-22T22:16:45.000Z Added interface/access, release/recovery, and measurement-design guides; registered and installed them. Routed the applicable guides from Implementation Planning, made testing-guide loading explicit, and aligned architecture, data, and supporting-design guidance with one plan of record. Source/mirror parity and whitespace checks pass. Focused tests are pending because another checkout holds the shared test lock.
