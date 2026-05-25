---
id: DZ2NM5
slug: bdd-phase-zero-merge
title: "Epic: Merge product layer (JTBD/persona/AC) into bdd Phase 0"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: DXFX02
created: 2026-05-24T15:21:46.756Z
last_modified: 2026-05-24T15:21:46.756Z
---

# Epic: Merge product layer (JTBD/persona/AC) into bdd Phase 0

**Type:** Feature (epic — design + shipping plan)

**Goal:** Absorb the product-framing layer from arcade's `build-spec` pipeline (personas, JTBD, AC, glossary, cross-reference numbering, structured pause-gates) into safeword's `bdd` Phase 0, while keeping safeword's existing engineering-scope discipline (specificity self-test, `scope`/`out_of_scope`/`done_when`, hook-enforced exit criteria, library-version awareness, propose-and-converge, composable escape hatches to `/elicit` and `/figure-it-out`).

**Why:** Today, `bdd` Phase 0 captures _engineering scope_ but not _product motivation_. That's fine when the developer is also the product owner, but it lets scope drift toward implementation-thinking without a persona-and-motivation anchor. Arcade's pipeline runs the opposite trade — strong product framing, weaker engineering exit gate. The two are complementary; neither subsumes the other. A merged Phase 0 captures both why-and-who and what-we'll-touch-how-we'll-know, in that order.

**Sourced from:** Comparative analysis in arcade-monorepo session 2026-05-24, after diffing safeword `bdd/DISCOVERY.md` against arcade `build-spec/SKILL.md`. Both repos are co-edited from worktrees during this work (arcade at `.claude/worktrees/elastic-noether-5c76a3/`, safeword at `/Users/alex/Projects/safeword-arcade-sync/` branch `arcade-pipeline-sync`).

## Tickets

| ID         | Title                                                                      | Arcade Pair | Status | Depends On |
| ---------- | -------------------------------------------------------------------------- | ----------- | ------ | ---------- |
| **7YN5QB** | Add persona model (`.project/personas.md`) + validation                    | BC53PV      | Open   | —          |
| **YR6C49** | Add glossary (`.project/glossary.md`) + vocabulary validation              | KD4BYF      | Open   | —          |
| **Y2HCNJ** | Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)                      | 89HX2E      | Open   | 7YN5QB     |
| **31W8M3** | Add Acceptance Criteria layer between JTBD and scenarios                   | T9BNXD      | Open   | Y2HCNJ     |
| **XT1FFM** | Adopt `slug.persona.AC.scenario` numbering for traceability                | QEKGBK      | Open   | 31W8M3     |
| **B0JZQN** | Add structured user-signoff gates between Phase 0 sub-phases               | FFRPSC      | Open   | —          |
| **1J6JKP** | Lint hook hygiene — prettier config detection + scope biome to edited path | —           | Open   | —          |

**Note on 1J6JKP:** Not a Phase-0-merge sub-task — both fixes are unrelated to bdd or the product layer. Filed as a child of this epic because the bugs surfaced during this session's dogfooding work and the user prefers using this epic as the holding pen for safeword improvements discovered along the way. No arcade pair needed — `bunx safeword upgrade` picks up both fixes automatically.

**Related (standalone, not a child):** [MBGQ89](../MBGQ89/ticket.md) — first-class cross-ticket dependency/pairing fields in the ticket schema. Discovered while structuring this epic (we used ad-hoc `epic:`/`paired_with:`/`blocked_on:` fields with no schema backing) but the work is generic; tracked as a standalone safeword improvement, not a child of this epic. Not blocking on it — this epic's children can ship with ad-hoc field usage; MBGQ89 will retroactively bring them under schema.

**Paired arcade epic:** [DXFX02](../../../../../arcade-monorepo/.claude/worktrees/elastic-noether-5c76a3/.safeword-project/tickets/DXFX02/ticket.md) — arcade-side adoption/decommission for each safeword change.

## Sequencing

1. **7YN5QB** and **YR6C49** in parallel — foundational data files, no upstream deps.
2. **Y2HCNJ** — depends on 7YN5QB (JTBDs reference personas).
3. **31W8M3** — depends on Y2HCNJ (ACs live under JTBDs).
4. **XT1FFM** — depends on 31W8M3 (numbering scheme references AC).
5. **B0JZQN** — independent conversational-pattern change; can ship anytime in parallel.

## Decisions required before execution

These affect every child ticket. Resolve in this epic before any child advances past `intake`.

1. **Sub-ordering inside Phase 0** — product-first (orientation → JTBD → AC → engineering scope → self-test) or engineering-first (orientation → scope → JTBD → AC → self-test). Driver's working assumption is product-first (establishes motivation before scoping, prevents engineering-myopia); engineering-first is shorter to abandon if the work turns out not to be feature-sized. **Open.**

2. **Storage shape** — keep arcade's `.project/specs/<slug>.md` as a sibling to `ticket.md`, or fold spec content into a `## Spec` section inside `ticket.md`. Driver's working assumption is fold-into-ticket (ticket.md is already the home of the phase machine, work log, and hook-enforced exit criteria). **Open.**

3. **Personas/glossary file location** — `.project/personas.md` and `.project/glossary.md` as arcade has them, or relocate under `.safeword-project/` to keep all safeword data under one root. Driver's working assumption is `.project/` (it's project-data, not safeword-data — usable independent of safeword if someone later removes it). **Open.**

4. **Sizing classifier interaction** — does the merged Phase 0 fire only for features (current `bdd` behavior), or do tasks also get a lightweight version (JTBD optional, AC inline)? Default: features only. **Open.**

5. **Backward compat** — existing safeword tickets have no personas/JTBDs/ACs. Do existing in-flight tickets retroactively need them, or does the new shape apply only to tickets created after merge? Default: new tickets only; existing keep their current shape. **Open.**

## Out of scope (this epic)

- Absorbing the rest of arcade's spec pipeline (`review-spec`, `codify-spec`, `update-spec`, `implement-spec`, `build-signals`). Those are separate epics — this one is strictly Phase 0.
- Sizing classifier changes. The patch/task/feature rules stay as they are.
- Pre-Phase-0 work (intake routing, ticket creation). The merged work starts after a ticket exists.

## Done when

- `bdd` Phase 0 (DISCOVERY.md + skill body) captures all four artifact types (persona refs, JTBDs, ACs, engineering scope) with hook-enforced exit criteria.
- `.project/personas.md` and `.project/glossary.md` are first-class read targets in the Phase 0 flow.
- Cross-reference numbering scheme is documented and used by Phase 3 scenarios.
- All six child tickets are `done`.
- The merged DISCOVERY.md includes a worked example walkthrough that exercises all four artifact types.
- A test (or example ticket) demonstrates the new flow end-to-end.

## Related

- **172** (phase-step enforcement) — complementary; this epic adds new step content, 172 enforces step execution. Coordinate on whether new Phase 0 sub-steps need 172-style hooks.
- **G2E72G** (yolo-mode) — interacts via the pause-and-confirm gates (B0JZQN) — under YOLO, gates auto-confirm.

## Work Log

- 2026-05-24T15:21:46.756Z Started: Created ticket DZ2NM5
- 2026-05-24T15:25:00.000Z Drafted: Epic shell with 6 child tickets, sequencing, and 5 open design decisions
