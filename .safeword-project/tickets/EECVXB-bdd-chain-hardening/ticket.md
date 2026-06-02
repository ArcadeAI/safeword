---
id: EECVXB
slug: bdd-chain-hardening
type: feature
phase: intake
status: in_progress
epic: bdd-chain-hardening
children:
  - G9BXE9
  - P58R22
  - 9S6600
  - FSX1PP
  - V6N5PW
  - W9GPE7
created: 2026-06-02T04:58:17.560Z
last_modified: 2026-06-02T04:58:17.560Z
---

# Epic: BDD intake/chain hardening — gate-parser fixes, decomposition collapse, Example-Mapping parity

**Goal:** Act on the findings from the deep audit of safeword's bdd phase chain (intake → define-behavior → scenario-gate → decomposition → implement → verify): fix the latent gate/parser defects, retire the redundant non-canonical `decomposition` phase, and close the one real gap against canonical BDD's Example Mapping.

**Why:** A trace of the chain (JTBD/persona → AC → scope → dimensions → scenarios → verify) plus a comparison against the canonical three-practice BDD model (Discovery → Formulation → Automation, per cucumber.io / BDD Books) surfaced three latent defects, one redundant phase, and one missing artifact. The defects can silently block correctly-authored specs; the redundant phase is dead weight foreign to the BDD model; the missing artifact is the only structural gap vs. Example Mapping.

**Sourced from:** Investigation session 2026-06-02 (intake state-machine trace + 5-agent chain deep-dive + BDD methodology research + `/figure-it-out` on how to proceed).

**Keystone deliverable:** a short ADR — _"safeword bdd as a solo-agent adaptation of the three-practice BDD model"_ — recording the deliberate divergences (the agent simulates the Three Amigos via adversarial self-review + `/elicit` + `/figure-it-out`; safeword fuses BDD discovery with formal test-design) and the decision to retire `decomposition`. The ADR lives with FSX1PP.

## Tickets

| ID         | Title                                                               | Type    | Priority | Status      |
| ---------- | ------------------------------------------------------------------- | ------- | -------- | ----------- |
| **G9BXE9** | Hook JTBD gate must accept derived persona codes                    | task    | P0       | in_progress |
| **P58R22** | Differential test pinning hook vs CLI markdown-section parsers      | task    | P1       | in_progress |
| **9S6600** | Reject empty scope/out_of_scope/done_when lists in intake-exit gate | patch   | P1       | in_progress |
| **FSX1PP** | Retire decomposition as a distinct bdd phase (ADR + collapse)       | feature | P2       | in_progress |
| **V6N5PW** | Tracked open-questions artifact in intake (red-card parity)         | feature | P3       | in_progress |

**Sequencing:** G9BXE9 first (only finding that silently breaks correct user input). P58R22 + 9S6600 are independent cheap fixes, run anytime. FSX1PP is ADR-gated and cross-cutting (touches the phase enum, a paired Cursor rule, `schema.ts`, and the `skill-cursor-pairs` parity fixture — see its scope) — do it as a tracked feature, not an ad-hoc edit. V6N5PW is an enhancement, lowest priority.

## Work Log

- 2026-06-02T04:58:17.560Z Started: Created ticket EECVXB
- 2026-06-02 Created epic + 5 children from the bdd-chain audit + figure-it-out recommendations.
