# Feature Spec: Keep failed reviews out of benchmark scores

**Feature:** Make paid PR-review evaluations fail closed so infrastructure and reviewer failures cannot become silent clean reviews.

**Related Issue:** #1910
**Status:** In progress

## Surfaces

Affected:

- Internal PR-review evaluation harness — `skip: ticket-local research tooling, not a configured product surface`

Unaffected:

- Safeword CLI and installed agent workflows — the recovery changes only the ticket-local benchmark harness.

## Job: Trust a scored benchmark

### pr-review-eval.SWM1 — Trust a scored benchmark

**As a** Safeword Maintainer (SWM)
**I want** every scored trial to prove that the intended reviewer completed successfully
**So that** benchmark conclusions and further spend are based on real reviews rather than hidden failures.

#### pr-review-eval.SWM1.R1 — Only positively complete trials are scoreable

A trial is usable only when it has a non-empty provider response, the expected terminal finish, a schema-valid report with an explicit findings collection (which may be empty), the expected reviewer route, complete trace and usage, and matching frozen provenance. Missing or unknown evidence is invalid, never presumed successful. The schema exposes an explicit boolean `review-valid` admission claim, an explicit boolean `named-failure` claim, and matching-finding and consolidated-finding views; every scorer-consumed view must be present, well-formed, and agree with the routed reviewer outcome.

#### pr-review-eval.SWM1.R2 — Failure handling preserves paired experimental validity

A retryable transport failure—only a connection failure, HTTP 408, HTTP 429, or HTTP 5xx response—receives at most one retry with both attempts preserved. A second retryable transport failure excludes the entire paired case and selects the next preregistered reserve. Returned provider-error envelopes, including HTTP-200 envelopes, and content, parsing, schema, routing, and completion failures are semantic failures: they are not silently retried or scored.

#### pr-review-eval.SWM1.R3 — Scoring derives validity from admitted records

The scorer admits records through the same positive predicate, rejects incomplete cells, and computes every validity gate from observed admitted evidence rather than constants or file counts.

#### pr-review-eval.SWM1.R4 — A paid canary gates larger spend

Before a larger run, frozen no-cost failure fixtures and a ten-call paid canary must show 10/10 usable trials, exact agreement with preregistered labels, complete provenance and cost, and rejection of an injected hidden failure through the real provider-to-scorer wiring.

#### pr-review-eval.SWM1.R5 — Raw evidence and corpus roles cannot drift

Raw attempts must be hashed in an independently retained manifest before reuse and must match it thereafter. The void 2026-08-01 corpus is diagnostic only; calibration uses disjoint development cases, and confirmatory estimates use a fresh powered holdout with preregistered reserves.

## Constraints

- Preserve all attempt costs, including excluded and failed attempts; usable-call cost is reported separately and never presented as total run cost.
- Preserve an independently verifiable manifest of immutable raw artifacts before any artifact is reused.
- The invalid 2026-08-01 corpus is diagnostic only and cannot tune or confirm the replacement scorer.
- Confirmatory effect estimates require a fresh powered holdout and preregistered reserves.
