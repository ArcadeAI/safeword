# Spec: Set an autonomy posture and let the agent resolve trusted decisions on its own

## Intent

The v1 spine of configurable human-in-the-loop (parent epic 90AZDV). A team picks a named autonomy posture; the agent pauses on the axes set to "ask" and resolves the axes set to "autonomous" itself, via a context-loaded sub-agent running `/figure-it-out`. When it cannot decide, it defers to the human rather than guessing. The sophisticated control tiers (verify, debate-review, async-audit) are deliberately out of scope here — v1 autonomous decisions are logged (ladder tier-3) until the follow-up children land.

## References

- **Parent epic:** 90AZDV (configurable-hitl-autonomy) — leverage map, control-ladder design, full research trail.
- **Supersedes G2E72G** (yolo-mode) — binary mode becomes the "Hands-off" preset; keepers (denylist, hard-gates-fire, decision logging) live here.
- Failure-mode grounding: [selective prediction / reject option](https://arxiv.org/pdf/2508.07556), [agent circuit-breaker degraded mode](https://www.mindstudio.ai/blog/ai-agent-failure-pattern-recognition).

## Personas

- **Agent-Driven Developer (DEV)** — runs an AI coding agent on a real project; wants safeword to feel like an experienced teammate, not a form to fill in.
- **Safeword Maintainer (SM)** — builds the controls in this repo; needs enforcement defined in one declarative, testable place.

## Vocabulary

- **Axis** — a kind of decision the policy governs: intent/scope, behavioral contract, irreversible design, execution, completion. (External side-effects is not a dial — the denylist is its floor.)
- **Posture** — what an axis is set to: **ask** (pause for the human) or **autonomous** (the agent resolves it via a sub-agent, then logs the call).
- **Preset** — a named bundle of per-axis postures: **Full review** (all ask; the unset default), **Guard the contract** (ask on intent/scope + behavioral contract + irreversible design; autonomous on execution + completion), **Hands-off** (all autonomous).
- **Denylist** — irreversible/outward actions that always confirm with the human regardless of posture.

## Jobs To Be Done

### autonomy-posture-spine.DEV1 — Set the autonomy posture once, by picking a named stance

**Persona:** Agent-Driven Developer (DEV)

> When I adopt safeword on a project, I want to choose how much the agent checks
> with me by picking a named preset rather than configuring every decision-kind,
> so I can match the guardrails to my team's risk tolerance in one move and only
> drop to the fine knobs if I need to.

#### autonomy-posture-spine.DEV1.AC1 — A named preset selected at the project level is recorded in committed config

#### autonomy-posture-spine.DEV1.AC2 — A preset resolves to a per-axis posture map the user can inspect

#### autonomy-posture-spine.DEV1.AC3 — A user can override an individual axis without abandoning the preset for the rest

#### autonomy-posture-spine.DEV1.AC4 — With no policy set, the project defaults to Full review (every axis = ask)

### autonomy-posture-spine.DEV2 — Tune my own comfort without changing the team's policy

**Persona:** Agent-Driven Developer (DEV)

> When my comfort with autonomy differs from my team's committed default, I want
> to loosen or tighten the gates just for myself, so I can work the way I want
> without committing that change to the repo or forcing it on teammates.

#### autonomy-posture-spine.DEV2.AC1 — A personal policy layers on top of the project policy, with personal taking precedence

#### autonomy-posture-spine.DEV2.AC2 — The personal override lives in a location that is never committed to the repository

#### autonomy-posture-spine.DEV2.AC3 — With no personal override present, the project policy governs unchanged

### autonomy-posture-spine.DEV3 — Run hands-off and have the agent resolve its own questions

**Persona:** Agent-Driven Developer (DEV)

> When I set an axis to autonomous and the agent hits a question it would normally
> ask me, I want it to resolve the question itself with the full context it needs
> and keep going — but stop and ask when it genuinely can't decide — so I can run
> low-stakes or overnight work without babysitting and without silent bad calls.

#### autonomy-posture-spine.DEV3.AC1 — On an autonomous axis, a breakpoint that would prompt the human is instead resolved by a sub-agent running /figure-it-out; an ask-axis breakpoint still pauses

#### autonomy-posture-spine.DEV3.AC2 — The sub-agent receives a defined, complete context payload (the question, ticket/spec, relevant prior decisions, constraints) — not an ad-hoc subset

#### autonomy-posture-spine.DEV3.AC3 — Every autonomous resolution is recorded with the question, options considered, the pick, and the rationale

#### autonomy-posture-spine.DEV3.AC4 — A transient /figure-it-out error or timeout is retried once; if it still fails, the decision defers to the human and the attempt is logged

#### autonomy-posture-spine.DEV3.AC5 — A /figure-it-out run that completes but is inconclusive defers to the human immediately, without retry

### autonomy-posture-spine.DEV5 — Never let a hands-off run do something irreversible without me

**Persona:** Agent-Driven Developer (DEV)

> When the agent is about to do something it can't take back — push, delete outside
> the ticket, send an email or Slack, touch secrets or production config — I want it
> to confirm with me regardless of my autonomy settings, so a hands-off run can
> never cause irreversible or outward harm on its own.

#### autonomy-posture-spine.DEV5.AC1 — Denylisted actions prompt the human even when every axis is set to autonomous

#### autonomy-posture-spine.DEV5.AC2 — The hard protective gates (LOC commit, done gate, verify artifact) still fire under any posture

#### autonomy-posture-spine.DEV5.AC3 — Closing a ticket as done always requires explicit human confirmation

### autonomy-posture-spine.SM1 — Define the policy in one declarative, testable place

**Persona:** Safeword Maintainer (SM)

> When I build these controls, I want the posture policy, its precedence, and the
> sub-agent's context contract defined in one declarative place, so I can reason
> about and test what fires without tracing it through scattered TypeScript.

_Coverage note: SM1's ACs are structural/testability properties proven by unit tests during implement (the precedence resolver, the single context-contract definition, the posture-map mapping), not by the Cucumber acceptance lane. `safeword check` will mark them uncovered — that is a deliberate decision, recorded here and at the scenario-gate._

#### autonomy-posture-spine.SM1.AC1 — The project and personal policies resolve through a single documented precedence rule

#### autonomy-posture-spine.SM1.AC2 — The sub-agent context contract is defined once (a skill or sub-agent definition), referenced by every breakpoint rather than duplicated

#### autonomy-posture-spine.SM1.AC3 — The mapping from axis → posture → behavior (ask / autonomous-resolve / defer) is inspectable and unit-testable without running a full agent session

## Outcomes

- A user picks a preset by name and the agent's pausing behavior visibly changes to match.
- A user adds a personal override that changes their own behavior and is absent from `git status`.
- An autonomous-axis breakpoint is resolved by the sub-agent and logged; an ask-axis breakpoint still pauses.
- When `/figure-it-out` errors or can't decide, the run defers to the human (after one retry on transient error) rather than guessing.
- Denylist, hard gates, and done-confirmation fire under every preset.
- A project with no policy configured behaves exactly as safeword does today.

## Technical Constraints

### Safety / posture

- [ ] Default-when-unset is Full review (all ask) — autonomy is always opt-in.
- [ ] Failure mode is fail-safe: defer to the human on inconclusive or repeated error; never silently proceed.
- [ ] Denylist, hard gates, and done-confirmation are posture-independent and cannot be disabled by any policy.

### Dependencies

- [ ] Reuses `/figure-it-out` for autonomous resolution rather than a new decision engine.
- [ ] Autonomous decisions log only (control-ladder tier-3); verify/debate/audit tiers arrive with follow-up children and must not be foreclosed by this design.

### Data

- [ ] Personal override stored outside version control (e.g. a gitignored local config); precedence personal > project.

## Open Questions

- defer: storage shape and filename for project vs. personal policy (e.g. `.safeword/config.json` + gitignored `config.local.json`) — confirm at scenario-gate.
- defer: exact wording of the per-axis breakpoint taxonomy (which in-session pauses map to which axis) — refine during implement as call sites are wired.
