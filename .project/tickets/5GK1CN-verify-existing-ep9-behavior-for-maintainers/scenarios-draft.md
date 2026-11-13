# Proposed scenarios — intake draft

Not executable feature source, a RED ledger, an independent review or phase
approval. No completion credit is claimed. Promote through the normal BDD
workflow only after intake review; ordinary bounded planning reviews are now authorized, but qualification and CI execution are not.
Lineage refers to the three Rules in spec.md.

## R1 — Fixed eligibility and complete proof

### Complete EP9 coverage can receive distinct current credit

Given the exact installed EP9 profile and a clean candidate satisfying ordinary prerequisites
And actual passing bound execution covers all eight groups with current qualified independent certification
When the maintainer requests EP9 current-proof admission
Then admission permits current credit for EP9 only

### Another ticket or another profile cannot borrow the exception

Given otherwise valid current evidence for a different ticket or profile
When that evidence is presented for EP9 admission
Then admission refuses without changing any completion record

Partitions: T0FK4H's seven-proof receipt, this prerequisite's own ticket, an
unknown ticket and a candidate-authored EP9 profile substitution. The existing
T0FK4H positive control must retain its own eligibility and exact proof bindings.

### Incomplete observation cannot receive credit

Given an EP9 observation with missing, duplicate, mismatched or failed bound proof
When the maintainer requests admission
Then admission refuses even if the aggregate test count is passing

## R2 — Independent authority and revocation

### Candidate-controlled verification cannot approve the candidate

Given the proposed verification runtime is controlled by the EP9 candidate
When current-proof admission is requested
Then no completion authority is granted by that runtime

Partitions: direct candidate path, external symlink into candidate, local binary
shim or loader, substituted profile, and candidate-altered signed evidence
presented with the previous independent approval.
For forged evidence, first establish that an independently executed observation
on the same candidate succeeds; the refusal must identify forged provenance,
not an unrelated missing dependency. Neither a shared signing key nor copying
candidate code outside the checkout establishes independent verifier authority.

Re-signing an identical already-approved payload is not a new claim and is not
required to fail solely because of who recomputed the tag. The required refusal
is for changed or fabricated execution without trusted CI provenance. Candidate
code can access the operator's local signer; that signer is not execution
authority. The required claim comes from the fixed CI producer and isolated
signing job, not from trust in the candidate's operator account.

### Fabricated execution cannot become authentic through a fresh review

Given the candidate authors and signs a fresh observation claiming tests that never ran
And a fresh independent reviewer approves its apparent coverage
When EP9 current-proof admission is requested
Then completion is refused for unproven execution provenance

Use a separately executed positive control for the same candidate and bindings.
Do not reuse an old approval, corrupt a signature or omit a prerequisite: those
would test a different refusal. A review of convincing evidence is not proof
that the described execution occurred. The earlier two diagnostics do not
exercise this scenario. The proposed CI attestation must prove trusted execution
independently of the fabricated local claim and fresh semantic approval.

### Unavailable trusted support refuses safely

Given the independently installed verifier is absent or cannot finish within the supported host deadline
When a maintainer requests current credit or closing
Then the host refuses completion and reports how to restore trusted support

No download, local-source fallback or weaker verification may grant authority.
Exercise cold cache and timeout separately, each after a valid installed control.

### Invalid certification cannot authorize completion

Given a complete passing EP9 observation
And its certification is not current authenticated qualified independent coverage
When admission or closing is requested
Then completion is refused without replacing earlier evidence

Partitions: same-agent, reduced independence, unqualified model, missing review,
forged receipt, mismatched observation/candidate/profile/verifier and incomplete
coverage judgments, an overall approve verdict containing an error finding,
and an approve verdict containing a per-group rejection. Each partition changes only that condition after a valid
positive control; it must fail for its named reason.

### Changed proof revokes previously accepted credit

Given EP9 current credit was admitted from valid independent proof
When a bound product, test, harness, profile, verifier or evidence input changes or disappears
Then closing refuses the previously admitted claim

A later failed observation is a separate revocation partition; the old passing
attempt remains historical and must not become the current success again.

