---
id: 3HM021
slug: judge-work-against-its-authoring-rubric
type: feature
phase: implement
status: in_progress
phase_anchors:
  - intake: .project/tickets/3HM021-judge-work-against-its-authoring-rubric/ticket.md
  - define-behavior: .project/tickets/3HM021-judge-work-against-its-authoring-rubric/spec.md
  - scenario-gate: features/shared-scenario-quality.feature
  - plan-implementation: .project/tickets/3HM021-judge-work-against-its-authoring-rubric/impl-plan.md
created: 2026-08-18T05:22:41Z
last_modified: 2026-08-27T00:00:00Z
external_issue: https://github.com/ArcadeAI/safeword/issues/3119
scope:
  - Give scenario authors the same scenario-quality standard before they write that the independent scenario gate later applies.
  - Make the canonical review-spec skill, not a runtime summary, the scenario-gate reviewer's rubric.
  - Give that reviewer the project-knowledge context required by the shared rubric.
  - Align define-behavior and scenario-gate reminders and exit evidence with the shared standard.
out_of_scope:
  - Generalizing the shared-skill mechanism to quality-review or plan-implementation.
  - Renaming review-spec or changing its public command.
  - Generating complete skill prose from hook contracts.
  - Replacing the existing configuration-controlled review-stamp gate with a new always-on, content-versioned transition gate.
done_when:
  - The define-behavior workflow loads review-spec in authoring mode before generating scenarios.
  - Author and independent reviewer receive the same canonical scenario-quality skill.
  - Scenario review packets carry current spec, principles, personas, and surfaces as bounded context.
  - Define-behavior and scenario-gate prompts announce the evidence their exits require.
  - Targeted tests prove the shared skill reaches authoring, reviewer prompting, and phase evidence surfaces.
---

# Judge work against its authoring rubric

Use one shared scenario-quality standard from authoring through independent review, so the gate never surprises the agent with rules it did not see before writing.

## Work Log

- 2026-08-27T22:00:00Z Recorded the reconstructed phase artifacts and review provenance for the resumed GitHub issue before delivery; full repository verification passes 8,616 tests.
- 2026-08-27T00:00:00Z Resumed from GitHub #3119 after design exploration. User chose a shared-skill pilot for define-behavior → scenario-gate; implementation starts from current origin/main.
- 2026-08-27T16:06:00Z Independent Claude scenario review requested changes: replace presence checks with canonical byte identity, add drift/negative coverage, split phase assertions, and cover public/generated surfaces.
- 2026-08-27T16:12:00Z Third scenario pass accepted R2 as well-falsified. Kept a new always-on content-versioned gate out of this pilot; added the missing Authoring-mode positive control, define-behavior exit evidence, and failing-review workflow behavior.
- 2026-08-27T16:27:00Z Independent Claude scenario gate approved the shared-standard contract after byte-identity, freshness, unusable-input, phase-binding, and generated-surface cases were made falsifiable. Implementation begins from the approved scenarios.
