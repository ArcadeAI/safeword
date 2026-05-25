---
id: AQ14K2
slug: reprioritize-skill
title: "/reprioritize skill — after signals fire, walk the practitioner through deciding what changes next"
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
created: 2026-05-25T01:25:31.735Z
last_modified: 2026-05-25T01:26:00.000Z
---

# /reprioritize skill

**Goal:** Add a `/reprioritize` skill that fires (or is invoked) when a feature's outcome signal breaches a threshold, walks the practitioner through a structured decision — "should this change what's next?" — and produces a documented reprioritization decision linked to the breach event and (optionally) a writeback to the project's roadmap tool.

**Why:** Today, signal breaches create alert tickets (per JS5K5G), but the loop stops there — the alert is investigated, the bug fixed or feature tweaked, and the prioritization implication is usually never made explicit. Cagan's POM principle: decisions cascade from outcomes. Without a structured discipline arc, "signal fired" never reliably becomes "we changed what we're doing next." This skill enforces the arc.

**Parent epic:** GNSJ6P
**Depends on:** — (can ship independently of other loop-closing skills)

## Scope

### Invocation

- Triggered (suggested, not auto-fired) when a signal breach is registered (per 1W107W / JS5K5G).
- Also invocable manually anytime the practitioner notices something that might shift priorities (new customer feedback, market change, dependency surprise).

### Workflow

1. **Load context** — read the breach event (from signals.md or the alert ticket), the feature's spec (JTBD, ACs, outcomes), and the current set of in-flight tickets.
2. **Frame the decision** — surface the breach in plain terms: "Outcome X expected Y; actual is Z. What does this mean for what we should do next?"
3. **Enumerate options** — propose 2-4 plausible reprioritization moves: (a) double down on this feature, (b) accept the result and move on, (c) sunset (delegate to /sunset), (d) pivot the surrounding initiative.
4. **Walk through each option** — for each, lay out implications for in-flight tickets, current sprint, current initiative.
5. **Document the decision** — write the reprioritization decision to a `<ticket-id>-reprioritization.md` artifact (or as a section in the breach ticket). Include: breach details, options considered, chosen option, rationale, follow-up actions.
6. **Optional writeback** — if the project configures an integration (per the JS5K5G adapter pattern), surface the decision for paste-back into Productboard / Linear / wherever the roadmap lives.

### Artifact

`<id>-reprioritization.md` or `## Reprioritization` section. Fields:

- **Breach context** — verbatim from signals.md / alert.
- **Options considered** — 2-4 with brief implications.
- **Chosen** — which option and one-sentence rationale.
- **Follow-up** — concrete actions (which tickets to open, close, reorder).
- **Decided by** — person and date.

### Integration

- Reads `<id>-signals.md` (from 1W107W).
- Reads parent initiative (from 92TBNN) if applicable.
- Writes to the breach ticket or a new sibling artifact.
- Surfaces output for paste into external roadmap tool (per JS5K5G adapter; no direct API integration in v1).

## Out of scope

- Automatic execution of follow-up actions — the skill produces the decision, humans (or other skills) execute it.
- Replacing Productboard/Linear/Aha prioritization workflows — we surface the decision, those tools track the work.
- Multi-stakeholder voting / consensus mechanisms — single decider per session.
- Auto-prioritization scoring (RICE, ICE, WSJF) — defer; could be a follow-up adapter.

## Done when

- `/reprioritize` skill exists in `packages/cli/templates/skills/reprioritize/SKILL.md`.
- Skill produces the documented artifact with the 5 fields.
- Worked example shows: feature ships → signal breaches → /reprioritize invoked → decision documented → follow-up tickets opened.
- Documentation explicitly says what the skill does NOT do (replace external prioritization tools).

## Open questions

- **Auto-suggest vs manual-only invocation** — does breach detection (per JS5K5G alert routing) write a "consider /reprioritize" prompt to the alert ticket, or is invocation purely manual? Driver leans suggest-in-alert-ticket (low friction; explicit).
- **Single-decider vs multi-stakeholder** — for v1, single decider (the person running the skill); document the limitation. Multi-stakeholder workflow can be a future enhancement.
- **Initiative-level reprioritization** — when a signal breach affects an initiative-level priority (not just a single feature), does /reprioritize cascade up, or does the practitioner separately invoke at initiative scope? Driver leans separately invoke; cascading is complexity for v1.

## Work Log

- 2026-05-25T01:25:31.735Z Started: Created ticket AQ14K2
- 2026-05-25T01:26:00.000Z Drafted: Scope (invocation, workflow, artifact, integration); linked to epic GNSJ6P
