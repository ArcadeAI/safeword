---
id: K51FYZ
slug: breach-issue-projection
type: feature
phase: intake
status: blocked
depends_on: [JS5K5G, 1W107W]
paired_with: 5FBD29
created: 2026-06-20T11:56:44.779Z
last_modified: 2026-06-20T12:36:00Z
---

# Breach issue projection — signal breach → tracker issue (deferred stub)

> **DEFERRED STUB.** Kept only to anchor the requirement; not ready to build. Blocked on the signals layer ([1W107W](../1W107W/ticket.md)) which supplies the `BreachEvent`, and on [sync-tracker (JS5K5G)](../JS5K5G-sync-tracker/ticket.md) which supplies the writer. Re-scope into a full ticket when both land.

**Goal:** When a signal breaches its threshold, project it as an issue in the customer's tracker — by building an `IssuePayload` from the `BreachEvent` and calling `safeword sync-tracker`'s writer. Breach-routing is one _caller_ of the projection, not its own subsystem.

**Why deferred:** There is no `BreachEvent` type until 1W107W ships, and no writer until JS5K5G ships. Building the mapping now would be coding against two imagined interfaces. This is the alert-routing use-case originally bundled into JS5K5G, split out so the bridge stays generic.

## When unblocked, scope is roughly

- Map a `BreachEvent` → `IssuePayload`: title `Signal breach: <slug> — <signal name>`, body (links to spec, signals file, breach details, `/debug` hint), label `signal-breach`, assignee from config.
- Call the sync-tracker writer for the configured provider.
- `/build-signals` (1W107W) wires each signal to this projection on breach.

## Couplings

- `depends_on: JS5K5G` (writer) + `1W107W` (BreachEvent source).
- `paired_with: 5FBD29` (arcade) — the upstream alert-routing pattern this mirrors.

## Work Log

- 2026-06-20T11:56:44.779Z Started: Created ticket K51FYZ.
- 2026-06-20T12:02:00Z Split from JS5K5G as the signals consumer of the bridge.
- 2026-06-20T12:36:00Z Demoted to a deferred stub (status: blocked) per the simplify pass — it's a future caller blocked on unbuilt signals (1W107W) + the writer (JS5K5G). Removed epic membership (WG3Z2N deleted). Re-scope when both dependencies land.
