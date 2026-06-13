---
id: 7VRXF6
slug: outcomes-spec-section
title: 'Add Outcomes as a Phase 0 spec artifact required by signals work'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-three-merge
paired_with: 5FBD29
created: 2026-05-24T21:44:38.429Z
last_modified: 2026-05-24T21:45:00.000Z
---

# Add Outcomes as a Phase 0 spec artifact

**Goal:** Add an Outcomes section as a required spec artifact during Phase 0 intake — production success metrics that the signals work (1W107W) discharges. Each outcome must be tooling-agnostic, measurable, and meaningful.

**Why:** Without declared outcomes, the signals work has nothing to measure. Arcade's `/build-signals` refuses to proceed if the spec has no Outcomes section. Safeword today has no equivalent — features ship with no production-success criteria, so "is this working in production?" has no answer. This ticket adds the upstream artifact that the signals work consumes.

**Parent epic:** S4997T
**Paired with:** 5FBD29 in arcade
**Depends on:** —

**Placement note:** Outcomes is conceptually a Phase 0 (intake) artifact since it's declared at spec time. Placed under this Phase 3 epic because the signals work directly depends on it. Could be relocated to DZ2NM5 (Phase 0 epic) if the user prefers; cross-referenced there as `## Related`.

## Scope

### Outcomes section content

Each outcome is:

- **Tooling-agnostic** — describes the real-world signal, not the implementation. "Authentication success rate: ≥99% of valid tokens accepted" ✓; "PostHog event `auth_success` count" ✗.
- **Measurable** — has a concrete target value or threshold condition. "Improved retention" ✗; "≥95% of webhook deliveries succeed within the retry window" ✓.
- **Meaningful** — tied to a real user or business outcome. "X event count" alone is a vanity metric; "X event count growing month-over-month" or "X event count above the rate that pages oncall" carries meaning.

### Phase 0 integration

- Add Outcomes capture to Phase 0 authoring flow (per DZ2NM5's flow): after JTBD/AC/scope, before exit.
- Phase 0 exit gate requires at least one Outcome declared (or `skip: <reason>` per the impl-plan skip discipline in VYRKBJ).
- Outcomes live in the spec (location TBD per storage decision; either ticket.md section or sibling spec.md section).

### Coaching

For the Outcomes-authoring sub-step, include the arcade-style coaching:

> How will you know this feature is succeeding in production? Don't tell me PostHog events or Datadog queries — tell me what real-world metric would indicate it's working, and what a healthy number looks like.

Push for concrete, measurable targets. Refuse to write Outcomes that are vanity metrics, tooling-coupled, or unmeasurable.

### Validation

- `safeword check` validates: Outcomes section exists OR is `skip:`-annotated.
- Each Outcome should be reviewable against the three criteria (tooling-agnostic / measurable / meaningful) — surfaced as a Phase 1 review check (could feed into 0AWSY8 epic's review rubric).

## Out of scope

- The signals skill itself — 1W107W.
- Specific outcome examples per industry — keep guidance generic.
- Auto-suggesting outcomes from JTBD/AC — humans declare.

## Done when

- Outcomes is a documented spec section (location per storage decision).
- Phase 0 flow includes the Outcomes-authoring sub-step with coaching.
- Phase 0 exit gate validates Outcomes presence (or skip annotation).
- Worked example shows good (concrete, measurable) vs bad (vanity, tooling-coupled) Outcomes.

## Open questions

- **Cross-epic relocation** — should this ticket move to DZ2NM5 (Phase 0 epic) instead of staying here? Driver leans here (where the signals work depends on it); user may prefer relocate.
- **Number of outcomes** — minimum 1, maximum N? Arcade has no cap; safeword could match.
- **Outcome severity tiers** — distinguish "critical" outcomes (page oncall) from "informational" (dashboard only)? Driver leans no for v1 — treat all outcomes equally; severity emerges from alert thresholds in the signals work.

## Work Log

- 2026-05-24T21:44:38.429Z Started: Created ticket 7VRXF6
- 2026-05-24T21:45:00.000Z Drafted: Scope (3 criteria + coaching + validation), placement note, 3 open questions; linked to epic S4997T
