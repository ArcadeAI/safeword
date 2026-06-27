---
id: V9MP7T
slug: align-phase-review-surface
type: task
phase: intake
status: in_progress
created: 2026-06-26T05:38:46.034Z
last_modified: 2026-06-26T05:44:00.000Z
relates_to:
  - SXSCJQ
  - JENFZX
external_issue: https://github.com/ArcadeAI/safeword/issues/465
scope:
  - Align generic phase review surfacing with phase-exit evidence instead of phase-entry timing. Today `post-tool-quality.ts` emits `getQualityMessage(phase)` when a `ticket.md` edit enters a phase, but several phase messages ask for evidence that only exists at phase exit.
  - Keep lightweight per-turn phase reminders from `prompt-questions.ts`; they are state guidance, not review prompts.
  - Keep real phase work and gates intact: intake user sub-phase gates, scenario-gate `/review-spec`, verify `/verify` + `/audit`, done gate, and any configured review-stamp gates.
  - Change generic hook-injected phase reviews so they surface only when they are actionable: phase-exit summaries, real blockers, anomalies, or user/scope decisions.
  - Audit each phase's current review prompt for timing correctness: `intake`, `define-behavior`, `scenario-gate`, `verify`, and `done`. Document which phases should have no generic hook review because their real gate already owns the review.
out_of_scope:
  - Quieting implement-phase TDD step prompts; owned by `JENFZX-quiet-implement-review-surface`.
  - Removing `/review-spec`, `/verify`, `/audit`, done-gate checks, or review-stamp gates.
  - Changing TDD step review content or implementation-exit `/quality-review` + `/refactor` workflow.
  - Broad BDD phase redesign; this is surfacing/timing, not phase model changes.
done_when:
  - Entering `define-behavior`, `scenario-gate`, or `verify` no longer injects a user-facing review prompt that asks for end-of-phase evidence that does not exist yet.
  - Exiting a phase can still surface a concise summary when the agent has evidence to report, or a blocker/anomaly when the user needs to act.
  - Phase reminders still appear through `prompt-questions.ts` for active tickets.
  - Scenario-gate independent review, verify `/verify` + `/audit`, done gate, and configured review-stamp gates still run and surface as before.
  - Tests cover phase-entry suppression, phase-exit/actionable surfacing, and preservation of non-review reminders and hard gates.
---

# Align phase review prompts with phase exits

**Goal:** Stop generic phase review prompts from firing at phase entry when their evidence only exists at phase exit.

**Why:** Outside implementation, the interruption rate is lower, but the semantics are still off: the hook can ask for scenario quality, AODI pass, or `/verify` evidence immediately after entering the phase that is supposed to produce that evidence.

## Decision

Keep phase guidance and real gates; remove mistimed generic reviews.

- **Keep:** one-line prompt reminders, intake confirmation gates, scenario-gate `/review-spec`, verify `/verify` + `/audit`, done evidence gates, configured review stamps.
- **Change:** generic hook-injected `CONFIDENT/BLOCKED` phase review prompts that fire because `phase:` changed in `ticket.md`.
- **Surface:** only phase-exit summaries, blockers, anomalies, and user/scope decisions.

## Related history

- `SXSCJQ-remove-loc-review-throttle` moved review surfacing to boundary detection. This ticket narrows when non-implement boundaries should surface to the user.
- `JENFZX-quiet-implement-review-surface` owns the implementation-phase version of this problem; do not broaden it.

## Work Log

- 2026-06-26T05:44:00.000Z Mirrored: Created GitHub issue #465 and recorded it as `external_issue`.
- 2026-06-26T05:42:00.000Z Scoped: Created as a sibling to JENFZX after confirming other phases have a lower-frequency but similar timing problem: generic hook reviews fire on phase entry while their evidence templates are mostly phase-exit shaped.
- 2026-06-26T05:38:46.034Z Started: Created ticket V9MP7T
