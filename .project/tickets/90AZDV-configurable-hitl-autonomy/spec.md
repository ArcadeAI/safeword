# Spec: Let users choose where to require human review vs. full autonomy

## Intent

Make safeword's implicit theory of where humans belong (`PRINCIPLES.md:5` — "Gate the irreversible. Nudge the qualitative.") into an explicit, settable policy. A team declares which kinds of decisions the agent must pause on and which it may run autonomously; on autonomous decisions the agent resolves the breakpoint itself with a context-loaded sub-agent instead of stopping. The point is to let users dial autonomy up for low-stakes/overnight/batch work and down to guard scope and design — without losing the protective gates or the irreversible-action confirmations.

## References

- **Supersedes G2E72G** (yolo-mode) — binary on/off becomes one point on this per-axis gradient; keepers (denylist, hard-gates-fire, per-ticket toggle, decision logging) absorbed.
- **2VCSZY** (review-gate-autonomous-posture) — the compensating-control coupling: when the human guard disappears, the independent reviewer turns on.
- **NMSD94** (per-asset-review-gate) — Tier-1/Tier-2 stamp machinery + `crossModelReview` flag this builds on.
- **MR5M3A** (architecture-gate), **171** (subagents-in-the-loop epic).
- Prior art (intake research, 2026-06-16): LangChain/LangGraph HITL (strategic-interrupt placement), AutoGen `human_input_mode` (NEVER/TERMINATE/ALWAYS; start-ALWAYS-then-NEVER), LLM-as-judge literature (real error-catching value, but self-enhancement bias and no formal guarantees).
- Control-ladder evidence (/figure-it-out, 2026-06-16): [Nine Judges, Two Effective Votes](https://arxiv.org/abs/2605.29800) (correlated single-judge errors; debate > static ensemble), [VeriGuard](https://arxiv.org/abs/2510.05156) (formally verified runtime monitoring beats pattern-matching), [Multi-Agent Debate for LLM Judges](https://openreview.net/forum?id=Vusd1Hw2D9), [MIT Sloan](https://sloanreview.mit.edu/article/ai-explainability-how-to-avoid-rubber-stamping-recommendations/) + [confirmation bias & scalable oversight](https://arxiv.org/pdf/2507.19486) (anti-rubber-stamp design).

## Personas

- **Agent-Driven Developer (DEV)** — runs an AI coding agent on a real project; wants safeword to feel like an experienced teammate, not a form to fill in.
- **Safeword Maintainer (SM)** — builds the controls in this repo; needs enforcement defined in one declarative, testable place.

## Vocabulary

- **Axis** — a kind of decision the policy governs (intent/scope, behavioral contract, irreversible design, external side-effects, execution, completion). The unit a user sets.
- **Posture** — what an axis is set to: **ask** (pause for the human) or **autonomous** (the agent resolves the breakpoint itself, then applies the strongest applicable control from the ladder below).
- **Control ladder** — how an _autonomous_ decision is checked, highest applicable tier first: **(1) verify** — gate on a deterministic check of a checkable artifact (citation resolves, test passes, schema validates), no LLM judge; **(2) debate-review** — for judgment with no mechanical check, 2+ cross-model agents debate to consensus before the decision stands; **(3) async-audit** — unverifiable/qualitative calls proceed and are logged into a digest the human samples after the fact.
- **Preset** — a named bundle of per-axis postures (e.g. "Guard design", "Hands-off") that a user picks instead of setting axes one by one. Axes are the power-user escape hatch underneath.
- **Denylist** — irreversible/outward actions that always confirm with the human regardless of posture.

## Jobs To Be Done

### hitl.DEV1 — Set the autonomy posture once, by picking a named stance

**Persona:** Agent-Driven Developer (DEV)

> When I adopt safeword on a project, I want to choose how much the agent checks
> with me by picking a named posture rather than configuring every decision-kind,
> so I can match the guardrails to my team's risk tolerance in one move and only
> drop to the fine knobs if I need to.

#### hitl.DEV1.AC1 — A small set of named presets is selectable at the project level and recorded in committed config

#### hitl.DEV1.AC2 — Each preset maps to a per-axis posture a user can inspect

#### hitl.DEV1.AC3 — A user can override an individual axis without abandoning the preset for the rest

#### hitl.DEV1.AC4 — With no policy set, the project defaults to the most human-in-the-loop preset (autonomy is opt-in, earned)

### hitl.DEV2 — Tune my own comfort without changing the team's policy

**Persona:** Agent-Driven Developer (DEV)

> When my comfort with autonomy differs from my team's committed default, I want
> to loosen or tighten the gates just for myself, so I can work the way I want
> without committing that change to the repo or forcing it on teammates.

#### hitl.DEV2.AC1 — A personal policy layers on top of the project policy, with personal taking precedence

#### hitl.DEV2.AC2 — The personal override lives in a location that is never committed to the repository

#### hitl.DEV2.AC3 — With no personal override present, the project policy governs unchanged

### hitl.DEV3 — Run hands-off and have the agent resolve its own questions

**Persona:** Agent-Driven Developer (DEV)

> When I set an axis to autonomous and the agent hits a question it would normally
> ask me, I want it to resolve the question itself with the full context it needs
> and keep going, so I can run low-stakes or overnight work without babysitting.

#### hitl.DEV3.AC1 — On an autonomous axis, a breakpoint that would prompt the human is instead resolved by a sub-agent that runs /figure-it-out

#### hitl.DEV3.AC2 — The sub-agent receives a defined, complete context payload (the question, ticket/spec, relevant prior decisions, constraints) — not an ad-hoc subset

#### hitl.DEV3.AC3 — Every autonomous resolution is recorded with the question, options considered, the pick, and the rationale

### hitl.DEV4 — Trust that an autonomous call gets the strongest check that fits it

**Persona:** Agent-Driven Developer (DEV)

> When I let the agent run autonomously on a high-leverage decision (scope, design,
> the behavioral contract), I want it checked by the strongest control that actually
> fits the decision — a hard verification where one exists, a genuine adversarial
> review where it doesn't — so being hands-off doesn't mean flying blind or leaning
> on a rubber stamp.

#### hitl.DEV4.AC1 — When the decision produces a checkable artifact, autonomy gates on a deterministic verification (the artifact's check), not an LLM judgment

#### hitl.DEV4.AC2 — When no mechanical check exists, the decision is reviewed by 2+ cross-model agents debating to consensus — not a single reviewer (correlated single-judge review is rejected as insufficient)

#### hitl.DEV4.AC3 — The control applied to each autonomous decision is recorded, so the user can see whether a call was verified, debated, or only logged

### hitl.DEV6 — See and correct what ran autonomously, without rubber-stamping

**Persona:** Agent-Driven Developer (DEV)

> When the agent has made autonomous calls I couldn't verify in the moment, I want
> to review them after the fact in a way that resists rubber-stamping, so my
> oversight is real and the policy gets better over time.

#### hitl.DEV6.AC1 — Autonomous decisions with no stronger control land in an async digest the user can review after the run

#### hitl.DEV6.AC2 — Accepting a high-stakes audited decision requires an explicit justification, not a one-click approve

#### hitl.DEV6.AC3 — Rejection rate is tracked and surfaced, so a digest that is being rubber-stamped (approve-everything) is visible

### hitl.DEV5 — Never let a hands-off run do something irreversible without me

**Persona:** Agent-Driven Developer (DEV)

> When the agent is about to do something it can't take back — push, delete outside
> the ticket, send an email or Slack, touch secrets or production config — I want it
> to confirm with me regardless of my autonomy settings, so a hands-off run can
> never cause irreversible or outward harm on its own.

#### hitl.DEV5.AC1 — Denylisted actions prompt the human even when every axis is set to autonomous

#### hitl.DEV5.AC2 — The hard protective gates (LOC commit, done gate, verify artifact) still fire under any posture

#### hitl.DEV5.AC3 — Closing a ticket as done always requires explicit human confirmation

### hitl.SM1 — Define the whole policy in one declarative, testable place

**Persona:** Safeword Maintainer (SM)

> When I build and extend these controls, I want the posture policy, its precedence,
> and the sub-agent's context contract defined in one declarative place, so I can
> reason about and test what fires without tracing it through scattered TypeScript.

#### hitl.SM1.AC1 — The project and personal policies resolve through a single documented precedence rule

#### hitl.SM1.AC2 — The sub-agent context contract is defined once (a skill or sub-agent definition), referenced by every breakpoint rather than duplicated

#### hitl.SM1.AC3 — The mapping from axis → posture → control tier (ask / verify / debate-review / async-audit) is inspectable and unit-testable without running a full agent session

## Outcomes

- A user sets a project posture by name; the agent's pausing behavior visibly changes to match.
- A user adds a personal override that changes their own behavior and is absent from `git status`.
- A ticket with autonomous axes runs end-to-end with no human prompts except denylist items and hard gates; every autonomous call is in the log, tagged with the control tier that checked it.
- Autonomous decisions are checked by the strongest control that fits: deterministic verification where an artifact exists, cross-model debate where it doesn't, async human audit for the qualitative residue.
- The async digest resists rubber-stamping (justification-to-accept on high-stakes items, visible rejection rate).
- A project with no policy configured behaves as human-in-the-loop as safeword does today (no silent regression in safety for non-adopters).

## Technical Constraints

### Safety / control ladder

- [ ] Autonomy applies the highest applicable control tier: verify (deterministic) > debate-review (2+ cross-model) > async-audit. Prefer a checkable artifact over a judgment review wherever one can be produced.
- [ ] A single-reviewer check does not satisfy debate-review — correlated errors make one cross-model judge barely more independent than the author ([Nine Judges, Two Effective Votes](https://arxiv.org/abs/2605.29800)).
- [ ] Async-audit is designed against automation bias: justification-to-accept on high-stakes items, tracked rejection rate.
- [ ] Default-when-unset is the most human-in-the-loop preset — autonomy is always opt-in.
- [ ] Denylist and hard gates are posture-independent and cannot be disabled by any policy.
- [ ] v2 north star: VeriGuard-style formally verified policies for the highest-stakes axes ([VeriGuard](https://arxiv.org/abs/2510.05156)) — out of scope for v1, recorded so the tier-1 design doesn't foreclose it.

### Dependencies

- [ ] Builds on the existing review-stamp / `crossModelReview` machinery (NMSD94), not a parallel mechanism.
- [ ] Reuses `/figure-it-out` for autonomous resolution rather than a new decision engine.

### Data

- [ ] Personal override stored outside version control (e.g. a gitignored local config); precedence personal > project.

## Open Questions

- defer: which decisions on each axis have a checkable artifact (tier-1 verify) vs. need debate-review (tier-2) — the per-axis ladder mapping; pin during define-behavior with worked examples.
- defer: exact preset names and their per-axis posture maps — pin during define-behavior with worked examples.
- defer: storage shape and filename for project vs. personal policy (e.g. `.safeword/config.json` + gitignored `config.local.json`) — implementation detail, confirm at scenario-gate.
- defer: failure mode when the sub-agent's /figure-it-out is inconclusive, errors, or times out (abort-to-user vs. retry vs. skip-with-default) — carried from G2E72G; pin during define-behavior.
- defer: cost/latency budget for debate-review on long autonomous runs (2+ agents × exits; was ~50–100k tokens for a single review) — measure before adding a ceiling (v2).
