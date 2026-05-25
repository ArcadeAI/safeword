---
id: B0JZQN
slug: pause-and-confirm-gates
title: "Add structured user-signoff gates between Phase 0 sub-phases"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: FFRPSC
created: 2026-05-24T15:21:55.104Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Add structured user-signoff gates between Phase 0 sub-phases

**Goal:** Formalize the "present list → ask → iterate until confirmed" ritual between Phase 0 sub-phases (orientation, JTBD, AC, scope) as named, hook-visible gates — rather than relying on the agent to remember to pause.

**Why:** Safeword's propose-and-converge handles the conversational pattern implicitly. Arcade's pipeline makes it an explicit ritual: at the end of each sub-phase, present the captured list verbatim and require user signoff before advancing. The explicit ritual catches "agent ran ahead" failures that propose-and-converge alone doesn't prevent — especially as Phase 0 grows from one sub-phase to four.

**Parent epic:** DZ2NM5

**Depends on:** —

## Scope

- Define a "pause-and-confirm gate" pattern: at sub-phase exit, the agent must (a) present the captured artifact (JTBD list, AC list, scope block) verbatim, (b) ask a specific closing question ("Does this cover the motivations? Anything missing or wrong?"), and (c) wait for user confirmation before advancing.
- Each sub-phase in Phase 0 gets its own gate: orientation → JTBD → AC → scope (order subject to epic decision #1).
- Hook integration (coordinate with epic 172 — phase-step enforcement): the prompt hook surfaces which sub-phase the agent is in and whether the closing question has been asked.
- Coordinate with G2E72G (YOLO mode): under YOLO, gates auto-confirm and the auto-decision is logged to the work log.
- Document the closing-question template per sub-phase in DISCOVERY.md.

## Out of scope

- Adversarial review gates (would be `/review-spec` territory — separate epic).
- Gates for Phase 3+ sub-phases — those have their own enforcement.

## Done when

- Gate pattern documented in DISCOVERY.md with the closing-question template per sub-phase.
- `bdd` Phase 0 explicitly invokes the gate at each sub-phase exit.
- YOLO-mode interaction defined and documented.
- Worked example in DISCOVERY.md shows a gate turn with full user signoff dialogue.

## Open questions

- Does the gate hard-block (no advancement without user reply) or soft-warn? Hard-block aligns with safeword's other gates; soft-warn keeps faster iteration possible.
- What counts as confirmation? "Yes" / "proceed" / "ok" — explicit allowlist, or any non-blocking reply?
- How does the gate behave on resume mid-sub-phase? Re-present the artifact for re-confirmation, or assume prior confirmation stands?

## Work Log

- 2026-05-24T15:21:55.104Z Started: Created ticket B0JZQN
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
