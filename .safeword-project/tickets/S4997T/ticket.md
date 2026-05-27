---
id: S4997T
slug: bdd-phase-three-merge
title: 'Epic: Absorb arcade Phase 3 — outcomes, signals skill, alert routing, two-state done'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-three-merge
paired_with: Z6AMF0
created: 2026-05-24T21:44:38.381Z
last_modified: 2026-05-24T21:45:00.000Z
---

# Epic: Absorb arcade Phase 3 — outcomes, signals skill, alert routing, two-state done

**Type:** Feature (epic — design + shipping plan)

**Goal:** Absorb arcade's `/build-signals` discipline into safeword as a post-implementation skill that closes the feedback loop at release. Specifically: introduce Outcomes as a Phase 0 spec artifact, ship a `/build-signals` skill with the four-implementation-approach pattern + mandatory `feature:<slug>` tag + in-code instrumentation discipline, add a pluggable alert-routing layer (Linear-first with adapters), and split safeword's `done` gate into two states — `merge-ready` (verify.md exists) and `outcome-validated` (signals live).

**Why:** Today safeword has strong pre-release validation (verify + audit + verify.md) but no post-release measurement. A feature can ship "done" without anyone knowing if it actually works in production. Arcade's `/build-signals` is the discipline that closes that loop — every declared outcome becomes a live measurement with alert routing. Without absorbing this, safeword's "done" is implementation-done but not value-done.

**Sourced from:** Comparative analysis in arcade-monorepo session 2026-05-24, after re-reading safeword `bdd/VERIFY.md` + `bdd/DONE.md` and arcade's `/build-signals` SKILL.md.

**Sibling to:** DZ2NM5 (Phase 0 merge), 0AWSY8 (Phase 1 merge), M6D315 (Phase 2 merge). With this epic, the full spec-pipeline absorption is captured across 4 sibling epics. None block each other; each can ship independently. Some artifacts cross-reference (Outcomes declared in Phase 0 used by Phase 3 signals work).

## Tickets

| ID         | Title                                                                                  | Arcade Pair | Status | Depends On |
| ---------- | -------------------------------------------------------------------------------------- | ----------- | ------ | ---------- |
| **7VRXF6** | Add Outcomes as a Phase 0 spec artifact required by signals work                       | 5FBD29      | Open   | —          |
| **1W107W** | New /build-signals skill with 4 impl options + mandatory tag + in-code instrumentation | 5FBD29      | Open   | 7VRXF6     |
| **JS5K5G** | Pluggable alert-routing layer (Linear-first with adapters)                             | 5FBD29      | Open   | 1W107W     |
| **X59JZE** | Split done into merge-ready + outcome-validated states                                 | 5FBD29      | Open   | 1W107W     |

**Paired arcade epic:** [Z6AMF0](../../../../../arcade-monorepo/.claude/worktrees/elastic-noether-5c76a3/.safeword-project/tickets/Z6AMF0/ticket.md) — arcade-side decommission of `/build-signals`.

**Pairing note:** Many-to-one again — four safeword tickets pair to the single arcade decommission. Same pattern as Phases 1 and 2.

## Sequencing

1. **7VRXF6** (outcomes) — foundation; everything else builds on the Outcomes section existing.
2. **1W107W** (signals skill) — depends on outcomes existing.
3. **JS5K5G** (pluggable routing) — depends on signals skill (routing is a behavior of the skill).
4. **X59JZE** (two-state done) — depends on signals skill (the outcome-validated state requires signals).
5. **Arcade decommission (5FBD29)** — blocked on all 4 safeword children.

## Decisions required before execution

1. **Two-state done vs single done gate.** Driver leans two-state — `merge-ready` (verify.md exists) and `outcome-validated` (signals live). Reflects reality that ship and validate are temporally separate. **Open.**

2. **Alert-routing target.** Driver leans Linear-first pluggable — Linear is the default with config to add adapters for GitHub Issues / Jira / Slack as demand emerges. **Open.**

3. **Outcomes placement.** Outcomes is conceptually a Phase 0 artifact (declared at intake, used at Phase 3). Should the "Add Outcomes" ticket live under DZ2NM5 (Phase 0 epic) or this Phase 3 epic? Driver placed here because the signals work depends on it; the user may prefer to relocate to DZ2NM5. **Open.**

4. **Storage shape** — inherits from DZ2NM5 decision #1.

5. **Phase machine extension.** Adding signals post-done is either a new Phase 9 OR a separate skill that runs post-done. Driver leans separate skill — signals can run weeks after merge; phase machine shouldn't stay open that long. **Open.**

## Out of scope (this epic)

- Phase 0 / Phase 1 / Phase 2 absorption (separate sibling epics).
- Custom-cron-job framework — safeword consumes the user's existing scheduler.
- Visualization (Grafana dashboards, status pages) — out of scope; users wire visualization themselves.
- Multi-cloud abstraction (Datadog vs Honeycomb vs New Relic) — Datadog-first; adapters are future work.

## Done when

- Outcomes is a recognized Phase 0 spec section with validation.
- `/build-signals` skill exists with the four implementation approach options, mandatory `feature:<slug>` tag, in-code instrumentation discipline.
- Pluggable alert-routing layer exists with Linear as the default adapter.
- `done` is split into `merge-ready` and `outcome-validated` states (or the equivalent dual-gate).
- All 4 child tickets are `done`.
- Worked example shows a ticket walking through both gates — first merge-ready (verify.md), then outcome-validated (signals live).

## Related

- **DZ2NM5** (Phase 0 merge), **0AWSY8** (Phase 1 merge), **M6D315** (Phase 2 merge) — sibling epics. Together they form the full spec-pipeline absorption.
- **MBGQ89** (ticket-deps schema) — standalone safeword improvement; signals tickets use cross-ticket references once that schema lands.

## Work Log

- 2026-05-24T21:44:38.381Z Started: Created ticket S4997T
- 2026-05-24T21:45:00.000Z Drafted: Epic shell with 4 children, sequencing, 5 open decisions, many-to-one pairing rationale, final-rung-of-pipeline framing
