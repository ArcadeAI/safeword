# Spec: Suppress repeated stop-quality prompts in a session

## Intent

Keep the Claude Code stop-quality gate effective without repeatedly injecting
the same full decision-brief template after the assistant has already provided
it. The gate should correct the response that needs correction, not create
noise on a compliant one.

## Intake Brief

- **Requested by:** The `safeword retro burn down` automation, after it grouped #1089 with repeated stop-format reports.
- **Cost of inaction:** Every compliant edited-work stop pays for the same large prompt, obscuring actionable gates and adding avoidable context overhead in long sessions.
- **Reversibility:** Two-way door — an isolated hook decision and its tests can be reverted without changing stored data, the public CLI, or installed configuration.

## References

- [GitHub #1089](https://github.com/ArcadeAI/safeword/issues/1089) — canonical report; the triage found 67 duplicate reports across the current open retro backlog.
- `/figure-it-out` research: [W3C clear-content guidance](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/) and [Nielsen Norman's usability heuristics](https://media.nngroup.com/media/articles/attachments/Heuristic_Summary1_Letter-compressed.pdf) favor succinct, relevant instruction; `.project/learnings/long-session-style-drift.md` documents why the hook reminder itself remains necessary.
- `packages/cli/templates/hooks/stop-quality.ts` and `packages/cli/templates/hooks/lib/quality.ts` — current Claude Code prompt and stop decision path.

## Personas

Technical Builder (TBU)

## Surfaces

Affected:

- Claude Code — this is the only runtime that invokes `stop-quality.ts`.

Unaffected:

- OpenAI Codex — it does not invoke the Claude quality-prompt path.
- Cursor — its adapter has independent follow-up-message and edit-marker semantics.

## Vocabulary

Decision brief — the final CONFIDENT or BLOCKED response shape defined by the
quality stop hook. This ticket uses the glossary's existing meanings of Hook,
Gate, and Stop phase.

## Jobs To Be Done

### suppress-repeated-stop-quality-prompt.TBU1 — Finish an edited-work turn without redundant guidance

**Persona:** Technical Builder (TBU)

> When I finish an edited-work turn with a complete decision brief, I want the
> stop gate to recognize it, so I can continue working without repeatedly
> reading the same corrective template.

#### suppress-repeated-stop-quality-prompt.TBU1.R1 — A compliant decision brief does not trigger another quality prompt

#### suppress-repeated-stop-quality-prompt.TBU1.R2 — An incomplete decision brief still receives the corrective quality prompt

#### suppress-repeated-stop-quality-prompt.TBU1.R3 — Done-phase hard gates take precedence over a compliant brief

## Rave Moment

skip: table-stakes internal workflow refinement; the value is absence of noise,
not a distinct delight moment.

## Outcomes

- A complete CONFIDENT brief (`CONFIDENT`, `Decided`, `Open`, and `Next`) is accepted on a non-done edited-work stop without another quality continuation.
- A complete BLOCKED brief (`BLOCKED`, `Tried`, and `Need`) is accepted on the same path.
- A response missing the required shape retains the current corrective prompt.
- Done-phase hard gates and non-Claude adapters retain their existing behavior.

The recognition check applies only to a later ordinary Stop invocation after a
quality continuation (`stop_hook_active: false`). The existing
`stop_hook_active: true` bypass guards the immediate continuation cycle and is
not evidence that a later compliant response was recognized.

## Open Questions

None. The issue, current hook input, and existing quality message define the
required response shapes; compatibility scope is intentionally Claude Code only.
