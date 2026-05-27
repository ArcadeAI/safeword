---
id: 92TBNN
slug: initiative-skill
title: '/initiative skill — light cross-feature artifact for work spanning multiple features and quarters'
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
created: 2026-05-25T01:25:31.892Z
last_modified: 2026-05-25T01:26:00.000Z
---

# /initiative skill

**Goal:** Add an `/initiative` skill that creates a lightweight cross-feature artifact for work spanning multiple features and quarters. Initiatives compose features into bigger bets with their own success criteria, sequencing, and lifecycle — separate from individual feature tickets but linked to them.

**Why:** Today, features are the unit of work in safeword. But real product strategy operates at a higher level: themes, bets, multi-quarter initiatives that span multiple features. Without an initiative concept, cross-feature reprioritization is invisible — you can't ask "is this initiative still on track?" because there's no artifact for the initiative itself. Cagan POM, Torres OST, and Team Topologies all reference initiative-level thinking. The skill makes initiatives a first-class lightweight artifact without bloating into roadmap-tool territory.

**Parent epic:** GNSJ6P
**Depends on:** — (can ship independently)

## Scope

### When to invoke

- When starting work that obviously spans multiple features (e.g., "rewrite auth" might involve 5 features in 3 services).
- When a customer/business theme emerges that's bigger than a single feature.
- When you find yourself manually tracking "which features are part of [this strategic bet]" across tickets.

### Workflow

1. **Frame the initiative** — JTBD-style: "We believe shipping [theme] will [outcome] for [customer]."
2. **Define success criteria** — initiative-level outcomes, measurable. Higher-altitude than feature outcomes; aggregated.
3. **Define scope and non-goals** — what features are in, what features look related but are out.
4. **Enumerate features** — link to existing feature tickets, or list features-to-be-created.
5. **Define sequencing** — which features come first, what each enables.
6. **Define horizon** — expected duration (rough: weeks vs months vs quarters). Initiatives without horizon become forever-projects.
7. **Define check-in cadence** — how often the initiative gets reviewed (default: align with quarter or monthly).
8. **Document** — write the initiative artifact.

### Artifact

`<id>-initiative.md` (or a special ticket with `type: initiative` per open question). Fields:

- **Hypothesis** — "We believe X will Y for Z."
- **Success criteria** — measurable initiative-level outcomes.
- **Scope and non-goals** — what's in, what's out.
- **Features** — list of feature tickets (`feature_tickets: [<id>, <id>, ...]`).
- **Sequencing** — ordered or dependency-graph form.
- **Horizon** — start date + expected end.
- **Check-in cadence** — frequency and next check-in date.
- **Status** — `proposed` → `active` → `done` / `sunset` / `paused`.

### Integration

- Feature tickets gain an `initiative:` frontmatter field linking back to their parent initiative.
- `/reprioritize` (AQ14K2) at initiative scope: when a constituent feature's signals breach, evaluate the initiative-level implication.
- `/sunset` (6F432S) at initiative scope: an entire initiative can be sunset if its constituent features aren't delivering.
- `/experiment` (PP7116) at initiative scope: an initiative itself can be framed as an experiment with kill criteria at the initiative level.

### Check-in protocol

At each check-in cadence, surface (via reminder hook or session-start nudge):

- Status of constituent features (how many shipped, how many in-flight).
- Aggregate metrics against initiative success criteria.
- Recent reprioritization decisions affecting constituent features.
- Suggested actions: continue, /reprioritize, /sunset.

## Out of scope

- Replacing Linear/Jira/Productboard initiative tracking — we provide the artifact + workflow; existing tools own the surface where teams see initiatives in calendar/roadmap form.
- Capacity planning, resource allocation, dependency visualization across teams — out of scope for v1.
- Multi-team initiative coordination patterns — Team Topologies vocabulary lands in 4RD1NS; org-design work is separate.
- Nested initiatives (initiatives of initiatives) — defer; v1 is one level.

## Done when

- `/initiative` skill exists with the 8-step workflow.
- Initiative artifact format documented (`<id>-initiative.md` or special ticket type per design decision).
- Feature ticket `initiative:` frontmatter field is supported and validated.
- Check-in protocol fires reminders (or surfaces in session start) at configured cadence.
- Worked example: initiative framed → 4 feature tickets created and linked → check-in surfaces aggregate status → constituent feature reprioritized → initiative re-evaluated.

## Open questions

- **Initiative storage** — special ticket type (`type: initiative` extending the existing enum), separate `.safeword-project/initiatives/` folder, or `<id>-initiative.md` artifact next to a regular ticket? Driver leans special ticket type — reuses ticket-system infra. Inherits epic decision #3.
- **Sequencing form** — ordered list (simple), dependency graph (richer), or both? Driver leans ordered-list-with-optional-edge-callouts (simple; graph is overkill until proven needed).
- **Horizon enforcement** — does the skill block extending horizon arbitrarily ("you're 6 weeks past the original end date — re-evaluate")? Driver leans surface-reminder; blocking is too aggressive for product strategy.
- **Cascading sunset** — when an initiative is sunset, does it auto-sunset constituent features? Driver leans no — surfaces "consider sunsetting these features too" but doesn't auto-fire /sunset on each.

## Work Log

- 2026-05-25T01:25:31.892Z Started: Created ticket 92TBNN
- 2026-05-25T01:26:00.000Z Drafted: Scope (when to invoke, 8-step workflow, artifact, integration, check-in protocol); linked to epic GNSJ6P
