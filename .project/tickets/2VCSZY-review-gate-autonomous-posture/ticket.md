---
id: 2VCSZY
slug: review-gate-autonomous-posture
title: 'Auto-enable the phase-exit review gate under YOLO/autonomous runs'
type: task
phase: intake
status: backlog
created: 2026-06-10T17:57:47.377Z
last_modified: 2026-06-10T18:00:00.000Z
---

# Auto-enable the phase-exit review gate under YOLO/autonomous runs

**Goal:** When the human guard disappears (YOLO mode auto-confirms intake's sub-phase gates; long autonomous runs), the Tier-2 phase-exit review gate should turn on automatically — independent fork-reviews become the compensating control at exits the user normally guards.

**Why:** The 2026-06-10 flow review settled the interactive default (option a — scenario-gate review required structurally; the enforcement gate stays off because intake/implement/done exits carry their own guards: user signoffs, tests, the done-gate's evidence checks). The strongest guard in that argument is the _user_. YOLO mode (G2E72G) removes exactly that guard, so the posture must flip with the mode — that was the explicit steelman for enforcement: "(b) is a mode, not a default."

## Scope (sketch — refine at intake)

- Couple the gate to the mode: when YOLO is active, `isReviewGateOn()` (`pre-tool-quality.ts`) returns true regardless of the manual `reviewGate` flag in `.safeword/config.json` — or YOLO setup writes the flag; decide the mechanism at intake.
- **Selective enforcement (the old option c):** consider a per-phase filter so autonomous runs require stamps at high-judgment exits (intake, define-behavior, scenario-gate) but not where machine evidence already gates (implement→verify tests, verify→done done-gate). Weigh against rubber-stamp risk: stamps without signal degrade the ritual.
- Stamp economics for long runs: fork-review cost per exit (~50–100k tokens) × phases × tickets — budget guidance or batching may belong in the design.
- Tests: gate-on-under-YOLO, manual-flag-still-works, skip-reason path unchanged.

## Out of scope

- Changing the interactive default (settled: off, scenario-gate review structural).
- The review procedure itself (`/review-spec`, write-review-stamp) — unchanged.

## Related

- **G2E72G** (YOLO mode) — the trigger condition; this is its compensating control. Build with or after it.
- **NMSD94** (per-asset review gate) — built the Tier-1/Tier-2 stamp machinery and the default-off flag this couples to.
- Flow review 2026-06-10, finding C2 — the full argument for default-off interactively and on autonomously.

## Work Log

- 2026-06-10T17:57:47.377Z Started: Created ticket 2VCSZY
- 2026-06-10T18:00:00.000Z Filed (backlog): captured from the flow-review #4 decision — option (a) applied for interactive use; this ticket owns the autonomous-mode flip (auto-enable, possibly per-phase selective) and its stamp economics. Blocked conceptually on G2E72G's mode mechanism.