## R3 — Honest history and ordinary closing

### Explicit EP9 completion preserves history and unrelated work

Given valid independent current proof and all ordinary completion prerequisites
And EP9 retains its actual mixture of genuine recorded RED and missing historical evidence
When the maintainer explicitly completes EP9 on a supported local host
Then only EP9 completes with current verification and each group's historical status unchanged

Inspect original ledger bytes, failed/stale/rejected review history, sibling and
parent statuses, model catalogues and all 33 deferrals before/after. None changes.
Execute separately on installed Claude Code, Codex and Cursor; never treat a
private synthetic fixture run as that installed-host evidence.

Groups with genuine recorded history retain it; missing groups stay missing.
An already-completed genuine RGR group is a positive preservation control, not
relabelled as missing merely because another group needs current credit.

### Ordinary prerequisites still prevent closing

Given valid EP9 current-proof credit
But an ordinary dependency, passing-test, scope, required-review or cross-scenario disposition prerequisite is unmet
When explicit EP9 completion is requested
Then the same ordinary prerequisite still refuses completion

Each partition starts from an otherwise passing control. Current credit is an
alternative historical-evidence claim, not a bypass of implementation or review.

### Excluded hosts and producers remain excluded

Given current proof is requested from an unsupported producer or host
When admission or closing is requested
Then no EP9 current-proof completion authority is granted

Keep actual supported producer identity distinct from the host consuming the
receipt. OpenCode/cloud cases remain deferred, not newly implemented here.

## Proof order and limits

### Forged local validation cannot replace external proof

Given an otherwise fresh independent coverage review
When candidate code forges or edits a local validation cache or supplies a different trust pin
Then closing refuses without valid CI signatures matching the verifier's embedded pin

The trusted installed verifier re-verifies external report/checkpoint signatures
and exact bindings at closing. Local HMAC validation flags are insufficient.
Replacing the installed verifier or its embedded roots is outside this bounded
feature, not a claimed protection. Candidate-controlled data and local signing
helpers remain untrusted despite that explicit installation-trust assumption.

### Untrusted uploads cannot acquire trusted execution identity

Given a candidate uploads a complete-looking report without the fixed CI execution
When the separate signing job considers that artifact
Then no successful execution attestation is issued

Partitions: wrong repository/workflow/revision/candidate/profile/artifact digest
or run attempt, artifact replacement between jobs, and candidate access to
runner-held GITHUB_TOKEN, ACTIONS_RUNTIME_TOKEN or OIDC/signing credentials.
Local canaries do not establish these GitHub-specific boundaries.

### Only the synchronized latest execution attempt can close

Given an older passing execution and a newer failed, interrupted or pending attempt for the same candidate/profile
When the trusted signer prepares a completion checkpoint
Then it refuses closing from the older success

Select by CI-service ordered run/attempt metadata, not caller-selected IDs.
An explicit successful retry may become current with new observation-bound
review and checkpoint; keep earlier failures and never silently retry until green.

### Closing requires a recent signed synchronization checkpoint

Given valid execution provenance and independent review
When its checkpoint is absent, altered, bound to another run or older than five minutes
Then closing refuses and requests checkpoint renewal

The trusted CI signer queries latest execution state before signing candidate,
profile, workflow, execution run/attempt, observation digest, query time and
expiry. A local HMAC timestamp cannot replace it. Offline closing cannot detect
unseen remote events during that five-minute window; do not claim real-time status.

### Observation alone never performs a closing edit

Given valid EP9 current evidence has been observed and independently certified
When the maintainer has not explicitly requested a completion edit
Then no ticket status changes automatically

### Admission cannot be reused after a change before closing

Given admission succeeded for an unchanged EP9 candidate
When a bound input changes before the explicit closing edit
Then closing revalidates and refuses without granting partial completion

Prove the independent-verifier/forged-provenance refusal first, then fixed
eligibility and complete-observation controls, certification, revocation and
local closing. Add genuine prospective RED for this prerequisite. This draft
does not authorize implementation, invent historical RED, qualify a model,
install a runtime, merge work or close any ticket.
