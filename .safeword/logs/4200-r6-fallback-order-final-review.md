# R6 fallback order characterization

Review this bounded root proof and its setup wording correction. No production
code changes. Accepted rule: independent routes precede same-agent headless,
then host-reported fresh-context, then bounded self-review. Actual typed failures
must precede the next tier; a later tier cannot bypass a pending earlier tier.

The outline Given now configures preceding routes to fail when attempted rather
than asserting those failures happened before the actual recovery event. The Then
still requires actual attempted/process_failed receipts and observed order.
Cucumber's current reference distinguishes initial context from the event and
observable outcome: https://cucumber.io/docs/gherkin/reference/#given . Alternatives
were prematurely completing recovery in Given, or introducing intermediate
process barriers. The former obscures the actual event; the latter adds timing
and runner mechanics without increasing order evidence. This correction keeps
one real coordinator event and the same required ordered exhaustion outcome.
Premortem: setup wording could weaken the requirement; exact actual route-failure
assertions, ordered launch observations and a refused valid later-tier approval
are the controls against that mistake. All epic-related test edits are authorized.

Actual installed CLI/project configuration, registry, packaged capability and
saved authenticated jobs are used. Only reviewer processes are mocked. Non-probe
Codex and Claude launches append to a log. The real runtime may retry trusted
executable candidates within a tier; adjacent identical tier entries are grouped,
so legitimate retries do not masquerade as another configured route. Interleaved
or reversed tiers still fail. Exact final review_routes must show independent
process failure, then either headless approval or headless process failure.
The launch log contains only observed producer events. Host model/context is
reported by the fixture, not independently observed. Current job status, dispatch ID,
continuation tier and prior typed fresh-context failure bind those submissions.
Both host cases first submit a valid self-review output while fresh-context is
pending, require REVIEW_CONTINUATION_TIER_INVALID, and verify that the same sealed
job remains pending fresh-context with no consumed attempt. Correct later recovery
must approve that same job and preserve its ordered route summary. No stamp or
phase-admission proof is claimed by this partition.

Initial characterization /tmp/4200-r6-fallback-order.json failed 3/3 because the
fixture assumed one Codex producer launch; actual trusted-candidate retry creates
two. Source runtime.ts runReviewerCandidates establishes bounded executable
candidate iteration. The next run passed headless and failed two host controls
because invalid CLI requests correctly exit 1, while the fixture expected review
blocking exit 2. Exact typed refusal remains asserted. Final selected run
/tmp/4200-r6-fallback-order-final.json passes 3/3, 171 steps. These are characterization
runs against existing behaviour, not invented production RED/GREEN evidence.
Final discrimination/regression passes fourteen root cases (798 steps) in
/tmp/4200-r6-fallback-order-discriminating.json. Proof-tag checks pass 50/50 and
Gherkin lint is healthy. Initial Claude approval
063cd48a-e0fc-489c-b4ae-4f59654c9b50 suggested removing manually written host
trace entries and asserting absence of a headless continuation; both were done.
The route-level degraded value is its existing nominal route category, not an
achieved capability verdict; actual receipt independence is separately asserted
reduced. No new timeout mechanism or catalogue change is needed for this proof. The preceding production fix has 11,421 normal test
passes and current independent approval at 11df809d6; this proof does not claim
whole-head review or complete RGR. Real-catalogue weaker proof, remaining unbound
cases, historical full acceptance failures and explicit deferrals remain open.

Review angles: real invocation vs fabricated route summary; exact earlier failure
and no-later-tier controls; identity/current-job binding; candidate grouping;
truthful Given/event/outcome semantics; scope and host-provenance limits. Apply
the accepted plan's authority-before-claims and honestly reduced fallback rules.
