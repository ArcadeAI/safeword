# Spec: add-spike-workflow

## Intent

Give Safe Word an explicit, disposable experiment workflow for technical
uncertainty that documentation and code reading cannot settle. Its evidence
must make the production implementation plan safer without turning a spike
into a second implementation.

## Intake Brief

- **Requested by:** Safeword Maintainer (SWM)
- **Cost of inaction:** Maintainers either commit to risky designs from research
  alone or perform unstructured throwaway builds whose evidence and lifecycle
  drift across hosts.
- **Reversibility:** Two-way door — this is a new optional workflow, but it
  affects cross-host skill and generated-plugin contracts.

## References

- The accepted figure-it-out recommendation from this session: a manual,
  question-sized checkpoint after scenario-gate, not a canonical phase.

## Personas

- Safeword Maintainer (SWM)
- Technical Builder (TBU)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI

Unaffected:

- Claude Code Cloud — the workflow ships as project configuration; no separate
  cloud-only behavior is introduced.
- OpenAI Codex Cloud — the workflow ships in the Codex plugin; no cloud-only
  behavior is introduced.
- Cursor Cloud Agents — the workflow ships as project configuration; no
  cloud-only behavior is introduced.

## Vocabulary

- **Spike:** A bounded, disposable experiment that produces evidence for an
  implementation decision rather than production code.
- **Kill criterion:** The observable result that invalidates the proposed
  implementation direction.

## Jobs To Be Done

### spike-workflow.SWM1 — Resolve build-only uncertainty before committing

**Persona:** Safeword Maintainer (SWM)

> When documentation and repository evidence cannot settle a technical design
> choice, I want a bounded disposable experiment, so I can plan production work
> with evidence instead of guessing.

#### spike-workflow.SWM1.R1 — A spike has a falsifiable question, a kill criterion, and an executable proof before code is written

#### spike-workflow.SWM1.R2 — A spike preserves its findings while keeping experimental code out of the production branch

### spike-workflow.TBU1 — Use the same spike workflow in every supported agent

**Persona:** Technical Builder (TBU)

> When I work through a supported coding agent, I want the same explicit spike
> action, so I can use the workflow without learning host-specific mechanics.

#### spike-workflow.TBU1.R1 — Every supported host exposes the manual spike action

#### spike-workflow.TBU1.R2 — BDD offers a spike only for a build-only risk after behavior is validated

## Rave Moment

skip: internal maintainer workflow

## Outcomes

- An eligible uncertainty enters a named, bounded experiment with a command or
  walkthrough that can validate or invalidate it.
- The eventual implementation plan records the spike evidence and production
  deltas while the experiment branch remains unmerged.
- Claude Code, Cursor, and Codex receive the same manually invoked workflow.

## Open Questions

None — the figure-it-out decision established the placement, trigger, and
artifact strategy.
