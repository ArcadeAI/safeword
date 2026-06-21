# TPP6Y2 Research — Intake Readiness Gate

Raw evidence and source material behind the readiness-gate design. The *synthesized* conclusions live in the ticket (`../ticket.md`) and in three project learnings (`.project/learnings/intake-readiness-*.md`); this folder holds the **raw findings** and **verbatim skill copies** they were drawn from, so the design is auditable without re-running the searches.

## Layout

| File | Contents |
| --- | --- |
| `findings-agent-clarification.md` | When agents should ask vs. act: CaRT, Value-of-Information, over/under-questioning, structured-vs-internal reasoning, **constraint decay**, cost-of-defect, 2026 coding-workflow consensus |
| `findings-leadership.md` | Mission command, situational leadership, high-performer traits, Project Aristotle / psychological-safety trap |
| `findings-product-management.md` | Cagan Opportunity Assessment (10 questions, lightweight), JTBD, Torres OST, Working Backwards, RICE |
| `findings-architect-consultant.md` | Requirements elicitation, NFRs / fit criteria, problem-behind-the-problem, technical vs non-technical requester |
| `findings-skills-review.md` | What was folded / rejected from each skill below |
| `skills/` | Verbatim copies of every skill checked |

## Skills captured (`skills/`)

| File | Source | Verdict |
| --- | --- | --- |
| `safeword-elicit.SKILL.md` | safeword | Reuse its rules (Iron Law, info-gain ordering, anchoring guard, stopping rule); escalate to it |
| `safeword-brainstorm.SKILL.md` | safeword | Folded two guards (divergence off-switch; don't announce framework) |
| `safeword-figure-it-out.SKILL.md` | safeword | The decision method used for the passes |
| `anthropic-doc-coauthoring.SKILL.md` | Anthropic example (`/mnt/skills/examples`) | Folded behavioral go/no-go (`:97`) + cold-start test (`:255-331`); rejected dump-first ordering |
| `anthropic-product-brainstorming.SKILL.md` | Anthropic (pasted by user) | Resisted most (divergent machinery); folded "cheapest test" onto riskiest-assumption |
| `anthropic-product-self-knowledge.SKILL.md` | Anthropic public (`/mnt/skills/public`) | Irrelevant (docs-routing); captured for completeness |

## The converged design (for quick reference)

Five plain-English, blast-radius-gated self-test prompts: **intent · done (measurable) · constraints (what must not break) · riskiest assumption + cheapest test · request-shape (problem vs solution-in-disguise)**. Behavioral go/no-go (ready when remaining questions are edge-cases, not basics). Reuses elicit's asking discipline; silent during divergence; cold-start sub-agent escalation for high-blast work.

## Provenance note

Findings were gathered via web search during four `/figure-it-out` passes on 2026-06-21. Where evidence was thin or contested it is flagged inline (e.g. the cost-of-defect multipliers are "sparse and very old"; the structured-scaffold-vs-internal-reasoning question is unsettled as of 2026). URLs are preserved in each findings file for re-verification.
