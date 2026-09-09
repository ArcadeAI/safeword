---
id: KE71IZ
slug: same-review-route-diagnostics-everywhere
type: task
phase: todo
status: todo
scope: |
  Give every project the same review-route diagnostics, then delete the
  duplicate orchestration engine behind the difference.

  TODAY: coordinator.ts:1677 forks on whether the project configured
  `crossAgentReviewRoutes`. Configured projects run `runRankedRoutes`
  (a general N-route engine). Everyone else runs a hardcoded four-rung
  ladder — `executePrimaryReview` -> `runAlternateModelRoute` ->
  `runIndependentFallback` -> `runDegradedFallback` — about 600 lines
  that duplicate the ranked engine's job in a second vocabulary.

  The two emit DIFFERENT envelopes for the same situation:
    ladder : flat `preferred_failure`, `independent_fallback_failure`,
             `preferred_model`, `alternate_model_failure`
             (built by `routeFailureData`, coordinator.ts:846)
    ranked : `review_routes: RankedRouteEvidence[]`
             (built by `rankedExhaustedResult`, coordinator.ts:450)
  Finding codes differ too: REVIEW_INDEPENDENCE_DEGRADED (ladder) vs
  REVIEW_ROUTES_EXHAUSTED / REVIEW_INDEPENDENCE_REQUIRED (ranked).

  WHY THE RANKED ENGINE IS THE KEEPER: the flat fields cannot express an
  arbitrary route list — they hardcode preferred/alternate/independent/
  degraded. `review_routes` is an array and describes any ladder. The
  ladder is the special case; ranked is the general mechanism.

  WHY THIS IS NOT A PLAIN REFACTOR: the flat keys are an enumerated
  acceptance contract. features/clarify-review-coverage.feature:163-166
  lists the exact key set per scenario, and `preferred_failure` appears
  in 5 test files. Safeword auto-upgrades, so switching the default path
  to the ranked envelope would silently change output under consumers.

  SEQUENCE (one commit each; .feature specs stay green throughout):
  1. Teach `rankedExhaustedResult` (and its siblings) to ALSO emit the
     flat legacy fields when the routes came from `builtInReviewRoutes()`
     (policy.ts:68) — route[0] -> preferred, the cross-agent fallback ->
     independent. Additive: envelope gains a key, loses none.
     Ship with a tripwire test per .safeword/guides/testing-guide.md:444
     ("Upstream Workaround Tripwires") so the projection is deleted at the
     next major instead of becoming permanent.
  2. Fix ranked prose: "N configured review routes were evaluated" is
     false for a project that configured nothing. Make it neutral.
  3. Change coordinator.ts:1677 to
     `configuredRoutes ?? builtInReviewRoutes(input.cwd, routes.author)`.
  4. Delete the ladder and its parallel builders (`exhaustedRunResult`,
     `degradedDescription`, `exhaustedExplanation`, the four run* rungs).

  EVIDENCE: `builtInReviewRoutes` already returns exactly the ladder's
  four rungs as ReviewRoute[], and already backs `review routes list`.
  The synthesis step is written; only the envelope blocks the switch.
out_of_scope:
  - Changing which reviewers are tried, in what order, or independence semantics.
  - Removing the flat legacy fields (that is the next-major follow-up the tripwire guards).
  - Reworking route CONFIG parsing or the `review routes` command surface.
  - The coordinator's other smells (e.g. `changedReviewResult` returning undefined for the not-changed case).
done_when:
  - One engine orchestrates review routes; the four-rung ladder is deleted.
  - A project with no `crossAgentReviewRoutes` gets a byte-compatible envelope: every key named in clarify-review-coverage.feature:163-166 still present, same finding codes.
  - Default-route projects additionally receive `review_routes`.
  - No result message claims routes were "configured" when they came from built-in defaults.
  - A tripwire test names the flat-field projection and the major in which to delete it.
  - Full CLI suite and the cucumber acceptance lane pass unchanged.
---

## Why now

Found during a repository refactor sweep (2026-09-05). Two engines doing one
job is the largest single duplication left in the CLI, and it sits on the
trust boundary: a drift between them shows up as wrong independence
reporting, which is the one thing the review system exists to get right.

Deferred out of that refactor branch deliberately — steps 1-3 change
observable output, so this is semver-visible work, not refactoring.

## Root question settled

Whether to take the envelope break now (2 commits) or carry a compatibility
projection (4 commits). Chose the projection: safeword auto-upgrades, and the
keys are named in an acceptance spec, so a silent shape change reaches
consumers with no warning. Revisit only if we decide to cut a major anyway.
