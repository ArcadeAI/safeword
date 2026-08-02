# Spec: Project knowledge throughout feature delivery

## Intent

Make principles, personas, and supported surfaces durable inputs to feature
creation, independent challenge, verification evidence, and objective audit—so
an agent cannot silently forget the project's product and design context as it
moves between phases or runtimes.

## Intake Brief

- **Requested by:** Safeword product owner, after a spike comparing principles
  with the existing persona and surface lifecycle.
- **Cost of inaction:** Project knowledge remains strongest during intake and
  progressively disappears from independent review and completion evidence.
  Agents can produce internally consistent plans that omit a principle, serve
  the wrong persona, or claim cross-surface parity from tags rather than real
  execution. Configured surface/principle paths can also fail silently.
- **Reversibility:** Mixed two-way door. Skill guidance and health advisories are
  easy to revise; renaming the public implementation-plan section is a
  compatibility-sensitive document contract, so legacy `Arch alignment` plans
  must remain readable.

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Cloud-only behavior for Claude Code, OpenAI Codex, and Cursor — this feature
  changes shared or locally installed workflow artifacts, not runtime-specific
  cloud behavior.

## Jobs To Be Done

### project-knowledge.NTB1 — Trust the agent to remember what matters

**Persona:** Non-Technical Builder (NTB)

> When I ask an agent to build a feature, I want it to carry the project's
> principles, intended users, and supported contexts through planning and
> review, so I can trust the result without auditing implementation details
> myself.

#### project-knowledge.NTB1.R1 — Applicable project knowledge changes feature behavior and design without becoming a universal checklist

#### project-knowledge.NTB1.R2 — Independent review receives the same project-knowledge sources used to create the spec and plan

#### project-knowledge.NTB1.R3 — Completion evidence distinguishes persona experience, per-surface execution, and objective trace integrity

### project-knowledge.SWM1 — Maintain one compatible knowledge lifecycle

**Persona:** Safeword Maintainer (SWM)

> When I evolve feature-development guidance, I want principles, personas, and
> surfaces to share one project-owned lifecycle with type-specific review and
> objective checks, so every supported agent stays aligned without duplicating
> policy or breaking existing plans.

#### project-knowledge.SWM1.R1 — Principles, personas, and surfaces are each scaffolded once, configurable, and health-checked without overwriting user content

#### project-knowledge.SWM1.R2 — New plans use Design alignment while legacy Arch alignment plans remain valid

#### project-knowledge.SWM1.R3 — Canonical, dogfood, Cursor, and Codex workflow surfaces preserve the same knowledge contract

#### project-knowledge.SWM1.R4 — Builders can discover and configure the complete project-knowledge contract from public documentation

## Outcomes

- Principles are scaffolded and configured like other project knowledge, with
  missing-override and orphan-default health diagnostics.
- `Design alignment` is the canonical plan section; legacy `Arch alignment`
  remains accepted by parsers and gates.
- Spec, scenario, plan, and quality reviewers receive the relevant principles,
  personas, and surfaces rather than reviewing labels without their sources.
- Verification records persona experience and one proof result per affected
  surface; audit checks references and evidence links without judging meaning.
- Public configuration documentation explains the shared lifecycle and all
  three configured paths.
- Canonical, dogfood, Cursor, and Codex workflow surfaces remain synchronized.

## Rave Moment

skip: internal workflow correctness; the value is invisible consistency rather
than a persona-facing peak.

## Open Questions

None.
