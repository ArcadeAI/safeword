---
id: 1W107W
slug: signals-skill
title: 'New /build-signals skill — four implementation options, mandatory feature tag, in-code instrumentation discipline'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-three-merge
paired_with: 5FBD29
blocked_on: 7VRXF6
created: 2026-05-24T21:44:38.472Z
last_modified: 2026-05-24T21:45:00.000Z
---

# New /build-signals skill

**Goal:** Add a `/build-signals` skill that reads a ticket's Outcomes (per 7VRXF6) and implements measurement for each — choosing from four approaches (monitor, insight, cron, synthetic), applying a mandatory `feature:<slug>` tag, writing in-code instrumentation as part of the work (never as a follow-up), and writing a `<slug>-signals.md` artifact with status lifecycle.

**Why:** The capability is the headline of this epic. Without the skill, declared Outcomes from 7VRXF6 are aspirational. Safeword today has no equivalent. Arcade's `/build-signals` is the prototype this absorbs.

**Parent epic:** S4997T
**Paired with:** 5FBD29 in arcade
**Depends on:** 7VRXF6 (Outcomes must exist to be measured)

## Scope

### Skill invocation

- Skill: `packages/cli/templates/skills/build-signals/SKILL.md`.
- Invocable on a ticket whose Outcomes section is populated (per 7VRXF6).
- Refuses if Outcomes section is missing OR if the implementation isn't `done` yet (since signals measure production behavior, not pre-merge).

### Four implementation approaches

For each Outcome, the skill guides the user to select from:

| Option          | Best for                                     | Notes                                                 |
| --------------- | -------------------------------------------- | ----------------------------------------------------- |
| Metric monitor  | Infrastructure metrics, error rates, latency | Project-specific platform (Datadog default)           |
| Product insight | Product usage, conversion, retention         | Requires event instrumentation in application code    |
| Custom cron job | Cross-system or composite metrics            | Write a scheduled job; publish result as a metric     |
| Synthetic probe | Availability, end-to-end correctness         | External probe; no application instrumentation needed |

Ask per outcome if there's no obvious fit. Platform choice (Datadog vs alternative) is configurable per `.safeword/config.json` — see also JS5K5G (pluggable routing).

### Mandatory feature tag

Apply `feature:<slug>` to all monitors, insights, jobs, and synthetic tests created. Non-negotiable — enables alert-routing (per JS5K5G) and post-hoc signal-by-feature inspection. If the user creates a signal without the tag, the skill refuses to mark the outcome covered.

### In-code instrumentation as part of the work

If an outcome requires new instrumentation in application code (PostHog events, OpenTelemetry spans, metric emit calls), the skill writes that instrumentation as part of its own execution — not as a follow-up ticket. Prevents the deferred-tech-debt anti-pattern.

### Signals artifact

Write to `<id>-signals.md` (or `## Signals` section in ticket.md per storage decision). Sections:

- **Outcome** — verbatim from the spec.
- **Implementation approach** — which of the four options.
- **Specific configuration** — monitor name, query, threshold, etc.
- **Tag applied** — `feature:<slug>` confirmed.
- **Code instrumentation** — files touched, lines added.
- **Status** — `proposed` → `live` (monitor active, receiving data).
- **Alert routing** — handled by JS5K5G.

### Status lifecycle

- `proposed` — design written, implementation not yet deployed.
- `live` — measurement is active in production, receiving data.

### Hook integration

- When a ticket is marked `outcome-validated` (per X59JZE), the hook checks that all Outcomes from the spec have corresponding `live`-status signals in `<id>-signals.md`.

## Out of scope

- Specific platform integration code (Datadog API client, PostHog API client) — these are project-level concerns; safeword skill describes the discipline, project implements via existing API clients.
- Alert routing pipeline (Linear ticket creation) — JS5K5G.
- Outcome authoring — 7VRXF6.
- Dashboard / visualization scaffolding — out of scope; users build their own dashboards.

## Done when

- `/build-signals` skill exists in templates.
- Skill emits a `<id>-signals.md` artifact with the documented sections.
- Skill refuses to mark an outcome covered if `feature:<slug>` tag is missing.
- Skill writes in-code instrumentation as part of its execution (verified via fixture test).
- Worked example walks through all 4 implementation approaches.

## Open questions

- **Platform abstraction** — does the skill body name Datadog/PostHog by default, or treat them as configurable per project? Driver leans configurable-with-Datadog-and-PostHog-as-default-mentions (most users will recognize them; others adapt).
- **Synthetic-probe scaffolding** — does the skill scaffold the probe code, or just document the intent and let the user wire it? Driver leans document-intent; synthetic probe scaffolding is platform-specific.
- **Re-invocation after edits** — if a signal's threshold needs adjusting, does `/build-signals` re-run idempotently or refuse? Driver leans refuse-if-status-live (forces explicit `/update-signals`-equivalent if needed; out of scope for this ticket).

## Work Log

- 2026-05-24T21:44:38.472Z Started: Created ticket 1W107W
- 2026-05-24T21:45:00.000Z Drafted: Scope (4 approaches, mandatory tag, in-code instrumentation, artifact); linked to epic S4997T
