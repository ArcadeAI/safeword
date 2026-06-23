---
id: '169'
slug: pm-grade-intake
title: 'Epic: PM-grade intake protocol'
type: Feature
status: open
epic: pm-grade-intake
---

# Epic: PM-grade intake protocol

**Type:** Feature (epic — shell, not yet scoped)

**Goal:** Make Clarify the part of safeword people brag about. Today it's propose-and-converge with five contribution techniques (failure modes, boundaries, scenarios, regret, UX) that produces `scope` / `out_of_scope` / `done_when` frontmatter. A PM-grade intake also surfaces: who asked, what user-facing problem this solves, the success metric, what changes if we don't build it, and an explicit reversibility/regret read. The output is an intake brief, not just frontmatter.

**Context:** The `elicit` and `brainstorm` skills already extract tacit knowledge and explore options. This epic ties Clarify + `elicit` + `brainstorm` into one named intake protocol with a real artifact.

## Open questions (to resolve when this epic is Clarified)

- Upgrade Clarify in place, or add a pre-Clarify "Intake" phase that writes a brief doc?
- Does the brief replace the ticket frontmatter, or sit alongside it?
- Which sizes need the full intake? (Likely features only; tasks/patches stay lean.)
- What's the minimum brief — three questions? A template?

## Child tickets

- **TPP6Y2** `pm-grade-intake-readiness-gate` — **done** (PR #311, merged). First child: surfaces a compressed five-dimension readiness self-test (intent · done · what-must-not-break · riskiest-assumption+cheapest-test · problem-or-guess) via the prompt hook during Clarify, with a value-of-information triage in SAFEWORD.md. Established the bounded five-dimension core the rest of the epic builds on.

### Spun off from TPP6Y2 (not yet filed)

- **Cold-start executability test** — for high-blast work, verify sufficiency by checking whether a fresh agent with no conversation history could execute from the captured context (reuse the worktree sub-agent harness). Deferred as a second mechanism too heavy for the common case.
- **PM intake-brief artifact** — the heavier brief (who asked / problem / success metric / reversibility) the epic goal describes, beyond the lightweight pointer. This is the artifact half of "an intake brief, not just frontmatter."
