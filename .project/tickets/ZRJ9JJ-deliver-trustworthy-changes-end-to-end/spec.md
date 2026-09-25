# Product Plan: Ship trustworthy changes end to end with Prodigy

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Safeword has strong but fragmented behavior, planning,
  review, verification, remote execution, and host-integration systems. Builders
  still encounter avoidable pauses, inconsistent contracts, local-only setup,
  and interfaces designed without one explicit experience standard.
- **Expected outcome:** Prodigy carries accepted intent through interaction
  design, BDD/TDD, reviewed planning, implementation, verification, and a
  human-reviewable pull request with equivalent guarantees on Claude Code,
  Codex, and Cursor.
- **Success threshold:** One release acceptance corpus proves every release gate
  and supported host end to end, including recovery paths; no phase, canonical
  artifact, reviewer, remote system, or generated surface has an unowned or
  drifting contract.
- **Project non-goals:** Automatic PR merge, one mandatory artifact provider,
  one reviewer vendor, identical lifecycle mechanics across unequal hosts, or a
  rename before the underlying experience is stable and reversible.

## Jobs To Be Done

### prodigy-flow.TBU1 — Finish an accepted change without process dead ends

**Persona:** Technical Builder (`TBU`)

> When product intent is accepted, I want Prodigy to keep the work moving
> through every meaningful quality boundary, so I receive a trustworthy pull
> request without babysitting the workflow.

#### prodigy-flow.TBU1.R1 — GREEN continues through refactor, whole-ticket review, verification, and PR readiness unless real authority or safety is required

#### prodigy-flow.TBU1.R2 — Implementation and Execution Plans have distinct purposes, canonical contracts, and current review evidence

#### prodigy-flow.TBU1.R3 — Canonical artifacts may live in configured local or external systems without ambiguous authority

#### prodigy-flow.TBU1.R4 — Human review is configurable per canonical artifact as required, optional, or none

#### prodigy-flow.TBU1.R5 — Implementation Planning discovers and decides the approach for a focused review; Execution Planning consumes those decisions and makes the work startable

## Shape

### M2 — Finish local and remote delivery systems

- **Outcome:** Propulsive post-GREEN flow, hosted independent review, remote
  verification, and remote retro operations pass local, integration, failure,
  and live production proof.
- **Non-goals:** Claiming parity from mocks or advisory documentation alone.

## Killer Demo

> For a builder asking Prodigy to deliver a representative cross-surface feature,
> one accepted intent proceeds through interaction design, BDD/TDD, both
> planning reviews, implementation, hosted review, remote verification, and a
> review-ready pull request on Claude Code, Codex, and Cursor, visibly proven by
> matched artifacts, receipts, recovery drills, and live parity evidence without
> automatic merge.
