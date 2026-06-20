---
id: 2YQJGV
slug: elicit-information-gain-questions
type: task
phase: intake
status: done
parent: B6MZ4Z
created: 2026-06-19T14:24:17.100Z
last_modified: 2026-06-19T14:24:30Z
---

# Elicit skill: prioritize questions by information gain + anchoring guard

**Goal:** Make `elicit` ask the most _discriminating_ question first (highest expected information gain) and guard its multiple-choice format against the anchoring it can introduce — the convergent mirror of `debug`'s disconfirm-first.

**Why:** `elicit` walks a question-angle taxonomy (Intent/Constraints/Priorities/Audience/Omissions) but never prioritizes by which answer most reduces uncertainty — and LLMs are documented to be _bad_ at this by default ([Expected Information Gain](https://arxiv.org/abs/2406.17453), [Active Task Disambiguation](https://arxiv.org/pdf/2502.04485)). Separately, its "pre-think the options so the user reacts" advice cuts cognitive load but introduces **anchoring** — a top requirements-elicitation bias ([On Cognitive Biases in Requirements Elicitation](https://link.springer.com/chapter/10.1007/978-3-030-26574-8_9)); pre-supplied options can lead the user past the answer you didn't list.

**Parent:** [B6MZ4Z — reasoning-skills uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md)

## Scope

| Item | Change                                                                                                                                                                                      | Confidence |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E1   | Phase 1: order questions by expected information gain — ask the one whose answer most discriminates between the live options / most changes the next decision, not just walk the angle list | Med-High   |
| E2   | Anchoring guard on the multiple-choice format: options must be non-leading and roughly MECE, and always carry a real "none of these / something else" escape so the frame is rejectable     | Med        |

## Out of scope / rejected

- A formal Bayesian/EVPI scorer — the principle ("ask the most discriminating question") is the borrow, not the math.
- Replacing multiple-choice with open questions — the format is good; E2 guards it, doesn't remove it.

## Done when

- Phase 1 instructs ordering by information gain (most-discriminating-first), framed as the convergent mirror of `debug`'s disconfirm-first.
- The question-format guidance requires non-leading, MECE-ish options + a real escape hatch.
- Questions stay tool-neutral (describe 3–5 options + the escape; no `AskUserQuestion`/tool dependency) so they render as text on Codex/Cursor, not just Claude.
- SKILL.md edit has Codex (`.agents/skills/`) + Cursor (`.mdc`) parity copies synced.

## Work Log

- 2026-06-19 Created task under B6MZ4Z from the `/figure-it-out` reasoning-skills pass (elicit follow-on).
- 2026-06-19 Implemented E1 + E2 in the elicit template Phase 1: E1 — ask the most _discriminating_ question first (highest information gain), counter the LLM default to low-information questions, framed as the convergent mirror of `debug`'s disconfirm-first; E2 — anchoring guard on the multiple-choice format (non-leading, MECE-ish options + a real "none of these" escape). Synced byte-parity → `.claude` + `.agents`. Cursor rule uses the `@`-reference pattern (no body edit needed — it pulls the updated skill). parity 157; tests green (596). Status in_progress pending `/verify` + user confirmation.
