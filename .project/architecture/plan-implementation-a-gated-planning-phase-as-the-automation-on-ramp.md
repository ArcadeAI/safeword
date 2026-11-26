# plan-implementation: a gated planning phase as the Automation on-ramp

**Status:** Accepted — transition and six-section artifact portions superseded by [Separate Implementation and Execution Planning Gates](separate-implementation-and-execution-planning-gates.md) (2026-09-10); rationale, project-local authority, and content-hash history stand
**Date:** 2026-07-09

**Original phase contract.** The original workflow inserted a `plan-implementation` phase between `scenario-gate` and `implement` (issue #480, ticket TXRHMD). The phase owned `impl-plan.md` authoring (now six content-or-skip sections incl. Doc impact), the ADR lifecycle (significance-tested emission from `adr-template.md` into the `paths.architecture` location, supersede-never-edit, date-prefixed directory filenames), relevance-scoped skill surfacing, and the review-before-handoff exit with the default-off `designApprovalGate`. A pre-tool transition gate blocks `phase: implement` until the plan parses valid with status `planned`; scenario-gate becomes a pure behavior-quality gate.

**Why.** At scenario-gate exit, one stamp covered both behavior quality and implementation design. Planning items came late in a five-step checklist, where adherence measurably declines. Resuming mid-plan showed the wrong phase. Evidence: gated artifacts carry value where ungated prose is noise (Spec-Kit ablation, arXiv 2604.05278); plan-mode convergence across harnesses. This **supersedes the placement half** of the decomposition-retirement ADR above: its objections are each answered — this phase carries a hard-gated artifact (decomposition had none), architecture _design_ stays at intake (no duplication), and the phase is the Automation practice's on-ramp, not a fourth BDD practice.

**Trade-off.** One more phase for feature tickets (tasks/patches exempt; legacy features without spec.md grandfathered). In-flight tickets at scenario-gate pass through the new phase doing work they already owed; the one-step provenance denial self-explains the migration.

**Alternatives.** Gate-only hardening without a phase (rejected: resume/reminder/review-stamp state stays wrong — the checklist decay this fixes); relocating architecture-guide consumption into the phase per the issue text (rejected: recreates the intake duplication the retirement ADR correctly killed).

**Implementation.** `CANONICAL_PHASES`/`BddPhase`/`PHASE_EVIDENCE` enum insertion; `hooks/lib/plan-gate.ts` + pre-tool wiring; stop/boundary list memberships + planning code freeze; `parseImplPlan` optional-section support; `PLAN_IMPLEMENTATION.md` phase doc (trio + Cursor rule); `adr-template.md`; `designApprovalGate` config doc. Decision trail: ticket TXRHMD spec.md decisions 1-23 (four /figure-it-out passes, 2026-07-08).

**The Three Amigos, played by one agent.** In canonical BDD, business, development, and testing discuss concrete examples before writing code. In Safeword, one agent takes all three perspectives:

- **Product/business** — split with the human: the agent frames personas → JTBD → acceptance criteria in intake and uses `/elicit` to extract intent, but the user signs off at each propose-and-converge gate.
- **Development** — the agent's own proposal; `/figure-it-out` for design calls; the architecture survey-and-reconcile step.
- **Testing/QA** — the `scenario-gate`: AODI checks plus the adversarial "what breaks that none of these scenarios catch?" pass and the negative-case-coverage rule.

**Where the simulation is weaker than a real room** (the deliberate, accepted divergences):

1. **Correlated blind spots** — Different reviewers can catch one another's mistakes. One model can make the same mistake in every role.
2. **The human reacts rather than contributes** — the agent has to ask about rules the human might otherwise leave unstated. `/elicit` helps it ask.
3. **No naive-question friction and no _held_ disagreement** — the agent resolves its own debate instantly; `/figure-it-out`'s steelman-both-sides is one mind arguing with itself.
4. **Unknowns aren't tracked** — Example Mapping's red "question cards" give a readiness signal safeword lacks; ticket V6N5PW addresses this.

safeword accepts this trade — **consistency and enforcement over independent blind-spot coverage** — because an autonomous agent cannot convene independent humans, and the mitigations (adversarial pass, `/elicit`, `/figure-it-out`, user sign-off gates) recover much of the value.
