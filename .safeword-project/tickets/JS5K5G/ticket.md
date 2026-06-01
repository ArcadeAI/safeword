---
id: JS5K5G
slug: alert-routing-pluggable
title: 'Pluggable alert-routing layer (Linear-first with adapters for other ticket systems)'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-three-merge
paired_with: 5FBD29
blocked_on: 1W107W
created: 2026-05-24T21:44:38.516Z
last_modified: 2026-05-24T21:45:00.000Z
---

# Pluggable alert-routing layer

**Goal:** Add a pluggable alert-routing layer that, when a signal breaches its threshold, creates a structured ticket in the project's configured ticket system. Linear is the default adapter; the architecture supports adding GitHub Issues, Jira, Slack, or other systems via config.

**Why:** Arcade hardcodes Linear for breach routing. Safeword has many users on many ticket systems (GitHub Issues is common for OSS projects, Jira for enterprise). A pluggable layer with Linear as the default preserves arcade's pattern while extending to other users. Without routing, breaches fire alerts that nobody triages.

**Parent epic:** S4997T
**Paired with:** 5FBD29 in arcade
**Depends on:** 1W107W (signals skill provides the breach event; routing consumes it)

## Scope

### Adapter contract

Define an adapter interface for breach routing. Each adapter must support:

- `createBreachTicket(signal: Signal, breach: BreachEvent): Promise<TicketRef>` — creates a ticket in the target system, returns a reference.
- Standard fields: title (`Signal breach: <slug> — <signal name>`), body (link to spec, link to signals file, breach details), label (`signal-breach`).
- Configurable assignment (on-call engineer, team, individual).

### Linear adapter (default)

Ships in `packages/cli/templates/adapters/linear.ts` (or equivalent). Mirrors arcade's existing /build-signals routing:

- Issue title: `Signal breach: <slug> — <signal name>`
- Label: `signal-breach`
- Body: link to spec, link to signals file, breach details
- Assignee: on-call engineer (per project config)
- Triggers `/debug` invocation hint in the body

### Configuration

`.safeword/config.json` field:

```json
{
  "alertRouting": {
    "adapter": "linear" | "github" | "jira" | "slack" | "custom",
    "linear": {
      "team": "ENG",
      "labelOnBreach": "signal-breach",
      "assignTo": "oncall@example.com"
    }
  }
}
```

### Skill integration

`/build-signals` (per 1W107W) configures the breach routing on each signal it creates, using the configured adapter.

### Custom adapter

Projects can ship their own adapter at `.safeword/adapters/<name>.ts`. Safeword loads it dynamically if `alertRouting.adapter === "custom"`.

## Out of scope

- Building adapters for GitHub / Jira / Slack as part of this ticket — only Linear adapter ships in v1. Others can be follow-ups.
- Automated `/debug` execution on breach — that's a future enhancement; v1 just creates the ticket with a `/debug` hint.
- Throttling, deduplication, escalation — alert-routing is fire-and-forget per breach; smart routing is future work.

## Done when

- Adapter interface documented in safeword templates.
- Linear adapter ships and is the default.
- `.safeword/config.json` schema includes the `alertRouting` block.
- `/build-signals` (1W107W) uses the configured adapter when wiring breach routing.
- Documentation shows how to write a custom adapter for projects not on Linear.

## Open questions

- **Linear dependency** — does the Linear adapter bundle a Linear API client, or expect the user to install one? Driver leans bundle-via-peerDep (avoid bloating safeword install for non-Linear users).
- **Authentication** — environment variable for API key, with clear error if missing? Driver leans yes (`LINEAR_API_KEY` env var convention).
- **Test fixtures** — how do we test the Linear adapter without hitting a real Linear instance? Driver leans mocked-client-only in unit tests; integration tests are project-level concern.

## Work Log

- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G
- 2026-05-24T21:45:00.000Z Drafted: Scope (adapter contract, Linear default, config, custom adapters); linked to epic S4997T
