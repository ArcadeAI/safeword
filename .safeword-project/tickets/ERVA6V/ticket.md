---
id: ERVA6V
slug: plan-actual-reconciliation
title: "Add Phase 6 exit step to reconcile impl plan against shipped reality"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
paired_with: SXNV8N
blocked_on: XDNSZA
created: 2026-05-24T21:37:59.832Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Plan-vs-actual reconciliation at Phase 6 exit

**Goal:** Add a Phase 6 (implement) exit step that reconciles the impl plan against what was actually built — update Decisions that changed during implementation, populate Known deviations with what deviated, update status to `implemented`. Run before advancing to Phase 7 (verify).

**Why:** Implementations always drift from their plans — a decision turns out to be wrong, an alternative becomes preferable mid-flight, a constraint surfaces that wasn't visible at planning time. Without reconciliation, the impl plan becomes a fossil that misrepresents what shipped. Arcade's `/implement-spec` step 6 captures this. Without it: the plan and the code diverge silently, and future readers can't tell which is authoritative.

**Parent epic:** M6D315
**Paired with:** SXNV8N in arcade
**Depends on:** XDNSZA (the impl plan must exist before reconciliation can update it)

## Scope

### Reconciliation step (Phase 6 exit, before Phase 7)

Add to TDD.md (or wherever Phase 6 documentation lives) as a required exit step:

1. **Did any Decisions change during implementation?** Walk the Decisions section. For each row, ask: "Did we actually do this, or did we change our mind?" If changed, update the choice + rationale + add the actual alternative-rejected line.
2. **Did anything deviate from arch guidance?** Walk the Arch alignment section. For each ADR claim, ask: "Did the implementation actually honor this?" If deviated, move the relevant note to the Known deviations section with the reason.
3. **Are the Assessment triggers still valid?** If the implementation surfaced new triggers (e.g., "this approach works at current scale but degrades past 10x load"), add them.
4. **Update status:** `planned` → `implemented`.

### Hook integration

- When advancing from `phase: implement` to `phase: verify`, the hook checks that the impl plan's status field is `implemented`.
- If status is still `planned` and the user attempts to advance, block with: `Impl plan reconciliation incomplete. Update <impl-plan-path> status to implemented after reviewing Decisions, Arch alignment, and Known deviations.`

### Exit artifact

The reconciled impl plan IS the artifact — no separate reconciliation document. The work log entry at Phase 6 exit notes:

```text
- {timestamp} Complete: Phase 6 — reconciled impl plan; {N} decisions updated, {M} deviations recorded
```

## Out of scope

- Auto-detecting drift between plan and code (would require LLM-driven diff); humans drive the reconciliation.
- Reconciliation against shipped _behavior_ (vs declared scenarios) — that's verify's job.
- Force-blocking deviations — Known deviations are documented, not forbidden.

## Done when

- TDD.md (or Phase 6 doc) has a documented reconciliation step at exit.
- Hook blocks `implement` → `verify` when impl plan status is not `implemented`.
- Worked example shows reconciliation: a planned decision changed mid-implementation, the row updated.

## Open questions

- **Granularity of reconciliation** — per-Decision-row review, or one big "have you re-read the plan" prompt? Driver leans per-Decision (forces specificity).
- **When the impl plan was never written** (e.g., legacy ticket, skipped section) — does reconciliation skip cleanly, or warn? Driver leans warn (call out that there's nothing to reconcile, encourage drafting one retroactively).

## Work Log

- 2026-05-24T21:37:59.832Z Started: Created ticket ERVA6V
- 2026-05-24T21:39:00.000Z Drafted: Scope (4-step reconciliation, hook integration, work log entry); linked to epic M6D315
