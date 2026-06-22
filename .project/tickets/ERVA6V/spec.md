# Spec: Plan-vs-actual reconciliation at implement exit

## Intent

Keep the impl plan honest: when implementation finishes, the plan is reconciled against what actually shipped — changed decisions updated, drift moved to Known deviations, triggers refreshed, status flipped to `implemented` — and a hook refuses to advance to verify until that happened. Without it the plan fossilizes and misleads future readers (Design Docs at Google: humans don't update docs unless forced). Absorbed from arcade's `/implement-spec` step 6 (epic M6D315).

## References

- Epic [M6D315](../M6D315/ticket.md) — replan 2026-06-10 (reconciliation at implement exit, decision #5)
- [XDNSZA](../XDNSZA/ticket.md) — the impl-plan artifact and its status lifecycle
- [K4BWTQ](../K4BWTQ/ticket.md) — Arch alignment section the reconciliation walks (dogfooded this flow manually at its own implement exit)

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- **Reconciliation** — the implement-exit pass that updates the impl plan to match shipped reality before the ticket advances to verify.

## Jobs To Be Done

### plan-reconciliation.DEV1 — Trust the plan as a record of what shipped

**Persona:** Technical Builder (TB)

> When I read a finished feature's impl plan, I want it to reflect what was actually built — including decisions that changed mid-flight — so I can rely on it instead of diffing it against the code.

#### plan-reconciliation.DEV1.AC1 — The implement-exit procedure walks Decisions, Arch alignment, and Assessment triggers and records what changed

### plan-reconciliation.SM1 — Enforce reconciliation machine-side

**Persona:** Safeword Maintainer (SM)

> When an agent claims implementation is done, I want the phase machine to refuse the verify transition until the impl plan's status says implemented, so reconciliation can't be skipped silently.

#### plan-reconciliation.SM1.AC1 — The stop gate blocks new-flow features at verify/done while the plan says planned, and passes once it says implemented

#### plan-reconciliation.SM1.AC2 — Tasks and grandfathered tickets (no spec.md) are exempt

## Outcomes

- Finished features carry an `implemented` plan whose Decisions/deviations match the code; stale `planned` plans can't reach verify.

## Open Questions

defer: granularity (per-Decision-row prompts) stays conversational in TDD.md — machine validation is status-only per the structural-only ruling.
