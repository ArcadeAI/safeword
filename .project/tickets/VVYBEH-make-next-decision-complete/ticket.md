---
id: VVYBEH
slug: make-next-decision-complete
type: task
phase: done
status: done
created: 2026-09-08T00:56:14.871Z
last_modified: 2026-09-08T01:21:49.000Z
scope: |
  Refine the canonical Talking to the user guidance and shared decision-brief
  prompt so a structured Next paragraph carries enough concrete context to be
  understood and acted on by itself. Sync the dogfood, Claude, and Codex copies.
out_of_scope: |
  - A fixed word count.
  - A semantic validator or new runtime enforcement machinery.
  - Changes to the CONFIDENT/BLOCKED labels or non-Next fields.
  - Unrelated agent tone or workflow changes.
done_when: |
  - Next is explicitly self-contained for a reader without conversation history.
  - Decision cases name the recommendation, controlling reason, material tradeoff,
    concrete consequences, and exact reply; no-decision cases collapse to one action.
  - Canonical, dogfood, Claude, and Codex copies agree.
  - Focused contract tests, release parity, formatting, lint, and typecheck pass.
---

# Make Next decision-complete for users

**Goal:** Make every structured Next paragraph self-contained, concrete, and concise enough to act on without conversation history.

**Why:** Users should not have to scroll or decode vague references before making a decision or taking the next action.

## Work Log

- 2026-09-08T00:56:14.871Z Started: Created ticket VVYBEH
- 2026-09-08T00:57:00.000Z Decided: Keep enforcement prompt-level. A semantic validator is brittle; a live cross-model eval adds disproportionate cost for this bounded copy contract.
- 2026-09-08T00:57:00.000Z Implemented: Updated the canonical handbook and decision-brief grammar, added focused regression coverage, regenerated Claude/Codex bundles, and reconciled dogfood copies.
- 2026-09-08T01:21:49.000Z Verified: Focused contract tests, release parity, formatting, lint, typecheck, generated-copy parity, and the diff-scoped audit passed. The full package suite was attempted but hit unrelated host-level process and timeout failures documented in verify.md.
- 2026-09-08T01:21:49.000Z Completed: Marked ticket VVYBEH done under the user's explicit instruction to proceed through the whole ticket.

## Tests

- [x] The generated contract tells a reader how to act without prior conversation.
- [x] The generated contract defines concrete decision inputs.
- [x] The generated contract omits non-material details and collapses obvious actions.
- [x] Generated plugin manifests and templates retain release parity.

## Design evidence

- [Anthropic prompting guidance](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables): specify the desired outcome and format; examples help when format steering needs more support.
- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.5): prefer outcome, success criteria, constraints, and stopping rules over detailed procedures.
- [Digital.gov plain-language guidance](https://digital.gov/guides/plain-language/writing): active voice and short, familiar language make responsibility and action clear.

**Premortem:** The rule fails if models treat every decision input as a mandatory field; the material-detail cutoff and no-decision exception prevent that failure without another validator.
