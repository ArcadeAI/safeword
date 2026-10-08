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

Two committed fixtures use unused executable override variables. The concrete .review/fixture-routing.patch puts synthetic vendors on PATH and retains all assertions. Explicit human approval for those additional fixture corrections is pending. Final lint, broader tests, regeneration and whole-feature review remain required.
