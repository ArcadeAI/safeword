# Product Plan: Reliable feature plans with shorter instructions

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** In the frozen café comparison neither reviewer required evidence for an unresolved product choice in six trials. Three places also repeat guidance that authors already receive elsewhere.
- **Expected outcome:** Both authors clarify consequential choices and reach independent approval with fewer instructions.
- **Persona outcome inventory:** A Safeword Maintainer can identify which changes preserve intake and reproduce failures independently.
- **Known facts:** The current scheduling template passed eight completed trials. Each café reviewer has approved an author-selected policy in the absence of a user decision.
- **Assumptions:** Duplicated prose can be removed without impairing the handoff.
- **Unresolved product decisions:** A new fixture preference belongs to the operator. Capture it only after a trial asks.
- **Success threshold:** Record each isolated result for both hosts. Adoption requires preserved product behavior and independent pre-code approval, and a combined confirmation. The café wording must meet the paired threshold specified in the ticket.
- **Project non-goals:** Implementation, scenario quality, releases, and a new review hook.
- **Reversibility:** Two-way. Select changes independently through Git.

## Jobs To Be Done

### reliable-lean-intake.SWM1 — Decide which intake guidance to keep

**Persona:** Safeword Maintainer (`SWM`)

> When I change intake instructions, I want evidence on both hosts so I can keep useful behavior and remove duplication.

#### reliable-lean-intake.SWM1.R1 — Grade whether each reviewer requires evidence when a product choice matters.

#### reliable-lean-intake.SWM1.R2 — Grade the approved plan and the transition before implementation separately.

#### reliable-lean-intake.SWM1.R3 — Give each prompt cut an isolated comparison before measuring the combination.

## Shape

### M1 — Reviewer and author checks

- **Outcome:** Each host has a decision-ownership result and a fresh-feature result.
- **Non-goals:** Generalization to every feature or host.

### M2 — Prompt reductions

- **Outcome:** The maintainer can identify exactly which cuts to retain and reproduce the comparison.
- **Non-goals:** Optimizing the model or changing the harness prompt.

## Killer Demo

> A maintainer can open the scorecard and trace a keep-or-revert decision to the actual question, plan and review verdict from each host.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex

Unaffected:

- Cursor and OpenCode are outside this two-host comparison.
