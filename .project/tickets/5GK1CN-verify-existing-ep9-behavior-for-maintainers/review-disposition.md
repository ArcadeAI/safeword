# Planning review and remaining design decision

Historical first-review disposition below. The user subsequently authorized
CI-backed design and ordinary review-and-repair cycles. Current scope, scenarios
and dimensions now require trusted CI execution attestation, import, latest-run
selection and a signed five-minute synchronization checkpoint. Review 4f3dc321
requested this reconciliation; it does not constitute approval of these repairs.

Actual review: 628139a4-556a-439b-b9c1-381546f595d0, quality-review,
changes_requested, actual reviewer Claude, selected model claude-opus-5-5,
coordinator independence cross-agent. Full returned evidence is archived under
evidence/. No approval stamp or qualification is inferred. No second review or
qualification campaign was started.

## Findings disposition

- Blocking provenance finding accepted. Added fresh candidate-fabricated signed
  execution followed by fresh independent approval as its own refusal case.
  Withdrew the earlier reuse decision; neither existing probe resolves it.
- Coverage warning addressed: group 1 requires separate EP9-bound evidence,
  never a borrowed T0FK4H receipt.
- Dimension warning addressed: unchanged approved payload re-signing is neutral;
  changed/fabricated execution is refused, including with fresh review.
- Reference warning addressed: feature/map and both remaining CLI repairs now
  have exact file and heading references in planning-proposal.md.
- Missing context noted: completeness-check.md must be included in a subsequent
  review together with the corrected provenance conclusion. Timestamps are UTC;
  November 6 05:38 UTC is November 5 21:38 in America/Los_Angeles, not clock drift.

## Figure-it-out assessment

Decision: where can genuine execution provenance come from without trusting a
claim manufactured by the same candidate? Domains checked: local key custody,
independent execution, attestation identity, offline closing and scope/cost.

1. Keep the shared signer alone. Smallest code change, but it cannot distinguish
   a real run from equivalent fabricated fields signed under the same account.
   Fresh semantic review is not execution observation. Reject as sufficient
   provenance under the accepted refusal requirement.
2. Isolate a local signer/observer with separate credential custody. Potentially
   sufficient, but needs an actual permission boundary and operational lifecycle;
   copying a binary outside the checkout is insufficient. Larger than this
   profile extension; do not add a new local service silently.
3. Reuse existing CI as the independent execution source. Preferred next design
   investigation: an independently controlled workflow produces a report bound
   to candidate SHA, trusted workflow identity/revision and exact proof inputs;
   validate signed provenance rather than a candidate-written local success.
   Existing .github/workflows/ci.yml already runs tests, BDD and release checks,
   but it does not yet establish this bounded eight-group attestation contract.

GitHub's primary documentation describes attestations binding artifact digest,
workflow and source identity, and offline verification of downloaded bundles:
https://docs.github.com/en/actions/concepts/security/artifact-attestations
https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline

These are building blocks, not proof that any ordinary green CI run suffices.
The trusted workflow must not let candidate code supply its own success or
obtain attestation credentials. Review source/definition integrity and exact
candidate/report binding; an attestation of arbitrary bytes is insufficient.

Recommendation: authorize a bounded CI-backed provenance design, not its
implementation or execution. It changes the earlier local-profile-only approach
and requires a user-owned scope decision. No workflow, runtime, review route,
key, existing ledger or deferred case changed in this pass. No CI was dispatched.

Premortem: an attested but candidate-authored report could look trustworthy;
require a trusted execution workflow, not merely a signature on an uploaded file.

The paid planning review was useful: it exposed a load-bearing design gap before
implementation. The block is now execution authority, not missing prose or a
request to repeat qualification until something passes.
