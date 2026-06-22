# Raw findings: skills review (safeword + Anthropic skills)

Cross-check of the readiness-gate design against existing skills. Full copies in `./skills/`. Folded decisions are in the ticket Scope/Out-of-scope.

## safeword/elicit (`skills/safeword-elicit.SKILL.md`)

The gate REUSES elicit rather than duplicating it. Inherited rules:

- **Iron Law** (`:11`): "NEVER ASK A QUESTION YOU COULD ANSWER YOURSELF." → gate surfaces only user-only unknowns, after reading code/docs/git.
- **Information-gain ordering** (`:28`): "ask the most discriminating question first… LLMs default to low-information questions — counter that deliberately."
- **Anchoring guard** (`:50`): pre-supplied options lead; always offer "none of these."
- **Stopping rule** (`:54`): ask until answers converge / enough to distinguish / user says go. Typical 3-7.
- Elicit's "what to ask about" axes (Intent, Constraints, Priorities, Audience, Omissions) ≈ the gate's five prompts — shared vocabulary, not parallel.
- Decision: gate = threshold + dimensions; **escalates to** `/elicit` only for high-blast user-only unknowns. Does NOT auto-fire elicit on normal turns (premortem guard).

## safeword/brainstorm (`skills/safeword-brainstorm.SKILL.md`)

Two guards folded:

- **Divergence off-switch** (`:23`, "user controls convergence"): the gate is a convergence device; it stays silent while the user is exploring; activates at the brainstorm→build handoff.
- **Don't announce the framework** (`:49`): render the five prompts as plain questions, never "running the readiness assessment." (Already house law — reused, not re-derived.)

## Anthropic/doc-coauthoring (`skills/anthropic-doc-coauthoring.SKILL.md`)

The richest external find — two ideas folded (tiered):

- **Behavioral go/no-go** (`:97`): "Sufficient context has been gathered when questions show understanding — when edge cases and trade-offs can be asked about without needing basics explained." → the gate is "go" when remaining questions are edge-cases, not basics. Observable; anti-rubber-stamp.
- **Cold-start executability test** (`:22`, `:255-331` Reader Testing): hand captured context to a fresh Claude with no history, see if it can act. → high-blast escalation: "could a fresh agent run from the captured context?" Reuse the worktree sub-agent harness.
- **Rejected:** doc-coauthoring's **dump-first ordering** (user dumps everything, then agent asks gaps) — inverts safeword's contribute-before-asking; a coding agent can read the code itself.

## Anthropic/product-brainstorming (`skills/anthropic-product-brainstorming.SKILL.md`)

Mostly **out of scope** — divergent-ideation machinery (modes, HMW/SCAMPER/OST/OODA, Frame→Diverge→Provoke→Converge) that belongs to brainstorm, not the convergent gate. Folding it would be bloat + the skill's own "don't dump frameworks" anti-pattern.

- **One fold:** Assumption-Testing mode pairs riskiest-assumption with "the cheapest way to test it before building." → upgraded the gate's assumption prompt from passive flagging to active de-risking (chains into the cold-start test).
- **One reinforcement (no scope change):** OODA's "teams get stuck in Orient — endlessly analyzing" corroborates the anti-over-gating premortem.

## Anthropic/product-self-knowledge (`skills/anthropic-product-self-knowledge.SKILL.md`)

Irrelevant to intake design — it is an Anthropic-product-facts docs-routing skill (Claude Code / API / Claude.ai). Captured for completeness only.
