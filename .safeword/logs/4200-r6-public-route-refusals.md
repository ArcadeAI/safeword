# Public route refusals without forged approval receipts

The former ungated-origin row expected an authenticated approval carrying an
unsupported origin. The public API prevents that record from being created.
The corrected row instead submits a valid bounded approval to the same sealed
job from an unsupported origin. REVIEW_CONTINUATION_ORIGIN_UNVERIFIED refuses
it without changing the job or ticket; phase admission remains blocked. A paired
supported-origin call accepts exactly the same job/output, so blanket refusal
cannot satisfy this proof. /tmp/4200-r6-ungated-origin-live.json passes one
scenario/62 reporter steps in 1.5s. The producer process is a trusted fixture;
this is public-flow integration, not cloud/host-enrollment proof.

Withdrawn retryable routing attempt first obtained a normally funded independent approval through
the configured qualified Codex/Sol route. A new plan revision needs its own job.
A 10-second reviewer-work bound is below the minimum attempt budget, so the
actual coordinator returns REVIEW_ROUTES_EXHAUSTED with retryable:true and names
the independent route honestly as unattempted. It must not launch that producer,
invent reviewer output or permit phase advancement. This was a real typed
result, but it did not establish the required attempted first route plus a
different unattempted independent route. It is not accepted scenario evidence.
The temporary Then wording and binding have been removed.

The withdrawn premature-fallback variant configured the same-agent headless route ahead of
the independent route. Its normally funded positive control still uses the
independent route. The new bounded job leaves both routes unattempted and records
no approval. A public same-job fresh-context continuation request carrying a
typed process failure is refused with REVIEW_CONTINUATION_ALREADY_USED; it cannot
consume fresh-context or offer self-review before independent exhaustion. Status
and gate checks preserve blocked/none/no-output, the unchanged route evidence,
uninvoked producer markers and the Implementation Planning phase. Available here
means configured, installed and proven callable by the normally funded control;
the later bounded run lacks funding and honestly remains retryable. It does not
claim a model review completed inside that reduced budget. Independent review
showed budget exhaustion prevented every producer launch; deleting the
independent-exhaustion guard would still let this test pass. The binding is removed.

/tmp/4200-r6-retryable-live.json passes one case; the final shared-helper run
/tmp/4200-r6-unattempted-final.json passes retryable and premature fallback,
124 reporter steps (six behavior, 118 cleanup), in 4s, but those two raw passes
are withdrawn as acceptance after review 04a74aa9-1bc3-4d6e-92b7-5d334ef2fe8c
requests changes on both non-discriminating proofs. No paid model review is
substituted or claimed by these integration cases. Existing qualified model
selection is unchanged; there is no new qualification/model/production policy.
Proof-tag tests pass 50/50. The initial feature formatter invocation had no
Gherkin parser; the feature itself still parses and the actual scenarios run.

Scoped origin source review 109934ad-7b86-4a22-a48f-51b367fab9c6 approves.
The whole-feature scenario review 7d6bbe8c-baad-4dd6-be34-8b307c4bf2b2 requests
changes: two R8 OpenCode guidance cases claim enforced approval while the parent
keeps OpenCode advisory until independent native-dispatch proof. This is a real
unresolved authority conflict in the user-deferred OpenCode work, not an origin
fixture failure. It is retained rather than concealed or used to expand this
patch into OpenCode delivery. That review also identifies the unresolved genuine
weaker-pair cases. Later row clarification means it is historical review evidence,
not a current scenario-gate stamp.

The superseded dry run /tmp/4200-r6-three-routes-final-dry.json had 145 bound
skips and 14 undefined; it included the withdrawn bindings. The corrected
/tmp/4200-r6-origin-restored-dry.json has 159 nondeferred cases: 143 bound skips
and 16 undefined. Skips are not passes. Two route constructions remain unproved.
Twelve undefined cases
require the real planning/review retrieval and privacy producer boundaries; a
packet-only loader or fabricated evidence output cannot close the user-owned host
proof deferral. The other two require a qualified weaker ordered pair, which the
shipped catalogue does not contain. The outstanding decision is to defer those
two cases or expand qualification; neither direction is silently chosen.

Historical full acceptance still retains six failures and 585 unfinished cases.
RGR ledger and whole-stack readiness remain open. No merge or promotion.

The origin-only source status is recollected after restoring the unchanged
feature bytes: review 109934ad-7b86-4a22-a48f-51b367fab9c6 is approved/current.
Only that origin binding is retained. A speculative fixture or favorable rerun
cannot substitute for the rejected route proofs.
