---
id: M6D315
slug: bdd-phase-two-merge
title: "Epic: Absorb arcade Phase 2 — impl plan artifact, ADR consultation, reconciliation, harness graceful degradation"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
paired_with: GNZ22J
created: 2026-05-24T21:37:59.696Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Epic: Absorb arcade Phase 2 — impl plan artifact, ADR consultation, reconciliation, harness graceful degradation

**Type:** Feature (epic — design + shipping plan)

**Goal:** Absorb arcade's `/implement-spec` discipline into safeword's Phases 5-6: add an impl plan as a first-class artifact (Approach/Decisions/Arch alignment/Known deviations/Assessment triggers + status lifecycle), require ADR consultation with a prompt to create the first ADR when none exist, add a plan-vs-actual reconciliation step at Phase 6 exit, gate the TDD loop on test-harness availability with graceful degradation, and extend safeword's existing `skip:` annotation discipline to impl plan sections.

**Why:** Today, safeword's Phase 5 (decomposition) is informal — task breakdown lives in ticket.md as freeform notes. Phase 6 (TDD) is rigorous on the R/G/R checkbox discipline but doesn't require an upfront design artifact, doesn't consult ADRs, doesn't reconcile what shipped against what was planned, and assumes the test harness exists. Arcade's `/implement-spec` runs the opposite trade — strong upfront plan and architectural awareness, weaker per-step TDD enforcement. The merged Phase 2 keeps safeword's TDD-step rigor and adds arcade's planning discipline, ADR consultation, and post-implementation reconciliation.

**Sourced from:** Comparative analysis in arcade-monorepo session 2026-05-24, after re-reading safeword `bdd/DECOMPOSITION.md` + `bdd/TDD.md` and arcade's `/implement-spec` SKILL.md.

**Sibling to:** DZ2NM5 (Phase 0 merge) and 0AWSY8 (Phase 1 merge). All three are independent epics; Phase 2 doesn't block on the others. Some cross-references exist (the impl plan inherits scenario IDs from Phase 0's numbering and references the Phase 4 review findings) but storage shape and decisions roll up to a single decision set inherited across epics.

## Tickets

| ID         | Title                                                                | Arcade Pair | Status | Depends On |
| ---------- | -------------------------------------------------------------------- | ----------- | ------ | ---------- |
| **XDNSZA** | Impl plan as first-class artifact with 5 sections + status lifecycle | SXNV8N      | Open   | —          |
| **K4BWTQ** | ADR consultation step + ADR-creation prompt for new patterns         | SXNV8N      | Open   | XDNSZA     |
| **ERVA6V** | Plan-vs-actual reconciliation at Phase 6 exit                        | SXNV8N      | Open   | XDNSZA     |
| **CNGBNT** | Test-harness availability check with graceful degradation            | SXNV8N      | Open   | —          |
| **VYRKBJ** | Extend `skip:` annotation discipline to impl plan sections           | —           | Open   | XDNSZA     |

**Paired arcade epic:** [GNZ22J](../../../../../arcade-monorepo/.claude/worktrees/elastic-noether-5c76a3/.safeword-project/tickets/GNZ22J/ticket.md) — arcade-side decommission of `/implement-spec`.

**Pairing note:** Many-to-one again. Four safeword tickets (XDNSZA, K4BWTQ, ERVA6V, CNGBNT) pair to the single arcade decommission ticket SXNV8N, since arcade has one `/implement-spec` skill that decommissions atomically once safeword absorbs its capabilities. VYRKBJ is safeword-internal hygiene with no arcade equivalent (extends an existing safeword discipline).

## Sequencing

1. **XDNSZA** (impl plan artifact) — foundation; everything else builds on it.
2. **CNGBNT** (harness check) — independent; can ship in parallel with XDNSZA.
3. **K4BWTQ** (ADR consultation) — depends on XDNSZA (the Arch alignment section needs to exist before we can populate it from ADRs).
4. **ERVA6V** (reconciliation) — depends on XDNSZA (the impl plan needs to exist before reconciliation can update it).
5. **VYRKBJ** (skip annotations on impl plan) — depends on XDNSZA (the sections need to exist before we can mark them skip).
6. **Arcade-side decommission** (SXNV8N) — blocked on all 4 safeword non-hygiene tickets being `done`.

## Decisions required before execution

1. **Impl plan storage shape** — inherits from DZ2NM5 decision #2 (ticket.md vs spec.md). If single-ticket.md model wins, impl plan becomes a `## Implementation` section. If separate-files wins, it's `<id>-impl.md`.

2. **Decomposition location** — separate Phase 5 (today's safeword model), or first section of the impl plan ("Approach" — arcade's model)? Driver leans Approach section — eliminates redundancy. **Open.**

3. **ADR location convention** — `docs/arch/` as safeword-canonical, configurable via `.safeword/config.json` for projects that put them elsewhere. Driver leans yes. **Open.**

4. **Required vs optional for features** — impl plan required for all features (with skip-annotated sections allowed), or optional for "simple" features (today's safeword model)? Driver leans required-with-skips — uniform discipline; small features can `Arch alignment: skip — no ADRs in this project` cheaply. **Open.**

5. **Reconciliation placement** — Phase 6 exit step (closer to memory), or part of Phase 7 verify (closer to evidence)? Driver leans Phase 6 exit. **Open.**

## Out of scope (this epic)

- Phase 0 / Phase 1 absorption (separate epics DZ2NM5 and 0AWSY8).
- Phase 3 (verify + signals) — `/build-signals` absorption is the next future epic, after this one.
- ADR template / format design — out of scope; defer to project conventions or a separate ticket if needed.
- Auto-extraction of architectural decisions from existing safeword guides (`.safeword/guides/architecture-guide.md`, `design-doc-guide.md`) — those stay as guidance; the new ADR consultation step reads project-local ADRs.

## Done when

- Impl plan artifact exists with 5 documented sections + status lifecycle.
- ADR consultation step is a documented part of Phase 5 (or wherever the impl plan lands), including the ADR-creation prompt for new patterns.
- Plan-vs-actual reconciliation is a documented Phase 6 exit step.
- Test-harness availability check is a documented Phase 6 entry step with graceful-degradation path.
- `skip:` annotation convention extends to impl plan sections with the same non-empty-reason rule as R/G/R skips.
- All 5 child tickets are `done`.
- Worked example in DECOMPOSITION.md or TDD.md exercises all the new artifacts/steps.

## Related

- **DZ2NM5** (Phase 0 merge) — sibling epic. Storage shape decision inherits here.
- **0AWSY8** (Phase 1 merge) — sibling epic. Scenario numbering from Phase 0 + review findings from Phase 1 feed the impl plan's Decisions section.
- **Future Phase 3 epic** (verify + signals) — `/build-signals` absorption is the last rung of the spec pipeline absorption; this epic is the predecessor.
- **MBGQ89** (ticket-deps schema) — standalone safeword improvement; impl plan sections use cross-ticket references (`blocked_on`, `depends_on`) once that schema lands.

## Work Log

- 2026-05-24T21:37:59.696Z Started: Created ticket M6D315
- 2026-05-24T21:39:00.000Z Drafted: Epic shell with 5 children, sequencing, 5 open decisions, many-to-one pairing rationale
