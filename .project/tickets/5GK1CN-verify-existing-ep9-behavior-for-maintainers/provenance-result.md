# Private provenance diagnostic

Review correction: the Decision below is a preserved earlier conclusion, now
withdrawn following review 628139a4-556a-439b-b9c1-381546f595d0. The probes do not
establish refusal of freshly fabricated execution followed by fresh review.
Candidate code shares the operator account by default; access to the signing
helper cannot simply be dismissed as account compromise. No safe implementation
decision or phase approval follows from these two probes.

Two source-CLI probes used disposable synthetic current-proof fixtures with
private test keys and fake producer/review records. No actual producer, reviewer,
qualification, installed-host success or production security verdict is claimed.
All temporary fixture roots and keys were deleted. No real keys were logged.

1. The valid synthetic control passes. Candidate-local code then invokes the
   existing signing helper on the identical approved payload; admission still
   passes (exit 0). This does not create a different assertion or bypass review.
2. Changing the observation's started_at field and computing a valid private
   fixture signature causes full admission to refuse (exit 2), specifically
   CURRENT_PROOF_REVIEW_INVALID: no fresh independent dedicated approval covers
   the changed proof. A valid observation tag alone does not grant completion.

Correction to completeness-check.md: its proposed refusal of equivalent content
based solely on issuer identity was too strong. Re-signing identical approved
content is not a forgery. The useful invariant is refusal of changed claims
without fresh independent approval. This correction does not authorize candidate
runtime substitution, unauthenticated records or fabricated native execution.

Decision: retain existing external-runtime lookup and exact review-fingerprint
binding. Do not introduce a new signer, service or OS-level identity mechanism.
The existing trust model assumes the operator account/key store is trusted;
defending against its complete compromise is not part of this bounded feature.
These two probes support that design choice but do not exhaustively validate
all candidate-issued execution attacks or replace prospective implementation
tests and independent review.

## Actual remaining block

Historical status at the time of the probes: ordinary planning reviews were
subsequently authorized and have requested changes. The no-review permission
statement below is superseded; no independent approval or coding authority has
yet been earned. CI-backed design and current scenarios are normative now.

The feature is at intake with an unreviewed spec and draft scenarios. Ordinary
intake exit requires the configured independent review; no current receipt
exists. The earlier no-paid-calls instruction prevents dispatching a new model
review, even though it is an ordinary planning review rather than qualification.
No phase was advanced, receipt invented, gate weakened or code implemented.

The next action is one bounded ordinary planning review of the ticket/spec,
proposal and scenarios with the requested latest models, preserving the actual
review independence and any findings. This needs fresh spending authority.
It is not permission for a new 99-call qualification campaign, installation,
route change, merge or release. Model qualification and EP9 completion remain
separate downstream prerequisites.
