---
id: HPQ43R
slug: autonomy-posture-spine
type: feature
phase: implement
status: in_progress
created: 2026-06-16T16:29:40.567Z
last_modified: 2026-06-16T16:29:40.567Z
scope:
  - Project-level autonomy policy chosen as a named preset (Full review / Guard the contract / Hands-off), recorded in committed config
  - Per-axis override on top of a preset (axes - intent/scope, behavioral contract, irreversible design, execution, completion)
  - Personal override layered on top of the project policy, stored in a gitignored file, personal takes precedence
  - Default when no policy set is Full review (every axis = ask) - today's behavior, autonomy opt-in
  - On an autonomous axis, a would-be HITL breakpoint is resolved by a sub-agent that runs /figure-it-out with a complete context payload
  - Every autonomous resolution logged with question, options, pick, rationale
  - Fail-safe failure mode - transient /figure-it-out error or timeout retries once then defers to the human; a genuine inconclusive verdict defers immediately; never silently proceed
  - Always-on guards independent of posture - denylist actions prompt, hard gates (LOC/done/verify) fire, closing done needs explicit human confirmation
out_of_scope:
  - The control ladder's verify and debate-review tiers (follow-up child) - v1 autonomous decisions log only (tier-3)
  - Async-audit digest, justification-to-accept, rejection-rate tracking (follow-up child)
  - Cross-model reviewer machinery (arrives with the control-ladder child)
  - Per-ticket posture toggle (absorbed from G2E72G; sequence after the project/personal config lands)
  - Cost-ceiling enforcement
done_when:
  - A user picks a preset at project level and the agent's pausing behavior matches it
  - A user overrides one axis without losing the preset for the rest
  - A personal override changes that user's behavior and is absent from git status
  - With no policy configured, behavior is identical to today (all ask)
  - An autonomous-axis breakpoint is resolved by the sub-agent and logged; an ask-axis breakpoint still pauses
  - /figure-it-out failure or inconclusive verdict defers to the human (after one retry on transient error), logged
  - Denylist, hard gates, and done-confirmation fire regardless of posture
---

# Set an autonomy posture and let the agent resolve trusted decisions on its own

**Goal:** Ship the v1 spine of configurable HITL — a project/personal autonomy policy set by preset, with autonomous axes resolved by a context-loaded sub-agent and a fail-safe defer when it can't decide — leaving the control-ladder tiers to follow-up children.

**Parent epic:** [90AZDV configurable-hitl-autonomy](../90AZDV-configurable-hitl-autonomy/ticket.md). Full leverage map, research, and the control-ladder design live there. This child is the spine; autonomous decisions log only (ladder tier-3) until the control-ladder child lands.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-16T16:29:40.567Z Started: Created ticket HPQ43R
- 2026-06-16T16:30:00.000Z Sliced from epic 90AZDV as the v1 spine. Entered define-behavior with scope/out_of_scope/done_when set, spec authored, and the scenario set accepted in chat.
- 2026-06-16T16:40:00.000Z Complete: define-behavior — 20 scenarios across 5 rules in features/autonomy-posture-spine.feature; SM1 structural ACs unit-verified by design.
- 2026-06-16T16:45:00.000Z Complete: scenario-gate — independent fresh-reviewer ran /review-spec, found 3 must-fix + 5 should-strengthen. Applied: rewrote DEV2.AC2 (gitignore enforcement, was vacuous), DEV3.AC1 autonomous + DEV3.AC2 (assert behavior/effect not mechanism), DEV1.AC1 (assert recorded value); added negative cases DEV1.AC5/AC6 + DEV2.AC4 (invalid-selection reject, malformed-policy fail-safe) and broadened DEV5.AC2 to a Scenario Outline over all three hard gates. safeword check clean except documented SM1. impl-plan.md written (test layers + build order). Advancing to implement.
- 2026-06-16T17:02:00.000Z Implement (decision logic GREEN): built the deterministic spine across 3 modules with 36 unit tests, all green —
  - `autonomy-policy.ts` (22 tests): presets, posture resolution, project/personal precedence, per-axis overrides, no-policy default, validators, breakpoint action, fail-safe failure decision.
  - `autonomy-policy-config.ts` (6 tests): read project `.safeword/config.json` + gitignored `.safeword/config.local.json`; registered config.local.json in SAFEWORD_TRANSIENT_PATHS (DEV2.AC2).
  - `autonomy-breakpoint.ts` (8 tests): orchestrator — denylist-overrides-posture, ask→pause, autonomous→resolve via injected /figure-it-out, retry-once, fail-safe defer.
    REMAINING for full all-green spine (not yet done): (1) Cucumber step definitions binding features/autonomy-posture-spine.feature to these modules; (2) live-session integration — wire resolveBreakpoint/readAutonomyPolicy into safeword's hooks + SAFEWORD.md guidance + register the `autonomy` config field in schema, so a real session consults the policy at real breakpoints and logs resolutions; (3) DEV5.AC2 (hard gates fire) is existing-hook behavior, best proven by integration/@manual. Decision logic is done and tested; agent integration is the next chunk.
