# Measurement Design Guide

Use during Implementation Planning when the Product Plan promises a measured
outcome, or when a design or rollout decision depends on an observation. The
Product Plan owns the target, population, and measurement condition. The
Implementation Plan decides how the promised outcome will be observed without
silently changing that promise. If neither case applies, record why
measurement design is not applicable.

## Specify what the observation means

For each promise or decision signal, decide:

- Where the observation originates and which user action or system event it
  represents. Prefer a boundary close enough to the user to include the
  failures the promise covers.
- Which events count in the numerator and denominator, if a ratio applies;
  which users, clients, failures, and time windows are included or excluded.
- How missing events, duplicate events, delayed reporting, sampling, and
  partial outages affect the result. Name the confidence limit rather than
  presenting an incomplete signal as complete proof.
- What happens when the measurement system fails or the sample is too small
  to support the promised decision. Decide whether progress pauses, uses a
  separate signal, or remains explicitly unresolved.

Record the origin, method, validity safeguards, failure behavior, and
limitation in `impl-plan.md`. If the Product Plan's target or population needs
to change, return to Product Planning. Put metric names, instrumentation
calls, dashboard queries, collection commands, and verification results in
the Execution Plan.

**Example:** Product promises that a notification reaches 95% of eligible
users within one minute. The plan decides whether timing starts when the
request is accepted or when a job is queued, how eligibility is determined,
where delivery is observed, and how missing client receipts affect confidence.
It cannot redefine the promise as "95% of jobs queued" without a Product
decision.

## Sources and fit

- [Google SRE Workbook: Implementing SLOs](https://sre.google/workbook/implementing-slos/)
  distinguishes a user-facing indicator specification from an implementation
  of that indicator and explains coverage and measurement-location tradeoffs.
  Its reliability examples are methods, not default targets for every feature.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
  illustrates how consistent signal meaning helps producers and consumers
  interpret telemetry. Use the project's installed telemetry conventions when
  they exist; this guide does not require OpenTelemetry.
