# Review-routing test-quality follow-up

Scope: the three review-routing features on PR #3617, following head
`5e3a5659859e9b6dbfbe08648fd54c320b5e5567`.

## Findings and repair

The prior proof manifests contained non-discriminating references: job reuse
stood in for cache-independent ordering, result rendering for process failure,
and parser/policy tests for public route configuration. Passing provenance
validation proved that these tests existed, not that they proved their scenarios.

- Scoped configuration: all 21 scenarios now name assembled CLI tests. Each
  outline registers its complete two-row user/project table. Assertions cover exact order,
  models, effective source, byte-preservation of the other scope, malformed
  configuration, reset, and first-write isolation.
- Ranked execution: real CLI/worker tests observe external process arguments and
  launch order, default-model omission, independent early completion, model-local
  failure continuation, complete exhaustion, deadlines, and legacy compatibility.
- OpenCode: real CLI/worker tests cover preferred pairs, retries, independent and
  degraded outcomes, output/provenance failures, source/packet mutation, bounded
  execution, and exact route-budget boundaries.
- Status evidence: seven public status proofs use genuine review
  jobs and isolated integrity keys; no fabricated durable result is accepted as
  evidence of a successful review.

## Current TDD-quality assessment

These are characterization/regression tests of an existing implementation, not
reconstructed historical RED/GREEN cycles. This follow-up cannot substantiate a
separate historical `tdd-review` invocation for every original implementation
slice.

Tests use real parsers, handlers, persistence, routing, workers, and result
projection. Controlled boundaries are reviewer executables, output capture,
environment, and a worker clock for exact deadlines. Test processes use isolated
profiles; new fixtures clean up their directories. Assertions identify concrete
observable regressions rather than relying on truthiness or mock call counts.
The simulated tool-denial case proves the invocation contract, not the actual
vendor runtime's enforcement; the existing OpenCode conformance lane remains
the separate vendor-boundary evidence.

Refactor assessment: reuse local fixtures and parameterized cases. No production
refactor or new shared test framework is needed for this proof repair.

## Open issue

The old scenario "A terminal preferred-reviewer failure skips retries" expects
OpenCode fallback. The runtime's terminal flag means a reviewer process could
not be contained, and correctly stops further launches. Its old manifest link
does not prove that claim. Clarifying an unavailable reviewer versus an
uncontained process requires reconciling the scenario; it is not counted proven.

## Verification

Typecheck passed after test-fixture corrections. The initial focused run had
189 passing tests and 16 failures: fixture environment isolation, asynchronous
completion, legitimate Claude model retries, stale-output expectations, and the
proof-sharing ratchet. After fixture corrections, all 130 selected review-wiring,
OpenCode, and initial status tests passed. The expanded status/scenario-specific
proof batch then passed 215 tests with only the unchanged proof-sharing ratchet
failing (53 versus 51). After the last two scenario-specific declarations were
split, the final review-wiring and BDD provenance run passed all 145 tests;
the other 71 tests passed in the expanded run. Typecheck and pre-commit lint
also passed. Full verification and independent quality review of this follow-up
remain pending until the scenario contract is reconciled. Diff audit found no dependency violations or
config drift; principle-trace findings are unchanged, unrelated ticket debt.

**Next:** run the targeted tests and BDD proof validation, resolve the terminal
scenario wording, then refresh independent review and exact-head PR evidence.
