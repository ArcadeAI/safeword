# Funded independent-first fallback proof

The rejected budget-only fixture is not restored. The new fixture keeps the
normal reviewer-work budget and shortens only the foreground courtesy wait.
It configures headless first, then the existing qualified independent route.
Only the independent reviewer process is held, at a release-file barrier.
The public CLI must still dispatch that independent route first.

While independent review is actually working, the real job remains pending,
the phase remains Implementation Planning, approve-plan refuses advancement and
the headless invocation marker is absent. Releasing the independent reviewer
produces process_failed; that same job must then invoke headless, approve with
reduced independence and retain the exact ordered attempted-route evidence.
This paired before/after control rejects wrong ordering, concurrent fallback
and an implementation that disables all fallback. No private job is manufactured.

/tmp/4200-r6-funded-fallback-live.json initially fails on a startup race: pending
job registration precedes the producer marker. A bounded marker barrier waits
for either producer to launch, so headless-first still fails rather than being
hidden by waiting. /tmp/4200-r6-funded-fallback-barrier.json passes one scenario,
63 reporter steps (three behavior, 60 cleanup), in 1.9s. No live-model result or
host-enrollment claim is made; this scenario permits reviewer-process mocking.

Independent source review b03f6d2b-e2a7-4fd4-be62-01a84a1cce3d approves.
It explicitly distinguishes the proven independent-first ordering from the
separate defense-in-depth planningFallbackLacksIndependentExhaustion guard.
Removing that redundant guard alone is not discriminated by this scenario;
the actual user-facing ordering invariant is. Timing bounds and the trusted
producer marker convention are retained limitations. Own cleanup releases and
cancels the job before shared fixture cleanup.

Fresh /tmp/4200-r6-funded-fallback-final-dry.json reports 159 nondeferred cases:
144 bound skips and 15 undefined. The separate retryable-second-route attempt
remains withdrawn, and the two genuinely weaker cases remain unproved without
a qualified weaker pair. Twelve retrieval/privacy producer proofs remain open.
The OpenCode scenario-review authority conflict, historical six failures/585
unfinished aggregate, RGR ledger and whole-stack readiness remain visible.
No production, catalogue, rubric, qualification, merge or promotion change.

The final variant also requests public fresh-context continuation on the same
pending job and requires explicit REVIEW_JOB_INVALID refusal. This closes the
initial review's on-request refusal warning; the job still proceeds normally
after independent exhaustion. /tmp/4200-r6-funded-explicit-refusal.json passes
one scenario/63 reporter steps in 2s. Final source review
5329609e-4f2d-4f1c-a03a-a83639d07df1 approves. It retains timing/hold limits and
the separate redundant-guard coverage limit. The bounded 30-second producer hold
can fail closed on an unusually slow machine; it is not a production deadline.
