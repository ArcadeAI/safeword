# Current exception and compatibility review disposition

Review 02442b05 requested one correction to compatibility proof. The new proof
does not attest a new row. It reads a frozen pre-extension CKWE2D row-v2 payload,
domain, filename, cutoff, ledger and feature from a separate golden fixture.
The fixture names baseline commit 3f5353165 and the verified original gate/job
Git blob IDs. Its public synthetic key belongs only to the temporary test profile.
Independent Node HMAC calculation adds the random temporary root binding required
by that old format; it never calls the current row/tag writer. The current gate
must accept those old-format bytes without running replay, minting replacement
credit or rewriting the file. A one-byte forgery must be refused, and restoring
the original must restore authorization. Pins catch policy drift; the old
payload/domain/filename catch incompatible reader/signature/location changes.
The BDD compatibility scenario now maps to that check. All 79 compatibility,
real Git history and BDD inventory checks pass.

Confidence limit: this compatibility test isolates review and history
collaborators, as the rest of its row-record suite explicitly documents. Real
file reads and HMAC verification prove backward row-format compatibility. It is
not a real historical external-review replay. Existing real Git cutoff tests,
the unchanged legacy proof suite and the full regression lane supply those
separate protections. No actual user's signing key or review record is used.

The whole-test monitor from 7555fc4e1 passed all 98 focused checks and the actual
source-CLI after-readiness negative probe. The old unsupported false-positive
observation stays uncredited and unchanged. Generated surfaces are current in
01911afb1; supported final installation and all-17 closing are separate required
delivery checks. Report validation preserves its existing specific setup and
malformed-report diagnostics, then requires successful monitor coverage before
accepting any otherwise qualifying result.

Nonblocking warnings retained with their consequences:

- Other workspace source is not automatically hashed. The current enrolled
  Desktop has no workspace-package dependency; every Desktop import and root
  configuration remains bound. A future cross-package dependency must be declared
  as reviewed support or receive a wider source-owned input policy.
- A renderer that goes blank without an uncaught exception can still produce a
  behavioral matcher failure. Mandatory independent proof review must judge the
  actual mutation's semantics; the runner does not replace that judgment.
- Repository remote plus fixed cutoff ancestry identify this trusted checkout;
  they do not defend against a hostile same-user repository owner. Fresh-port
  probing likewise has a known allocation race; occupied-port setup is refused.
- Failed or interrupted replay IDs remain consumed even for a benign environment
  failure. Recovery uses a fresh observation and independent proof review.
- The proof map's absent-both-review public check focuses on its early receipt
  refusal. The separate authenticated fixture cases cover valid enrollment with
  partial, declined and author-only reviews and refusal before replay.
- Node's absolute executable path is part of stable execution identity. Moving
  it requires fresh proof review; this conservative refusal is intentional.

Real installed execution has already confirmed the locked report title, basename
and unnamed-project assumptions on all 17 earlier observations. Final monitored
closing must reproduce them again. Shared-declaration inventory remains capped
at the disclosed 88 and maximum fan-in 14; no artificial wrapper tests were added.
