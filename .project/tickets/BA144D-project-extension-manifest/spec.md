# Spec: Let projects extend safeword guardrails without forking safeword

## Intent

Safeword needs a supported extension lane for project-specific guardrails and guidance. A project should be able to add its own guides, templates, skills, and hook commands without editing safeword-owned templates, losing changes on upgrade, or creating parallel agent configuration that safeword cannot validate.

## Intake Brief

- **Requested by:** Alex, via GitHub issue #454.
- **Cost of inaction:** Customers will fork templates, hand-edit generated files, or maintain parallel Claude/Codex/Cursor config. Those changes are easy to clobber during setup or upgrade and impossible for `safeword check` to validate consistently.
- **Reversibility:** Cross-cutting, one-way-door once documented. The v1 shape adds public `.safeword/config.json` schema and agent-adapter behavior, so it should be additive and narrow.

## References

- GitHub issue: https://github.com/ArcadeAI/safeword/issues/454
- Prior manifest precedent: `.project/tickets/K7N2QM/ticket.md`
- Skill registration manifest work: `.project/tickets/Y06KJS-agent-skill-manifest-generation/ticket.md`
- Local extension surfaces: `packages/cli/src/schema.ts`, `packages/cli/src/utils/configured-paths.ts`, `packages/cli/src/reconcile.ts`
- Claude Code docs: project skills live under `.claude/skills`, while plugins package skills/hooks for sharing across projects.
- Codex docs: skills are the authoring format, plugins are distribution, and non-managed hooks require explicit review/trust.

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- Extension manifest: a project-owned `.safeword/config.json` section that inventories customer-owned guides, templates, skills, and hook commands.
- Adapter: safeword-owned generated or merged agent config that exposes a project extension to Claude, Codex, or Cursor without copying the customer-owned source content.

## Jobs To Be Done

### project-extension-manifest.TB1 — Add project-specific guidance without forking safeword

**Persona:** Technical Builder (TB)

> When my project has team-specific guardrails, guides, templates, or workflows, I want to declare them in one supported safeword manifest, so I can keep them active across setup, upgrade, and reset without editing generated files.

#### project-extension-manifest.TB1.AC1 — Project-owned extensions are declared from one explicit inventory

The builder can name project-owned guides, templates, skills, and hook commands in `.safeword/config.json` without editing safeword-owned template directories or generated agent files.

#### project-extension-manifest.TB1.AC2 — Safeword lifecycle commands preserve extension source files

Setup, upgrade, and reset leave customer-owned extension source files untouched while creating, updating, or removing only safeword-owned adapter surfaces.

#### project-extension-manifest.TB1.AC3 — Declared extensions become available on intended agent surfaces

Safeword exposes declared guides, templates, skills, and hook commands through the requested Claude, Codex, or Cursor surfaces without copying customer-owned source content into safeword-owned templates.

#### project-extension-manifest.TB1.AC4 — Extension problems are visible before an agent depends on them

`safeword check` reports missing extension paths, duplicate extension names, unsupported agent/event mappings, and unsafe hook declarations in terms a builder can act on.

### project-extension-manifest.SM1 — Preserve safeword ownership while allowing customer extensions

**Persona:** Safeword Maintainer (SM)

> When safeword evolves its own templates, hooks, and agent surfaces, I want project extensions to compose through explicit validation and owned adapters, so framework upgrades do not clobber customer content or weaken guardrail enforcement.

#### project-extension-manifest.SM1.AC1 — Customer hooks compose with safeword hooks across agent surfaces

Safeword hook merges preserve customer-authored hook entries while adding or updating safeword-owned hooks for Claude, Codex, and Cursor.

#### project-extension-manifest.SM1.AC2 — Hook extensions require explicit safety semantics

Every hook extension declares its target agent/event, matcher, `command` plus optional `args`, timeout, blocking mode, and project-local command path so safeword can reject ambiguous or unsafe lifecycle execution before installation.

#### project-extension-manifest.SM1.AC3 — Unsupported extension mappings fail loudly instead of degrading silently

When an extension cannot be represented on a requested agent surface, safeword reports the incompatibility and leaves existing customer content intact.

## Rave Moment

### v1 — Upgrade proves the extension is really theirs

- **Moment:** After adding a project guide, skill, template, and blocking hook, a Technical Builder runs `safeword upgrade` and sees a clean report: customer extension files untouched, safeword adapters refreshed, and `safeword check` confirms the same guardrail is still wired into Claude, Codex, and Cursor.
- **Beats:** The dread that agent customization is either a fork of generated files, a per-agent copy/paste chore, or a fragile plugin project before the team is ready to distribute anything.
- **They'd say:** "We upgraded safeword and our own agent rules stayed alive everywhere without a fork."

### v2, one-year horizon — One project rule becomes a governed team standard

- **Moment:** A team promotes a proven project extension into a versioned guardrail pack, rolls it across a fleet of repos, and `safeword check` shows exactly which repos and agents are current, stale, or intentionally pinned before anyone starts a coding session.
- **Beats:** The year-later failure mode where every repo has slightly different local rules, every agent surface drifts independently, and "standardization" means either a brittle copy/paste script or a plugin marketplace workflow before the team has governance around it.
- **They'd say:** "We turned the rule that saved one repo into a versioned team standard, and safeword proves every agent is actually using it."

The v2 moment is a product horizon, not v1 scope. V1 should create the project-owned extension manifest and preservation/validation guarantees that make later promotion credible.

## Outcomes

- A project can declare customer-owned guides, templates, skills, and hooks in `.safeword/config.json`.
- Declared extensions are exposed through safeword-owned adapters on the requested agent surfaces.
- Setup and upgrade preserve customer-owned extension files while updating safeword-owned generated surfaces.
- Reset removes safeword-owned adapters but does not delete customer-owned extension files.
- `safeword check` reports missing extension files, duplicate names, unsupported agent/event combinations, and unsafe hook declarations.
- Claude, Codex, and Cursor hook merges preserve customer-authored hook entries when safeword upgrades its own hooks.

## Open Questions

- answered: v1 uses direct manifest reads where safeword runtime can consume content directly, plus generated/pointer adapters where a native Claude, Codex, or Cursor surface requires a file/config entry. Customer-owned source content is never copied into safeword-owned templates.
- answered: v1 covers Claude, Codex, and Cursor through validation, preservation, and supported adapters, but does not claim every native hook event maps everywhere. Unsupported agent/event mappings fail `safeword check`.
- answered: customer skill extensions reuse the neutral skill manifest expansion path so safeword does not grow a parallel skill-registration model.
- defer: future epic — What parts of the one-year v2 promotion moment belong in a future epic rather than this v1 feature?
- defer: process follow-up — How should the BDD Rave Moment prompt ask for multiple horizons, like v0.1 / v1 / v10, so the long-horizon opportunity sharpens the first slice instead of turning v0.1 into a timid or over-scoped compromise?
