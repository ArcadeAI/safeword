# Distinguish execution repair from an unresolved design

Independently adjudicate the failing test before any routing change. Do not
assume either its expected destination or the observed destination is correct.

The test-local `unresolved-authorization-decision` case keeps the accepted
Implementation Plan's shared-authorization-service decision intact. Only the
Execution Plan Boundary adds an implementer choice between that service and
per-transport checks. Its integrity test proves every other plan byte unchanged.
The original production conformance case expects `plan-execution`; the
test-local override instead expects `plan-implementation`. The feature Then
requires a genuinely unresolved authorization decision to return to
Implementation Planning.

The observed live reviewer rejected the named Boundary but returned
`plan-execution`: it said the accepted decision was already settled and removing
the unapproved choice restores it without changing the Implementation Plan.
The rubric routes missing/changed accepted design decisions to Implementation
Planning and execution-only repair to Execution Planning.

Does this fixture establish an unresolved accepted design decision, or an
Execution Plan that must conform to an already settled decision? Identify
whether the defect is implementation, rubric, fixture, expectation or scenario
binding. If distinct cases are needed for both routes, describe the smallest
consistent positive/negative inputs without contradictory upstream decisions,
misleading accounting or routing hints. Preserve the promised rejection and
Implementation Planning behavior for a genuinely missing design boundary.
