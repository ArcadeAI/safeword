# Impl Plan: Plan-vs-actual reconciliation at implement exit

**Status:** implemented

## Approach

Test layers + build order:

1. **Gate cells** (7 scenarios) — extend `packages/cli/tests/integration/impl-plan-gate.test.ts` (reuse its `writeTicket`/`runStopHook` fixtures; add a `status` knob to the fixture plan). Implementation: in `checkImplPlanArtifact` (stop-quality.ts), extend the phase list to `['implement', 'verify', 'done']` for existence/validity, and add the status check (`status !== 'implemented'` → hard-block) for `verify`/`done` only.
2. **Docs** (1 scenario) — TDD.md gains an "Implement exit: reconcile the plan" section (walk Decisions, walk Arch alignment → move drift to Known deviations, refresh Assessment triggers, flip status, work-log line) + worked example with a changed decision; sync dogfood copy; doc-presence test with labelled markers.

## Decisions

| Decision             | Choice                                                          | Alternatives considered                 | Rejected because                                                     |
| -------------------- | --------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Gate placement       | Same `checkImplPlanArtifact` function, phase-conditional status | Separate `checkReconciliation` function | Two functions reading the same file in the same hook is duplication  |
| Verify-phase gap     | Extend existence/validity to verify (review F1)                 | Status-only check at verify             | Status read on a missing file is a crash or silent skip — incoherent |
| Reconciliation depth | Conversational procedure in TDD.md; machine checks status only  | Per-Decision-row machine validation     | Prose extraction — violates the structural-only ruling (YR6C49)      |

## Arch alignment

skip: no project-local ADR directory yet — extends the impl-plan gate pattern this epic itself established (XDNSZA), no recorded decision touched

## Known deviations

skip: none — reconciled at implement exit: all three Decisions rows held as planned (same-function gate, verify extension per review F1, conversational depth); zero deviations

## Assessment triggers

- Teams want reconciliation evidence beyond the status flip (e.g., a reconciliation work-log entry validated by the done-gate) → revisit machine-side depth.
- MBGQ89 reference schema lands → per-claim validation could join the reconciliation walk.
