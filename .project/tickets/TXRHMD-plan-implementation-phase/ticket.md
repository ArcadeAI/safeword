---
id: TXRHMD
slug: plan-implementation-phase
type: feature
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/480
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/988
  - https://github.com/ArcadeAI/safeword/pull/989
phase_anchors:
  - define-behavior: 3bb035bc
  - scenario-gate: 5e7cba52
  - implement: b4603611
  - verify: a83a908a
  - done: .project/tickets/TXRHMD-plan-implementation-phase/verify.md
scope:
  - insert `plan-implementation` between scenario-gate and implement in the canonical phase enum and every phase-keyed hook surface (CANONICAL_PHASES, BddPhase, PHASE_EVIDENCE, prompt reminders, stop/pre-tool gate phase lists, LEDGER_REQUIRED_PHASES)
  - pre-tool transition gate — deny `phase: implement` for new-flow features until impl-plan.md parses valid with status `planned`
  - extend the implement-phase application-code block to also cover plan-implementation
  - new PLAN_IMPLEMENTATION.md phase doc owning impl-plan authoring (moved from SCENARIOS.md exit step 3), with trio + Cursor parity and schema registration
  - reword every shipped "authored at scenario-gate exit" surface (SCENARIOS.md, DISCOVERY.md planning note, TDD.md, impl-plan-template, stop-gate message, schema comment, SKILL.md tables, SPLITTING.md, review-spec handoff, quality-review table, tdd-review loop-back, ticket-template/ticket-system/glossary enum copies, PRINCIPLES.md, prompt-questions)
  - superseding ADR in ARCHITECTURE.md
  - ship `.safeword/templates/adr-template.md` (ownedFiles doc-template + schema registration); PLAN_IMPLEMENTATION.md directs ADR emission to the paths.architecture-resolved location (file appends, directory gets date-prefixed files)
  - "`designApprovalGate` config toggle (default off) — conversational approval gate after the phase's independent review; PLAN_IMPLEMENTATION.md routes deep design through existing design-doc/data-architecture lanes; config-reference doc line for the new key"
  - impl-plan template gains a sixth content-or-skip "Doc impact" section (docs.sources enumeration); parseImplPlan validates it when present, never requires it (legacy five-section plans grandfathered)
  - update tests pinned to the old phase order and authoring point; new transition-gate tests
  - minimal website touch — the BDD flow enumeration in hooks-and-skills.mdx
out_of_scope:
  - "#478 checkpoint reordering"
  - "#530/#482 language-skill pointer wiring (this feature only creates the phase-entry home)"
  - website documentation backlog (impl-plan/reviewGate/architectureReviewGate undocumented; stale decomposition mentions beyond the flow line)
  - architectureReviewGate semantics changes (stays verify/done, content-hash on the reconciled plan)
  - cumulative test-defs gate's pre-existing `verify` hole (separate chip)
  - migration tooling for in-flight tickets (denial message + changelog note suffice)
done_when:
  - a feature ticket at scenario-gate advances only to plan-implementation, and a `phase: implement` write without a valid impl-plan.md is denied with a plain-language pointer while a valid plan passes
  - resume table, phase-file table, and per-phase prompt reminder route plan-implementation to PLAN_IMPLEMENTATION.md and planning work
  - scenario-gate exit contains no implementation-design steps and no shipped surface still says "authored at scenario-gate exit"
  - every phase-keyed surface carries a plan-implementation entry; parity (mode=all) and full CI pass
  - ARCHITECTURE.md records the superseding ADR
created: 2026-07-08T06:03:20.016Z
last_modified: 2026-07-08T06:03:20.016Z
---

# plan-implementation phase before TDD

**Goal:** Insert a gated `plan-implementation` phase between scenario-gate and implement so no TDD RED starts before a valid, reviewed impl-plan.md exists (GitHub #480).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-08T06:03:20.016Z Started: Created ticket TXRHMD
- 2026-07-08T06:16:00Z Intake: spec.md authored from issue #480 revalidation + /figure-it-out verdict (option C: phase owns impl-plan authoring; architecture design stays at intake; pre-tool transition gate; stage-scoped exit stamp). Cold-start executability check ran (one-way-door trigger): INSUFFICIENT-narrowly — 2 gaps (impl-plan stop-list membership; SPLITTING.md remappings) appended to Open Questions with proposals. Awaiting user signoff on JTBD/Rules/scope + 7 open-question proposals.
- 2026-07-08T13:31:31.710Z Phase: intake → define-behavior
- 2026-07-09T04:23:21.946Z Phase: define-behavior → scenario-gate
- 2026-07-09T04:41:37.925Z Phase: scenario-gate → implement
- 2026-07-09T06:55:48.300Z Phase: implement → verify
- PR opened: https://github.com/ArcadeAI/safeword/pull/988 (feature); docs follow-up stacked as https://github.com/ArcadeAI/safeword/pull/989. Done-flip pends CI green on #988.
- Done flip (2026-07-09): all done_when satisfied; verify.md + audit recorded; steps delivered after CI proved the acceptance lane blocking; CI vitest green on the PR head settles the two locally-environmental failures. Flip rides PR #988 per the ticket-closure guard.
