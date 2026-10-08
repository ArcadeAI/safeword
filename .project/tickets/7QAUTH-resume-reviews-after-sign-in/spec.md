# Resume independent reviews after sign-in

## Jobs To Be Done

### resume-reviews-after-sign-in.TBU1 — Resume reviews after authentication

**Persona:** Technical Builder (TBU)

> When I finish reviewer sign-in, I want my paused independent review to resume automatically so I can continue without managing recovery commands.

#### resume-reviews-after-sign-in.TBU1.R1 — Resume one unchanged request

Finish vendor sign-in and automatically resume the blocked independent review once. The MCP server owns continuation while connected; the panel is optional.

Bind continuation to the original signed reviewer, targets, context, source fingerprint, and policy. Require successful login plus a same-profile authentication check. Never dispatch after failure, cancellation, timeout, disconnection, changed sources/policy, or tampering. Claim one retry; retain the original receipt and link the new attempt. A second authentication failure stops.

Original status follows the retry without side effects. Text and UI explain automatic resumption. Non-goals: restart recovery, conversation wake-up guarantees, route changes, new permissions, unlimited retries.

MCP EOF or server SIGTERM cancels pending continuation and terminates its login process using the existing bounded cleanup. Closing the optional panel does not cancel. Login expires after ten minutes. The assigned executable and credential-profile environment are captured together and reused for authentication status and retry. Success in another profile never qualifies. The original signed receipt stays byte-identical; the new signed attempt records its parent. Sequential and concurrent duplicate completion must share that attempt.
