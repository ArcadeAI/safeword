---
id: 68ZR5E
slug: harden-pr-readiness-review-follow-ups
type: task
phase: intake
status: in_progress
created: 2026-09-24T21:51:34.250Z
last_modified: 2026-09-24T23:53:44.000Z
related_to:
  - PY73VN
---

# Harden PR readiness after independent review

**Goal:** Resolve the seven non-blocking hardening opportunities identified by the final PY73VN independent reviews.

**Why:** Keep the completed feature focused while preserving concrete follow-up work on receipt integrity, ticket identity, install wiring proof, recovery copy, Cursor loading, and architecture scope.

## Scope

- Bind a pending readiness receipt to the tree observed when the ticket closes,
  and reject finalization when a later commit includes unverified non-ticket
  changes.
- Clear an active ticket binding after editing an archived done `ticket.md` only
  when that ticket's identity matches the active binding.
- Treat `gh pr create --draft=true` as Draft evidence while retaining
  `--draft=false` as a Ready-making command, with table-driven coverage for both.
- Make the Claude install integration test execute the hook path resolved from
  the generated manifest rather than a separately reconstructed path.
- Normalize the lowercase recovery reasons emitted by `unfinished()`.
- Separate the pure GitHub CLI argv classifier from the full readiness evaluator
  so Cursor's latency-sensitive adapter does not load the evaluator graph.
- Record OpenCode's accepted enforcement exclusion in the architecture decision.

## Verification

- Add discriminating regression coverage for each behavior or documentation
  contract above.
- Run the affected hook, install, lifecycle, and generated-parity suites.
- Run diff audit and independent quality review before closure.

## Work Log

- 2026-09-24T21:51:34.250Z Started: Created ticket 68ZR5E
- 2026-09-24T21:51:54.000Z Scoped: Preserved five non-blocking findings from PY73VN independent review `29992206-5009-4f0a-8a28-7dfc7404d9c6` as follow-up work.
- 2026-09-24T22:00:18.000Z Expanded: Added the safe false-block for `gh pr create --draft=true` found by closure review `a933a855-a1dc-4250-b650-1dce530e722d`; all six items remain bounded follow-up work outside PY73VN.
- 2026-09-24T23:53:44.000Z Expanded: Added the archived-ticket identity guard found by current-head review `ec58a4b9-3c6c-4a9a-90c5-2a7d3c4b85fe`; all seven items remain bounded follow-up work outside PY73VN.
