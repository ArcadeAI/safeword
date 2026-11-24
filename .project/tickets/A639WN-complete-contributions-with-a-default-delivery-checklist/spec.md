# Feature Contribution: Complete contributions with a default delivery checklist

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU2
- **Killer Demo:** inherited from the parent spec — skip: this child proves complete contribution delivery rather than the full planning-phase payoff

## Contribution

> When Safeword and I execute an accepted feature, I want one complete delivery
> checklist before execution begins and help completing it as we work, so the
> contribution reaches review with its behavior,
> maintainability obligations, and evidence handled instead of discovering
> missing work after the code is written.

## Rules

<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU2.A639WN.R1 — The Safeword CLI exposes a deny-only execution prerequisite that requires, and reports in planning order, accepted scenarios, an accepted implementation approach, and one visible default Delivery Checklist

#### plan-implementability.TBU2.A639WN.R2 — The feature Delivery Checklist covers outcome and scope, resolved decisions, dependency and pull-request decomposition, testing, data and compatibility, monitoring and failure signals, security and privacy, rollout and rollback, documentation, ownership and human dependencies, and concrete completion evidence

#### plan-implementability.TBU2.A639WN.R3 — Safeword carries the checklist through feature execution rather than using it only as an end-of-work audit, and each category is completed with evidence, marked not applicable with a concrete reason, or recorded as an explicit human-owned dependency

#### plan-implementability.TBU2.A639WN.R4 — The feature checklist lives in the Execution Plan; the 3EG00H TBU3 small-work contract separately owns proportionate task and patch checklist behavior without creating feature artifacts

#### plan-implementability.TBU2.A639WN.R5 — Large feature contributions use the reviewable pull-request slicing contract from child 6XW8H7, while a contribution small enough for one coherent review records that decision without artificial decomposition

#### plan-implementability.TBU2.A639WN.R6 — Safeword reports contributor readiness only when every contributor-controlled obligation is completed and proven, reports pending human approvals or ownership as unresolved dependencies, and never treats readiness evidence as human approval or merge authority

#### plan-implementability.TBU2.A639WN.R7 — This child defines the canonical Delivery Checklist evidence-currency taxonomy—current-revision real-boundary proof, reusable earlier-revision proof, partial or structural proof, and missing proof—and never silently upgrades one class into another

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Claude Code — skip: M1 defines the checklist contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- Claude Code Cloud — skip: M1 defines the checklist contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- OpenAI Codex — skip: M1 defines the checklist contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- OpenCode — skip: M1 defines the checklist contract; YCFFNC in M2 owns catalogue delivery and real-boundary proof, while Desktop enforcement remains advisory until native hook support exists
- Cursor — skip: M1 defines the checklist contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- Cursor Cloud Agents — skip: M1 defines the checklist contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- Safeword CLI — exposes the deny-only execution prerequisite, Delivery Checklist readiness, retained proof recording, and Execution Plan review used by this contract

Unaffected:

- Claude Code on the Web — no browser-entry-point behavior changes
- OpenAI Codex Cloud — repository instructions remain advisory; no local planning gate is available
