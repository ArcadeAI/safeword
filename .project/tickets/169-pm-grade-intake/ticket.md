---
id: '169'
slug: pm-grade-intake
title: 'Epic: PM-grade intake protocol'
type: Feature
status: done
epic: pm-grade-intake
---

# Epic: PM-grade intake protocol

**Type:** Feature (epic)

**Status:** done — all three children shipped; every information element the goal named is captured and the surfaces are unified under one named protocol. Closeout via /figure-it-out (close-now vs one-more-child → close; a fourth "naming" child would be ceremony).

**Goal:** Make Clarify the part of safeword people brag about. Today it's propose-and-converge with five contribution techniques (failure modes, boundaries, scenarios, regret, UX) that produces `scope` / `out_of_scope` / `done_when` frontmatter. A PM-grade intake also surfaces: who asked, what user-facing problem this solves, the success metric, what changes if we don't build it, and an explicit reversibility/regret read. The output is an intake brief, not just frontmatter.

**Context:** The `elicit` and `brainstorm` skills already extract tacit knowledge and explore options. This epic ties Clarify + `elicit` + `brainstorm` into one named intake protocol with a real artifact.

## Outcome (how the goal was met)

| Goal element                               | Delivered by                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| who asked                                  | NWFT20 — Intake Brief "Requested by"                                                                              |
| user-facing problem                        | Jobs To Be Done (spec.md)                                                                                         |
| success metric                             | `done_when` frontmatter                                                                                           |
| what changes if we don't build             | NWFT20 — "Cost of inaction"                                                                                       |
| reversibility/regret read                  | NWFT20 "Reversibility" + TPP6Y2 pointer + 3KKPWJ cold-start                                                       |
| "intake brief, not just frontmatter"       | NWFT20 — `## Intake Brief` rung-0 in spec.md                                                                      |
| tie in elicit / brainstorm / figure-it-out | DISCOVERY gap-mapping (elicit = unknown intent · brainstorm = empty option space · figure-it-out = weigh options) |
| "one named intake protocol"                | SAFEWORD "PM-grade intake" unifying note tying the three surfaces, scaled by blast radius                         |

## Open questions — resolved

- Upgrade Clarify in place, or pre-Clarify phase? → **in place** (rung-0 Intake Brief in spec.md, no new phase).
- Brief replaces or sits alongside frontmatter? → **alongside** (`## Intake Brief` section; frontmatter still holds scope/done_when).
- Which sizes need full intake? → **features only**; tasks/patches stay lean and lean on the readiness pointer.
- Minimum brief? → **three fields** (requested by · cost of inaction · reversibility), advisory.

## Child tickets

- **TPP6Y2** `pm-grade-intake-readiness-gate` — **done** (PR #311). The every-turn five-dimension readiness pointer + value-of-information triage. The bounded core.
- **NWFT20** `intake-brief-rung-zero` — **done** (PR #336). The rung-0 `## Intake Brief` artifact (who asked · cost of inaction · reversibility), folded into the JTBD gate with feature-vs-task triage. The "brief, not just frontmatter" half.
- **3KKPWJ** `cold-start-executability-test` — **done** (PR #348). The heavyweight cold-start sufficiency check for one-way-door work — a context-free agent plans from spec+repo alone; advisory, surfaces gaps to Open Questions.

## Closeout touches (this commit)

- DISCOVERY: wired `/brainstorm` into the intake gap-mapping (empty option space → diverge before figure-it-out converges) — completes the elicit/brainstorm/figure-it-out triad the goal named.
- SAFEWORD: a "PM-grade intake" unifying note naming the protocol and its three surfaces so they read as one thing, not three disconnected mechanisms.

Deferred / won't-do: no fourth "naming artifact" child (ceremony — the protocol is now named in SAFEWORD at one sentence's cost).
