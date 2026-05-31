---
id: M7AZY3
slug: workflow-gate-hygiene
type: feature
phase: intake
status: backlog
epic: workflow-gate-hygiene
created: 2026-05-31T18:31:15.834Z
last_modified: 2026-05-31T18:31:15.834Z
---

# Epic: Workflow & gate hygiene cleanup

**Type:** Feature (epic — holding pen for safeword self-enforcement cleanup)

**Goal:** Tighten how safeword enforces its own discipline — make agents actually follow the bdd/tdd phase machine, and put each gate at the right trigger — fixing drift surfaced by dogfooding.

**Why:** This long session was itself evidence that safeword's self-enforcement has gaps. Epics got closed by `status` with hand-written verify.md (the `phase: done` gate never fired because aggregation/decision tickets stay at `phase: intake`); a duplicate ticket (7GER0P) was filed because there's no capability-discovery surface; and a lot of real work happened outside the intake→done phase machine entirely. Separately, the LOC gate fires on a line-count heuristic that may not be the right trigger. This epic is the holding pen for those self-enforcement fixes.

## Tickets

| ID         | Title                                                  | Type    | Status  |
| ---------- | ------------------------------------------------------ | ------- | ------- |
| **2JMQMX** | Explore & fix bdd/tdd workflow adherence               | feature | backlog |
| **MT27QG** | Review LOC gates — keep, or move trigger to phase/step | feature | backlog |

(More may join — this is the cleanup holding pen. Related self-enforcement tickets already exist standalone: 1GGD28 ticket-discovery-index, MBGQ89 pairing schema, 160-audit-stale-ticket-detection.)

## Out of scope

- Building new product features. This epic is strictly about safeword's own workflow/gate enforcement hygiene.

## Done when

- Both children are `done`.
- bdd/tdd adherence has a documented diagnosis + a shipped fix (guidance and/or enforcement).
- LOC-gate placement has a documented decision (keep LOC, or move to a phase/step trigger) and any resulting gate change shipped.

## Work Log

- 2026-05-31T18:31:15.834Z Started: Created ticket M7AZY3
- 2026-05-31T18:31:15.834Z Filed (backlog): cleanup holding epic for safeword self-enforcement, with two children carved from this session's dogfooding observations — bdd/tdd adherence drift (2JMQMX) and LOC-gate placement (MT27QG). Epic carries no own spec.md; children hold their own.
