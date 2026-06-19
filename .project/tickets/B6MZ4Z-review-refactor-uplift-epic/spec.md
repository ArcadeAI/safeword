# Spec: Borrow find→verify discipline into review & refactor skills

## Intent

Port the _discipline_ behind Claude Code's `/code-review` and `/simplify` — diverse candidate generation and evidence-gated, abstention-aware verdicts — into safeword's `quality-review` and `refactor` skills. Import the ideas, not the machinery: the current evidence shows multi-agent consensus, voting, and effort knobs are net-negative for skills like ours, while a few small borrows are clearly net-positive. It matters because these two skills should reflect best current practice against the patterns shipping in Claude Code itself.

## References

- Sub-epics: [D9NE6D — refactor: abstraction smell](../D9NE6D-refactor-abstraction-smell-epic/ticket.md) · [NX15EF — quality-review: provenance gate](../NX15EF-quality-review-provenance-gate-epic/ticket.md)
- Prior art in repo: `X4518B-native-review-overlap-positioning`, `ZBVGPF-embed-figure-it-out`
- Source skills compared: [quality-review/SKILL.md](../../../.claude/skills/quality-review/SKILL.md), [refactor/SKILL.md](../../../.claude/skills/refactor/SKILL.md)

**Evidence record (web research, 2026-06-18):**

| Claim used in the decision                                                                         | Source                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Evidence-grounded multi-agent verify cuts false positives ~88.6% at ~3% recall cost                | [QASecClaw](https://arxiv.org/html/2605.01885v1); [Static-bug FP study](https://arxiv.org/pdf/2601.18844)                                        |
| Naive multi-agent _consensus_ can underperform the best single member (−37.6% synergy gap)         | [Multi-Agent Teams Hold Experts Back (arXiv:2602.01011, Feb 2026)](https://arxiv.org/abs/2602.01011)                                             |
| Recall is gated at _find_, not _verify_ — no verification recovers an unsampled solution           | [When To Solve, When To Verify](https://arxiv.org/pdf/2504.01005)                                                                                |
| Verification has steep diminishing returns (~8× compute to match self-consistency)                 | [Budget-aware Test-time Scaling](https://arxiv.org/pdf/2510.14913)                                                                               |
| LLM judges are systematically overconfident; abstain state + evidence is the fix                   | [Overconfidence in LLM-as-Judge](https://arxiv.org/html/2508.06225v2); [Calibrating LLM Judges](https://arxiv.org/pdf/2512.22245)                |
| "Altitude" = established smell: Dubious / Wrong-Level-of-Abstraction, detected via Shotgun Surgery | [Dubious Abstraction](https://luzkan.github.io/smells/dubious-abstraction/); [Shotgun Surgery](https://luzkan.github.io/smells/shotgun-surgery/) |

**Provenance:** `/code-review` + `/simplify` details were reconstructed from the compiled `@anthropic-ai/claude-code` binary (v2.1.170) and cross-checked against the [Piebald-AI extraction](https://github.com/Piebald-AI/claude-code-system-prompts). Those prompts are © Anthropic PBC (all rights reserved) — this epic borrows patterns only, never verbatim text.

## Personas

Descriptive at intake (formal persona codes from the configured personas file are assigned at define-behavior):

- **Safeword maintainer** — edits the skills; needs in-philosophy, low-bloat changes that survive parity sync across Claude/Codex/Cursor.
- **Skill user** — runs `/quality-review` or `/refactor`; wants trustworthy signal, not machinery.

## Vocabulary

- **find→verify** — generate diverse candidates, then judge them; recall is gated at the find stage.
- **Altitude / wrong-level-of-abstraction** — a fix applied at the wrong depth (special-casing shared infra instead of generalizing).
- **Provenance gate** — verdict severity bounded by how the supporting claim was sourced (verified vs training-data vs uncertain).

## Jobs To Be Done

### review-refactor-uplift.maintainer1 — Borrow only what the evidence supports

> When I update these skills against Claude Code's patterns, I want to adopt just the borrows that improve outcomes and reject the ones that don't, so I avoid bloating two deliberately-lean skills.

### review-refactor-uplift.user1 — Trust the output

> When I run `/quality-review`, I want a blocking verdict to be backed by a verified source (not an overconfident guess); and when I run `/refactor`, I want the catalog to name the structural problem I actually hit, so the skills earn my trust.

## Outcomes

- `refactor` gains an abstraction-altitude smell with a citable definition; its safety loop is untouched.
- `quality-review` verdicts are gated on evidence provenance; research is angle-structured; the different-model reviewer stays.
- No effort levels, voting committees, or parallel execution added anywhere.

## Open Questions

- defer: formal persona-code + acceptance-criteria authoring → define-behavior phase (this epic is at intake; the two sub-epics carry the engineering contract).
- defer: whether R2 (refactor scout) and Q2 (research angles) ship in this epic or split into follow-ups — decide after R1/Q1 land.
