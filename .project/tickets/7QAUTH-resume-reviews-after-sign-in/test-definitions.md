# Test-first ledger

## Scenarios

### Scenario: Confirmed sign-in and cancellation

Proof: reviewer-login-continuation.test.ts; happy path, failed auth, wrong profile, cancellation and deadline.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Bound request and one linked retry

Proof: job-continuation.test.ts; request drift, tampering, duplicate completion, unchanged receipt, passive status and second authentication failure.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Connected MCP recovery and shutdown

Proof: review-mcp-continuation.test.ts; real stdio entry point, panel-independent resumption, source drift during auth check, EOF/SIGTERM termination, automatic and legacy guidance.

Both reviewer rows of the positive outline run through real stdio, not just the login module.
The MCP suite also runs both reviewers' negative login/profile checks, deadline, legacy-receipt and cancellation cases through stdio. Each waits for the login/check to settle or terminate, then asserts no retry receipt and no reviewer dispatch. Module proofs supplement those wiring checks.

| Feature scenario | Ledger group |
| ---------------- | ------------ |
| Confirmed sign-in resumes the original review once | Connected MCP recovery and shutdown |
| Abandoned or unsuccessful login cannot resume work | Confirmed sign-in and cancellation |
| Expired sign-in cannot resume after late success | Confirmed sign-in and cancellation |
| Confirmed sign-in just before expiry still resumes | Confirmed sign-in and cancellation |
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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
