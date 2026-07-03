---
id: B04ADS
slug: impl-plan-at-code-write
type: feature
phase: intake
status: in_progress
parent: YA68QF
depends_on: ['87Y167']
external_issue: https://github.com/ArcadeAI/safeword/issues/644
scope: |
  Extend the implement-phase PreTool gate (#128 section of
  pre-tool-quality.ts) so a new-flow feature ticket at phase: implement
  requires a valid impl-plan.md before any application-code write — reusing
  lib/impl-plan.ts's parseImplPlan for validity (five sections
  content-or-skip; any parseable status). "New-flow" mirrors the stop gate's
  grandfathering: spec.md present in the ticket folder. The denial names the
  impl-plan template, instructs authoring at scenario-gate exit semantics
  (**Status:** planned), and states the forward next action. Unit/gate-level
  tests, Gherkin acceptance at features/impl-plan-at-code-write.feature +
  steps, template<->dogfood parity.
out_of_scope: |
  - Removing or weakening the verify-stop reconciliation gate
    (checkImplPlanArtifact in stop-quality.ts) — it keeps demanding
    **Status:** implemented from verify onward; the two points compose
  - Gating the ticket.md phase-advance edit into implement on impl-plan
    existence — redundant (D3): the first code write immediately follows the
    advance, and sibling 87Y167's scenario-review demand already gates that
    same edit; the code-write point also catches legacy tickets already
    sitting at implement
  - #644 G1 (sibling 87Y167), G3/G5/G6 (later tickets)
  - A new plan-implementation phase (#480) — enforcement lands without a
    phase-enum change; the phase proposal stays open upstream
  - impl-plan content/quality review (architectureReviewGate, MR5M3A) — flag
    posture unchanged
done_when: |
  - The first application-code write on a new-flow feature ticket at
    phase: implement is denied while impl-plan.md is missing or fails
    parseImplPlan validation, with remediation naming the template and
    Status: planned
  - The same write is allowed once a valid impl-plan.md exists (status
    planned or implemented)
  - Grandfathered features (no spec.md), tasks, patches, epics, meta/tooling
    paths, and non-implement phases never trip the gate
  - The verify-stop reconciliation gate's behavior is unchanged
  - Full test suite green; parity check passes
created: 2026-07-03T21:21:31.994Z
last_modified: 2026-07-03T21:40:00.000Z
---

# Demand impl-plan.md at first application-code write (#644 G4)

**Goal:** Move the impl-plan demand from verify-stop (where plans can only ever be retroactive) to the first application-code write on a feature ticket — so the plan is authored as a plan, before the code it plans (#644 G4).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes. Parent epic: [YA68QF](../YA68QF-644-g1-g4-remediation/ticket.md) (shared design record D1–D3). Sequenced after sibling [87Y167](../87Y167-artifact-precedence-gate/ticket.md) (restructures the same gate section first).

## Work Log

- 2026-07-03T21:21:31.994Z Started: Created ticket B04ADS
- 2026-07-03T21:40:00.000Z Scoped: Intake converged in-session with 87Y167 (shared user-gated sign-offs: epic split, JTBD/AC/scope settled via /figure-it-out per user instruction). D3 decision + premortem in parent epic YA68QF. Implementation starts after 87Y167 ships.
