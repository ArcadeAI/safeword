# Spec: Let projects track feature surfaces during BDD

## Intent

Safeword already gives projects durable BDD vocabulary for who a feature serves and what terms mean. This feature adds the matching runtime/context vocabulary: the product, agent, protocol, client, and deployment surfaces where behavior must keep working.

## Intake Brief

- **Requested by:** GitHub issue #509 / safeword maintainers.
- **Cost of inaction:** Agents can implement a behavior for one runtime, such as Claude Code, while missing OpenAI Codex, Cursor, MCP, mobile, or deployment contexts that customers rely on.
- **Reversibility:** Two-way door for content and docs, one-way-ish for path/config shape because it becomes part of the customer project-knowledge contract.

## References

- https://github.com/ArcadeAI/safeword/issues/509
- `.project/personas.md`
- `.project/glossary.md`
- `ARCHITECTURE.md` sections "Schema as Single Source of Truth", "Reconciliation Engine", and "Template Separation"

## Personas

- Technical Builder (TB)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SM)

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- MCP — safeword does not expose this workflow as an MCP protocol surface yet.

## Vocabulary

- **Feature surface:** A supported product, agent, runtime, protocol, client, or deployment context where behavior must keep working. Examples include Claude Code, OpenAI Codex, Cursor, Web app, Mobile app, MCP, Cloud service, and Self-hosted Azure.

## Jobs To Be Done

### feature-surfaces-bdd.TB1 - Keep behavior coverage tied to real project surfaces

**Persona:** Technical Builder (TB)

> When I ask an agent to build a feature that touches multiple runtime or product contexts, I want the agent to load the project's known feature surfaces, so I can catch behavior drift between contexts such as Claude Code, Codex, Cursor, web, mobile, MCP, cloud, and self-hosted deployments.

#### feature-surfaces-bdd.TB1.AC1 - Fresh setup creates an editable surface inventory

#### feature-surfaces-bdd.TB1.AC2 - Existing and configured installs preserve customer-owned surface files

#### feature-surfaces-bdd.TB1.AC3 - BDD intake uses surfaces during discovery and records affected contexts

### feature-surfaces-bdd.NTB1 - Understand where a feature is supposed to show up

**Persona:** Non-Technical Builder (NTB)

> When I review a feature spec without reading code, I want the affected surfaces named plainly, so I can tell whether the agent is changing the contexts I care about.

#### feature-surfaces-bdd.NTB1.AC1 - Feature specs document affected and unaffected surfaces

### feature-surfaces-bdd.SM1 - Ship feature surfaces consistently to customer projects

**Persona:** Safeword Maintainer (SM)

> When I extend safeword's project knowledge model, I want surfaces to follow the existing persona/glossary install contract, so ordinary customer projects and dogfood installs behave the same way.

#### feature-surfaces-bdd.SM1.AC1 - Surface paths share the configured project-knowledge resolver

#### feature-surfaces-bdd.SM1.AC2 - Feature-source coverage reports affected surfaces missing `@surface.<slug>` tags

## Rave Moment

skip: table-stakes project-knowledge expansion; value comes from fewer missed behavior surfaces, not a shareable peak moment.

## Outcomes

- Customers get a starter `surfaces.md` on fresh setup.
- Customer-authored `surfaces.md` content is never overwritten by setup or upgrade.
- `paths.surfaces` can redirect the read target the same way `paths.personas` can.
- BDD intake reads surfaces after personas/glossary and gives a soft prompt when the file is empty or missing.
- Feature specs can name affected and unaffected surfaces under `## Surfaces`.
- `safeword check` reports affected surfaces that lack matching `@surface.<slug>` feature-source coverage.

## Open Questions

None.
