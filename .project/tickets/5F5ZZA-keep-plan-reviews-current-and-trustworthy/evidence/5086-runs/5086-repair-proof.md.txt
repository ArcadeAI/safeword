# Review repair proof for #5086

## Scenario: The review gate follows the typed route result

Given a planning reviewer whose capability is unknown completes with a rejection,
and all remaining independent routes are exhausted, when a same-agent fallback
would approve, the coordinator retains the rejection and blocks approval with
its actual reviewer and findings. No independent assurance is claimed. Under
require the same rejection remains visible and the requirement remains blocked.
A proven-weaker verdict is still discarded per accepted PR4 task 1.

Proof-plan row: R6 typed result and failure preservation; primary proof is
`keeps an unqualified rejection under %s without accepting self-approval` in
`packages/cli/tests/integration/planning-review-weaker-route.test.ts`. It exercises
the public coordinator API with reviewer execution and capability comparison
mocked; it is pure-contract evidence, not installed-host evidence. It isolates
this rejection from the already passing weaker-route ladder. Existing installed
CLI fallback tests remain the primary delivery proof for the broader feature.

Separate regression: `uses the pinned medium effort for planning qualification`
asserts the production coordinator passes the settings used by the admitted
corpus. Its RED observed undefined/undefined instead of medium/medium.

The first repair attestation cf72168a-2760-48e0-81c7-c956fa1ece39 correctly rejected
the combined test for failing on a different behavior than its name. The test
is now separated by behavior. No GREEN is claimed yet.
