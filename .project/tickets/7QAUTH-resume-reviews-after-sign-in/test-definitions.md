# Test-first ledger

- [x] cross-scenario skip: independent whole-source review and passing 53-test matrix confirm shared context and cancellation boundaries; binding-capture cost and duplicated standalone harnesses remain explicit follow-up opportunities

## Scenarios

### Scenario: Confirmed sign-in and cancellation

Proof: reviewer-login-continuation.test.ts; happy path, failed auth, wrong profile, cancellation and deadline.

Module contract only: a successful login plus a qualifying assigned-profile status invokes the continuation callback once. Failed, unsupported, cancelled or expired authentication does not invoke it; cancellation terminates an active check. This slice does not claim review dispatch, lineage or verdict. The connected MCP slice owns that feature proof.

- [x] RED 57e22472b
- [x] GREEN f772b8437
- [x] REFACTOR skip: login and status share one captured context and bounded lifecycle; no separate restructuring needed

### Scenario: Bound request and one linked retry

Proof: job-continuation.test.ts; request drift, tampering, duplicate completion, unchanged receipt, passive status and second authentication failure.

The standalone authentication-retry-proof.ts also exercises the existing review-job API and read-only status with real signed files and synthetic worker processes. It reproduces the duplicate completed attempt without Vitest while another checkout holds the shared runner. This is a signed-job contract proof; the stdio suite remains the primary full-feature proof and the Vitest matrix remains required for GREEN.

Module contract only: the reservation API must return the same linked attempt for repeated authenticationRetry requests. The signed synthetic verdict is a Given for completed-record deduplication, not evidence that a real reviewer ran. This group does not claim the feature's login-completion actor interaction; the real stdio proofs own that boundary.

- [x] RED 300eb0d74
- [x] GREEN 201689a1b
- [x] REFACTOR skip: binding, reservation and read-only child lookup share the existing job protocol; no behavior-preserving extraction is needed for this slice

### Scenario: Connected MCP recovery and shutdown

Proof: review-mcp-continuation.test.ts; real stdio entry point, panel-independent resumption, source drift during auth check, EOF/SIGTERM termination, automatic and legacy guidance.

Both reviewer rows of the positive outline run through real stdio, not just the login module.
The MCP suite also runs both reviewers' negative login/profile checks, deadline, legacy-receipt and cancellation cases through stdio. Each waits for the login/check to settle or terminate, then asserts no retry receipt and no reviewer dispatch. Module proofs supplement those wiring checks.

| Feature scenario | Ledger group |
| ---------------- | ------------ |
| Confirmed sign-in resumes the original review once | Connected MCP recovery and shutdown |
| Abandoned or unsuccessful login cannot resume work | Confirmed sign-in and cancellation |
| Expired sign-in cannot resume after late success | Confirmed sign-in and cancellation |
| Confirmed sign-in just before expiry still resumes | Bound request and one linked retry; login-module deadline supplement |
| The original request must still match before dispatch | Bound request and one linked retry |
| Concurrent completion cannot duplicate reviews | Bound request and one linked retry |
| A later completion returns the existing attempt | Bound request and one linked retry |
| Authentication in another profile cannot resume work | Confirmed sign-in and cancellation |
| Server shutdown terminates owned login processes | Connected MCP recovery and shutdown |
| Closing the optional panel does not cancel continuation | Connected MCP recovery and shutdown |
| A source change during authentication prevents dispatch | Connected MCP recovery and shutdown |
| Status observes recovery without starting work | Bound request and one linked retry |
| Sign-in guidance explains automatic continuation | Connected MCP recovery and shutdown |
| A second authentication failure stops recovery | Bound request and one linked retry |
| Legacy receipts keep manual retry guidance | Connected MCP recovery and shutdown |

- [x] RED 4338c7ee8
- [x] GREEN 201689a1b
- [x] REFACTOR skip: one server-owned continuation and one display barrier preserve the four-tool interface; no additional restructuring needed
