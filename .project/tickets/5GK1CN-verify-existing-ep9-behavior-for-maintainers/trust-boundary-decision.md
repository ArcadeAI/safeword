# Scope decision before another review

Reviews 4f3dc321 and d4f81dbd requested changes; their complete results remain
in evidence/. The planning artifacts have been reconciled to the proposed CI
producer/import design, but no approval stamp, phase advance or implementation
is claimed. No CI or qualification was dispatched. Ordinary paid review cycles
were authorized; stop repeating them until the trust assumption below is settled.

## The actual choice

Every local verifier ultimately depends on its executable and trust roots being
trusted. The existing trustedSafewordClis resolver rejects paths inside the
candidate checkout; it does not make the operator's entire home directory an
OS-enforced security boundary. Candidate-executable code running unrestricted as
that account can potentially alter user-owned installations and pins. Placing a
runtime outside the checkout alone does not remove that capability.

The CI design can prevent a local shared-key signature from substituting for
actual CI execution. It cannot promise that an already-modified local verifier
will obey any rule. That requires either an explicit trusted-installation
assumption or a stronger account/installation/control boundary.

### Option A — retain the existing local enforcement trust baseline

Trust the installed verifier and its embedded expected workflow revision/trust
roots. Do not load expected identities or roots from the candidate. Re-verify
external CI-signed artifacts/checkpoint at closing, or use a verifier-owned cache
only if its authority cannot be replaced by the candidate-accessible local HMAC.
A simple local authenticated “validated” record is insufficient.

Explicit limit: replacing the installed verifier, its embedded pins or the whole
operator environment defeats this local enforcement model and is excluded. This
does NOT make candidate observations or access to the local signing helper
trusted; CI provenance must still be verified. Do not describe the installation
as OS-protected merely because it is outside the checkout.

This is the recommended scope: it preserves the meaningful execution check
without building a new privileged local service or remote completion authority.
Need a feasibility proof that external verification fits the closing deadline;
if it does not, report that implementation decision instead of trusting HMAC.

### Option B — resist unrestricted same-account installation replacement

Require externally enforced verifier/pin protection or make closing authority
remote under separately controlled credentials. This needs a materially broader
security/operations design and additional installation/authority decisions. It
cannot be slipped into a fixed EP9 profile as ordinary implementation work.

## Required repairs after that choice

Independent reviewer d4f81dbd correctly identifies the forged-local-validation
cache case. Add that refusal regardless of the chosen baseline. Define checkpoint
selection to include only execution-mode runs identified by trusted workflow
structure; checkpoint-mode runs never compete as executions. Pin one supported
workflow revision per profile; a change invalidates the old profile/evidence and
needs fresh review, rather than silently ranking incompatible revisions together.

Treat five-minute freshness as a proposed ceiling requiring live latency proof,
not an already demonstrated operational property. Establish verifier clock
policy against verified attestation timestamps, reject future/expired checkpoints
and clock rollback outside its accepted bound. No automatic larger window.

Mark earlier no-paid-review statements as historical, refresh the coverage table,
and include planning-proposal.md in the next review packet. These are known
editorial/contract repairs, not substitutes for choosing the trust boundary.

Premortem for Option A: a user mistakes checkout separation for malicious-code
containment. State its exact installation-trust assumption and never advertise
same-account tamper resistance. Option B's risk is turning epic closeout into an
open-ended secure-execution platform; require separate scope before building it.
