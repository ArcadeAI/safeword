---
id: K4VHF4
slug: reviewgate-enablement
type: task
phase: intake
status: backlog
created: 2026-06-03T18:05:41.071Z
last_modified: 2026-06-03T18:05:41.071Z
---

# Enable reviewGate (dogfood the two-tier review)

**Goal:** Turn on the NMSD94 review gates (`reviewGate: true` in `.safeword/config.json`) so safeword dogfoods its own two-tier review enforcement.

**Why:** NMSD94 shipped both tiers inert behind a default-off flag. Enabling is a deliberate, separable decision — it changes our own dev loop and should follow a short soak, not ride along with the build.

## Before flipping — know what turns on

- **Every phase transition needs a phase-exit stamp**, not just "forward" ones: `intake`-exit, every middle transition, **and `→done`**. `detectPhaseAdvance` is direction-agnostic, so a backward correction (e.g. `implement → define-behavior`) is gated too. The gate's deny message names the exact phase, so it is self-documenting at the moment it fires — but budget for a fork review (or a logged skip) at each transition.
- **Tier 1** fires only at the `spec → test-definitions.md` creation boundary today; earning the stamp is `/self-review`.
- **Skip valve** clears any gate: `write-review-stamp.ts <artifact|--phase X> "<reason>"`.

## Scope

- Flip `reviewGate: true` in `.safeword/config.json`; soak; watch for false-blocks.
- **Build the Tier 2 reviewer as a `context: fork` skill** (e.g. `/phase-review`) — the native Agent Skills mechanism (`context: fork` + `agent` frontmatter, per current Claude Code docs) for an independent, no-history reviewer. Today Tier 2's fork review is bdd prose ("run it in a forked subagent"); a dedicated skill makes it one invocation that stamps via `write-review-stamp.ts --phase` on pass. Parallels `/self-review` (Tier 1, inline).

**Out of scope:** the gate mechanics themselves (NMSD94, done); the coverage gate (ZRMDKD).

**Done when:** reviewGate is on in our config; a `context: fork` phase-review skill exists and earns Tier 2 stamps; a soak shows no spurious blocks (alert-to-action measured).

## Work Log

- 2026-06-03T18:05:41.071Z Created: split from NMSD94 — the dogfood flip + the `context: fork` Tier 2 reviewer skill are deliberate follow-ups, deferred so the build ships inert.
