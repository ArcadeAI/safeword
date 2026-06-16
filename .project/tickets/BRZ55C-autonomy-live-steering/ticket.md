---
id: BRZ55C
slug: autonomy-live-steering
type: feature
phase: intake
status: backlog
created: 2026-06-16T19:44:27.205Z
last_modified: 2026-06-16T19:44:27.205Z
---

# Steer live sessions with the autonomy posture (hook + live proof)

**Goal:** Make a real agent session reliably consult the autonomy posture at breakpoints — via a deterministic hook, not prose alone — and prove it with a live smoke test.

**Parent:** [HPQ43R autonomy-posture-spine](../HPQ43R-autonomy-posture-spine/ticket.md) (epic [90AZDV](../90AZDV-configurable-hitl-autonomy/ticket.md)). HPQ43R shipped the resolver + IO + breakpoint logic, the `safeword autonomy` CLI (show/set/override), the live config acceptance lane, and the SAFEWORD.md instruction wiring. This ticket is its #2 tail.

## Why

The v1 wiring is SAFEWORD.md prose — the least-reliable enforcement tier (instruction-attention-hierarchy learning). A deterministic hook steers more reliably AND produces the signal a non-flaky live test can assert on (the way `tests/smoke/steering.live.test.ts` asserts on `permission_denials`). Prose-only wiring can't be proven by a non-flaky test.

## Scope (sketch — refine at intake)

- A hook that surfaces the resolved posture each turn and/or enforces the always-confirm denylist under autonomy at the tool boundary — reusing `resolveBreakpoint` / `readAutonomyPolicy` (no new decision logic).
- Wiring: settings.json (`.claude` + template), schema registration, hooks-authoring-guide adherence.
- A `@live` smoke test (or `*.live.test.ts`) that drives a real agent under a `Hands-off` policy and asserts it resolved-vs-paused on the hook's deterministic signal — runs only where `claude` + `ANTHROPIC_API_KEY` exist.
- Unit-test the hook's pure logic in the fast lane.

## Out of scope

- The control-ladder tiers (verify / debate-review / async-audit) — separate follow-up children of 90AZDV.

## Work Log

- 2026-06-16T19:44:27.205Z Started: Created ticket BRZ55C
- 2026-06-16T19:50:00.000Z Filed (backlog): captured HPQ43R's #2 tail — deterministic posture hook + `@live` proof. The hook is the prerequisite for a non-flaky live test (it provides the signal to assert on). Best done in a creds-bearing environment.
