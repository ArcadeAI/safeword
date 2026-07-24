# Impl Plan: Close Codex tickets when evidence passes

**Status:** implemented

## Approach

**Riskiest assumption:** Codex Stop can add the lifecycle transition without
changing continuation order or closing a ticket owned by another session. The
architecture advisory qualifies only before status mutation, so the adapter
must cache it before evaluating evidence, discard it on failure, and return it
after a successful transition. The primary proof is a real-adapter integration
fixture: it writes a Codex-scoped active-ticket state and a minimal ticket,
invokes `hooks/codex/stop.ts`, then asserts ticket fields and JSON response.

| Scenario / rule | Primary proof | Build order |
| --- | --- | --- |
| Bound passing transition | Integration | Add fixture; assert only the bound ticket becomes done. |
| Noneligible no-op | Integration | Exercise no binding, non-done phase, and already-done state. |
| Failed evidence | Integration | Assert exact block and unchanged state for verify, scope, feature, dependency, and test failures. |
| Ordering | Integration | Seed extraction/filer and architecture fixtures; assert extraction sees pre-transition state, evidence blocks first, and success returns architecture before filer. |
| Mutation boundary | Integration | Snapshot Git/index before and after a successful hook; ticket lifecycle fields only. |
| Delivery | Parity + package tests | Synchronize canonical template and dogfood mirror; run parity/schema coverage. |

Build one failing adapter test at a time, run it RED, implement the smallest
change to GREEN, then add the next behavior. Do not rely solely on fast
`done-gate` predicate tests because this ticket is about Stop adapter wiring.

## Decisions

| Decision | Choice | Rejected alternative |
| --- | --- | --- |
| Evidence source | Reuse `evaluateDoneEvidence` | Relaxing the PR guard or duplicating the predicate would weaken or drift policy. |
| Ticket selection | Require Codex session binding for lifecycle mutation | Global fallback could close another session's ticket. |
| Continuation priority | Cache eligible advisory before mutation; block only on failure; advisory before filer on success | Recomputing after status mutation loses the qualifying advisory. |
| Git ownership | Update ticket lifecycle fields only | Hook auto-stage/commit violates builder ownership. |

## Arch alignment

- Change the canonical `packages/cli/templates/` hook and reconcile the dogfood `.safeword/` mirror.
- No new template path: schema registration is unchanged.
- Reuse cross-runtime shared evidence instead of copying policy into Codex.

## Known deviations

The all-repository verification attempt hit unrelated fixture timeouts under
concurrent workspace load. The affected TypeScript golden-path and
check-reconcile fixtures passed when rerun alone, so no production deviation
was introduced by this ticket. The remaining Go golden-path timeout is outside
the changed runtime and remains a local evidence limitation.

## Assessment triggers

Revisit this design if another runtime needs the same session-bound Stop
transition or if the shared done-evidence predicate gains asynchronous checks;
either change would justify extracting lifecycle orchestration rather than
keeping it local to the Codex adapter.

## Doc impact

Updated the README and Codex website documentation because Stop now has a
customer-visible evidence-gated ticket transition. The docs explicitly retain
the no-Git-ownership boundary.
