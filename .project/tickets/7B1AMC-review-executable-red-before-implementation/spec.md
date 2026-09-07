# Spec: Stop hollow acceptance proofs before implementation

## Intent

Make the first executable acceptance proof a trustworthy checkpoint: before production implementation begins, a separate reviewer confirms that the intended missing behavior fails for the right reason through the real actor boundary.

## Intake Brief

- **Requested by:** Safeword maintainers after plugin acceptance scenarios passed through a shared umbrella verdict without individually proving their behavior.
- **Cost of inaction:** Coding agents can produce persuasive Gherkin and green suites while never exercising the scenario-specific behavior, leaving non-technical builders unable to detect the gap and maintainers exposed to repeat support incidents.
- **Reversibility:** Two-way door. The review contract and receipt can be revised or removed without migrating customer data; rollout should remain measurable and lightweight.

## References

- Parent program: [AK0QJR](../AK0QJR-trustworthy-bdd-proofs/ticket.md)
- Shared examples: [BX1T7H](../BX1T7H-preserve-bdd-proof-regression-corpus/ticket.md)
- Existing per-phase review gate: NMSD94
- Existing cross-agent reviewer routing: QZAFT2
- Existing proof-fidelity and executable-Gherkin foundations: 1698, BFCWDB, ZA0JQR, Y9P3ZC

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- OpenCode
- Cursor
- Cursor Cloud Agents
- Safeword CLI

## Vocabulary

- **Primary proof:** The executable acceptance evidence designated to prove one behavior, even when multiple scenarios share a Scenario Outline or adapter.
- **Proof plan:** A compact mapping from a behavior to actor entrypoint, observable result, evidence class, plausible defect, proof files, and whether the proof is new, reused, or changed.
- **RED receipt:** Structured evidence from an independent reviewer that a primary proof was executed before production implementation and failed for the intended missing behavior.
- **Evidence class:** The environment actually exercised, such as pure contract, simulated host, local live host, or external live host.

## Jobs To Be Done

### executable-red.TBU1 — Know the acceptance proof is real before building

**Persona:** Technical Builder (TBU)

> When my coding agent is about to implement a behavior, I want a separate reviewer to run and challenge its acceptance proof while the behavior is still missing, so I can trust that a later green result means something.

#### executable-red.TBU1.R1 — Every distinct new or changed primary proof is independently executed before production implementation

#### executable-red.TBU1.R2 — RED is accepted only when the intended missing behavior fails through the stated actor boundary

#### executable-red.TBU1.R3 — Material changes to the scenario, proof plan, test, glue, World, shared state, helpers, command, or evidence class invalidate the prior receipt

### executable-red.NTB1 — Get protection without learning test internals

**Persona:** Non-Technical Builder (NTB)

> When I ask an agent to build a feature, I want hollow tests caught automatically and explained plainly, so I do not need to read code to know whether the feature was actually proved.

#### executable-red.NTB1.R1 — A failed review explains the missing evidence and concrete next action in plain language

#### executable-red.NTB1.R2 — Legitimate reuse does not create repetitive review ceremony

### executable-red.SWM1 — Maintain a stable review contract across coding agents

**Persona:** Safeword Maintainer (SWM)

> When I evolve the BDD workflow, I want one host-neutral RED-review contract with explicit evidence, freshness, and reuse rules, so each coding agent gets equivalent protection without duplicated policy.

#### executable-red.SWM1.R1 — One review packet contains the scoped scenario or Rule body, proof-plan row, primary proof, glue, World definition, shared-state sources, helpers, exact command, full output, captured state, and evidence class

#### executable-red.SWM1.R2 — Trusted execution records and independent-review receipts carry authentic coordinator provenance

#### executable-red.SWM1.R3 — Every supported agent host requires the same fresh, independently witnessed execution receipt before GREEN credit

## Rave Moment

skip: child feature under a program; trustworthy RED should feel invisible and table-stakes.

## Outcomes

- The historical umbrella-verdict proof is rejected before production implementation.
- Valid Scenario Outlines, shared steps, contract tests, and actor adapters require only one review per distinct proof implementation.
- Review failures name whether the gap is actor boundary, scenario observable, wrong failure reason, stale evidence, umbrella delegation, or cached/shared state.
- The normal path adds one trusted RED execution and one bounded independent review, not a second end-to-end implementation cycle.
- Review artifacts can feed the cross-agent quality evaluation without relying on agent self-report.

## Decisions

- A passing pre-implementation proof is not RED evidence, even when its execution is authentic.
- The receipt binds an exact captured-state identity that must precede the scenario's production implementation; execution against an already-implemented tree cannot qualify retroactively.
- The proof author, a cached suite status, or any other non-independent verdict cannot issue the RED receipt.
- Both the trusted execution record and the independent-review receipt must have authentic coordinator provenance; project-authored substitutes are rejected.
- When every independent review route is unavailable, this gate remains blocked and returns the exact recovery command. The best-available degraded review ladder may provide feedback, but it cannot authorize GREEN credit for this invariant.
- Both rejection and admission use the same host-neutral receipt contract on every supported host.
- Recovery messages describe a concrete next action and display the exact existing proof or reviewer-recovery command when one is available; this feature does not introduce a second recovery-command API.
- Host installation, reconciliation, and tamper resistance remain owned by the existing schema and parity contracts. This feature adds one shared receipt decision at the host transition boundary instead of duplicating those mechanisms.
- skip: Per-host invocation wiring remains owned by the existing agent-parity and schema contracts; these scenarios prove the shared transition decision once and tag every affected surface rather than faking eight host integrations with labels.
- Reviewer strength and model ranking remain owned by QZAFT2; this feature consumes its independent-review verdict without duplicating route policy.
- TBU rejection scenarios assert structured verdict reasons. NTB1.R1 alone owns the plain-language text shown to non-technical builders.
- TBU1.R1 owns trusted pre-implementation admission; TBU1.R2 owns the independent right-reason approval, avoiding duplicate approval scenarios.

## Open Questions

None at intake. The user explicitly selected blocking enforcement on 2026-09-06; FY1NHB measures and tunes the shipped gate rather than deciding whether it blocks.
