# Review findings and bounded decisions

The user requested formal verify, audit and the suggested improvements, then
invoked figure-it-out for the scenario conflict. This task implements proof
hardening; feature 5F5ZZA remains in progress at scenario-gate.

## Decision

Preserve main's runtime and correct the child wording. Canonical reviewer
contract identity hashes exact contract bytes in `assemblePlanContract` and
`createPlanningReviewIdentity`. Cosmetic installed author-copy drift instead
fails the separate exact-copy gate while preserving the review receipt.
Changing runtime normalization would regress #5957; rewriting the parent would
change an already-correct requirement. The smallest supported choice is factual
scenario/architecture correction plus isolated test hardening. The preserved
accepted-history approach also follows the [AWS ADR process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html).
Premortem: later readers could mistake scenario repairs for completed behavior;
the unchanged ledger and explicit failed broad dry-run prevent that inference.

## Fresh independent test reviews

Claude/opus cross-agent review 8b1fa2eb-33d2-4a10-9a5d-c1a3f2327872
approved with suggestions. Applied: exact configured-inventory membership with
distinct fallback bytes, a recording fake reviewer on an isolated PATH for
unowned targets, and guarded pending-worker cancellation. The earlier generic
existence assertion now requires a successful pending start; equivalent aliases
must normalize before ticket ownership admission. Both consuming fixture diffs
were manually checked: extraction preserves their existing assertions, and the
16-case protection run passes. This is test refactoring, not a new RED claim.

Claude/opus cross-agent review 44238cc8-99c4-4410-9706-f97eed5dce21
approves the revised tests without errors. Dispositions for remaining notes:

- The confirmation-time spec edit proves the public refusal with ticket bytes
  unchanged. Both boundary and authenticated currency may reject it; it does
  not isolate the private boundary-digest guard. A second principle edit proves
  context currency with the boundary unchanged. Retain this confidence limit
  rather than claiming branch coverage or adding internal-seam mocks. Changing
  to Implementation review would still bind the spec as context.
- Installed fixture freshness comes from the required build-lock test launcher,
  which rebuilds dist before running Vitest. Both protection and final commands
  use that launcher; direct bare Vitest is not the evidence command.
- Bun and POSIX process facilities are explicit fixture prerequisites, inherited
  from the existing installed tests and the CLI/PTY test lane. This run has both;
  it makes no native Windows or Bun-absent qualification claim.
- Empty numeric input remains a safely rejected, optional dense-input case.
  Required existing spellings `1e0`, `01`, and padded ` 1 ` are characterized;
  strict syntax is a separate compatibility decision.

The first hardening run failed one Execution disposition fixture: its fake
reviewer omitted the required `planning_destination`. The fixture now supplies
`plan-execution`; production validation and success assertions are unchanged.
The failure is retained and is not an intended product RED.

## Broad scenario review remains request-changes

All fresh rejections are retained, including
16d49a09-5f50-4262-982c-e4dc5a6db0f9. Its two remaining errors concern
unproven OpenCode advisory/enforcement guidance and a Given-echo proof of
contract-declared invalidation. They are real deficiencies in the broad
feature's executable proof, outside this residual Product/scenario admission
and disposition slice. No acceptance stamp or phase advancement is claimed.
Other retained warnings concern contract-shape rejection completeness, stale
upstream transition proof, actual cloud isolation, reviewer-selected product
choices, host coverage and unknown author-model independence. Host/native,
human experience and unchanged paid qualification remain deferred. In
particular, no #5086 fallback implementation is imported to answer them.

The final root feature dry-run reports 172 undefined expanded cases and 516
undefined steps (7,396 other imported steps skipped). The historical 166-case
observation remains historical; added scenario rows explain the increase.
Package acceptance success does not certify these root scenarios.
