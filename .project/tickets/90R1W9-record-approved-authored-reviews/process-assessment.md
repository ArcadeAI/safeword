# Behavior, TDD and refactor assessment

Applied safeword:testing and safeword:tdd-review criteria to the changed tests,
and read safeword:bdd, safeword:review-spec and safeword:refactor. This is an
investigated bug task: BDD explicitly excludes bug fixes, so no feature intake,
invented spec, scenario-gate stamp or formal TDD ledger was created.

## Observable behavior

| Given | When | Then | Evidence |
| --- | --- | --- | --- |
| Authenticated, current coordinator exclusions and reviewed authored files | Approval is recorded | Exact generated files are waived | Real source CLI status → reader → gate integration |
| Another authored file lacks review | Approval is recorded | Recording is refused | Gate regression |
| Legacy receipt or malformed new field | Receipt is read | No exclusion waiver is granted | Reader and schema regressions |
| Signed exclusion names an ordinary file | Current status is collected | Verified exclusions omit that file | Coordinator regression |
| Classification changes or job is tampered | Current status is collected | Result is stale or invalid | Real authenticated-job regression |
| Only excluded files changed | Approval is recorded | No reviewed authored work earns approval | Gate regression |
| A completed real machine review | Its public keys are checked | The exact provenance field is present | Four Cucumber scenarios, strict exact-key assertion |

## TDD quality

The reader/gate mismatch, unclassified signed exclusion and malformed schema each
had actual failing regressions before their fixes. The acceptance correction also
had four genuine failures before updating its expected keys. Assertions inspect
observable decisions or real response fields, rather than source text. Fixtures
create independent Git projects; the public CLI integration exercises the actual
coordinator/reader/gate boundary. Schema tests prove shape only, while separate
runtime tests prove authorization. The authenticated-job lifecycle test keeps its
mutations in one ordered lifecycle to establish current → stale → restored →
tampered decisions. Pure gate cases cover one exact-waiver invariant across
aliases, unrelated files and legacy/stale receipts. No arbitrary sleep or mock
approval replaces the actual separate-process reviews.

## Refactor disposition

No additional change warranted. reviewIdentity already captures the packet once
and shares that identity between freshness and exclusion classification; the
existing classifier and path normalizer remain the single authorities. Moving
that logic into a second classification layer or new persistent attestation would
increase divergence. The receipt extension is optional for legacy compatibility.
The acceptance repair updates expected data without weakening assertions. No
unrelated parser, review-route, generated-file or historical-proof refactor belongs
in this bug fix.

## Experience walk

A developer requests an authored-source review, receives a genuine independent
approval, and records it without an additional command or user decision. The
candidate status exposes the verified exclusions automatically. An uncovered
authored file still blocks. The existing installed 1.0.0 recorder remains the
worst step: it rejects the valid approval until an authorized upgrade deploys the
fix. No Desktop activation or completed historical proofs are claimed.
