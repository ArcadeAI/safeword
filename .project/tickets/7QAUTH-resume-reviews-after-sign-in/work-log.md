# Work log

## 2026-10-08

The user approved implementing server-owned automatic recovery after sign-in. Intake and the scenario/plan gates ran before the ticket's first Git commit; the first committed snapshot is therefore at implement. The workflow was not skipped.

Independent Claude/Opus approvals, with Codex as author:

- Intake: `6cf8f258-cba1-4341-baea-dc021f729a31`.
- Scenario gate: `8efdacf9-cd34-487d-9fe7-2770deab08e2`.
- Implementation plan: `fecffe8b-4d74-45e0-a090-eed09cbdecd9`.
- Executable RED for the login module contract: `acc222a3-964c-44b6-b837-ba072c78632d`.

Real installed vendor status checks showed authenticated defaults and unauthenticated empty profiles. Sanitized results live in vendor-contract.json; no credentials were copied or logged.

Login-module RED exposed missing continuation. Added stronger termination-before-release checks after independent review; existing assertions remain intact. GREEN passed 24/24 targeted tests, including captured-profile reuse, unsupported auth methods, cancellation and the 9:59/10:00 boundary. Implementation commit: `f772b8437`.

The module approval does not claim full recovery. Signed-job and real-stdio MCP proofs own retry dispatch, receipt lineage and terminal verdict; those steps remain unchecked until executed.

Independent quality review `4a4e34e5-0b55-4275-a0a0-e16397962f5f` approved the first module slice. Added held-status expiry coverage and a real signed-worker 9:59 proof in `02948323b` and `a5b264867`; those additions remain unexecuted while another checkout owns the shared Vitest lock. No competing test process or lock removal was attempted. A lock timeout is infrastructure evidence, not executable RED.

## Connected actor proof and signed-worker checks

The approved assertion corrections are committed in f98e99d7e. The standalone signed-job proof passes with one linked attempt and unchanged original bytes. The Vitest matrix remains queued behind a foreign live runner; its GREEN row remains unchecked.

Independent executable RED review 0ed3cdfb-d3a3-4348-baf1-2ad63288c689 approved the real stdio actor boundary for both vendors. It assigns executable substitution discrimination to the separate real-worker matrix, which still needs execution. The connected continuation now passes the standalone stdio proof for both vendors, with one linked verdict and unchanged original bytes.

Independent signed-retry review 4450ea22-48be-4640-9146-04248523e42e found later ranked routes could not resume. Regression c4f218ba8 reproduced this with a real worker. The fix pins the authenticated reviewer/model, and its standalone proof passes. Testing also exposed macOS canonical-path admission mismatch and early worker failures left pending; both were corrected. Re-review ea38fc90-5a94-462e-b3dc-224c7663adf4 approved the signed-retry slice with warnings.

The user approved the fixture routing corrections. Commit 201689a1b puts synthetic vendors on PATH and retains all assertions.

Whole-feature review 424188d1-6aa5-4e44-834d-9c27e77481ef found that executable drift prevented manual sign-in. Regression ab0a9b2f3 reproduced it for both vendors; ae1f0881f restores manual authentication while refusing automatic dispatch. Regression c78a9a217 also reproduced a device-code prefix captured at a stream boundary; ae1f0881f waits for the delimiter. Both standalone proofs now pass, as does the real stdio automatic continuation proof for both vendors.

Independent Claude/Opus re-review 2adfa057-675b-43e8-adf1-b97d5febda9e approved the whole source change with warnings about binding-capture cost, narrow cancellation races, delimiter-free vendor output and unexecuted matrix coverage. Type checking passes. Regenerated native plugins in 2374015d1; all five generated surfaces pass their drift check.

The previous targeted matrix waited 60 minutes behind the foreign runner and exited 75 without starting tests. After fixture approval, another attempt waited one minute behind a different checkout and also exited 75 without starting CLI tests. A single targeted package run is now queued with a ten-minute lock wait. No competing Vitest process or lock removal was attempted. Required GREEN rows remain unchecked.

The queued targeted matrix completed: all three files and 53 tests passed in 14.92 seconds. This executes the drift, tampering, concurrency, cancellation, deadline, passive-status and connected-MCP cases. Source and fixture checkpoint: 201689a1b; generated checkpoint: 2374015d1. Broader review/Codex regression checks remain queued behind the shared runner.

The GREEN edit gate required refreshed executable RED receipts after proof changes. Independent review 7747cf3d-6617-474d-91ae-cdbebaebd5eb approved the current standalone signed-job proof against an isolated pre-implementation source snapshot from 300eb0d74. This refresh does not reconstruct historical TDD; its scope remains the sequential retry-reservation module contract. The connected proof refresh is still pending after repairing the isolated baseline setup; its GREEN row remains unchecked until independently approved.
